import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import db from '../db/database';
import { getTenantDatabase, tenantContext } from '../db/tenant';
import { createAuthToken, verifySecret } from '../utils/auth-token';
import { AccountingService } from '../services/accounting';
import { PPOBService } from '../services/ppob';
import { InventoryService } from '../services/inventory';
import { ShiftService } from '../services/shift';
import { ThermalPrinterService } from '../services/printer';
import { ServiceDeskService } from '../services/service-desk';
import { BackupService } from '../services/backup';

export const apiRouter = Router();

// Ensure held_bills table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS held_bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    customer_name TEXT,
    cart_json TEXT NOT NULL,
    total_amount REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ============================================================
// 1. AUTH & USERS & RBAC OPERATOR MANAGEMENT
// ============================================================
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT id, username, password, name, role, pin, is_active FROM users WHERE username = ?').get(username) as any;
  if (!user || !verifySecret(password, user.password)) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }
  if (user.is_active === 0) {
    return res.status(403).json({ error: 'Akun operator ini telah dinonaktifkan oleh Administrator' });
  }
  const tenantId = req.tenantId || 'default';
  const token = createAuthToken({ tenantId, userId: user.id, username: user.username, role: user.role });
  res.json({ token, tenantId, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
});

apiRouter.post('/auth/login-pin', (req: Request, res: Response) => {
  const { pin } = req.body;
  const allUsers = db.prepare('SELECT id, username, name, role, pin, is_active FROM users').all() as any[];
  const user = allUsers.find(u => verifySecret(pin, u.pin));
  if (!user) {
    return res.status(401).json({ error: 'PIN tidak terdaftar' });
  }
  if (user.is_active === 0) {
    return res.status(403).json({ error: 'Akun operator ini telah dinonaktifkan oleh Administrator' });
  }
  const tenantId = req.tenantId || 'default';
  const token = createAuthToken({ tenantId, userId: user.id, username: user.username, role: user.role });
  res.json({ token, tenantId, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
});

apiRouter.post('/auth/verify-pin', (req: Request, res: Response) => {
  const { pin } = req.body;
  const supervisors = db.prepare("SELECT id, name, role, pin FROM users WHERE role IN ('owner', 'supervisor')").all() as any[];
  const supervisor = supervisors.find(s => verifySecret(pin, s.pin));
  if (!supervisor) {
    return res.status(403).json({ success: false, error: 'PIN Otorisasi Supervisor salah' });
  }
  res.json({ success: true, user: { id: supervisor.id, name: supervisor.name, role: supervisor.role } });
});

// Verifikasi PIN / Password sebelum beralih operator (mencegah kasir klik owner langsung)
apiRouter.post('/auth/switch-user-verify', (req: Request, res: Response) => {
  const { userId, secret } = req.body;
  if (!userId || !secret) {
    return res.status(400).json({ success: false, error: 'User ID dan PIN/Password wajib diisi' });
  }
  const user = db.prepare('SELECT id, username, password, name, role, pin, is_active FROM users WHERE id = ?').get(userId) as any;
  if (!user) {
    return res.status(404).json({ success: false, error: 'Operator tidak ditemukan' });
  }
  if (user.is_active === 0) {
    return res.status(403).json({ success: false, error: 'Akun operator ini sedang dinonaktifkan' });
  }

  const isPassValid = verifySecret(secret, user.password);
  const isPinValid = user.pin ? verifySecret(secret, user.pin) : false;
  if (!isPassValid && !isPinValid) {
    return res.status(401).json({ success: false, error: 'PIN atau Password tidak sesuai untuk operator ini' });
  }

  const tenantId = req.tenantId || 'default';
  const token = createAuthToken({ tenantId, userId: user.id, username: user.username, role: user.role });
  res.json({
    success: true,
    token,
    tenantId,
    user: { id: user.id, username: user.username, name: user.name, role: user.role },
  });
});

// Daftar Seluruh Operator Toko
apiRouter.get('/users', (_req: Request, res: Response) => {
  const users = db.prepare(`
    SELECT id, username, name, role, is_active, created_at,
           CASE WHEN pin IS NOT NULL AND pin != '' THEN 1 ELSE 0 END as has_pin
    FROM users
    ORDER BY id ASC
  `).all();
  res.json(users);
});

// Tambah Akun Operator Baru (Admin / Owner Only)
apiRouter.post('/users', (req: Request, res: Response) => {
  try {
    const { username, password, name, role, pin } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Username, password, dan nama wajib diisi' });
    }
    const cleanRole = ['owner', 'supervisor', 'cashier'].includes(role) ? role : 'cashier';
    const cleanUsername = username.trim().toLowerCase();

    const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(cleanUsername);
    if (existing) {
      return res.status(400).json({ error: `Username "${username}" sudah digunakan operator lain` });
    }

    const { hashSecret } = require('../utils/auth-token');
    const resInsert = db.prepare(`
      INSERT INTO users (username, password, name, role, pin, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(
      cleanUsername,
      hashSecret(password),
      name.trim(),
      cleanRole,
      pin ? hashSecret(String(pin).trim()) : null
    );

    res.json({
      success: true,
      id: resInsert.lastInsertRowid,
      message: `Operator ${name} (${cleanRole}) berhasil didaftarkan`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Edit Akun Operator
apiRouter.put('/users/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, role, password, pin, is_active } = req.body;
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!existing) return res.status(404).json({ error: 'Operator tidak ditemukan' });

    const newName = name ? name.trim() : existing.name;
    const newRole = role && ['owner', 'supervisor', 'cashier'].includes(role) ? role : existing.role;

    const { hashSecret } = require('../utils/auth-token');
    const newPassword = password ? hashSecret(password) : existing.password;
    const newPin = pin !== undefined ? (pin ? hashSecret(String(pin).trim()) : null) : existing.pin;
    const newIsActive = is_active !== undefined ? (is_active ? 1 : 0) : (existing.is_active ?? 1);

    db.prepare(`
      UPDATE users
      SET name = ?, role = ?, password = ?, pin = ?, is_active = ?
      WHERE id = ?
    `).run(newName, newRole, newPassword, newPin, newIsActive, id);

    res.json({ success: true, message: `Data operator ${newName} berhasil diperbarui` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Hapus Akun Operator (Proteksi Owner)
apiRouter.delete('/users/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!existing) return res.status(404).json({ error: 'Operator tidak ditemukan' });

    if (existing.role === 'owner') {
      const ownerCount = (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'owner'").get() as any).c;
      if (ownerCount <= 1) {
        return res.status(400).json({ error: 'Tidak dapat menghapus Owner utama satu-satunya dari sistem' });
      }
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ success: true, message: `Operator ${existing.name} berhasil dihapus` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 1.1 GARUDATEL SSO & MULTI-TENANT MANAGEMENT
// ============================================================
apiRouter.post('/auth/sso-exchange', async (req: Request, res: Response) => {
  try {
    const { sso_code, base_url } = req.body;
    if (!sso_code) {
      return res.status(400).json({ success: false, error: 'Kode tiket SSO tidak diberikan' });
    }

    const garudaBaseUrl = (base_url || 'https://ipay.my.id').replace(/\/+$/, '');
    const exchangeUrl = `${garudaBaseUrl}/api/v1/auth/sso/exchange`;

    const exRes = await fetch(exchangeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sso_code }),
    });

    const exData = await exRes.json() as any;
    if (!exRes.ok || exData.status !== 'success' || !exData.data) {
      return res.status(401).json({ success: false, error: exData.message || 'Tiket SSO tidak valid atau sudah kedaluwarsa' });
    }

    const { merchant_id, api_key, secret_key, name, phone } = exData.data;
    const storeName = name ? `KONTER ${name.toUpperCase()}` : `KONTER ${merchant_id}`;
    const tenantDb = getTenantDatabase(merchant_id, storeName);

    // Konfigurasi otomatis PPOB & pengaturan toko di database tenant
    const insertSetting = tenantDb.prepare(`
      INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
    `);
    insertSetting.run('ipay_api_key', api_key);
    insertSetting.run('ipay_merchant_id', merchant_id);
    insertSetting.run('ipay_secret_key', secret_key);
    insertSetting.run('ipay_mode', 'live');
    insertSetting.run('ipay_base_url', garudaBaseUrl);
    insertSetting.run('store_name', storeName);
    if (phone) insertSetting.run('store_phone', phone);

    let ownerUser = tenantDb.prepare("SELECT id, username, name, role FROM users WHERE role = 'owner' LIMIT 1").get() as any;
    if (!ownerUser) {
      tenantDb.prepare(`
        INSERT INTO users (username, password, name, role, pin)
        VALUES ('owner', 'admin123', ?, 'owner', '112233')
      `).run(name || 'Pemilik Toko');
      ownerUser = tenantDb.prepare("SELECT id, username, name, role FROM users WHERE role = 'owner' LIMIT 1").get() as any;
    } else if (name) {
      tenantDb.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, ownerUser.id);
      ownerUser.name = name;
    }

    const token = createAuthToken({
      tenantId: merchant_id,
      userId: ownerUser.id,
      username: ownerUser.username,
      role: ownerUser.role,
    });

    // Auto-sync saldo awal
    try {
      tenantContext.run({ tenantId: merchant_id, db: tenantDb }, async () => {
        await PPOBService.getBalance();
      });
    } catch {}

    res.json({
      success: true,
      token,
      tenantId: merchant_id,
      user: {
        id: ownerUser.id,
        username: ownerUser.username,
        name: ownerUser.name,
        role: ownerUser.role,
      },
      storeName,
      message: 'Berhasil login melalui SSO GarudaTel',
    });
  } catch (err: any) {
    console.error('[SSO Exchange Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/auth/garudatel-sso', (req: Request, res: Response) => {
  try {
    const { merchant_id, api_key, secret_key, name, phone, timestamp, signature, base_url } = req.body;

    if (!merchant_id || !secret_key || !signature || !timestamp) {
      return res.status(400).json({ success: false, error: 'Parameter SSO tidak lengkap' });
    }

    // 1. Verifikasi MD5 Signature: MD5(merchant_id + secret_key + timestamp)
    const expectedSign = crypto.createHash('md5').update(`${merchant_id}${secret_key}${timestamp}`).digest('hex').toLowerCase();
    if (signature.toLowerCase() !== expectedSign) {
      return res.status(403).json({ success: false, error: 'Signature SSO GarudaTel tidak valid' });
    }

    // 2. Periksa toleransi waktu timestamp (maksimal 15 menit)
    const nowSec = Math.floor(Date.now() / 1000);
    const tsSec = parseInt(timestamp, 10);
    if (Math.abs(nowSec - tsSec) > 900) {
      return res.status(403).json({ success: false, error: 'Token SSO telah kedaluwarsa. Silakan refresh halaman GarudaTel.' });
    }

    // 3. Pastikan database tenant terinisialisasi
    const storeName = name ? `KONTER ${name.toUpperCase()}` : `KONTER ${merchant_id}`;
    const tenantDb = getTenantDatabase(merchant_id, storeName);

    // 4. Konfigurasi otomatis PPOB & pengaturan toko di database tenant
    const insertSetting = tenantDb.prepare(`
      INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
    `);
    insertSetting.run('ipay_api_key', api_key);
    insertSetting.run('ipay_merchant_id', merchant_id);
    insertSetting.run('ipay_secret_key', secret_key);
    insertSetting.run('ipay_mode', 'live');
    insertSetting.run('ipay_base_url', base_url || 'https://ipay.my.id');
    insertSetting.run('store_name', storeName);
    if (phone) insertSetting.run('store_phone', phone);

    // 5. Pastikan akun pemilik (owner) siap di database tenant
    let ownerUser = tenantDb.prepare("SELECT id, username, name, role FROM users WHERE role = 'owner' LIMIT 1").get() as any;
    if (!ownerUser) {
      tenantDb.prepare(`
        INSERT INTO users (username, password, name, role, pin)
        VALUES ('owner', 'admin123', ?, 'owner', '112233')
      `).run(name || 'Pemilik Toko');
      ownerUser = tenantDb.prepare("SELECT id, username, name, role FROM users WHERE role = 'owner' LIMIT 1").get() as any;
    } else if (name) {
      tenantDb.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, ownerUser.id);
      ownerUser.name = name;
    }

    const token = createAuthToken({
      tenantId: merchant_id,
      userId: ownerUser.id,
      username: ownerUser.username,
      role: ownerUser.role,
    });

    // Auto-sync saldo awal ke akun 1-1003
    try {
      tenantContext.run({ tenantId: merchant_id, db: tenantDb }, async () => {
        await PPOBService.getBalance();
      });
    } catch {}

    res.json({
      success: true,
      token,
      tenantId: merchant_id,
      user: {
        id: ownerUser.id,
        username: ownerUser.username,
        name: ownerUser.name,
        role: ownerUser.role,
      },
      storeName,
      message: 'Berhasil login melalui SSO GarudaTel',
    });
  } catch (err: any) {
    console.error('[SSO Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get('/tenant/info', (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId || 'default';
    const rowName = db.prepare("SELECT value FROM settings WHERE key = 'store_name'").get() as any;
    const rowMerchant = db.prepare("SELECT value FROM settings WHERE key = 'ipay_merchant_id'").get() as any;
    res.json({
      tenantId,
      storeName: rowName?.value || `KONTER ${tenantId.toUpperCase()}`,
      merchantId: rowMerchant?.value || '',
      isMultiTenant: true,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 2. SHIFT MANAGEMENT
// ============================================================
apiRouter.get('/shifts/active', (req: Request, res: Response) => {
  const cashierId = req.query.cashierId ? parseInt(req.query.cashierId as string, 10) : undefined;
  const shift = ShiftService.getActiveShift(cashierId);
  res.json(shift || null);
});

apiRouter.post('/shifts/open', (req: Request, res: Response) => {
  try {
    const { cashierId, openingCash, pin } = req.body;
    if (!cashierId) {
      return res.status(400).json({ error: 'Operator kasir wajib dipilih' });
    }

    const user = db.prepare('SELECT id, username, name, role, pin, is_active FROM users WHERE id = ?').get(cashierId) as any;
    if (!user) {
      return res.status(404).json({ error: 'Operator tidak ditemukan' });
    }
    if (user.is_active === 0) {
      return res.status(403).json({ error: 'Akun operator ini sedang dinonaktifkan oleh Administrator' });
    }

    // Verifikasi PIN operator
    if (!pin) {
      return res.status(400).json({ error: 'PIN operator wajib dimasukkan untuk membuka sesi shift' });
    }
    const isPinValid = user.pin ? verifySecret(String(pin).trim(), user.pin) : false;
    if (!isPinValid) {
      return res.status(401).json({ error: 'PIN operator salah! Silakan periksa kembali 6-digit PIN akun Anda.' });
    }

    const shift = ShiftService.openShift(cashierId, parseFloat(openingCash) || 0);

    const tenantId = req.tenantId || 'default';
    const token = createAuthToken({ tenantId, userId: user.id, username: user.username, role: user.role });

    res.json({
      ...shift,
      user: { id: user.id, username: user.username, name: user.name, role: user.role },
      token,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/shifts/cash-movement', (req: Request, res: Response) => {
  try {
    const { shiftId, cashierId, type, amount, reason } = req.body;
    const result = ShiftService.addCashLog({
      shiftId: parseInt(shiftId, 10),
      cashierId: parseInt(cashierId, 10),
      type,
      amount: parseFloat(amount),
      reason,
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/shifts/:id/x-report', (req: Request, res: Response) => {
  try {
    const shiftId = parseInt(req.params.id as string, 10);
    const report = ShiftService.getXReport(shiftId);
    res.json(report);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

apiRouter.post('/shifts/:id/close', (req: Request, res: Response) => {
  try {
    const shiftId = parseInt(req.params.id as string, 10);
    const { actualCash, notes } = req.body;
    const zReport = ShiftService.closeShift(shiftId, parseFloat(actualCash), notes);
    res.json(zReport);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/shifts/history', (_req: Request, res: Response) => {
  const list = db.prepare(`
    SELECT s.*, u.name as cashier_name
    FROM shifts s
    JOIN users u ON s.cashier_id = u.id
    ORDER BY s.id DESC
    LIMIT 30
  `).all();
  res.json(list);
});

// ============================================================
// 3. PRODUCTS & INVENTORY
// ============================================================
apiRouter.get('/products/lookup', (req: Request, res: Response) => {
  const q = req.query.q as string;
  if (!q) return res.status(400).json({ error: 'Query parameter q is required' });
  const result = InventoryService.lookupProduct(q);
  if (!result) return res.status(404).json({ error: 'Produk tidak ditemukan' });
  res.json(result);
});

apiRouter.get('/products/search', (req: Request, res: Response) => {
  const q = (req.query.q as string) || '';
  const list = InventoryService.searchProducts(q);
  res.json(list);
});

apiRouter.get('/products', (_req: Request, res: Response) => {
  const products = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    ORDER BY p.name ASC
  `).all() as any[];

  const detailed = products.map(p => {
    const units = db.prepare('SELECT * FROM product_units WHERE product_id = ?').all(p.id);
    const tiers = db.prepare('SELECT * FROM product_tiers WHERE product_id = ? ORDER BY min_qty ASC').all(p.id);
    const batches = db.prepare('SELECT * FROM product_batches WHERE product_id = ? ORDER BY expiry_date ASC').all(p.id);
    return { ...p, units, tiers, batches };
  });

  res.json(detailed);
});

apiRouter.post('/products', (req: Request, res: Response) => {
  try {
    const { 
      sku, barcode, name, category_id, base_uom, 
      cost_price, selling_price, stock_quantity, min_stock_alert, 
      requires_imei, units, tiers 
    } = req.body;

    const tx = db.transaction(() => {
      const resInsert = db.prepare(`
        INSERT INTO products (sku, barcode, name, category_id, base_uom, cost_price, selling_price, stock_quantity, min_stock_alert, requires_imei)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sku,
        barcode,
        name,
        category_id || null,
        base_uom || 'Pcs',
        parseFloat(cost_price) || 0,
        parseFloat(selling_price) || 0,
        parseFloat(stock_quantity) || 0,
        parseFloat(min_stock_alert) || 5,
        requires_imei ? 1 : 0
      );

      const productId = resInsert.lastInsertRowid;

      if (Array.isArray(units)) {
        const insUnit = db.prepare(`
          INSERT INTO product_units (product_id, unit_name, conversion_factor, barcode, selling_price)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const u of units) {
          insUnit.run(productId, u.unit_name, parseFloat(u.conversion_factor), u.barcode || '', parseFloat(u.selling_price));
        }
      }

      if (Array.isArray(tiers)) {
        const insTier = db.prepare(`
          INSERT INTO product_tiers (product_id, min_qty, tier_price)
          VALUES (?, ?, ?)
        `);
        for (const t of tiers) {
          insTier.run(productId, parseFloat(t.min_qty), parseFloat(t.tier_price));
        }
      }

      return productId;
    });

    const id = tx();
    res.json({ success: true, id });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.put('/products/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { 
      barcode, name, category_id, base_uom, 
      cost_price, selling_price, stock_quantity, min_stock_alert, 
      requires_imei, units, tiers 
    } = req.body;

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE products
        SET barcode = ?, name = ?, category_id = ?, base_uom = ?, cost_price = ?, selling_price = ?, stock_quantity = ?, min_stock_alert = ?, requires_imei = ?
        WHERE id = ?
      `).run(
        barcode,
        name,
        category_id || null,
        base_uom,
        parseFloat(cost_price),
        parseFloat(selling_price),
        parseFloat(stock_quantity),
        parseFloat(min_stock_alert),
        requires_imei ? 1 : 0,
        id
      );

      if (Array.isArray(units)) {
        db.prepare('DELETE FROM product_units WHERE product_id = ?').run(id);
        const insUnit = db.prepare(`
          INSERT INTO product_units (product_id, unit_name, conversion_factor, barcode, selling_price)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const u of units) {
          insUnit.run(id, u.unit_name, parseFloat(u.conversion_factor), u.barcode || '', parseFloat(u.selling_price));
        }
      }

      if (Array.isArray(tiers)) {
        db.prepare('DELETE FROM product_tiers WHERE product_id = ?').run(id);
        const insTier = db.prepare(`
          INSERT INTO product_tiers (product_id, min_qty, tier_price)
          VALUES (?, ?, ?)
        `);
        for (const t of tiers) {
          insTier.run(id, parseFloat(t.min_qty), parseFloat(t.tier_price));
        }
      }
    });

    tx();
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/products/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const orderItemCount = (db.prepare('SELECT COUNT(*) as c FROM order_items WHERE product_id = ?').get(id) as any).c;
    if (orderItemCount > 0) {
      db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(id);
      return res.json({ success: true, message: 'Produk dinonaktifkan karena memiliki riwayat transaksi' });
    }

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM product_units WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM product_tiers WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM product_batches WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM products WHERE id = ?').run(id);
    });
    tx();
    res.json({ success: true, message: 'Produk berhasil dihapus' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/inventory/goods-receipt', (req: Request, res: Response) => {
  try {
    const { productId, receivedQty, unitCost, batchNumber, expiryDate, paymentMethod } = req.body;
    if (!productId || !receivedQty || !unitCost) {
      return res.status(400).json({ error: 'ID Produk, kuantitas, dan harga modal wajib diisi' });
    }

    const result = InventoryService.processGoodsReceipt({
      productId: parseInt(productId, 10),
      receivedQty: parseFloat(receivedQty),
      unitCost: parseFloat(unitCost),
      batchNumber,
      expiryDate,
    });

    const totalPurchase = parseFloat(receivedQty) * parseFloat(unitCost);
    const prod = db.prepare('SELECT name FROM products WHERE id = ?').get(productId) as any;
    const credAccount = paymentMethod === 'HUTANG' ? '2-1001' : '1-1001';

    AccountingService.createJournalEntry({
      reference_type: 'PURCHASE',
      reference_id: `GRN-${Date.now()}`,
      description: `Penerimaan Barang: ${prod?.name || 'Produk'} (${receivedQty} unit @ Rp ${parseFloat(unitCost).toLocaleString('id-ID')})`,
      lines: [
        {
          account_code: '1-1005',
          debit: totalPurchase,
          credit: 0,
          memo: `Tambah persediaan ${prod?.name}`,
        },
        {
          account_code: credAccount,
          debit: 0,
          credit: totalPurchase,
          memo: paymentMethod === 'HUTANG' ? 'Hutang dagang pembelian barang' : 'Pengeluaran kas pembelian stok barang',
        },
      ],
    });

    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/categories', (_req: Request, res: Response) => {
  const cats = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
  res.json(cats);
});

apiRouter.get('/inventory/batches/expiring', (req: Request, res: Response) => {
  const days = req.query.days ? parseInt(req.query.days as string, 10) : 90;
  const batches = InventoryService.getExpiringBatches(days);
  res.json(batches);
});

apiRouter.post('/inventory/stock-opname', (req: Request, res: Response) => {
  try {
    const { userId, notes, items } = req.body;
    const result = InventoryService.executeStockOpname({
      userId: parseInt(userId, 10),
      notes,
      items,
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/inventory/valuation', (_req: Request, res: Response) => {
  try {
    const summary = db.prepare(`
      SELECT 
        COUNT(*) as total_sku,
        COALESCE(SUM(stock_quantity), 0) as total_units,
        COALESCE(SUM(stock_quantity * cost_price), 0) as total_cost_value,
        COALESCE(SUM(stock_quantity * selling_price), 0) as total_retail_value,
        COALESCE(SUM(CASE WHEN stock_quantity <= min_stock_alert THEN 1 ELSE 0 END), 0) as low_stock_count
      FROM products
    `).get() as any;

    const categories = db.prepare(`
      SELECT 
        c.id, c.name, c.code,
        COUNT(p.id) as sku_count,
        COALESCE(SUM(p.stock_quantity), 0) as total_units,
        COALESCE(SUM(p.stock_quantity * p.cost_price), 0) as cost_value,
        COALESCE(SUM(p.stock_quantity * p.selling_price), 0) as retail_value
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id, c.name, c.code
      ORDER BY cost_value DESC
    `).all() as any[];

    const totalCost = summary.total_cost_value || 0;
    const totalRetail = summary.total_retail_value || 0;
    const potentialGrossProfit = totalRetail - totalCost;
    const potentialMarginPercent = totalRetail > 0 ? (potentialGrossProfit / totalRetail) * 100 : 0;

    res.json({
      summary: {
        total_sku: summary.total_sku,
        total_units: summary.total_units,
        total_cost_value: totalCost,
        total_retail_value: totalRetail,
        potential_gross_profit: potentialGrossProfit,
        potential_margin_percent: Math.round(potentialMarginPercent * 10) / 10,
        low_stock_count: summary.low_stock_count,
      },
      categories: categories.map(cat => ({
        ...cat,
        gross_profit: cat.retail_value - cat.cost_value,
        margin_percent: cat.retail_value > 0 ? Math.round(((cat.retail_value - cat.cost_value) / cat.retail_value) * 1000) / 10 : 0,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 4. PPOB ENGINE (ipay.my.id)
// ============================================================
apiRouter.get('/ppob/balance', async (_req: Request, res: Response) => {
  try {
    const data = await PPOBService.getBalance();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/ppob/products', (req: Request, res: Response) => {
  const { category, provider } = req.query;
  let query = 'SELECT * FROM ppob_products WHERE is_active = 1';
  const params: any[] = [];

  if (category) {
    query += ' AND category_code = ?';
    params.push(category);
  }

  if (provider) {
    query += ' AND provider_code = ?';
    params.push(provider);
  }

  query += ' ORDER BY provider_code ASC, base_price ASC';
  const products = db.prepare(query).all(...params);
  res.json(products);
});

apiRouter.post('/ppob/inquiry', async (req: Request, res: Response) => {
  try {
    const { sku, customer_no } = req.body;
    if (!sku || !customer_no) {
      return res.status(400).json({ error: 'SKU dan nomor pelanggan diperlukan' });
    }
    const result = await PPOBService.checkInquiry(sku, customer_no);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/ppob/purchase', async (req: Request, res: Response) => {
  try {
    const { sku, customer_no, customer_name, ref_id, force_status } = req.body;
    const result = await PPOBService.executePurchase({
      sku,
      customer_no,
      customer_name,
      ref_id: ref_id || `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      force_status,
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/ppob/webhook', (req: Request, res: Response) => {
  try {
    const result = PPOBService.handleWebhook(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/ppob/test-connection', async (_req: Request, res: Response) => {
  try {
    const result = await PPOBService.testConnection();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/ppob/markup-rules', (req: Request, res: Response) => {
  try {
    const { markupType, markupValue } = req.body;
    PPOBService.applyMarkupRules({
      globalMarkupType: markupType,
      globalMarkupValue: parseFloat(markupValue),
    });
    res.json({ success: true, message: 'Aturan markup harga berhasil diterapkan ke seluruh katalog PPOB' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/ppob/sync-catalog', async (_req: Request, res: Response) => {
  try {
    const result = await PPOBService.syncProductsFromIpay();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, message: err.message });
  }
});

apiRouter.post('/ppob/sync-status/:refId', async (req: Request, res: Response) => {
  try {
    const { refId } = req.params;
    const result = await PPOBService.syncTransactionStatus(refId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, message: err.message });
  }
});

apiRouter.post('/ppob/sync-pending', async (_req: Request, res: Response) => {
  try {
    const result = await PPOBService.syncAllPendingTransactions();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, message: err.message });
  }
});

apiRouter.get('/ppob/deposit/info', async (_req: Request, res: Response) => {
  try {
    const result = await PPOBService.getDepositInfo();
    // Ambil juga saldo lokal Akun 1-1003
    const acc = db.prepare("SELECT balance FROM chart_of_accounts WHERE code = '1-1003'").get() as any;
    res.json({
      ...result,
      ledgerBalance: acc ? acc.balance : 0,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, message: err.message });
  }
});

apiRouter.post('/ppob/deposit/create', async (req: Request, res: Response) => {
  try {
    const { amount, channel, sourceAccount, notes } = req.body;
    const result = await PPOBService.createDepositRequest({
      amount: parseFloat(amount),
      channel: channel || 'MANUAL',
      sourceAccount: sourceAccount || '1-1001',
      notes,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, message: err.message });
  }
});

apiRouter.post('/ppob/deposit/sync-ledger', async (_req: Request, res: Response) => {
  try {
    const result = await PPOBService.syncLedgerWithLiveBalance();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, message: err.message });
  }
});

apiRouter.get('/ppob/deposit/history', (_req: Request, res: Response) => {
  try {
    const history = PPOBService.getDepositHistory();
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/ppob/deposit/:refId/approve', async (req: Request, res: Response) => {
  try {
    const { refId } = req.params;
    const result = await PPOBService.approveDeposit(refId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/ppob/deposit/:refId/reject', (req: Request, res: Response) => {
  try {
    const { refId } = req.params;
    const { reason } = req.body;
    const result = PPOBService.rejectDeposit(refId, reason);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/ppob/deposit/:refId/sync-status', async (req: Request, res: Response) => {
  try {
    const { refId } = req.params;
    const result = await PPOBService.syncDepositTicketStatus(refId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.get('/ppob/transactions', async (_req: Request, res: Response) => {
  // Jalankan sync pending di background jika ada transaksi PENDING
  PPOBService.syncAllPendingTransactions().catch(() => {});

  const txs = db.prepare(`
    SELECT pt.*, p.product_name
    FROM ppob_transactions pt
    LEFT JOIN ppob_products p ON pt.sku_code = p.sku_code
    ORDER BY pt.id DESC
    LIMIT 50
  `).all();
  res.json(txs);
});

// ============================================================
// 5. ORDERS & UNIFIED CHECKOUT
// ============================================================
apiRouter.post('/orders', async (req: Request, res: Response) => {
  try {
    const {
      shift_id,
      cashier_id,
      customer_id,
      items,
      payment_method,
      cash_tendered,
      discount_amount,
      split_details,
      notes,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Keranjang belanja kosong' });
    }

    // Verify shift is open
    const shift = db.prepare("SELECT * FROM shifts WHERE id = ? AND status = 'OPEN'").get(shift_id) as any;
    if (!shift) {
      return res.status(400).json({ error: 'Shift kasir tidak aktif. Silakan buka shift terlebih dahulu.' });
    }

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countToday = (db.prepare("SELECT COUNT(*) as c FROM orders WHERE invoice_no LIKE ?").get(`INV/${todayStr}/%`) as any).c;
    const invoiceNo = `INV/${todayStr}/${String(countToday + 1).padStart(4, '0')}`;

    let totalRetail = 0;
    let totalRetailCost = 0;
    let totalPPOB = 0;
    let totalPPOBCost = 0;

    // Process PPOB digital purchases first (if any)
    const processedItems: any[] = [];

    for (const item of items) {
      if (item.item_type === 'RETAIL') {
        const prod = db.prepare('SELECT cost_price FROM products WHERE id = ?').get(item.product_id) as any;
        const cost = prod ? prod.cost_price * (item.conversion_factor || 1) : 0;
        const subtotal = item.quantity * item.unit_price;

        totalRetail += subtotal;
        totalRetailCost += item.quantity * cost;

        processedItems.push({
          ...item,
          cost_price: cost,
          subtotal,
          imei_sn: item.imei_sn || null,
        });
      } else if (item.item_type === 'PPOB') {
        const ppobProd = db.prepare('SELECT * FROM ppob_products WHERE sku_code = ?').get(item.ppob_sku) as any;
        if (!ppobProd) {
          throw new Error(`Produk PPOB ${item.ppob_sku} tidak valid`);
        }

        const refId = `REF-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

        // Execute PPOB purchase
        const ppobExec = await PPOBService.executePurchase({
          sku: item.ppob_sku,
          customer_no: item.ppob_target_no,
          customer_name: item.ppob_customer_name,
          ref_id: refId,
        });

        const subtotal = item.unit_price || ppobProd.selling_price;
        totalPPOB += subtotal;
        totalPPOBCost += ppobProd.base_price;

        processedItems.push({
          ...item,
          ppob_product_id: ppobProd.id,
          item_name: ppobProd.product_name,
          cost_price: ppobProd.base_price,
          unit_price: subtotal,
          subtotal,
          ppob_ref_id: refId,
          ppob_sn_token: ppobExec.sn_token,
          ppob_status: ppobExec.status,
        });
      }
    }

    const discount = parseFloat(discount_amount) || 0;
    const grandTotal = totalRetail + totalPPOB - discount;
    const tendered = parseFloat(cash_tendered) || grandTotal;
    const change = Math.max(0, tendered - grandTotal);

    // Save Order and Order Items atomically in Database
    const orderTransaction = db.transaction(() => {
      // 1. Deduct retail inventory
      for (const it of processedItems) {
        if (it.item_type === 'RETAIL') {
          InventoryService.deductStock(it.product_id, it.quantity, it.conversion_factor || 1);
        }
      }

      // 2. Insert Order
      const resOrder = db.prepare(`
        INSERT INTO orders (
          invoice_no, shift_id, cashier_id, customer_id, total_retail, total_ppob,
          discount_amount, grand_total, payment_method, cash_tendered, change_amount,
          split_details, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PAID', ?)
      `).run(
        invoiceNo,
        shift_id,
        cashier_id,
        customer_id || null,
        totalRetail,
        totalPPOB,
        discount,
        grandTotal,
        payment_method,
        tendered,
        change,
        split_details ? JSON.stringify(split_details) : null,
        notes || ''
      );

      const orderId = resOrder.lastInsertRowid;

      // 3. Insert Order Items
      const insItem = db.prepare(`
        INSERT INTO order_items (
          order_id, item_type, product_id, ppob_product_id, item_name, unit_name,
          conversion_factor, quantity, cost_price, unit_price, discount_amount,
          subtotal, ppob_target_no, ppob_customer_name, ppob_sn_token, ppob_ref_id, ppob_status, imei_sn
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const it of processedItems) {
        insItem.run(
          orderId,
          it.item_type,
          it.product_id || null,
          it.ppob_product_id || null,
          it.item_name,
          it.unit_name || null,
          it.conversion_factor || 1,
          it.quantity || 1,
          it.cost_price,
          it.unit_price,
          it.discount_amount || 0,
          it.subtotal,
          it.ppob_target_no || null,
          it.ppob_customer_name || null,
          it.ppob_sn_token || null,
          it.ppob_ref_id || null,
          it.ppob_status || null,
          it.imei_sn || null
        );

        // Link order_id in ppob_transactions if applicable
        if (it.ppob_ref_id) {
          db.prepare('UPDATE ppob_transactions SET order_id = ? WHERE ref_id = ?').run(orderId, it.ppob_ref_id);
        }
      }

      // 4. Update customer debt if payment_method is KASBON
      if (payment_method === 'KASBON' && customer_id) {
        db.prepare('UPDATE customers SET current_debt = current_debt + ? WHERE id = ?').run(grandTotal, customer_id);
      }

      // 5. AUTO-JOURNALING DOUBLE ENTRY!
      AccountingService.recordHybridSale({
        order_id: Number(orderId),
        invoice_no: invoiceNo,
        total_retail: totalRetail,
        total_retail_cost: totalRetailCost,
        total_ppob: totalPPOB,
        total_ppob_cost: totalPPOBCost,
        grand_total: grandTotal,
        discount_amount: discount,
        payment_method,
        cash_amount: payment_method === 'CASH' ? grandTotal : (split_details?.cash || 0),
        non_cash_amount: payment_method !== 'CASH' ? (split_details?.non_cash || grandTotal) : 0,
        customer_id,
      });

      return orderId;
    });

    const orderId = orderTransaction();

    // Fetch full order for response & receipt
    const order = db.prepare(`
      SELECT o.*, u.name as cashier_name, s.shift_number, c.name as customer_name
      FROM orders o
      JOIN users u ON o.cashier_id = u.id
      JOIN shifts s ON o.shift_id = s.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
    `).get(orderId) as any;

    const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];

    // Format thermal receipt
    const receiptText = ThermalPrinterService.formatReceiptText({
      order,
      items: orderItems,
    });

    res.json({
      success: true,
      order,
      items: orderItems,
      receiptText,
    });
  } catch (err: any) {
    console.error('Order checkout error:', err);
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/orders', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const orders = db.prepare(`
    SELECT o.*, u.name as cashier_name, s.shift_number, c.name as customer_name
    FROM orders o
    JOIN users u ON o.cashier_id = u.id
    JOIN shifts s ON o.shift_id = s.id
    LEFT JOIN customers c ON o.customer_id = c.id
    ORDER BY o.id DESC
    LIMIT ?
  `).all(limit) as any[];

  res.json(orders);
});

apiRouter.get('/orders/:id', (req: Request, res: Response) => {
  const orderId = parseInt(req.params.id as string, 10);
  const order = db.prepare(`
    SELECT o.*, u.name as cashier_name, s.shift_number, c.name as customer_name
    FROM orders o
    JOIN users u ON o.cashier_id = u.id
    JOIN shifts s ON o.shift_id = s.id
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE o.id = ?
  `).get(orderId) as any;

  if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
  const receiptText = ThermalPrinterService.formatReceiptText({ order, items: items as any });

  res.json({ order, items, receiptText });
});

// Void / Refund Order (Requires Supervisor PIN)
apiRouter.post('/orders/:id/void', (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.id as string, 10);
    const { supervisorPin, reason } = req.body;

    const supervisors = db.prepare("SELECT id, name, role, pin FROM users WHERE role IN ('owner', 'supervisor')").all() as any[];
    const supervisor = supervisors.find(s => verifySecret(supervisorPin, s.pin));
    if (!supervisor) {
      return res.status(403).json({ error: 'PIN Otorisasi Supervisor tidak valid' });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });
    if (order.status !== 'PAID') return res.status(400).json({ error: 'Hanya transaksi PAID yang dapat di-void' });

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];

    // Proteksi: Jangan izinkan void jika produk PPOB telah sukses terkirim ke pelanggan
    const hasSuccessfulPPOB = items.some(it => it.item_type === 'PPOB' && (it.ppob_status === 'SUCCESS' || it.ppob_status === 'SUKSES'));
    if (hasSuccessfulPPOB) {
      return res.status(400).json({
        error: 'Transaksi tidak dapat di-void karena produk PPOB telah berhasil terkirim ke nomor pelanggan.'
      });
    }

    const voidTransaction = db.transaction(() => {
      // 1. Restore retail stock
      for (const it of items) {
        if (it.item_type === 'RETAIL' && it.product_id) {
          db.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?')
            .run(it.quantity * (it.conversion_factor || 1), it.product_id);
        }
      }

      // 2. Mark order as VOID
      db.prepare(`
        UPDATE orders
        SET status = 'VOID', void_reason = ?, void_approved_by = ?
        WHERE id = ?
      `).run(reason || 'Dibatalkan kasir atas persetujuan supervisor', supervisor.id, orderId);

      // 3. Accounting Reversal Entry
      const lines: any[] = [];
      if (order.payment_method === 'CASH') {
        lines.push({ account_code: '1-1001', debit: 0, credit: order.grand_total, memo: `Refund kas laci void ${order.invoice_no}` });
      } else if (order.payment_method === 'KASBON') {
        lines.push({ account_code: '1-1004', debit: 0, credit: order.grand_total, memo: `Pembalik piutang kasbon void ${order.invoice_no}` });
        if (order.customer_id) {
          db.prepare('UPDATE customers SET current_debt = MAX(0, current_debt - ?) WHERE id = ?').run(order.grand_total, order.customer_id);
        }
      } else {
        lines.push({ account_code: '1-1002', debit: 0, credit: order.grand_total, memo: `Refund non-tunai void ${order.invoice_no}` });
      }

      // Pembalik diskon jika ada
      if (order.discount_amount > 0) {
        lines.push({ account_code: '4-1004', debit: 0, credit: order.discount_amount, memo: `Pembalik diskon void ${order.invoice_no}` });
      }

      // Hitung HPP aktual ritel dari order_items
      const actualRetailCost = items
        .filter(it => it.item_type === 'RETAIL')
        .reduce((sum, it) => sum + ((it.cost_price || 0) * (it.quantity || 1)), 0);

      if (order.total_retail > 0) {
        lines.push({ account_code: '4-1001', debit: order.total_retail, credit: 0, memo: `Pembatalan omzet ritel ${order.invoice_no}` });
        if (actualRetailCost > 0) {
          lines.push({ account_code: '1-1005', debit: actualRetailCost, credit: 0, memo: `Pengembalian stok ritel ${order.invoice_no}` });
          lines.push({ account_code: '5-1001', debit: 0, credit: actualRetailCost, memo: `Pembalikan HPP ritel ${order.invoice_no}` });
        }
      }

      if (order.total_ppob > 0) {
        lines.push({ account_code: '4-1002', debit: order.total_ppob, credit: 0, memo: `Pembatalan omzet PPOB ${order.invoice_no}` });
      }

      AccountingService.createJournalEntry({
        reference_type: 'SALE',
        reference_id: order.invoice_no,
        description: `Void Transaksi ${order.invoice_no} (${reason || 'Otorisasi Supervisor'})`,
        lines,
      });
    });

    voidTransaction();
    res.json({ success: true, message: `Transaksi ${order.invoice_no} berhasil dibatalkan (VOID)` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ============================================================
// 5.1 RETUR PENJUALAN (SALES RETURN)
// ============================================================
apiRouter.post('/returns', (req: Request, res: Response) => {
  try {
    const { order_id, items, refund_method, reason, cashier_id, shift_id } = req.body;
    if (!order_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order ID dan daftar barang retur wajib diisi' });
    }

    const order = db.prepare(`
      SELECT o.*, u.name as cashier_name, c.name as customer_name
      FROM orders o
      JOIN users u ON o.cashier_id = u.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
    `).get(order_id) as any;

    if (!order) return res.status(404).json({ error: 'Faktur penjualan tidak ditemukan' });
    if (order.status !== 'PAID') return res.status(400).json({ error: 'Hanya pesanan PAID yang dapat diretur' });

    const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order_id) as any[];
    const previousReturns = db.prepare(`
      SELECT sri.* FROM sales_return_items sri
      JOIN sales_returns sr ON sri.return_id = sr.id
      WHERE sr.order_id = ?
    `).all(order_id) as any[];

    // Hitung total retur dan validasi kuantitas
    let totalRefund = 0;
    const validatedItems: any[] = [];

    for (const retIt of items) {
      const orig = orderItems.find(oi => oi.id === retIt.order_item_id || oi.product_id === retIt.product_id);
      if (!orig) {
        return res.status(400).json({ error: `Barang dengan ID ${retIt.product_id || retIt.order_item_id} tidak terdapat dalam faktur ini` });
      }

      const alreadyReturned = previousReturns
        .filter(pr => pr.product_id === orig.product_id)
        .reduce((sum, pr) => sum + pr.quantity, 0);

      const maxReturnable = orig.quantity - alreadyReturned;
      const requestedQty = parseFloat(retIt.quantity) || 0;

      if (requestedQty <= 0) continue;
      if (requestedQty > maxReturnable) {
        return res.status(400).json({
          error: `Kuantitas retur "${orig.item_name}" (${requestedQty}) melebihi sisa pembelian yang dapat diretur (${maxReturnable})`
        });
      }

      const subtotalRefund = requestedQty * orig.unit_price;
      totalRefund += subtotalRefund;

      validatedItems.push({
        product_id: orig.product_id,
        item_name: orig.item_name,
        quantity: requestedQty,
        unit_price: orig.unit_price,
        subtotal: subtotalRefund,
        cost_price: orig.cost_price || 0,
        restock_inventory: retIt.restock_inventory !== undefined ? (retIt.restock_inventory ? 1 : 0) : 1,
      });
    }

    if (validatedItems.length === 0) {
      return res.status(400).json({ error: 'Tidak ada barang yang diretur' });
    }

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countToday = (db.prepare("SELECT COUNT(*) as c FROM sales_returns WHERE return_no LIKE ?").get(`RET-${todayStr}-%`) as any).c;
    const returnNo = `RET-${todayStr}-${String(countToday + 1).padStart(3, '0')}`;
    
    // Deteksi metode refund: jika dipilih KASBON_REDUCTION / STORE_CREDIT / KASBON, atau jika transaksi awal KASBON dan bukan tunai
    const isKasbonRefund = ['KASBON_REDUCTION', 'STORE_CREDIT', 'KASBON'].includes(refund_method) || (order.payment_method === 'KASBON' && refund_method !== 'CASH');
    const cleanRefundMethod = isKasbonRefund ? 'KASBON_REDUCTION' : 'CASH';

    let prevDebt = 0;
    let newDebt = 0;
    let custName = order.customer_name || '';

    db.transaction(() => {
      // 1. Insert sales_returns
      const resRet = db.prepare(`
        INSERT INTO sales_returns (
          return_no, order_id, invoice_no, customer_id, total_refund,
          refund_method, reason, cashier_id, shift_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        returnNo,
        order.id,
        order.invoice_no,
        order.customer_id || null,
        totalRefund,
        cleanRefundMethod,
        reason || 'Retur barang dari pelanggan',
        cashier_id || order.cashier_id,
        shift_id || order.shift_id
      );

      const returnId = resRet.lastInsertRowid;

      // 2. Insert return items and restock if selected
      let totalCostReversed = 0;
      const insRetItem = db.prepare(`
        INSERT INTO sales_return_items (
          return_id, product_id, item_name, quantity, unit_price, subtotal, cost_price, restock_inventory
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const vi of validatedItems) {
        insRetItem.run(
          returnId,
          vi.product_id,
          vi.item_name,
          vi.quantity,
          vi.unit_price,
          vi.subtotal,
          vi.cost_price,
          vi.restock_inventory
        );

        if (vi.restock_inventory === 1 && vi.product_id) {
          db.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?').run(vi.quantity, vi.product_id);
          totalCostReversed += (vi.cost_price * vi.quantity);
        }
      }

      // 3. Double-entry Journal Entry for Return (Debit 4-1001 Pendapatan Penjualan Ritel)
      const lines: any[] = [];
      lines.push({
        account_code: '4-1001',
        debit: totalRefund,
        credit: 0,
        memo: `Retur penjualan ${returnNo} (Faktur ${order.invoice_no})`,
      });

      if (cleanRefundMethod === 'CASH') {
        lines.push({
          account_code: '1-1001',
          debit: 0,
          credit: totalRefund,
          memo: `Pengembalian uang tunai retur ${returnNo}`,
        });

        if (shift_id) {
          AccountingService.recordCashMovement({
            type: 'CASH_OUT',
            amount: totalRefund,
            reason: `Pengembalian kas retur ${returnNo} (${order.invoice_no})`,
          });
        }
      } else {
        // Pemotongan Piutang Usaha Kasbon (Akun 1-1004)
        lines.push({
          account_code: '1-1004',
          debit: 0,
          credit: totalRefund,
          memo: `Pemotongan piutang kasbon retur ${returnNo}`,
        });

        if (order.customer_id) {
          const cust = db.prepare('SELECT id, name, current_debt FROM customers WHERE id = ?').get(order.customer_id) as any;
          if (cust) {
            custName = cust.name;
            prevDebt = cust.current_debt || 0;
            newDebt = Math.max(0, prevDebt - totalRefund);
            db.prepare('UPDATE customers SET current_debt = ? WHERE id = ?').run(newDebt, order.customer_id);
          }
        }
      }

      if (totalCostReversed > 0) {
        lines.push({
          account_code: '1-1005',
          debit: totalCostReversed,
          credit: 0,
          memo: `Pengembalian persediaan barang retur ${returnNo}`,
        });
        lines.push({
          account_code: '5-1001',
          debit: 0,
          credit: totalCostReversed,
          memo: `Pembalikan HPP barang retur ${returnNo}`,
        });
      }

      AccountingService.createJournalEntry({
        reference_type: 'RETURN',
        reference_id: returnNo,
        description: `Retur Penjualan ${returnNo} - Faktur ${order.invoice_no}`,
        lines,
      });
    })();

    const successMessage = cleanRefundMethod === 'KASBON_REDUCTION'
      ? (custName
        ? `Retur penjualan ${returnNo} BERHASIL! Hutang kasbon pelanggan ${custName} berkurang Rp ${totalRefund.toLocaleString('id-ID')} (Sisa hutang: Rp ${newDebt.toLocaleString('id-ID')}).`
        : `Retur penjualan ${returnNo} BERHASIL! Potong saldo kasbon sebesar Rp ${totalRefund.toLocaleString('id-ID')}.`)
      : `Retur penjualan ${returnNo} BERHASIL! Pengembalian dana tunai Rp ${totalRefund.toLocaleString('id-ID')} dicatat ke kas laci.`;

    const returnReceiptText = ThermalPrinterService.formatReturnReceiptText({
      return_no: returnNo,
      invoice_no: order.invoice_no,
      created_at: new Date().toISOString(),
      cashier_name: order.cashier_name,
      customer_name: order.customer_name,
      reason: reason || 'Retur barang',
      refund_method: cleanRefundMethod,
      total_refund: totalRefund,
      items: validatedItems,
    });

    res.json({
      success: true,
      return_no: returnNo,
      total_refund: totalRefund,
      refund_method: cleanRefundMethod,
      customer_name: custName,
      previous_debt: prevDebt,
      remaining_debt: newDebt,
      receiptText: returnReceiptText,
      message: successMessage,
    });
  } catch (err: any) {
    console.error('Sales return error:', err);
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/returns', (_req: Request, res: Response) => {
  try {
    const returns = db.prepare(`
      SELECT sr.*, u.name as cashier_name, c.name as customer_name
      FROM sales_returns sr
      LEFT JOIN users u ON sr.cashier_id = u.id
      LEFT JOIN customers c ON sr.customer_id = c.id
      ORDER BY sr.id DESC
      LIMIT 100
    `).all() as any[];

    const returnIds = returns.map(r => r.id);
    let itemsMap: Record<number, any[]> = {};
    if (returnIds.length > 0) {
      const allItems = db.prepare(`
        SELECT * FROM sales_return_items WHERE return_id IN (${returnIds.map(() => '?').join(',')})
      `).all(...returnIds) as any[];
      allItems.forEach(it => {
        if (!itemsMap[it.return_id]) itemsMap[it.return_id] = [];
        itemsMap[it.return_id].push(it);
      });
    }

    res.json(returns.map(r => ({ ...r, items: itemsMap[r.id] || [] })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/orders/:id/returns', (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.id as string, 10);
    const returns = db.prepare('SELECT * FROM sales_returns WHERE order_id = ? ORDER BY id DESC').all(orderId) as any[];
    res.json(returns);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 5.2 PENGELUARAN UMUM & PEMASUKAN LAIN-LAIN
// ============================================================
apiRouter.get('/operational-transactions', (req: Request, res: Response) => {
  try {
    const type = req.query.type as string;
    let query = `
      SELECT ot.*, u.name as cashier_name, s.shift_number
      FROM operational_transactions ot
      LEFT JOIN users u ON ot.cashier_id = u.id
      LEFT JOIN shifts s ON ot.shift_id = s.id
    `;
    const params: any[] = [];
    if (type && ['EXPENSE', 'INCOME'].includes(type)) {
      query += ' WHERE ot.type = ?';
      params.push(type);
    }
    query += ' ORDER BY ot.id DESC LIMIT 100';
    const txs = db.prepare(query).all(...params);
    res.json(txs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/operational-transactions', (req: Request, res: Response) => {
  try {
    const { type, category, description, amount, payment_source, cashier_id, shift_id } = req.body;
    const cleanAmount = parseFloat(amount);
    if (!cleanAmount || cleanAmount <= 0) {
      return res.status(400).json({ error: 'Nominal transaksi harus lebih dari 0' });
    }
    if (!category || !description) {
      return res.status(400).json({ error: 'Kategori dan keterangan transaksi wajib diisi' });
    }
    const cleanType = type === 'INCOME' ? 'INCOME' : 'EXPENSE';
    const cleanSource = payment_source === '1-1002' ? '1-1002' : '1-1001';

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = cleanType === 'EXPENSE' ? 'BBN' : 'PMS';
    const countToday = (db.prepare("SELECT COUNT(*) as c FROM operational_transactions WHERE tx_no LIKE ?").get(`${prefix}-${todayStr}-%`) as any).c;
    const txNo = `${prefix}-${todayStr}-${String(countToday + 1).padStart(3, '0')}`;

    db.transaction(() => {
      // 1. Insert record
      db.prepare(`
        INSERT INTO operational_transactions (
          tx_no, type, category, description, amount, payment_source, cashier_id, shift_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        txNo,
        cleanType,
        category.trim(),
        description.trim(),
        cleanAmount,
        cleanSource,
        cashier_id || null,
        shift_id || null
      );

      // 2. Double-entry Journal Entry
      if (cleanType === 'EXPENSE') {
        AccountingService.createJournalEntry({
          reference_type: 'EXPENSE',
          reference_id: txNo,
          description: `Pengeluaran [${category}]: ${description}`,
          lines: [
            {
              account_code: '5-1003',
              debit: cleanAmount,
              credit: 0,
              memo: `${category}: ${description}`,
            },
            {
              account_code: cleanSource,
              debit: 0,
              credit: cleanAmount,
              memo: `Pengeluaran kas/bank ${txNo}`,
            },
          ],
        });

        if (cleanSource === '1-1001' && shift_id) {
          AccountingService.recordCashMovement({
            type: 'CASH_OUT',
            amount: cleanAmount,
            reason: `[${category}] ${description}`,
          });
        }
      } else {
        AccountingService.createJournalEntry({
          reference_type: 'INCOME',
          reference_id: txNo,
          description: `Pemasukan [${category}]: ${description}`,
          lines: [
            {
              account_code: cleanSource,
              debit: cleanAmount,
              credit: 0,
              memo: `Penerimaan kas/bank ${txNo}`,
            },
            {
              account_code: '4-1003',
              debit: 0,
              credit: cleanAmount,
              memo: `${category}: ${description}`,
            },
          ],
        });

        if (cleanSource === '1-1001' && shift_id) {
          AccountingService.recordCashMovement({
            type: 'CASH_IN',
            amount: cleanAmount,
            reason: `[${category}] ${description}`,
          });
        }
      }
    })();

    res.json({
      success: true,
      tx_no: txNo,
      message: `${cleanType === 'EXPENSE' ? 'Pengeluaran' : 'Pemasukan'} berhasil dicatat dan masuk ke pembukuan.`,
    });
  } catch (err: any) {
    console.error('Operational transaction error:', err);
    res.status(400).json({ error: err.message });
  }
});

// ============================================================
// 5.3 ANALISIS & PERINGKAT (STOK LIMIT, PRODUK, PELANGGAN, SUPPLIER)
// ============================================================
apiRouter.get('/reports/analytics', (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || 'month';

    // 1. Stok Menipis / Limit
    const lowStock = db.prepare(`
      SELECT p.id, p.sku, p.barcode, p.name, p.stock_quantity, p.min_stock_alert,
             p.cost_price, p.selling_price, p.base_uom, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1 AND p.stock_quantity <= p.min_stock_alert
      ORDER BY p.stock_quantity ASC
      LIMIT 100
    `).all();

    // 2. Peringkat Penjualan Produk
    let dateFilter = '';
    if (period === 'day') {
      dateFilter = "AND date(o.created_at, 'localtime') = date('now', 'localtime')";
    } else if (period === 'month') {
      dateFilter = "AND strftime('%Y-%m', o.created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')";
    } else if (period === 'year') {
      dateFilter = "AND strftime('%Y', o.created_at, 'localtime') = strftime('%Y', 'now', 'localtime')";
    }

    const topProducts = db.prepare(`
      SELECT oi.item_name, p.sku, p.barcode,
             SUM(oi.quantity) as total_sold_qty,
             SUM(oi.subtotal) as total_revenue,
             SUM(oi.subtotal - (oi.cost_price * oi.quantity)) as gross_profit
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE o.status = 'PAID' ${dateFilter}
      GROUP BY oi.item_name
      ORDER BY total_sold_qty DESC
      LIMIT 50
    `).all();

    // 3. Peringkat Pelanggan
    const topCustomers = db.prepare(`
      SELECT c.id, c.name, c.phone, c.credit_limit, c.current_debt,
             COUNT(o.id) as total_transactions,
             COALESCE(SUM(o.grand_total), 0) as total_spent
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'PAID'
      WHERE c.is_active = 1
      GROUP BY c.id
      ORDER BY total_spent DESC, total_transactions DESC
      LIMIT 50
    `).all();

    // 4. Peringkat Supplier
    const topSuppliers = db.prepare(`
      SELECT s.id, s.name, s.phone, s.contact_person, s.current_debt,
             COUNT(po.id) as total_orders,
             COALESCE(SUM(po.total_amount), 0) as total_purchased
      FROM suppliers s
      LEFT JOIN purchase_orders po ON po.supplier_id = s.id AND po.status = 'RECEIVED'
      WHERE s.is_active = 1
      GROUP BY s.id
      ORDER BY total_purchased DESC, s.current_debt DESC
      LIMIT 50
    `).all();

    res.json({
      period,
      lowStock,
      topProducts,
      topCustomers,
      topSuppliers,
    });
  } catch (err: any) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 6. HOLD & RECALL BILLS (F8)
// ============================================================
apiRouter.get('/held-bills', (_req: Request, res: Response) => {
  const bills = db.prepare('SELECT * FROM held_bills ORDER BY id DESC').all() as any[];
  res.json(bills.map(b => ({ ...b, cart: JSON.parse(b.cart_json) })));
});

apiRouter.post('/held-bills', (req: Request, res: Response) => {
  try {
    const { label, customer_name, cart, total_amount } = req.body;
    const resInsert = db.prepare(`
      INSERT INTO held_bills (label, customer_name, cart_json, total_amount)
      VALUES (?, ?, ?, ?)
    `).run(
      label || `Antrean ${new Date().toLocaleTimeString('id-ID')}`,
      customer_name || '',
      JSON.stringify(cart),
      parseFloat(total_amount) || 0
    );
    res.json({ success: true, id: resInsert.lastInsertRowid });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/held-bills/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  db.prepare('DELETE FROM held_bills WHERE id = ?').run(id);
  res.json({ success: true });
});

// ============================================================
// 6B. CUSTOMER MANAGEMENT & KASBON (PIUTANG)
// ============================================================
apiRouter.get('/customers', (req: Request, res: Response) => {
  try {
    const q = ((req.query.q as string) || '').trim().toLowerCase();
    const showAll = req.query.showAll === 'true';

    let query = `
      SELECT c.*,
        (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) as total_orders,
        (SELECT COUNT(*) FROM customer_debt_payments p WHERE p.customer_id = c.id) as total_payments
      FROM customers c
      WHERE ${showAll ? '1=1' : 'COALESCE(c.is_active, 1) = 1'}
    `;
    const params: any[] = [];
    if (q) {
      query += ` AND (LOWER(c.name) LIKE ? OR c.phone LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }
    query += ` ORDER BY c.current_debt DESC, c.name ASC`;
    const customers = db.prepare(query).all(...params) as any[];

    const mapped = customers.map(c => {
      let status = 'LANCAR';
      if (c.current_debt > 0) {
        status = (c.credit_limit > 0 && c.current_debt > c.credit_limit) ? 'OVER_LIMIT' : 'KASBON_AKTIF';
      }
      return {
        ...c,
        status,
        remaining_credit: Math.max(0, (c.credit_limit || 0) - (c.current_debt || 0)),
      };
    });

    res.json(mapped);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/customers/:id', (req: Request, res: Response) => {
  try {
    const customerId = parseInt(req.params.id as string, 10);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any;
    if (!customer) {
      return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
    }

    const orders = db.prepare(`
      SELECT id, invoice_no, grand_total, payment_method, status, created_at
      FROM orders 
      WHERE customer_id = ?
      ORDER BY id DESC
      LIMIT 30
    `).all(customerId);

    const payments = db.prepare(`
      SELECT p.*, u.name as cashier_name
      FROM customer_debt_payments p
      LEFT JOIN users u ON p.cashier_id = u.id
      WHERE p.customer_id = ?
      ORDER BY p.id DESC
      LIMIT 30
    `).all(customerId);

    res.json({
      customer: {
        ...customer,
        remaining_credit: Math.max(0, (customer.credit_limit || 0) - (customer.current_debt || 0)),
      },
      orders,
      payments,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/customers', (req: Request, res: Response) => {
  try {
    const { name, phone, address, credit_limit } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nama pelanggan wajib diisi' });
    }

    const resInsert = db.prepare(`
      INSERT INTO customers (name, phone, address, credit_limit, current_debt, is_active)
      VALUES (?, ?, ?, ?, 0, 1)
    `).run(
      name.trim(),
      (phone || '').trim(),
      (address || '').trim(),
      parseFloat(credit_limit) || 0
    );

    const newCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(resInsert.lastInsertRowid);
    res.json({ success: true, customer: newCustomer });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.put('/customers/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { name, phone, address, credit_limit } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nama pelanggan wajib diisi' });
    }

    db.prepare(`
      UPDATE customers 
      SET name = ?, phone = ?, address = ?, credit_limit = ?
      WHERE id = ?
    `).run(
      name.trim(),
      (phone || '').trim(),
      (address || '').trim(),
      parseFloat(credit_limit) || 0,
      id
    );

    const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    res.json({ success: true, customer: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/customers/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as any;
    if (!cust) return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });

    if (cust.current_debt > 0) {
      return res.status(400).json({ 
        error: `Pelanggan "${cust.name}" masih memiliki sisa kasbon sebesar Rp ${cust.current_debt.toLocaleString('id-ID')}. Lunasi terlebih dahulu sebelum menghapus data!` 
      });
    }

    // Check if customer has orders or payments history
    const orderCount = (db.prepare('SELECT COUNT(*) as c FROM orders WHERE customer_id = ?').get(id) as any).c;
    const paymentCount = (db.prepare('SELECT COUNT(*) as c FROM customer_debt_payments WHERE customer_id = ?').get(id) as any).c;

    if (orderCount > 0 || paymentCount > 0) {
      // Soft-delete / deactivate to preserve historical audit trail & financial ledger integrity!
      db.prepare('UPDATE customers SET is_active = 0 WHERE id = ?').run(id);
      return res.json({ 
        success: true, 
        message: `Pelanggan "${cust.name}" dinonaktifkan (arsip tersimpan demi integritas audit pembukuan).` 
      });
    }

    // If completely brand new with no transactions, safe to hard delete
    db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    res.json({ success: true, message: `Data pelanggan "${cust.name}" berhasil dihapus` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/customers/:id/pay-debt', (req: Request, res: Response) => {
  try {
    const customerId = parseInt(req.params.id as string, 10);
    const { amount, payment_method, notes, cashier_id, shift_id } = req.body;

    const payAmount = parseFloat(amount);
    if (!payAmount || payAmount <= 0) {
      return res.status(400).json({ error: 'Nominal pembayaran harus lebih besar dari 0' });
    }

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any;
    if (!customer) {
      return res.status(404).json({ error: 'Pelanggan tidak ditemukan' });
    }

    if (customer.current_debt <= 0) {
      return res.status(400).json({ error: 'Pelanggan ini tidak memiliki saldo kasbon/hutang' });
    }

    if (payAmount > customer.current_debt) {
      return res.status(400).json({ 
        error: `Nominal pembayaran (Rp ${payAmount.toLocaleString('id-ID')}) melebihi total kasbon (Rp ${customer.current_debt.toLocaleString('id-ID')})` 
      });
    }

    const previousDebt = customer.current_debt;
    const remainingDebt = Math.max(0, previousDebt - payAmount);
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countPayments = (db.prepare("SELECT COUNT(*) as c FROM customer_debt_payments WHERE payment_no LIKE ?").get(`PAY-KBN/${todayStr}/%`) as any).c;
    const paymentNo = `PAY-KBN/${todayStr}/${String(countPayments + 1).padStart(4, '0')}`;

    const tx = db.transaction(() => {
      // 1. Insert into customer_debt_payments
      db.prepare(`
        INSERT INTO customer_debt_payments (
          payment_no, customer_id, amount, payment_method, notes, cashier_id, shift_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        paymentNo,
        customerId,
        payAmount,
        payment_method || 'CASH',
        notes || 'Pelunasan/Cicilan Kasbon',
        cashier_id || null,
        shift_id || null
      );

      // 2. Reduce customer debt
      db.prepare('UPDATE customers SET current_debt = ? WHERE id = ?').run(remainingDebt, customerId);

      // 3. Auto-journal double entry!
      AccountingService.recordDebtRepayment({
        payment_no: paymentNo,
        customer_id: customerId,
        customer_name: customer.name,
        amount: payAmount,
        payment_method: payment_method || 'CASH',
        notes: notes || `Pelunasan kasbon ${customer.name}`,
      });

      // 4. If paid in cash and during open shift, log cash movement to cashier drawer
      if ((payment_method === 'CASH' || !payment_method) && shift_id) {
        try {
          db.prepare(`
            INSERT INTO shift_cash_logs (shift_id, cashier_id, type, amount, reason)
            VALUES (?, ?, 'CASH_IN', ?, ?)
          `).run(
            shift_id,
            cashier_id || 1,
            payAmount,
            `Penerimaan pelunasan kasbon: ${customer.name} (${paymentNo})`
          );
          db.prepare(`
            UPDATE shifts 
            SET total_cash_in = total_cash_in + ?,
                expected_cash = expected_cash + ?
            WHERE id = ?
          `).run(payAmount, payAmount, shift_id);
        } catch (e) {
          console.warn('Could not log shift cash movement for debt payment:', e);
        }
      }
    });

    tx();

    let cashierName = 'Kasir';
    if (cashier_id) {
      const u = db.prepare('SELECT name FROM users WHERE id = ?').get(cashier_id) as any;
      if (u) cashierName = u.name;
    }

    const receiptText = ThermalPrinterService.formatDebtPaymentReceipt({
      payment_no: paymentNo,
      created_at: new Date().toISOString(),
      customer_name: customer.name,
      customer_phone: customer.phone,
      cashier_name: cashierName,
      payment_method: payment_method || 'CASH',
      amount: payAmount,
      previous_debt: previousDebt,
      remaining_debt: remainingDebt,
      notes,
    });

    res.json({
      success: true,
      payment_no: paymentNo,
      previous_debt: previousDebt,
      amount_paid: payAmount,
      remaining_debt: remainingDebt,
      receiptText,
    });
  } catch (err: any) {
    console.error('Pay debt error:', err);
    res.status(400).json({ error: err.message });
  }
});

// ============================================================
// 6.5. SUPPLIER & HUTANG USAHA (SUPPLIER DEBT MANAGEMENT)
// ============================================================
apiRouter.get('/suppliers', (_req: Request, res: Response) => {
  try {
    const suppliers = db.prepare(`
      SELECT 
        s.*,
        (SELECT COUNT(*) FROM purchase_orders po WHERE po.supplier_id = s.id) as total_pos,
        (SELECT COUNT(*) FROM supplier_debt_payments sdp WHERE sdp.supplier_id = s.id) as total_payments,
        CASE 
          WHEN s.current_debt > 0 THEN 'ADA_HUTANG'
          ELSE 'LUNAS'
        END as status
      FROM suppliers s
      WHERE s.is_active = 1
      ORDER BY s.current_debt DESC, s.name ASC
    `).all() as any[];

    res.json(suppliers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/suppliers/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as any;
    if (!supplier) return res.status(404).json({ error: 'Supplier tidak ditemukan' });

    const payments = db.prepare(`
      SELECT sdp.*, u.name as user_name
      FROM supplier_debt_payments sdp
      LEFT JOIN users u ON sdp.user_id = u.id
      WHERE sdp.supplier_id = ?
      ORDER BY sdp.created_at DESC
    `).all(id);

    const purchaseOrders = db.prepare(`
      SELECT * FROM purchase_orders WHERE supplier_id = ? ORDER BY order_date DESC LIMIT 20
    `).all(id);

    res.json({
      ...supplier,
      payments,
      purchaseOrders,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/suppliers', (req: Request, res: Response) => {
  try {
    const { name, phone, address, contact_person, bank_name, bank_account_number, bank_account_name, initial_debt } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nama supplier wajib diisi' });
    }

    const initialDebtNum = parseFloat(initial_debt) || 0;

    const resInsert = db.prepare(`
      INSERT INTO suppliers (name, phone, address, contact_person, bank_name, bank_account_number, bank_account_name, current_debt, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      name.trim(),
      (phone || '').trim(),
      (address || '').trim(),
      (contact_person || '').trim(),
      (bank_name || '').trim(),
      (bank_account_number || '').trim(),
      (bank_account_name || '').trim(),
      initialDebtNum
    );

    const newSup = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(resInsert.lastInsertRowid);
    res.json({ success: true, supplier: newSup });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.put('/suppliers/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { name, phone, address, contact_person, bank_name, bank_account_number, bank_account_name, current_debt } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nama supplier wajib diisi' });
    }

    if (current_debt !== undefined) {
      db.prepare(`
        UPDATE suppliers 
        SET name = ?, phone = ?, address = ?, contact_person = ?, bank_name = ?, bank_account_number = ?, bank_account_name = ?, current_debt = ?
        WHERE id = ?
      `).run(
        name.trim(),
        (phone || '').trim(),
        (address || '').trim(),
        (contact_person || '').trim(),
        (bank_name || '').trim(),
        (bank_account_number || '').trim(),
        (bank_account_name || '').trim(),
        parseFloat(current_debt) || 0,
        id
      );
    } else {
      db.prepare(`
        UPDATE suppliers 
        SET name = ?, phone = ?, address = ?, contact_person = ?, bank_name = ?, bank_account_number = ?, bank_account_name = ?
        WHERE id = ?
      `).run(
        name.trim(),
        (phone || '').trim(),
        (address || '').trim(),
        (contact_person || '').trim(),
        (bank_name || '').trim(),
        (bank_account_number || '').trim(),
        (bank_account_name || '').trim(),
        id
      );
    }

    const updated = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    res.json({ success: true, supplier: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.delete('/suppliers/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const sup = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as any;
    if (!sup) return res.status(404).json({ error: 'Supplier tidak ditemukan' });

    if (sup.current_debt > 0) {
      return res.status(400).json({
        error: `Supplier "${sup.name}" masih memiliki sisa hutang usaha sebesar Rp ${sup.current_debt.toLocaleString('id-ID')}. Lunasi terlebih dahulu sebelum menghapus data!`
      });
    }

    const poCount = (db.prepare('SELECT COUNT(*) as c FROM purchase_orders WHERE supplier_id = ?').get(id) as any).c;
    const paymentCount = (db.prepare('SELECT COUNT(*) as c FROM supplier_debt_payments WHERE supplier_id = ?').get(id) as any).c;

    if (poCount > 0 || paymentCount > 0) {
      db.prepare('UPDATE suppliers SET is_active = 0 WHERE id = ?').run(id);
      return res.json({
        success: true,
        message: `Supplier "${sup.name}" dinonaktifkan (arsip tersimpan demi integritas audit pembukuan).`
      });
    }

    db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
    res.json({ success: true, message: `Data supplier "${sup.name}" berhasil dihapus` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/suppliers/:id/pay-debt', (req: Request, res: Response) => {
  try {
    const supplierId = parseInt(req.params.id as string, 10);
    const { amount, payment_method, source_account, notes, user_id, shift_id } = req.body;

    const payAmount = parseFloat(amount);
    if (!payAmount || payAmount <= 0) {
      return res.status(400).json({ error: 'Nominal pembayaran harus lebih besar dari 0' });
    }

    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId) as any;
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier tidak ditemukan' });
    }

    if (supplier.current_debt <= 0) {
      return res.status(400).json({ error: 'Supplier ini tidak memiliki sisa hutang yang perlu dibayar' });
    }

    if (payAmount > supplier.current_debt) {
      return res.status(400).json({
        error: `Nominal pembayaran (Rp ${payAmount.toLocaleString('id-ID')}) melebihi total hutang ke supplier (Rp ${supplier.current_debt.toLocaleString('id-ID')})`
      });
    }

    const previousDebt = supplier.current_debt;
    const remainingDebt = Math.max(0, previousDebt - payAmount);
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countPayments = (db.prepare("SELECT COUNT(*) as c FROM supplier_debt_payments WHERE payment_no LIKE ?").get(`PAY-SUP/${todayStr}/%`) as any).c;
    const paymentNo = `PAY-SUP/${todayStr}/${String(countPayments + 1).padStart(4, '0')}`;

    const payMethod: 'CASH' | 'BANK_TRANSFER' = payment_method === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'CASH';
    const sourceAcc: '1-1001' | '1-1002' = (source_account === '1-1002' || payMethod === 'BANK_TRANSFER') ? '1-1002' : '1-1001';

    const tx = db.transaction(() => {
      // 1. Insert into supplier_debt_payments
      db.prepare(`
        INSERT INTO supplier_debt_payments (
          payment_no, supplier_id, amount, payment_method, source_account, notes, user_id, shift_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        paymentNo,
        supplierId,
        payAmount,
        payMethod,
        sourceAcc,
        notes || 'Pembayaran Hutang Supplier',
        user_id || null,
        shift_id || null
      );

      // 2. Reduce supplier debt
      db.prepare('UPDATE suppliers SET current_debt = ? WHERE id = ?').run(remainingDebt, supplierId);

      // 3. Auto-journal double entry!
      AccountingService.recordSupplierDebtPayment({
        payment_no: paymentNo,
        supplier_id: supplierId,
        supplier_name: supplier.name,
        amount: payAmount,
        payment_method: payMethod,
        source_account: sourceAcc,
        notes: notes || `Pelunasan hutang supplier ${supplier.name}`,
      });

      // 4. If paid in cash from drawer and active shift exists, log cash out in shift
      if (sourceAcc === '1-1001' && shift_id) {
        try {
          db.prepare(`
            INSERT INTO shift_cash_logs (shift_id, cashier_id, type, amount, reason)
            VALUES (?, ?, 'CASH_OUT', ?, ?)
          `).run(
            shift_id,
            user_id || 1,
            payAmount,
            `Bayar hutang supplier: ${supplier.name} (${paymentNo})`
          );
          db.prepare(`
            UPDATE shifts 
            SET total_cash_out = total_cash_out + ?,
                expected_cash = expected_cash - ?
            WHERE id = ?
          `).run(payAmount, payAmount, shift_id);
        } catch (e) {
          console.warn('Could not log shift cash out for supplier debt payment:', e);
        }
      }
    });

    tx();

    let staffName = 'Admin / Kasir';
    if (user_id) {
      const u = db.prepare('SELECT name FROM users WHERE id = ?').get(user_id) as any;
      if (u) staffName = u.name;
    }

    const voucherText = ThermalPrinterService.formatSupplierPaymentVoucher({
      payment_no: paymentNo,
      created_at: new Date().toISOString(),
      supplier_name: supplier.name,
      contact_person: supplier.contact_person,
      phone: supplier.phone,
      bank_name: supplier.bank_name,
      bank_account_number: supplier.bank_account_number,
      previous_debt: previousDebt,
      amount: payAmount,
      remaining_debt: remainingDebt,
      payment_method: payMethod,
      source_account: sourceAcc,
      notes,
      user_name: staffName,
    });

    res.json({
      success: true,
      payment_no: paymentNo,
      previous_debt: previousDebt,
      amount_paid: payAmount,
      remaining_debt: remainingDebt,
      voucherText,
    });
  } catch (err: any) {
    console.error('Pay supplier debt error:', err);
    res.status(400).json({ error: err.message });
  }
});

// ============================================================
// 7. ACCOUNTING & FINANCIAL REPORTS
// ============================================================
apiRouter.get('/accounting/coa', (_req: Request, res: Response) => {
  const coa = db.prepare('SELECT * FROM chart_of_accounts ORDER BY code ASC').all();
  res.json(coa);
});

apiRouter.get('/accounting/journals', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const entries = AccountingService.getRecentJournalEntries(limit);
  res.json(entries);
});

apiRouter.get('/accounting/trial-balance', (_req: Request, res: Response) => {
  const data = AccountingService.getTrialBalance();
  res.json(data);
});

apiRouter.get('/accounting/general-ledger/:code', (req: Request, res: Response) => {
  try {
    const code = req.params.code as string;
    const ledger = AccountingService.getGeneralLedger(code);
    res.json(ledger);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

apiRouter.get('/accounting/profit-loss', (req: Request, res: Response) => {
  const { start, end } = req.query as { start?: string; end?: string };
  const pl = AccountingService.getProfitAndLoss(start, end);
  res.json(pl);
});

apiRouter.get('/accounting/opening-balance-status', (_req: Request, res: Response) => {
  try {
    const status = AccountingService.getOpeningBalanceStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/accounting/opening-balance', (req: Request, res: Response) => {
  try {
    const {
      cash_drawer,
      bank_balance,
      ppob_deposit,
      receivables,
      inventory_value,
      payables,
      supplier_debts,
      customer_debts,
      notes,
    } = req.body;

    const result = AccountingService.recordOpeningBalance({
      cash_drawer: parseFloat(cash_drawer) || 0,
      bank_balance: parseFloat(bank_balance) || 0,
      ppob_deposit: parseFloat(ppob_deposit) || 0,
      receivables: parseFloat(receivables) || 0,
      inventory_value: parseFloat(inventory_value) || 0,
      payables: parseFloat(payables) || 0,
      supplier_debts,
      customer_debts,
      notes: notes || 'Inisialisasi Saldo Awal Neraca Toko (Day 1)',
    });

    res.json({
      success: true,
      message: 'Saldo awal neraca (Day-1 Setup) berhasil disinkronkan ke Buku Besar, Daftar Supplier, dan Daftar Pelanggan secara seimbang',
      ...result,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/reports/dashboard', async (_req: Request, res: Response) => {
  const today = new Date().toISOString().slice(0, 10);

  const todaySales = db.prepare(`
    SELECT 
      COUNT(id) as order_count,
      COALESCE(SUM(grand_total), 0) as total_sales,
      COALESCE(SUM(total_retail), 0) as retail_sales,
      COALESCE(SUM(total_ppob), 0) as ppob_sales
    FROM orders
    WHERE DATE(created_at) = ? AND status = 'PAID'
  `).get(today) as any;

  const lowStockCount = (db.prepare('SELECT COUNT(*) as c FROM products WHERE stock_quantity <= min_stock_alert').get() as any).c;
  const expiringBatchCount = (db.prepare("SELECT COUNT(*) as c FROM product_batches WHERE current_qty > 0 AND expiry_date <= DATE('now', '+60 days')").get() as any).c;

  const ppobBalance = await PPOBService.getBalance();
  const plToday = AccountingService.getProfitAndLoss(today, today);

  res.json({
    todaySales,
    plToday,
    ppobBalance,
    lowStockCount,
    expiringBatchCount,
  });
});

// ============================================================
// 8. SETTINGS
// ============================================================
apiRouter.get('/settings', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
  const settingsObj: Record<string, string> = {};
  for (const r of rows) {
    settingsObj[r.key] = r.value;
  }
  res.json(settingsObj);
});

apiRouter.post('/settings', (req: Request, res: Response) => {
  const entries = Object.entries(req.body);
  const updateSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');

  const tx = db.transaction(() => {
    for (const [key, value] of entries) {
      updateSetting.run(key, String(value));
    }
  });

  tx();
  res.json({ success: true, message: 'Pengaturan berhasil disimpan' });
});

// ============================================================
// 9. KONTER HP & GADGET: SERVICE DESK
// ============================================================
apiRouter.get('/services', (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const services = ServiceDeskService.getAll(status);
    res.json(services);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/services/:id', (req: Request, res: Response) => {
  try {
    const srv = ServiceDeskService.getById(req.params.id as string);
    if (!srv) return res.status(404).json({ error: 'Data servis tidak ditemukan' });
    res.json(srv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/services', (req: Request, res: Response) => {
  try {
    const newService = ServiceDeskService.create(req.body);
    const receiptText = ServiceDeskService.formatIntakeReceipt(newService);
    res.json({ success: true, service: newService, receiptText });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.put('/services/:id/status', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { status, technicianNotes, finalCost, technicianName } = req.body;
    const updated = ServiceDeskService.updateStatus(id, status, technicianNotes, finalCost ? parseFloat(finalCost) : undefined, technicianName);
    res.json({ success: true, service: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/services/:id/pickup', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { payment_method, cash_tendered, notes } = req.body;
    const result = ServiceDeskService.pickupAndSettle({
      id,
      payment_method: payment_method || 'CASH',
      cash_tendered: cash_tendered ? parseFloat(cash_tendered) : undefined,
      notes,
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/services/:id/receipt', (req: Request, res: Response) => {
  try {
    const type = req.query.type as string; // 'intake' | 'pickup'
    const srv = ServiceDeskService.getById(req.params.id as string);
    if (!srv) return res.status(404).json({ error: 'Data servis tidak ditemukan' });
    const receiptText = type === 'pickup'
      ? ServiceDeskService.formatPickupReceipt(srv, 'CASH', srv.final_cost - srv.down_payment, 0)
      : ServiceDeskService.formatIntakeReceipt(srv);
    res.json({ receiptText });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 10. SISTEM DINAMIS AUTO-BACKUP & DATABASE RESTORATION
// ============================================================

apiRouter.get('/backup/settings', (_req: Request, res: Response) => {
  try {
    const settings = BackupService.getSettings();
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/backup/settings', (req: Request, res: Response) => {
  try {
    const updated = BackupService.updateSettings(req.body);
    res.json({ success: true, settings: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.get('/backup/list', (_req: Request, res: Response) => {
  try {
    const backups = BackupService.listBackups();
    res.json(backups);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/backup/create', async (req: Request, res: Response) => {
  try {
    const reason = req.body?.reason || 'manual';
    const backupItem = await BackupService.createBackup(reason);
    res.json({ success: true, backup: backupItem });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/backup/download/:filename', (req: Request, res: Response) => {
  try {
    const filename = req.params.filename as string;
    const filePath = BackupService.getBackupFilePath(filename);
    res.download(filePath, filename);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

apiRouter.delete('/backup/:filename', (req: Request, res: Response) => {
  try {
    const filename = req.params.filename as string;
    BackupService.deleteBackup(filename);
    res.json({ success: true, message: `Backup ${filename} berhasil dihapus` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

apiRouter.post('/backup/restore', async (req: Request, res: Response) => {
  try {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: 'Nama file backup diperlukan' });
    await BackupService.restoreBackup(filename);
    res.json({ success: true, message: `Database berhasil dipulihkan dari ${filename}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


