import crypto from 'crypto';
import { defaultDb } from '../db/tenant';
import { PPOBService } from './ppob';

// Ensure whatsapp_otp_codes table exists in defaultDb
try {
  defaultDb.exec(`
    CREATE TABLE IF NOT EXISTS whatsapp_otp_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      action TEXT NOT NULL,
      otp_code TEXT NOT NULL,
      tenant_id TEXT DEFAULT 'default',
      attempts INTEGER NOT NULL DEFAULT 0,
      is_used INTEGER NOT NULL DEFAULT 0,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_wa_otp_phone_action ON whatsapp_otp_codes(phone, action, is_used);
  `);
} catch (err) {
  console.error('[WhatsAppOtpService] Table init warning:', err);
}

// In-memory brute-force rate limiter
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const rateLimitStore = new Map<string, RateLimitBucket>();

export function checkAuthRateLimit(
  key: string,
  maxAttempts = 5,
  windowMs = 3 * 60 * 1000
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const bucket = rateLimitStore.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (bucket.count >= maxAttempts) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return { allowed: false, retryAfterSec };
  }
  bucket.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

export function resetAuthRateLimit(key: string) {
  rateLimitStore.delete(key);
}

/**
 * Normalize Indonesian phone number to standard 08xxx format (and provide 628xxx variant)
 */
export function normalizePhone(raw: string | undefined | null): string {
  if (!raw) return '';
  let digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('628')) {
    digits = '0' + digits.slice(2);
  } else if (digits.startsWith('6208')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('8') && digits.length >= 9) {
    digits = '0' + digits;
  }
  return digits;
}

export function getPhoneVariants(raw: string | undefined | null): string[] {
  const norm = normalizePhone(raw);
  if (!norm) return [];
  const intl = norm.startsWith('0') ? '62' + norm.slice(1) : norm;
  const plusIntl = '+' + intl;
  return Array.from(new Set([norm, intl, plusIntl, String(raw || '').trim()])).filter(Boolean);
}

export function maskPhone(raw: string): string {
  const norm = normalizePhone(raw);
  if (norm.length < 7) return norm || '***';
  return `${norm.slice(0, 4)}****${norm.slice(-3)}`;
}

export type WaOtpAction = 'login' | 'register' | 'reset_password' | 'reset_pin';

export class WhatsAppOtpService {
  private static getCandidateBaseUrls(): string[] {
    let configuredBase = 'https://ipay.my.id';
    try {
      configuredBase = PPOBService.getConfig().baseUrl.replace(/\/+$/, '') || 'https://ipay.my.id';
    } catch {}
    return Array.from(new Set(['http://127.0.0.1:5000', configuredBase]));
  }

