import db from '../db/database';

export interface JournalLineInput {
  account_code: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface CreateJournalEntryInput {
  reference_type: 'SALE' | 'PPOB_PURCHASE' | 'PPOB_REVERSAL' | 'EXPENSE' | 'INCOME' | 'TOPUP' | 'RETURN' | 'SHIFT_ADJUSTMENT' | 'STOCK_ADJUSTMENT' | 'PURCHASE' | 'OPENING_BALANCE' | 'DEBT_PAYMENT' | 'SUPPLIER_PAYMENT' | 'SERVICE' | 'OTHER';
  reference_id: string;
  description: string;
  lines: JournalLineInput[];
}

export interface HybridSaleInput {
  order_id: number;
  invoice_no: string;
  total_retail: number;
  total_retail_cost: number;
  total_ppob: number;
  total_ppob_cost: number;
  grand_total: number;
  discount_amount?: number;
  payment_method: 'CASH' | 'QRIS' | 'EDC' | 'KASBON' | 'SPLIT';
  cash_amount?: number;
  non_cash_amount?: number;
  customer_id?: number;
}

export class AccountingService {
  /**
   * Create atomic journal entry with double-entry balance validation
   */
  static createJournalEntry(input: CreateJournalEntryInput) {
    const totalDebit = input.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const totalCredit = input.lines.reduce((sum, l) => sum + (l.credit || 0), 0);

    // Round to 2 decimals to prevent floating point discrepancies
    const roundedDebit = Math.round(totalDebit * 100) / 100;
    const roundedCredit = Math.round(totalCredit * 100) / 100;

    if (Math.abs(roundedDebit - roundedCredit) > 0.01) {
      throw new Error(`Double-entry unbalanced! Total Debit (${roundedDebit}) != Total Credit (${roundedCredit})`);
    }

    const entryNo = `JRN/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}/${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const transaction = db.transaction(() => {
      // 1. Insert header
      const res = db.prepare(`
        INSERT INTO journal_entries (entry_no, reference_type, reference_id, description, total_debit, total_credit)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(entryNo, input.reference_type, input.reference_id, input.description, roundedDebit, roundedCredit);

      const journalId = res.lastInsertRowid;

      // 2. Insert lines and update account balances
      const insertLine = db.prepare(`
        INSERT INTO journal_lines (journal_id, account_code, debit, credit, memo)
        VALUES (?, ?, ?, ?, ?)
      `);

      const updateAccountBalance = db.prepare(`
        UPDATE chart_of_accounts
        SET balance = CASE 
          WHEN normal_balance = 'DEBIT' THEN balance + ? - ?
          ELSE balance + ? - ?
        END
        WHERE code = ?
      `);

      for (const line of input.lines) {
        if (line.debit > 0 || line.credit > 0) {
          insertLine.run(journalId, line.account_code, line.debit, line.credit, line.memo || input.description);

          // For DEBIT normal: Balance += Debit - Credit
          // For CREDIT normal: Balance += Credit - Debit
          updateAccountBalance.run(line.debit, line.credit, line.credit, line.debit, line.account_code);
        }
      }

      return { journalId, entryNo, totalDebit: roundedDebit, totalCredit: roundedCredit };
    });

