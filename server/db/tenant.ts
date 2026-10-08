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
