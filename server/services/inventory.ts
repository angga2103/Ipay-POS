import db from '../db/database';
import { AccountingService } from './accounting';

export interface ProductLookupResult {
  id: number;
  sku: string;
  barcode: string;
  name: string;
  category_name?: string;
  base_uom: string;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  min_stock_alert: number;
  unit_name: string;
  conversion_factor: number;
  units: Array<{
    id: number;
    unit_name: string;
    conversion_factor: number;
    barcode: string;
    selling_price: number;
  }>;
  tiers: Array<{
    min_qty: number;
    tier_price: number;
  }>;
}

export class InventoryService {
  /**
   * Fast Barcode / SKU / Name lookup for Cashier Scanner
   */
  static lookupProduct(query: string): ProductLookupResult | null {
    const cleanQuery = query.trim();

    // 1. Direct barcode match on base product
    let prod = db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE (p.barcode = ? OR p.sku = ?) AND p.is_active = 1
    `).get(cleanQuery, cleanQuery) as any;

    let matchedUnitName = '';
    let matchedConversion = 1;
    let matchedPrice = 0;

    // 2. If not found, check Multi-UOM barcodes
    if (!prod) {
      const unit = db.prepare(`
        SELECT u.*, p.id as p_id, p.name as p_name, p.sku as p_sku, p.cost_price as p_cost,
               p.stock_quantity as p_stock, p.base_uom as p_base_uom, c.name as category_name
        FROM product_units u
        JOIN products p ON u.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE u.barcode = ? AND p.is_active = 1
      `).get(cleanQuery) as any;

      if (unit) {
        prod = {
          id: unit.p_id,
          sku: unit.p_sku,
          barcode: unit.barcode,
          name: `${unit.p_name} (${unit.unit_name})`,
          category_name: unit.category_name,
          base_uom: unit.p_base_uom,
          cost_price: unit.p_cost * unit.conversion_factor,
          selling_price: unit.selling_price,
          stock_quantity: unit.p_stock,
          min_stock_alert: 5,
        };
        matchedUnitName = unit.unit_name;
        matchedConversion = unit.conversion_factor;
        matchedPrice = unit.selling_price;
      }
    }

    // 3. Fallback: Fuzzy search by product name
    if (!prod) {
      prod = db.prepare(`
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.name LIKE ? AND p.is_active = 1
        LIMIT 1
      `).get(`%${cleanQuery}%`) as any;
    }

    if (!prod) return null;

    // Get all available UOM units for this product
    const units = db.prepare(`
      SELECT * FROM product_units WHERE product_id = ?
    `).all(prod.id) as any[];

    // Get tiered pricing rules
    const tiers = db.prepare(`
      SELECT min_qty, tier_price FROM product_tiers WHERE product_id = ? ORDER BY min_qty ASC
    `).all(prod.id) as any[];

    return {
      id: prod.id,
      sku: prod.sku,
      barcode: prod.barcode,
      name: prod.name,
      category_name: prod.category_name,
      base_uom: prod.base_uom,
      cost_price: prod.cost_price,
      selling_price: matchedPrice || prod.selling_price,
      stock_quantity: prod.stock_quantity,
      min_stock_alert: prod.min_stock_alert || 5,
      unit_name: matchedUnitName || prod.base_uom,
      conversion_factor: matchedConversion,
      units,
      tiers,
    };
  }

  /**
   * Search multiple products by keyword
   */
  static searchProducts(query: string, limit = 20) {
    const q = `%${query.trim()}%`;
    const prods = db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE (p.name LIKE ? OR p.barcode LIKE ? OR p.sku LIKE ?) AND p.is_active = 1
      ORDER BY p.name ASC
      LIMIT ?
    `).all(q, q, q, limit) as any[];

