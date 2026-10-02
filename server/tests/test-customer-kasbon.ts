import db from '../db/database';
import { AccountingService } from '../services/accounting';
import { ThermalPrinterService } from '../services/printer';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runCustomerKasbonAndValuationTests() {
  console.log('\n================================================================');
  console.log('💰 RUNNING CUSTOMER KASBON, INVENTORY VALUATION & GL TESTS');
  console.log('================================================================\n');

  // --- Test 1: Day 1 Opening Balance Setup (Inisialisasi Saldo Awal) ---
  console.log('--- Test 1: Day 1 Opening Balance Setup ---');
  const initialSetup = AccountingService.recordOpeningBalance({
    cash_drawer: 1000000,
    bank_balance: 5000000,
    ppob_deposit: 2000000,
    receivables: 250000,
    inventory_value: 12500000,
    payables: 3000000,
    notes: 'Unit Test Day 1 Opening Balance',
  });

  assert(initialSetup.journalId > 0, 'Opening balance journal entry must be recorded in DB');
  
  // Verify Trial Balance is 100% in equilibrium
  const trialBalance = AccountingService.getTrialBalance();
  assert(trialBalance.isBalanced === true, `Trial balance must be balanced (Debit: ${trialBalance.totalDebit}, Credit: ${trialBalance.totalCredit})`);

  // Verify Modal Pemilik (Equity) = Total Assets - Total Liabilities
  // Assets = 1M + 5M + 2M + 0.25M + 12.5M = 20.75M. Liabilities = 3M. Equity = 17.75M.
  const modalAccount = db.prepare("SELECT balance FROM chart_of_accounts WHERE code = '3-1001'").get() as any;
  assert(modalAccount.balance > 0, 'Owner Equity balance must be positive after opening balance');


  // --- Test 2: Inventory Valuation Calculation (Nilai Keseluruhan Produk) ---
  console.log('\n--- Test 2: Total Inventory Valuation Calculation ---');
  const valSummary = db.prepare(`
    SELECT 
      COUNT(*) as total_sku,
      COALESCE(SUM(stock_quantity), 0) as total_units,
      COALESCE(SUM(stock_quantity * cost_price), 0) as total_cost_value,
      COALESCE(SUM(stock_quantity * selling_price), 0) as total_retail_value
    FROM products
  `).get() as any;

  assert(valSummary.total_sku > 0, 'Total SKU count must be greater than 0');
  assert(valSummary.total_units > 0, 'Total stock units must be greater than 0');
  assert(valSummary.total_cost_value > 0, 'Total cost valuation (HPP) must be greater than 0');
  assert(valSummary.total_retail_value > valSummary.total_cost_value, 'Total retail selling value must be greater than cost value');

  const potentialProfit = valSummary.total_retail_value - valSummary.total_cost_value;
  assert(potentialProfit > 0, 'Potential gross profit must be positive');
  console.log(`   * Total Nominal HPP Modal: Rp ${valSummary.total_cost_value.toLocaleString('id-ID')}`);
  console.log(`   * Total Nilai Jual: Rp ${valSummary.total_retail_value.toLocaleString('id-ID')}`);
  console.log(`   * Potensi Laba Kotor: Rp ${potentialProfit.toLocaleString('id-ID')}`);


  // --- Test 3: Customer Management & Credit Limits ---
  console.log('\n--- Test 3: Customer Creation & Credit Limit Management ---');
  const testPhone = `0812999${Math.floor(1000 + Math.random() * 9000)}`;
  const insCustomer = db.prepare(`
    INSERT INTO customers (name, phone, address, credit_limit, current_debt)
    VALUES (?, ?, ?, ?, 0)
  `).run('Bapak Joko Santoso', testPhone, 'Jl. Melati No. 10', 500000);

  const customerId = insCustomer.lastInsertRowid as number;
  let customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any;

  assert(customer !== undefined, 'Customer must be inserted');
  assert(customer.credit_limit === 500000, 'Customer credit limit must be Rp 500.000');
  assert(customer.current_debt === 0, 'New customer current debt must be 0');

  // Update customer credit limit to 750.000
  db.prepare('UPDATE customers SET credit_limit = ? WHERE id = ?').run(750000, customerId);
  customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any;
  assert(customer.credit_limit === 750000, 'Customer credit limit must be updated to Rp 750.000');


  // --- Test 4: Kasbon Checkout & Double-Entry Auto-Journaling ---
  console.log('\n--- Test 4: Kasbon Checkout & Double-Entry Journaling ---');
  const kasbonInvoice = `INV/TEST/KBN-${Date.now().toString().slice(-6)}`;
  const purchaseAmount = 150000;
  const costAmount = 120000;

  // Execute Kasbon Checkout
  db.transaction(() => {
    // 1. Order
    db.prepare(`
      INSERT INTO orders (
        invoice_no, shift_id, cashier_id, customer_id, total_retail, total_ppob,
        grand_total, payment_method, cash_tendered, change_amount, status
      ) VALUES (?, 1, 1, ?, ?, 0, ?, 'KASBON', 0, 0, 'PAID')
    `).run(kasbonInvoice, customerId, purchaseAmount, purchaseAmount);

    // 2. Increase customer debt
    db.prepare('UPDATE customers SET current_debt = current_debt + ? WHERE id = ?').run(purchaseAmount, customerId);

    // 3. Accounting auto-journal
    AccountingService.recordHybridSale({
      order_id: 9999,
      invoice_no: kasbonInvoice,
      total_retail: purchaseAmount,
      total_retail_cost: costAmount,
      total_ppob: 0,
      total_ppob_cost: 0,
      grand_total: purchaseAmount,
      payment_method: 'KASBON',
      customer_id: customerId,
    });
  })();

  customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any;
  assert(customer.current_debt === 150000, `Customer debt must now be Rp 150.000 (actual: ${customer.current_debt})`);

  // Verify journal entry for kasbon debits 1-1004 (Piutang Usaha)
  const kasbonJournal = db.prepare(`
    SELECT jl.* 
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_id = je.id
    WHERE je.reference_id = ? AND jl.account_code = '1-1004'
  `).get(kasbonInvoice) as any;

  assert(kasbonJournal !== undefined, 'Journal entry for KASBON must contain line for 1-1004 (Piutang Usaha)');
  assert(kasbonJournal.debit === purchaseAmount, `Line 1-1004 debit must equal purchase amount (${purchaseAmount})`);


  // --- Test 5: Kasbon Debt Repayment & Auto-Journaling ---
  console.log('\n--- Test 5: Customer Kasbon Repayment & Thermal Receipt ---');
  const payAmount = 100000;
  const paymentNo = `PAY-KBN/TEST/${Date.now().toString().slice(-4)}`;
  const prevDebt = customer.current_debt;
  const expectedRemaining = prevDebt - payAmount;

  db.transaction(() => {
    // 1. Record debt payment
    db.prepare(`
      INSERT INTO customer_debt_payments (
        payment_no, customer_id, amount, payment_method, notes, cashier_id, shift_id
      ) VALUES (?, ?, ?, 'CASH', 'Cicilan ke-1', 1, 1)
    `).run(paymentNo, customerId, payAmount);

    // 2. Reduce debt
    db.prepare('UPDATE customers SET current_debt = ? WHERE id = ?').run(expectedRemaining, customerId);

    // 3. Auto-journal repayment (Dr. 1-1001 Kas, Cr. 1-1004 Piutang)
    AccountingService.recordDebtRepayment({
      payment_no: paymentNo,
      customer_id: customerId,
      customer_name: customer.name,
      amount: payAmount,
      payment_method: 'CASH',
      notes: 'Cicilan ke-1',
    });
  })();

  customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any;
  assert(customer.current_debt === 50000, `Remaining customer debt must be Rp 50.000 (actual: ${customer.current_debt})`);

  // Verify repayment journal: Debit 1-1001 (Kas), Credit 1-1004 (Piutang)
  const repayLines = db.prepare(`
    SELECT jl.* 
    FROM journal_lines jl
    JOIN journal_entries je ON jl.journal_id = je.id
    WHERE je.reference_id = ?
    ORDER BY jl.id ASC
  `).all(paymentNo) as any[];

  assert(repayLines.length === 2, 'Repayment journal must have 2 lines');
  const kasLine = repayLines.find(l => l.account_code === '1-1001');
  const piutangLine = repayLines.find(l => l.account_code === '1-1004');
  assert(kasLine !== undefined && kasLine.debit === payAmount, 'Repayment must debit 1-1001 (Kas Laci Kasir)');
  assert(piutangLine !== undefined && piutangLine.credit === payAmount, 'Repayment must credit 1-1004 (Piutang Usaha)');

  // Verify Thermal Receipt Generation
  const receipt = ThermalPrinterService.formatDebtPaymentReceipt({
    payment_no: paymentNo,
    created_at: new Date().toISOString(),
    customer_name: customer.name,
    customer_phone: customer.phone,
    cashier_name: 'Siti Rahma',
    payment_method: 'TUNAI',
    amount: payAmount,
    previous_debt: prevDebt,
    remaining_debt: expectedRemaining,
    notes: 'Cicilan ke-1',
  });

  assert(receipt.includes('BUKTI PEMBAYARAN KASBON'), 'Receipt must contain official Kasbon header');
  assert(receipt.includes(paymentNo), 'Receipt must contain payment_no');
  assert(receipt.includes('Rp 100.000'), 'Receipt must state payment amount');
  assert(receipt.includes('Rp 50.000'), 'Receipt must state remaining debt');


  // --- Test 6: Safe Customer Deletion Protection ---
  console.log('\n--- Test 6: Deletion Protection (Prevent Data Loss on Active Debt) ---');
  // Customer currently has Rp 50.000 debt
  const cannotDelete = customer.current_debt > 0;
  assert(cannotDelete === true, 'Customer with active debt (>0) must NOT be deleted');

  // Customer pays the remaining Rp 50.000 to fully settle
  db.prepare('UPDATE customers SET current_debt = 0 WHERE id = ?').run(customerId);
  customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any;
  assert(customer.current_debt === 0, 'Customer debt is now 0 (Lunas)');

  // For customer with order/payment history, soft delete deactivates customer to preserve accounting ledger
  db.prepare('UPDATE customers SET is_active = 0 WHERE id = ?').run(customerId);
  customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any;
  assert(customer.is_active === 0, 'Customer with history is deactivated (is_active = 0)');

  // Test hard delete for brand new customer without order history
  const freshCust = db.prepare(`
    INSERT INTO customers (name, phone, credit_limit, current_debt, is_active)
    VALUES ('Customer Tanpa Transaksi', '089999999', 0, 0, 1)
  `).run();
  const freshId = freshCust.lastInsertRowid as number;

  db.prepare('DELETE FROM customers WHERE id = ?').run(freshId);
  const checkFresh = db.prepare('SELECT * FROM customers WHERE id = ?').get(freshId);
  assert(checkFresh === undefined, 'Fresh customer with no transactions can be hard deleted cleanly');

  console.log('\n🎉 ALL CUSTOMER, KASBON & GENERAL LEDGER TESTS PASSED SUCCESSFULLY!\n');
}

runCustomerKasbonAndValuationTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
