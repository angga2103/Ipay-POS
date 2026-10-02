export type UserRole = 'owner' | 'supervisor' | 'cashier';

export interface User {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  pin?: string;
}

export interface Shift {
  id: number;
  shift_number: string;
  cashier_id: number;
  cashier_name?: string;
  opened_at: string;
  closed_at?: string;
  opening_cash: number;
  closing_cash_actual?: number;
  expected_cash: number;
  discrepancy: number;
  total_retail_sales: number;
  total_ppob_sales: number;
  total_cash_in: number;
  total_cash_out: number;
  status: 'OPEN' | 'CLOSED';
  notes?: string;
}

export interface ProductUnit {
  id: number;
  product_id: number;
  unit_name: string;
  conversion_factor: number;
  barcode: string;
  selling_price: number;
}

export interface ProductTier {
  id: number;
  product_id: number;
  min_qty: number;
  tier_price: number;
}

export interface ProductBatch {
  id: number;
  product_id: number;
  batch_number: string;
  expiry_date: string;
  initial_qty: number;
  current_qty: number;
  cost_price: number;
  received_date: string;
}

export interface Product {
  id: number;
  sku: string;
  barcode: string;
  name: string;
  category_id?: number;
  category_name?: string;
  base_uom: string;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  min_stock_alert: number;
  is_active: number;
  requires_imei?: number;
  units?: ProductUnit[];
  tiers?: ProductTier[];
  batches?: ProductBatch[];
}

export interface PPOBProduct {
  id: number;
  provider_code: string;
  category_code: string;
  type: 'prepaid' | 'postpaid';
  sku_code: string;
  product_name: string;
  description?: string;
  base_price: number;
  markup_type: 'FIXED' | 'PERCENT';
  markup_value: number;
  selling_price: number;
  is_active: number;
  status_gangguan: number;
}

export interface CartItem {
  id: string; // unique cart line id
  item_type: 'RETAIL' | 'PPOB';
  // Retail specific
  product_id?: number;
  sku?: string;
  barcode?: string;
  item_name: string;
  unit_name?: string;
  conversion_factor?: number;
  quantity: number;
  cost_price: number;
  unit_price: number; // calculated tier price
  base_unit_price: number; // original price
  discount_amount: number;
  subtotal: number;
  imei_sn?: string;
  // PPOB specific
  ppob_product_id?: number;
  ppob_sku?: string;
  ppob_target_no?: string;
  ppob_customer_name?: string;
  ppob_admin_fee?: number;
  ppob_sn_token?: string;
  ppob_ref_id?: string;
  ppob_status?: 'SUCCESS' | 'PENDING' | 'FAILED';
}

export interface Order {
  id: number;
  invoice_no: string;
  shift_id: number;
  cashier_id: number;
  cashier_name?: string;
  shift_number?: string;
  customer_id?: number;
  customer_name?: string;
  total_retail: number;
  total_ppob: number;
  discount_amount: number;
  grand_total: number;
  payment_method: 'CASH' | 'QRIS' | 'EDC' | 'KASBON' | 'SPLIT';
  cash_tendered: number;
  change_amount: number;
  split_details?: any;
  status: 'PAID' | 'HELD' | 'VOID' | 'REFUNDED';
  void_reason?: string;
  void_approved_by?: number;
  notes?: string;
  created_at: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  item_type: 'RETAIL' | 'PPOB';
  product_id?: number;
  ppob_product_id?: number;
  item_name: string;
  unit_name?: string;
  conversion_factor?: number;
  quantity: number;
  cost_price: number;
  unit_price: number;
  discount_amount: number;
  subtotal: number;
  ppob_target_no?: string;
  ppob_customer_name?: string;
  ppob_sn_token?: string;
  ppob_ref_id?: string;
  ppob_status?: string;
  imei_sn?: string;
}

export type ServiceStatus = 'PENDING' | 'PROCESSING' | 'WAITING_PARTS' | 'COMPLETED' | 'PICKED_UP' | 'CANCELLED';

