-- ============================================================
-- POS IPAY Database Schema
-- SQLite WAL mode optimized for Modern Minimarket & PPOB
-- ============================================================

-- Users & RBAC
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner', 'supervisor', 'cashier')),
  pin TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Settings & Configuration
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Product Categories
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT UNIQUE
);

-- Retail Products (Physical Minimarket Inventory)
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE NOT NULL,
  barcode TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  base_uom TEXT NOT NULL DEFAULT 'Pcs',
  cost_price REAL NOT NULL DEFAULT 0,
  selling_price REAL NOT NULL DEFAULT 0,
  stock_quantity REAL NOT NULL DEFAULT 0,
  min_stock_alert REAL NOT NULL DEFAULT 5,
  requires_imei INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Multi-UOM & Conversion Factors
CREATE TABLE IF NOT EXISTS product_units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  unit_name TEXT NOT NULL,
  conversion_factor REAL NOT NULL,
  barcode TEXT UNIQUE,
  selling_price REAL NOT NULL
);

-- Tiered / Wholesale Pricing Rules
CREATE TABLE IF NOT EXISTS product_tiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_qty REAL NOT NULL,
  tier_price REAL NOT NULL
);

-- Batch Tracking & FEFO (First Expired, First Out)
CREATE TABLE IF NOT EXISTS product_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_number TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  initial_qty REAL NOT NULL,
  current_qty REAL NOT NULL,
  cost_price REAL NOT NULL,
  received_date DATE NOT NULL DEFAULT (CURRENT_DATE)
);

-- PPOB Categories
CREATE TABLE IF NOT EXISTS ppob_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('prepaid', 'postpaid')),
  icon TEXT
);

-- PPOB Product Catalog (ipay.my.id Integration)
CREATE TABLE IF NOT EXISTS ppob_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_code TEXT NOT NULL,
  category_code TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('prepaid', 'postpaid')),
  sku_code TEXT UNIQUE NOT NULL,
  product_name TEXT NOT NULL,
  description TEXT,
  base_price REAL NOT NULL DEFAULT 0,
  markup_type TEXT NOT NULL DEFAULT 'FIXED',
  markup_value REAL NOT NULL DEFAULT 2000,
  selling_price REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  status_gangguan INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- PPOB Transactions Log
CREATE TABLE IF NOT EXISTS ppob_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER REFERENCES orders(id),
  ref_id TEXT UNIQUE NOT NULL,
  sku_code TEXT NOT NULL,
  customer_no TEXT NOT NULL,
  customer_name TEXT,
  base_price REAL NOT NULL DEFAULT 0,
  selling_price REAL NOT NULL DEFAULT 0,
  admin_fee REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('SUCCESS', 'PENDING', 'FAILED')),
  sn_token TEXT,
  raw_response TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ppob_transactions_ref ON ppob_transactions(ref_id);

-- Customers & Kasbon / Piutang
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  credit_limit REAL NOT NULL DEFAULT 0,
  current_debt REAL NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cashier Shifts & Drawer Sessions
CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_number TEXT UNIQUE NOT NULL,
  cashier_id INTEGER NOT NULL REFERENCES users(id),
  opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME,
  opening_cash REAL NOT NULL DEFAULT 0,
  closing_cash_actual REAL,
  expected_cash REAL NOT NULL DEFAULT 0,
  discrepancy REAL NOT NULL DEFAULT 0,
  total_retail_sales REAL NOT NULL DEFAULT 0,
  total_ppob_sales REAL NOT NULL DEFAULT 0,
  total_cash_in REAL NOT NULL DEFAULT 0,
  total_cash_out REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'CLOSED')),
  notes TEXT
);

