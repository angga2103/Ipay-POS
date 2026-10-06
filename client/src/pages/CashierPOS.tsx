import React, { useState, useEffect, useRef } from 'react';
import { 
  Barcode, Search, Zap, PauseCircle, PlayCircle, DollarSign, 
  Trash2, Plus, Minus, CreditCard, ShoppingBag, AlertCircle, 
  RefreshCw, CheckCircle2, ChevronDown, Tag, Smartphone, Grid, 
  List, X, ShieldAlert, Sparkles, SlidersHorizontal
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useShift } from '../context/ShiftContext';
import { PPOBQuickModal } from '../components/PPOBQuickModal';
import { PaymentModal } from '../components/PaymentModal';
import { HoldRecallModal } from '../components/HoldRecallModal';
import { CashInOutModal } from '../components/CashInOutModal';
import { ProductSearchModal } from '../components/ProductSearchModal';
import { ReceiptModal } from '../components/ReceiptModal';
import { IMEIPromptModal } from '../components/IMEIPromptModal';
import { DiscountModal } from '../components/DiscountModal';
import { Product } from '../types';

export const CashierPOS: React.FC = () => {
  const { 
    items, addItem, updateQuantity, changeUnit, updateDiscount, 
    removeItem, clearCart, totalRetail, totalPPOB, overallDiscount, 
    setOverallDiscount, grandTotal, itemCount, heldBills 
  } = useCart();

  const { activeShift } = useShift();

  // Input states
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanMessage, setScanMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Catalog & Quick Products for Touchscreen/Tablet
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | 'ALL'>('ALL');
  const [viewMode, setViewMode] = useState<'hybrid' | 'touch_grid' | 'table_only'>('hybrid');
  const [mobileActiveTab, setMobileActiveTab] = useState<'cart' | 'catalog'>('cart');

  // Modals state
  const [isPPOBOpen, setIsPPOBOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isHoldRecallOpen, setIsHoldRecallOpen] = useState(false);
  const [isCashInOutOpen, setIsCashInOutOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [lastReceiptText, setLastReceiptText] = useState('');
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [lastOrderItems, setLastOrderItems] = useState<any[]>([]);

  // IMEI Modal State
  const [isIMEIOpen, setIsIMEIOpen] = useState(false);
  const [pendingIMEIProduct, setPendingIMEIProduct] = useState<{ product: Product; unitName?: string } | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Load products & categories for quick touch grid
  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => setProducts(Array.isArray(data) ? data : []))
      .catch(err => console.error('Failed to load products:', err));

    fetch('/api/categories')
      .then(res => res.json())
      .then(data => setCategories(Array.isArray(data) ? data : []))
      .catch(err => console.error('Failed to load categories:', err));
  }, []);

  // Focus barcode input on mount and F1
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  // Global Keyboard Shortcuts (Minimarket Hotkeys F1-F12)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent browser default actions for POS hotkeys
      if (['F1', 'F2', 'F4', 'F8', 'F9', 'F10', 'F12'].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case 'F1':
          barcodeInputRef.current?.focus();
          break;
        case 'F2':
          setIsSearchOpen(true);
          break;
        case 'F4':
          setIsPPOBOpen(true);
          break;
        case 'F8':
          setIsHoldRecallOpen(true);
          break;
        case 'F9':
          setIsDiscountOpen(true);
          break;
        case 'F10':
          setIsCashInOutOpen(true);
          break;
        case 'F12':
          if (items.length > 0) {
            setIsPaymentOpen(true);
          }
          break;
        case 'Escape':
          setIsPPOBOpen(false);
          setIsPaymentOpen(false);
          setIsHoldRecallOpen(false);
          setIsCashInOutOpen(false);
          setIsSearchOpen(false);
          setIsReceiptOpen(false);
          setIsDiscountOpen(false);
          setIsIMEIOpen(false);
          barcodeInputRef.current?.focus();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items.length]);

  // Central handler to add product (with IMEI interception if required)
  const handleProductSelect = (prod: Product, unitName?: string) => {
    if (prod.requires_imei === 1) {
      setPendingIMEIProduct({ product: prod, unitName });
      setIsIMEIOpen(true);
    } else {
      addItem(prod, unitName);
      setScanMessage({ text: `+ ${prod.name} ditambahkan`, type: 'success' });
      setTimeout(() => setScanMessage(null), 2500);
    }
  };

  const handleIMEISubmit = (imeiSn: string) => {
    if (pendingIMEIProduct) {
      addItem(pendingIMEIProduct.product, pendingIMEIProduct.unitName, imeiSn);
      setScanMessage({ text: `+ ${pendingIMEIProduct.product.name} (IMEI terdaftar)`, type: 'success' });
      setTimeout(() => setScanMessage(null), 2500);
      setPendingIMEIProduct(null);
      setIsIMEIOpen(false);
    }
  };

  // Handle Barcode Scan / Enter
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = barcodeInput.trim();
    if (!query) return;

    try {
      const res = await fetch(`/api/products/lookup?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const prod: Product = await res.json();
        setBarcodeInput('');
        handleProductSelect(prod, (prod as any).unit_name || prod.base_uom);
      } else {
        setScanMessage({ text: `Barcode '${query}' tidak ditemukan!`, type: 'error' });
        setTimeout(() => setScanMessage(null), 3000);
      }
    } catch {
      setScanMessage({ text: 'Gagal mencari produk', type: 'error' });
    }
  };

  const handlePaymentSuccess = (receiptText: string, order: any, items?: any[]) => {
    setLastReceiptText(receiptText);
    setLastOrder(order);
    setLastOrderItems(items || []);
    setIsReceiptOpen(true);
  };

  // Filtered products for Touch Grid
  const filteredProducts = products.filter(p => {
    if (selectedCategory === 'ALL') return true;
    return p.category_id === selectedCategory;
  });

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-57px)] overflow-hidden bg-slate-100 pb-16 md:pb-0">
      {/* Top Action & Hotkey Toolbar */}
      <div className="bg-white border-b border-slate-200 px-3 md:px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-xs z-10">
        {/* Left: Barcode Scanner Input Form (F1) */}
        <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-2 flex-1 max-w-xs md:max-w-md">
          <div className="relative flex-1">
            <Barcode className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="Scan Barcode / SKU (F1)..."
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              className="w-full pl-10 pr-16 md:pr-20 py-2 rounded-xl border-2 border-slate-300 focus:border-blue-600 focus:outline-hidden font-mono text-xs md:text-sm font-bold bg-slate-50 focus:bg-white transition"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 px-2 py-1 bg-blue-600 text-white font-bold text-xs rounded-lg hover:bg-blue-700 transition cursor-pointer"
            >
              Cari
            </button>
          </div>

          {/* Quick Notification pill */}
          {scanMessage && (
            <div className={`hidden sm:block px-2.5 py-1.5 rounded-lg text-xs font-bold animate-fade-in truncate max-w-[180px] ${
              scanMessage.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {scanMessage.text}
            </div>
          )}
        </form>

        {/* Right: Quick Action Buttons & View Mode Switcher */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {/* Mobile / Tablet Segment View Switcher (Visible on mobile/tablet) */}
          <div className="flex lg:hidden bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setMobileActiveTab('cart')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                mobileActiveTab === 'cart' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500'
              }`}
            >
              Keranjang ({itemCount})
            </button>
            <button
              type="button"
              onClick={() => setMobileActiveTab('catalog')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                mobileActiveTab === 'catalog' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500'
              }`}
            >
              Katalog
            </button>
          </div>

          <button
            onClick={() => setIsSearchOpen(true)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap min-h-[36px]"
          >
            <Search className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Katalog</span>
            <span className="kbd-shortcut hidden md:inline">F2</span>
          </button>

          <button
            onClick={() => setIsPPOBOpen(true)}
            className="px-2.5 py-1.5 rounded-xl border border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-blue-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap min-h-[36px]"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span>PPOB</span>
            <span className="kbd-shortcut hidden md:inline">F4</span>
          </button>

          <button
            onClick={() => setIsHoldRecallOpen(true)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer relative whitespace-nowrap min-h-[36px]"
          >
            <PauseCircle className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Tahan</span>
            {heldBills.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">
                {heldBills.length}
              </span>
            )}
            <span className="kbd-shortcut hidden md:inline">F8</span>
          </button>

          <button
            onClick={() => setIsCashInOutOpen(true)}
            className="hidden md:flex px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold items-center gap-1.5 transition cursor-pointer min-h-[36px]"
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            <span>Kas</span>
            <span className="kbd-shortcut">F10</span>
          </button>

          <button
            onClick={() => {
              if (confirm('Yakin ingin mengosongkan seluruh keranjang belanja?')) {
                clearCart();
              }
            }}
            disabled={items.length === 0}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-30 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
            title="Kosongkan Keranjang"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area: Adaptive Split View for Tablet/Desktop & Switchable on Mobile */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-2 md:p-3 gap-3">
        {/* Component 1: Quick Touch Product Grid (Visible on Desktop / Tablet / or when Mobile tab is 'catalog') */}
        <div className={`flex-1 bg-white rounded-2xl border border-slate-200 shadow-xs flex-col overflow-hidden ${
          mobileActiveTab === 'catalog' ? 'flex' : 'hidden lg:flex'
        }`}>
          {/* Category Filter Pills (Horizontal Scroll, Touch Friendly >= 40px) */}
          <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-slate-50/70">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 min-h-[38px] ${
                selectedCategory === 'ALL'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Semua Produk
            </button>
            <button
              type="button"
              onClick={() => setIsPPOBOpen(true)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition cursor-pointer shrink-0 min-h-[38px] bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white shadow-xs flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 fill-white text-white" />
              <span>⚡ PPOB & Pulsa (F4)</span>
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 min-h-[38px] ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Product Cards Grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs">
                Tidak ada produk di kategori ini.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {filteredProducts.map(prod => (
                  <div
                    key={prod.id}
                    onClick={() => handleProductSelect(prod, prod.base_uom)}
                    className="p-3 rounded-2xl border border-slate-200/90 hover:border-blue-500 hover:bg-blue-50/40 active:scale-97 transition cursor-pointer flex flex-col justify-between shadow-xs bg-white min-h-[105px] group select-none"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-slate-400 font-mono truncate max-w-[80px]">
                          {prod.sku}
                        </span>
                        {prod.requires_imei === 1 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 uppercase flex items-center gap-0.5">
                            <Smartphone className="w-2.5 h-2.5" />
                            IMEI
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-xs text-slate-800 line-clamp-2 leading-snug group-hover:text-blue-700 transition">
                        {prod.name}
                      </h4>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="font-extrabold text-xs text-blue-600 font-mono">
                        Rp {(prod.selling_price ?? 0).toLocaleString('id-ID')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {prod.stock_quantity ?? 0} {prod.base_uom || 'Pcs'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Component 2: Hybrid Cart Table & Checkout Panel */}
        <div className={`w-full lg:w-[460px] xl:w-[490px] flex-col gap-3 overflow-hidden ${
          mobileActiveTab === 'cart' ? 'flex flex-1' : 'hidden lg:flex'
        }`}>
          {/* Cart Table Container */}
          <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
            {/* Cart Header */}
            <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-blue-600" />
                <h2 className="font-extrabold text-xs md:text-sm text-slate-800">
                  Keranjang Kasir
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold font-mono">
                  {itemCount} item
                </span>
              </div>

              <div className="text-[11px] text-slate-500 font-medium">
                {activeShift ? `Shift: ${activeShift.shift_number}` : 'Shift Buka'}
              </div>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-2.5">
                    <Barcode className="w-7 h-7" />
                  </div>
                  <h3 className="font-bold text-sm text-slate-700">Keranjang Kasir Kosong</h3>
                  <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                    Pilih produk dari katalog di sebelah kiri, scan barcode (<span className="font-mono font-bold">F1</span>), atau transaksi PPOB (<span className="font-mono font-bold">F4</span>).
                  </p>
                </div>
              ) : (
                items.map((it, idx) => {
                  const isPPOB = it.item_type === 'PPOB';
                  return (
                    <div
                      key={it.id}
                      className={`p-3 hover:bg-slate-50/80 transition flex items-start justify-between gap-2 ${
                        isPPOB ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                            isPPOB ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-blue-100 text-blue-900 border border-blue-200'
                          }`}>
                            {it.item_type}
                          </span>
                          <span className="font-bold text-xs text-slate-800 truncate block">
                            {it.item_name}
                          </span>
                        </div>

                        {/* PPOB Destination or IMEI/SN */}
                        {isPPOB ? (
                          <div className="text-[10.5px] text-amber-800 font-mono truncate">
                            Tujuan: {it.ppob_target_no} {it.ppob_customer_name ? `(${it.ppob_customer_name})` : ''}
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            {it.imei_sn && (
                              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-mono">
                                <span>📱</span>
                                <span className="truncate max-w-[200px]">{it.imei_sn}</span>
                              </div>
                            )}
                            <div className="text-[10px] text-slate-400 font-mono">
                              @ Rp {it.unit_price.toLocaleString('id-ID')} / {it.unit_name || 'Pcs'}
                            </div>
                          </div>
                        )}

                        {/* Subtotal */}
                        <div className="mt-1 font-extrabold text-xs text-slate-900 font-mono">
                          Rp {it.subtotal.toLocaleString('id-ID')}
                        </div>
                      </div>

                      {/* Quantity & Delete Controls (Large touch targets >= 36px) */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <button
                          onClick={() => removeItem(it.id)}
                          className="p-1 rounded text-slate-300 hover:text-rose-600 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {!isPPOB ? (
                          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                            <button
                              onClick={() => updateQuantity(it.id, it.quantity - 1)}
                              className="w-7 h-7 rounded-md bg-white hover:bg-slate-200 flex items-center justify-center text-slate-700 transition cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center font-bold font-mono text-xs">
                              {it.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(it.id, it.quantity + 1)}
                              className="w-7 h-7 rounded-md bg-white hover:bg-slate-200 flex items-center justify-center text-slate-700 transition cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 px-2 py-1 bg-slate-100 rounded">
                            1x Digital
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Checkout Totals & Giant Pay Button */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs space-y-3">
            {/* Totals Summary */}
            <div className="bg-slate-900 text-white rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-blue-300 uppercase font-semibold">Total Tagihan</span>
                <div className="text-2xl font-black font-mono tracking-tight text-white">
                  Rp {grandTotal.toLocaleString('id-ID')}
                </div>
              </div>
              <div className="text-right text-[11px] text-slate-300 space-y-0.5">
                <div>Ritel: Rp {totalRetail.toLocaleString('id-ID')}</div>
                <div>PPOB: Rp {totalPPOB.toLocaleString('id-ID')}</div>
                <button
                  type="button"
                  onClick={() => setIsDiscountOpen(true)}
                  className="inline-flex items-center gap-1 font-bold text-amber-300 hover:text-amber-200 cursor-pointer underline transition-colors"
                >
                  <Tag className="w-3 h-3" />
                  {overallDiscount > 0 ? `Disc: -Rp ${overallDiscount.toLocaleString('id-ID')}` : '+ Diskon (F9)'}
                </button>
              </div>
            </div>

            {/* Giant Pay Button (F12) - Touch Target >= 52px */}
            <button
              onClick={() => setIsPaymentOpen(true)}
              disabled={items.length === 0}
              className={`w-full py-3.5 px-4 rounded-xl text-sm md:text-base font-black shadow-lg flex items-center justify-between transition cursor-pointer min-h-[52px] ${
                items.length === 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-600/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                <span>BAYAR (F12)</span>
              </div>
              <span className="font-mono text-base font-bold">
                Rp {grandTotal.toLocaleString('id-ID')}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <PPOBQuickModal
        isOpen={isPPOBOpen}
        onClose={() => setIsPPOBOpen(false)}
      />

      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        onSuccess={handlePaymentSuccess}
      />

      <HoldRecallModal
        isOpen={isHoldRecallOpen}
        onClose={() => setIsHoldRecallOpen(false)}
      />

      <CashInOutModal
        isOpen={isCashInOutOpen}
        onClose={() => setIsCashInOutOpen(false)}
      />

      <ProductSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectProduct={handleProductSelect}
      />

      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        receiptText={lastReceiptText}
        invoiceNo={lastOrder?.invoice_no}
        order={lastOrder}
        orderItems={lastOrderItems}
        customerPhone={
          lastOrder?.customer_phone || 
          lastOrderItems?.find((it: any) => it.ppob_target_no)?.ppob_target_no || 
          ''
        }
      />

      <DiscountModal
        isOpen={isDiscountOpen}
        onClose={() => setIsDiscountOpen(false)}
        currentDiscount={overallDiscount}
        subtotal={totalRetail + totalPPOB}
        onApply={(amt) => setOverallDiscount(amt)}
      />

      {/* Konter HP IMEI Prompt Modal */}
      {pendingIMEIProduct && (
        <IMEIPromptModal
          product={pendingIMEIProduct.product}
          isOpen={isIMEIOpen}
          onClose={() => {
            setIsIMEIOpen(false);
            setPendingIMEIProduct(null);
          }}
          onSubmit={handleIMEISubmit}
        />
      )}
    </div>
  );
};
