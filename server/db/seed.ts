import db from './database';

export function runSeed() {
  console.log('Seeding initial data for POS IPAY...');

  // 0. Clean journal tables so initial chart_of_accounts matches journal history
  db.exec('DELETE FROM journal_lines');
  db.exec('DELETE FROM journal_entries');

  // 1. Chart of Accounts (COA)
  const coaData = [
    { code: '1-1001', name: 'Kas Laci Kasir (Cash in Drawer)', type: 'ASSET', normal: 'DEBIT', balance: 500000 },
    { code: '1-1002', name: 'Kas Bank / Rekening Toko', type: 'ASSET', normal: 'DEBIT', balance: 2500000 },
    { code: '1-1003', name: 'Deposit Saldo PPOB (ipay.my.id)', type: 'ASSET', normal: 'DEBIT', balance: 1500000 },
    { code: '1-1004', name: 'Piutang Usaha / Kasbon Pelanggan', type: 'ASSET', normal: 'DEBIT', balance: 0 },
    { code: '1-1005', name: 'Persediaan Barang Dagangan (Inventory)', type: 'ASSET', normal: 'DEBIT', balance: 0 },
    { code: '2-1001', name: 'Hutang Usaha / Supplier', type: 'LIABILITY', normal: 'CREDIT', balance: 0 },
    { code: '3-1001', name: 'Modal Pemilik', type: 'EQUITY', normal: 'CREDIT', balance: 4500000 },
    { code: '4-1001', name: 'Pendapatan Penjualan Ritel', type: 'REVENUE', normal: 'CREDIT', balance: 0 },
    { code: '4-1002', name: 'Pendapatan Penjualan PPOB (ipay.my.id)', type: 'REVENUE', normal: 'CREDIT', balance: 0 },
    { code: '4-1003', name: 'Pendapatan Lain-lain (Admin Fee)', type: 'REVENUE', normal: 'CREDIT', balance: 0 },
    { code: '5-1001', name: 'HPP Barang Dagangan Ritel', type: 'EXPENSE', normal: 'DEBIT', balance: 0 },
    { code: '5-1002', name: 'HPP Produk Digital PPOB', type: 'EXPENSE', normal: 'DEBIT', balance: 0 },
    { code: '5-1003', name: 'Beban Selisih Kas / Operasional', type: 'EXPENSE', normal: 'DEBIT', balance: 0 },
  ];

  const insertCoa = db.prepare(`
    INSERT OR REPLACE INTO chart_of_accounts (code, name, type, normal_balance, balance)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const acc of coaData) {
    insertCoa.run(acc.code, acc.name, acc.type, acc.normal, acc.balance);
  }

  // 2. Settings
  const settingsData: Record<string, string> = {
    store_name: 'MINIMARKET IPAY BERKAH',
    store_address: 'Jl. Ahmad Yani No. 88, Jakarta Timur',
    store_phone: '0812-3456-7890',
    store_footer_msg: 'Terima Kasih Telah Berbelanja di Toko Kami!\nBarang yang sudah dibeli tidak dapat ditukar/dikembalikan.',
    ipay_api_key: 'DEMO_KEY_IPAY_89230198',
    ipay_merchant_id: 'IPAY_MCH_00789',
    ipay_secret_key: 'SEC_DEMO_99881122',
    ipay_mode: 'sandbox',
    ipay_base_url: 'https://ipay.my.id',
    low_balance_threshold: '150000',
    printer_paper_width: '58mm',
    auto_open_drawer: 'true',
    global_markup_type: 'FIXED',
    global_markup_value: '2000',
  };

  const insertSetting = db.prepare(`
    INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
  `);
  for (const [key, value] of Object.entries(settingsData)) {
    insertSetting.run(key, value);
  }

  // 3. Default Users
  const users = [
    { username: 'owner', password: 'admin123', name: 'H. Suryadi (Owner)', role: 'owner', pin: '112233' },
    { username: 'spv', password: 'spv123', name: 'Budi Santoso (Supervisor)', role: 'supervisor', pin: '223344' },
    { username: 'kasir1', password: 'kasir123', name: 'Siti Rahma (Kasir 1)', role: 'cashier', pin: '123456' },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (username, password, name, role, pin)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET 
      password = excluded.password,
      name = excluded.name,
      role = excluded.role,
      pin = excluded.pin
  `);
  for (const u of users) {
    insertUser.run(u.username, u.password, u.name, u.role, u.pin);
  }

  // 4. Categories
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

  const insertCat = db.prepare(`
    INSERT OR REPLACE INTO categories (id, name, code) VALUES (?, ?, ?)
  `);
  for (const c of categories) {
    insertCat.run(c.id, c.name, c.code);
  }

  // 5. Retail Products
  const products = [
    {
      sku: 'RTL-BRS-5KG',
      barcode: '8991234560010',
      name: 'Beras Ramos Super 5kg',
      category_id: 1,
      base_uom: 'Pcs',
      cost_price: 62000,
      selling_price: 70000,
      stock_quantity: 45,
      min_stock_alert: 5,
    },
    {
      sku: 'RTL-MYK-2L',
      barcode: '8991234560027',
      name: 'Minyak Goreng Bimoli 2 Liter',
      category_id: 1,
      base_uom: 'Pcs',
      cost_price: 32000,
      selling_price: 36500,
      stock_quantity: 80,
      min_stock_alert: 10,
    },
    {
      sku: 'RTL-MIE-GRG',
      barcode: '8998866200225',
      name: 'Indomie Goreng Spesial 85g',
      category_id: 2,
      base_uom: 'Pcs',
      cost_price: 2800,
      selling_price: 3500,
      stock_quantity: 320,
      min_stock_alert: 40,
    },
    {
      sku: 'RTL-AQU-600',
      barcode: '8886008101053',
      name: 'Aqua Air Mineral 600ml',
      category_id: 2,
      base_uom: 'Pcs',
      cost_price: 3000,
      selling_price: 4000,
      stock_quantity: 120,
      min_stock_alert: 24,
    },
    {
      sku: 'RTL-KPI-REN',
      barcode: '8992753112345',
      name: 'Kopi Kapal Api Spesial Mix 25g',
      category_id: 2,
      base_uom: 'Pcs',
      cost_price: 1300,
      selling_price: 1800,
      stock_quantity: 150,
      min_stock_alert: 20,
    },
    {
      sku: 'RTL-GLA-1KG',
      barcode: '8992745123456',
      name: 'Gula Pasir Gulaku Premium 1kg',
      category_id: 1,
      base_uom: 'Pcs',
      cost_price: 15500,
      selling_price: 18000,
      stock_quantity: 60,
      min_stock_alert: 10,
    },
    {
      sku: 'RTL-SBN-LFB',
      barcode: '8999999054321',
      name: 'Sabun Lifebuoy Total 10 85g',
      category_id: 3,
      base_uom: 'Pcs',
      cost_price: 3800,
      selling_price: 5000,
      stock_quantity: 90,
      min_stock_alert: 15,
    },
    {
      sku: 'RTL-TLR-1KG',
      barcode: '8991234560034',
      name: 'Telur Ayam Negeri 1kg',
      category_id: 1,
      base_uom: 'Kg',
      cost_price: 25000,
      selling_price: 29000,
      stock_quantity: 35,
      min_stock_alert: 5,
      requires_imei: 0,
    },
    // Konter HP: Smartphones
    {
      sku: 'HP-RDMN13',
      barcode: '6941812750012',
      name: 'Xiaomi Redmi Note 13 8/256GB (Garansi Resmi)',
      category_id: 5,
      base_uom: 'Unit',
      cost_price: 2150000,
      selling_price: 2499000,
      stock_quantity: 8,
      min_stock_alert: 2,
      requires_imei: 1, // Wajib IMEI!
    },
    // Konter HP: Aksesoris
    {
      sku: 'ACC-TG-9D',
      barcode: '8992026100011',
      name: 'Tempered Glass 9D Full Cover All Type',
      category_id: 6,
      base_uom: 'Pcs',
      cost_price: 8000,
      selling_price: 25000,
      stock_quantity: 150,
      min_stock_alert: 20,
      requires_imei: 0,
    },
    {
      sku: 'ACC-KBL-65W',
      barcode: '8992026100028',
      name: 'Kabel Data Fast Charging Type-C 65W 1M',
      category_id: 6,
      base_uom: 'Pcs',
      cost_price: 15000,
      selling_price: 35000,
      stock_quantity: 60,
      min_stock_alert: 10,
      requires_imei: 0,
    },
    {
      sku: 'ACC-CHG-20W',
      barcode: '8992026100035',
      name: 'Charger Adaptor Quick Charge 20W USB-C',
      category_id: 6,
      base_uom: 'Pcs',
      cost_price: 25000,
      selling_price: 55000,
      stock_quantity: 40,
      min_stock_alert: 5,
      requires_imei: 0,
    },
    {
      sku: 'ACC-TWS-F9',
      barcode: '8992026100042',
      name: 'Earphone TWS Bluetooth F9 Powerbank Display',
      category_id: 6,
      base_uom: 'Unit',
      cost_price: 40000,
      selling_price: 85000,
      stock_quantity: 25,
      min_stock_alert: 5,
      requires_imei: 0,
    },
    // Konter HP: Perdana & Voucher Fisik
    {
      sku: 'PRD-TSEL-15GB',
      barcode: '8992026100059',
      name: 'Kartu Perdana Telkomsel 15GB 30 Hari',
      category_id: 7,
      base_uom: 'Pcs',
      cost_price: 37000,
      selling_price: 45000,
      stock_quantity: 45,
      min_stock_alert: 10,
      requires_imei: 0,
    },
    {
      sku: 'VCH-ISAT-8GB',
      barcode: '8992026100066',
      name: 'Voucher Kuota Indosat Freedom 8GB Fisik',
      category_id: 7,
      base_uom: 'Pcs',
      cost_price: 22000,
      selling_price: 28000,
      stock_quantity: 80,
      min_stock_alert: 15,
      requires_imei: 0,
    },
    // Konter HP: Jasa Servis
    {
      sku: 'SRV-LCD',
      barcode: '8992026100073',
      name: 'Jasa Pasang / Ganti LCD HP Android & iPhone',
      category_id: 8,
      base_uom: 'Jasa',
      cost_price: 20000,
      selling_price: 75000,
      stock_quantity: 999,
      min_stock_alert: 1,
      requires_imei: 0,
    },
    {
      sku: 'SRV-BAT',
      barcode: '8992026100080',
      name: 'Jasa Ganti Baterai Tanam Smartphone',
      category_id: 8,
      base_uom: 'Jasa',
      cost_price: 15000,
      selling_price: 50000,
      stock_quantity: 999,
      min_stock_alert: 1,
      requires_imei: 0,
    },
    {
      sku: 'SRV-SFT',
      barcode: '8992026100097',
      name: 'Jasa Software / Flashing / Bypass Akun',
      category_id: 8,
      base_uom: 'Jasa',
      cost_price: 5000,
      selling_price: 50000,
      stock_quantity: 999,
      min_stock_alert: 1,
      requires_imei: 0,
    },
  ];

  const insertProd = db.prepare(`
    INSERT INTO products (sku, barcode, name, category_id, base_uom, cost_price, selling_price, stock_quantity, min_stock_alert, requires_imei)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(sku) DO UPDATE SET
      barcode = excluded.barcode,
      name = excluded.name,
      category_id = excluded.category_id,
      base_uom = excluded.base_uom,
      cost_price = excluded.cost_price,
      selling_price = excluded.selling_price,
      stock_quantity = excluded.stock_quantity,
      min_stock_alert = excluded.min_stock_alert,
      requires_imei = excluded.requires_imei
  `);

  let totalInventoryCost = 0;
  for (const p of products) {
    insertProd.run(p.sku, p.barcode, p.name, p.category_id, p.base_uom, p.cost_price, p.selling_price, p.stock_quantity, p.min_stock_alert, p.requires_imei || 0);
    totalInventoryCost += p.cost_price * p.stock_quantity;
  }

  // Update Inventory balance in COA
  db.prepare('UPDATE chart_of_accounts SET balance = ? WHERE code = ?').run(totalInventoryCost, '1-1005');
  // Update Modal Pemilik to balance Assets: Kas + Bank + Deposit + Inventory
  const totalAssets = 500000 + 2500000 + 1500000 + totalInventoryCost;
  db.prepare('UPDATE chart_of_accounts SET balance = ? WHERE code = ?').run(totalAssets, '3-1001');

  // Fetch product IDs for relation
  const mieProd = db.prepare('SELECT id FROM products WHERE sku = ?').get('RTL-MIE-GRG') as { id: number };
  const bimoliProd = db.prepare('SELECT id FROM products WHERE sku = ?').get('RTL-MYK-2L') as { id: number };
  const aquaProd = db.prepare('SELECT id FROM products WHERE sku = ?').get('RTL-AQU-600') as { id: number };
  const lifebuoyProd = db.prepare('SELECT id FROM products WHERE sku = ?').get('RTL-SBN-LFB') as { id: number };
  const berasProd = db.prepare('SELECT id FROM products WHERE sku = ?').get('RTL-BRS-5KG') as { id: number };

  // 6. Multi-UOM Units
  if (mieProd) {
    db.prepare(`
      INSERT OR REPLACE INTO product_units (product_id, unit_name, conversion_factor, barcode, selling_price)
      VALUES (?, ?, ?, ?, ?)
    `).run(mieProd.id, 'Dus', 40, '8998866200226', 135000);

    db.prepare(`
      INSERT OR REPLACE INTO product_units (product_id, unit_name, conversion_factor, barcode, selling_price)
      VALUES (?, ?, ?, ?, ?)
    `).run(mieProd.id, 'Pack', 5, '8998866200227', 17000);

    // Tier pricing for Indomie: Beli >= 10 pcs @ Rp 3.300
    db.prepare(`
      INSERT OR REPLACE INTO product_tiers (product_id, min_qty, tier_price)
      VALUES (?, ?, ?)
    `).run(mieProd.id, 10, 3300);
  }

  if (bimoliProd) {
    db.prepare(`
      INSERT OR REPLACE INTO product_units (product_id, unit_name, conversion_factor, barcode, selling_price)
      VALUES (?, ?, ?, ?, ?)
    `).run(bimoliProd.id, 'Dus', 6, '8991234560028', 215000);
  }

  if (aquaProd) {
    db.prepare(`
      INSERT OR REPLACE INTO product_units (product_id, unit_name, conversion_factor, barcode, selling_price)
      VALUES (?, ?, ?, ?, ?)
    `).run(aquaProd.id, 'Dus', 24, '8886008101054', 90000);

    // Tier pricing: Beli >= 3 pcs @ Rp 3.800
    db.prepare(`
      INSERT OR REPLACE INTO product_tiers (product_id, min_qty, tier_price)
      VALUES (?, ?, ?)
    `).run(aquaProd.id, 3, 3800);
  }

  if (lifebuoyProd) {
    // Tier pricing: Beli >= 3 pcs @ Rp 4.700
    db.prepare(`
      INSERT OR REPLACE INTO product_tiers (product_id, min_qty, tier_price)
      VALUES (?, ?, ?)
    `).run(lifebuoyProd.id, 3, 4700);
  }

  if (berasProd) {
    // Tier pricing: Beli >= 3 pcs @ Rp 68.000
    db.prepare(`
      INSERT OR REPLACE INTO product_tiers (product_id, min_qty, tier_price)
      VALUES (?, ?, ?)
    `).run(berasProd.id, 3, 68000);

    // Batches
    db.prepare(`
      INSERT OR REPLACE INTO product_batches (product_id, batch_number, expiry_date, initial_qty, current_qty, cost_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(berasProd.id, 'BATCH-2026-A1', '2027-06-30', 50, 45, 62000);
  }

  // 7. PPOB Products Catalog (ipay.my.id)
  const ppobItems = [
    // Pulsa Telkomsel
    { prov: 'TELKOMSEL', cat: 'pulsa', type: 'prepaid', sku: 'TSEL5', name: 'Pulsa Telkomsel 5.000', cost: 5300, sell: 7000 },
    { prov: 'TELKOMSEL', cat: 'pulsa', type: 'prepaid', sku: 'TSEL10', name: 'Pulsa Telkomsel 10.000', cost: 10250, sell: 12000 },
    { prov: 'TELKOMSEL', cat: 'pulsa', type: 'prepaid', sku: 'TSEL20', name: 'Pulsa Telkomsel 20.000', cost: 20150, sell: 22000 }, // Persis contoh PRD!
    { prov: 'TELKOMSEL', cat: 'pulsa', type: 'prepaid', sku: 'TSEL50', name: 'Pulsa Telkomsel 50.000', cost: 49900, sell: 52000 },
    { prov: 'TELKOMSEL', cat: 'pulsa', type: 'prepaid', sku: 'TSEL100', name: 'Pulsa Telkomsel 100.000', cost: 98500, sell: 102000 },

    // Pulsa Indosat
    { prov: 'INDOSAT', cat: 'pulsa', type: 'prepaid', sku: 'ISAT5', name: 'Pulsa Indosat 5.000', cost: 5200, sell: 7000 },
    { prov: 'INDOSAT', cat: 'pulsa', type: 'prepaid', sku: 'ISAT10', name: 'Pulsa Indosat 10.000', cost: 10150, sell: 12000 },
    { prov: 'INDOSAT', cat: 'pulsa', type: 'prepaid', sku: 'ISAT25', name: 'Pulsa Indosat 25.000', cost: 24800, sell: 27000 },
    { prov: 'INDOSAT', cat: 'pulsa', type: 'prepaid', sku: 'ISAT50', name: 'Pulsa Indosat 50.000', cost: 49800, sell: 52000 },

    // Pulsa XL & Tri
    { prov: 'XL', cat: 'pulsa', type: 'prepaid', sku: 'XL10', name: 'Pulsa XL Axiata 10.000', cost: 10200, sell: 12000 },
    { prov: 'XL', cat: 'pulsa', type: 'prepaid', sku: 'XL25', name: 'Pulsa XL Axiata 25.000', cost: 24900, sell: 27000 },
    { prov: 'TRI', cat: 'pulsa', type: 'prepaid', sku: 'TRI10', name: 'Pulsa Tri (3) 10.000', cost: 10050, sell: 12000 },

    // Token PLN
    { prov: 'PLN', cat: 'pln_token', type: 'prepaid', sku: 'PLN20', name: 'Token Listrik PLN 20.000', cost: 20100, sell: 22500 },
    { prov: 'PLN', cat: 'pln_token', type: 'prepaid', sku: 'PLN50', name: 'Token Listrik PLN 50.000', cost: 50100, sell: 52500 },
    { prov: 'PLN', cat: 'pln_token', type: 'prepaid', sku: 'PLN100', name: 'Token Listrik PLN 100.000', cost: 100100, sell: 102500 },
    { prov: 'PLN', cat: 'pln_token', type: 'prepaid', sku: 'PLN200', name: 'Token Listrik PLN 200.000', cost: 200100, sell: 202500 },
    { prov: 'PLN', cat: 'pln_token', type: 'prepaid', sku: 'PLN500', name: 'Token Listrik PLN 500.000', cost: 500100, sell: 503000 },

    // E-Wallet
    { prov: 'DANA', cat: 'emoney', type: 'prepaid', sku: 'DANA20', name: 'Saldo DANA Rp 20.000', cost: 20200, sell: 22500 },
    { prov: 'DANA', cat: 'emoney', type: 'prepaid', sku: 'DANA50', name: 'Saldo DANA Rp 50.000', cost: 50200, sell: 52500 },
    { prov: 'GOPAY', cat: 'emoney', type: 'prepaid', sku: 'GOPAY20', name: 'Saldo GoPay Customer 20.000', cost: 20200, sell: 22500 },
    { prov: 'OVO', cat: 'emoney', type: 'prepaid', sku: 'OVO20', name: 'Saldo OVO Rp 20.000', cost: 20200, sell: 22500 },
    { prov: 'SHOPEEPAY', cat: 'emoney', type: 'prepaid', sku: 'SPAY20', name: 'ShopeePay Rp 20.000', cost: 20200, sell: 22500 },

    // Pascabayar / Tagihan
    { prov: 'PLN', cat: 'tagihan', type: 'postpaid', sku: 'PLNPOST', name: 'Tagihan Listrik PLN Pascabayar', cost: 1500, sell: 3000 },
    { prov: 'PDAM', cat: 'tagihan', type: 'postpaid', sku: 'PDAMPOST', name: 'Tagihan Air PDAM (Semua Wilayah)', cost: 1500, sell: 3000 },
    { prov: 'BPJS', cat: 'tagihan', type: 'postpaid', sku: 'BPJSPOST', name: 'Iuran BPJS Kesehatan', cost: 1500, sell: 2500 },
    { prov: 'TELKOM', cat: 'tagihan', type: 'postpaid', sku: 'TELKOMPOST', name: 'Tagihan IndiHome / Telkom', cost: 1500, sell: 3000 },
  ];

  const insertPpob = db.prepare(`
    INSERT INTO ppob_products (provider_code, category_code, type, sku_code, product_name, base_price, markup_type, markup_value, selling_price)
    VALUES (?, ?, ?, ?, ?, ?, 'FIXED', ?, ?)
    ON CONFLICT(sku_code) DO UPDATE SET
      provider_code = excluded.provider_code,
      category_code = excluded.category_code,
      type = excluded.type,
      product_name = excluded.product_name,
      base_price = excluded.base_price,
      markup_value = excluded.markup_value,
      selling_price = excluded.selling_price
  `);

  for (const item of ppobItems) {
    const markup = item.sell - item.cost;
    insertPpob.run(item.prov, item.cat, item.type, item.sku, item.name, item.cost, markup, item.sell);
  }

  // 8. Sample Customers
  const customers = [
    { name: 'Pak Haji Rahmat', phone: '081234567801', address: 'RT 01/RW 03', credit_limit: 500000, current_debt: 0 },
    { name: 'Ibu Endang Warung', phone: '081234567802', address: 'RT 04/RW 02', credit_limit: 1000000, current_debt: 75000 },
  ];

  const insertCust = db.prepare(`
    INSERT OR REPLACE INTO customers (name, phone, address, credit_limit, current_debt)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const c of customers) {
    insertCust.run(c.name, c.phone, c.address, c.credit_limit, c.current_debt);
  }

  // 10. Sample Service Orders for Konter HP Service Desk
  const sampleServices = [
    {
      service_no: 'SRV-20261001-001',
      customer_name: 'Rizky Pratama',
      customer_phone: '081298765432',
      device_brand_model: 'Samsung Galaxy A52 (Awesome Black)',
      imei_sn: '354891029384912',
      passcode: '123456',
      issue_description: 'Layar LCD bergaris & pecah setelah jatuh, getar masih responsif',
      completeness: 'Unit HP batangan (tanpa charger/dus)',
      estimated_cost: 450000,
      down_payment: 100000,
      technician_name: 'Mas Doni (Teknisi)',
      technician_notes: 'Menunggu pemasangan lem LCD kering',
      status: 'PROCESSING',
    },
    {
      service_no: 'SRV-20261001-002',
      customer_name: 'Amanda Putri',
      customer_phone: '085712345678',
      device_brand_model: 'iPhone 11 128GB (Purple)',
      imei_sn: '359102938475610',
      passcode: '2580',
      issue_description: 'Baterai cepat habis / drop mendadak, Battery Health 68%',
      completeness: 'Unit HP + Softcase',
      estimated_cost: 350000,
      down_payment: 50000,
      technician_name: 'Mas Doni (Teknisi)',
      technician_notes: 'Baterai baru sudah dipasang dan ditest charging 100% normal',
      status: 'COMPLETED', // Siap diambil!
    },
    {
      service_no: 'SRV-20261001-003',
      customer_name: 'Dian Anggraini',
      customer_phone: '081876543210',
      device_brand_model: 'Oppo Reno 6 5G (Aurora)',
      imei_sn: '861029384756192',
      passcode: 'Pola L',
      issue_description: 'Mati total terkena air hujan, konslet IC Power',
      completeness: 'Unit HP + Dus Box',
      estimated_cost: 275000,
      down_payment: 0,
      technician_name: 'Budi Santoso',
      technician_notes: 'Sedang order IC Power pengganti',
      status: 'WAITING_PARTS',
    },
  ];

  const insertSrv = db.prepare(`
    INSERT OR REPLACE INTO service_orders (
      service_no, customer_name, customer_phone, device_brand_model, imei_sn, passcode,
      issue_description, completeness, estimated_cost, down_payment, technician_name,
      technician_notes, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const s of sampleServices) {
    insertSrv.run(
      s.service_no, s.customer_name, s.customer_phone, s.device_brand_model, s.imei_sn, s.passcode,
      s.issue_description, s.completeness, s.estimated_cost, s.down_payment, s.technician_name,
      s.technician_notes, s.status
    );
  }

  console.log('Seed completed successfully!');
}

if (require.main === module) {
  runSeed();
}
