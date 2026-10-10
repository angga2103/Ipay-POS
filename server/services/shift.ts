import db from '../db/database';
import { AccountingService } from './accounting';

export class ShiftService {
  /**
   * Get active open shift
   */
  static getActiveShift(cashierId?: number) {
    let query = "SELECT s.*, u.name as cashier_name FROM shifts s JOIN users u ON s.cashier_id = u.id WHERE s.status = 'OPEN'";
    const params: any[] = [];

    if (cashierId) {
      query += ' AND s.cashier_id = ?';
      params.push(cashierId);
    }

    query += ' ORDER BY s.id DESC LIMIT 1';
    return db.prepare(query).get(...params) as any;
  }

  /**
   * Open new cashier shift
   */
  static openShift(cashierId: number, openingCash: number) {
    const existing = this.getActiveShift(cashierId);
    if (existing) {
      throw new Error(`Kasir ini sudah memiliki shift aktif (${existing.shift_number})`);
    }

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countToday = (db.prepare("SELECT COUNT(*) as c FROM shifts WHERE shift_number LIKE ?").get(`SFT-${todayStr}-%`) as any).c;
    const shiftNumber = `SFT-${todayStr}-${String(countToday + 1).padStart(2, '0')}`;

    const res = db.prepare(`
      INSERT INTO shifts (shift_number, cashier_id, opening_cash, expected_cash, status)
      VALUES (?, ?, ?, ?, 'OPEN')
    `).run(shiftNumber, cashierId, openingCash, openingCash);

    return {
      id: res.lastInsertRowid,
      shift_number: shiftNumber,
      opening_cash: openingCash,
      expected_cash: openingCash,
      status: 'OPEN',
    };
  }

  /**
   * Add Cash In / Cash Out drawer movement (F10)
   */
  static addCashLog(params: {
    shiftId: number;
    cashierId: number;
    type: 'CASH_IN' | 'CASH_OUT';
    amount: number;
    reason: string;
  }) {
    const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(params.shiftId) as any;
    if (!shift || shift.status !== 'OPEN') {
      throw new Error('Shift tidak aktif');
    }

    const res = db.prepare(`
      INSERT INTO shift_cash_logs (shift_id, cashier_id, type, amount, reason)
      VALUES (?, ?, ?, ?, ?)
    `).run(params.shiftId, params.cashierId, params.type, params.amount, params.reason);

    // Update shift totals
    if (params.type === 'CASH_IN') {
      db.prepare(`
        UPDATE shifts 
        SET total_cash_in = total_cash_in + ?, expected_cash = expected_cash + ?
        WHERE id = ?
      `).run(params.amount, params.amount, params.shiftId);
    } else {
      db.prepare(`
        UPDATE shifts 
        SET total_cash_out = total_cash_out + ?, expected_cash = expected_cash - ?
        WHERE id = ?
      `).run(params.amount, params.amount, params.shiftId);
    }

    // Auto-journaling cash movement
    AccountingService.recordCashMovement({
      type: params.type,
      amount: params.amount,
      reason: params.reason,
      shiftNumber: shift.shift_number,
    });

    return { id: res.lastInsertRowid, success: true };
  }

