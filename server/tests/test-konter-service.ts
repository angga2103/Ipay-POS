import db from '../db/database';
import { ServiceDeskService } from '../services/service-desk';
import { ThermalPrinterService } from '../services/printer';
import { AccountingService } from '../services/accounting';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runKonterServiceTests() {
  console.log('\n======================================================');
  console.log('📱 RUNNING KONTER HP & SERVICE DESK INTEGRATION TESTS');
  console.log('======================================================\n');

  // --- Test 1: Quick PIN Login Verification ---
  console.log('--- Test 1: Quick PIN Login Authentication ---');
  const cashierUser = db.prepare('SELECT * FROM users WHERE pin = ?').get('123456') as any;
  assert(cashierUser !== undefined, 'PIN 123456 must authenticate Kasir 1');
  assert(cashierUser.role === 'cashier', 'Kasir 1 must have role cashier');

  const spvUser = db.prepare('SELECT * FROM users WHERE pin = ?').get('223344') as any;
  assert(spvUser !== undefined, 'PIN 223344 must authenticate Supervisor');
  assert(spvUser.role === 'supervisor', 'Supervisor must have role supervisor');

  const ownerUser = db.prepare('SELECT * FROM users WHERE pin = ?').get('112233') as any;
  assert(ownerUser !== undefined, 'PIN 112233 must authenticate Owner');
  assert(ownerUser.role === 'owner', 'Owner must have role owner');

  // --- Test 2: Smartphone Order with IMEI Tracking & Receipt ---
  console.log('\n--- Test 2: Smartphone Order with IMEI Tracking ---');
  const phone = db.prepare("SELECT * FROM products WHERE sku = 'HP-RDMN13'").get() as any;
  assert(phone !== undefined, 'Redmi Note 13 smartphone product must exist in database');
  assert(phone.requires_imei === 1, 'Redmi Note 13 must require IMEI tracking');

  const testImei = '864209041234567';
  const orderId = db.transaction(() => {
    const res = db.prepare(`
      INSERT INTO orders (
        invoice_no, shift_id, cashier_id, total_retail, total_ppob,
        grand_total, payment_method, cash_tendered, change_amount, status
      ) VALUES ('INV/TEST/IMEI-' || hex(randomblob(4)), 1, 1, 2399000, 0, 2399000, 'CASH', 2400000, 1000, 'PAID')
    `).run();

    db.prepare(`
      INSERT INTO order_items (
        order_id, item_type, product_id, item_name, unit_name,
        quantity, cost_price, unit_price, subtotal, imei_sn
      ) VALUES (?, 'RETAIL', ?, ?, 'Unit', 1, ?, ?, ?, ?)
    `).run(res.lastInsertRowid, phone.id, phone.name, phone.cost_price, phone.selling_price, phone.selling_price, testImei);

    return res.lastInsertRowid;
  })();

  const savedItem = db.prepare('SELECT * FROM order_items WHERE order_id = ?').get(orderId) as any;
  assert(savedItem.imei_sn === testImei, `Item imei_sn in DB must match '${testImei}'`);

  const orderData = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  const receiptText = ThermalPrinterService.formatReceiptText({
    order: orderData,
    items: [savedItem],
  });

  assert(receiptText.includes(`IMEI/SN: ${testImei}`), 'Thermal receipt must contain the registered IMEI number');
  console.log('Sample Thermal Receipt with IMEI:');
  console.log(receiptText.split('\n').slice(0, 15).join('\n'));

  // --- Test 3: Konter HP Service Desk Lifecycle (Intake -> Processing -> Pickup & Settlement) ---
  console.log('\n--- Test 3: Konter HP Service Desk Lifecycle ---');
  const serviceInput = {
    customer_name: 'Doni Pratama',
    customer_phone: '081298765432',
    device_brand_model: 'Samsung Galaxy A54 5G',
    imei_sn: '354890123456789',
    passcode: 'Pola L terbalik',
    issue_description: 'Layar retak dan LCD blank hitam setelah jatuh',
    completeness: 'Unit HP + Dus',
    estimated_cost: 650000,
    down_payment: 150000,
    technician_name: 'Budi (Teknisi HP)',
    technician_notes: 'Cek konektor flexi LCD & part original',
  };

  const newService = ServiceDeskService.create(serviceInput);
  assert(newService.service_no.startsWith('SRV-'), `Service No must start with SRV- (got ${newService.service_no})`);
  assert(newService.status === 'PENDING', 'New service order must start with PENDING status');
  assert(newService.down_payment === 150000, 'Down payment must be recorded as Rp 150.000');

  // Verify intake receipt
  const intakeReceipt = ServiceDeskService.formatIntakeReceipt(newService);
  assert(intakeReceipt.includes('TANDA TERIMA SERVIS'), 'Receipt must be Tanda Terima Servis');
  assert(intakeReceipt.includes('Samsung Galaxy A54 5G'), 'Receipt must include device model');
  assert(intakeReceipt.includes('Sisa Estimasi'), 'Receipt must display remaining estimated cost');

  // Technician works on it
  const inProgress = ServiceDeskService.updateStatus(newService.id, 'PROCESSING', 'Mulai bongkar dan ganti modul LCD');
  assert(inProgress.status === 'PROCESSING', 'Status must update to PROCESSING');

  // Technician completes it
  const ready = ServiceDeskService.updateStatus(newService.id, 'COMPLETED', 'LCD ganti ori Samsung, tested touch & display ok');
  assert(ready.status === 'COMPLETED', 'Status must update to COMPLETED');

  // Customer arrives for pickup & settles remaining Rp 500.000
  const settleResult = ServiceDeskService.pickupAndSettle({
    id: newService.id,
    payment_method: 'CASH',
    cash_tendered: 500000,
    notes: 'Garansi 7 hari berlaku sampai minggu depan',
  });

  assert(settleResult.service.status === 'PICKED_UP', 'Status after settlement must be PICKED_UP');
  assert(settleResult.remainingToPay === 500000, 'Remaining to pay must be Rp 500.000');
  assert(settleResult.change === 0, 'Change amount must be Rp 0');
  assert(settleResult.receiptText.includes('NOTA PELUNASAN SERVIS'), 'Pickup receipt must be Nota Pelunasan');
  assert(settleResult.receiptText.includes('GARANSI SERVIS 7 HARI'), 'Pickup receipt must include 7-day warranty notice');

  // Check Accounting Journal for Service Revenue
  const journalEntry = db.prepare("SELECT * FROM journal_entries WHERE reference_id = ?").get(newService.service_no) as any;
  assert(journalEntry !== undefined, `Journal entry must be recorded for service reference ${newService.service_no}`);
  assert(journalEntry.total_debit === 500000, 'Journal entry debit must be Rp 500.000');
  assert(journalEntry.total_credit === 500000, 'Journal entry credit must be Rp 500.000');

  console.log('\n======================================================');
  console.log('🎉 ALL KONTER HP & SERVICE DESK TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

runKonterServiceTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
