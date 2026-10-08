import db from '../db/database';
import { AccountingService } from '../services/accounting';
import { PPOBService } from '../services/ppob';
import { ThermalPrinterService } from '../services/printer';
import { hashSecret, verifySecret } from '../utils/auth-token';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runReturAndOperationalTests() {
  console.log('\n================================================================');
  console.log('🔄 RUNNING RETUR, OPERATIONAL EXPENSES, DEPOSIT & OPERATOR TESTS');
  console.log('================================================================\n');

  // --- Test 1: PPOB Deposit Flow (No Auto-Increase until Approved) ---
  console.log('--- Test 1: PPOB Deposit Flow (No Auto-Increase on Pending Ticket) ---');
  const initialDepositBalance = (db.prepare("SELECT balance FROM chart_of_accounts WHERE code = '1-1003'").get() as any).balance;
  
  const depReq = await PPOBService.createDepositRequest({
    amount: 150000,
    channel: 'BCA_TRANSFER',
    sourceAccount: '1-1001',
    notes: 'Test Deposit BCA',
  });

  assert(depReq.success === true, 'Deposit ticket creation must succeed');
  assert(depReq.data && depReq.data.ref_id, 'Deposit ticket must return ref_id');
  assert(depReq.data.unique_code >= 100 && depReq.data.unique_code <= 999, 'Deposit ticket must include 3-digit unique code (100-999)');
  assert(depReq.data.amount === depReq.data.base_amount + depReq.data.unique_code, 'Deposit total amount must equal base_amount + unique_code');

  const refId = depReq.data.ref_id;

  // Verify status in DB is PENDING
  const savedDeposit = db.prepare('SELECT * FROM ppob_deposits WHERE ref_id = ?').get(refId) as any;
  assert(savedDeposit !== undefined, 'Deposit must be saved in ppob_deposits table');
  assert(savedDeposit.status === 'PENDING', 'New deposit status must be PENDING');

  // CRITICAL CHECK: Balance in Account 1-1003 MUST NOT CHANGE YET!
  const depositBalanceDuringPending = (db.prepare("SELECT balance FROM chart_of_accounts WHERE code = '1-1003'").get() as any).balance;
  assert(
    depositBalanceDuringPending === initialDepositBalance,
    `Deposit balance must NOT increase when ticket is pending (was ${initialDepositBalance}, currently ${depositBalanceDuringPending})`
  );

  // Now, Admin approves deposit
  console.log('--- Test 1B: Deposit Approval by Admin (Balance Increases) ---');
  const approveRes = await PPOBService.approveDeposit(refId);
  assert(approveRes.success === true, 'Admin approve deposit must succeed');

  const approvedDeposit = db.prepare('SELECT * FROM ppob_deposits WHERE ref_id = ?').get(refId) as any;
  assert(approvedDeposit.status === 'APPROVED', 'Deposit status must now be APPROVED');

  // Verify Balance in Account 1-1003 has now increased by exactly approvedDeposit.amount (nominal + unique code)
  const depositBalanceAfterApprove = (db.prepare("SELECT balance FROM chart_of_accounts WHERE code = '1-1003'").get() as any).balance;
  assert(
    depositBalanceAfterApprove - initialDepositBalance === approvedDeposit.amount,
    `Deposit balance must increase by approved amount (Rp ${approvedDeposit.amount}) after approval (got ${depositBalanceAfterApprove - initialDepositBalance})`
  );

  // --- Test 2: Operator RBAC & Switch User Authentication ---
  console.log('\n--- Test 2: Operator RBAC & Switch Authentication ---');
  const testCashierUser = 'kasir_test_' + Date.now();
  db.prepare(`
    INSERT INTO users (username, password, name, role, pin, is_active)
    VALUES (?, ?, ?, 'cashier', ?, 1)
  `).run(testCashierUser, hashSecret('kasir123'), 'Kasir Toko Uji', hashSecret('123456'));

  const createdCashier = db.prepare('SELECT * FROM users WHERE username = ?').get(testCashierUser) as any;
  assert(createdCashier !== undefined, 'New operator must be created');
  assert(verifySecret('kasir123', createdCashier.password), 'Password hash must verify correctly');
  assert(verifySecret('123456', createdCashier.pin), 'PIN hash must verify correctly');
  assert(!verifySecret('wrongpin', createdCashier.pin), 'Wrong PIN must be rejected');

  // --- Test 3: Operational Transactions (Pengeluaran & Pemasukan Lain-lain) ---
  console.log('\n--- Test 3: Operational Transactions (Expenses & Incomes) ---');
  const initialCashDrawer = (db.prepare("SELECT balance FROM chart_of_accounts WHERE code = '1-1001'").get() as any).balance;

  // 3A: Pemasukan Lain-lain (Jual kardus bekas Rp 50.000)
  const txIncomeNo = `PMS-${Date.now()}`;
  db.prepare(`
    INSERT INTO operational_transactions (tx_no, type, category, description, amount, payment_source)
    VALUES (?, 'INCOME', 'Jual Kardus Bekas', 'Penjualan kardus bekas gudang 20kg', 50000, '1-1001')
  `).run(txIncomeNo);

  AccountingService.createJournalEntry({
    reference_type: 'INCOME',
    reference_id: txIncomeNo,
    description: 'Pemasukan Jual Kardus Bekas',
    lines: [
      { account_code: '1-1001', debit: 50000, credit: 0, memo: 'Jual Kardus Bekas' },
      { account_code: '4-1003', debit: 0, credit: 50000, memo: 'Pendapatan Lain-lain' },
    ],
  });

  const cashAfterIncome = (db.prepare("SELECT balance FROM chart_of_accounts WHERE code = '1-1001'").get() as any).balance;
  assert(cashAfterIncome - initialCashDrawer === 50000, 'Cash in drawer must increase by 50.000 after other income');

  // 3B: Pengeluaran Umum (Beli lakban & kresek Rp 20.000)
  const txExpenseNo = `BBN-${Date.now()}`;
  db.prepare(`
    INSERT INTO operational_transactions (tx_no, type, category, description, amount, payment_source)
    VALUES (?, 'EXPENSE', 'Operasional Toko', 'Beli lakban coklat & kantong kresek', 20000, '1-1001')
  `).run(txExpenseNo);

  AccountingService.createJournalEntry({
    reference_type: 'EXPENSE',
    reference_id: txExpenseNo,
    description: 'Pengeluaran Lakban & Kresek',
    lines: [
      { account_code: '5-1003', debit: 20000, credit: 0, memo: 'Beban Operasional Toko' },
      { account_code: '1-1001', debit: 0, credit: 20000, memo: 'Kas Laci Kasir' },
    ],
  });

  const cashAfterExpense = (db.prepare("SELECT balance FROM chart_of_accounts WHERE code = '1-1001'").get() as any).balance;
  assert(cashAfterExpense - initialCashDrawer === 30000, 'Net cash in drawer must be initial + 30.000');

  // --- Test 4: Sales Return (Retur Penjualan) ---
  console.log('\n--- Test 4: Sales Return (Retur Penjualan) & Stock Restoration ---');
  // 1. Ensure a product exists
  let testProd = db.prepare("SELECT * FROM products WHERE is_active = 1 LIMIT 1").get() as any;
  if (!testProd) {
    db.prepare(`
      INSERT INTO products (sku, barcode, name, cost_price, selling_price, stock_quantity)
      VALUES ('SKU-RETUR-01', 'BRC-RETUR-01', 'Minyak Goreng Uji 2L', 25000, 32000, 100)
    `).run();
    testProd = db.prepare("SELECT * FROM products WHERE sku = 'SKU-RETUR-01'").get() as any;
  }

  const initialStock = testProd.stock_quantity;
  const initialCashForReturn = (db.prepare("SELECT balance FROM chart_of_accounts WHERE code = '1-1001'").get() as any).balance;

  // 2. Create simulated order of 3 pcs
  const invNo = `INV/TEST/RETUR-${Date.now()}`;
  const resOrder = db.prepare(`
    INSERT INTO orders (invoice_no, shift_id, cashier_id, total_retail, total_ppob, grand_total, payment_method, cash_tendered, change_amount, status)
    VALUES (?, 1, 1, 96000, 0, 96000, 'CASH', 100000, 4000, 'PAID')
  `).run(invNo);
  const testOrderId = resOrder.lastInsertRowid;

  db.prepare(`
    INSERT INTO order_items (order_id, item_type, product_id, item_name, quantity, cost_price, unit_price, subtotal)
    VALUES (?, 'RETAIL', ?, ?, 3, ?, ?, 96000)
  `).run(testOrderId, testProd.id, testProd.name, testProd.cost_price, testProd.selling_price);

  // Deduct stock for order
  db.prepare('UPDATE products SET stock_quantity = stock_quantity - 3 WHERE id = ?').run(testProd.id);
  const stockAfterSale = (db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(testProd.id) as any).stock_quantity;
  assert(initialStock - stockAfterSale === 3, 'Stock must decrease by 3 after sale');

  // 3. Customer returns 1 pc (Minyak bocor/cacat) with restock = 1
  const returnNo = `RET-${Date.now()}`;
  const refundAmount = testProd.selling_price * 1; // 32.000
  const refundCost = testProd.cost_price * 1;

  db.prepare(`
    INSERT INTO sales_returns (return_no, order_id, invoice_no, total_refund, refund_method, reason, cashier_id, shift_id)
    VALUES (?, ?, ?, ?, 'CASH', 'Kemasan bocor ditukar/refund', 1, 1)
  `).run(returnNo, testOrderId, invNo, refundAmount);

  const resRetId = (db.prepare('SELECT id FROM sales_returns WHERE return_no = ?').get(returnNo) as any).id;
  db.prepare(`
    INSERT INTO sales_return_items (return_id, product_id, item_name, quantity, unit_price, subtotal, cost_price, restock_inventory)
    VALUES (?, ?, ?, 1, ?, ?, ?, 1)
  `).run(resRetId, testProd.id, testProd.name, testProd.selling_price, refundAmount, testProd.cost_price);

  // Restock
  db.prepare('UPDATE products SET stock_quantity = stock_quantity + 1 WHERE id = ?').run(testProd.id);
  const stockAfterReturn = (db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(testProd.id) as any).stock_quantity;
  assert(stockAfterReturn - stockAfterSale === 1, 'Stock must increase by 1 after return');

  // Accounting Journal for Return
  AccountingService.createJournalEntry({
    reference_type: 'RETURN',
    reference_id: returnNo,
    description: `Retur Penjualan ${returnNo}`,
    lines: [
      { account_code: '4-1004', debit: refundAmount, credit: 0, memo: 'Retur Penjualan' },
      { account_code: '1-1001', debit: 0, credit: refundAmount, memo: 'Kas Laci Kasir' },
      { account_code: '1-1005', debit: refundCost, credit: 0, memo: 'Pengembalian Persediaan' },
      { account_code: '5-1001', debit: 0, credit: refundCost, memo: 'Pembalikan HPP' },
    ],
  });

  const trialBalanceAfterReturn = AccountingService.getTrialBalance();
  assert(trialBalanceAfterReturn.isBalanced === true, 'Trial balance must remain 100% balanced after sales return');

  // 4. Test Return Thermal Receipt formatting
  const returnReceipt = ThermalPrinterService.formatReturnReceiptText({
    return_no: returnNo,
    invoice_no: invNo,
    created_at: new Date().toISOString(),
    cashier_name: 'Kasir Uji',
    reason: 'Kemasan bocor',
    refund_method: 'CASH',
    total_refund: refundAmount,
    items: [
      {
        item_name: testProd.name,
        quantity: 1,
        unit_price: testProd.selling_price,
        subtotal: refundAmount,
      },
    ],
  });

  assert(returnReceipt.includes('NOTA RETUR PENJUALAN'), 'Return receipt must contain official header');
  assert(returnReceipt.includes(returnNo), 'Return receipt must contain return number');
  assert(returnReceipt.includes(invNo), 'Return receipt must contain invoice reference');
  console.log('\nContoh Struk Retur Penjualan:');
  console.log(returnReceipt);

  console.log('\n================================================================');
  console.log('🎉 ALL RETUR, OPERATIONAL, DEPOSIT & OPERATOR TESTS PASSED 100%!');
  console.log('================================================================\n');
}

runReturAndOperationalTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