    return transaction();
  }

  /**
   * Auto-Journaling for Hybrid Transaction (Retail + PPOB)
   * Exact realization of PRD Section 4 Auto-Journaling specification!
   */
  static recordHybridSale(sale: HybridSaleInput) {
    const lines: JournalLineInput[] = [];

    // 1. Debit Payment Asset:
    // Kas Laci Kasir (1-1001), Kas Bank (1-1002), or Piutang (1-1004)
    if (sale.payment_method === 'CASH') {
      lines.push({
        account_code: '1-1001', // Kas Laci Kasir
        debit: sale.grand_total,
        credit: 0,
        memo: `Penerimaan tunai transaksi ${sale.invoice_no}`,
      });
    } else if (sale.payment_method === 'QRIS' || sale.payment_method === 'EDC') {
      lines.push({
        account_code: '1-1002', // Kas Bank / Rekening
        debit: sale.grand_total,
        credit: 0,
        memo: `Penerimaan ${sale.payment_method} transaksi ${sale.invoice_no}`,
      });
    } else if (sale.payment_method === 'KASBON') {
      lines.push({
        account_code: '1-1004', // Piutang Usaha
        debit: sale.grand_total,
        credit: 0,
        memo: `Piutang kasbon pelanggan transaksi ${sale.invoice_no}`,
      });
    } else if (sale.payment_method === 'SPLIT') {
      const cash = sale.cash_amount || 0;
      const nonCash = sale.non_cash_amount || (sale.grand_total - cash);
      if (cash > 0) {
        lines.push({
          account_code: '1-1001',
          debit: cash,
          credit: 0,
          memo: `Split tunai transaksi ${sale.invoice_no}`,
        });
      }
      if (nonCash > 0) {
        lines.push({
          account_code: '1-1002',
          debit: nonCash,
          credit: 0,
          memo: `Split non-tunai transaksi ${sale.invoice_no}`,
        });
      }
    }

    // 2. Credit Revenues
    if (sale.total_retail > 0) {
      lines.push({
        account_code: '4-1001', // Pendapatan Penjualan Ritel
        debit: 0,
        credit: sale.total_retail,
        memo: `Omzet barang fisik ${sale.invoice_no}`,
      });
    }

    if (sale.total_ppob > 0) {
      lines.push({
        account_code: '4-1002', // Pendapatan Penjualan PPOB
        debit: 0,
        credit: sale.total_ppob,
        memo: `Omzet produk digital PPOB ${sale.invoice_no}`,
      });
    }

    // 2.1 Potongan & Diskon Penjualan (Contra-Revenue, Normal: DEBIT)
    const discount = Math.round((sale.discount_amount || 0) * 100) / 100;
    if (discount > 0) {
      lines.push({
        account_code: '4-1004', // Potongan & Diskon Penjualan
        debit: discount,
        credit: 0,
        memo: `Diskon transaksi ${sale.invoice_no}`,
      });
    }

    // 3. Retail Inventory & Cost of Goods Sold (HPP)
    if (sale.total_retail_cost > 0) {
      lines.push({
        account_code: '5-1001', // HPP Barang Dagangan Ritel
        debit: sale.total_retail_cost,
        credit: 0,
        memo: `Beban pokok penjualan ritel ${sale.invoice_no}`,
      });
      lines.push({
        account_code: '1-1005', // Persediaan Barang Dagangan
        debit: 0,
        credit: sale.total_retail_cost,
        memo: `Pengurangan stok barang ritel ${sale.invoice_no}`,
      });
    }

    // 4. PPOB Deposit Asset & Cost of Goods Sold (HPP)
    if (sale.total_ppob_cost > 0) {
      lines.push({
        account_code: '5-1002', // HPP Produk Digital PPOB
        debit: sale.total_ppob_cost,
        credit: 0,
        memo: `Beban pokok saldo PPOB ${sale.invoice_no}`,
      });
      lines.push({
        account_code: '1-1003', // Deposit Saldo PPOB (ipay.my.id)
        debit: 0,
        credit: sale.total_ppob_cost,
        memo: `Pengurangan saldo deposit ipay.my.id ${sale.invoice_no}`,
      });
    }

    return this.createJournalEntry({
      reference_type: 'SALE',
      reference_id: sale.invoice_no,
      description: `Penjualan kasir terpadu ${sale.invoice_no} (${sale.payment_method})`,
      lines,
    });
  }

  /**
   * Auto-Reversal Journal Entry when a PPOB transaction fails or is refunded
   */
  static recordPPOBReversal(params: {
    invoice_no: string;
    product_name: string;
    selling_price: number;
    cost_price: number;
    refund_method?: 'CASH' | 'DEPOSIT_CREDIT' | 'KASBON_REDUCTION' | 'BANK_TRANSFER';
    refund_account?: string;
    customer_id?: number;
  }) {
    const refundAcc = params.refund_account || (
      params.refund_method === 'KASBON_REDUCTION' ? '1-1004' :
      params.refund_method === 'BANK_TRANSFER' ? '1-1002' : '1-1001'
    );

    const lines: JournalLineInput[] = [
      // 1. Restore Deposit PPOB (Modal kembali ke saldo)
      {
        account_code: '1-1003', // Deposit Saldo PPOB
        debit: params.cost_price,
        credit: 0,
        memo: `Pengembalian modal saldo ipay.my.id [${params.product_name}]`,
      },
      // 2. Reverse PPOB COGS
      {
        account_code: '5-1002', // HPP Produk Digital PPOB
        debit: 0,
        credit: params.cost_price,
        memo: `Pembalikan HPP PPOB [${params.product_name}]`,
      },
      // 3. Reverse PPOB Revenue
      {
        account_code: '4-1002', // Pendapatan Penjualan PPOB
        debit: params.selling_price,
        credit: 0,
        memo: `Pembalikan omzet PPOB gagal [${params.product_name}]`,
      },
      // 4. Return money to customer from cash drawer / reduce kasbon / bank
      {
        account_code: refundAcc,
        debit: 0,
        credit: params.selling_price,
        memo: refundAcc === '1-1004'
          ? `Pemotongan piutang kasbon pelanggan [${params.product_name}]`
          : `Pengembalian dana (refund) pelanggan [${params.product_name}]`,
      },
    ];

    // If KASBON reduction, also reduce customer's debt in customers table
    if (refundAcc === '1-1004' && params.customer_id) {
      try {
        db.prepare('UPDATE customers SET current_debt = MAX(0, current_debt - ?) WHERE id = ?')
          .run(params.selling_price, params.customer_id);
      } catch (e) {
        console.warn('Could not update customer debt on PPOB reversal:', e);
      }
    }

    // If CASH refund and active shift open, sync with cash drawer
    if (refundAcc === '1-1001') {
      try {
        const activeShift = db.prepare("SELECT id, cashier_id, status FROM shifts WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1").get() as any;
        if (activeShift) {
          db.prepare(`
            INSERT INTO shift_cash_logs (shift_id, cashier_id, type, amount, reason)
            VALUES (?, ?, 'CASH_OUT', ?, ?)
          `).run(
            activeShift.id,
            activeShift.cashier_id || 1,
            params.selling_price,
            `Refund PPOB gagal: ${params.product_name} (${params.invoice_no})`
          );
          db.prepare(`
            UPDATE shifts 
            SET total_cash_out = total_cash_out + ?,
                expected_cash = expected_cash - ?
            WHERE id = ?
          `).run(params.selling_price, params.selling_price, activeShift.id);
        }
      } catch (e) {
        console.warn('Could not sync shift cash drawer on PPOB reversal:', e);
      }
    }

    return this.createJournalEntry({
      reference_type: 'PPOB_REVERSAL',
      reference_id: params.invoice_no,
      description: `Jurnal Pembalik (Reversal) Transaksi PPOB Gagal ${params.invoice_no}`,
      lines,
    });
  }

  /**
   * Record Cash In / Cash Out drawer movements (F10)
   */
  static recordCashMovement(params: {
    type: 'CASH_IN' | 'CASH_OUT';
    amount: number;
    reason: string;
    shiftNumber: string;
  }) {
    const lines: JournalLineInput[] = [];

    if (params.type === 'CASH_IN') {
      lines.push(
        { account_code: '1-1001', debit: params.amount, credit: 0, memo: `Kas Masuk: ${params.reason}` },
        { account_code: '3-1001', debit: 0, credit: params.amount, memo: `Setoran kas tambahan shift ${params.shiftNumber}` }
      );
    } else {
      lines.push(
        { account_code: '5-1003', debit: params.amount, credit: 0, memo: `Kas Keluar: ${params.reason}` },
        { account_code: '1-1001', debit: 0, credit: params.amount, memo: `Pengeluaran kas shift ${params.shiftNumber}` }
      );
    }

    return this.createJournalEntry({
      reference_type: 'SHIFT_ADJUSTMENT',
      reference_id: params.shiftNumber,
      description: `${params.type === 'CASH_IN' ? 'Kas Masuk (Cash In)' : 'Kas Keluar (Cash Out)'}: ${params.reason}`,
      lines,
    });
  }

  /**
   * Record Customer Debt Repayment (Pelunasan / Cicilan Kasbon Pelanggan)
   * Dr. Kas Laci (1-1001) / Kas Bank (1-1002)
   * Cr. Piutang Usaha / Kasbon (1-1004)
   */
  static recordDebtRepayment(params: {
    payment_no: string;
    customer_id: number;
    customer_name: string;
    amount: number;
    payment_method: 'CASH' | 'BANK_TRANSFER' | 'QRIS';
    notes?: string;
  }) {
    const assetAccount = params.payment_method === 'CASH' ? '1-1001' : '1-1002';
    const lines: JournalLineInput[] = [
      {
        account_code: assetAccount,
        debit: params.amount,
        credit: 0,
        memo: `Penerimaan bayar kasbon ${params.customer_name} (${params.payment_no})`,
      },
      {
        account_code: '1-1004', // Piutang Usaha
        debit: 0,
        credit: params.amount,
        memo: `Pengurangan piutang kasbon ${params.customer_name}`,
      },
    ];

    return this.createJournalEntry({
      reference_type: 'DEBT_PAYMENT',
      reference_id: params.payment_no,
      description: `Pelunasan kasbon ${params.customer_name} [${params.payment_no}]`,
      lines,
    });
  }

  /**
   * Record Opening Balance (Inisialisasi Saldo Awal Neraca - Pemakaian Pertama)
   * Dr. Kas Laci Kasir (1-1001)
   * Dr. Kas Bank / Rekening (1-1002)
   * Dr. Deposit Saldo PPOB (1-1003)
   * Dr. Piutang Kasbon Awal (1-1004)
   * Dr. Persediaan Barang Dagangan Awal (1-1005)
   * Cr. Hutang Usaha / Supplier Awal (2-1001)
   * Cr. Modal Pemilik Awal (3-1001) [Seimbang otomatis: Total Aset - Total Hutang]
   */
  static recordOpeningBalance(params: {
    cash_drawer: number;
    bank_balance: number;
    ppob_deposit: number;
    receivables: number;
    inventory_value: number;
    payables: number;
    supplier_debts?: Array<{ supplier_id: number; amount: number }>;
    customer_debts?: Array<{ customer_id: number; amount: number }>;
    notes?: string;
  }) {
    // 1. Idempotency & Clean Re-sync:
    // If an OPENING_BALANCE journal entry already exists, reverse old balances first
    const existingOpenings = db.prepare("SELECT id FROM journal_entries WHERE reference_type = 'OPENING_BALANCE'").all() as any[];
    for (const old of existingOpenings) {
      const oldLines = db.prepare("SELECT * FROM journal_lines WHERE journal_id = ?").all(old.id) as any[];
      for (const line of oldLines) {
        db.prepare(`
          UPDATE chart_of_accounts
          SET balance = CASE 
            WHEN normal_balance = 'DEBIT' THEN balance - ? + ?
            ELSE balance - ? + ?
          END
          WHERE code = ?
        `).run(line.debit, line.credit, line.credit, line.debit, line.account_code);
      }
      db.prepare("DELETE FROM journal_entries WHERE id = ?").run(old.id);
    }

    // 2. Synchronize supplier auxiliary ledger if specific debts provided
    let totalPayables = params.payables || 0;
    if (params.supplier_debts && Array.isArray(params.supplier_debts) && params.supplier_debts.length > 0) {
      let sumSup = 0;
      for (const item of params.supplier_debts) {
        const debt = Math.max(0, item.amount || 0);
        db.prepare("UPDATE suppliers SET current_debt = ? WHERE id = ?").run(debt, item.supplier_id);
        sumSup += debt;
      }
      if (!totalPayables || totalPayables === 0) {
        totalPayables = sumSup;
      }
    }

    // 3. Synchronize customer auxiliary ledger if specific debts provided
    let totalReceivables = params.receivables || 0;
    if (params.customer_debts && Array.isArray(params.customer_debts) && params.customer_debts.length > 0) {
      let sumCust = 0;
      for (const item of params.customer_debts) {
        const debt = Math.max(0, item.amount || 0);
        db.prepare("UPDATE customers SET current_debt = ? WHERE id = ?").run(debt, item.customer_id);
        sumCust += debt;
      }
      if (!totalReceivables || totalReceivables === 0) {
        totalReceivables = sumCust;
      }
    }

    const totalAssets = 
      (params.cash_drawer || 0) + 
      (params.bank_balance || 0) + 
      (params.ppob_deposit || 0) + 
      totalReceivables + 
      (params.inventory_value || 0);

    const totalLiabilities = totalPayables;
    const ownerEquity = Math.round((totalAssets - totalLiabilities) * 100) / 100;

    const lines: JournalLineInput[] = [];

    if (params.cash_drawer > 0) {
      lines.push({ account_code: '1-1001', debit: params.cash_drawer, credit: 0, memo: 'Saldo awal kas laci toko' });
    }
    if (params.bank_balance > 0) {
      lines.push({ account_code: '1-1002', debit: params.bank_balance, credit: 0, memo: 'Saldo awal kas rekening bank' });
    }
    if (params.ppob_deposit > 0) {
      lines.push({ account_code: '1-1003', debit: params.ppob_deposit, credit: 0, memo: 'Saldo awal deposit PPOB ipay.my.id' });
    }
    if (totalReceivables > 0) {
      lines.push({ account_code: '1-1004', debit: totalReceivables, credit: 0, memo: 'Saldo awal piutang pelanggan' });
    }
    if (params.inventory_value > 0) {
      lines.push({ account_code: '1-1005', debit: params.inventory_value, credit: 0, memo: 'Saldo awal persediaan barang dagangan' });
    }
    if (totalLiabilities > 0) {
      lines.push({ account_code: '2-1001', debit: 0, credit: totalLiabilities, memo: 'Saldo awal hutang usaha supplier' });
    }
    if (ownerEquity > 0) {
      lines.push({ account_code: '3-1001', debit: 0, credit: ownerEquity, memo: 'Modal disetor pemilik (Equity awal)' });
    } else if (ownerEquity < 0) {
      lines.push({ account_code: '3-1001', debit: Math.abs(ownerEquity), credit: 0, memo: 'Defisit ekuitas awal pemilik' });
    }

    const entryNo = `JRN-INIT-${Date.now().toString().slice(-6)}`;

    return this.createJournalEntry({
      reference_type: 'OPENING_BALANCE',
      reference_id: entryNo,
      description: params.notes || 'Inisialisasi Saldo Awal Neraca (Day-1 Setup POS IPAY)',
      lines,
    });
  }

  /**
   * Record Supplier Debt Payment (Pelunasan Hutang Supplier)
   * Dr. Hutang Usaha (2-1001) - Normal balance CREDIT -> Debit decreases liability
   * Cr. Kas Laci (1-1001) / Bank (1-1002) - Normal balance DEBIT -> Credit decreases asset
   */
  static recordSupplierDebtPayment(params: {
    supplier_id: number;
    supplier_name: string;
    amount: number;
    payment_no: string;
    payment_method: 'CASH' | 'BANK_TRANSFER';
    source_account?: '1-1001' | '1-1002';
    notes?: string;
  }) {
    const sourceAcc = params.source_account || (params.payment_method === 'BANK_TRANSFER' ? '1-1002' : '1-1001');
    const sourceMemo = sourceAcc === '1-1002' ? 'Pengeluaran rekening bank' : 'Pengeluaran kas laci kasir';

    return this.createJournalEntry({
      reference_type: 'SUPPLIER_PAYMENT',
      reference_id: params.payment_no,
      description: `Pembayaran hutang supplier ${params.supplier_name}${params.notes ? ` (${params.notes})` : ''}`,
      lines: [
        {
          account_code: '2-1001',
          debit: params.amount,
          credit: 0,
          memo: `Pelunasan hutang supplier ${params.supplier_name}`,
        },
        {
          account_code: sourceAcc,
          debit: 0,
          credit: params.amount,
          memo: `${sourceMemo} untuk pelunasan hutang ${params.supplier_name}`,
        },
      ],
    });
  }

  /**
   * Get Opening Balance & System-Wide Synchronization Status
   */
  static getOpeningBalanceStatus() {
    const openingEntry = db.prepare(`
      SELECT * FROM journal_entries WHERE reference_type = 'OPENING_BALANCE' ORDER BY id DESC LIMIT 1
    `).get() as any;

    let openingLines: any[] = [];
    if (openingEntry) {
      openingLines = db.prepare(`
        SELECT jl.*, coa.name as account_name
        FROM journal_lines jl
        JOIN chart_of_accounts coa ON jl.account_code = coa.code
        WHERE jl.journal_id = ?
        ORDER BY jl.account_code ASC
      `).all(openingEntry.id);
    }

    const getAccount = (code: string) => db.prepare('SELECT balance FROM chart_of_accounts WHERE code = ?').get(code) as any;
    const cashBalance = getAccount('1-1001')?.balance || 0;
    const bankBalance = getAccount('1-1002')?.balance || 0;
    const ppobBalance = getAccount('1-1003')?.balance || 0;
    const receivablesBalance = getAccount('1-1004')?.balance || 0;
    const inventoryBalance = getAccount('1-1005')?.balance || 0;
    const payablesBalance = getAccount('2-1001')?.balance || 0;
    const equityBalance = getAccount('3-1001')?.balance || 0;

    // Auxiliary ledgers
    const totalCustomerDebt = (db.prepare('SELECT COALESCE(SUM(current_debt), 0) as s FROM customers WHERE is_active = 1').get() as any).s;
    const totalSupplierDebt = (db.prepare('SELECT COALESCE(SUM(current_debt), 0) as s FROM suppliers WHERE is_active = 1').get() as any).s;
    const totalInventoryHpp = (db.prepare('SELECT COALESCE(SUM(stock_quantity * cost_price), 0) as s FROM products WHERE is_active = 1').get() as any).s;

    const openingPayablesLine = openingLines.find(l => l.account_code === '2-1001');
    const openingPayables = openingPayablesLine ? openingPayablesLine.credit : 0;

    const openingReceivablesLine = openingLines.find(l => l.account_code === '1-1004');
    const openingReceivables = openingReceivablesLine ? openingReceivablesLine.debit : 0;

    const openingInventoryLine = openingLines.find(l => l.account_code === '1-1005');
    const openingInventory = openingInventoryLine ? openingInventoryLine.debit : 0;

    return {
      is_configured: !!openingEntry,
      entry: openingEntry ? { ...openingEntry, lines: openingLines } : null,
      balances: {
        cash_drawer: cashBalance,
        bank_balance: bankBalance,
        ppob_deposit: ppobBalance,
        receivables: receivablesBalance,
        inventory_value: inventoryBalance,
        payables: payablesBalance,
        owner_equity: equityBalance,
      },
      reconciliation: {
        inventory_matches: Math.abs(inventoryBalance - totalInventoryHpp) < 1 || Math.abs(openingInventory - totalInventoryHpp) < 1,
        inventory_catalog_hpp: totalInventoryHpp,
        receivables_matches: Math.abs(receivablesBalance - totalCustomerDebt) < 1 || Math.abs(openingReceivables - totalCustomerDebt) < 1,
        customer_total_debt: totalCustomerDebt,
        payables_matches: Math.abs(payablesBalance - totalSupplierDebt) < 1 || Math.abs(openingPayables - totalSupplierDebt) < 1,
        supplier_total_debt: totalSupplierDebt,
        is_balanced: this.getTrialBalance().isBalanced,
      },
    };
  }

  /**
   * Generate Combined & Segregated Profit & Loss (Laba Rugi) Report
   */
  static getProfitAndLoss(startDate?: string, endDate?: string) {
    const start = startDate ? `${startDate} 00:00:00` : '1970-01-01 00:00:00';
    const end = endDate ? `${endDate} 23:59:59` : '2099-12-31 23:59:59';

    // Calculate debits and credits for relevant accounts in the time period
    const getAccountSum = (code: string) => {
      const row = db.prepare(`
        SELECT 
          COALESCE(SUM(jl.debit), 0) as total_debit,
          COALESCE(SUM(jl.credit), 0) as total_credit
        FROM journal_lines jl
        JOIN journal_entries je ON jl.journal_id = je.id
        WHERE jl.account_code = ?
          AND je.transaction_date BETWEEN ? AND ?
      `).get(code, start, end) as { total_debit: number; total_credit: number };

      return row;
    };

    // Revenue accounts (Normal Credit): Revenue = Credit - Debit
    const retailRev = getAccountSum('4-1001');
    const grossRetailRevenue = retailRev.total_credit - retailRev.total_debit;

    // Sales Discounts / Contra-Revenue (4-1004, Normal Debit: Debit - Credit)
    const discountSum = getAccountSum('4-1004');
    const salesDiscounts = discountSum.total_debit - discountSum.total_credit;

    // Net retail revenue after sales discounts
    const netRetailRevenue = Math.max(0, grossRetailRevenue - salesDiscounts);

    const ppobRev = getAccountSum('4-1002');
    const ppobRevenue = ppobRev.total_credit - ppobRev.total_debit;

    const otherRev = getAccountSum('4-1003');
    const otherRevenue = otherRev.total_credit - otherRev.total_debit;

    // Expense / COGS accounts (Normal Debit): Expense = Debit - Credit
    const retailCost = getAccountSum('5-1001');
    const retailHpp = retailCost.total_debit - retailCost.total_credit;

    const ppobCost = getAccountSum('5-1002');
    const ppobHpp = ppobCost.total_debit - ppobCost.total_credit;

    // Operating expenses (6-1001 Beban Operasional Toko + 5-1003 Selisih Kas/Penyusutan)
    const opExpense5 = getAccountSum('5-1003');
    const opExpense6 = getAccountSum('6-1001');
    const generalExpenses = opExpense6.total_debit - opExpense6.total_credit;
    const cashDiscrepancyExpense = opExpense5.total_debit - opExpense5.total_credit;
    const operatingExpenses = generalExpenses + cashDiscrepancyExpense;

    // Gross profits
    const retailGrossProfit = netRetailRevenue - retailHpp;
    const ppobGrossProfit = ppobRevenue - ppobHpp;

    const totalOperationalRevenue = netRetailRevenue + ppobRevenue;
    const totalRevenue = totalOperationalRevenue + otherRevenue;
    const totalCOGS = retailHpp + ppobHpp;
    const totalGrossProfit = totalRevenue - totalCOGS;
    const netProfit = totalGrossProfit - operatingExpenses;

    return {
      period: { start, end },
      retail: {
        grossRevenue: grossRetailRevenue,
        discounts: salesDiscounts,
        revenue: netRetailRevenue,
        cogs: retailHpp,
        grossProfit: retailGrossProfit,
        marginPercent: netRetailRevenue > 0 ? (retailGrossProfit / netRetailRevenue) * 100 : 0,
      },
      ppob: {
        revenue: ppobRevenue,
        cogs: ppobHpp,
        grossProfit: ppobGrossProfit,
        marginPercent: ppobRevenue > 0 ? (ppobGrossProfit / ppobRevenue) * 100 : 0,
      },
      discounts: salesDiscounts,
      otherRevenue,
      operatingExpenses,
      generalExpenses,
      cashDiscrepancyExpense,
      combined: {
        totalRevenue,
        totalCOGS,
        totalGrossProfit,
        netProfit,
        marginPercent: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
      },
    };
  }

  /**
   * Get Trial Balance (Neraca Saldo)
   */
  static getTrialBalance() {
    const accounts = db.prepare(`
      SELECT code, name, type, normal_balance, balance
      FROM chart_of_accounts
      ORDER BY code ASC
    `).all() as Array<{
      code: string;
      name: string;
      type: string;
      normal_balance: string;
      balance: number;
    }>;

    let totalDebit = 0;
    let totalCredit = 0;

    const rows = accounts.map(acc => {
      let debit = 0;
      let credit = 0;

      if (acc.normal_balance === 'DEBIT') {
        if (acc.balance >= 0) {
          debit = acc.balance;
        } else {
          credit = Math.abs(acc.balance);
        }
      } else {
        if (acc.balance >= 0) {
          credit = acc.balance;
        } else {
          debit = Math.abs(acc.balance);
        }
      }

      totalDebit += debit;
      totalCredit += credit;

      return {
        ...acc,
        debit,
        credit,
      };
    });

    return {
      accounts: rows,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.05,
    };
  }

  /**
   * Get General Ledger for an account
   */
  static getGeneralLedger(accountCode: string) {
    const account = db.prepare('SELECT * FROM chart_of_accounts WHERE code = ?').get(accountCode) as any;
    if (!account) throw new Error('Account not found');

    const lines = db.prepare(`
      SELECT 
        jl.id,
        je.entry_no,
        je.transaction_date,
        je.reference_type,
        je.reference_id,
        jl.memo,
        jl.debit,
        jl.credit
      FROM journal_lines jl
      JOIN journal_entries je ON jl.journal_id = je.id
      WHERE jl.account_code = ?
      ORDER BY je.transaction_date ASC, jl.id ASC
    `).all(accountCode) as any[];

    let runningBalance = 0;
    const ledgerEntries = lines.map(line => {
      if (account.normal_balance === 'DEBIT') {
        runningBalance += line.debit - line.credit;
      } else {
        runningBalance += line.credit - line.debit;
      }
      return {
        ...line,
        running_balance: runningBalance,
      };
    });

    return {
      account,
      entries: ledgerEntries,
      finalBalance: runningBalance,
    };
  }

  /**
   * Get recent journal entries
   */
  static getRecentJournalEntries(limit = 50) {
    const entries = db.prepare(`
      SELECT * FROM journal_entries ORDER BY id DESC LIMIT ?
    `).all(limit) as any[];

    const getLines = db.prepare(`
      SELECT jl.*, coa.name as account_name
      FROM journal_lines jl
      JOIN chart_of_accounts coa ON jl.account_code = coa.code
      WHERE jl.journal_id = ?
      ORDER BY jl.id ASC
    `);

    return entries.map(entry => ({
      ...entry,
      lines: getLines.all(entry.id),
    }));
  }
}
