import db from '../db/database';

export interface ReceiptData {
  order: {
    invoice_no: string;
    created_at: string;
    payment_method: string;
    total_retail: number;
    total_ppob: number;
    discount_amount: number;
    grand_total: number;
    cash_tendered: number;
    change_amount: number;
    cashier_name?: string;
    shift_number?: string;
    customer_name?: string;
  };
  items: Array<{
    item_type: 'RETAIL' | 'PPOB';
    item_name: string;
    unit_name?: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    ppob_target_no?: string;
    ppob_customer_name?: string;
    ppob_sn_token?: string;
    ppob_status?: string;
    imei_sn?: string;
  }>;
}

export class ThermalPrinterService {
  /**
   * Format receipt text for 58mm (32 chars) or 80mm (48 chars)
   */
  static formatReceiptText(data: ReceiptData, paperWidth: '58mm' | '80mm' = '58mm'): string {
    const width = paperWidth === '80mm' ? 48 : 32;

    const getSetting = (key: string, def = '') => {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
      return row ? row.value : def;
    };

    const storeName = getSetting('store_name', 'MINIMARKET IPAY BERKAH');
    const storeAddress = getSetting('store_address', 'Jl. Ahmad Yani No. 88');
    const storePhone = getSetting('store_phone', '0812-3456-7890');
    const storeFooter = getSetting('store_footer_msg', 'Terima Kasih Telah Berbelanja!');

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

    const formatCurrency = (amount: number) => {
      return 'Rp ' + amount.toLocaleString('id-ID');
    };

    const wrapText = (text: string, maxWidth: number, indent = ''): string[] => {
      if (!text) return [];
      const lines: string[] = [];
      const paragraphs = text.split('\n');

      for (const p of paragraphs) {
        const words = p.split(/\s+/);
        let currentLine = '';

        for (const w of words) {
          if (!w) continue;
          if ((indent + currentLine + (currentLine ? ' ' : '') + w).length <= maxWidth) {
            currentLine += (currentLine ? ' ' : '') + w;
          } else {
            if (currentLine) {
              lines.push(indent + currentLine);
            }
            let remaining = w;
            const available = Math.max(10, maxWidth - indent.length);
            while (remaining.length > available) {
              lines.push(indent + remaining.slice(0, available));
              remaining = remaining.slice(available);
            }
            currentLine = remaining;
          }
        }
        if (currentLine) {
          lines.push(indent + currentLine);
        }
      }
      return lines;
    };

    const out: string[] = [];

    // Header
    out.push(center(storeName.toUpperCase()));
    if (storeAddress) out.push(center(storeAddress));
    if (storePhone) out.push(center(`Telp: ${storePhone}`));
    out.push(doubleLine);

    // Meta
    out.push(formatRow('No. Struk', data.order.invoice_no));
    out.push(formatRow('Waktu', new Date(data.order.created_at).toLocaleString('id-ID')));
    if (data.order.cashier_name) out.push(formatRow('Kasir', data.order.cashier_name));
    if (data.order.shift_number) out.push(formatRow('Shift', data.order.shift_number));
    if (data.order.customer_name) out.push(formatRow('Pelanggan', data.order.customer_name));
    out.push(line);

    // Items
    for (const it of data.items) {
      if (it.item_type === 'RETAIL') {
        const qtyUnit = `${it.quantity} x ${formatCurrency(it.unit_price)}`;
        out.push(...wrapText(it.item_name, width));
        if (it.imei_sn) {
          out.push(`  IMEI/SN: ${it.imei_sn}`);
        }
        out.push(formatRow(`  ${qtyUnit}`, formatCurrency(it.subtotal)));
      } else {
        // PPOB Digital Item
        out.push(...wrapText(`[PPOB] ${it.item_name}`, width));
        if (it.ppob_target_no) {
          out.push(`  No. Tujuan: ${it.ppob_target_no}`);
        }
        if (it.ppob_customer_name) {
          out.push(`  Nama: ${it.ppob_customer_name}`);
        }
        out.push(formatRow(`  Subtotal:`, formatCurrency(it.subtotal)));

        // PLN Token / Serial Number / Kuota prominently featured without clipping
        if (it.ppob_sn_token) {
          out.push(line);
          out.push(center('*** TOKEN / NO. SERI (SN) ***'));
          const snLines = wrapText(it.ppob_sn_token, width, '  ');
          for (const sLine of snLines) {
            out.push(sLine);
          }
          out.push(line);
        } else if (it.ppob_status === 'PENDING') {
          out.push(line);
          out.push(center('>> PROSES PROVIDER (PENDING) <<'));
          out.push(center('Token/SN akan otomatis terupdate'));
          out.push(line);
        }
      }
    }

    out.push(line);

    // Totals
    if (data.order.total_retail > 0 && data.order.total_ppob > 0) {
      out.push(formatRow('Total Ritel', formatCurrency(data.order.total_retail)));
      out.push(formatRow('Total PPOB', formatCurrency(data.order.total_ppob)));
    }

    if (data.order.discount_amount > 0) {
      out.push(formatRow('Diskon', `-${formatCurrency(data.order.discount_amount)}`));
    }

    out.push(formatRow('TOTAL BELANJA', formatCurrency(data.order.grand_total)));
    out.push(formatRow(`Bayar (${data.order.payment_method})`, formatCurrency(data.order.cash_tendered || data.order.grand_total)));

    if (data.order.payment_method === 'CASH') {
      out.push(formatRow('Kembalian', formatCurrency(data.order.change_amount)));
    }

    out.push(doubleLine);

    // Footer
    const footerLines = storeFooter.split('\n');
    for (const fl of footerLines) {
      out.push(center(fl));
    }

    return out.join('\n');
  }

