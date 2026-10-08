import assert from 'assert';
import http from 'http';
import express from 'express';
import { apiRouter } from '../routes/api';
import { tenantMiddleware } from '../middleware/tenant';
import { defaultDb, getTenantDatabase } from '../db/tenant';

const app = express();
app.use(express.json());
app.use(tenantMiddleware);
app.use('/api', apiRouter);

const server = http.createServer(app);

async function request(options: {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: any;
}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const port = (server.address() as any).port;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: options.path,
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode || 200, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  console.log(`[Test Suite] Server test aktif di port ${port}`);

  try {
    console.log('\n--- 1. Test GET /api/tenant/list ---');
    const resList = await request({ method: 'GET', path: '/api/tenant/list' });
    assert.strictEqual(resList.status, 200);
    assert(Array.isArray(resList.body.tenants));
    console.log(`✓ Daftar tenant berhasil dimuat: ${resList.body.tenants.length} tenant ditemukan`);

    console.log('\n--- 2. Test POST /api/auth/login-step1 & OTP Generation ---');
    const resStep1 = await request({
      method: 'POST',
      path: '/api/auth/login-step1',
      body: {
        tenantId: 'default',
        username: 'owner',
        password: 'admin123',
      },
    });
    assert.strictEqual(resStep1.status, 200);
    assert.strictEqual(resStep1.body.success, true);
    assert.strictEqual(resStep1.body.requiresOtp, true);
    assert(resStep1.body.tempSessionToken);
    assert(resStep1.body.devOtp);
    console.log(`✓ Step 1 login sukses: OTP = ${resStep1.body.devOtp}, token sesi terbit`);

    console.log('\n--- 3. Test POST /api/auth/login-verify-otp (Salah OTP vs Benar) ---');
    const resWrongOtp = await request({
      method: 'POST',
      path: '/api/auth/login-verify-otp',
      body: {
        tempSessionToken: resStep1.body.tempSessionToken,
        otpCode: '000000',
      },
    });
    assert.strictEqual(resWrongOtp.status, 400);
    console.log(`✓ Proteksi OTP salah berhasil menolak akses: ${resWrongOtp.body.error}`);

    const resCorrectOtp = await request({
      method: 'POST',
      path: '/api/auth/login-verify-otp',
      body: {
        tempSessionToken: resStep1.body.tempSessionToken,
        otpCode: resStep1.body.devOtp,
      },
    });
    assert.strictEqual(resCorrectOtp.status, 200);
    assert.strictEqual(resCorrectOtp.body.success, true);
    assert(resCorrectOtp.body.token);
    assert.strictEqual(resCorrectOtp.body.user.role, 'owner');
    console.log(`✓ Verifikasi OTP benar berhasil terbit token JWT Bearer`);

    const ownerToken = resCorrectOtp.body.token;

    console.log('\n--- 4. Test Registrasi Toko Baru Mandiri (Self-Service) ---');
    const testStoreName = `Toko Mandiri Test ${Date.now()}`;
    const testEmail = `mitra_${Date.now()}@testpos.com`;

    const resRegOtp = await request({
      method: 'POST',
      path: '/api/auth/register-send-otp',
      body: {
        storeName: testStoreName,
        ownerName: 'Budi Test Owner',
        email: testEmail,
      },
    });
    assert.strictEqual(resRegOtp.status, 200);
    assert.strictEqual(resRegOtp.body.success, true);
    assert(resRegOtp.body.devOtp);
    console.log(`✓ OTP pendaftaran toko terkirim: ${resRegOtp.body.devOtp}`);

    const resRegComplete = await request({
      method: 'POST',
      path: '/api/auth/register-complete',
      body: {
        storeName: testStoreName,
        ownerName: 'Budi Test Owner',
        email: testEmail,
        password: 'password123',
        otpCode: resRegOtp.body.devOtp,
      },
    });
    assert.strictEqual(resRegComplete.status, 200);
    assert.strictEqual(resRegComplete.body.success, true);
    assert(resRegComplete.body.tenantId);
    assert(resRegComplete.body.token);
    const newTenantId = resRegComplete.body.tenantId;
    console.log(`✓ Toko baru berhasil dibuat: Tenant ID = ${newTenantId}, storeName = ${testStoreName}`);

    console.log('\n--- 5. Test Lupa Password (Forgot Password via OTP) ---');
    const resForgotOtp = await request({
      method: 'POST',
      path: '/api/auth/forgot-password',
      body: {
        tenantId: newTenantId,
        email: testEmail,
      },
    });
    assert.strictEqual(resForgotOtp.status, 200);
    assert.strictEqual(resForgotOtp.body.success, true);
    assert(resForgotOtp.body.devOtp);
    console.log(`✓ OTP reset kata sandi terkirim: ${resForgotOtp.body.devOtp}`);

    const resReset = await request({
      method: 'POST',
      path: '/api/auth/reset-password',
      body: {
        tenantId: newTenantId,
        email: testEmail,
        otpCode: resForgotOtp.body.devOtp,
        newPassword: 'newpassword456',
      },
    });
    assert.strictEqual(resReset.status, 200);
    assert.strictEqual(resReset.body.success, true);
    console.log(`✓ Kata sandi berhasil direset via OTP`);

    // Coba login dengan password baru
    const resLoginNewPass = await request({
      method: 'POST',
      path: '/api/auth/login-step1',
      body: {
        tenantId: newTenantId,
        username: testEmail,
        password: 'newpassword456',
      },
    });
    assert.strictEqual(resLoginNewPass.status, 200);
    assert.strictEqual(resLoginNewPass.body.success, true);
    console.log(`✓ Login berhasil menggunakan kata sandi baru pasca reset`);

    console.log('\n--- 6. Test Ubah Kata Sandi di Pengaturan Toko (/api/auth/change-password) ---');
    const resChangePass = await request({
      method: 'POST',
      path: '/api/auth/change-password',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
      body: {
        oldPassword: 'admin123',
        newPassword: 'adminSuperSecret2026',
      },
    });
    assert.strictEqual(resChangePass.status, 200);
    assert.strictEqual(resChangePass.body.success, true);
    console.log(`✓ Kata sandi owner berhasil diubah via menu pengaturan`);

    // Kembalikan kata sandi owner ke admin123 agar test-test lainnya tetap bekerja normal
    await request({
      method: 'POST',
      path: '/api/auth/change-password',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
      body: {
        oldPassword: 'adminSuperSecret2026',
        newPassword: 'admin123',
      },
    });

    console.log('\n======================================================');
    console.log('SEMUA PENGUJIAN AUTENTIKASI MANDIRI & OTP 100% SUKSES!');
    console.log('======================================================\n');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('[TEST FAILURE]:', err);
  process.exit(1);
});
