import db from '../db/database';

export interface SimulatorInquiryResult {
  status: 'SUCCESS' | 'FAILED';
  customer_no: string;
  customer_name: string;
  bill_period?: string;
  amount: number;
  admin_fee: number;
  total_amount: number;
  meter_no?: string;
  power_tariff?: string;
  message?: string;
}

export interface SimulatorTransactionResult {
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  ref_id: string;
  sku: string;
  customer_no: string;
  sn_token?: string;
  message: string;
  base_price: number;
}

export class PPOBSimulator {
  /**
   * Simulate Inquiry for PLN Meter / Postpaid Bills
   */
  static async simulateInquiry(sku: string, customerNo: string): Promise<SimulatorInquiryResult> {
    // Artificial small latency to simulate network roundtrip
    await new Promise(resolve => setTimeout(resolve, 300));

    if (!customerNo || customerNo.length < 8) {
      return {
        status: 'FAILED',
        customer_no: customerNo,
        customer_name: '',
        amount: 0,
        admin_fee: 0,
        total_amount: 0,
        message: 'Nomor Pelanggan tidak valid (minimal 8 digit)',
      };
    }

    // Deterministic realistic customer names based on last digits
    const sampleNames = [
      'BUDI SANTOSO / R1 1300VA',
      'SITI AISYAH / B1 2200VA',
      'HENDRA GUNAWAN / R1M 900VA',
      'DEWI LESTARI / R1 450VA',
      'WARUNG BERKAH JAYA / B2 6600VA',
    ];
    const nameIndex = parseInt(customerNo.slice(-1) || '0', 10) % sampleNames.length;
    const customerName = sampleNames[nameIndex];

    if (sku.startsWith('PLN') && !sku.includes('POST')) {
      // PLN Prepaid Token Inquiry
      return {
        status: 'SUCCESS',
        customer_no: customerNo,
        meter_no: customerNo,
        customer_name: customerName,
        power_tariff: 'R1 / 1300 VA',
        amount: 0,
        admin_fee: 0,
        total_amount: 0,
        message: 'Meter ID Valid',
      };
    } else {
      // Postpaid bill inquiry (PLN Pascabayar, PDAM, BPJS)
      const baseBill = 85000 + (parseInt(customerNo.slice(-3) || '100', 10) * 120);
      const adminFee = 2500;
      return {
        status: 'SUCCESS',
        customer_no: customerNo,
        customer_name: customerName,
        bill_period: new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
        amount: baseBill,
        admin_fee: adminFee,
        total_amount: baseBill + adminFee,
        message: 'Tagihan Berhasil Ditemukan',
      };
    }
  }

  /**
   * Simulate PPOB Purchase Execution
   */
  static async simulatePurchase(params: {
    sku: string;
    customer_no: string;
    ref_id: string;
    base_price: number;
    force_status?: 'SUCCESS' | 'PENDING' | 'FAILED';
  }): Promise<SimulatorTransactionResult> {
    await new Promise(resolve => setTimeout(resolve, 400));

    // Support forced status for testing/demo purposes
    const status = params.force_status || 'SUCCESS';

    if (status === 'FAILED') {
      return {
        status: 'FAILED',
        ref_id: params.ref_id,
        sku: params.sku,
        customer_no: params.customer_no,
        base_price: params.base_price,
        message: 'Transaksi gagal dari operator (Nomor salah atau sedang cut-off)',
      };
    }

    if (status === 'PENDING') {
      return {
        status: 'PENDING',
        ref_id: params.ref_id,
        sku: params.sku,
        customer_no: params.customer_no,
        base_price: params.base_price,
        message: 'Transaksi sedang diproses operator (Pending)',
      };
    }

    // Generate realistic SN or 20-digit PLN Token
    let snToken = '';
    if (params.sku.startsWith('PLN') && !params.sku.includes('POST')) {
      // Generate standard 20-digit PLN token format: 1234-5678-9012-3456-7890
      const genSegment = () => Math.floor(1000 + Math.random() * 9000).toString();
      snToken = `${genSegment()}-${genSegment()}-${genSegment()}-${genSegment()}-${genSegment()}`;
    } else {
      // Provider Serial Number (SN)
      snToken = `SN${new Date().toISOString().slice(2, 10).replace(/-/g, '')}${Math.floor(10000000 + Math.random() * 90000000)}`;
    }

    return {
      status: 'SUCCESS',
      ref_id: params.ref_id,
      sku: params.sku,
      customer_no: params.customer_no,
      sn_token: snToken,
      base_price: params.base_price,
      message: 'Transaksi Berhasil',
    };
  }
}
