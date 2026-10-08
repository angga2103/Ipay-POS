import assert from 'assert';
import http from 'http';
import express from 'express';
import { apiRouter } from '../routes/api';
import { tenantMiddleware } from '../middleware/tenant';

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

    console.log('\n--- 2. Test POST /api/auth/login-step1 (Password Check & PIN Session) ---');
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
    assert.strictEqual(resStep1.body.requiresPin, true);
    assert(resStep1.body.tempSessionToken);
    console.log(`✓ Step 1 login sukses: Password valid, sesi verifikasi PIN terbit`);

    console.log('\n--- 3. Test POST /api/auth/login-verify-pin (Salah PIN vs Benar) ---');
    const resWrongPin = await request({
      method: 'POST',
      path: '/api/auth/login-verify-pin',
      body: {
        tempSessionToken: resStep1.body.tempSessionToken,
        pin: '999999',
      },
    });
    // Jika user default punya PIN, status 401. Jika belum ada PIN, first input becomes the PIN.
    let ownerToken: string;
    if (resWrongPin.status === 401) {
      console.log(`✓ Proteksi PIN salah berhasil menolak akses: ${resWrongPin.body.error}`);
      // Default seed user PIN is '112233'
      const resCorrectPin = await request({
        method: 'POST',
        path: '/api/auth/login-verify-pin',
        body: {
          tempSessionToken: resStep1.body.tempSessionToken,
          pin: '112233',
        },
      });
      assert.strictEqual(resCorrectPin.status, 200);
      assert.strictEqual(resCorrectPin.body.success, true);
      assert(resCorrectPin.body.token);
      ownerToken = resCorrectPin.body.token;
      console.log(`✓ Verifikasi PIN benar berhasil terbit token JWT Bearer`);
    } else {
      assert.strictEqual(resWrongPin.status, 200);
      ownerToken = resWrongPin.body.token;
      console.log(`✓ Inisialisasi PIN pertama kali berhasil`);
    }

    console.log('\n--- 4. Test Registrasi Toko Baru Mandiri (Skema 1: Password + 6-Digit PIN) ---');
    const testStoreName = `Toko Mandiri Test ${Date.now()}`;
    const testPhone = '081298765432';
    const testPassword = 'password123';
    const testPin = '654321';

    const resRegDirect = await request({
      method: 'POST',
      path: '/api/auth/register-store',
      body: {
        storeName: testStoreName,
        ownerName: 'Budi Test Owner',
        phone: testPhone,
        password: testPassword,
        pin: testPin,
      },
    });
    assert.strictEqual(resRegDirect.status, 200);
    assert.strictEqual(resRegDirect.body.success, true);
    assert(resRegDirect.body.tenantId);
    assert(resRegDirect.body.token);
    assert(resRegDirect.body.recoveryKey);
    assert(resRegDirect.body.recoveryKey.startsWith('RCV-'));

    const newTenantId = resRegDirect.body.tenantId;
    const issuedRecoveryKey = resRegDirect.body.recoveryKey;
    const newOwnerToken = resRegDirect.body.token;
    console.log(`✓ Toko baru berhasil dibuat: Tenant ID = ${newTenantId}, storeName = ${testStoreName}`);
    console.log(`✓ Master Recovery Key diterbitkan: ${issuedRecoveryKey}`);

    console.log('\n--- 5. Test 2-Step Login Toko Baru (Password -> PIN) ---');
    const resNewStep1 = await request({
      method: 'POST',
      path: '/api/auth/login-step1',
      body: {
        tenantId: newTenantId,
        username: 'owner',
        password: testPassword,
      },
    });
    assert.strictEqual(resNewStep1.status, 200);
    assert.strictEqual(resNewNewStep1RequiresPin(resNewStep1), true);

    const resNewWrongPin = await request({
      method: 'POST',
      path: '/api/auth/login-verify-pin',
      body: {
        tempSessionToken: resNewStep1.body.tempSessionToken,
        pin: '111111',
      },
    });
    assert.strictEqual(resNewWrongPin.status, 401);
    console.log(`✓ Salah PIN ditolak: ${resNewWrongPin.body.error}`);

    const resNewCorrectPin = await request({
      method: 'POST',
      path: '/api/auth/login-verify-pin',
      body: {
        tempSessionToken: resNewStep1.body.tempSessionToken,
        pin: testPin,
      },
    });
    assert.strictEqual(resNewCorrectPin.status, 200);
    assert.strictEqual(resNewCorrectPin.body.success, true);
    console.log(`✓ Login 2-lapis toko baru berhasil 100%!`);

    console.log('\n--- 6. Test Pemulihan Lupa Password via 6-Digit PIN ---');
    const resResetPass = await request({
      method: 'POST',
      path: '/api/auth/recover-password-with-pin',
      body: {
        tenantId: newTenantId,
        username: 'owner',
        pin: testPin,
        newPassword: 'newpassword456',
      },
    });
    assert.strictEqual(resResetPass.status, 200);
    assert.strictEqual(resResetPass.body.success, true);
    console.log(`✓ Kata sandi berhasil diperbarui menggunakan 6-Digit PIN`);

    // Verifikasi password baru dapat digunakan untuk login step 1
    const resCheckNewPass = await request({
      method: 'POST',
      path: '/api/auth/login-step1',
      body: {
        tenantId: newTenantId,
        username: 'owner',
        password: 'newpassword456',
      },
    });
    assert.strictEqual(resCheckNewPass.status, 200);
    assert.strictEqual(resCheckNewPass.body.success, true);
    console.log(`✓ Login step 1 berhasil menggunakan kata sandi baru pasca pemulihan PIN`);

    console.log('\n--- 7. Test Pemulihan Lupa PIN via Kata Sandi Akun ---');
    const resResetPin = await request({
      method: 'POST',
      path: '/api/auth/recover-pin-with-password',
      body: {
        tenantId: newTenantId,
        username: 'owner',
        password: 'newpassword456',
        newPin: '987654',
      },
    });
    assert.strictEqual(resResetPin.status, 200);
    assert.strictEqual(resResetPin.body.success, true);
    console.log(`✓ PIN berhasil diperbarui menggunakan kata sandi akun`);

    console.log('\n--- 8. Test Pemulihan Darurat via Master Recovery Key (RCV-...) ---');
    const resEmergencyReset = await request({
      method: 'POST',
      path: '/api/auth/recover-with-key',
      body: {
        tenantId: newTenantId,
        recoveryKey: issuedRecoveryKey,
        newPassword: 'emergencySuperPassword123',
        newPin: '888999',
      },
    });
    assert.strictEqual(resEmergencyReset.status, 200);
    assert.strictEqual(resEmergencyReset.body.success, true);
    assert(resEmergencyReset.body.newRecoveryKey);
    const updatedRecoveryKey = resEmergencyReset.body.newRecoveryKey;
    console.log(`✓ Pemulihan darurat akun toko via Master Recovery Key berhasil! Kunci baru dirotasi: ${updatedRecoveryKey}`);

    console.log('\n--- 9. Test Ubah PIN & Akses Recovery Info di Pengaturan Toko ---');
    const resRecoveryInfo = await request({
      method: 'GET',
      path: '/api/auth/recovery-info',
      headers: {
        Authorization: `Bearer ${newOwnerToken}`,
        'x-tenant-id': newTenantId,
      },
    });
    assert.strictEqual(resRecoveryInfo.status, 200);
    assert.strictEqual(resRecoveryInfo.body.recoveryKey, updatedRecoveryKey);
    console.log(`✓ Owner berhasil melihat Master Recovery Key terbaru di panel pengaturan`);

    console.log('\n================================================================');
    console.log('SEMUA PENGUJIAN SKEMA 1 (PASSWORD + PIN + RECOVERY) 100% SUKSES!');
    console.log('================================================================\n');
  } finally {
    server.close();
  }
}

function resNewNewStep1RequiresPin(res: any): boolean {
  return res.body.requiresPin === true;
}

runTests().catch((err) => {
  console.error('[TEST FAILURE]:', err);
  process.exit(1);
});
