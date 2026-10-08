import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem, Product } from '../types';

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, unitName?: string, imeiSn?: string) => void;
  addPPOBItem: (ppobItem: {
    sku: string;
    product_name: string;
    target_no: string;
    customer_name?: string;
    selling_price: number;
    cost_price: number;
    admin_fee?: number;
  }) => void;
  updateQuantity: (id: string, qty: number) => void;
  updateDiscount: (id: string, discount: number) => void;
  changeUnit: (id: string, unitName: string) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  heldBills: any[];
  loadHeldBills: () => Promise<void>;
  holdCurrentCart: (label: string, customerName?: string) => Promise<void>;
  recallCart: (heldBillId: number) => Promise<void>;
  totalRetail: number;
  totalPPOB: number;
  overallDiscount: number;
  setOverallDiscount: (val: number) => void;
  grandTotal: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('pos_cart');
    return saved ? JSON.parse(saved) : [];
  });

  const [overallDiscount, setOverallDiscount] = useState<number>(0);
  const [heldBills, setHeldBills] = useState<any[]>([]);

  useEffect(() => {
    localStorage.setItem('pos_cart', JSON.stringify(items));
  }, [items]);

  const loadHeldBills = async () => {
    try {
      const res = await fetch('/api/held-bills');
      if (res.ok) {
        const data = await res.json();
        setHeldBills(Array.isArray(data) ? data : []);
      } else {
        setHeldBills([]);
      }
    } catch (err) {
      console.error('Failed to load held bills:', err);
      setHeldBills([]);
    }
  };

  useEffect(() => {
    loadHeldBills();
  }, []);

  /**
   * Helper: Calculate unit price based on Tiered Wholesale Pricing
   */
  const getTieredPrice = (product: Product, quantity: number, basePrice: number): number => {
    if (!product.tiers || product.tiers.length === 0) return basePrice;
    const matchedTier = [...product.tiers]
      .filter(t => quantity >= t.min_qty)
      .sort((a, b) => b.min_qty - a.min_qty)[0];
    return matchedTier ? matchedTier.tier_price : basePrice;
  };

  /**
   * Add retail product to hybrid cart
   */
  const addItem = (product: Product, unitName?: string, imeiSn?: string) => {
    const selectedUnitName = unitName || product.base_uom;
    const unitObj = product.units?.find(u => u.unit_name === selectedUnitName);
    const conversionFactor = unitObj ? unitObj.conversion_factor : 1;
    const baseSellingPrice = unitObj ? unitObj.selling_price : product.selling_price;

    setItems(prev => {
      // Check if same product with same UOM unit already in cart (only if not IMEI-tracked)
      const isIMEITracked = Boolean(imeiSn || product.requires_imei);
      const existingIndex = !isIMEITracked
        ? prev.findIndex(
            it => it.item_type === 'RETAIL' && it.product_id === product.id && (it.unit_name || product.base_uom) === selectedUnitName
          )
        : -1;

      if (existingIndex > -1) {
        const existing = prev[existingIndex];
        const newQty = existing.quantity + 1;
        // Check tier pricing for base unit
        const effectiveUnitPrice = selectedUnitName === product.base_uom
          ? getTieredPrice(product, newQty, baseSellingPrice)
          : baseSellingPrice;

        const updated = [...prev];
        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
          unit_price: effectiveUnitPrice,
          subtotal: (newQty * effectiveUnitPrice) - existing.discount_amount,
        };
        return updated;
      }

      // New item line
      const effectiveUnitPrice = selectedUnitName === product.base_uom
        ? getTieredPrice(product, 1, baseSellingPrice)
        : baseSellingPrice;

      const newItem: CartItem = {
        id: `retail-${product.id}-${selectedUnitName}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        item_type: 'RETAIL',
        product_id: product.id,
        sku: product.sku,
        barcode: unitObj ? unitObj.barcode || product.barcode : product.barcode,
        item_name: product.name,
        unit_name: selectedUnitName,
        conversion_factor: conversionFactor,
        quantity: 1,
        cost_price: product.cost_price * conversionFactor,
        base_unit_price: baseSellingPrice,
        unit_price: effectiveUnitPrice,
        discount_amount: 0,
        subtotal: effectiveUnitPrice,
        imei_sn: imeiSn,
      };

      return [...prev, newItem];
    });
  };

  /**
   * Add PPOB digital product to hybrid cart
   */
  const addPPOBItem = (ppobItem: {
    sku: string;
    product_name: string;
    target_no: string;
    customer_name?: string;
    selling_price: number;
    cost_price: number;
    admin_fee?: number;
  }) => {
    const newItem: CartItem = {
      id: `ppob-${ppobItem.sku}-${Date.now()}`,
      item_type: 'PPOB',
      item_name: ppobItem.product_name,
      quantity: 1,
      cost_price: ppobItem.cost_price,
      base_unit_price: ppobItem.selling_price,
      unit_price: ppobItem.selling_price,
      discount_amount: 0,
      subtotal: ppobItem.selling_price,
      ppob_sku: ppobItem.sku,
      ppob_target_no: ppobItem.target_no,
      ppob_customer_name: ppobItem.customer_name,
      ppob_admin_fee: ppobItem.admin_fee || 0,
    };

    setItems(prev => [...prev, newItem]);
  };

  /**
   * Update quantity of an item line (recalculates tier pricing)
   */
  const updateQuantity = (id: string, qty: number) => {
    if (qty <= 0) {
      removeItem(id);
      return;
    }

    setItems(prev =>
      prev.map(it => {
        if (it.id !== id) return it;
        // If retail, check if tier discount applies
        const newSubtotal = (qty * it.unit_price) - it.discount_amount;
        return {
          ...it,
          quantity: qty,
          subtotal: Math.max(0, newSubtotal),
        };
      })
    );
  };

  /**
   * Change UOM Unit of item (e.g. from Pcs to Dus)
   */
  const changeUnit = async (id: string, unitName: string) => {
    const item = items.find(it => it.id === id);
    if (!item || item.item_type !== 'RETAIL' || !item.product_id) return;

    try {
      const res = await fetch(`/api/products/lookup?q=${item.sku}`);
      if (!res.ok) return;
      const product: Product = await res.json();

      const unitObj = product.units?.find(u => u.unit_name === unitName);
      const conversion = unitObj ? unitObj.conversion_factor : 1;
      const newPrice = unitObj ? unitObj.selling_price : product.selling_price;

      setItems(prev =>
        prev.map(it => {
          if (it.id !== id) return it;
          return {
            ...it,
            unit_name: unitName,
            conversion_factor: conversion,
            base_unit_price: newPrice,
            unit_price: newPrice,
            cost_price: product.cost_price * conversion,
            subtotal: (it.quantity * newPrice) - it.discount_amount,
          };
        })
      );
    } catch (err) {
      console.error('Failed to change unit:', err);
    }
  };

  const updateDiscount = (id: string, discount: number) => {
    setItems(prev =>
      prev.map(it => {
        if (it.id !== id) return it;
        const validDiscount = Math.max(0, discount);
        return {
          ...it,
          discount_amount: validDiscount,
          subtotal: Math.max(0, (it.quantity * it.unit_price) - validDiscount),
        };
      })
    );
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(it => it.id !== id));
  };

  const clearCart = () => {
    setItems([]);
    setOverallDiscount(0);
  };

  /**
   * Hold Current Cart (F8)
   */
  const holdCurrentCart = async (label: string, customerName?: string) => {
    if (items.length === 0) throw new Error('Keranjang kosong, tidak ada yang dapat ditahan');

    const res = await fetch('/api/held-bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label,
        customer_name: customerName,
        cart: items,
        total_amount: grandTotal,
      }),
    });

    if (!res.ok) throw new Error('Gagal menahan transaksi');
    clearCart();
    await loadHeldBills();
  };

  /**
   * Recall Held Cart (F8)
   */
  const recallCart = async (heldBillId: number) => {
    const target = heldBills.find(b => b.id === heldBillId);
    if (!target) throw new Error('Transaksi tertahan tidak ditemukan');

    setItems(target.cart);
    // Delete from held_bills
    await fetch(`/api/held-bills/${heldBillId}`, { method: 'DELETE' });
    await loadHeldBills();
  };

  // Calculations
  const totalRetail = items
    .filter(it => it.item_type === 'RETAIL')
    .reduce((sum, it) => sum + it.subtotal, 0);

  const totalPPOB = items
    .filter(it => it.item_type === 'PPOB')
    .reduce((sum, it) => sum + it.subtotal, 0);

  const grandTotal = Math.max(0, totalRetail + totalPPOB - overallDiscount);
  const itemCount = items.reduce((sum, it) => sum + it.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        addPPOBItem,
        updateQuantity,
        updateDiscount,
        changeUnit,
        removeItem,
        clearCart,
        heldBills,
        loadHeldBills,
        holdCurrentCart,
        recallCart,
        totalRetail,
        totalPPOB,
        overallDiscount,
        setOverallDiscount,
        grandTotal,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