  /**
   * Calculate interim statistics for X-Report (ongoing shift)
   */
  static getXReport(shiftId: number) {
    const shift = db.prepare(`
      SELECT s.*, u.name as cashier_name 
      FROM shifts s 
      JOIN users u ON s.cashier_id = u.id 
      WHERE s.id = ?
    `).get(shiftId) as any;

    if (!shift) throw new Error('Shift tidak ditemukan');

    // Summarize paid orders in this shift
    const ordersSummary = db.prepare(`
      SELECT 
        COUNT(id) as total_transactions,
        COALESCE(SUM(total_retail), 0) as retail_sales,
        COALESCE(SUM(total_ppob), 0) as ppob_sales,
        COALESCE(SUM(grand_total), 0) as total_sales,
        COALESCE(SUM(CASE 
          WHEN payment_method = 'CASH' THEN grand_total 
          WHEN payment_method = 'SPLIT' THEN COALESCE(CAST(json_extract(split_details, '$.cash') AS REAL), 0)
          ELSE 0 
        END), 0) as cash_sales,
        COALESCE(SUM(CASE 
          WHEN payment_method = 'QRIS' THEN grand_total 
          WHEN payment_method = 'SPLIT' THEN COALESCE(CAST(json_extract(split_details, '$.qris') AS REAL), 0)
          ELSE 0 
        END), 0) as qris_sales,
        COALESCE(SUM(CASE 
          WHEN payment_method = 'EDC' THEN grand_total 
          WHEN payment_method = 'SPLIT' THEN COALESCE(CAST(json_extract(split_details, '$.edc') AS REAL), 0)
          ELSE 0 
        END), 0) as edc_sales,
        COALESCE(SUM(CASE 
          WHEN payment_method = 'KASBON' THEN grand_total 
          WHEN payment_method = 'SPLIT' THEN COALESCE(CAST(json_extract(split_details, '$.kasbon') AS REAL), 0)
          ELSE 0 
        END), 0) as kasbon_sales
      FROM orders
      WHERE shift_id = ? AND status = 'PAID'
    `).get(shiftId) as any;

    const cashLogs = db.prepare(`
      SELECT * FROM shift_cash_logs WHERE shift_id = ? ORDER BY id ASC
    `).all(shiftId);

    // Ringkasan pembatalan (VOID) dalam shift ini
    const voidSummary = db.prepare(`
      SELECT 
        COUNT(id) as void_count,
        COALESCE(SUM(grand_total), 0) as void_total
      FROM orders
      WHERE shift_id = ? AND status = 'VOID'
    `).get(shiftId) as any;

    // Ringkasan retur penjualan dalam shift ini
    const returnSummary = db.prepare(`
      SELECT 
        COUNT(id) as return_count,
        COALESCE(SUM(total_refund), 0) as return_total,
        COALESCE(SUM(CASE WHEN refund_method = 'CASH' THEN total_refund ELSE 0 END), 0) as cash_refund_total
      FROM sales_returns
      WHERE shift_id = ?
    `).get(shiftId) as any;

    const expectedCashInDrawer = shift.opening_cash + ordersSummary.cash_sales + shift.total_cash_in - shift.total_cash_out;

    return {
      reportType: 'X-REPORT',
      shift,
      ordersSummary,
      voidSummary,
      returnSummary,
      cashLogs,
      expectedCashInDrawer,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Close Shift & Generate Final Z-Report
   */
  static closeShift(shiftId: number, actualCash: number, notes?: string) {
    const xReport = this.getXReport(shiftId);
    const expectedCash = xReport.expectedCashInDrawer;
    const discrepancy = actualCash - expectedCash; // Positive = Over, Negative = Short

    // If there is cash discrepancy, create accounting adjustment
    if (Math.abs(discrepancy) > 0.01) {
      if (discrepancy > 0) {
        // Selisih Lebih: Kas Laci Kasir [DEBIT], Pendapatan Lain-lain [CREDIT]
        AccountingService.createJournalEntry({
          reference_type: 'SHIFT_ADJUSTMENT',
          reference_id: xReport.shift.shift_number,
          description: `Penyesuaian Selisih Kas Lebih Shift ${xReport.shift.shift_number}`,
          lines: [
            { account_code: '1-1001', debit: discrepancy, credit: 0, memo: 'Selisih kas lebih saat tutup kasir' },
            { account_code: '4-1003', debit: 0, credit: discrepancy, memo: 'Pendapatan selisih lebih kas' },
          ],
        });
      } else {
        // Selisih Kurang: Beban Selisih Kas [DEBIT], Kas Laci Kasir [CREDIT]
        const shortAmount = Math.abs(discrepancy);
        AccountingService.createJournalEntry({
          reference_type: 'SHIFT_ADJUSTMENT',
          reference_id: xReport.shift.shift_number,
          description: `Penyesuaian Selisih Kas Kurang Shift ${xReport.shift.shift_number}`,
          lines: [
            { account_code: '5-1003', debit: shortAmount, credit: 0, memo: 'Beban selisih kas kurang laci kasir' },
            { account_code: '1-1001', debit: 0, credit: shortAmount, memo: 'Pengurangan kas laci kasir' },
          ],
        });
      }
    }

    // Update shift record to CLOSED
    db.prepare(`
      UPDATE shifts
      SET status = 'CLOSED',
          closed_at = CURRENT_TIMESTAMP,
          closing_cash_actual = ?,
          expected_cash = ?,
          discrepancy = ?,
          total_retail_sales = ?,
          total_ppob_sales = ?,
          notes = ?
      WHERE id = ?
    `).run(
      actualCash,
      expectedCash,
      discrepancy,
      xReport.ordersSummary.retail_sales,
      xReport.ordersSummary.ppob_sales,
      notes || '',
      shiftId
    );

    return {
      reportType: 'Z-REPORT',
      shiftNumber: xReport.shift.shift_number,
      cashierName: xReport.shift.cashier_name,
      openedAt: xReport.shift.opened_at,
      closedAt: new Date().toISOString(),
      openingCash: xReport.shift.opening_cash,
      retailSales: xReport.ordersSummary.retail_sales,
      ppobSales: xReport.ordersSummary.ppob_sales,
      totalSales: xReport.ordersSummary.total_sales,
      cashSales: xReport.ordersSummary.cash_sales,
      nonCashSales: xReport.ordersSummary.total_sales - xReport.ordersSummary.cash_sales,
      cashIn: xReport.shift.total_cash_in,
      cashOut: xReport.shift.total_cash_out,
      expectedCash,
      actualCash,
      discrepancy,
      status: 'CLOSED',
      notes,
    };
  }
}
