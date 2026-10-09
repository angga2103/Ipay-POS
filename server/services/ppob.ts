import crypto from 'crypto';
import db from '../db/database';
import { PPOBSimulator } from './ppob-simulator';
import { AccountingService } from './accounting';

export interface PPOBConfig {
  apiKey: string;
  merchantId: string;
  secretKey: string;
  mode: 'live' | 'sandbox';
  baseUrl: string;
  lowBalanceThreshold: number;
}

export class PPOBService {
  /**
   * Load active PPOB configuration from database
   */
  static getConfig(): PPOBConfig {
    const getSetting = (key: string, def = '') => {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
      return row ? row.value : def;
    };

    return {
      apiKey: getSetting('ipay_api_key', 'DEMO_KEY_IPAY_89230198'),
      merchantId: getSetting('ipay_merchant_id', 'IPAY_MCH_00789'),
      secretKey: getSetting('ipay_secret_key', 'SEC_DEMO_99881122'),
      mode: (getSetting('ipay_mode', 'sandbox') as 'live' | 'sandbox'),
      baseUrl: (getSetting('ipay_base_url', 'https://ipay.my.id') || 'https://ipay.my.id').replace('https://api.ipay.my.id', 'https://ipay.my.id'),
      lowBalanceThreshold: parseFloat(getSetting('low_balance_threshold', '150000')),
    };
  }

  /**
   * Generate MD5 signature for ipay.my.id requests
   */
  static generateSignature(merchantId: string, secretKey: string, refId: string): string {
    return crypto.createHash('md5').update(`${merchantId}${secretKey}${refId}`).digest('hex');
  }

  /**
   * Get Real-time PPOB Balance (Synchronized with COA Account 1-1003)
   */
  static async getBalance(): Promise<{ balance: number; lowBalanceAlert: boolean; mode: string }> {
    const config = this.getConfig();

    // Query balance from local ledger (Akun 1-1003)
    const acc = db.prepare("SELECT balance FROM chart_of_accounts WHERE code = '1-1003'").get() as { balance: number } | undefined;
    let currentBalance = acc ? acc.balance : 0;

    if (config.mode === 'live') {
      try {
        // Live API call to ipay.my.id check-balance endpoint
        const sign = crypto.createHash('md5').update(`${config.merchantId}${config.secretKey}balance`).digest('hex');
        const res = await fetch(`${config.baseUrl}/api/v1/profile/balance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': config.apiKey,
          },
          body: JSON.stringify({
            merchant_id: config.merchantId,
            signature: sign,
          }),
        });

        if (res.ok) {
          const data = await res.json() as any;
          if (data && typeof data.balance === 'number') {
            currentBalance = data.balance;
          }
        }
      } catch (err) {
        console.warn('Live API balance check failed, falling back to local ledger:', err);
      }
    }

    return {
      balance: currentBalance,
      lowBalanceAlert: currentBalance < config.lowBalanceThreshold,
      mode: config.mode,
    };
  }

  /**
   * Inquiry validation for PLN Meter / Postpaid Bills
   */
  static async checkInquiry(sku: string, customerNo: string) {
    const config = this.getConfig();

    if (config.mode === 'sandbox') {
      return PPOBSimulator.simulateInquiry(sku, customerNo);
    }

    // Live API Inquiry
    const refId = `INQ-${Date.now()}`;
    const sign = this.generateSignature(config.merchantId, config.secretKey, refId);

    const response = await fetch(`${config.baseUrl}/api/v1/transaction/inquiry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': config.apiKey,
      },
      body: JSON.stringify({
        merchant_id: config.merchantId,
        buyer_sku_code: sku,
        customer_no: customerNo,
        ref_id: refId,
        sign,
      }),
    });

    const data = await response.json() as any;
    return {
      status: data.status === 'success' ? 'SUCCESS' : 'FAILED',
      customer_no: customerNo,
      customer_name: data.customer_name || data.data?.customer_name || '',
      amount: data.amount || data.data?.price || 0,
      admin_fee: data.admin || data.data?.admin || 0,
      total_amount: (data.amount || 0) + (data.admin || 0),
      meter_no: data.meter_no || customerNo,
      message: data.message || '',
    };
  }

