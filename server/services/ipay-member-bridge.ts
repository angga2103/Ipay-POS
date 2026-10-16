import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getTenantDatabase, sanitizeTenantId } from '../db/tenant';
import { hashSecret } from '../utils/auth-token';

export interface IpayMemberSyncResult {
  success: boolean;
  isMember: boolean;
  tenantId?: string;
  storeName?: string;
  userName?: string;
  phone?: string;
  balance?: number;
  role?: string;
  passwordValid?: boolean;
  message?: string;
}

export class IpayMemberBridge {
  private static readonly CANDIDATE_URLS = [
    'http://127.0.0.1:5000/api/v1/auth/member-sync-pos',
    'https://ipay.my.id/api/v1/auth/member-sync-pos',
  ];

  private static readonly GARUDA_DB_PATHS = [
    '/var/www/garudatel/app/garudatel.db',
    '/root/garudatel_v2/app/garudatel.db',
    path.resolve(__dirname, '../../../garudatell/app/garudatel.db'),
    path.resolve(__dirname, '../../../garudatel/app/garudatel.db'),
    path.resolve(process.cwd(), '../garudatell/app/garudatel.db'),
    path.resolve(process.cwd(), '../garudatel/app/garudatel.db'),
  ];

  /**
   * Normalisasi nomor telepon ke format 08... dan 628...
   */
  private static normalizePhone(raw: string): { norm08: string; norm62: string; rawClean: string } {
    const rawClean = String(raw || '').trim();
    let digits = rawClean.replace(/\D/g, '');
    let norm08 = digits;
    let norm62 = digits;

    if (digits.startsWith('628')) {
      norm08 = '0' + digits.slice(2);
      norm62 = digits;
    } else if (digits.startsWith('8')) {
      norm08 = '0' + digits;
      norm62 = '62' + digits;
    } else if (digits.startsWith('08')) {
      norm08 = digits;
      norm62 = '62' + digits.slice(1);
    }

    return { norm08, norm62, rawClean };
  }

  /**
   * Mendeteksi apakah user adalah member terdaftar di ipay.my.id.
   * Jika ya, otomatis membuat toko di admin/merchant-api (jika belum ada),
   * menginisialisasi database tenant POS, dan langsung menyinkronkan saldo PPOB live.
   */
  static async discoverAndProvisionMember(
    identifier: string,
    password?: string,
    requestedStoreName?: string
  ): Promise<IpayMemberSyncResult> {
    if (!identifier || !String(identifier).trim()) {
      return { success: false, isMember: false, message: 'Nomor WhatsApp atau username wajib diisi' };
    }

    const { norm08, norm62, rawClean } = this.normalizePhone(identifier);

    // -------------------------------------------------------------
    // METODE 1: PANGGIL REST API INTERNAL GARUDATEL (FLASK SERVER)
    // -------------------------------------------------------------
    for (const url of this.CANDIDATE_URLS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'POS-IPAY/2.5-Bridge',
          },
          body: JSON.stringify({
            phone: norm08 || rawClean,
            username: rawClean,
            password: password || undefined,
            store_name: requestedStoreName || undefined,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json().catch(() => null) as any;
          if (json && json.status === 'success' && json.is_member && json.user && json.credentials) {
            return this.applyMemberToPosTenant(json.user, json.credentials, password, json.password_valid);
          }
        }
      } catch {
        // Lanjut ke fallback SQLite direct
      }
    }

