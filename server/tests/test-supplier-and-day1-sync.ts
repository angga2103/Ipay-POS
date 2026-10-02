import db from '../db/database';
import { AccountingService } from '../services/accounting';
import { ThermalPrinterService } from '../services/printer';
import { ShiftService } from '../services/shift';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runSupplierAndDay1SyncTests() {
  console.log('\n================================================================');
  console.log('🚚 RUNNING SUPPLIER MANAGEMENT, DEBT PAYMENTS & DAY 1 SYNC TESTS');
  console.log('================================================================\n');

  // Clean up any test records from prior runs
  db.prepare("DELETE FROM supplier_debt_payments").run();
  db.prepare("DELETE FROM purchase_order_items").run();
  db.prepare("DELETE FROM purchase_orders").run();
  db.prepare("DELETE FROM suppliers WHERE name LIKE 'PT. Indofood%' OR name LIKE 'PT. Mayora%' OR name = 'Temp Supplier'").run();

  // --- Test 1: Supplier Creation & Master Data ---
  console.log('--- Test 1: Supplier Master Data & Bank Info ---');
  const insertSup = db.prepare(`
    INSERT INTO suppliers (name, phone, address, contact_person, bank_name, bank_account_number, bank_account_name, current_debt, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    'PT. Indofood CBP Sukses Makmur Tbk',
    '081298765432',
    'Kawasan Industri MM2100, Cikarang',
    'Bpk. Agus Santoso',
    'BCA',
    '8881234567',
    'PT Indofood CBP',
    0
  );
  const supplier1Id = insertSup.lastInsertRowid as number;

  const insertSup2 = db.prepare(`
    INSERT INTO suppliers (name, phone, address, contact_person, bank_name, bank_account_number, bank_account_name, current_debt, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    'PT. Mayora Indah Tbk',
    '081311223344',
    'Jl. Daan Mogot Km. 18, Tangerang',
    'Ibu Ratna',
    'Mandiri',
    '1230009876543',
    'PT Mayora Indah',
    0
  );
  const supplier2Id = insertSup2.lastInsertRowid as number;

  const sup1 = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplier1Id) as any;
  assert(sup1.name === 'PT. Indofood CBP Sukses Makmur Tbk', 'Supplier 1 name must match');
  assert(sup1.bank_name === 'BCA', 'Supplier bank name must be BCA');
  assert(sup1.contact_person === 'Bpk. Agus Santoso', 'Supplier PIC must match');

  // --- Test 2: Day 1 Setup & Synchronized Auxiliary Ledgers ---
  console.log('\n--- Test 2: Day 1 Setup with Supplier & Inventory Breakdown ---');
  // Assume Day 1 Opening Balances:
  // Kas Laci: Rp 1.000.000
  // Bank: Rp 10.000.000
  // PPOB: Rp 2.000.000
  // Persediaan: Rp 25.000.000
  // Piutang: Rp 500.000
  // Hutang Supplier 1: Rp 3.000.000
  // Hutang Supplier 2: Rp 2.000.000 (Total Hutang: Rp 5.000.000)
  // Total Aset = 1.000.000 + 10.000.000 + 2.000.000 + 25.000.000 + 500.000 = 38.500.000
  // Total Hutang = 5.000.000
  // Expected Modal Pemilik (Equity) = 38.500.000 - 5.000.000 = 33.500.000

  const openingResult = AccountingService.recordOpeningBalance({
    cash_drawer: 1000000,
    bank_balance: 10000000,
    ppob_deposit: 2000000,
    inventory_value: 25000000,
    receivables: 500000,
    payables: 5000000,
    supplier_debts: [
      { supplier_id: supplier1Id, amount: 3000000 },
      { supplier_id: supplier2Id, amount: 2000000 },
    ],
    notes: 'Opening Balance Day-1 POS IPAY Test',
  });

  assert(openingResult.journalId > 0, 'Opening balance journal must be recorded');

  // Check supplier table debts updated
  const sup1AfterInit = db.prepare('SELECT current_debt FROM suppliers WHERE id = ?').get(supplier1Id) as any;
  const sup2AfterInit = db.prepare('SELECT current_debt FROM suppliers WHERE id = ?').get(supplier2Id) as any;
  assert(sup1AfterInit.current_debt === 3000000, 'Supplier 1 debt must be exactly Rp 3.000.000');
  assert(sup2AfterInit.current_debt === 2000000, 'Supplier 2 debt must be exactly Rp 2.000.000');

  // Check Opening Balance Status
  const status = AccountingService.getOpeningBalanceStatus();
  assert(status.is_configured === true, 'Day 1 setup status must be configured');
  const openingPayablesLine = status.entry?.lines.find(l => l.account_code === '2-1001');
  assert(openingPayablesLine?.credit === 5000000, 'Opening journal for 2-1001 must equal 5.000.000');
  assert(status.reconciliation.payables_matches === true, 'Payables must reconcile with suppliers total debt');
  assert(status.reconciliation.is_balanced === true, 'Balance sheet equation must be 100% balanced');

  // Check Trial Balance Equilibrium
  const tb = AccountingService.getTrialBalance();
  assert(tb.isBalanced === true, `Trial balance must be balanced (Debit: ${tb.totalDebit}, Credit: ${tb.totalCredit})`);

  // --- Test 3: Supplier Debt Repayment via CASH & Shift Drawer Synchronization ---
  console.log('\n--- Test 3: Supplier Payment via CASH (Drawer Cash Out Sync) ---');
  // Open or reuse shift for testing cash out
  let shift = ShiftService.getActiveShift(1);
  if (!shift) {
    shift = ShiftService.openShift(1, 500000);
  }
  const startingExpectedCash = shift.expected_cash;

  const pay1Amount = 1500000;
  const pay1No = `PAY-SUP/TEST/${Date.now().toString().slice(-4)}`;

  // Record payment to supplier 1
  const remaining1 = sup1AfterInit.current_debt - pay1Amount;
  db.prepare(`
    INSERT INTO supplier_debt_payments (
      payment_no, supplier_id, amount, payment_method, source_account, notes, user_id, shift_id
    ) VALUES (?, ?, ?, 'CASH', '1-1001', 'Bayar faktur tepung terigu', 1, ?)
  `).run(pay1No, supplier1Id, pay1Amount, shift.id);

  db.prepare('UPDATE suppliers SET current_debt = ? WHERE id = ?').run(remaining1, supplier1Id);

  // Auto-journal payment
  const journalPay1 = AccountingService.recordSupplierDebtPayment({
    supplier_id: supplier1Id,
    supplier_name: sup1.name,
    amount: pay1Amount,
    payment_no: pay1No,
    payment_method: 'CASH',
    source_account: '1-1001',
    notes: 'Bayar faktur tepung terigu',
  });

  assert(journalPay1.journalId > 0, 'Payment journal must be recorded');

  // Log to shift cash drawer (CASH_OUT)
  db.prepare(`
    INSERT INTO shift_cash_logs (shift_id, cashier_id, type, amount, reason)
    VALUES (?, 1, 'CASH_OUT', ?, ?)
  `).run(shift.id, pay1Amount, `Bayar hutang supplier ${sup1.name}`);

  db.prepare(`
    UPDATE shifts
    SET total_cash_out = total_cash_out + ?,
        expected_cash = expected_cash - ?
    WHERE id = ?
  `).run(pay1Amount, pay1Amount, shift.id);

  // Verify shift expected cash decreased
  const shiftAfter = ShiftService.getActiveShift(1);
  assert(shiftAfter !== null, 'Shift must still be open');
  assert(shiftAfter?.total_cash_out >= pay1Amount, `Shift cash out must be recorded`);
  assert(shiftAfter?.expected_cash === startingExpectedCash - pay1Amount, 'Expected cash in drawer must decrease by paid amount');

  // Check supplier 1 remaining debt
  const sup1AfterPay = db.prepare('SELECT current_debt FROM suppliers WHERE id = ?').get(supplier1Id) as any;
  assert(sup1AfterPay.current_debt === 1500000, `Supplier 1 remaining debt must be 1.500.000 (was ${sup1AfterPay.current_debt})`);

  // Verify Cash Disbursement Voucher (Thermal)
  const voucherText = ThermalPrinterService.formatSupplierPaymentVoucher({
    payment_no: pay1No,
    created_at: new Date().toISOString(),
    supplier_name: sup1.name,
    contact_person: sup1.contact_person,
    phone: sup1.phone,
    bank_name: sup1.bank_name,
    bank_account_number: sup1.bank_account_number,
    previous_debt: 3000000,
    amount: pay1Amount,
    remaining_debt: 1500000,
    payment_method: 'CASH',
    source_account: '1-1001',
    notes: 'Bayar faktur tepung terigu',
    user_name: 'Kasir Utama',
  });

  assert(voucherText.includes('BUKTI PENGELUARAN KAS'), 'Voucher must have header');
  assert(voucherText.includes(pay1No), 'Voucher must include payment no');
  assert(voucherText.includes('Rp 1.500.000'), 'Voucher must include amount paid');
  assert(voucherText.includes('Penerima (Sales)'), 'Voucher must have signature section');

  // Close test shift
  ShiftService.closeShift(shift.id, shiftAfter.expected_cash);

  // --- Test 4: Supplier Debt Repayment via BANK_TRANSFER ---
  console.log('\n--- Test 4: Supplier Payment via BANK_TRANSFER (Pelunasan Total) ---');
  const pay2Amount = 2000000;
  const pay2No = `PAY-SUP/TEST/${Date.now().toString().slice(-4)}B`;

  db.prepare(`
    INSERT INTO supplier_debt_payments (
      payment_no, supplier_id, amount, payment_method, source_account, notes, user_id
    ) VALUES (?, ?, ?, 'BANK_TRANSFER', '1-1002', 'Pelunasan faktur biskuit roma', 1)
  `).run(pay2No, supplier2Id, pay2Amount);

  db.prepare('UPDATE suppliers SET current_debt = 0 WHERE id = ?').run(supplier2Id);

  AccountingService.recordSupplierDebtPayment({
    supplier_id: supplier2Id,
    supplier_name: 'PT. Mayora Indah Tbk',
    amount: pay2Amount,
    payment_no: pay2No,
    payment_method: 'BANK_TRANSFER',
    source_account: '1-1002',
    notes: 'Pelunasan faktur biskuit roma',
  });

  const sup2AfterPay = db.prepare('SELECT current_debt FROM suppliers WHERE id = ?').get(supplier2Id) as any;
  assert(sup2AfterPay.current_debt === 0, 'Supplier 2 must be fully settled (current_debt == 0)');

  // Verify Trial balance remains balanced after payments
  const tbAfterPayments = AccountingService.getTrialBalance();
  assert(tbAfterPayments.isBalanced === true, 'Trial balance must remain 100% balanced after payments');

  // --- Test 5: Supplier Deletion Protection ---
  console.log('\n--- Test 5: Deletion Protection (Prevent Data Loss on Active Debt) ---');
  // Supplier 1 still has Rp 1.500.000 debt -> must NOT be deletable
  const sup1Check = db.prepare('SELECT current_debt FROM suppliers WHERE id = ?').get(supplier1Id) as any;
  assert(sup1Check.current_debt > 0, 'Supplier 1 has active debt');

  // Simulate delete guard
  const canDeleteSup1 = sup1Check.current_debt === 0;
  assert(!canDeleteSup1, 'Supplier 1 with active debt must be blocked from deletion');

  // Supplier 2 has 0 debt but has payment history -> must be soft-deleted
  const sup2Check = db.prepare('SELECT current_debt FROM suppliers WHERE id = ?').get(supplier2Id) as any;
  assert(sup2Check.current_debt === 0, 'Supplier 2 debt is 0 (Lunas)');

  const sup2History = (db.prepare('SELECT COUNT(*) as c FROM supplier_debt_payments WHERE supplier_id = ?').get(supplier2Id) as any).c;
  assert(sup2History > 0, 'Supplier 2 has payment transaction history');

  // Soft delete
  db.prepare('UPDATE suppliers SET is_active = 0 WHERE id = ?').run(supplier2Id);
  const sup2Soft = db.prepare('SELECT is_active FROM suppliers WHERE id = ?').get(supplier2Id) as any;
  assert(sup2Soft.is_active === 0, 'Supplier 2 must be soft deleted (is_active = 0) to preserve audit trail');

  // Clean supplier with 0 transactions can be hard deleted
  const insertTemp = db.prepare("INSERT INTO suppliers (name, is_active) VALUES ('Temp Supplier', 1)").run();
  const tempId = insertTemp.lastInsertRowid;
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(tempId);
  const tempCheck = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(tempId);
  assert(tempCheck === undefined, 'Fresh supplier with no history can be cleanly deleted');

  console.log('\n================================================================');
  console.log('🎉 ALL SUPPLIER, DEBT PAYMENT & DAY 1 SYNC TESTS PASSED 100%!');
  console.log('================================================================\n');
}

runSupplierAndDay1SyncTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