  /**
   * Generate raw ESC/POS command array (including RJ11 drawer kick pulse)
   */
  static generateEscPosCommands(receiptText: string): Uint8Array {
    const ESC = 0x1B;
    const GS = 0x1D;

    const commands: number[] = [
      ESC, 0x40,           // Initialize printer
      ESC, 0x70, 0x00, 25, 250, // Pulse Cash Drawer RJ11 pin 2 (kick drawer)
    ];

    // Encode text as ASCII / UTF-8
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(receiptText + '\n\n\n\n');

    for (let i = 0; i < textBytes.length; i++) {
      commands.push(textBytes[i]);
    }

    // Cut paper: GS V 66 0
    commands.push(GS, 0x56, 0x42, 0x00);

    return new Uint8Array(commands);
  }

  /**
   * Format official thermal receipt for customer kasbon debt repayment
   */
  static formatDebtPaymentReceipt(data: {
    payment_no: string;
    created_at: string;
    customer_name: string;
    customer_phone?: string;
    cashier_name?: string;
    payment_method: string;
    amount: number;
    previous_debt: number;
    remaining_debt: number;
    notes?: string;
  }, paperWidth: '58mm' | '80mm' = '58mm'): string {
    const width = paperWidth === '80mm' ? 48 : 32;

    const getSetting = (key: string, def = '') => {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
      return row ? row.value : def;
    };

    const storeName = getSetting('store_name', 'MINIMARKET IPAY BERKAH');
    const storeAddress = getSetting('store_address', 'Jl. Ahmad Yani No. 88');
    const storePhone = getSetting('store_phone', '0812-3456-7890');

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

    const formatCurrency = (amount: number) => {
      return 'Rp ' + amount.toLocaleString('id-ID');
    };

    const out: string[] = [];

    // Header
    out.push(center(storeName.toUpperCase()));
    if (storeAddress) out.push(center(storeAddress));
    if (storePhone) out.push(center(`Telp: ${storePhone}`));
    out.push(doubleLine);

    out.push(center('*** BUKTI PEMBAYARAN KASBON ***'));
    out.push(line);

    // Metadata
    out.push(formatRow('No. Bukti', data.payment_no));
    out.push(formatRow('Waktu', new Date(data.created_at).toLocaleString('id-ID')));
    if (data.cashier_name) out.push(formatRow('Kasir', data.cashier_name));
    out.push(formatRow('Pelanggan', data.customer_name));
    if (data.customer_phone) out.push(formatRow('No. HP', data.customer_phone));
    out.push(line);

    // Financial breakdown
    out.push(formatRow('Kasbon Awal', formatCurrency(data.previous_debt)));
    out.push(formatRow(`Jml Dibayar (${data.payment_method})`, formatCurrency(data.amount)));
    out.push(line);
    out.push(formatRow('SISA KASBON', formatCurrency(data.remaining_debt)));

    if (data.remaining_debt === 0) {
      out.push(center('>> STATUS: LUNAS <<'));
    }

    if (data.notes) {
      out.push(line);
      out.push(`Catatan: ${data.notes}`);
    }

    out.push(doubleLine);
    out.push(center('Harap simpan struk ini'));
    out.push(center('sebagai bukti pembayaran yang sah.'));
    out.push(center('Terima kasih.'));

    return out.join('\n');
  }