    return prods.map(p => {
      const units = db.prepare('SELECT * FROM product_units WHERE product_id = ?').all(p.id) as any[];
      const tiers = db.prepare('SELECT * FROM product_tiers WHERE product_id = ? ORDER BY min_qty ASC').all(p.id) as any[];
      return {
        ...p,
        units,
        tiers,
      };
    });
  }

  /**
   * Calculate unit price considering Tiered Wholesale Pricing
   */
  static calculateEffectivePrice(productId: number, basePrice: number, quantity: number): number {
    const tiers = db.prepare(`
      SELECT min_qty, tier_price
      FROM product_tiers
      WHERE product_id = ? AND min_qty <= ?
      ORDER BY min_qty DESC
      LIMIT 1
    `).get(productId, quantity) as { min_qty: number; tier_price: number } | undefined;

    return tiers ? tiers.tier_price : basePrice;
  }

  /**
   * Deduct stock for an item with Multi-UOM and FEFO batching
   */
  static deductStock(productId: number, quantity: number, conversionFactor = 1) {
    const totalBaseUnitsToDeduct = quantity * conversionFactor;

    // 1. Deduct main product stock
    db.prepare(`
      UPDATE products
      SET stock_quantity = stock_quantity - ?
      WHERE id = ?
    `).run(totalBaseUnitsToDeduct, productId);

    // 2. FEFO: Deduct from oldest expiring batches
    const batches = db.prepare(`
      SELECT id, current_qty
      FROM product_batches
      WHERE product_id = ? AND current_qty > 0
      ORDER BY expiry_date ASC, id ASC
    `).all(productId) as Array<{ id: number; current_qty: number }>;

    let remainingToDeduct = totalBaseUnitsToDeduct;
    for (const b of batches) {
      if (remainingToDeduct <= 0) break;

      const deductAmount = Math.min(b.current_qty, remainingToDeduct);
      db.prepare(`
        UPDATE product_batches
        SET current_qty = current_qty - ?
        WHERE id = ?
      `).run(deductAmount, b.id);

      remainingToDeduct -= deductAmount;
    }
  }

  /**
   * Moving Average Costing on Goods Receipt (PO)
   */
  static processGoodsReceipt(params: {
    productId: number;
    receivedQty: number;
    unitCost: number;
    batchNumber?: string;
    expiryDate?: string;
  }) {
    const prod = db.prepare('SELECT cost_price, stock_quantity FROM products WHERE id = ?').get(params.productId) as any;
    if (!prod) throw new Error('Product not found');

    const oldStock = prod.stock_quantity > 0 ? prod.stock_quantity : 0;
    const oldCost = prod.cost_price;
    const newStock = oldStock + params.receivedQty;

    // Moving Average: ((OldStock * OldCost) + (NewQty * NewCost)) / NewStock
    const newAverageCost = newStock > 0
      ? Math.round(((oldStock * oldCost) + (params.receivedQty * params.unitCost)) / newStock)
      : params.unitCost;

    // Update product stock and HPP
    db.prepare(`
      UPDATE products
      SET stock_quantity = ?, cost_price = ?
      WHERE id = ?
    `).run(newStock, newAverageCost, params.productId);

    // Create batch if expiry specified
    if (params.batchNumber && params.expiryDate) {
      db.prepare(`
        INSERT INTO product_batches (product_id, batch_number, expiry_date, initial_qty, current_qty, cost_price)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(params.productId, params.batchNumber, params.expiryDate, params.receivedQty, params.receivedQty, params.unitCost);
    }

    return { productId: params.productId, newStock, newAverageCost };
  }

  /**
   * Get Batches Approaching Expiry (FEFO Early Warning)
   */
  static getExpiringBatches(daysAhead = 90) {
    return db.prepare(`
      SELECT b.*, p.name as product_name, p.sku, p.barcode
      FROM product_batches b
      JOIN products p ON b.product_id = p.id
      WHERE b.current_qty > 0
        AND b.expiry_date <= DATE('now', '+' || ? || ' days')
      ORDER BY b.expiry_date ASC
    `).all(daysAhead);
  }

  /**
   * Stock Opname Adjustment
   */
  static executeStockOpname(params: {
    userId: number;
    notes?: string;
    items: Array<{
      productId: number;
      physicalStock: number;
    }>;
  }) {
    const opnameNo = `OPN/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}/${Date.now().toString().slice(-4)}`;

    const transaction = db.transaction(() => {
      let totalVarianceValue = 0;

      const opnameRes = db.prepare(`
        INSERT INTO stock_opname (opname_no, performed_by, notes)
        VALUES (?, ?, ?)
      `).run(opnameNo, params.userId, params.notes || '');

      const opnameId = opnameRes.lastInsertRowid;

      const insertItem = db.prepare(`
        INSERT INTO stock_opname_items (opname_id, product_id, system_stock, physical_stock, variance_qty, unit_cost, variance_value)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of params.items) {
        const prod = db.prepare('SELECT cost_price, stock_quantity FROM products WHERE id = ?').get(item.productId) as any;
        if (!prod) continue;

        const systemStock = prod.stock_quantity;
        const varianceQty = item.physicalStock - systemStock;
        const varianceValue = varianceQty * prod.cost_price;
        totalVarianceValue += varianceValue;

        insertItem.run(opnameId, item.productId, systemStock, item.physicalStock, varianceQty, prod.cost_price, varianceValue);

        // Update product stock to match physical stock
        db.prepare('UPDATE products SET stock_quantity = ? WHERE id = ?').run(item.physicalStock, item.productId);
      }

      // Update total variance in opname
      db.prepare('UPDATE stock_opname SET total_variance_value = ? WHERE id = ?').run(totalVarianceValue, opnameId);

      // Create Accounting Adjustment Entry
      if (Math.abs(totalVarianceValue) > 0.01) {
        const isSurplus = totalVarianceValue > 0;
        const absVal = Math.abs(totalVarianceValue);

        AccountingService.createJournalEntry({
          reference_type: 'STOCK_ADJUSTMENT',
          reference_id: opnameNo,
          description: `Penyesuaian Stok Opname ${opnameNo} (${isSurplus ? 'Surplus Persediaan' : 'Selisih Kurang/Shrinkage'})`,
          lines: isSurplus
            ? [
                { account_code: '1-1005', debit: absVal, credit: 0, memo: 'Penambahan persediaan fisik (Surplus)' },
                { account_code: '4-1003', debit: 0, credit: absVal, memo: 'Pendapatan penyesuaian inventaris' },
              ]
            : [
                { account_code: '5-1003', debit: absVal, credit: 0, memo: 'Beban penyusutan persediaan (Shrinkage)' },
                { account_code: '1-1005', debit: 0, credit: absVal, memo: 'Pengurangan persediaan fisik (Hilang/Rusak)' },
              ],
        });
      }

      return { opnameNo, opnameId, totalVarianceValue };
    });

    return transaction();
  }
}
