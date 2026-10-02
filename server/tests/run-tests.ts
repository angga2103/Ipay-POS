import db from '../db/database';
import { AccountingService } from '../services/accounting';
import { InventoryService } from '../services/inventory';
import { PPOBService } from '../services/ppob';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runAllTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING POS IPAY AUTOMATED TEST SUITE');
  console.log('======================================================\n');

  // -----------------------------------------------------------
  // TEST 1: Double-Entry Auto-Journaling for Hybrid Sale (PRD Section 4)
  // -----------------------------------------------------------
  console.log('--- Test 1: PRD Hybrid Sale Auto-Journaling ---');
  const originalMode = (db.prepare("SELECT value FROM settings WHERE key = 'ipay_mode'").get() as any)?.value;
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('ipay_mode', 'sandbox')").run();
  const initialKas = (db.prepare("SELECT balance FROM chart_of_accounts WHERE code = '1-1001'").get() as any).balance;
  const initialDeposit = (db.prepare("SELECT balance FROM chart_of_accounts WHERE code = '1-1003'").get() as any).balance;

  const testInvoice = `TEST-INV-${Date.now()}`;
  const journalResult = AccountingService.recordHybridSale({
    order_id: 9999,
    invoice_no: testInvoice,
    total_retail: 70000,
    total_retail_cost: 62000,
    total_ppob: 22000,
    total_ppob_cost: 20150,
    grand_total: 92000,
    payment_method: 'CASH',
  });

  assert(journalResult.totalDebit === 174150, `Total Debit (${journalResult.totalDebit}) must equal 92.000 + 62.000 + 20.150 = 174.150`);
  assert(journalResult.totalCredit === 174150, `Total Credit (${journalResult.totalCredit}) must equal 70.000 + 22.000 + 62.000 + 20.150 = 174.150`);
  assert(journalResult.totalDebit === journalResult.totalCredit, 'Debits and Credits must be perfectly balanced');

  const afterKas = (db.prepare("SELECT balance FROM chart_of_accounts WHERE code = '1-1001'").get() as any).balance;
  assert(afterKas - initialKas === 92000, 'Cash in Drawer (1-1001) must increase by exactly Rp 92.000');

  const afterDeposit = (db.prepare("SELECT balance FROM chart_of_accounts WHERE code = '1-1003'").get() as any).balance;
  assert(initialDeposit - afterDeposit === 20150, 'PPOB Deposit (1-1003) must decrease by exactly Rp 20.150');

  // Verify Profit & Loss calculation
  const pl = AccountingService.getProfitAndLoss();
  assert(pl.retail.grossProfit >= 8000, 'Retail gross profit should reflect Rp 8.000 margin (70.000 - 62.000)');
  assert(pl.ppob.grossProfit >= 1850, 'PPOB gross profit should reflect Rp 1.850 margin (22.000 - 20.150)');

  // -----------------------------------------------------------
  // TEST 2: Multi-UOM Stock Deduction
  // -----------------------------------------------------------
  console.log('\n--- Test 2: Multi-UOM Stock Conversion ---');
  const mieBefore = (db.prepare("SELECT stock_quantity FROM products WHERE sku = 'RTL-MIE-GRG'").get() as any).stock_quantity;
  // Sell 2 Dus of Indomie (conversion factor 40 pcs/dus = 80 pcs total)
  const mieProduct = db.prepare("SELECT id FROM products WHERE sku = 'RTL-MIE-GRG'").get() as any;
  InventoryService.deductStock(mieProduct.id, 2, 40);
  const mieAfter = (db.prepare("SELECT stock_quantity FROM products WHERE sku = 'RTL-MIE-GRG'").get() as any).stock_quantity;
  assert(mieBefore - mieAfter === 80, `Selling 2 Dus must deduct exactly 80 base Pcs (from ${mieBefore} to ${mieAfter})`);

  // -----------------------------------------------------------
  // TEST 3: Tiered Wholesale Pricing
  // -----------------------------------------------------------
  console.log('\n--- Test 3: Tiered Wholesale Pricing ---');
  // Buy 1 pc: regular price 3500
  const p1 = InventoryService.calculateEffectivePrice(mieProduct.id, 3500, 1);
  assert(p1 === 3500, 'Price for 1 pc should be regular price Rp 3.500');
  // Buy 10 pcs: tier price 3300
  const p10 = InventoryService.calculateEffectivePrice(mieProduct.id, 3500, 10);
  assert(p10 === 3300, 'Price for 10 pcs should automatically drop to wholesale tier Rp 3.300');

  // -----------------------------------------------------------
  // TEST 4: Moving Average Costing on Goods Receipt
  // -----------------------------------------------------------
  console.log('\n--- Test 4: Moving Average Costing ---');
  // Create a temporary product for testing
  const testSku = `TEST-MAC-${Date.now()}`;
  const testBarcode = `BAR-${Date.now()}`;
  const tempProdRes = db.prepare(`
    INSERT INTO products (sku, barcode, name, cost_price, selling_price, stock_quantity)
    VALUES (?, ?, 'Test MAC Product', 10000, 15000, 10)
  `).run(testSku, testBarcode);
  const tempId = Number(tempProdRes.lastInsertRowid);

  // Old: 10 units @ Rp 10.000 = Rp 100.000
  // Received: 10 units @ Rp 12.000 = Rp 120.000
  // New total: 20 units, Total value: 220.000 => New Average Cost: Rp 11.000
  const macResult = InventoryService.processGoodsReceipt({
    productId: tempId,
    receivedQty: 10,
    unitCost: 12000,
  });
  assert(macResult.newAverageCost === 11000, `Moving Average cost must be Rp 11.000 (was ${macResult.newAverageCost})`);
  assert(macResult.newStock === 20, 'Stock must now be 20');

  // -----------------------------------------------------------
  // TEST 5: PPOB Purchase Execution & Auto-Reversal on Failure
  // -----------------------------------------------------------
  console.log('\n--- Test 5: PPOB Purchase & Auto-Reversal ---');
  const refId = `TEST-PPOB-${Date.now()}`;
  const purchaseRes = await PPOBService.executePurchase({
    sku: 'TSEL20',
    customer_no: '081234567890',
    ref_id: refId,
  });
  assert(purchaseRes.status === 'SUCCESS', 'PPOB purchase in sandbox must return SUCCESS');
  assert(typeof purchaseRes.sn_token === 'string' && purchaseRes.sn_token.length > 5, 'PPOB purchase must include valid SN');

  // Now simulate a Webhook FAILED event to test Auto-Reversal
  const depositBeforeReversal = (db.prepare("SELECT balance FROM chart_of_accounts WHERE code = '1-1003'").get() as any).balance;
  PPOBService.handleWebhook({
    ref_id: refId,
    status: 'failed',
    sn: '',
  });

  const depositAfterReversal = (db.prepare("SELECT balance FROM chart_of_accounts WHERE code = '1-1003'").get() as any).balance;
  assert(depositAfterReversal - depositBeforeReversal === 20150, 'Failed webhook must trigger auto-reversal and refund 20.150 back to deposit balance');

  // -----------------------------------------------------------
  // TEST 6: Trial Balance Equilibrium Verification
  // -----------------------------------------------------------
  console.log('\n--- Test 6: Trial Balance Equilibrium ---');
  const trialBalance = AccountingService.getTrialBalance();
  assert(trialBalance.isBalanced, `Trial balance must be completely balanced (Total Debit: ${trialBalance.totalDebit}, Total Credit: ${trialBalance.totalCredit})`);

  // Restore original settings
  if (originalMode) {
    db.prepare("UPDATE settings SET value = ? WHERE key = 'ipay_mode'").run(originalMode);
  }

  console.log('\n======================================================');
  console.log('🎉 ALL 6 BACKEND & ACCOUNTING INTEGRATION TESTS PASSED!');
  console.log('======================================================\n');
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
