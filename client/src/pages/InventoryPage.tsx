import React, { useState, useEffect } from 'react';
import { 
  Package, Layers, Calendar, ClipboardCheck, Plus, 
  Search, AlertTriangle, ArrowUpDown, Check, RefreshCw, 
  Edit3, Trash2, Smartphone, DollarSign, X, Save, ScanBarcode, 
  Tag, ArrowRight, Truck, Info, Percent, TrendingUp, Coins
} from 'lucide-react';
import { Product, ProductUnit, ProductTier, InventoryValuation } from '../types';

export const InventoryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'products' | 'batches' | 'opname'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Array<{ id: number; name: string; code: string }>>([]);
  const [expiringBatches, setExpiringBatches] = useState<any[]>([]);
  const [valuationData, setValuationData] = useState<InventoryValuation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);

  // Stock Opname Form
  const [opnameItems, setOpnameItems] = useState<Record<number, number>>({});
  const [opnameNotes, setOpnameNotes] = useState('');
  const [opnameSuccess, setOpnameSuccess] = useState<string | null>(null);

  // Product Add / Edit Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [productForm, setProductForm] = useState({
    sku: '',
    barcode: '',
    name: '',
    category_id: '' as string | number,
    base_uom: 'Pcs',
    cost_price: '',
    selling_price: '',
    stock_quantity: '',
    min_stock_alert: '5',
    requires_imei: 0,
    units: [] as Array<{ unit_name: string; conversion_factor: number; barcode: string; selling_price: number }>,
    tiers: [] as Array<{ min_qty: number; tier_price: number }>,
  });

  // Goods Receipt / Restock Modal State
  const [isGRNModalOpen, setIsGRNModalOpen] = useState(false);
  const [grnSelectedProduct, setGrnSelectedProduct] = useState<Product | null>(null);
  const [grnForm, setGrnForm] = useState({
    receivedQty: '',
    unitCost: '',
    paymentMethod: 'CASH' as 'CASH' | 'HUTANG',
    batchNumber: '',
    expiryDate: '',
  });

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const fetchBatches = async () => {
    try {
      const res = await fetch('/api/inventory/batches/expiring?days=120');
      const data = await res.json();
      setExpiringBatches(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load expiring batches:', err);
    }
  };

  const fetchValuation = async () => {
    try {
      const res = await fetch('/api/inventory/valuation');
      const data = await res.json();
      setValuationData(data);
    } catch (err) {
      console.error('Failed to load inventory valuation:', err);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchBatches();
    fetchValuation();
  }, []);

  // Filtered Products
  const filteredProducts = products.filter(p => {
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = 
      selectedCategoryFilter === 'ALL' || 
      String(p.category_id) === selectedCategoryFilter;

    return matchesSearch && matchesCategory;
  });

  // Open modal for Adding new product
  const handleOpenAddModal = () => {
    setEditingProductId(null);
    setProductForm({
      sku: `PROD-${Date.now().toString().slice(-6)}`,
      barcode: `${Math.floor(1000000000000 + Math.random() * 9000000000000)}`,
      name: '',
      category_id: categories.length > 0 ? categories[0].id : '',
      base_uom: 'Pcs',
      cost_price: '',
      selling_price: '',
      stock_quantity: '0',
      min_stock_alert: '5',
      requires_imei: 0,
      units: [],
      tiers: [],
    });
    setIsProductModalOpen(true);
  };

  // Open modal for Editing existing product
  const handleOpenEditModal = (p: Product) => {
    setEditingProductId(p.id);
    setProductForm({
      sku: p.sku,
      barcode: p.barcode,
      name: p.name,
      category_id: p.category_id || (categories.length > 0 ? categories[0].id : ''),
      base_uom: p.base_uom || 'Pcs',
      cost_price: String(p.cost_price),
      selling_price: String(p.selling_price),
      stock_quantity: String(p.stock_quantity),
      min_stock_alert: String(p.min_stock_alert || 5),
      requires_imei: p.requires_imei || 0,
      units: (p.units || []).map(u => ({
        unit_name: u.unit_name,
        conversion_factor: u.conversion_factor,
        barcode: u.barcode || '',
        selling_price: u.selling_price,
      })),
      tiers: (p.tiers || []).map(t => ({
        min_qty: t.min_qty,
        tier_price: t.tier_price,
      })),
    });
    setIsProductModalOpen(true);
  };

  // Save product (Insert or Update)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name || !productForm.sku || !productForm.barcode) {
      alert('Nama produk, SKU, dan Barcode wajib diisi!');
      return;
    }

    const payload = {
      ...productForm,
      category_id: productForm.category_id ? parseInt(String(productForm.category_id), 10) : null,
      cost_price: parseFloat(productForm.cost_price) || 0,
      selling_price: parseFloat(productForm.selling_price) || 0,
      stock_quantity: parseFloat(productForm.stock_quantity) || 0,
      min_stock_alert: parseFloat(productForm.min_stock_alert) || 5,
      requires_imei: productForm.requires_imei ? 1 : 0,
    };

    try {
      const url = editingProductId ? `/api/products/${editingProductId}` : '/api/products';
      const method = editingProductId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setIsProductModalOpen(false);
        fetchProducts();
        fetchValuation();
        alert(editingProductId ? 'Produk berhasil diperbarui!' : 'Produk baru berhasil ditambahkan!');
      } else {
        alert(data.error || 'Gagal menyimpan produk');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  // Delete product
  const handleDeleteProduct = async (p: Product) => {
    if (!confirm(`Yakin ingin menghapus produk "${p.name}"?`)) return;

    try {
      const res = await fetch(`/api/products/${p.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Produk berhasil diproses');
        fetchProducts();
        fetchValuation();
      } else {
        alert(data.error || 'Gagal menghapus produk');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  // Open Goods Receipt / Restock Modal
  const handleOpenGRNModal = (p: Product) => {
    setGrnSelectedProduct(p);
    setGrnForm({
      receivedQty: '',
      unitCost: String(p.cost_price),
      paymentMethod: 'CASH',
      batchNumber: `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
      expiryDate: '',
    });
    setIsGRNModalOpen(true);
  };

  // Execute Goods Receipt
  const handleSaveGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grnSelectedProduct) return;

    const qty = parseFloat(grnForm.receivedQty);
    const cost = parseFloat(grnForm.unitCost);
    if (!qty || qty <= 0 || cost <= 0) {
      alert('Kuantitas dan harga modal beli harus lebih dari 0');
      return;
    }

    try {
      const res = await fetch('/api/inventory/goods-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: grnSelectedProduct.id,
          receivedQty: qty,
          unitCost: cost,
          paymentMethod: grnForm.paymentMethod,
          batchNumber: grnForm.batchNumber || undefined,
          expiryDate: grnForm.expiryDate || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert(`Stok berhasil ditambah! HPP rata-rata baru: Rp ${data.newAverageCost.toLocaleString('id-ID')} / ${grnSelectedProduct.base_uom}`);
        setIsGRNModalOpen(false);
        fetchProducts();
        fetchBatches();
        fetchValuation();
      } else {
        alert(data.error || 'Gagal menyimpan penerimaan barang');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  // Helper: Add Multi-UOM row
  const addUOMRow = () => {
    setProductForm({
      ...productForm,
      units: [
        ...productForm.units,
        { unit_name: '', conversion_factor: 1, barcode: '', selling_price: 0 },
      ],
    });
  };

  // Helper: Remove Multi-UOM row
  const removeUOMRow = (index: number) => {
    setProductForm({
      ...productForm,
      units: productForm.units.filter((_, idx) => idx !== index),
    });
  };

  // Helper: Add Tiered pricing row
  const addTierRow = () => {
    setProductForm({
      ...productForm,
      tiers: [
        ...productForm.tiers,
        { min_qty: 10, tier_price: parseFloat(productForm.selling_price) || 0 },
      ],
    });
  };

  // Helper: Remove Tiered pricing row
  const removeTierRow = (index: number) => {
    setProductForm({
      ...productForm,
      tiers: productForm.tiers.filter((_, idx) => idx !== index),
    });
  };

  // Stock Opname Handler
  const handleExecuteOpname = async () => {
    const items = Object.entries(opnameItems).map(([prodId, physicalQty]) => ({
      productId: parseInt(prodId, 10),
      physicalStock: physicalQty,
    }));

    if (items.length === 0) {
      alert('Masukkan minimal 1 produk untuk disesuaikan');
      return;
    }

    try {
      const res = await fetch('/api/inventory/stock-opname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 1,
          notes: opnameNotes || 'Audit Stok Fisik Toko',
          items,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setOpnameSuccess(`Stock Opname ${data.opnameNo} berhasil disimpan! Selisih nilai tercatat di buku besar.`);
        setOpnameItems({});
        setOpnameNotes('');
        fetchProducts();
        fetchValuation();
        setTimeout(() => setOpnameSuccess(null), 5000);
      } else {
        alert(data.error || 'Gagal menyimpan stock opname');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-57px)] overflow-hidden bg-slate-100 p-3 md:p-4 space-y-3 pb-16 md:pb-4">
      {/* Page Title & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 md:p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-base md:text-lg font-black text-slate-800 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            <span>Katalog & Manajemen Inventaris</span>
          </h1>
          <p className="text-xs text-slate-500">
            Input & edit barang, Multi-UOM, harga bertingkat, restock HPP Moving Average, dan FEFO
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'products' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Katalog ({products.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('batches')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'batches' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-amber-500" />
            <span>FEFO Expiry</span>
            {expiringBatches.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px]">
                {expiringBatches.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('opname')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'opname' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Stock Opname</span>
          </button>
        </div>
      </div>

      {/* Total Inventory Valuation (Nilai Keseluruhan Produk) */}
      {valuationData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3">
          {/* Card 1: Total Modal Persediaan (HPP) */}
          <div className="bg-white p-3 rounded-2xl border border-blue-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total Modal Stok (HPP)
              </span>
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="text-base md:text-lg font-black font-mono text-blue-700 mt-0.5">
              Rp {valuationData.summary.total_cost_value.toLocaleString('id-ID')}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              Total nominal aset modal barang
            </p>
          </div>

          {/* Card 2: Total Potensi Penjualan */}
          <div className="bg-white p-3 rounded-2xl border border-indigo-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total Nilai Jual
              </span>
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                <Tag className="w-4 h-4" />
              </div>
            </div>
            <div className="text-base md:text-lg font-black font-mono text-indigo-700 mt-0.5">
              Rp {valuationData.summary.total_retail_value.toLocaleString('id-ID')}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              Potensi omzet jika stok terjual habis
            </p>
          </div>

          {/* Card 3: Estimasi Laba Kotor */}
          <div className="bg-white p-3 rounded-2xl border border-emerald-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Potensi Laba Kotor
              </span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-base md:text-lg font-black font-mono text-emerald-600 mt-0.5">
              Rp {valuationData.summary.potential_gross_profit.toLocaleString('id-ID')}
            </div>
            <p className="text-[10px] text-emerald-700 font-bold mt-0.5 truncate">
              Margin Proyeksi: ~{valuationData.summary.potential_margin_percent}%
            </p>
          </div>

          {/* Card 4: Total SKU & Unit Fisik */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Total Fisik Barang
              </span>
              <div className="p-1.5 rounded-lg bg-slate-50 text-slate-600">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="text-base md:text-lg font-black font-mono text-slate-800 mt-0.5">
              {valuationData.summary.total_units.toLocaleString('id-ID')} Unit
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
              {valuationData.summary.total_sku} SKU • {valuationData.summary.low_stock_count} item menipis
            </p>
          </div>
        </div>
      )}

      {/* Main Tab Content */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
        {activeTab === 'products' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search, Category Filter, and Action Buttons */}
            <div className="p-3 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-1">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Cari nama, barcode, atau SKU..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs font-medium focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                {/* Category Filter Dropdown */}
                <select
                  value={selectedCategoryFilter}
                  onChange={e => setSelectedCategoryFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white text-slate-700 focus:outline-hidden"
                >
                  <option value="ALL">Semua Kategori</option>
                  {categories.map(c => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Action Buttons: Tambah Produk Baru & Refresh */}
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchProducts}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
                  title="Segarkan Data"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>

                <button
                  onClick={handleOpenAddModal}
                  className="py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Produk Baru</span>
                </button>
              </div>
            </div>

            {/* Products Table */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10.5px] font-bold sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Produk & Identitas</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-3 text-center">Stok Sistem</th>
                    <th className="py-2.5 px-3 text-right">HPP (Modal Beli)</th>
                    <th className="py-2.5 px-3 text-right">Harga Jual</th>
                    <th className="py-2.5 px-3">Multi-Satuan (UOM)</th>
                    <th className="py-2.5 px-3">Harga Grosir</th>
                    <th className="py-2.5 px-3 text-center w-28">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Tidak ada produk yang cocok dengan pencarian / filter.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-800 text-[12.5px]">{p.name}</span>
                            {p.requires_imei === 1 && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-extrabold text-[9px] uppercase flex items-center gap-0.5">
                                <Smartphone className="w-2.5 h-2.5" />
                                IMEI
                              </span>
                            )}
                          </div>
                          <div className="text-[10.5px] text-slate-400 font-mono mt-0.5">
                            SKU: {p.sku} | Barcode: {p.barcode}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-medium">
                          {p.category_name || '-'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                            p.stock_quantity <= p.min_stock_alert
                              ? 'bg-rose-100 text-rose-800 animate-pulse'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {p.stock_quantity} {p.base_uom}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-600">
                          Rp {p.cost_price.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-blue-700">
                          Rp {p.selling_price.toLocaleString('id-ID')} / {p.base_uom}
                        </td>

                        {/* Multi-UOM units */}
                        <td className="py-3 px-3">
                          {p.units && p.units.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {p.units.map(u => (
                                <span
                                  key={u.id}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-semibold border border-slate-200"
                                >
                                  1 {u.unit_name} = {u.conversion_factor} {p.base_uom} (Rp {u.selling_price.toLocaleString('id-ID')})
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">Hanya {p.base_uom}</span>
                          )}
                        </td>

                        {/* Tiered Wholesale Pricing */}
                        <td className="py-3 px-3">
                          {p.tiers && p.tiers.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {p.tiers.map((t, idx) => (
                                <span
                                  key={idx}
                                  className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[10px] font-semibold border border-amber-200"
                                >
                                  &ge;{t.min_qty} pcs: Rp {t.tier_price.toLocaleString('id-ID')}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>

                        {/* Action buttons (Restock, Edit, Delete) */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenGRNModal(p)}
                              title="Terima Barang / Restock Supplier"
                              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
                            >
                              <Truck className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(p)}
                              title="Edit Data Produk"
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p)}
                              title="Hapus / Nonaktifkan"
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: FEFO & Batch Expiry Tracking */}
        {activeTab === 'batches' && (
          <div className="p-4 overflow-y-auto space-y-4">
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="text-xs text-amber-800">
                <span className="font-bold">FEFO (First Expired, First Out):</span> Sistem merekomendasikan dan memotong stok dari batch dengan tanggal kedaluwarsa paling dekat terlebih dahulu untuk mencegah kerugian barang basi/rusak.
              </div>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10.5px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Nama Produk</th>
                  <th className="py-2.5 px-3">Nomor Batch</th>
                  <th className="py-2.5 px-3">Tanggal Kedaluwarsa</th>
                  <th className="py-2.5 px-3 text-center">Sisa Qty Batch</th>
                  <th className="py-2.5 px-3 text-right">Modal Batch</th>
                  <th className="py-2.5 px-3 text-center">Status FEFO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expiringBatches.map(b => {
                  const expiryDate = new Date(b.expiry_date);
                  const today = new Date();
                  const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

                  return (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-bold text-slate-800">{b.product_name}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{b.batch_number}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-800">{b.expiry_date}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold">{b.current_qty} pcs</td>
                      <td className="py-3 px-3 text-right font-mono">Rp {b.cost_price.toLocaleString('id-ID')}</td>
                      <td className="py-3 px-3 text-center">
                        {diffDays <= 30 ? (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px] animate-pulse">
                            Kritis ({diffDays} hari lagi)
                          </span>
                        ) : diffDays <= 60 ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                            Mendekati Expired ({diffDays} hari)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            Aman ({diffDays} hari)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Stock Opname Auditor */}
        {activeTab === 'opname' && (
          <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4">
            <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl text-xs text-blue-900 flex justify-between items-center">
              <div>
                <span className="font-bold">Stock Opname Interaktif:</span> Masukkan jumlah hitung fisik barang di rak/gudang toko. Selisih persediaan akan secara otomatis dihitung dan dibuatkan jurnal penyesuaian (Surplus / Shrinkage) di modul akuntansi.
              </div>
              <button
                onClick={handleExecuteOpname}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition shrink-0 cursor-pointer"
              >
                Simpan Penyesuaian Stok
              </button>
            </div>

            {opnameSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{opnameSuccess}</span>
              </div>
            )}

            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10.5px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Produk</th>
                  <th className="py-2.5 px-3 text-center">Stok Sistem</th>
                  <th className="py-2.5 px-3 w-40 text-center">Hitung Fisik (Rak)</th>
                  <th className="py-2.5 px-3 text-center">Selisih Qty</th>
                  <th className="py-2.5 px-3 text-right">Nilai Selisih (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map(p => {
                  const physical = opnameItems[p.id] !== undefined ? opnameItems[p.id] : p.stock_quantity;
                  const variance = physical - p.stock_quantity;
                  const varianceVal = variance * p.cost_price;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <div className="font-bold text-slate-800">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Barcode: {p.barcode}</div>
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold">
                        {p.stock_quantity} {p.base_uom}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          value={physical}
                          onChange={e => setOpnameItems({ ...opnameItems, [p.id]: parseFloat(e.target.value) || 0 })}
                          className="w-full text-center px-2 py-1 rounded-lg border border-slate-300 font-mono font-bold text-xs"
                        />
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold">
                        <span className={variance < 0 ? 'text-rose-600' : variance > 0 ? 'text-emerald-600' : 'text-slate-400'}>
                          {variance > 0 ? `+${variance}` : variance} {p.base_uom}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold">
                        <span className={varianceVal < 0 ? 'text-rose-600' : varianceVal > 0 ? 'text-emerald-600' : 'text-slate-400'}>
                          Rp {varianceVal.toLocaleString('id-ID')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 1. MODAL TAMBAH / EDIT PRODUK */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-scale-up">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3.5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-white" />
                <h3 className="font-extrabold text-sm md:text-base">
                  {editingProductId ? 'Edit Data Produk' : 'Tambah Produk Ritel Baru'}
                </h3>
              </div>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
              {/* Seksi 1: Data Pokok Produk */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-1 border-b border-slate-100 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-blue-600" />
                  <span>Informasi Pokok Produk</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nama Produk *</label>
                    <input
                      type="text"
                      required
                      value={productForm.name}
                      onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                      placeholder="Contoh: Indomie Goreng Spesial 85g / Redmi Note 13"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Kode SKU *</label>
                    <input
                      type="text"
                      required
                      value={productForm.sku}
                      onChange={e => setProductForm({ ...productForm, sku: e.target.value })}
                      placeholder="SKU-XXXX"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:bg-white focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Barcode Scanner *</label>
                    <div className="relative">
                      <ScanBarcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={productForm.barcode}
                        onChange={e => setProductForm({ ...productForm, barcode: e.target.value })}
                        placeholder="Scan / ketik barcode barang"
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:bg-white focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Kategori Produk</label>
                    <select
                      value={productForm.category_id}
                      onChange={e => setProductForm({ ...productForm, category_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Satuan Dasar (Base UOM)</label>
                    <input
                      type="text"
                      required
                      value={productForm.base_uom}
                      onChange={e => setProductForm({ ...productForm, base_uom: e.target.value })}
                      placeholder="Pcs / Unit / Kg / Bungkus"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                    />
                  </div>
                </div>

                {/* Harga & Stok */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Harga Modal (HPP)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={productForm.cost_price}
                      onChange={e => setProductForm({ ...productForm, cost_price: e.target.value })}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Harga Jual Dasar</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={productForm.selling_price}
                      onChange={e => setProductForm({ ...productForm, selling_price: e.target.value })}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-blue-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Stok Tersedia</label>
                    <input
                      type="number"
                      required
                      value={productForm.stock_quantity}
                      onChange={e => setProductForm({ ...productForm, stock_quantity: e.target.value })}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-emerald-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Alert Minimum Stok</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={productForm.min_stock_alert}
                      onChange={e => setProductForm({ ...productForm, min_stock_alert: e.target.value })}
                      placeholder="5"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-rose-700"
                    />
                  </div>
                </div>

                {/* Konter HP: Flag Wajib IMEI */}
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-amber-50/80 border border-amber-200">
                  <div className="p-2 rounded-xl bg-amber-500 text-white">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-amber-900">
                      Wajib Pelacakan Nomor IMEI / Serial Number
                    </div>
                    <p className="text-[10.5px] text-amber-700">
                      Centang ini khusus untuk Smartphone/Tablet agar kasir wajib scan IMEI sebelum checkout dan dicetak di kartu garansi.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={productForm.requires_imei === 1}
                    onChange={e => setProductForm({ ...productForm, requires_imei: e.target.checked ? 1 : 0 })}
                    className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Seksi 2: Multi-Satuan UOM (Pack, Dus, Renceng) */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    <span>Multi-Satuan Jual (UOM)</span>
                  </h4>
                  <button
                    type="button"
                    onClick={addUOMRow}
                    className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Satuan (Dus/Pack)</span>
                  </button>
                </div>

                {productForm.units.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">
                    Belum ada satuan turunan. Produk hanya dijual dalam satuan dasar ({productForm.base_uom}).
                  </p>
                ) : (
                  <div className="space-y-2">
                    {productForm.units.map((u, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 items-center">
                        <div className="col-span-3">
                          <label className="text-[10px] text-slate-500 font-bold">Nama Satuan</label>
                          <input
                            type="text"
                            placeholder="Contoh: Dus / Pack"
                            value={u.unit_name}
                            onChange={e => {
                              const updated = [...productForm.units];
                              updated[idx].unit_name = e.target.value;
                              setProductForm({ ...productForm, units: updated });
                            }}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="text-[10px] text-slate-500 font-bold">Isi ({productForm.base_uom})</label>
                          <input
                            type="number"
                            min="2"
                            placeholder="Contoh: 40"
                            value={u.conversion_factor}
                            onChange={e => {
                              const updated = [...productForm.units];
                              updated[idx].conversion_factor = parseFloat(e.target.value) || 1;
                              setProductForm({ ...productForm, units: updated });
                            }}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
                          />
                        </div>
                        <div className="col-span-3">
                          <label className="text-[10px] text-slate-500 font-bold">Harga Jual (Rp)</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={u.selling_price}
                            onChange={e => {
                              const updated = [...productForm.units];
                              updated[idx].selling_price = parseFloat(e.target.value) || 0;
                              setProductForm({ ...productForm, units: updated });
                            }}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-blue-700"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] text-slate-500 font-bold">Barcode</label>
                          <input
                            type="text"
                            placeholder="Opsional"
                            value={u.barcode}
                            onChange={e => {
                              const updated = [...productForm.units];
                              updated[idx].barcode = e.target.value;
                              setProductForm({ ...productForm, units: updated });
                            }}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-[11px] font-mono"
                          />
                        </div>
                        <div className="col-span-1 text-center pt-3">
                          <button
                            type="button"
                            onClick={() => removeUOMRow(idx)}
                            className="text-slate-400 hover:text-rose-600 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Seksi 3: Harga Grosir Bertingkat (Tiered Wholesale) */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-amber-600" />
                    <span>Harga Grosir Bertingkat</span>
                  </h4>
                  <button
                    type="button"
                    onClick={addTierRow}
                    className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Aturan Grosir</span>
                  </button>
                </div>

                {productForm.tiers.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">
                    Belum ada harga grosir bertingkat. Harga berlaku flat berapapun jumlah beli.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {productForm.tiers.map((t, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-amber-50/50 p-2.5 rounded-xl border border-amber-200">
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-600 font-bold">Min Beli (Qty)</label>
                          <input
                            type="number"
                            min="2"
                            value={t.min_qty}
                            onChange={e => {
                              const updated = [...productForm.tiers];
                              updated[idx].min_qty = parseFloat(e.target.value) || 1;
                              setProductForm({ ...productForm, tiers: updated });
                            }}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-600 font-bold">Harga Satuan Grosir (Rp)</label>
                          <input
                            type="number"
                            min="0"
                            value={t.tier_price}
                            onChange={e => {
                              const updated = [...productForm.tiers];
                              updated[idx].tier_price = parseFloat(e.target.value) || 0;
                              setProductForm({ ...productForm, tiers: updated });
                            }}
                            className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-amber-900"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeTierRow(idx)}
                          className="pt-3 text-slate-400 hover:text-rose-600 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="pt-3 border-t border-slate-200 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingProductId ? 'Simpan Perubahan' : 'Tambahkan Produk'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. MODAL PENERIMAAN BARANG / RESTOCK SUPPLIER (GOODS RECEIPT) */}
      {isGRNModalOpen && grnSelectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
            <div className="bg-emerald-600 px-5 py-3.5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-white" />
                <div>
                  <h3 className="font-extrabold text-sm">Penerimaan Barang Supplier</h3>
                  <p className="text-[11px] text-emerald-100">{grnSelectedProduct.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsGRNModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGRN} className="p-5 space-y-4">
              {/* Info Stok & HPP Saat Ini */}
              <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200 flex justify-between text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">Stok Saat Ini</span>
                  <span className="font-extrabold text-slate-800">
                    {grnSelectedProduct.stock_quantity} {grnSelectedProduct.base_uom}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block text-[10px]">HPP Saat Ini</span>
                  <span className="font-extrabold text-slate-800 font-mono">
                    Rp {grnSelectedProduct.cost_price.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Form Input GRN */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Jumlah Masuk ({grnSelectedProduct.base_uom}) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={grnForm.receivedQty}
                    onChange={e => setGrnForm({ ...grnForm, receivedQty: e.target.value })}
                    placeholder="Contoh: 50"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Harga Beli Satuan (Rp) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={grnForm.unitCost}
                    onChange={e => setGrnForm({ ...grnForm, unitCost: e.target.value })}
                    placeholder="Contoh: 15000"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* Live Moving Average Cost Preview */}
              {parseFloat(grnForm.receivedQty) > 0 && parseFloat(grnForm.unitCost) > 0 && (
                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-950 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-blue-600 font-bold block">Simulasi HPP Baru (Moving Average):</span>
                    <span className="font-extrabold font-mono text-sm text-blue-900">
                      Rp {Math.round(
                        ((grnSelectedProduct.stock_quantity * grnSelectedProduct.cost_price) + 
                         (parseFloat(grnForm.receivedQty) * parseFloat(grnForm.unitCost))) / 
                        (grnSelectedProduct.stock_quantity + parseFloat(grnForm.receivedQty))
                      ).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-blue-600 block">Total Pembelian:</span>
                    <span className="font-extrabold font-mono text-xs">
                      Rp {(parseFloat(grnForm.receivedQty) * parseFloat(grnForm.unitCost)).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              )}

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Metode Pembayaran Pengadaan</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGrnForm({ ...grnForm, paymentMethod: 'CASH' })}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      grnForm.paymentMethod === 'CASH'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Kas Laci (Tunai)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGrnForm({ ...grnForm, paymentMethod: 'HUTANG' })}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      grnForm.paymentMethod === 'HUTANG'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    Hutang Supplier
                  </button>
                </div>
              </div>

              {/* Batch & Expiry FEFO */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">No. Batch Supplier</label>
                  <input
                    type="text"
                    value={grnForm.batchNumber}
                    onChange={e => setGrnForm({ ...grnForm, batchNumber: e.target.value })}
                    placeholder="BATCH-XXXX"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Tanggal Expired (FEFO)</label>
                  <input
                    type="date"
                    value={grnForm.expiryDate}
                    onChange={e => setGrnForm({ ...grnForm, expiryDate: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsGRNModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1 shadow-md shadow-emerald-500/20"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Stok Masuk</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
