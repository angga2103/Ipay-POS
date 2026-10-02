import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const dataDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'pos.db');
export const db = new Database(dbPath);

// Enable WAL mode and foreign keys for high concurrency & ACID safety
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);

  // Safe incremental migrations for existing DB
  try {
    db.exec("ALTER TABLE products ADD COLUMN requires_imei INTEGER NOT NULL DEFAULT 0");
  } catch {}
  try {
    db.exec("ALTER TABLE order_items ADD COLUMN imei_sn TEXT");
  } catch {}
  try {
    db.exec("ALTER TABLE customers ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1");
  } catch {}

  // Customer kasbon debt repayment table
  db.exec(`
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
  try { db.exec("ALTER TABLE suppliers ADD COLUMN contact_person TEXT"); } catch {}
  try { db.exec("ALTER TABLE suppliers ADD COLUMN bank_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE suppliers ADD COLUMN bank_account_number TEXT"); } catch {}
  try { db.exec("ALTER TABLE suppliers ADD COLUMN bank_account_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE suppliers ADD COLUMN current_debt REAL NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE suppliers ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1"); } catch {}

  db.exec(`
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
}

// Automatically initialize schema on load
initDatabase();

export default db;