-- Cash Drawer Movement Logs (F10 - Cash In / Cash Out)
CREATE TABLE IF NOT EXISTS shift_cash_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id INTEGER NOT NULL REFERENCES shifts(id),
  cashier_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK(type IN ('CASH_IN', 'CASH_OUT')),
  amount REAL NOT NULL,
  reason TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Orders (Unified Checkout - Hybrid Cart)
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT UNIQUE NOT NULL,
  shift_id INTEGER NOT NULL REFERENCES shifts(id),
  cashier_id INTEGER NOT NULL REFERENCES users(id),
  customer_id INTEGER REFERENCES customers(id),
  total_retail REAL NOT NULL DEFAULT 0,
  total_ppob REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  grand_total REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL CHECK(payment_method IN ('CASH', 'QRIS', 'EDC', 'KASBON', 'SPLIT')),
  cash_tendered REAL NOT NULL DEFAULT 0,
  change_amount REAL NOT NULL DEFAULT 0,
  split_details TEXT,
  status TEXT NOT NULL DEFAULT 'PAID' CHECK(status IN ('PAID', 'HELD', 'VOID', 'REFUNDED')),
  void_reason TEXT,
  void_approved_by INTEGER REFERENCES users(id),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Order Items (Retail Items & PPOB Items in Single Receipt)
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK(item_type IN ('RETAIL', 'PPOB')),
  product_id INTEGER REFERENCES products(id),
  ppob_product_id INTEGER REFERENCES ppob_products(id),
  item_name TEXT NOT NULL,
  unit_name TEXT,
  conversion_factor REAL DEFAULT 1,
  quantity REAL NOT NULL,
  cost_price REAL NOT NULL,
  unit_price REAL NOT NULL,
  discount_amount REAL NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL,
  ppob_target_no TEXT,
  ppob_customer_name TEXT,
  ppob_sn_token TEXT,
  ppob_ref_id TEXT,
  ppob_status TEXT CHECK(ppob_status IN ('SUCCESS', 'PENDING', 'FAILED', NULL)),
  imei_sn TEXT
);

-- ============================================================
-- Konter HP: Device Service Orders (Manajemen Servis HP)
-- ============================================================
CREATE TABLE IF NOT EXISTS service_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_no TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  device_brand_model TEXT NOT NULL,
  imei_sn TEXT,
  passcode TEXT,
  issue_description TEXT NOT NULL,
  completeness TEXT,
  estimated_cost REAL NOT NULL DEFAULT 0,
  down_payment REAL NOT NULL DEFAULT 0,
  final_cost REAL NOT NULL DEFAULT 0,
  technician_name TEXT,
  technician_notes TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PROCESSING', 'WAITING_PARTS', 'COMPLETED', 'PICKED_UP', 'CANCELLED')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  picked_up_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_service_orders_no ON service_orders(service_no);
CREATE INDEX IF NOT EXISTS idx_service_orders_status ON service_orders(status);

-- ============================================================
-- Accounting Module: Double-Entry Bookkeeping Ledger
-- ============================================================

-- Chart of Accounts (COA)
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
  normal_balance TEXT NOT NULL CHECK(normal_balance IN ('DEBIT', 'CREDIT')),
  balance REAL NOT NULL DEFAULT 0
);

-- General Journal Header
CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_no TEXT UNIQUE NOT NULL,
  transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  reference_type TEXT NOT NULL,
  reference_id TEXT,
  description TEXT NOT NULL,
  total_debit REAL NOT NULL,
  total_credit REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- General Journal Lines (Debit / Credit)
CREATE TABLE IF NOT EXISTS journal_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  journal_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_code TEXT NOT NULL REFERENCES chart_of_accounts(code),
  debit REAL NOT NULL DEFAULT 0,
  credit REAL NOT NULL DEFAULT 0,
  memo TEXT
);

-- ============================================================
-- Inventory & Procurement
-- ============================================================

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_no TEXT UNIQUE NOT NULL,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED')),
  total_amount REAL NOT NULL DEFAULT 0,
  order_date DATE NOT NULL,
  received_date DATE,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity REAL NOT NULL,
  unit_cost REAL NOT NULL,
  batch_number TEXT,
  expiry_date DATE
);

CREATE TABLE IF NOT EXISTS stock_opname (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opname_no TEXT UNIQUE NOT NULL,
  performed_by INTEGER NOT NULL REFERENCES users(id),
  date DATE NOT NULL DEFAULT (CURRENT_DATE),
  total_variance_value REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS stock_opname_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opname_id INTEGER NOT NULL REFERENCES stock_opname(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  system_stock REAL NOT NULL,
  physical_stock REAL NOT NULL,
  variance_qty REAL NOT NULL,
  unit_cost REAL NOT NULL,
  variance_value REAL NOT NULL
);

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

-- Indices for Fast Lookups
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_product_units_barcode ON product_units(barcode);
CREATE INDEX IF NOT EXISTS idx_orders_shift ON orders(shift_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_journal ON journal_lines(journal_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_code);
CREATE INDEX IF NOT EXISTS idx_ppob_products_category ON ppob_products(category_code);
CREATE INDEX IF NOT EXISTS idx_sales_returns_order ON sales_returns(order_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_invoice ON sales_returns(invoice_no);
CREATE INDEX IF NOT EXISTS idx_op_tx_type ON operational_transactions(type);
CREATE INDEX IF NOT EXISTS idx_ppob_deposits_ref ON ppob_deposits(ref_id);
