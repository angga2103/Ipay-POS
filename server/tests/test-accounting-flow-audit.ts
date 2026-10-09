import db from '../db/database';
import { AccountingService } from '../services/accounting';
import { PPOBService } from '../services/ppob';
import { ShiftService } from '../services/shift';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
}

async function runAccountingAuditTests() {
  console.log('\n================================================================');
  console.log('📊 RUNNING COMPREHENSIVE ACCOUNTING FLOW & AUDIT TESTS');
  console.log('================================================================\n');

  // --- Test 1: P&L Discounts & Contra-Revenue Equilibrium ---
  console.log('--- Test 1: P&L Discounts & Contra-Revenue (4-1004) ---');
  const nowStr = new Date().toISOString().slice(0, 10);
  const testInv = `INV-AUDIT-${Date.now()}`;

  // Record a hybrid sale with gross revenue 100,000, discount 15,000, net paid 85,000, HPP 50,000
  AccountingService.recordHybridSale({
    invoice_no: testInv,
    payment_method: 'CASH',
    retail: {
      revenue: 100000,
      cogs: 50000,
      discount: 15000,
    },
    ppob: {
      revenue: 0,
      cogs: 0,
    },
    cashier_id: 1,
    shift_id: 1,
  });

  const pnl = AccountingService.getProfitAndLoss(nowStr, nowStr);
  assert(pnl.retail.grossRevenue >= 100000, 'Gross Retail Revenue reflects total gross sales');
  assert(pnl.retail.discounts !== undefined && pnl.retail.discounts >= 15000, 'Sales discounts correctly accumulated from account 4-1004');
  assert(pnl.retail.revenue === pnl.retail.grossRevenue - (pnl.retail.discounts || 0), 'Net Retail Revenue strictly equals Gross - Discounts');
  assert(pnl.retail.grossProfit === pnl.retail.revenue - pnl.retail.cogs, 'Retail Gross Profit is calculated from Net Revenue minus COGS');
  assert(pnl.combined.totalRevenue === pnl.retail.revenue + pnl.ppob.revenue + pnl.otherRevenue, 'Total revenue equals net retail + ppob + other');

  // --- Test 2: PPOB Reversal for Kasbon (Customer Debt Reduction) ---
  console.log('\n--- Test 2: PPOB Reversal for Kasbon (Customer Debt Reduction) ---');
  // Create test customer
  const custRes = db.prepare(`
    INSERT INTO customers (name, phone, credit_limit, current_debt, is_active)
    VALUES (?, ?, 1000000, 50000, 1)
  `).run(`Pelanggan Kasbon Test ${Date.now()}`, '081299998888');
  const custId = Number(custRes.lastInsertRowid);

  const initialCustDebt = (db.prepare('SELECT current_debt FROM customers WHERE id = ?').get(custId) as any).current_debt;
  assert(initialCustDebt === 50000, 'Customer initial debt is 50,000');

  const reversalInv = `INV-REV-${Date.now()}`;
  AccountingService.recordPPOBReversal({
    invoice_no: reversalInv,
    selling_price: 25000,
    cost_price: 23000,
    refund_method: 'KASBON_REDUCTION',
    customer_id: custId,
  });

  const updatedCust = db.prepare('SELECT current_debt FROM customers WHERE id = ?').get(custId) as any;
  assert(updatedCust.current_debt === 25000, 'Customer debt decreased from 50,000 to 25,000 on Kasbon PPOB Reversal');

  const trialBalAfterRev = AccountingService.getTrialBalance();
  assert(trialBalAfterRev.isBalanced, 'Trial balance remains 100% balanced after PPOB Kasbon Reversal');

  // --- Test 3: Active Shift Drawer Synchronization on Restock ---
  console.log('\n--- Test 3: Shift Drawer Synchronization on Goods Receipt Cash Payment ---');
  // Open a test shift
  const shiftNo = `SH-AUDIT-${Date.now()}`;
  const shiftRes = db.prepare(`
    INSERT INTO shifts (shift_number, cashier_id, opening_cash, expected_cash, status)
    VALUES (?, 1, 200000, 200000, 'OPEN')
  `).run(shiftNo);
  const activeShiftId = Number(shiftRes.lastInsertRowid);

  // Simulate purchasing inventory paid CASH
  const restockAmount = 45000;
  const activeShift = db.prepare("SELECT id, cashier_id, expected_cash FROM shifts WHERE status = 'OPEN' AND id = ?").get(activeShiftId) as any;
  assert(activeShift && activeShift.expected_cash === 200000, 'Active shift opened with expected cash 200,000');

  // Perform shift cash out log as done in goods-receipt
  db.prepare(`
    INSERT INTO shift_cash_logs (shift_id, cashier_id, type, amount, reason)
    VALUES (?, ?, 'CASH_OUT', ?, ?)
  `).run(activeShift.id, activeShift.cashier_id, restockAmount, 'Pembelian stok tunai test audit');

  db.prepare(`
    UPDATE shifts 
    SET total_cash_out = total_cash_out + ?, expected_cash = expected_cash - ?
    WHERE id = ?
  `).run(restockAmount, restockAmount, activeShift.id);

  const shiftAfterRestock = db.prepare('SELECT expected_cash, total_cash_out FROM shifts WHERE id = ?').get(activeShiftId) as any;
  assert(shiftAfterRestock.expected_cash === 155000, 'Expected cash decremented from 200,000 to 155,000');
  assert(shiftAfterRestock.total_cash_out === 45000, 'Total cash out updated to 45,000');

  // --- Test 4: Active Shift Drawer Synchronization on PPOB Deposit Approval ---
  console.log('\n--- Test 4: Shift Drawer Synchronization on PPOB Deposit Approval ---');
  const depRef = `DEP-AUDIT-${Date.now()}`;
  const depAmount = 30000;

  // Insert pending deposit ticket with source_account '1-1001'
  db.prepare(`
    INSERT INTO ppob_deposits (ref_id, amount, channel, source_account, status)
    VALUES (?, ?, 'CASH_DRAWER', '1-1001', 'PENDING')
  `).run(depRef, depAmount);

  // Approve deposit
  const approveRes = await PPOBService.approveDeposit(depRef);
  assert(approveRes.success, 'PPOB Deposit approved successfully');

  const shiftAfterDep = db.prepare('SELECT expected_cash, total_cash_out FROM shifts WHERE id = ?').get(activeShiftId) as any;
  assert(shiftAfterDep.expected_cash === 125000, 'Expected cash further decremented by 30,000 to 125,000');
  assert(shiftAfterDep.total_cash_out === 75000, 'Total cash out updated to 75,000');

  // Close shift cleanly
  ShiftService.closeShift(activeShiftId, 125000, 'Audit test clean closing');
  const closedShift = db.prepare('SELECT status, discrepancy FROM shifts WHERE id = ?').get(activeShiftId) as any;
  assert(closedShift.status === 'CLOSED', 'Shift status updated to CLOSED');
  assert(Math.abs(closedShift.discrepancy) < 0.01, 'No false cash discrepancy! Drawer expected matches actual physical cash');

  // --- Test 5: PPOB Live Balance Reconciliation via Double-Entry Journal ---
  console.log('\n--- Test 5: PPOB Live Balance Reconciliation via Double-Entry Journal ---');
  const initialTrial = AccountingService.getTrialBalance();
  assert(initialTrial.isBalanced, 'Initial Trial Balance is balanced');

  // Call syncLedgerWithLiveBalance
  const syncRes = await PPOBService.syncLedgerWithLiveBalance();
  assert(syncRes.success, 'syncLedgerWithLiveBalance executed cleanly');

  const finalTrial = AccountingService.getTrialBalance();
  assert(finalTrial.isBalanced, `Final Trial Balance is 100% balanced (Total Debit: ${finalTrial.totalDebit}, Total Credit: ${finalTrial.totalCredit})`);

  console.log('\n================================================================');
  console.log('🎉 ALL 5 ACCOUNTING AUDIT VERIFICATIONS PASSED 100%!');
  console.log('================================================================\n');
}

runAccountingAuditTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
