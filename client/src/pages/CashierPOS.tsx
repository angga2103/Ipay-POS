import React, { useState, useEffect, useRef } from 'react';
import { 
  Barcode, Search, Zap, PauseCircle, PlayCircle, DollarSign, 
  Trash2, Plus, Minus, CreditCard, ShoppingBag, AlertCircle, 
  RefreshCw, CheckCircle2, ChevronDown, Tag, Smartphone, Grid, 
  List, X, ShieldAlert, Sparkles, SlidersHorizontal, Camera
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
import { CameraBarcodeScannerModal } from '../components/CameraBarcodeScannerModal';
import { playScanBeep, playErrorBoop } from '../utils/audio';
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
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogLayout, setCatalogLayout] = useState<'grid' | 'list'>('grid');
  const [mobileActiveTab, setMobileActiveTab] = useState<'cart' | 'catalog'>('cart');
  const [mobileCartPeekOpen, setMobileCartPeekOpen] = useState(false);
  const [lastHighlightedProductId, setLastHighlightedProductId] = useState<number | null>(null);

  // Modals state
  const [isPPOBOpen, setIsPPOBOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isHoldRecallOpen, setIsHoldRecallOpen] = useState(false);
  const [isCashInOutOpen, setIsCashInOutOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isDiscountOpen, setIsDiscountOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [lastReceiptText, setLastReceiptText] = useState('');
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [lastOrderItems, setLastOrderItems] = useState<any[]>([]);

  // IMEI Modal State
  const [isIMEIOpen, setIsIMEIOpen] = useState(false);
  const [pendingIMEIProduct, setPendingIMEIProduct] = useState<{ product: Product; unitName?: string } | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const catalogSearchInputRef = useRef<HTMLInputElement>(null);

  const focusCatalogSearch = () => {
    setMobileActiveTab('catalog');
    setTimeout(() => {
      catalogSearchInputRef.current?.focus();
      catalogSearchInputRef.current?.select();
    }, 50);
  };

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
          barcodeInputRef.current?.select();
          break;
        case 'F2':
          focusCatalogSearch();
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
          if (catalogSearch) {
            setCatalogSearch('');
          } else {
            barcodeInputRef.current?.focus();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items.length, catalogSearch]);

  // Central handler to add product (with IMEI interception if required)
  const handleProductSelect = (prod: Product, unitName?: string) => {
    playScanBeep();
    const chosenUnit = unitName || prod.base_uom;
    if (prod.requires_imei === 1) {
      setPendingIMEIProduct({ product: prod, unitName: chosenUnit });
      setIsIMEIOpen(true);
    } else {
      addItem(prod, chosenUnit);
      setLastHighlightedProductId(prod.id);
      setScanMessage({ text: `+1 ${prod.name} (${chosenUnit})`, type: 'success' });
      setTimeout(() => {
        setScanMessage(null);
        setLastHighlightedProductId(prev => (prev === prod.id ? null : prev));
      }, 2000);
    }
  };

  const handleIMEISubmit = (imeiSn: string) => {
    if (pendingIMEIProduct) {
      playScanBeep();
      addItem(pendingIMEIProduct.product, pendingIMEIProduct.unitName, imeiSn);
      setLastHighlightedProductId(pendingIMEIProduct.product.id);
      setScanMessage({ text: `+ ${pendingIMEIProduct.product.name} (IMEI terdaftar)`, type: 'success' });
      setTimeout(() => {
        setScanMessage(null);
        setLastHighlightedProductId(null);
      }, 2500);
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
        playErrorBoop();
        setScanMessage({ text: `Barcode '${query}' tidak ditemukan!`, type: 'error' });
        setTimeout(() => setScanMessage(null), 3000);
      }
    } catch {
      playErrorBoop();
      setScanMessage({ text: 'Gagal mencari produk', type: 'error' });
    }
  };

  // Handle Barcode Scan from Camera Modal
  const handleCameraScan = async (scannedBarcode: string) => {
    try {
      const res = await fetch(`/api/products/lookup?q=${encodeURIComponent(scannedBarcode)}`);
      if (res.ok) {
        const prod: Product = await res.json();
        handleProductSelect(prod, (prod as any).unit_name || prod.base_uom);
        setIsCameraOpen(false);
      } else {
        playErrorBoop();
        setScanMessage({ text: `Barcode kamera '${scannedBarcode}' tidak ditemukan!`, type: 'error' });
        setTimeout(() => setScanMessage(null), 3500);
      }
    } catch {
      playErrorBoop();
      setScanMessage({ text: 'Gagal memproses scan kamera', type: 'error' });
    }
  };

  const handlePaymentSuccess = (receiptText: string, order: any, items?: any[]) => {
    setLastReceiptText(receiptText);
    setLastOrder(order);
    setLastOrderItems(items || []);
    setIsReceiptOpen(true);
  };

  // Filtered products for Inline Catalog (by Category AND Instant Search Query)
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'ALL' || p.category_id === selectedCategory;
    if (!matchesCategory) return false;
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return true;
    const matchName = p.name?.toLowerCase().includes(q);
    const matchSku = p.sku?.toLowerCase().includes(q);
    const matchBarcode = p.barcode?.toLowerCase().includes(q);
    const matchUnitBarcode = p.units?.some(u => u.barcode?.toLowerCase().includes(q));
    return matchName || matchSku || matchBarcode || matchUnitBarcode;
  });

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-57px)] overflow-hidden bg-slate-100 pb-16 md:pb-0">
      {/* Top Action & Hotkey Toolbar */}
      <div className="bg-white border-b border-slate-200 px-3 md:px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-xs z-10">
        {/* Left: Barcode Scanner Input Form (F1) & Camera Scanner Button */}
        <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-1.5 sm:gap-2 flex-1 max-w-xs md:max-w-md">
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
              Scan
            </button>
          </div>

          {/* Camera Scanner Button for HP / Laptop / Tablet */}
          <button
            type="button"
            onClick={() => setIsCameraOpen(true)}
            className="px-2.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition cursor-pointer flex items-center justify-center gap-1 shrink-0 shadow-xs"
            title="Scan Barcode via Kamera HP/Laptop (Tanpa Scanner Fisik)"
          >
            <Camera className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline text-xs font-bold">Kamera</span>
          </button>

          {/* Quick Notification pill */}
          {scanMessage && (
            <div className={`hidden sm:block px-2.5 py-1.5 rounded-lg text-xs font-bold animate-fade-in truncate max-w-[200px] ${
              scanMessage.type === 'success' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
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
              onClick={() => setMobileActiveTab('catalog')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                mobileActiveTab === 'catalog' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500'
              }`}
            >
              Katalog
            </button>
            <button
              type="button"
              onClick={() => setMobileActiveTab('cart')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                mobileActiveTab === 'cart' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500'
              }`}
            >
              Keranjang ({itemCount})
            </button>
          </div>

          <button
            onClick={focusCatalogSearch}
            className="px-2.5 py-1.5 rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap min-h-[36px]"
            title="Fokus ke pencarian katalog produk di sebelah kiri (Tanpa menutup keranjang)"
          >
            <Search className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Cari Katalog</span>
            <span className="kbd-shortcut hidden md:inline">F2</span>
          </button>

          <button
            onClick={() => setIsPPOBOpen(true)}
            className="px-2.5 py-1.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap min-h-[36px]"
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

      {/* Main Content Area: Side-by-Side Split View (Catalog Left + Live Cart Right) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-2 md:p-3 gap-3">
        {/* Component 1: Inline Smart Product Catalog (Always visible alongside Cart on Desktop/Laptop) */}
        <div className={`flex-1 bg-white rounded-2xl border border-slate-200 shadow-xs flex-col overflow-hidden ${
          mobileActiveTab === 'catalog' ? 'flex' : 'hidden lg:flex'
        }`}>
          {/* Inline Catalog Search Bar & Layout Switcher (Replaces Popup Modal!) */}
          <div className="p-2.5 border-b border-slate-200 bg-white flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-blue-600 absolute left-3.5 top-2.5" />
              <input
                ref={catalogSearchInputRef}
                type="text"
                placeholder="Ketik nama produk, barcode, atau SKU untuk filter katalog... (F2)"
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden text-xs md:text-sm font-semibold bg-slate-50 focus:bg-white transition"
              />
              {catalogSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setCatalogSearch('');
                    catalogSearchInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 p-0.5 rounded-md cursor-pointer"
                  title="Bersihkan pencarian"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Toggle Grid vs List View */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setCatalogLayout('grid')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                  catalogLayout === 'grid'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Tampilan Grid Kartu"
              >
                <Grid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kartu</span>
              </button>
              <button
                type="button"
                onClick={() => setCatalogLayout('list')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
                  catalogLayout === 'list'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Tampilan Daftar Baris (Mudah pilih Multi-Satuan)"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Daftar</span>
              </button>
            </div>
          </div>

          {/* Category Filter Pills (Horizontal Scroll) */}
          <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-slate-50/70">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 min-h-[36px] ${
                selectedCategory === 'ALL'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Semua ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setIsPPOBOpen(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition cursor-pointer shrink-0 min-h-[36px] bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white shadow-xs flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 fill-white text-white" />
              <span>⚡ PPOB & Pulsa (F4)</span>
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 min-h-[36px] ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Product Catalog Content (Grid Mode or List Mode) */}
          <div className="flex-1 overflow-y-auto p-3">
            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs gap-2 py-12">
                <Search className="w-8 h-8 text-slate-300" />
                <p>Tidak ada produk yang cocok dengan pencarian <strong>"{catalogSearch}"</strong>.</p>
                {catalogSearch && (
                  <button
                    type="button"
                    onClick={() => setCatalogSearch('')}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs hover:bg-blue-100 cursor-pointer"
                  >
                    Tampilkan Semua Produk
                  </button>
                )}
              </div>
            ) : catalogLayout === 'grid' ? (
              /* MODE 1: TOUCH CARDS GRID (With Multi-UOM & In-Cart Live Controls) */
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {filteredProducts.map(prod => {
                  const inCartLines = items.filter(it => it.item_type === 'RETAIL' && it.product_id === prod.id);
                  const baseCartLine = inCartLines.find(it => (it.unit_name || prod.base_uom) === prod.base_uom);
                  const totalQtyInCart = inCartLines.reduce((sum, it) => sum + it.quantity, 0);
                  const isInCart = totalQtyInCart > 0;

                  return (
                    <div
                      key={prod.id}
                      className={`p-3 rounded-2xl border transition flex flex-col justify-between shadow-xs min-h-[135px] select-none relative ${
                        isInCart
                          ? 'border-emerald-500 bg-emerald-50/25 ring-2 ring-emerald-500/15'
                          : 'border-slate-200/90 hover:border-blue-400 bg-white'
                      }`}
                    >
                      {/* Top Area: Clickable to add 1 Base UOM */}
                      <div
                        onClick={() => handleProductSelect(prod, prod.base_uom)}
                        className="cursor-pointer group flex-1"
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] text-slate-400 font-mono truncate max-w-[85px]">
                            {prod.sku || prod.barcode}
                          </span>
                          {isInCart ? (
                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold flex items-center gap-0.5 shadow-2xs">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              {inCartLines.map(l => `${l.quantity} ${l.unit_name || prod.base_uom}`).join(', ')}
                            </span>
                          ) : prod.requires_imei === 1 ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase flex items-center gap-0.5">
                              <Smartphone className="w-2.5 h-2.5" />
                              IMEI
                            </span>
                          ) : null}
                        </div>

                        <h4 className="font-bold text-xs text-slate-800 line-clamp-2 leading-snug group-hover:text-blue-700 transition">
                          {prod.name}
                        </h4>

                        <div className="mt-1.5 flex items-baseline justify-between">
                          <span className="font-extrabold text-xs text-blue-700 font-mono">
                            Rp {(prod.selling_price ?? 0).toLocaleString('id-ID')}
                            <span className="text-[10px] font-normal text-slate-400">/{prod.base_uom || 'Pcs'}</span>
                          </span>
                          <span className={`text-[10px] font-semibold ${
                            (prod.stock_quantity ?? 0) <= 0 ? 'text-rose-500' : 'text-slate-400'
                          }`}>
                            Stok: {prod.stock_quantity ?? 0}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Area: Quick Add / Adjust Buttons + Multi-UOM */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5">
                        {/* Base Unit Control: If already in cart (and not IMEI), show [- qty +], else show [+ Unit] */}
                        {baseCartLine && prod.requires_imei !== 1 ? (
                          <div className="flex items-center justify-between bg-emerald-600 text-white rounded-xl p-1 shadow-xs">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuantity(baseCartLine.id, baseCartLine.quantity - 1);
                              }}
                              className="w-7 h-6 rounded-lg bg-emerald-700 hover:bg-emerald-800 flex items-center justify-center transition cursor-pointer font-bold"
                              title="Kurangi 1"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[11px] font-extrabold font-mono px-1 truncate">
                              {baseCartLine.quantity} {prod.base_uom || 'Pcs'}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleProductSelect(prod, prod.base_uom);
                              }}
                              className="w-7 h-6 rounded-lg bg-emerald-700 hover:bg-emerald-800 flex items-center justify-center transition cursor-pointer font-bold"
                              title="Tambah 1 lagi"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleProductSelect(prod, prod.base_uom);
                            }}
                            className="w-full py-1.5 px-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-2xs transition cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>+ {prod.base_uom || 'Pcs'}</span>
                          </button>
                        )}

                        {/* Multi-UOM Buttons directly on card if available */}
                        {prod.units && prod.units.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {prod.units.map(u => {
                              const unitLine = inCartLines.find(it => it.unit_name === u.unit_name);
                              return (
                                <button
                                  key={u.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleProductSelect(prod, u.unit_name);
                                  }}
                                  className={`flex-1 min-w-[45%] py-1 px-1.5 rounded-lg text-[10px] font-bold border transition cursor-pointer truncate ${
                                    unitLine
                                      ? 'bg-emerald-100 border-emerald-400 text-emerald-900'
                                      : 'bg-slate-100 hover:bg-blue-50 border-slate-200 hover:border-blue-300 text-slate-700'
                                  }`}
                                  title={`Tambah 1 ${u.unit_name} (isi ${u.conversion_factor} ${prod.base_uom}) - Rp ${(u.selling_price ?? 0).toLocaleString('id-ID')}`}
                                >
                                  {unitLine ? `✓ ${unitLine.quantity} ` : '+ '}{u.unit_name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* MODE 2: COMPACT LIST VIEW (Full Detail + Multi-UOM Side-by-Side) */
              <div className="space-y-2">
                {filteredProducts.map(prod => {
                  const inCartLines = items.filter(it => it.item_type === 'RETAIL' && it.product_id === prod.id);
                  const isInCart = inCartLines.length > 0;

                  return (
                    <div
                      key={prod.id}
                      className={`p-3 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                        isInCart
                          ? 'border-emerald-500 bg-emerald-50/30 ring-1 ring-emerald-500/20'
                          : 'border-slate-200 hover:border-blue-300 bg-white hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs md:text-sm text-slate-800">
                            {prod.name}
                          </span>
                          {isInCart && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Di Keranjang: {inCartLines.map(l => `${l.quantity} ${l.unit_name || prod.base_uom}`).join(', ')}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2 mt-0.5 flex-wrap">
                          <span>Barcode: {prod.barcode || prod.sku}</span>
                          <span>•</span>
                          <span className={(prod.stock_quantity ?? 0) <= 0 ? 'text-rose-600 font-bold' : ''}>
                            Stok: {prod.stock_quantity ?? 0} {prod.base_uom || 'Pcs'}
                          </span>
                          <span>•</span>
                          <span className="font-bold text-blue-700">
                            Rp {(prod.selling_price ?? 0).toLocaleString('id-ID')} / {prod.base_uom || 'Pcs'}
                          </span>
                        </div>
                      </div>

                      {/* Multi-UOM & Quick Add Buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                        <button
                          type="button"
                          onClick={() => handleProductSelect(prod, prod.base_uom)}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-97 text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ {prod.base_uom || 'Pcs'}</span>
                        </button>

                        {prod.units?.map(u => {
                          const unitLine = inCartLines.find(it => it.unit_name === u.unit_name);
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => handleProductSelect(prod, u.unit_name)}
                              className={`px-2.5 py-1.5 rounded-xl font-bold text-xs border transition cursor-pointer ${
                                unitLine
                                  ? 'bg-emerald-100 border-emerald-400 text-emerald-900'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                              }`}
                              title={`Jual 1 ${u.unit_name} (isi ${u.conversion_factor} ${prod.base_uom || 'Pcs'}) - Rp ${(u.selling_price ?? 0).toLocaleString('id-ID')}`}
                            >
                              {unitLine ? `✓ ${unitLine.quantity} ` : '+ '}{u.unit_name} ({u.conversion_factor} {prod.base_uom || 'Pcs'})
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mobile Live Cart Peek Drawer (So mobile users on 'Katalog' tab can still see & edit Cart without switching tabs!) */}
          {items.length > 0 && (
            <div className="lg:hidden border-t-2 border-blue-600 bg-slate-900 text-white">
              {mobileCartPeekOpen && (
                <div className="max-h-44 overflow-y-auto divide-y divide-slate-800 bg-slate-800/95 px-3 py-1.5">
                  <div className="flex items-center justify-between py-1 text-[10px] font-bold text-slate-400 uppercase">
                    <span>Daftar Barang di Keranjang ({itemCount})</span>
                    <button
                      type="button"
                      onClick={() => setMobileCartPeekOpen(false)}
                      className="text-blue-400 hover:text-blue-300 cursor-pointer"
                    >
                      Tutup Ringkasan ▼
                    </button>
                  </div>
                  {items.map(it => (
                    <div key={it.id} className="py-1.5 flex items-center justify-between gap-2 text-xs">
                      <div className="truncate flex-1">
                        <span className="font-bold text-white">{it.item_name}</span>
                        <span className="text-slate-400 font-mono text-[10px] ml-1.5">
                          ({it.quantity} {it.unit_name || 'Pcs'} = Rp {it.subtotal.toLocaleString('id-ID')})
                        </span>
                      </div>
                      {it.item_type === 'RETAIL' && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateQuantity(it.id, it.quantity - 1)}
                            className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-white"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-5 text-center font-mono font-bold text-[11px]">{it.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(it.id, it.quantity + 1)}
                            className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-white"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="p-2.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setMobileCartPeekOpen(!mobileCartPeekOpen)}
                  className="flex-1 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-300">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>{itemCount} Item di Keranjang</span>
                    <span className="underline text-[10px] text-amber-300 ml-1">
                      {mobileCartPeekOpen ? '(Sembunyikan ▼)' : '(Cek Item ▲)'}
                    </span>
                  </div>
                  <div className="text-sm font-black font-mono text-white">
                    Rp {grandTotal.toLocaleString('id-ID')}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileActiveTab('cart')}
                  className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold cursor-pointer"
                >
                  Detail
                </button>
                <button
                  type="button"
                  onClick={() => setIsPaymentOpen(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold cursor-pointer shadow-md"
                >
                  Bayar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Component 2: Hybrid Cart Table & Checkout Panel (Always Visible on Right Side) */}
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
                  Keranjang Kasir Live
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
                    Klik produk di katalog sebelah kiri, ketik pencarian (<span className="font-mono font-bold">F2</span>), scan barcode (<span className="font-mono font-bold">F1</span>), atau transaksi PPOB (<span className="font-mono font-bold">F4</span>).
                  </p>
                </div>
              ) : (
                items.map((it) => {
                  const isPPOB = it.item_type === 'PPOB';
                  const catalogProd = !isPPOB ? products.find(p => p.id === it.product_id) : undefined;
                  const isHighlighted = !isPPOB && lastHighlightedProductId === it.product_id;

                  return (
                    <div
                      key={it.id}
                      className={`p-3 transition-all duration-300 flex items-start justify-between gap-2 ${
                        isHighlighted
                          ? 'bg-emerald-50/90 border-l-4 border-l-emerald-500'
                          : isPPOB
                          ? 'bg-amber-50/20 hover:bg-slate-50/80'
                          : 'hover:bg-slate-50/80'
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

                        {/* PPOB Destination or Retail Unit & IMEI/SN */}
                        {isPPOB ? (
                          <div className="text-[10.5px] text-amber-800 font-mono truncate">
                            Tujuan: {it.ppob_target_no} {it.ppob_customer_name ? `(${it.ppob_customer_name})` : ''}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {it.imei_sn && (
                              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-mono">
                                <span>📱</span>
                                <span className="truncate max-w-[200px]">{it.imei_sn}</span>
                              </div>
                            )}
                            <div className="text-[10px] text-slate-500 font-mono">
                              @ Rp {it.unit_price.toLocaleString('id-ID')} / {it.unit_name || 'Pcs'}
                            </div>

                            {/* Inline Multi-UOM Unit Switcher right inside the Cart! */}
                            {catalogProd && catalogProd.units && catalogProd.units.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                <span className="text-[9px] text-slate-400 font-semibold">Satuan:</span>
                                <button
                                  type="button"
                                  onClick={() => changeUnit(it.id, catalogProd.base_uom)}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition cursor-pointer ${
                                    (it.unit_name || catalogProd.base_uom) === catalogProd.base_uom
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  }`}
                                >
                                  {catalogProd.base_uom}
                                </button>
                                {catalogProd.units.map(u => (
                                  <button
                                    key={u.id}
                                    type="button"
                                    onClick={() => changeUnit(it.id, u.unit_name)}
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition cursor-pointer ${
                                      it.unit_name === u.unit_name
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                  >
                                    {u.unit_name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Subtotal */}
                        <div className="mt-1 font-extrabold text-xs text-slate-900 font-mono">
                          Rp {it.subtotal.toLocaleString('id-ID')}
                        </div>
                      </div>

                      {/* Quantity & Delete Controls (With Direct Number Input & +/- Buttons) */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <button
                          onClick={() => removeItem(it.id)}
                          className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Hapus item ini dari keranjang"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {!isPPOB ? (
                          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                            <button
                              onClick={() => updateQuantity(it.id, it.quantity - 1)}
                              className="w-7 h-7 rounded-md bg-white hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center text-slate-700 transition cursor-pointer shadow-2xs"
                              title="Kurangi 1"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={it.quantity}
                              onChange={e => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val) && val > 0) {
                                  updateQuantity(it.id, val);
                                }
                              }}
                              className="w-10 text-center font-bold font-mono text-xs bg-transparent focus:bg-white focus:outline-hidden rounded py-0.5"
                            />
                            <button
                              onClick={() => updateQuantity(it.id, it.quantity + 1)}
                              className="w-7 h-7 rounded-md bg-white hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center text-slate-700 transition cursor-pointer shadow-2xs"
                              title="Tambah 1"
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

      {/* In-Browser Camera Barcode Scanner Modal */}
      <CameraBarcodeScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScanSuccess={handleCameraScan}
      />
    </div>
  );
};