export interface ServiceOrder {
  id: number;
  service_no: string;
  customer_name: string;
  customer_phone: string;
  device_brand_model: string;
  imei_sn?: string;
  passcode?: string;
  issue_description: string;
  completeness?: string;
  estimated_cost: number;
  down_payment: number;
  final_cost: number;
  technician_name?: string;
  technician_notes?: string;
  status: ServiceStatus;
  created_at: string;
  completed_at?: string;
  picked_up_at?: string;
}

export interface ChartOfAccount {
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  normal_balance: 'DEBIT' | 'CREDIT';
  balance: number;
  debit?: number;
  credit?: number;
}

export interface JournalLine {
  id: number;
  journal_id: number;
  account_code: string;
  account_name?: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface JournalEntry {
  id: number;
  entry_no: string;
  transaction_date: string;
  reference_type: string;
  reference_id: string;
  description: string;
  total_debit: number;
  total_credit: number;
  lines: JournalLine[];
}

export interface ProfitAndLossReport {
  period: { start: string; end: string };
  retail: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    marginPercent: number;
  };
  ppob: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    marginPercent: number;
  };
  otherRevenue: number;
  operatingExpenses: number;
  combined: {
    totalRevenue: number;
    totalCOGS: number;
    totalGrossProfit: number;
    netProfit: number;
    marginPercent: number;
  };
}

export interface Customer {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  credit_limit: number;
  current_debt: number;
  remaining_credit?: number;
  status?: 'LANCAR' | 'KASBON_AKTIF' | 'OVER_LIMIT';
  total_orders?: number;
  total_payments?: number;
  created_at: string;
}

export interface CustomerDebtPayment {
  id: number;
  payment_no: string;
  customer_id: number;
  customer_name?: string;
  amount: number;
  payment_method: 'CASH' | 'BANK_TRANSFER' | 'QRIS';
  notes?: string;
  cashier_id?: number;
  cashier_name?: string;
  shift_id?: number;
  created_at: string;
}

export interface InventoryValuation {
  summary: {
    total_sku: number;
    total_units: number;
    total_cost_value: number;
    total_retail_value: number;
    potential_gross_profit: number;
    potential_margin_percent: number;
    low_stock_count: number;
  };
  categories: Array<{
    id: number;
    name: string;
    code: string;
    sku_count: number;
    total_units: number;
    cost_value: number;
    retail_value: number;
    gross_profit: number;
    margin_percent: number;
  }>;
}

export interface Supplier {
  id: number;
  name: string;
  phone?: string;
  address?: string;
  contact_person?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_name?: string;
  current_debt: number;
  is_active: number;
  status?: 'ADA_HUTANG' | 'LUNAS';
  total_pos?: number;
  total_payments?: number;
  created_at: string;
}

export interface SupplierDebtPayment {
  id: number;
  payment_no: string;
  supplier_id: number;
  supplier_name?: string;
  amount: number;
  payment_method: 'CASH' | 'BANK_TRANSFER';
  source_account: string;
  notes?: string;
  user_id?: number;
  user_name?: string;
  shift_id?: number;
  created_at: string;
}

export interface OpeningBalanceStatus {
  is_configured: boolean;
  entry: {
    id: number;
    entry_no: string;
    transaction_date: string;
    description: string;
    lines: Array<{
      id: number;
      account_code: string;
      account_name: string;
      debit: number;
      credit: number;
      memo: string;
    }>;
  } | null;
  balances: {
    cash_drawer: number;
    bank_balance: number;
    ppob_deposit: number;
    receivables: number;
    inventory_value: number;
    payables: number;
    owner_equity: number;
  };
  reconciliation: {
    inventory_matches: boolean;
    inventory_catalog_hpp: number;
    receivables_matches: boolean;
    customer_total_debt: number;
    payables_matches: boolean;
    supplier_total_debt: number;
    is_balanced: boolean;
  };
}