  /**
   * Format Cash Disbursement Voucher (Bukti Pengeluaran Kas) for Supplier Debt Payment
   */
  static formatSupplierPaymentVoucher(data: {
    payment_no: string;
    created_at: string;
    supplier_name: string;
    contact_person?: string;
    phone?: string;
    bank_name?: string;
    bank_account_number?: string;
    previous_debt: number;
    amount: number;
    remaining_debt: number;
    payment_method: 'CASH' | 'BANK_TRANSFER';
    source_account: string;
    notes?: string;
    user_name?: string;
  }, paperWidth: '58mm' | '80mm' = '58mm'): string {
    const width = paperWidth === '80mm' ? 48 : 32;

    const getSetting = (key: string, def = '') => {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
      return row ? row.value : def;
    };

    const storeName = getSetting('store_name', 'MINIMARKET IPAY BERKAH');
    const storeAddress = getSetting('store_address', 'Jl. Ahmad Yani No. 88');
    const storePhone = getSetting('store_phone', '0812-3456-7890');

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

    const formatCurrency = (amount: number) => {
      return 'Rp ' + amount.toLocaleString('id-ID');
    };

    const out: string[] = [];

    // Header
    out.push(center(storeName.toUpperCase()));
    if (storeAddress) out.push(center(storeAddress));
    if (storePhone) out.push(center(`Telp: ${storePhone}`));
    out.push(doubleLine);

    out.push(center('*** BUKTI PENGELUARAN KAS ***'));
    out.push(center('(PEMBAYARAN HUTANG SUPPLIER)'));
    out.push(line);

    // Metadata
    out.push(formatRow('No. Voucher', data.payment_no));
    out.push(formatRow('Tanggal', new Date(data.created_at).toLocaleString('id-ID')));
    if (data.user_name) out.push(formatRow('Oleh (Staff)', data.user_name));
    out.push(formatRow('Supplier', data.supplier_name));
    if (data.contact_person) out.push(formatRow('PIC Sales', data.contact_person));
    if (data.phone) out.push(formatRow('Kontak', data.phone));
    
    const sourceLabel = data.source_account === '1-1002' ? 'Transfer Bank' : 'Kas Laci Kasir';
    out.push(formatRow('Sumber Dana', sourceLabel));
    if (data.bank_name && data.payment_method === 'BANK_TRANSFER') {
      out.push(formatRow('Tujuan Bank', `${data.bank_name} ${data.bank_account_number || ''}`));
    }
    out.push(line);

    // Financial breakdown
    out.push(formatRow('Hutang Awal', formatCurrency(data.previous_debt)));
    out.push(formatRow(`Jml Dibayar (${data.payment_method})`, formatCurrency(data.amount)));
    out.push(line);
    out.push(formatRow('SISA HUTANG', formatCurrency(data.remaining_debt)));

    if (data.remaining_debt === 0) {
      out.push(center('>> STATUS: LUNAS TOTAL <<'));
    }

    if (data.notes) {
      out.push(line);
      out.push(`Faktur/Ket: ${data.notes}`);
    }

    out.push(line);
    // Signature block
    out.push(formatRow('Penerima (Sales)', 'Kasir / Toko'));
    out.push('');
    out.push('');
    out.push(formatRow('(..............)', '(..............)'));
    out.push(doubleLine);
    out.push(center('Bukti pembayaran sah & resmi.'));

    return out.join('\n');
  }

  /**
   * Format Nota Retur Penjualan (Sales Return Receipt)
   */
  static formatReturnReceiptText(data: {
    return_no: string;
    invoice_no: string;
    created_at: string;
    cashier_name?: string;
    customer_name?: string;
    reason: string;
    refund_method: string;
    total_refund: number;
    items: Array<{
      item_name: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
    }>;
  }, paperWidth: '58mm' | '80mm' = '58mm'): string {
    const width = paperWidth === '80mm' ? 48 : 32;
    const getSetting = (key: string, def = '') => {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
      return row ? row.value : def;
    };

    const storeName = getSetting('store_name', 'MINIMARKET IPAY BERKAH');
    const storeAddress = getSetting('store_address', 'Jl. Ahmad Yani No. 88');
    const storePhone = getSetting('store_phone', '0812-3456-7890');

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

    const formatCurrency = (amount: number) => 'Rp ' + amount.toLocaleString('id-ID');

    const out: string[] = [];
    out.push(center(storeName.toUpperCase()));
    if (storeAddress) out.push(center(storeAddress));
    if (storePhone) out.push(center(`Telp: ${storePhone}`));
    out.push(doubleLine);
    out.push(center('*** NOTA RETUR PENJUALAN ***'));
    out.push(line);

    out.push(formatRow('No. Retur', data.return_no));
    out.push(formatRow('Ref. Faktur', data.invoice_no));
    out.push(formatRow('Waktu', new Date(data.created_at).toLocaleString('id-ID')));
    if (data.cashier_name) out.push(formatRow('Kasir', data.cashier_name));
    if (data.customer_name) out.push(formatRow('Pelanggan', data.customer_name));
    out.push(line);

    out.push('BARANG DIRETUR:');
    for (const it of data.items) {
      out.push(it.item_name);
      out.push(formatRow(`  ${it.quantity} x ${formatCurrency(it.unit_price)}`, formatCurrency(it.subtotal)));
    }
    out.push(line);

    out.push(formatRow('TOTAL PENGEMBALIAN', formatCurrency(data.total_refund)));
    out.push(formatRow('Metode Pengembalian', data.refund_method === 'CASH' ? 'Tunai (Kas Laci)' : 'Potong Hutang Kasbon'));
    out.push(line);
    out.push(`Alasan: ${data.reason}`);
    out.push(doubleLine);
    out.push(center('Barang retur telah diverifikasi'));
    out.push(center('dan tercatat di sistem pembukuan.'));
    return out.join('\n');
  }
}
