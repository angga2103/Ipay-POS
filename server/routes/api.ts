import { Router, Request, Response } from 'express';
import db from '../db/database';
import { AccountingService } from '../services/accounting';
import { PPOBService } from '../services/ppob';
import { InventoryService } from '../services/inventory';
import { ShiftService } from '../services/shift';
import { ThermalPrinterService } from '../services/printer';
import { ServiceDeskService } from '../services/service-desk';

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
// 1. AUTH & USERS
// ============================================================
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT id, username, name, role, pin FROM users WHERE username = ? AND password = ?').get(username, password) as any;
  if (!user) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }
  res.json({ user: { id: user.id, username: user.username, name: user.name, role: user.role } });
});

apiRouter.post('/auth/login-pin', (req: Request, res: Response) => {
  const { pin } = req.body;
  const user = db.prepare('SELECT id, username, name, role FROM users WHERE pin = ?').get(pin) as any;
  if (!user) {
    return res.status(401).json({ error: 'PIN tidak terdaftar' });
  }
  res.json({ user: { id: user.id, username: user.username, name: user.name, role: user.role } });
});

apiRouter.post('/auth/verify-pin', (req: Request, res: Response) => {
  const { pin } = req.body;
  const supervisor = db.prepare("SELECT id, name, role FROM users WHERE pin = ? AND role IN ('owner', 'supervisor')").get(pin) as any;
  if (!supervisor) {
    return res.status(403).json({ success: false, error: 'PIN Otorisasi Supervisor salah' });
  }
  res.json({ success: true, user: supervisor });
});

apiRouter.get('/users', (_req: Request, res: Response) => {
  const users = db.prepare('SELECT id, username, name, role FROM users').all();
  res.json(users);
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
    const { cashierId, openingCash } = req.body;
    const shift = ShiftService.openShift(cashierId, parseFloat(openingCash) || 0);
    res.json(shift);
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

    const supervisor = db.prepare("SELECT id, name FROM users WHERE pin = ? AND role IN ('owner', 'supervisor')").get(supervisorPin) as any;
    if (!supervisor) {
      return res.status(403).json({ error: 'PIN Otorisasi Supervisor tidak valid' });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' });
    if (order.status !== 'PAID') return res.status(400).json({ error: 'Hanya transaksi PAID yang dapat di-void' });

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];

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
      } else {
        lines.push({ account_code: '1-1002', debit: 0, credit: order.grand_total, memo: `Refund bank void ${order.invoice_no}` });
      }

      if (order.total_retail > 0) {
        lines.push({ account_code: '4-1001', debit: order.total_retail, credit: 0, memo: `Pembatalan omzet ritel ${order.invoice_no}` });
        lines.push({ account_code: '1-1005', debit: order.total_retail * 0.8, credit: 0, memo: `Pengembalian stok ritel ${order.invoice_no}` });
        lines.push({ account_code: '5-1001', debit: 0, credit: order.total_retail * 0.8, memo: `Pembalikan HPP ritel ${order.invoice_no}` });
      }

      if (order.total_ppob > 0) {
        lines.push({ account_code: '4-1002', debit: order.total_ppob, credit: 0, memo: `Pembatalan omzet PPOB ${order.invoice_no}` });
        lines.push({ account_code: '1-1003', debit: order.total_ppob * 0.95, credit: 0, memo: `Pengembalian deposit PPOB ${order.invoice_no}` });
        lines.push({ account_code: '5-1002', debit: 0, credit: order.total_ppob * 0.95, memo: `Pembalikan HPP PPOB ${order.invoice_no}` });
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

