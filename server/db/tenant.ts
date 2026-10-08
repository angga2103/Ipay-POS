import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { AsyncLocalStorage } from 'async_hooks';
import { hashSecret } from '../utils/auth-token';

// AsyncLocalStorage store for per-request tenant database resolution
export interface TenantContext {
  tenantId: string;
  db: Database.Database;
}

export const tenantContext = new AsyncLocalStorage<TenantContext>();

// Data directories
const dataDir = path.resolve(__dirname, '../../data');
const tenantsDir = path.join(dataDir, 'tenants');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(tenantsDir)) {
  fs.mkdirSync(tenantsDir, { recursive: true });
}

// In-memory pool of open tenant databases
const tenantPool = new Map<string, Database.Database>();

// Default database for single-tenant / fallback / test suites
const defaultDbPath = path.join(dataDir, 'pos.db');
export const defaultDb = new Database(defaultDbPath);
defaultDb.pragma('journal_mode = WAL');
defaultDb.pragma('foreign_keys = ON');
tenantPool.set('default', defaultDb);
try {
  initTenantDatabase(defaultDb, 'default');
} catch (err) {
  console.error('[TenantManager] Warning initializing defaultDb:', err);
}

/**
 * Sanitize tenant ID to prevent directory traversal and illegal characters
 */
export function sanitizeTenantId(raw: string | undefined | null): string {
  if (!raw || typeof raw !== 'string') return 'default';
  const clean = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return clean.length > 0 ? clean : 'default';
}

/**
 * Initialize a tenant's database schema and default foundation (COA, users, settings)
 */