    // -------------------------------------------------------------
    // METODE 2: FALLBACK DIRECT SQLITE QUERY KE garudatel.db
    // -------------------------------------------------------------
    return this.discoverViaDirectSqlite(norm08, norm62, rawClean, password, requestedStoreName);
  }

  /**
   * Fallback membaca database garudatel.db langsung jika Flask service sedang restart
   */
  private static discoverViaDirectSqlite(
    norm08: string,
    norm62: string,
    rawClean: string,
    password?: string,
    requestedStoreName?: string
  ): IpayMemberSyncResult {
    let foundGPath: string | null = null;
    for (const p of this.GARUDA_DB_PATHS) {
      if (fs.existsSync(p)) {
        foundGPath = p;
        break;
      }
    }

    if (!foundGPath) {
      return { success: false, isMember: false, message: 'Koneksi ke server pusat ipay.my.id tidak tersedia' };
    }

    try {
      const Database = require('better-sqlite3');
      const gDb = new Database(foundGPath, { timeout: 5000 });

      // 1. Cari user di tabel user
      const lowerInput = rawClean.toLowerCase();
      const user = gDb.prepare(`
        SELECT id, name, phone, email, password_hash, balance, role, is_active
        FROM user
        WHERE phone = ? OR phone = ? OR phone = ?
           OR (email IS NOT NULL AND LOWER(email) = ?)
           OR LOWER(name) = ?
        LIMIT 1
      `).get(norm08, norm62, rawClean, lowerInput, lowerInput) as any;

      if (!user) {
        gDb.close();
        return { success: false, isMember: false, message: 'Bukan member ipay.my.id' };
      }

      // 2. Cek apakah sudah punya MerchantApiKey
      let mch = gDb.prepare(`
        SELECT id, user_id, merchant_id, api_key, secret_key, name, webhook_url, tenant_id, master_recovery_key, is_active
        FROM merchant_api_keys
        WHERE user_id = ?
        ORDER BY is_active DESC, id DESC
        LIMIT 1
      `).get(user.id) as any;

      let tenantId: string;
      let masterKey: string;

      if (!mch) {
        // Otomatis buatkan MerchantApiKey baru di garudatel.db!
        const rawHex = crypto.randomBytes(6).toString('hex').toUpperCase();
        masterKey = `RCV-${rawHex.slice(0, 4)}-${rawHex.slice(4, 8)}-${rawHex.slice(8, 12)}`;

        const mchId = `IPAY_MCH_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const apiKey = `IPAY_LIVE_${crypto.randomBytes(16).toString('hex')}`;
        const secKey = `SEC_${crypto.randomBytes(16).toString('hex')}`;

        const cleanName = requestedStoreName || user.name || `Konter ${user.phone}`;
        let baseSlug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        baseSlug = baseSlug.replace(/^pos-/, '') || `store-${user.id}`;

        const existingSlug = gDb.prepare("SELECT id FROM merchant_api_keys WHERE tenant_id = ?").get(baseSlug);
        if (existingSlug) {
          baseSlug = `${baseSlug}-${user.id}`;
        }
        tenantId = baseSlug;

        const webhookUrl = `https://ipaypos.my.id/api/ppob/webhook?tenant_id=${tenantId}`;

        try {
          gDb.prepare(`
            INSERT INTO merchant_api_keys (user_id, merchant_id, api_key, secret_key, name, webhook_url, is_active, tenant_id, master_recovery_key)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
          `).run(user.id, mchId, apiKey, secKey, cleanName, webhookUrl, tenantId, masterKey);
        } catch {
          // Jika kolom tenant_id belum ada, insert tanpa kolom tersebut
          gDb.prepare(`
            INSERT INTO merchant_api_keys (user_id, merchant_id, api_key, secret_key, name, webhook_url, is_active)
            VALUES (?, ?, ?, ?, ?, ?, 1)
          `).run(user.id, mchId, apiKey, secKey, cleanName, webhookUrl);
        }

        mch = {
          merchant_id: mchId,
          api_key: apiKey,
          secret_key: secKey,
          name: cleanName,
          tenant_id: tenantId,
          master_recovery_key: masterKey,
          is_active: 1,
        };
      } else {
        tenantId = (mch.tenant_id || '').trim();
        if (!tenantId) {
          tenantId = (mch.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/^pos-/, '') || `store-${mch.id}`;
          try { gDb.prepare("UPDATE merchant_api_keys SET tenant_id = ? WHERE id = ?").run(tenantId, mch.id); } catch {}
        }
        masterKey = mch.master_recovery_key || '';
        if (!masterKey) {
          const rawHex = crypto.randomBytes(6).toString('hex').toUpperCase();
          masterKey = `RCV-${rawHex.slice(0, 4)}-${rawHex.slice(4, 8)}-${rawHex.slice(8, 12)}`;
          try { gDb.prepare("UPDATE merchant_api_keys SET master_recovery_key = ? WHERE id = ?").run(masterKey, mch.id); } catch {}
        }
      }

      // Cek kecocokan password jika diinputkan
      let passwordValid: boolean | undefined = undefined;
      if (password) {
        passwordValid = this.verifyWerkzeugPassword(password, user.password_hash);
      }

      gDb.close();

      return this.applyMemberToPosTenant(
        {
          id: user.id,
          name: user.name,
          phone: user.phone || norm08,
          email: user.email,
          balance: Number(user.balance || 0),
          role: user.role || 'reseller',
        },
        {
          merchant_id: mch.merchant_id,
          api_key: mch.api_key,
          secret_key: mch.secret_key,
          tenant_id: tenantId,
          store_name: mch.name || requestedStoreName || user.name,
          master_recovery_key: masterKey,
        },
        password,
        passwordValid
      );
    } catch (err: any) {
      console.warn('[IpayMemberBridge] Direct SQLite query error:', err.message);
      return { success: false, isMember: false, message: err.message };
    }
  }

  /**
   * Memvalidasi format hash password Werkzeug (scrypt: atau pbkdf2:) secara native di Node.js
   */
  static verifyWerkzeugPassword(password: string, storedHash?: string): boolean {
    if (!password || !storedHash) return false;
    try {
      if (storedHash.startsWith('scrypt:')) {
        // Format: scrypt:N:r:p$salt$hash
        const parts = storedHash.split('$');
        if (parts.length < 3) return false;
        const meta = parts[0];
        const salt = parts[1];
        const hashHex = parts[2];
        const metaParts = meta.split(':');
        const N = parseInt(metaParts[1], 10);
        const r = parseInt(metaParts[2], 10);
        const p = parseInt(metaParts[3], 10);
        const keyLen = Buffer.from(hashHex, 'hex').length;
        const derived = crypto.scryptSync(password, salt, keyLen, { N, r, p, maxmem: 128 * 1024 * 1024 });
        return derived.toString('hex') === hashHex;
      }
      if (storedHash.startsWith('pbkdf2:')) {
        // Format: pbkdf2:sha256:iterations$salt$hash
        const parts = storedHash.split('$');
        if (parts.length < 3) return false;
        const meta = parts[0];
        const salt = parts[1];
        const hashHex = parts[2];
        const metaParts = meta.split(':');
        const iterations = parseInt(metaParts[2] || '1000', 10);
        const algo = metaParts[1] || 'sha256';
        const keyLen = Buffer.from(hashHex, 'hex').length;
        const derived = crypto.pbkdf2Sync(password, salt, iterations, keyLen, algo);
        return derived.toString('hex') === hashHex;
      }
    } catch {
      return false;
    }
    return false;
  }

  /**
   * Menginisialisasi database tenant POS dan langsung menyinkronkan saldo live PPOB
   */
  private static applyMemberToPosTenant(
    user: any,
    credentials: any,
    password?: string,
    passwordValid?: boolean
  ): IpayMemberSyncResult {
    try {
      const tenantId = sanitizeTenantId(credentials.tenant_id || `store-${user.id}`);
      const storeName = credentials.store_name || user.name || `Toko ${tenantId}`;
      const targetPhone = user.phone || '';
      const liveBalance = Number(user.balance || 0);

      // Inisialisasi file SQLite database tenant di /data/tenants/<tenantId>.db
      const targetDb = getTenantDatabase(tenantId, storeName);

      // 1. Pastikan user Owner siap di tabel users
      let ownerUser = targetDb.prepare("SELECT id, username, password, pin, phone FROM users WHERE role = 'owner' LIMIT 1").get() as any;
      if (!ownerUser) {
        ownerUser = targetDb.prepare("SELECT id, username, password, pin, phone FROM users ORDER BY id ASC LIMIT 1").get() as any;
      }

      // Jika user punya password valid saat login, gunakan password tersebut untuk akun POS
      const initialPass = (password && passwordValid === true)
        ? hashSecret(password)
        : hashSecret(crypto.randomBytes(16).toString('hex'));

      if (!ownerUser) {
        targetDb.prepare(`
          INSERT INTO users (username, password, name, role, pin, phone, is_active)
          VALUES ('owner', ?, ?, 'owner', NULL, ?, 1)
        `).run(initialPass, user.name, targetPhone);
      } else {
        targetDb.prepare(`
          UPDATE users 
          SET name = ?, phone = ?, is_active = 1
          WHERE id = ?
        `).run(user.name, targetPhone, ownerUser.id);
        if (password && passwordValid === true) {
          targetDb.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashSecret(password), ownerUser.id);
        }
      }

      // 2. Simpan Kredensial Live PPOB di tabel settings
      const upsert = targetDb.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
      upsert.run('store_name', storeName);
      upsert.run('store_phone', targetPhone);
      upsert.run('tenant_id', tenantId);
      upsert.run('ipay_merchant_id', credentials.merchant_id);
      upsert.run('ipay_api_key', credentials.api_key);
      upsert.run('ipay_secret_key', credentials.secret_key);
      upsert.run('ipay_mode', 'live');
      upsert.run('ipay_provision_status', 'APPROVED');
      upsert.run('ipay_base_url', 'https://ipay.my.id');
      if (credentials.master_recovery_key) {
        upsert.run('recovery_key', credentials.master_recovery_key);
        upsert.run('store_recovery_key', credentials.master_recovery_key);
      }
      upsert.run('is_ipay_member_sync', '1');
      upsert.run('ipay_member_id', String(user.id));
      upsert.run('ipay_member_role', String(user.role || 'reseller'));

      // 3. SINKRONISASI SALDO LIVE KE AKUN COA 1-1003 (Kas/Saldo PPOB)
      try {
        targetDb.prepare(`
          INSERT OR IGNORE INTO chart_of_accounts (code, name, type, normal_balance, balance)
          VALUES ('1-1003', 'Deposit Saldo PPOB (ipay.my.id)', 'ASSET', 'DEBIT', 0)
        `).run();
        targetDb.prepare(`
          UPDATE chart_of_accounts 
          SET balance = ? 
          WHERE code = '1-1003'
        `).run(liveBalance);
      } catch (err: any) {
        console.warn('[IpayMemberBridge] Error updating COA 1-1003:', err.message);
      }

      console.log(`[IpayMemberBridge] ✓ Member ipay.my.id berhasil di-onboard: ${user.name} (${targetPhone}) -> Toko '${storeName}' [${tenantId}]. Saldo PPOB Tersinkron: Rp ${liveBalance.toLocaleString('id-ID')}`);

      return {
        success: true,
        isMember: true,
        tenantId,
        storeName,
        userName: user.name,
        phone: targetPhone,
        balance: liveBalance,
        role: user.role,
        passwordValid,
        message: `Member ipay.my.id berhasil disinkronkan ke Toko "${storeName}" dengan saldo Rp ${liveBalance.toLocaleString('id-ID')}.`,
      };
    } catch (err: any) {
      console.error('[IpayMemberBridge] Error applying member to POS tenant:', err);
      return { success: false, isMember: true, message: err.message };
    }
  }
}