  /**
   * Check connection status of Baileys WhatsApp Bot on ipay.my.id
   */
  static async getBotStatus(): Promise<{ connected: boolean }> {
    for (const base of this.getCandidateBaseUrls()) {
      try {
        const res = await fetch(`${base}/api/v1/whatsapp/status`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 POS-IPAY/2.0',
          },
        });
        if (res.ok) {
          const data = await res.json().catch(() => null) as any;
          if (data && typeof data.connected === 'boolean') {
            return { connected: data.connected };
          }
        }
      } catch {}
    }
    return { connected: false };
  }

  /**
   * Send free-form WhatsApp message via ipay.my.id Baileys bridge
   */
  static async sendMessage(phone: string, message: string): Promise<{ sent: boolean; message: string }> {
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 8) {
      return { sent: false, message: 'Nomor WhatsApp tidak valid' };
    }

    for (const base of this.getCandidateBaseUrls()) {
      try {
        const res = await fetch(`${base}/api/v1/whatsapp/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 POS-IPAY/2.0',
          },
          body: JSON.stringify({
            phone: cleanPhone,
            message,
          }),
        });
        const data = await res.json().catch(() => null) as any;
        if (res.ok && data && (data.status === 'success' || data.sent === true)) {
          return {
            sent: true,
            message: data.message || 'Pesan WhatsApp berhasil dikirim',
          };
        }
      } catch {}
    }

    return { sent: false, message: 'Gagal mengirim pesan WhatsApp ke server ipay.my.id' };
  }

  /**
   * Generate & Send 6-Digit OTP via ipay.my.id All-in-One OTP Bridge (/api/v1/otp/send)
   * Includes auto-fallback to Admin Telegram on ipay.my.id if Baileys is disconnected
   */
  static async sendOtp(params: {
    phone: string;
    action: WaOtpAction;
    storeName?: string;
    tenantId?: string;
  }): Promise<{
    success: boolean;
    sent: boolean;
    waConnected: boolean;
    maskedPhone: string;
    expiresIn: number;
    message: string;
  }> {
    const cleanPhone = normalizePhone(params.phone);
    if (!cleanPhone || cleanPhone.length < 8) {
      return {
        success: false,
        sent: false,
        waConnected: false,
        maskedPhone: '',
        expiresIn: 0,
        message: 'Nomor WhatsApp tidak valid (minimal 8 digit angka)',
      };
    }

    // Rate limit OTP sending per phone: max 4 requests per 2 minutes
    const rl = checkAuthRateLimit(`otp_send:${cleanPhone}`, 4, 2 * 60 * 1000);
    if (!rl.allowed) {
      return {
        success: false,
        sent: false,
        waConnected: false,
        maskedPhone: maskPhone(cleanPhone),
        expiresIn: 0,
        message: `Terlalu banyak permintaan OTP. Silakan tunggu ${rl.retryAfterSec} detik lagi.`,
      };
    }

    // Generate cryptographically random 6-digit OTP
    const generatedOtp = crypto.randomInt(100000, 999999).toString();
    const storeTitle = (params.storeName || 'POS iPay Cloud').trim();
    const expiresInSec = 600; // 10 minutes
    const expiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();

    let finalOtpCode = generatedOtp;
    let sentViaBridge = false;
    let waConnected = true;
    let bridgeMessage = 'Kode OTP 6-digit berhasil dikirim ke WhatsApp Anda.';

    // 1. Primary: Call POST /api/v1/otp/send on ipay.my.id
    for (const base of this.getCandidateBaseUrls()) {
      try {
        const res = await fetch(`${base}/api/v1/otp/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 POS-IPAY/2.0',
          },
          body: JSON.stringify({
            phone: cleanPhone,
            action: params.action,
            store_name: storeTitle,
            otp_code: generatedOtp,
          }),
        });
        const data = await res.json().catch(() => null) as any;
        if (res.ok && data && (data.status === 'success' || data.sent === true)) {
          sentViaBridge = true;
          waConnected = data.wa_connected !== false;
          if (data.otp_code && /^\d{4,8}$/.test(String(data.otp_code))) {
            finalOtpCode = String(data.otp_code).trim();
          }
          if (data.message) {
            bridgeMessage = data.message;
          }
          break;
        }
      } catch {}
    }

    // 2. Fallback: Call POST /api/v1/whatsapp/send if /api/v1/otp/send was unreachable
    if (!sentViaBridge) {
      const actionLabel =
        params.action === 'register'
          ? 'PENDAFTARAN TOKO BARU'
          : params.action === 'reset_password'
          ? 'RESET KATA SANDI'
          : params.action === 'reset_pin'
          ? 'RESET PIN KEAMANAN'
          : 'LOGIN KASIR POS';

      const msgText =
        `*[${storeTitle.toUpperCase()} - KODE OTP]*\n\n` +
        `Permintaan: *${actionLabel}*\n` +
        `Kode OTP Anda: *${finalOtpCode}*\n\n` +
        `_Berlaku selama 10 menit. Jangan berikan kode ini kepada siapa pun._`;

      const fallbackSend = await this.sendMessage(cleanPhone, msgText);
      if (fallbackSend.sent) {
        sentViaBridge = true;
        waConnected = true;
        bridgeMessage = 'Kode OTP 6-digit telah dikirim ke nomor WhatsApp Anda.';
      }
    }

    // Invalidate previous unused OTPs for this phone + action, then store the new OTP locally
    try {
      defaultDb.prepare(`
        UPDATE whatsapp_otp_codes SET is_used = 1
        WHERE phone = ? AND action = ? AND is_used = 0
      `).run(cleanPhone, params.action);

      defaultDb.prepare(`
        INSERT INTO whatsapp_otp_codes (phone, action, otp_code, tenant_id, attempts, is_used, expires_at)
        VALUES (?, ?, ?, ?, 0, 0, ?)
      `).run(cleanPhone, params.action, finalOtpCode, params.tenantId || 'default', expiresAt);
    } catch (dbErr) {
      console.error('[WhatsAppOtpService] Failed to save OTP locally:', dbErr);
    }

    if (!sentViaBridge) {
      return {
        success: false,
        sent: false,
        waConnected: false,
        maskedPhone: maskPhone(cleanPhone),
        expiresIn: 0,
        message: 'Gagal menghubungi Bot WhatsApp ipay.my.id. Pastikan nomor WA benar atau gunakan metode Password + PIN.',
      };
    }

    return {
      success: true,
      sent: true,
      waConnected,
      maskedPhone: maskPhone(cleanPhone),
      expiresIn: expiresInSec,
      message: bridgeMessage,
    };
  }

  /**
   * Verify 6-Digit OTP against local database (with brute-force protection) and ipay.my.id /api/v1/otp/verify
   */
  static async verifyOtp(params: {
    phone: string;
    otpCode: string;
    action: WaOtpAction;
  }): Promise<{ valid: boolean; error?: string }> {
    const cleanPhone = normalizePhone(params.phone);
    const cleanOtp = String(params.otpCode || '').trim();

    if (!cleanPhone || !/^\d{4,8}$/.test(cleanOtp)) {
      return { valid: false, error: 'Kode OTP harus berupa 6 digit angka' };
    }

    const rl = checkAuthRateLimit(`otp_verify:${cleanPhone}`, 6, 3 * 60 * 1000);
    if (!rl.allowed) {
      return {
        valid: false,
        error: `Terlalu banyak percobaan OTP salah. Tunggu ${rl.retryAfterSec} detik atau minta kode OTP baru.`,
      };
    }

    // 1. Check local database record
    const localRecord = defaultDb.prepare(`
      SELECT id, otp_code, attempts, expires_at, is_used
      FROM whatsapp_otp_codes
      WHERE phone = ? AND action = ? AND is_used = 0
      ORDER BY id DESC LIMIT 1
    `).get(cleanPhone, params.action) as any;

    if (localRecord) {
      if (localRecord.attempts >= 5) {
        defaultDb.prepare('UPDATE whatsapp_otp_codes SET is_used = 1 WHERE id = ?').run(localRecord.id);
        return { valid: false, error: 'Kode OTP ini telah hangus karena terlalu banyak percobaan salah. Silakan kirim ulang OTP.' };
      }

      if (new Date(localRecord.expires_at).getTime() < Date.now()) {
        defaultDb.prepare('UPDATE whatsapp_otp_codes SET is_used = 1 WHERE id = ?').run(localRecord.id);
        return { valid: false, error: 'Kode OTP telah kedaluwarsa (lebih dari 10 menit). Silakan kirim ulang OTP.' };
      }

      if (localRecord.otp_code === cleanOtp) {
        defaultDb.prepare('UPDATE whatsapp_otp_codes SET is_used = 1 WHERE id = ?').run(localRecord.id);
        resetAuthRateLimit(`otp_verify:${cleanPhone}`);
        return { valid: true };
      } else {
        defaultDb.prepare('UPDATE whatsapp_otp_codes SET attempts = attempts + 1 WHERE id = ?').run(localRecord.id);
      }
    }

    // 2. Also check upstream ipay.my.id /api/v1/otp/verify (in case OTP was generated/retrieved via Admin Telegram /otp)
    for (const base of this.getCandidateBaseUrls()) {
      try {
        const res = await fetch(`${base}/api/v1/otp/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 POS-IPAY/2.0',
          },
          body: JSON.stringify({
            phone: cleanPhone,
            otp_code: cleanOtp,
            action: params.action,
          }),
        });
        const data = await res.json().catch(() => null) as any;
        if (res.ok && data && (data.valid === true || data.status === 'success')) {
          if (localRecord) {
            defaultDb.prepare('UPDATE whatsapp_otp_codes SET is_used = 1 WHERE id = ?').run(localRecord.id);
          }
          resetAuthRateLimit(`otp_verify:${cleanPhone}`);
          return { valid: true };
        }
      } catch {}
    }

    return { valid: false, error: 'Kode OTP WhatsApp tidak cocok atau sudah kedaluwarsa' };
  }
}