export function initTenantDatabase(tenantDb: Database.Database, tenantId: string, storeName?: string) {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  tenantDb.exec(schemaSql);

  // Incremental migrations
  try { tenantDb.exec("ALTER TABLE products ADD COLUMN requires_imei INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { tenantDb.exec("ALTER TABLE order_items ADD COLUMN imei_sn TEXT"); } catch {}
  try { tenantDb.exec("ALTER TABLE customers ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1"); } catch {}
  // Customer debt payments table
  tenantDb.exec(`
    CREATE TABLE IF NOT EXISTS customer_debt_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_no TEXT UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL CHECK(payment_method IN ('CASH', 'BANK_TRANSFER', 'QRIS')),
      notes TEXT,
      cashier_id INTEGER REFERENCES users(id),
      shift_id INTEGER REFERENCES shifts(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_debt_payments_cust ON customer_debt_payments(customer_id);
    CREATE INDEX IF NOT EXISTS idx_debt_payments_date ON customer_debt_payments(created_at);
  `);

  // Supplier extensions & debt payments table
  try { tenantDb.exec("ALTER TABLE suppliers ADD COLUMN contact_person TEXT"); } catch {}
  try { tenantDb.exec("ALTER TABLE suppliers ADD COLUMN bank_name TEXT"); } catch {}
  try { tenantDb.exec("ALTER TABLE suppliers ADD COLUMN bank_account_number TEXT"); } catch {}
  try { tenantDb.exec("ALTER TABLE suppliers ADD COLUMN bank_account_name TEXT"); } catch {}
  try { tenantDb.exec("ALTER TABLE suppliers ADD COLUMN current_debt REAL NOT NULL DEFAULT 0"); } catch {}
  try { tenantDb.exec("ALTER TABLE suppliers ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1"); } catch {}

  tenantDb.exec(`
    CREATE TABLE IF NOT EXISTS supplier_debt_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_no TEXT UNIQUE NOT NULL,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL CHECK(payment_method IN ('CASH', 'BANK_TRANSFER')),
      source_account TEXT NOT NULL DEFAULT '1-1001',
      notes TEXT,
      user_id INTEGER REFERENCES users(id),
      shift_id INTEGER REFERENCES shifts(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_sup_payments_sup ON supplier_debt_payments(supplier_id);
    CREATE INDEX IF NOT EXISTS idx_sup_payments_date ON supplier_debt_payments(created_at);
  `);

  // Ensure held_bills table exists
  tenantDb.exec(`
    CREATE TABLE IF NOT EXISTS held_bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      customer_name TEXT,
      cart_json TEXT NOT NULL,
      total_amount REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Users is_active, email, phone columns
  try { tenantDb.exec("ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1"); } catch {}
  try { tenantDb.exec("ALTER TABLE users ADD COLUMN email TEXT"); } catch {}
  try { tenantDb.exec("ALTER TABLE users ADD COLUMN phone TEXT"); } catch {}

  // Email OTP codes table
  tenantDb.exec(`
    CREATE TABLE IF NOT EXISTS email_otp_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      otp_code TEXT NOT NULL,
      purpose TEXT NOT NULL CHECK(purpose IN ('LOGIN', 'REGISTER', 'RESET_PASSWORD')),
      expires_at DATETIME NOT NULL,
      is_used INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_otp_email_purpose ON email_otp_codes(email, purpose, is_used);
  `);

  // PPOB Deposits table
  tenantDb.exec(`
    CREATE TABLE IF NOT EXISTS ppob_deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ref_id TEXT UNIQUE NOT NULL,
      amount REAL NOT NULL,
      channel TEXT NOT NULL,
      source_account TEXT NOT NULL DEFAULT '1-1001',
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
      payment_instruction TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      verified_at DATETIME
    );
    CREATE INDEX IF NOT EXISTS idx_ppob_deposits_ref ON ppob_deposits(ref_id);
  `);

  // Sales Returns tables
  tenantDb.exec(`
    CREATE TABLE IF NOT EXISTS sales_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_no TEXT UNIQUE NOT NULL,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      invoice_no TEXT NOT NULL,
      customer_id INTEGER REFERENCES customers(id),
      total_refund REAL NOT NULL,
      refund_method TEXT NOT NULL CHECK(refund_method IN ('CASH', 'KASBON_REDUCTION')),
      reason TEXT NOT NULL,
      cashier_id INTEGER REFERENCES users(id),
      shift_id INTEGER REFERENCES shifts(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales_return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      item_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      cost_price REAL NOT NULL,
      restock_inventory INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_sales_returns_order ON sales_returns(order_id);
    CREATE INDEX IF NOT EXISTS idx_sales_returns_invoice ON sales_returns(invoice_no);
  `);

  // Operational Transactions table (Pengeluaran Umum & Pemasukan Lain-lain)
  tenantDb.exec(`
    CREATE TABLE IF NOT EXISTS operational_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx_no TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('EXPENSE', 'INCOME')),
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_source TEXT NOT NULL CHECK(payment_source IN ('1-1001', '1-1002')),
      cashier_id INTEGER REFERENCES users(id),
      shift_id INTEGER REFERENCES shifts(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_op_tx_type ON operational_transactions(type);
  `);

  // Foundation: Seed Chart of Accounts (COA)
  const coaData = [
    { code: '1-1001', name: 'Kas Laci Kasir (Cash in Drawer)', type: 'ASSET', normal: 'DEBIT', balance: 0 },
    { code: '1-1002', name: 'Kas Bank / Rekening Toko', type: 'ASSET', normal: 'DEBIT', balance: 0 },
    { code: '1-1003', name: 'Deposit Saldo PPOB (ipay.my.id)', type: 'ASSET', normal: 'DEBIT', balance: 0 },
    { code: '1-1004', name: 'Piutang Usaha / Kasbon Pelanggan', type: 'ASSET', normal: 'DEBIT', balance: 0 },
    { code: '1-1005', name: 'Persediaan Barang Dagangan (Inventory)', type: 'ASSET', normal: 'DEBIT', balance: 0 },
    { code: '2-1001', name: 'Hutang Usaha / Supplier', type: 'LIABILITY', normal: 'CREDIT', balance: 0 },
    { code: '3-1001', name: 'Modal Pemilik', type: 'EQUITY', normal: 'CREDIT', balance: 0 },
    { code: '4-1001', name: 'Pendapatan Penjualan Ritel', type: 'REVENUE', normal: 'CREDIT', balance: 0 },
    { code: '4-1002', name: 'Pendapatan Penjualan PPOB (ipay.my.id)', type: 'REVENUE', normal: 'CREDIT', balance: 0 },
    { code: '4-1003', name: 'Pendapatan Lain-lain (Admin Fee)', type: 'REVENUE', normal: 'CREDIT', balance: 0 },
    { code: '4-1004', name: 'Potongan & Diskon Penjualan', type: 'REVENUE', normal: 'DEBIT', balance: 0 },
    { code: '5-1001', name: 'HPP Barang Dagangan Ritel', type: 'EXPENSE', normal: 'DEBIT', balance: 0 },
    { code: '5-1002', name: 'HPP Produk Digital PPOB', type: 'EXPENSE', normal: 'DEBIT', balance: 0 },
    { code: '5-1003', name: 'Beban Selisih Kas / Operasional', type: 'EXPENSE', normal: 'DEBIT', balance: 0 },
  ];
  const insertCoa = tenantDb.prepare(`
    INSERT OR IGNORE INTO chart_of_accounts (code, name, type, normal_balance, balance)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const acc of coaData) {
    insertCoa.run(acc.code, acc.name, acc.type, acc.normal, acc.balance);
  }

  // Foundation: Seed Default Users if empty
  const userCount = (tenantDb.prepare('SELECT COUNT(*) as count FROM users').get() as any)?.count || 0;
  if (userCount === 0) {
    const insertUser = tenantDb.prepare(`
      INSERT INTO users (username, password, name, role, pin)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertUser.run('owner', hashSecret('admin123'), storeName ? `Pemilik (${storeName})` : `Owner (${tenantId})`, 'owner', hashSecret('112233'));
    insertUser.run('kasir1', hashSecret('kasir123'), 'Kasir Utama', 'cashier', hashSecret('123456'));
  }

  // Foundation: Seed Categories if empty
  const catCount = (tenantDb.prepare('SELECT COUNT(*) as count FROM categories').get() as any)?.count || 0;
  if (catCount === 0) {
    const categories = [
      { id: 1, name: 'Sembako & Kebutuhan Pokok', code: 'SEMBAKO' },
      { id: 2, name: 'Makanan & Minuman (F&B)', code: 'FNB' },
      { id: 3, name: 'Perawatan Tubuh & Kebersihan', code: 'CARE' },
      { id: 4, name: 'Rokok & Tembakau', code: 'ROKOK' },
      { id: 5, name: 'Smartphone & Gadget', code: 'SMARTPHONE' },
      { id: 6, name: 'Aksesoris Handphone', code: 'ACCESSORIES' },
      { id: 7, name: 'Kartu Perdana & Voucher Fisik', code: 'PERDANA_VOUCHER' },
      { id: 8, name: 'Jasa Servis & Sparepart', code: 'SERVICE' },
    ];
    const insertCat = tenantDb.prepare('INSERT OR REPLACE INTO categories (id, name, code) VALUES (?, ?, ?)');
    for (const c of categories) {
      insertCat.run(c.id, c.name, c.code);
    }
  }

  // Foundation: Seed Store Settings
  const insertSetting = tenantDb.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('store_name', storeName || `KONTER IPAY ${tenantId.toUpperCase()}`);
  insertSetting.run('tenant_id', tenantId);
  insertSetting.run('printer_paper_width', '58mm');
  insertSetting.run('auto_open_drawer', 'true');
  insertSetting.run('global_markup_type', 'FIXED');
  insertSetting.run('global_markup_value', '2000');

  // Foundation: Seed Sample Product Catalog & Services (Zero Price for clean Day 1 Bookkeeping)
  seedSampleCatalog(tenantDb);
}

/**
 * Inisialisasi katalog produk contoh (Kelontong & Konter Fisik) untuk toko baru
 * Mencontohkan multi-satuan, pelacak IMEI, batch kadaluarsa, harga grosir bertingkat, dan pesanan servis.
 * Semua harga & stok awal diatur Rp 0 agar pembukuan awal Day 1 tetap bersih.
 */
export function seedSampleCatalog(tenantDb: Database.Database) {
  const prodCount = (tenantDb.prepare('SELECT COUNT(*) as count FROM products').get() as any)?.count || 0;
  if (prodCount === 0) {
    const insertProd = tenantDb.prepare(`
      INSERT INTO products (sku, barcode, name, category_id, base_uom, cost_price, selling_price, stock_quantity, min_stock_alert, requires_imei)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // 1. Kelontong: Indomie Goreng (Multi-Satuan: Pcs, Pack/Renceng, Dus)
    insertProd.run('FNB-MIE-001', '8998866200213', 'Indomie Goreng Spesial 85g', 2, 'Pcs', 0, 0, 0, 5, 0);
    const indomieId = (tenantDb.prepare("SELECT id FROM products WHERE sku = 'FNB-MIE-001'").get() as any)?.id;
    if (indomieId) {
      const insertUnit = tenantDb.prepare(`
        INSERT INTO product_units (product_id, unit_name, conversion_factor, barcode, selling_price)
        VALUES (?, ?, ?, ?, ?)
      `);
      insertUnit.run(indomieId, 'Pack / Renceng (5 Pcs)', 5, '8998866200213-PCK', 0);
      insertUnit.run(indomieId, 'Dus / Karton (40 Pcs)', 40, '8998866200213-DUS', 0);
    }

    // 2. Kelontong: Minyak Goreng Bimoli 2 Liter (Multi-Satuan: Pcs, Dus)
    insertProd.run('SBK-MYK-002', '8991234560027', 'Minyak Goreng Bimoli 2 Liter', 1, 'Pcs', 0, 0, 0, 5, 0);
    const bimoliId = (tenantDb.prepare("SELECT id FROM products WHERE sku = 'SBK-MYK-002'").get() as any)?.id;
    if (bimoliId) {
      tenantDb.prepare(`
        INSERT INTO product_units (product_id, unit_name, conversion_factor, barcode, selling_price)
        VALUES (?, 'Dus (6 Pcs)', 6, '8991234560027-DUS', 0)
      `).run(bimoliId);
    }

    // 3. Kelontong: Rokok Sampoerna A Mild 16 (Multi-Satuan: Bungkus, Slop)
    insertProd.run('ROK-SAM-003', '8992759111019', 'Rokok Sampoerna A Mild 16', 4, 'Bungkus', 0, 0, 0, 5, 0);
    const rokokId = (tenantDb.prepare("SELECT id FROM products WHERE sku = 'ROK-SAM-003'").get() as any)?.id;
    if (rokokId) {
      tenantDb.prepare(`
        INSERT INTO product_units (product_id, unit_name, conversion_factor, barcode, selling_price)
        VALUES (?, 'Slop (10 Bungkus)', 10, '8992759111019-SLP', 0)
      `).run(rokokId);
    }

    // 4. Kelontong: Beras Ramos Super 5kg (Harga Grosir Bertingkat)
    insertProd.run('SBK-BRS-004', '8991234560010', 'Beras Ramos Super 5kg', 1, 'Sak', 0, 0, 0, 5, 0);
    const berasId = (tenantDb.prepare("SELECT id FROM products WHERE sku = 'SBK-BRS-004'").get() as any)?.id;
    if (berasId) {
      const insertTier = tenantDb.prepare(`
        INSERT INTO product_tiers (product_id, min_qty, tier_price) VALUES (?, ?, ?)
      `);
      insertTier.run(berasId, 5, 0);
      insertTier.run(berasId, 10, 0);
    }

    // 5. Kelontong: Gula Pasir Gulaku Murni 1kg (Harga Grosir Bertingkat)
    insertProd.run('SBK-GLA-005', '8993005110012', 'Gula Pasir Gulaku Murni 1kg', 1, 'Pcs', 0, 0, 0, 5, 0);
    const gulaId = (tenantDb.prepare("SELECT id FROM products WHERE sku = 'SBK-GLA-005'").get() as any)?.id;
    if (gulaId) {
      const insertTier = tenantDb.prepare(`
        INSERT INTO product_tiers (product_id, min_qty, tier_price) VALUES (?, ?, ?)
      `);
      insertTier.run(gulaId, 10, 0);
      insertTier.run(gulaId, 24, 0);
    }

    // 6. Konter Fisik: Kabel Data Fast Charging 65W Type-C (Harga Grosir Bertingkat)
    insertProd.run('ACC-KBL-006', '8997213890014', 'Kabel Data Fast Charging 65W Type-C Braided', 6, 'Pcs', 0, 0, 0, 5, 0);
    const kabelId = (tenantDb.prepare("SELECT id FROM products WHERE sku = 'ACC-KBL-006'").get() as any)?.id;
    if (kabelId) {
      const insertTier = tenantDb.prepare(`
        INSERT INTO product_tiers (product_id, min_qty, tier_price) VALUES (?, ?, ?)
      `);
      insertTier.run(kabelId, 3, 0);
      insertTier.run(kabelId, 10, 0);
    }

    // 7. Kelontong: Susu UHT Ultra Milk 1000ml (Pelacak Kadaluarsa & Batch FEFO)
    insertProd.run('FNB-SSU-007', '8992753210015', 'Susu UHT Ultra Milk 1000ml Full Cream', 2, 'Pcs', 0, 0, 0, 5, 0);
    const susuId = (tenantDb.prepare("SELECT id FROM products WHERE sku = 'FNB-SSU-007'").get() as any)?.id;
    if (susuId) {
      tenantDb.prepare(`
        INSERT INTO product_batches (product_id, batch_number, expiry_date, initial_qty, current_qty, cost_price)
        VALUES (?, 'BATCH-UM-2026A', '2026-12-31', 0, 0, 0)
      `).run(susuId);
    }

    // 8. Kelontong: Roti Tawar Kupas Sari Roti (Pelacak Kadaluarsa & Batch FEFO)
    insertProd.run('FNB-RTI-008', '8993175110023', 'Roti Tawar Kupas Sari Roti', 2, 'Pcs', 0, 0, 0, 5, 0);
    const rotiId = (tenantDb.prepare("SELECT id FROM products WHERE sku = 'FNB-RTI-008'").get() as any)?.id;
    if (rotiId) {
      tenantDb.prepare(`
        INSERT INTO product_batches (product_id, batch_number, expiry_date, initial_qty, current_qty, cost_price)
        VALUES (?, 'BATCH-SR-2026B', '2026-10-25', 0, 0, 0)
      `).run(rotiId);
    }

    // 9. Konter Fisik: Smartphone Xiaomi Redmi Note 13 (Pelacak IMEI / Serial Number Wajib)
    insertProd.run('HP-XIA-009', '8998001122334', 'Xiaomi Redmi Note 13 8/256GB Midnight Black', 5, 'Unit', 0, 0, 0, 2, 1);

    // 10. Konter Fisik: Smartphone Samsung Galaxy A15 5G (Pelacak IMEI / Serial Number Wajib)
    insertProd.run('HP-SAM-010', '8998002233445', 'Samsung Galaxy A15 5G 8/128GB Blue Black', 5, 'Unit', 0, 0, 0, 2, 1);

    // 11. Konter Fisik: Modem WiFi 4G LTE Orbit Pro (Pelacak IMEI / Serial Number Wajib)
    insertProd.run('MFI-ORB-011', '8998003344556', 'Modem WiFi 4G LTE Telkomsel Orbit Pro H1', 5, 'Unit', 0, 0, 0, 2, 1);

    // 12. Konter Fisik: Kartu Perdana Telkomsel Kuota 10GB
    insertProd.run('VCR-TSEL-012', '8999901122001', 'Kartu Perdana Telkomsel Kuota Utama 10GB', 7, 'Pcs', 0, 0, 0, 10, 0);

    // 13. Konter Fisik: Tempered Glass 9D (Multi-Satuan: Pcs, Paket 10 Pcs)
    insertProd.run('ACC-TGL-013', '8997213890021', 'Tempered Glass 9D Full Cover All Type HP', 6, 'Pcs', 0, 0, 0, 10, 0);
    const tgId = (tenantDb.prepare("SELECT id FROM products WHERE sku = 'ACC-TGL-013'").get() as any)?.id;
    if (tgId) {
      tenantDb.prepare(`
        INSERT INTO product_units (product_id, unit_name, conversion_factor, barcode, selling_price)
        VALUES (?, 'Paket 10 Pcs (Grosir Counter)', 10, '8997213890021-PK10', 0)
      `).run(tgId);
    }

    // 14. Jasa Servis: Jasa Pasang Tempered Glass & Pembersihan Layar
    insertProd.run('SRV-JSA-014', '8997213890038', 'Jasa Pasang Tempered Glass & Pembersihan Layar', 8, 'Jasa', 0, 0, 0, 0, 0);
  }

  // 15. Contoh Pesanan Servis HP & Gadget (service_orders)
  const serviceCount = (tenantDb.prepare('SELECT COUNT(*) as count FROM service_orders').get() as any)?.count || 0;
  if (serviceCount === 0) {
    const insertService = tenantDb.prepare(`
      INSERT INTO service_orders (
        service_no, customer_name, customer_phone, device_brand_model, imei_sn,
        issue_description, completeness, estimated_cost, down_payment, final_cost,
        status, technician_name, technician_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertService.run(
      'SRV-202610-001',
      'Pak Budi Handoko',
      '081234567890',
      'Xiaomi Redmi Note 13',
      '861234567890123',
      'Layar LCD pecah / retak akibat jatuh, touch screen macet sebagian',
      'Unit HP batangan',
      0, 0, 0,
      'PROCESSING',
      'Teknisi Andi',
      'Menunggu proses pemasangan LCD original baru'
    );

    insertService.run(
      'SRV-202610-002',
      'Ibu Ratna Sari',
      '085712345678',
      'Samsung Galaxy A15 5G',
      '351234567890456',
      'Bootloop / stuck di logo Samsung, butuh flashing ulang OS',
      'Unit HP + Box',
      0, 0, 0,
      'PENDING',
      'Teknisi Budi',
      'Pemeriksaan firmware dan recovery mode'
    );

    insertService.run(
      'SRV-202610-003',
      'Kevin Pratama',
      '087812349988',
      'iPhone 11 64GB',
      '359876543210987',
      'Baterai boros / kembung (health 68%) & port charger longgar',
      'Unit HP',
      0, 0, 0,
      'COMPLETED',
      'Teknisi Andi',
      'Penggantian baterai original selesai, charging normal 100%'
    );
  }
}

/**
 * Retrieve or open a tenant database connection from the pool
 */
export function getTenantDatabase(rawTenantId: string | undefined | null, storeName?: string): Database.Database {
  const tenantId = sanitizeTenantId(rawTenantId);

  if (tenantId === 'default') {
    return defaultDb;
  }

  if (tenantPool.has(tenantId)) {
    return tenantPool.get(tenantId)!;
  }

  const tenantDbPath = path.join(tenantsDir, `${tenantId}.db`);
  const isNew = !fs.existsSync(tenantDbPath);

  const tenantDb = new Database(tenantDbPath);
  tenantDb.pragma('journal_mode = WAL');
  tenantDb.pragma('foreign_keys = ON');

  if (isNew) {
    initTenantDatabase(tenantDb, tenantId, storeName);
    console.log(`[TenantManager] Inisialisasi database tenant baru: ${tenantId} (${tenantDbPath})`);
  }

  tenantPool.set(tenantId, tenantDb);
  return tenantDb;
}

/**
 * Get all available tenant IDs (including 'default' and all files in data/tenants/)
 */
export function getAllTenantIds(): string[] {
  const tenants = new Set<string>(['default']);
  try {
    if (fs.existsSync(tenantsDir)) {
      const files = fs.readdirSync(tenantsDir);
      for (const file of files) {
        if (file.endsWith('.db') && !file.endsWith('-wal') && !file.endsWith('-shm')) {
          const tId = file.slice(0, -3);
          tenants.add(tId);
        }
      }
    }
  } catch (err) {
    console.error('[TenantManager] Error reading tenants dir:', err);
  }
  return Array.from(tenants);
}

/**
 * Close and remove a tenant database from pool (e.g. for restore or maintenance)
 */
export function closeTenantDatabase(rawTenantId: string) {
  const tenantId = sanitizeTenantId(rawTenantId);
  if (tenantPool.has(tenantId)) {
    const instance = tenantPool.get(tenantId);
    try {
      instance?.close();
    } catch {}
    tenantPool.delete(tenantId);
  }
}

/**
 * Mendapatkan ringkasan seluruh toko yang terdaftar (ID dan Nama Toko)
 */
export function getAllTenantSummaries(): { id: string; name: string }[] {
  const ids = getAllTenantIds();
  const result: { id: string; name: string }[] = [];
  for (const id of ids) {
    try {
      const db = getTenantDatabase(id);
      const row = db.prepare("SELECT value FROM settings WHERE key = 'store_name'").get() as any;
      result.push({
        id,
        name: row?.value || (id === 'default' ? 'Toko Utama (Default)' : `Toko ${id}`),
      });
    } catch {
      result.push({ id, name: id });
    }
  }
  return result;
}