  /**
   * Execute PPOB Purchase with Idempotency Key & Balance Pre-Check
   */
  static async executePurchase(params: {
    sku: string;
    customer_no: string;
    customer_name?: string;
    ref_id: string;
    order_id?: number;
    force_status?: 'SUCCESS' | 'PENDING' | 'FAILED';
  }) {
    const config = this.getConfig();

    // 1. Get product details & cost price
    const prod = db.prepare('SELECT * FROM ppob_products WHERE sku_code = ?').get(params.sku) as any;
    if (!prod) {
      throw new Error(`Produk PPOB SKU ${params.sku} tidak ditemukan`);
    }

    // 2. Pre-check deposit balance
    let currentBalance = (db.prepare("SELECT balance FROM chart_of_accounts WHERE code = '1-1003'").get() as any)?.balance || 0;
    if (currentBalance < prod.base_price && config.mode === 'live') {
      try {
        const live = await this.getBalance();
        currentBalance = live.balance;
      } catch {}
    }

    if (currentBalance < prod.base_price) {
      throw new Error(`Saldo deposit ipay.my.id tidak mencukupi! Sisa: Rp ${currentBalance.toLocaleString('id-ID')}, Diperlukan: Rp ${prod.base_price.toLocaleString('id-ID')}`);
    }

    // 3. Execution (Sandbox or Live)
    let result: {
      status: 'SUCCESS' | 'PENDING' | 'FAILED';
      sn_token?: string;
      message: string;
    };

    if (config.mode === 'sandbox') {
      result = await PPOBSimulator.simulatePurchase({
        sku: params.sku,
        customer_no: params.customer_no,
        ref_id: params.ref_id,
        base_price: prod.base_price,
        force_status: params.force_status,
      });
    } else {
      // Live API Call to ipay.my.id
      const sign = this.generateSignature(config.merchantId, config.secretKey, params.ref_id);
      const res = await fetch(`${config.baseUrl}/api/v1/transaction/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': config.apiKey,
        },
        body: JSON.stringify({
          merchant_id: config.merchantId,
          buyer_sku_code: params.sku,
          customer_no: params.customer_no,
          ref_id: params.ref_id,
          sign,
        }),
      });

      const data = await res.json() as any;
      const apiStatus = (data.data?.status || data.status || '').toLowerCase();
      const snFromApi = String(data.data?.sn || data.sn || '').trim();
      const msgFromApi = String(data.data?.message || data.message || '').trim();
      const isSuccess = apiStatus === 'success' || apiStatus === 'sukses';
      const isPending = apiStatus === 'pending' || apiStatus === 'waiting' || apiStatus === 'menunggu';

        result = {
          status: isSuccess ? 'SUCCESS' : (isPending ? 'PENDING' : 'FAILED'),
          sn_token: snFromApi || (isSuccess ? msgFromApi : ''),
          message: msgFromApi || (isSuccess ? 'Transaksi Sukses' : 'Gagal dari provider'),
        };

        // Fast Auto-Check: Jika status awal dari Digiflazz masih PENDING, tunggu 2.5 detik lalu periksa status sekali lagi
        if (result.status === 'PENDING') {
          try {
            await new Promise(r => setTimeout(r, 2500));
            const checkRes = await fetch(`${config.baseUrl}/api/v1/transaction/status/${encodeURIComponent(params.ref_id)}`, {
              method: 'GET',
              headers: {
                'X-API-KEY': config.apiKey,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) POS-IPAY/1.0',
                'Accept': 'application/json',
              },
            });
            if (checkRes.ok) {
              const checkData = await checkRes.json() as any;
              const cData = checkData.data || checkData;
              const cStat = String(cData.status || '').toLowerCase();
              const cSn = String(cData.sn || '').trim();
              if (cStat === 'success' || cStat === 'sukses') {
                result.status = 'SUCCESS';
                result.sn_token = cSn || result.sn_token;
                result.message = cData.message || 'Transaksi Sukses';
              }
            }
          } catch {
            // ignore quick check error
          }
        }
      }

      // 4. Record into `ppob_transactions`
      db.prepare(`
        INSERT INTO ppob_transactions (
          order_id, ref_id, sku_code, customer_no, customer_name, base_price, selling_price, admin_fee, status, sn_token, raw_response
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
      `).run(
        params.order_id || null,
        params.ref_id,
        params.sku,
        params.customer_no,
        params.customer_name || '',
        prod.base_price,
        prod.selling_price,
        result.status,
        result.sn_token || null,
        JSON.stringify(result)
      );

      return {
        ...result,
        sku: params.sku,
        product_name: prod.product_name,
        base_price: prod.base_price,
        selling_price: prod.selling_price,
        ref_id: params.ref_id,
      };
    }

    /**
     * Handle Incoming Webhook Callback from ipay.my.id
     */
    static handleWebhook(payload: {
      ref_id: string;
      status: 'success' | 'failed' | 'pending';
      sn?: string;
      buyer_sku_code?: string;
      sign?: string;
    }) {
      const config = this.getConfig();

      console.log(`[PPOB Webhook] Received callback for ref_id: ${payload.ref_id}, status: ${payload.status}`);

      // Verify webhook signature in live production mode
      if (config.mode === 'live') {
        const expectedSign = this.generateSignature(config.merchantId, config.secretKey, payload.ref_id);
        if (!payload.sign || payload.sign.toLowerCase() !== expectedSign.toLowerCase()) {
          console.warn(`[PPOB Webhook] Signature verification failed for ref_id: ${payload.ref_id}`);
          return { success: false, message: 'Tanda tangan webhook tidak valid (Signature Mismatch)' };
        }
      }

      const existingTx = db.prepare('SELECT * FROM ppob_transactions WHERE ref_id = ?').get(payload.ref_id) as any;
      if (!existingTx) {
        console.warn(`[PPOB Webhook] Transaction with ref_id ${payload.ref_id} not found`);
        return { success: false, message: 'Transaction not found' };
      }

      const newStatus = payload.status.toUpperCase() as 'SUCCESS' | 'FAILED' | 'PENDING';
      const snToken = payload.sn || existingTx.sn_token;

      // Update transaction
      db.prepare(`
        UPDATE ppob_transactions
        SET status = ?, sn_token = ?, raw_response = ?, updated_at = CURRENT_TIMESTAMP
        WHERE ref_id = ?
      `).run(newStatus, snToken, JSON.stringify(payload), payload.ref_id);

      // Update associated order_item if linked
      db.prepare(`
        UPDATE order_items
        SET ppob_status = ?, ppob_sn_token = ?
        WHERE ppob_ref_id = ?
      `).run(newStatus, snToken, payload.ref_id);

      // If transaction previously was PENDING or SUCCESS and now becomes FAILED:
      // Trigger Auto-Reversal in Accounting!
      if (newStatus === 'FAILED' && existingTx.status !== 'FAILED') {
        const order = existingTx.order_id
          ? (db.prepare('SELECT invoice_no FROM orders WHERE id = ?').get(existingTx.order_id) as any)
          : null;

        const invoiceNo = order ? order.invoice_no : `PPOB-${payload.ref_id}`;

        AccountingService.recordPPOBReversal({
          invoice_no: invoiceNo,
          product_name: existingTx.sku_code,
          selling_price: existingTx.selling_price,
          cost_price: existingTx.base_price,
          refund_method: 'CASH',
        });

        console.log(`[PPOB Webhook] Auto-reversal journal generated for failed transaction ${payload.ref_id}`);
      }

      return { success: true, ref_id: payload.ref_id, status: newStatus };
    }

    /**
     * Cek & Sinkronkan status transaksi spesifik ke server ipay.my.id
     */
    static async syncTransactionStatus(refId: string): Promise<{
      success: boolean;
      status: 'SUCCESS' | 'PENDING' | 'FAILED';
      sn_token?: string;
      message?: string;
    }> {
      const config = this.getConfig();
      const existingTx = db.prepare('SELECT * FROM ppob_transactions WHERE ref_id = ?').get(refId) as any;
      if (!existingTx) {
        return { success: false, status: 'FAILED', message: `Transaksi ${refId} tidak ditemukan di database POS` };
      }

      if (config.mode === 'sandbox') {
        return { success: true, status: existingTx.status, sn_token: existingTx.sn_token };
      }

      try {
        const res = await fetch(`${config.baseUrl}/api/v1/transaction/status/${encodeURIComponent(refId)}`, {
          method: 'GET',
          headers: {
            'X-API-KEY': config.apiKey,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) POS-IPAY/1.0',
            'Accept': 'application/json',
          },
        });

        if (!res.ok) {
          const errText = await res.text();
          return { success: false, status: existingTx.status, message: `Server HTTP ${res.status}: ${errText}` };
        }

        const data = await res.json() as any;
        const resData = data.data || data;
        const rawStat = String(resData.status || '').toLowerCase();
        const snFromApi = String(resData.sn || '').trim();
        const msgFromApi = String(resData.message || '').trim();

        let newStatus: 'SUCCESS' | 'PENDING' | 'FAILED' = existingTx.status;
        if (rawStat === 'success' || rawStat === 'sukses') {
          newStatus = 'SUCCESS';
        } else if (rawStat === 'failed' || rawStat === 'gagal') {
          newStatus = 'FAILED';
        } else if (rawStat === 'pending' || rawStat === 'waiting' || rawStat === 'menunggu') {
          newStatus = 'PENDING';
        }

        const snToken = snFromApi || (newStatus === 'SUCCESS' ? (existingTx.sn_token && !existingTx.sn_token.includes('Pending') ? existingTx.sn_token : msgFromApi) : existingTx.sn_token);

        // Update di database lokal POS
        db.prepare(`
          UPDATE ppob_transactions
          SET status = ?, sn_token = ?, raw_response = ?, updated_at = CURRENT_TIMESTAMP
          WHERE ref_id = ?
        `).run(newStatus, snToken, JSON.stringify(data), refId);

        db.prepare(`
          UPDATE order_items
          SET ppob_status = ?, ppob_sn_token = ?
          WHERE ppob_ref_id = ?
        `).run(newStatus, snToken, refId);

        // Jika sebelumnya bukan FAILED dan sekarang jadi FAILED, lakukan auto-reversal
        if (newStatus === 'FAILED' && existingTx.status !== 'FAILED') {
          const order = existingTx.order_id
            ? (db.prepare('SELECT invoice_no FROM orders WHERE id = ?').get(existingTx.order_id) as any)
            : null;
          const invoiceNo = order ? order.invoice_no : `PPOB-${refId}`;
          AccountingService.recordPPOBReversal({
            invoice_no: invoiceNo,
            product_name: existingTx.sku_code,
            selling_price: existingTx.selling_price,
            cost_price: existingTx.base_price,
            refund_method: 'CASH',
          });
          console.log(`[PPOB Sync] Auto-reversal journal generated for failed transaction ${refId}`);
        }

        console.log(`[PPOB Sync] Ref ID ${refId} status synced: ${existingTx.status} -> ${newStatus} (SN: ${snToken})`);
        return {
          success: true,
          status: newStatus,
          sn_token: snToken,
          message: msgFromApi || `Status berhasil disinkronkan (${newStatus})`,
        };
      } catch (err: any) {
        console.error(`[PPOB Sync] Gagal sync status ${refId}:`, err);
        return { success: false, status: existingTx.status, message: err.message };
      }
    }

    /**
     * Sinkronkan semua transaksi yang masih PENDING dalam 24 jam terakhir
     */
    static async syncAllPendingTransactions(): Promise<{ synced: number; results: any[] }> {
      const pendingList = db.prepare(`
        SELECT ref_id FROM ppob_transactions 
        WHERE status = 'PENDING'
        ORDER BY id DESC
        LIMIT 20
      `).all() as { ref_id: string }[];

      const results: any[] = [];
      for (const item of pendingList) {
        const res = await this.syncTransactionStatus(item.ref_id);
        results.push({ ref_id: item.ref_id, ...res });
      }

      return { synced: results.length, results };
    }

  /**
   * Auto-Pricing Rules: Update selling prices based on markup rules
   */
  static applyMarkupRules(options?: { globalMarkupType?: 'FIXED' | 'PERCENT'; globalMarkupValue?: number }) {
    const products = db.prepare('SELECT * FROM ppob_products').all() as any[];

    const updatePrice = db.prepare(`
      UPDATE ppob_products
      SET selling_price = ?, markup_type = ?, markup_value = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    for (const prod of products) {
      const mType = options?.globalMarkupType || prod.markup_type;
      const mVal = options?.globalMarkupValue !== undefined ? options.globalMarkupValue : prod.markup_value;

      let newSellingPrice = prod.base_price;
      if (mType === 'PERCENT') {
        newSellingPrice = prod.base_price + (prod.base_price * mVal / 100);
      } else {
        newSellingPrice = prod.base_price + mVal;
      }

      // Round to nearest Rp 100
      newSellingPrice = Math.ceil(newSellingPrice / 100) * 100;

      updatePrice.run(newSellingPrice, mType, mVal, prod.id);
    }
  }

  /**
   * Test Connection to ipay.my.id
   */
  static async testConnection(): Promise<{ success: boolean; message: string; balance?: number }> {
    const config = this.getConfig();

    if (config.mode === 'sandbox') {
      const bal = await this.getBalance();
      return {
        success: true,
        message: 'Koneksi Berhasil! (Mode: Built-in Sandbox Simulator aktif)',
        balance: bal.balance,
      };
    }

    try {
      const sign = crypto.createHash('md5').update(`${config.merchantId}${config.secretKey}balance`).digest('hex');
      const res = await fetch(`${config.baseUrl}/api/v1/profile/balance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': config.apiKey,
        },
        body: JSON.stringify({
          merchant_id: config.merchantId,
          signature: sign,
        }),
      });

      if (!res.ok) {
        return { success: false, message: `Server mengembalikan status ${res.status}: ${res.statusText}` };
      }

      const data = await res.json() as any;
      return {
        success: true,
        message: 'Koneksi ke API ipay.my.id Berhasil!',
        balance: data.balance || 0,
      };
    } catch (err: any) {
      return { success: false, message: `Gagal menghubungi server ipay.my.id: ${err.message}` };
    }
  }

  /**
   * Tarik dan Sinkronkan Seluruh Produk PPOB dari ipay.my.id Open API Gateway
   */
  static async syncProductsFromIpay(): Promise<{ success: boolean; message: string; count: number }> {
    const config = this.getConfig();

    if (config.mode === 'sandbox') {
      return {
        success: false,
        message: 'Aplikasi kasir masih dalam Mode Sandbox. Silakan alihkan Mode Integrasi ke "Live Production" di atas lalu Simpan Konfigurasi.',
        count: 0,
      };
    }

    try {
      const cleanUrl = config.baseUrl.replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/api/v1/products`, {
        method: 'GET',
        headers: {
          'X-API-KEY': config.apiKey,
        },
      });

      if (!res.ok) {
        return {
          success: false,
          message: `Gagal menghubungi API ipay.my.id: HTTP ${res.status} ${res.statusText}. Pastikan Base URL & API Key sudah benar.`,
          count: 0,
        };
      }

      const json = await res.json() as any;
      if (!json || json.status !== 'success' || !Array.isArray(json.data)) {
        return {
          success: false,
          message: json?.message || 'Format data dari server ipay.my.id tidak valid',
          count: 0,
        };
      }

      const products = json.data;

      // Ambil aturan markup global yang sedang aktif
      const rowType = db.prepare("SELECT value FROM settings WHERE key = 'global_markup_type'").get() as any;
      const rowVal = db.prepare("SELECT value FROM settings WHERE key = 'global_markup_value'").get() as any;
      const mType = rowType?.value === 'PERCENT' ? 'PERCENT' : 'FIXED';
      const mVal = parseFloat(rowVal?.value || '2000');

      const upsert = db.prepare(`
        INSERT INTO ppob_products (
          provider_code, category_code, type, sku_code, product_name, description, base_price, markup_type, markup_value, selling_price, is_active, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
        )
        ON CONFLICT(sku_code) DO UPDATE SET
          provider_code = excluded.provider_code,
          category_code = excluded.category_code,
          type = excluded.type,
          product_name = excluded.product_name,
          base_price = excluded.base_price,
          selling_price = CASE 
            WHEN ppob_products.markup_type = 'PERCENT' 
              THEN (excluded.base_price + (excluded.base_price * ppob_products.markup_value / 100))
            ELSE (excluded.base_price + ppob_products.markup_value)
          END,
          is_active = excluded.is_active,
          updated_at = CURRENT_TIMESTAMP
      `);

      let count = 0;
      const tx = db.transaction(() => {
        for (const p of products) {
          const sku = String(p.sku || '').trim();
          if (!sku) continue;

          const provider = String(p.brand || 'UMUM').toUpperCase().trim();
          const category = String(p.category || 'PULSA').toUpperCase().trim();
          const pType = (p.type || 'prepaid').toLowerCase().trim() === 'postpaid' ? 'postpaid' : 'prepaid';
          const name = String(p.name || sku).trim();
          const basePrice = parseFloat(p.price || p.base_price || 0);

          let sellingPrice = basePrice;
          if (mType === 'PERCENT') {
            sellingPrice = basePrice + (basePrice * mVal / 100);
          } else {
            sellingPrice = basePrice + mVal;
          }
          sellingPrice = Math.ceil(sellingPrice / 100) * 100;

          upsert.run(
            provider,
            category,
            pType,
            sku,
            name,
            p.description || '',
            basePrice,
            mType,
            mVal,
            sellingPrice,
            p.is_active ? 1 : 0
          );
          count++;
        }
      });

      tx();

      return {
        success: true,
        count,
        message: `Berhasil menarik dan menyinkronkan ${count} produk PPOB dari ipay.my.id!`,
      };
    } catch (err: any) {
      console.error('[PPOB Sync Error]', err);
      return {
        success: false,
        count: 0,
        message: `Gagal sinkronisasi produk: ${err.message}`,
      };
    }
  }

  /**
   * Mengambil informasi rekening dan saluran deposit dari server ipay.my.id
   */
  static async getDepositInfo(): Promise<{
    success: boolean;
    data?: any;
    live_balance?: number;
    merchant_id?: string;
    deposit_channels?: any;
    message?: string;
    wa_target?: string;
    instructions?: string;
    channels?: any;
  }> {
    const config = this.getConfig();

    const defaultChannels = {
      dana_number: '081775700114',
      gopay_number: '081775700114',
      shopeepay_number: '081775700114',
      bank_accounts: [
        { bank: 'BCA', number: '1234567890', holder: 'PT GARUDATEL NUSANTARA' },
        { bank: 'MANDIRI', number: '9876543210', holder: 'PT GARUDATEL NUSANTARA' },
      ],
    };

    if (config.mode === 'sandbox') {
      const balRes = await this.getBalance();
      const liveBal = balRes.balance;
      return {
        success: true,
        data: {
          merchant_id: config.merchantId || 'SANDBOX_USER',
          balance: liveBal,
          deposit_channels: defaultChannels,
        },
        live_balance: liveBal,
        merchant_id: config.merchantId || 'SANDBOX_USER',
        deposit_channels: defaultChannels,
        message: 'Mode Sandbox (Offline/Simulasi): Saluran deposit lokal aktif',
      };
    }

    try {
      const res = await fetch(`${config.baseUrl}/api/v1/profile/deposit/info`, {
        method: 'GET',
        headers: {
          'X-API-KEY': config.apiKey,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) POS-IPAY/1.0',
          'Accept': 'application/json',
        },
      });

      if (res.ok) {
        const json = await res.json() as any;
        const balRes = await this.getBalance();
        const apiData = json.data || {};
        const channelsList = apiData.channels || defaultChannels;
        return {
          success: true,
          data: apiData,
          live_balance: typeof apiData.balance === 'number' ? apiData.balance : balRes.balance,
          merchant_id: apiData.merchant_id || config.merchantId,
          wa_target: apiData.wa_target || '081775700114',
          instructions: apiData.instructions || '',
          channels: channelsList,
          deposit_channels: channelsList,
        };
      }
    } catch (err: any) {
      console.warn('[PPOB getDepositInfo warning]', err.message);
    }

    const balRes = await this.getBalance();
    const liveBal = balRes.balance;
    return {
      success: true,
      data: {
        merchant_id: config.merchantId,
        balance: liveBal,
        deposit_channels: defaultChannels,
      },
      live_balance: liveBal,
      merchant_id: config.merchantId,
      deposit_channels: defaultChannels,
      message: 'Info deposit lokal aktif',
    };
  }

  /**
   * Membuat permohonan deposit ke ipay.my.id dan mencatat mutasi kas ganda di akuntansi POS
   */
  static async createDepositRequest(params: {
    amount: number;
    channel: string;
    sourceAccount: string;
    notes?: string;
  }): Promise<{
    success: boolean;
    data?: any;
    ref_id?: string;
    amount?: number;
    base_amount?: number;
    unique_code?: number;
    channel?: string;
    target_account?: string;
    target_name?: string;
    whatsapp_url?: string;
    message?: string;
  }> {
    const config = this.getConfig();
    const baseAmount = Number(params.amount);
    if (!baseAmount || baseAmount < 10000) {
      return { success: false, message: 'Nominal deposit minimal Rp 10.000' };
    }

    // Generate kode unik 3 digit acak (100 - 999)
    const uniqueCode = Math.floor(100 + Math.random() * 900);
    const totalAmount = baseAmount + uniqueCode;

    try {
      const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const refId = `DEP-${todayStr}-${Date.now().toString().slice(-4)}`;

      // Tentukan rekening tujuan transfer dari channel yang dipilih (Akun Resmi iPay)
      let targetAccount = 'DANA: 081775700114';
      let targetName = 'Angga Dian Pratama Putra (iPay / GarudaTel)';
      const chUpper = (params.channel || '').toUpperCase();
      if (chUpper.includes('GO')) {
        targetAccount = 'GoPay: 081775700114';
      } else if (chUpper.includes('SHOPEE')) {
        targetAccount = 'ShopeePay: 081775700114';
      } else if (chUpper.includes('BANK') || chUpper.includes('BCA')) {
        targetAccount = 'Bank BCA: 1234567890';
        targetName = 'PT GARUDATEL NUSANTARA / iPay';
      } else if (chUpper.includes('DANA')) {
        targetAccount = 'DANA: 081775700114';
      }

      // Buat tautan WhatsApp otomatis untuk konfirmasi langsung ke nomor WhatsApp admin iPay
      const waAdmin = '6281775700114';
      const waMsg = encodeURIComponent(
        `Halo Admin iPay, saya telah membuat tiket deposit saldo PPOB:\n\n` +
        `• *Merchant ID:* ${config.merchantId}\n` +
        `• *Ref ID:* ${refId}\n` +
        `• *Nominal Pokok:* Rp ${baseAmount.toLocaleString('id-ID')}\n` +
        `• *Kode Unik (3 Angka):* ${uniqueCode}\n` +
        `• *TOTAL TRANSFER:* Rp ${totalAmount.toLocaleString('id-ID')} (Wajib Sesuai)\n` +
        `• *Metode:* ${params.channel}\n` +
        `• *Tujuan:* ${targetAccount} (${targetName})\n` +
        `• *Catatan:* ${params.notes || '-'}\n\n` +
        `Mohon verifikasi transfer dan setujui penambahan saldo akun iPay saya di panel admin. Terima kasih!`
      );
      const whatsappUrl = `https://wa.me/${waAdmin}?text=${waMsg}`;

      let apiData: any = {
        ref_id: refId,
        amount: totalAmount,
        base_amount: baseAmount,
        unique_code: uniqueCode,
        channel: params.channel,
        target_account: targetAccount,
        target_name: targetName,
        whatsapp_url: whatsappUrl,
        status: 'PENDING',
        message: 'Tiket deposit berhasil dibuat. Silakan lakukan transfer dan konfirmasi ke admin iPay.',
      };

      // Jika dalam mode LIVE, coba beri tahu server gateway ipay.my.id
      if (config.mode === 'live') {
        try {
          const res = await fetch(`${config.baseUrl}/api/v1/profile/deposit/create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-KEY': config.apiKey,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) POS-IPAY/1.0',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              merchant_id: config.merchantId,
              amount: totalAmount,
              base_amount: baseAmount,
              unique_code: uniqueCode,
              channel: params.channel,
              ref_id: refId,
              notes: params.notes || `Deposit via Web POS IPAY (${config.merchantId})`,
            }),
          });

          if (res.ok) {
            const json = await res.json() as any;
            if (json && json.data) {
              apiData = {
                ...apiData,
                ...json.data,
                ref_id: json.data.ref_id || refId,
                amount: json.data.amount || totalAmount,
                base_amount: json.data.base_amount || baseAmount,
                unique_code: json.data.unique_code || uniqueCode,
                whatsapp_url: json.data.wa_confirm_url || whatsappUrl,
              };
            }
          } else {
            console.warn(`[PPOB Gateway] Remote create ticket returned status ${res.status}. Saving local ticket.`);
          }
        } catch (fetchErr: any) {
          console.warn('[PPOB Gateway] Remote connection error:', fetchErr.message);
        }
      }

      // Catat tiket deposit ke database lokal dengan status PENDING
      try {
        db.prepare(`
          INSERT OR REPLACE INTO ppob_deposits (ref_id, amount, channel, source_account, status, payment_instruction, notes)
          VALUES (?, ?, ?, ?, 'PENDING', ?, ?)
        `).run(
          apiData.ref_id,
          totalAmount,
          params.channel,
          params.sourceAccount || '1-1001',
          JSON.stringify({
            target_account: targetAccount,
            target_name: targetName,
            whatsapp_url: apiData.whatsapp_url || whatsappUrl,
            base_amount: baseAmount,
            unique_code: uniqueCode,
            total_amount: totalAmount,
          }),
          params.notes || null
        );
      } catch (dbErr) {
        console.warn('Gagal mencatat ppob_deposits table:', dbErr);
      }

      return {
        success: true,
        ref_id: apiData.ref_id,
        amount: totalAmount,
        base_amount: baseAmount,
        unique_code: uniqueCode,
        channel: params.channel,
        target_account: targetAccount,
        target_name: targetName,
        whatsapp_url: apiData.whatsapp_url || whatsappUrl,
        data: apiData,
        message: `Tiket deposit berhasil dibuat (PENDING). Silakan transfer tepat Rp ${totalAmount.toLocaleString('id-ID')} (Kode Unik: ${uniqueCode}).`,
      };
    } catch (err: any) {
      console.error('[PPOB Deposit Error]', err);
      return { success: false, message: `Gagal memproses deposit: ${err.message}` };
    }
  }

  /**
   * Cek status tiket deposit spesifik ke server ipay.my.id dan sinkronkan ke database lokal
   */
  static async syncDepositTicketStatus(refId: string): Promise<{
    success: boolean;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    remoteStatus?: string;
    message: string;
    amount?: number;
  }> {
    const config = this.getConfig();
    const dep = db.prepare('SELECT * FROM ppob_deposits WHERE ref_id = ?').get(refId) as any;
    if (!dep) {
      return { success: false, status: 'PENDING', message: `Tiket ${refId} tidak ditemukan di database POS` };
    }

    if (dep.status === 'APPROVED') {
      return { success: true, status: 'APPROVED', message: `Tiket ${refId} sudah disetujui sebelumnya.` };
    }

    if (config.mode === 'sandbox') {
      return { success: true, status: dep.status, message: `Status lokal (Sandbox): ${dep.status}` };
    }

    try {
      const res = await fetch(`${config.baseUrl}/api/v1/profile/deposit/status/${encodeURIComponent(refId)}`, {
        method: 'GET',
        headers: {
          'X-API-KEY': config.apiKey,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) POS-IPAY/1.0',
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        return { success: false, status: dep.status, message: `Server iPay merespons status HTTP ${res.status}` };
      }

      const json = await res.json() as any;
      const remoteData = json.data || {};
      const remoteStat = String(remoteData.status || '').toUpperCase();

      if (remoteStat === 'SUCCESS' || remoteStat === 'APPROVED' || remoteStat === 'PAID') {
        // Otomatis approve tiket di POS jika server iPay telah menyetujuinya!
        const approveRes = await this.approveDeposit(refId);
        return {
          success: true,
          status: 'APPROVED',
          remoteStatus: remoteStat,
          amount: dep.amount,
          message: approveRes.message || `Tiket ${refId} telah disetujui oleh admin iPay dan saldo POS berhasil diselaraskan.`,
        };
      } else if (remoteStat === 'FAILED' || remoteStat === 'REJECTED') {
        this.rejectDeposit(refId, remoteData.sn || 'Ditolak oleh admin server iPay');
        return {
          success: true,
          status: 'REJECTED',
          remoteStatus: remoteStat,
          message: `Tiket ${refId} ditolak oleh admin iPay.`,
        };
      }

      return {
        success: true,
        status: 'PENDING',
        remoteStatus: 'PENDING',
        message: 'Tiket masih berstatus PENDING di server iPay (Menunggu verifikasi admin).',
      };
    } catch (err: any) {
      return { success: false, status: dep.status, message: `Gagal menghubungi server iPay: ${err.message}` };
    }
  }

  /**
   * Mengambil riwayat tiket deposit PPOB
   */
  static getDepositHistory() {
    try {
      return db.prepare('SELECT * FROM ppob_deposits ORDER BY id DESC LIMIT 50').all();
    } catch {
      return [];
    }
  }

  /**
   * Verifikasi dan setujui tiket deposit PPOB (Menambah saldo 1-1003 & mencatat mutasi kas ganda)
   */
  static async approveDeposit(refId: string): Promise<{ success: boolean; message: string }> {
    try {
      const dep = db.prepare('SELECT * FROM ppob_deposits WHERE ref_id = ?').get(refId) as any;
      if (!dep) return { success: false, message: 'Tiket deposit tidak ditemukan' };
      if (dep.status === 'APPROVED') return { success: false, message: 'Tiket deposit sudah disetujui sebelumnya' };
      if (dep.status === 'REJECTED') return { success: false, message: 'Tiket deposit ini telah ditolak' };

      // Update status tiket menjadi APPROVED
      db.prepare(`
        UPDATE ppob_deposits
        SET status = 'APPROVED', verified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(dep.id);

      // Catat Mutasi Kas Ganda di Akuntansi POS (Double-entry) HANYA setelah diverifikasi
      const sourceAcc = dep.source_account || '1-1001';
      AccountingService.createJournalEntry({
        reference_type: 'SHIFT_ADJUSTMENT',
        reference_id: dep.ref_id,
        description: `Top-up Saldo Deposit PPOB (ipay.my.id) via ${dep.channel} [Disetujui]`,
        lines: [
          {
            account_code: '1-1003',
            debit: dep.amount,
            credit: 0,
            memo: `Deposit Saldo PPOB Ref ${dep.ref_id} - Terverifikasi`,
          },
          {
            account_code: sourceAcc,
            debit: 0,
            credit: dep.amount,
            memo: `Pengeluaran Kas/Bank untuk Top-up Saldo PPOB Ref ${dep.ref_id}`,
          },
        ],
      });

      // Jika sumber dana kas laci kasir (1-1001), selaraskan laci kasir shift aktif
      if (sourceAcc === '1-1001') {
        const activeShift = db.prepare("SELECT id, cashier_id FROM shifts WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1").get() as any;
        if (activeShift) {
          db.prepare(`
            INSERT INTO shift_cash_logs (shift_id, cashier_id, type, amount, reason)
            VALUES (?, ?, 'CASH_OUT', ?, ?)
          `).run(
            activeShift.id,
            activeShift.cashier_id || 1,
            dep.amount,
            `Top-up Saldo Deposit PPOB (${dep.ref_id})`
          );

          db.prepare(`
            UPDATE shifts 
            SET total_cash_out = total_cash_out + ?, expected_cash = expected_cash - ?
            WHERE id = ?
          `).run(dep.amount, dep.amount, activeShift.id);
        }
      }

      return {
        success: true,
        message: `Tiket ${dep.ref_id} sebesar Rp ${dep.amount.toLocaleString('id-ID')} berhasil disetujui. Saldo akun deposit PPOB (1-1003) kini resmi bertambah.`,
      };
    } catch (err: any) {
      return { success: false, message: `Gagal verifikasi deposit: ${err.message}` };
    }
  }

  /**
   * Tolak tiket deposit PPOB
   */
  static rejectDeposit(refId: string, reason?: string): { success: boolean; message: string } {
    try {
      const dep = db.prepare('SELECT * FROM ppob_deposits WHERE ref_id = ?').get(refId) as any;
      if (!dep) return { success: false, message: 'Tiket deposit tidak ditemukan' };
      if (dep.status === 'APPROVED') return { success: false, message: 'Tiket deposit yang sudah disetujui tidak dapat ditolak' };

      db.prepare(`
        UPDATE ppob_deposits
        SET status = 'REJECTED', notes = COALESCE(?, notes), verified_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(reason || 'Ditolak oleh admin/operator', dep.id);

      return { success: true, message: `Tiket deposit ${refId} berhasil ditolak` };
    } catch (err: any) {
      return { success: false, message: `Gagal menolak deposit: ${err.message}` };
    }
  }

  /**
   * Rekonsiliasi Saldo Buku Kas POS (Akun 1-1003) dengan Saldo Real-Time ipay.my.id
   */
  static async syncLedgerWithLiveBalance(): Promise<{
    success: boolean;
    liveBalance: number;
    ledgerBalance: number;
    difference: number;
    adjusted: boolean;
    message: string;
  }> {
    try {
      const balRes = await this.getBalance();
      const liveBal = balRes.balance;

      const acc = db.prepare("SELECT balance FROM chart_of_accounts WHERE code = '1-1003'").get() as any;
      const ledgerBal = acc ? acc.balance : 0;
      const diff = Math.round((liveBal - ledgerBal) * 100) / 100;

      if (diff !== 0) {
        if (diff > 0) {
          // Saldo live lebih besar dari buku POS (Setoran modal di luar kasir / komisi)
          AccountingService.createJournalEntry({
            reference_type: 'PPOB_RECONCILIATION',
            reference_id: `REC-${Date.now().toString().slice(-6)}`,
            description: `Penyesuaian Selisih Lebih Saldo PPOB Live ipay.my.id`,
            lines: [
              {
                account_code: '1-1003',
                debit: diff,
                credit: 0,
                memo: `Penyesuaian saldo live PPOB lebih tinggi`,
              },
              {
                account_code: '3-1001',
                debit: 0,
                credit: diff,
                memo: `Setoran modal / penambahan saldo luar kasir`,
              },
            ],
          });
        } else {
          // Saldo live lebih kecil (Beban selisih kas / potongan gateway)
          const shortAmount = Math.abs(diff);
          AccountingService.createJournalEntry({
            reference_type: 'PPOB_RECONCILIATION',
            reference_id: `REC-${Date.now().toString().slice(-6)}`,
            description: `Penyesuaian Selisih Kurang Saldo PPOB Live ipay.my.id`,
            lines: [
              {
                account_code: '5-1003',
                debit: shortAmount,
                credit: 0,
                memo: `Beban selisih saldo deposit PPOB live`,
              },
              {
                account_code: '1-1003',
                debit: 0,
                credit: shortAmount,
                memo: `Pengurangan saldo deposit PPOB live`,
              },
            ],
          });
        }
        console.log(`[PPOB Reconcile] Jurnal penyesuaian double-entry dibuat untuk selisih: ${diff}`);
      }

      return {
        success: true,
        liveBalance: liveBal,
        ledgerBalance: ledgerBal,
        difference: diff,
        adjusted: diff !== 0,
        message: diff === 0
          ? 'Saldo Akun Buku Besar POS dan server ipay.my.id sudah seimbang.'
          : `Saldo Buku Kas POS berhasil disesuaikan dengan saldo live ipay.my.id (Penyesuaian: Rp ${diff.toLocaleString('id-ID')}).`,
      };
    } catch (err: any) {
      return {
        success: false,
        liveBalance: 0,
        ledgerBalance: 0,
        difference: 0,
        adjusted: false,
        message: `Gagal sinkron saldo: ${err.message}`,
      };
    }
  }
}

