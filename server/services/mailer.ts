import nodemailer from 'nodemailer';

export interface SendOtpOptions {
  to: string;
  otpCode: string;
  purpose: 'LOGIN' | 'REGISTER' | 'RESET_PASSWORD';
  storeName?: string;
  userName?: string;
  smtpConfig?: {
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
    from?: string;
    secure?: boolean;
  };
}

export interface MailerResult {
  success: boolean;
  simulated: boolean;
  error?: string;
}

export class MailerService {
  /**
   * Mendapatkan transporter SMTP berdasarkan environment variables atau parameter
   */
  private static getTransporter(customConfig?: SendOtpOptions['smtpConfig']) {
    const host = customConfig?.host || process.env.SMTP_HOST;
    const port = customConfig?.port || (process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587);
    const user = customConfig?.user || process.env.SMTP_USER;
    const pass = customConfig?.pass || process.env.SMTP_PASS;
    const secure = customConfig?.secure !== undefined ? customConfig.secure : (port === 465);

    if (!host || !user || !pass) {
      return null;
    }

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  /**
   * Mengirim email kode OTP (Login, Registrasi, Reset Password)
   * Dilengkapi fallback otomatis ke mode simulasi cerdas jika SMTP belum dikonfigurasi.
   */
  static async sendOtpEmail(options: SendOtpOptions): Promise<MailerResult> {
    const { to, otpCode, purpose, storeName = 'POS iPay Cloud', userName = 'Rekan Mitra', smtpConfig } = options;

    const transporter = this.getTransporter(smtpConfig);
    const senderFrom = smtpConfig?.from || process.env.SMTP_FROM || `"POS iPay Cloud" <noreply@ipay.my.id>`;

    let subject = '';
    let headline = '';
    let description = '';

    switch (purpose) {
      case 'LOGIN':
        subject = `[${otpCode}] Kode OTP Masuk Kasir - ${storeName}`;
        headline = 'Verifikasi Masuk Kasir';
        description = `Kami mendeteksi permintaan masuk ke akun Anda di toko <strong>${escapeHtml(storeName)}</strong>. Gunakan kode verifikasi 6 digit berikut:`;
        break;
      case 'REGISTER':
        subject = `[${otpCode}] Kode Verifikasi Pendaftaran Toko - ${storeName}`;
        headline = 'Pendaftaran Toko Baru';
        description = `Terima kasih telah mendaftarkan toko <strong>${escapeHtml(storeName)}</strong> di POS iPay. Silakan masukkan kode verifikasi berikut untuk menyelesaikan pendaftaran toko Anda:`;
        break;
      case 'RESET_PASSWORD':
        subject = `[${otpCode}] Kode Reset Kata Sandi - ${storeName}`;
        headline = 'Permintaan Reset Kata Sandi';
        description = `Kami menerima permintaan untuk menyetel ulang kata sandi akun Anda di toko <strong>${escapeHtml(storeName)}</strong>. Gunakan kode OTP berikut:`;
        break;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 24px; color: #334155; }
          .container { max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.15); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 32px 24px; text-align: center; color: #ffffff; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
          .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.9; }
          .content { padding: 32px 28px; text-align: center; }
          .badge { display: inline-block; padding: 6px 14px; background-color: #eff6ff; color: #2563eb; font-weight: 700; font-size: 12px; border-radius: 9999px; margin-bottom: 16px; }
          .desc { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px; text-align: left; }
          .otp-box { background: #f8fafc; border: 2px dashed #3b82f6; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
          .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1e3a8a; display: inline-block; }
          .expiry-note { font-size: 12px; color: #64748b; margin-top: 8px; }
          .warning-box { background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; text-align: left; border-radius: 6px; font-size: 12px; color: #991b1b; line-height: 1.5; margin-bottom: 24px; }
          .footer { background-color: #f8fafc; padding: 20px 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>POS iPay Cloud</h1>
            <p>Sistem Kasir Ritel & PPOB Terpadu</p>
          </div>
          <div class="content">
            <span class="badge">${headline}</span>
            <p class="desc">
              Halo <strong>${escapeHtml(userName)}</strong>,<br><br>
              ${description}
            </p>
            <div class="otp-box">
              <div class="otp-code">${otpCode}</div>
              <div class="expiry-note">Berlaku selama 10 menit</div>
            </div>
            <div class="warning-box">
              <strong>PENTING:</strong> Jangan berikan kode OTP ini kepada siapa pun, termasuk staf atau pihak yang mengaku dari POS iPay.
            </div>
          </div>
          <div class="footer">
            Email ini dikirim otomatis oleh sistem keamanan POS iPay.<br>
            Toko: ${escapeHtml(storeName)} &bull; &copy; 2026 POS iPay Cloud
          </div>
        </div>
      </body>
      </html>
    `;

    // Jika SMTP Transporter belum ada, gunakan mode simulasi cerdas
    if (!transporter) {
      console.log(`\n======================================================`);
      console.log(`[MailerService] [MODE SIMULASI / OFFLINE - SMTP BELUM DIKONFIGURASI]`);
      console.log(`Tujuan     : ${to}`);
      console.log(`Tujuan Nama: ${userName}`);
      console.log(`Toko       : ${storeName}`);
      console.log(`Keperluan  : ${purpose}`);
      console.log(`>>> KODE OTP: ${otpCode} <<<`);
      console.log(`======================================================\n`);
      return { success: true, simulated: true };
    }

    try {
      await transporter.sendMail({
        from: senderFrom,
        to,
        subject,
        html: htmlContent,
      });
      console.log(`[MailerService] Email OTP berhasil terkirim ke ${to} (${purpose})`);
      return { success: true, simulated: false };
    } catch (err: any) {
      console.error(`[MailerService] Gagal mengirim email ke ${to}:`, err.message);
      // Fallback ke simulasi agar pengguna tidak terblokir
      console.log(`[MailerService Fallback] Kode OTP untuk ${to}: ${otpCode}`);
      return { success: true, simulated: true, error: err.message };
    }
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
