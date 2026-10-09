import db from '../db/database';
import { AccountingService } from './accounting';

export interface CreateServiceInput {
  customer_name: string;
  customer_phone: string;
  device_brand_model: string;
  imei_sn?: string;
  passcode?: string;
  issue_description: string;
  completeness?: string;
  estimated_cost: number;
  down_payment?: number;
  technician_name?: string;
  technician_notes?: string;
}

export class ServiceDeskService {
  /**
   * Get all service orders with optional status filter
   */
  static getAll(status?: string) {
    let query = 'SELECT * FROM service_orders';
    const params: any[] = [];

    if (status && status !== 'ALL') {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY id DESC';
    return db.prepare(query).all(...params);
  }

  /**
   * Get single service order by ID or Service No
   */
  static getById(idOrNo: string | number) {
    if (typeof idOrNo === 'number' || !isNaN(Number(idOrNo))) {
      return db.prepare('SELECT * FROM service_orders WHERE id = ?').get(Number(idOrNo)) as any;
    }
    return db.prepare('SELECT * FROM service_orders WHERE service_no = ?').get(idOrNo) as any;
  }

  /**
   * Create new device service order
   */
  static create(input: CreateServiceInput) {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countToday = (db.prepare("SELECT COUNT(*) as c FROM service_orders WHERE service_no LIKE ?").get(`SRV-${todayStr}-%`) as any).c;
    const serviceNo = `SRV-${todayStr}-${String(countToday + 1).padStart(3, '0')}`;

    const dp = input.down_payment || 0;

    const res = db.prepare(`
      INSERT INTO service_orders (
        service_no, customer_name, customer_phone, device_brand_model, imei_sn,
        passcode, issue_description, completeness, estimated_cost, down_payment,
        final_cost, technician_name, technician_notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
    `).run(
      serviceNo,
      input.customer_name,
      input.customer_phone,
      input.device_brand_model,
      input.imei_sn || null,
      input.passcode || null,
      input.issue_description,
      input.completeness || 'Unit HP batangan',
      input.estimated_cost,
      dp,
      input.estimated_cost, // initial final_cost defaults to estimated_cost
      input.technician_name || null,
      input.technician_notes || null
    );

    const serviceId = res.lastInsertRowid;

    // If down payment is given in cash, record it to cash drawer & revenue
    if (dp > 0) {
      AccountingService.createJournalEntry({
        reference_type: 'SERVICE',
        reference_id: `${serviceNo}-DP`,
        description: `Uang Muka (DP) Servis ${serviceNo} - ${input.customer_name} (${input.device_brand_model})`,
        lines: [
          {
            account_code: '1-1001',
            debit: dp,
            credit: 0,
            memo: `Penerimaan kas DP servis ${serviceNo}`,
          },
          {
            account_code: '4-1003',
            debit: 0,
            credit: dp,
            memo: `Pendapatan servis HP (DP) ${serviceNo}`,
          },
        ],
      });

      const activeShift = db.prepare("SELECT id, cashier_id, status FROM shifts WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1").get() as any;
      if (activeShift) {
        db.prepare(`
          INSERT INTO shift_cash_logs (shift_id, cashier_id, type, amount, reason)
          VALUES (?, ?, 'CASH_IN', ?, ?)
        `).run(activeShift.id, activeShift.cashier_id || 1, dp, `DP Servis ${serviceNo}`);

        db.prepare(`
          UPDATE shifts 
          SET total_cash_in = total_cash_in + ?, expected_cash = expected_cash + ?
          WHERE id = ?
        `).run(dp, dp, activeShift.id);
      }
    }

    return this.getById(Number(serviceId));
  }

  /**
   * Update technician progress & status
   */
  static updateStatus(id: number, status: string, technicianNotes?: string, finalCost?: number, technicianName?: string) {
    const existing = db.prepare('SELECT * FROM service_orders WHERE id = ?').get(id) as any;
    if (!existing) throw new Error('Order servis tidak ditemukan');

    const cost = finalCost !== undefined ? finalCost : existing.final_cost;
    const notes = technicianNotes !== undefined ? technicianNotes : existing.technician_notes;
    const tech = technicianName !== undefined ? technicianName : existing.technician_name;
    const completedAt = status === 'COMPLETED' ? new Date().toISOString() : existing.completed_at;

    db.prepare(`
      UPDATE service_orders
      SET status = ?, technician_notes = ?, final_cost = ?, technician_name = ?, completed_at = ?
      WHERE id = ?
    `).run(status, notes, cost, tech, completedAt, id);

    return this.getById(id);
  }

  /**
   * Settle and pickup device (Pelunasan sisa biaya servis & serah terima unit)
   */
  static pickupAndSettle(params: {
    id: number;
    payment_method: 'CASH' | 'QRIS' | 'EDC';
    cash_tendered?: number;
    notes?: string;
  }) {
    const service = db.prepare('SELECT * FROM service_orders WHERE id = ?').get(params.id) as any;
    if (!service) throw new Error('Order servis tidak ditemukan');
    if (service.status === 'PICKED_UP') throw new Error('Unit sudah diambil sebelumnya');

    const remainingToPay = Math.max(0, service.final_cost - service.down_payment);
    const tendered = params.cash_tendered || remainingToPay;
    const change = Math.max(0, tendered - remainingToPay);

    const tx = db.transaction(() => {
      // 1. Update service order status to PICKED_UP
      db.prepare(`
        UPDATE service_orders
        SET status = 'PICKED_UP', picked_up_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(params.id);

      // 2. Record accounting entry for remaining payment as Service Revenue (4-1003 / 4-1001)
      if (remainingToPay > 0) {
        AccountingService.createJournalEntry({
          reference_type: 'SALE',
          reference_id: service.service_no,
          description: `Pelunasan Servis HP ${service.service_no} - ${service.customer_name} (${service.device_brand_model})`,
          lines: [
            {
              account_code: params.payment_method === 'CASH' ? '1-1001' : '1-1002',
              debit: remainingToPay,
              credit: 0,
              memo: `Penerimaan ${params.payment_method} pelunasan servis ${service.service_no}`,
            },
            {
              account_code: '4-1003', // Pendapatan Jasa Servis / Lain-lain
              debit: 0,
              credit: remainingToPay,
              memo: `Pendapatan servis HP ${service.device_brand_model}`,
            },
          ],
        });

        // Sync with active shift cash drawer if payment is in CASH
        if (params.payment_method === 'CASH') {
          const activeShift = db.prepare("SELECT id, cashier_id, status FROM shifts WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1").get() as any;
          if (activeShift) {
            db.prepare(`
              INSERT INTO shift_cash_logs (shift_id, cashier_id, type, amount, reason)
              VALUES (?, ?, 'CASH_IN', ?, ?)
            `).run(activeShift.id, activeShift.cashier_id || 1, remainingToPay, `Pelunasan Servis ${service.service_no}`);

            db.prepare(`
              UPDATE shifts 
              SET total_cash_in = total_cash_in + ?, expected_cash = expected_cash + ?
              WHERE id = ?
            `).run(remainingToPay, remainingToPay, activeShift.id);
          }
        }
      }
    });

    tx();

    return {
      service: this.getById(params.id),
      remainingToPay,
      change,
      receiptText: this.formatPickupReceipt(this.getById(params.id), params.payment_method, tendered, change),
    };
  }

  /**
   * Format Thermal Receipt: Tanda Terima Servis (Untuk dibawa pelanggan)
   */
  static formatIntakeReceipt(srv: any, paperWidth: '58mm' | '80mm' = '58mm'): string {
    const width = paperWidth === '80mm' ? 48 : 32;
    const center = (text: string) => {
      if (text.length >= width) return text.slice(0, width);
      const pad = Math.floor((width - text.length) / 2);
      return ' '.repeat(pad) + text;
    };
    const line = '-'.repeat(width);
    const doubleLine = '='.repeat(width);
    const formatRow = (left: string, right: string) => {
      const space = width - left.length - right.length;
      if (space <= 0) return left.slice(0, width - right.length - 1) + ' ' + right;
      return left + ' '.repeat(space) + right;
    };

    const out: string[] = [];
    out.push(center('KONTER HP & SERVICE CENTER'));
    out.push(center('Jl. Ahmad Yani No. 88 (0812-3456-7890)'));
    out.push(doubleLine);
    out.push(center('** TANDA TERIMA SERVIS **'));
    out.push(doubleLine);

    out.push(formatRow('No. Servis', srv.service_no));
    out.push(formatRow('Tanggal', new Date(srv.created_at).toLocaleDateString('id-ID')));
    out.push(formatRow('Pelanggan', srv.customer_name));
    out.push(formatRow('No. HP / WA', srv.customer_phone));
    out.push(line);

    out.push(`Perangkat: ${srv.device_brand_model}`);
    if (srv.imei_sn) out.push(`IMEI/SN: ${srv.imei_sn}`);
    if (srv.passcode) out.push(`Pola/Sandi: ${srv.passcode}`);
    out.push(`Kelengkapan: ${srv.completeness || '-'}`);
    out.push(line);

    out.push('Kerusakan / Keluhan:');
    out.push(`  ${srv.issue_description}`);
    out.push(line);

    out.push(formatRow('Estimasi Biaya', 'Rp ' + srv.estimated_cost.toLocaleString('id-ID')));
    out.push(formatRow('Uang Muka (DP)', 'Rp ' + srv.down_payment.toLocaleString('id-ID')));
    out.push(formatRow('Sisa Estimasi', 'Rp ' + (srv.estimated_cost - srv.down_payment).toLocaleString('id-ID')));
    out.push(doubleLine);

    out.push(center('* SYARAT & KETENTUAN *'));
    out.push('1. Wajib bawa nota ini saat ambil.');
    out.push('2. Garansi servis 7 hari (kerusakan sama).');
    out.push('3. Barang tdk diambil > 30 hari di luar');
    out.push('   tanggung jawab konter.');
    out.push(doubleLine);
    out.push(center('Terima Kasih Atas Kepercayaan Anda!'));

    return out.join('\n');
  }

  /**
   * Format Thermal Receipt: Pelunasan & Serah Terima Servis
   */
  static formatPickupReceipt(srv: any, paymentMethod: string, tendered: number, change: number, paperWidth: '58mm' | '80mm' = '58mm'): string {
    const width = paperWidth === '80mm' ? 48 : 32;
    const center = (text: string) => {
      if (text.length >= width) return text.slice(0, width);
      const pad = Math.floor((width - text.length) / 2);
      return ' '.repeat(pad) + text;
    };
    const line = '-'.repeat(width);
    const doubleLine = '='.repeat(width);
    const formatRow = (left: string, right: string) => {
      const space = width - left.length - right.length;
      if (space <= 0) return left.slice(0, width - right.length - 1) + ' ' + right;
      return left + ' '.repeat(space) + right;
    };

    const out: string[] = [];
    out.push(center('KONTER HP & SERVICE CENTER'));
    out.push(doubleLine);
    out.push(center('NOTA PELUNASAN SERVIS'));
    out.push(doubleLine);

    out.push(formatRow('No. Servis', srv.service_no));
    out.push(formatRow('Pelanggan', srv.customer_name));
    out.push(formatRow('Unit', srv.device_brand_model));
    out.push(line);

    out.push(formatRow('Total Biaya Servis', 'Rp ' + srv.final_cost.toLocaleString('id-ID')));
    out.push(formatRow('Sudah Dibayar (DP)', '-Rp ' + srv.down_payment.toLocaleString('id-ID')));
    out.push(line);

    const sisa = srv.final_cost - srv.down_payment;
    out.push(formatRow('TOTAL PELUNASAN', 'Rp ' + sisa.toLocaleString('id-ID')));
    out.push(formatRow(`Bayar (${paymentMethod})`, 'Rp ' + tendered.toLocaleString('id-ID')));
    if (paymentMethod === 'CASH') {
      out.push(formatRow('Kembalian', 'Rp ' + change.toLocaleString('id-ID')));
    }

    out.push(doubleLine);
    out.push(center('GARANSI SERVIS 7 HARI'));
    out.push(center('Simpan struk ini untuk klaim garansi.'));

    return out.join('\n');
  }
}
