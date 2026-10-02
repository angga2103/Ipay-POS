import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Zap, Phone, Wifi, Wallet, Gamepad2, FileText, 
  Search, Check, AlertCircle, Loader2, X, Sparkles,
  ArrowRight, ShieldCheck, RefreshCw
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { usePPOB } from '../context/PPOBContext';
import { PPOBProduct } from '../types';

interface PPOBQuickModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'pulsa' | 'data' | 'pln' | 'ewallet' | 'games' | 'tagihan' | 'all';

export const PPOBQuickModal: React.FC<PPOBQuickModalProps> = ({ isOpen, onClose }) => {
  const { addPPOBItem } = useCart();
  const { balance } = usePPOB();

  const [activeTab, setActiveTab] = useState<TabType>('pulsa');
  const [products, setProducts] = useState<PPOBProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(false);

  // Form states
  const [targetNo, setTargetNo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('ALL');
  const [selectedProduct, setSelectedProduct] = useState<PPOBProduct | null>(null);

  // Inquiry states (for PLN / Pascabayar / Cek Nama)
  const [inquiryResult, setInquiryResult] = useState<any | null>(null);
  const [inquiryLoading, setInquiryLoading] = useState(false);
  const [inquiryError, setInquiryError] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch PPOB products from backend
  const loadProducts = () => {
    setLoadingProducts(true);
    fetch('/api/ppob/products')
      .then(res => res.json())
      .then(data => {
        setProducts(Array.isArray(data) ? data : []);
        setLoadingProducts(false);
      })
      .catch(err => {
        console.error('Failed to load PPOB products:', err);
        setLoadingProducts(false);
      });
  };

  useEffect(() => {
    if (!isOpen) return;
    loadProducts();
    // Auto-focus target input
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  // Reset selections when tab changes
  useEffect(() => {
    setSelectedBrand('ALL');
    setSelectedProduct(null);
    setSearchQuery('');
    setInquiryResult(null);
    setInquiryError('');
  }, [activeTab]);

  // Auto-detect phone provider from prefix
  const detectedProvider = useMemo(() => {
    const clean = targetNo.trim().replace(/[^0-9]/g, '');
    if (clean.length < 4) return null;
    const p4 = clean.slice(0, 4);
    const p6 = clean.slice(0, 6);

    // By.U specific prefixes
    if (['085154', '085155', '085156', '085157', '085158'].includes(p6)) return 'BY.U';

    // Telkomsel
    if (['0811', '0812', '0813', '0821', '0822', '0823', '0851', '0852', '0853'].includes(p4)) return 'TELKOMSEL';

    // Indosat
    if (['0814', '0815', '0816', '0855', '0856', '0857', '0858'].includes(p4)) return 'INDOSAT';

    // XL
    if (['0817', '0818', '0819', '0859', '0877', '0878'].includes(p4)) return 'XL';

    // Axis
    if (['0831', '0832', '0833', '0838'].includes(p4)) return 'AXIS';

    // Tri
    if (['0895', '0896', '0897', '0898', '0899'].includes(p4)) return 'TRI';

    // Smartfren
    if (['0881', '0882', '0883', '0884', '0885', '0886', '0887', '0888', '0889'].includes(p4)) return 'SMARTFREN';

    return null;
  }, [targetNo]);

  // Auto-apply detected provider to selectedBrand if in pulsa or data tab
  useEffect(() => {
    if ((activeTab === 'pulsa' || activeTab === 'data') && detectedProvider) {
      setSelectedBrand(detectedProvider);
    }
  }, [detectedProvider, activeTab]);

  // Helper: Classify a product into one of the 6 main tabs
  const classifyProduct = (p: PPOBProduct): 'pulsa' | 'data' | 'pln' | 'ewallet' | 'games' | 'tagihan' => {
    const cat = (p.category_code || '').toUpperCase();
    const prov = (p.provider_code || '').toUpperCase();
    const name = (p.product_name || '').toUpperCase();
    const pType = (p.type || '').toLowerCase();

    // 1. Tagihan Pascabayar
    if (
      pType === 'postpaid' || 
      cat === 'PASCABAYAR' || 
      cat === 'TAGIHAN' || 
      prov.includes('PASCABAYAR') || 
      prov.includes('PDAM') || 
      prov.includes('BPJS')
    ) {
      return 'tagihan';
    }

    // 2. Token Listrik PLN
    if (
      cat === 'PLN' || 
      prov.includes('PLN') || 
      name.startsWith('PLN ') || 
      name.includes('TOKEN PLN')
    ) {
      return 'pln';
    }

    // 3. E-Wallet
    if (
      cat === 'E-MONEY' || 
      cat === 'EMONEY' || 
      ['DANA', 'GO PAY', 'GOPAY', 'OVO', 'SHOPEE PAY', 'SHOPEEPAY', 'LINKAJA', 'MAXIM', 'ISAKU', 'KASPRO']
        .some(e => prov.includes(e) || name.includes(e))
    ) {
      return 'ewallet';
    }

    // 4. Games
    if (
      cat === 'GAMES' || 
      prov.startsWith('VIP-') || 
      ['FREE FIRE', 'MOBILE LEGENDS', 'PUBG', 'ROBLOX', 'VALORANT', 'GENSHIN', 'STEAM', 'GARENA', 'POINT BLANK', 'HONKAI', 'ZEPETO']
        .some(g => prov.includes(g) || name.includes(g))
    ) {
      return 'games';
    }

    // 5. Pulsa Reguler
    if (
      cat === 'PULSA' || 
      (name.includes('PULSA') && !name.includes('DATA') && !name.includes('KUOTA') && !name.includes('INTERNET') && !name.includes('COMBO') && !name.includes('GIFT'))
    ) {
      return 'pulsa';
    }

    // 6. Paket Data & Internet
    if (
      cat === 'DATA' || 
      ['FLASH', 'HAPPY', 'FREEDOM', 'COMBO', 'XTRA', 'UNLIMITED', 'MINI', 'YELLOW', 'INTERNET', 'KUOTA', 'PAKET', 'MASA AKTIF', 'VOUCHER', 'AKTIVASI', 'AIGO']
        .some(d => cat.includes(d) || name.includes(d))
    ) {
      return 'data';
    }

    return 'data';
  };

  // Filter products by Active Tab + Brand Pill + Search Query
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // 1. Tab Filtering
      if (activeTab !== 'all') {
        const prodClass = classifyProduct(p);
        if (prodClass !== activeTab) return false;
      }

      // 2. Brand / Operator Filtering
      if (selectedBrand !== 'ALL') {
        const prov = (p.provider_code || '').toUpperCase();
        const name = (p.product_name || '').toUpperCase();

        if (activeTab === 'ewallet') {
          if (selectedBrand === 'DANA' && !prov.includes('DANA') && !name.includes('DANA')) return false;
          if (selectedBrand === 'GOPAY' && !prov.includes('GO') && !name.includes('GOPAY')) return false;
          if (selectedBrand === 'OVO' && !prov.includes('OVO') && !name.includes('OVO')) return false;
          if (selectedBrand === 'SHOPEEPAY' && !prov.includes('SHOPEE') && !name.includes('SHOPEEPAY')) return false;
          if (selectedBrand === 'LINKAJA' && !prov.includes('LINKAJA') && !name.includes('LINKAJA')) return false;
          if (selectedBrand === 'MAXIM' && !prov.includes('MAXIM') && !name.includes('MAXIM')) return false;
        } else if (activeTab === 'games') {
          if (!prov.includes(selectedBrand) && !name.includes(selectedBrand)) return false;
        } else if (activeTab === 'tagihan') {
          if (selectedBrand === 'PLN' && !prov.includes('PLN') && !name.includes('PLN')) return false;
          if (selectedBrand === 'PDAM' && !prov.includes('PDAM') && !name.includes('PDAM')) return false;
          if (selectedBrand === 'BPJS' && !prov.includes('BPJS') && !name.includes('BPJS')) return false;
          if (selectedBrand === 'TELKOM' && !prov.includes('TELKOM') && !name.includes('INDIHOME') && !name.includes('TELKOM')) return false;
        } else {
          // Pulsa, Data, or All
          if (!prov.includes(selectedBrand) && !name.includes(selectedBrand)) return false;
        }
      }

      // 3. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = p.product_name.toLowerCase().includes(q);
        const matchSku = p.sku_code.toLowerCase().includes(q);
        const matchPrice = p.selling_price.toString().includes(q);
        const matchProvider = (p.provider_code || '').toLowerCase().includes(q);
        if (!matchName && !matchSku && !matchPrice && !matchProvider) return false;
      }

      return true;
    }).sort((a, b) => a.base_price - b.base_price);
  }, [products, activeTab, selectedBrand, searchQuery]);

  // Brand Pills definition depending on active tab
  const brandPills = useMemo(() => {
    switch (activeTab) {
      case 'pulsa':
      case 'data':
        return [
          { key: 'ALL', label: 'Semua Operator' },
          { key: 'TELKOMSEL', label: 'Telkomsel' },
          { key: 'INDOSAT', label: 'Indosat Ooredoo' },
          { key: 'XL', label: 'XL Axiata' },
          { key: 'AXIS', label: 'Axis' },
          { key: 'TRI', label: 'Tri (3)' },
          { key: 'SMARTFREN', label: 'Smartfren' },
          { key: 'BY.U', label: 'by.U' },
        ];
      case 'ewallet':
        return [
          { key: 'ALL', label: 'Semua E-Wallet' },
          { key: 'DANA', label: 'DANA' },
          { key: 'GOPAY', label: 'GoPay' },
          { key: 'OVO', label: 'OVO' },
          { key: 'SHOPEEPAY', label: 'ShopeePay' },
          { key: 'LINKAJA', label: 'LinkAja' },
          { key: 'MAXIM', label: 'Maxim' },
        ];
      case 'games':
        return [
          { key: 'ALL', label: 'Semua Game' },
          { key: 'MOBILE LEGENDS', label: 'Mobile Legends' },
          { key: 'FREE FIRE', label: 'Free Fire' },
          { key: 'PUBG', label: 'PUBG Mobile' },
          { key: 'ROBLOX', label: 'Roblox' },
          { key: 'VALORANT', label: 'Valorant' },
          { key: 'STEAM', label: 'Steam Wallet' },
          { key: 'GARENA', label: 'Garena' },
        ];
      case 'tagihan':
        return [
          { key: 'ALL', label: 'Semua Tagihan' },
          { key: 'PLN', label: 'PLN Pasca' },
          { key: 'PDAM', label: 'PDAM Air (62 Kota)' },
          { key: 'BPJS', label: 'BPJS Kesehatan/TK' },
          { key: 'TELKOM', label: 'Telkom / IndiHome' },
        ];
      default:
        return [];
    }
  }, [activeTab]);

  if (!isOpen) return null;

  // Perform Inquiry
  const handleInquiry = async () => {
    const cleanNo = targetNo.trim().replace(/\s+/g, '');
    if (!cleanNo || cleanNo.length < 5) {
      setInquiryError('Masukkan Nomor Tujuan / ID Pelanggan yang valid terlebih dahulu!');
      return;
    }

    setInquiryLoading(true);
    setInquiryError('');
    setInquiryResult(null);

    // Default SKU for inquiry: if product is selected, use its SKU; otherwise pick standard
    let skuToInquire = selectedProduct?.sku_code;
    if (!skuToInquire) {
      if (activeTab === 'pln') skuToInquire = 'PLN20';
      else if (activeTab === 'tagihan') {
        if (selectedBrand === 'BPJS') skuToInquire = 'BPJSPOST';
        else if (selectedBrand === 'PDAM') skuToInquire = 'PDAMPOST';
        else if (selectedBrand === 'TELKOM') skuToInquire = 'TELKOMPOST';
        else skuToInquire = 'PLNPOST';
      } else {
        skuToInquire = 'pre30646211'; // Cek nama umum
      }
    }

    try {
      const res = await fetch('/api/ppob/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: skuToInquire, customer_no: cleanNo }),
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setInquiryResult(data);
      } else {
        setInquiryError(data.message || 'Gagal memvalidasi data pelanggan');
      }
    } catch (err: any) {
      setInquiryError(err.message || 'Koneksi ke server inquiry bermasalah');
    } finally {
      setInquiryLoading(false);
    }
  };

  // Add to Cart
  const handleAddToCart = () => {
    const cleanNo = targetNo.trim().replace(/\s+/g, '');
    if (!cleanNo) {
      alert('Silakan masukkan nomor handphone / nomor meter / ID tujuan terlebih dahulu!');
      inputRef.current?.focus();
      return;
    }

    // Alur Tagihan Pascabayar
    if (activeTab === 'tagihan') {
      if (!inquiryResult) {
        alert('Untuk tagihan pascabayar, silakan klik tombol "Cek Tagihan" terlebih dahulu untuk memverifikasi jumlah tagihan.');
        return;
      }

      const billerProd = selectedProduct || products.find(p => p.sku_code === inquiryResult.sku || p.category_code === 'tagihan');
      const costPrice = billerProd ? billerProd.base_price : 1500;
      const adminFee = billerProd ? billerProd.selling_price : 3000;
      const totalCustomerPrice = inquiryResult.amount + adminFee;

      // Cek kecukupan saldo deposit
      if (balance < (inquiryResult.amount + costPrice)) {
        alert(`Saldo deposit ipay.my.id tidak cukup! Butuh Rp ${(inquiryResult.amount + costPrice).toLocaleString('id-ID')}, Saldo aktif: Rp ${balance.toLocaleString('id-ID')}`);
        return;
      }

      addPPOBItem({
        sku: selectedProduct ? selectedProduct.sku_code : (inquiryResult.buyer_sku_code || 'PLNPOST'),
        product_name: `${selectedProduct?.product_name || 'Tagihan Pascabayar'} (${inquiryResult.customer_name})`,
        target_no: cleanNo,
        customer_name: inquiryResult.customer_name,
        selling_price: totalCustomerPrice,
        cost_price: inquiryResult.amount + costPrice,
        admin_fee: adminFee,
      });

      onClose();
      return;
    }

    // Alur Prabayar (Pulsa, Data, PLN, E-Wallet, Game)
    if (!selectedProduct) {
      alert('Silakan pilih salah satu nominal produk PPOB yang ingin dibeli!');
      return;
    }

    // Cek kecukupan saldo deposit kasir
    if (balance < selectedProduct.base_price) {
      alert(`Saldo deposit ipay.my.id tidak mencukupi! Butuh modal Rp ${selectedProduct.base_price.toLocaleString('id-ID')}, sedangkan saldo deposit kasir Rp ${balance.toLocaleString('id-ID')}. Silakan isi saldo di web ipay.my.id.`);
      return;
    }

    addPPOBItem({
      sku: selectedProduct.sku_code,
      product_name: selectedProduct.product_name,
      target_no: cleanNo,
      customer_name: inquiryResult?.customer_name || '',
      selling_price: selectedProduct.selling_price,
      cost_price: selectedProduct.base_price,
    });

    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4"
      onKeyDown={e => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 animate-fade-in">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/15 backdrop-blur-xs text-white shadow-xs">
              <Zap className="w-5 h-5 fill-amber-300 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base tracking-tight text-white flex items-center gap-2">
                  Penjualan PPOB & Pulsa
                  <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black uppercase tracking-wider">
                    ipay.my.id LIVE
                  </span>
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-white/20 text-white font-mono text-xs font-bold">
                  F4
                </span>
              </div>
              <p className="text-xs text-blue-100 flex items-center gap-1.5 mt-0.5">
                <span>Saldo Live Kasir:</span>
                <span className="font-bold font-mono text-white bg-white/10 px-2 py-0.5 rounded">
                  Rp {balance.toLocaleString('id-ID')}
                </span>
                <span className="text-[11px] text-blue-200 hidden sm:inline">
                  • 4.237+ Produk Siap Dijual
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={loadProducts}
              title="Refresh Katalog Produk"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loadingProducts ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation (6 Utama + 1 Semua Produk) */}
        <div className="flex items-center gap-1 p-2 bg-slate-100 border-b border-slate-200 overflow-x-auto no-scrollbar text-xs font-bold">
          <button
            onClick={() => setActiveTab('pulsa')}
            className={`py-2 px-3 rounded-xl flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              activeTab === 'pulsa' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200/80'
            }`}
          >
            <Phone className={`w-3.5 h-3.5 ${activeTab === 'pulsa' ? 'text-white' : 'text-emerald-600'}`} />
            <span>Pulsa Reguler</span>
          </button>

          <button
            onClick={() => setActiveTab('data')}
            className={`py-2 px-3 rounded-xl flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              activeTab === 'data' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200/80'
            }`}
          >
            <Wifi className={`w-3.5 h-3.5 ${activeTab === 'data' ? 'text-white' : 'text-blue-600'}`} />
            <span>Paket Data & Kuota</span>
          </button>

          <button
            onClick={() => setActiveTab('pln')}
            className={`py-2 px-3 rounded-xl flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              activeTab === 'pln' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200/80'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${activeTab === 'pln' ? 'text-white fill-white' : 'text-amber-500 fill-amber-500'}`} />
            <span>Token Listrik PLN</span>
          </button>

          <button
            onClick={() => setActiveTab('ewallet')}
            className={`py-2 px-3 rounded-xl flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              activeTab === 'ewallet' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200/80'
            }`}
          >
            <Wallet className={`w-3.5 h-3.5 ${activeTab === 'ewallet' ? 'text-white' : 'text-indigo-600'}`} />
            <span>Top-Up E-Wallet</span>
          </button>

          <button
            onClick={() => setActiveTab('games')}
            className={`py-2 px-3 rounded-xl flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              activeTab === 'games' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200/80'
            }`}
          >
            <Gamepad2 className={`w-3.5 h-3.5 ${activeTab === 'games' ? 'text-white' : 'text-purple-600'}`} />
            <span>Voucher Game</span>
          </button>

          <button
            onClick={() => setActiveTab('tagihan')}
            className={`py-2 px-3 rounded-xl flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              activeTab === 'tagihan' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200/80'
            }`}
          >
            <FileText className={`w-3.5 h-3.5 ${activeTab === 'tagihan' ? 'text-white' : 'text-rose-600'}`} />
            <span>Tagihan Pascabayar</span>
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`py-2 px-3 rounded-xl flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              activeTab === 'all' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-200/80'
            }`}
          >
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <span>Semua Produk</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Section 1: Target Destination Number & Quick Inquiry */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <span>
                  {activeTab === 'pln'
                    ? '⚡ Nomor Meter / No ID Pelanggan PLN (11-12 digit)'
                    : activeTab === 'tagihan'
                    ? '🧾 Nomor Kontrak / ID Pelanggan Tagihan'
                    : activeTab === 'games'
                    ? '🎮 User ID Game / No Akun Pelanggan'
                    : activeTab === 'ewallet'
                    ? '💳 Nomor Handphone Akun E-Wallet'
                    : '📱 Nomor Handphone Pelanggan'}
                </span>
                <span className="text-rose-500">*</span>
              </label>

              {detectedProvider && (activeTab === 'pulsa' || activeTab === 'data') && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold bg-emerald-100/80 px-2 py-0.5 rounded-lg w-fit">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Operator Terdeteksi: {detectedProvider}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                placeholder={
                  activeTab === 'pln'
                    ? 'Contoh: 14234567890 (No Meter atau IDPEL)'
                    : activeTab === 'tagihan'
                    ? 'Contoh: 51234567890 (Nomor Kontrak / Pelanggan)'
                    : activeTab === 'games'
                    ? 'Contoh: 12345678 (2041)'
                    : 'Contoh: 081234567890'
                }
                value={targetNo}
                onChange={e => setTargetNo(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (activeTab === 'pln' || activeTab === 'tagihan') {
                      handleInquiry();
                    }
                  }
                }}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono text-sm md:text-base font-bold bg-white"
              />

              {(activeTab === 'pln' || activeTab === 'tagihan' || activeTab === 'ewallet' || activeTab === 'games') && (
                <button
                  type="button"
                  onClick={handleInquiry}
                  disabled={inquiryLoading || !targetNo.trim()}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                >
                  {inquiryLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Search className="w-4 h-4 text-amber-400" />
                  )}
                  <span>{activeTab === 'tagihan' ? 'Cek Tagihan' : 'Cek Nama'}</span>
                </button>
              )}
            </div>

            {/* Inquiry Result Display */}
            {inquiryResult && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                <div className="font-bold text-emerald-900 flex items-center gap-1.5 mb-1.5">
                  <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                  <span>Informasi Pelanggan Terverifikasi:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-700 bg-white/70 p-2 rounded-lg border border-emerald-100">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Nama Pelanggan:</span>
                    <span className="font-extrabold text-slate-900">{inquiryResult.customer_name || '-'}</span>
                  </div>
                  {inquiryResult.meter_no && (
                    <div>
                      <span className="text-[11px] text-slate-500 block">No Meter:</span>
                      <span className="font-mono font-bold text-slate-900">{inquiryResult.meter_no}</span>
                    </div>
                  )}
                  {inquiryResult.power_tariff && (
                    <div>
                      <span className="text-[11px] text-slate-500 block">Tarif / Daya:</span>
                      <span className="font-bold text-blue-700">{inquiryResult.power_tariff}</span>
                    </div>
                  )}
                  {inquiryResult.amount > 0 && (
                    <div>
                      <span className="text-[11px] text-slate-500 block">Tagihan Pokok:</span>
                      <span className="font-mono font-bold text-slate-900">
                        Rp {inquiryResult.amount.toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}
                  {inquiryResult.admin_fee > 0 && (
                    <div>
                      <span className="text-[11px] text-slate-500 block">Biaya Admin:</span>
                      <span className="font-mono font-bold text-slate-900">
                        Rp {inquiryResult.admin_fee.toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}
                  {inquiryResult.total_amount > 0 && (
                    <div>
                      <span className="text-[11px] text-slate-500 block">Total Tagihan:</span>
                      <span className="font-mono font-extrabold text-blue-700">
                        Rp {inquiryResult.total_amount.toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {inquiryError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span className="font-medium">{inquiryError}</span>
              </div>
            )}
          </div>

          {/* Section 2: Quick Brand / Operator Pills */}
          {brandPills.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Pilih Brand / Operator:
              </label>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {brandPills.map(b => {
                  const isActive = selectedBrand === b.key;
                  return (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => {
                        setSelectedBrand(b.key);
                        setSelectedProduct(null);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer border ${
                        isActive
                          ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 3: Instant Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Ketik pencarian cepat nominal / paket (misal: '50', 'combo', 'unlimited', '86 diamond', 'pln 20')..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-hidden text-xs font-semibold transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Section 4: Product Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700">
                Pilih Produk / Nominal ({filteredProducts.length} tersedia)
              </label>
              {selectedBrand !== 'ALL' && (
                <button
                  onClick={() => setSelectedBrand('ALL')}
                  className="text-[11px] text-blue-600 hover:underline font-semibold cursor-pointer"
                >
                  Tampilkan Semua Brand
                </button>
              )}
            </div>

            {loadingProducts ? (
              <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="text-xs font-medium">Memuat katalog ipay.my.id...</span>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1.5">
                <AlertCircle className="w-8 h-8 text-slate-300" />
                <p className="text-xs font-bold text-slate-600">Tidak ada produk yang cocok dengan filter ini</p>
                <p className="text-[11px] text-slate-400">Coba ubah kata kunci pencarian atau pilih brand operator lain</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[360px] overflow-y-auto p-1 pr-1.5">
                {filteredProducts.map(prod => {
                  const isSelected = selectedProduct?.id === prod.id;
                  const isSufficientBalance = balance >= prod.base_price;
                  const profit = Math.max(0, prod.selling_price - prod.base_price);

                  return (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => setSelectedProduct(prod)}
                      disabled={!isSufficientBalance}
                      className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer relative group ${
                        !isSufficientBalance
                          ? 'opacity-40 bg-slate-100 border-slate-200 cursor-not-allowed'
                          : isSelected
                          ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-500/30 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-blue-400 hover:bg-slate-50 shadow-2xs'
                      }`}
                    >
                      <div>
                        {/* Provider Badge */}
                        <div className="flex items-center justify-between mb-1 gap-1">
                          <span className="text-[9.5px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 truncate max-w-[120px]">
                            {prod.provider_code || 'PPOB'}
                          </span>
                          {isSelected && (
                            <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </span>
                          )}
                        </div>

                        {/* Product Name */}
                        <div className="font-extrabold text-xs text-slate-800 line-clamp-2 leading-snug">
                          {prod.product_name}
                        </div>

                        {/* Description / SKU */}
                        <div className="text-[10px] text-slate-400 font-mono mt-1 truncate">
                          {prod.sku_code}
                        </div>
                      </div>

                      {/* Pricing Info */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-col gap-0.5">
                        <div className="text-sm font-black font-mono text-blue-700">
                          Rp {prod.selling_price.toLocaleString('id-ID')}
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400 font-mono">
                            Modal: {prod.base_price.toLocaleString('id-ID')}
                          </span>
                          <span className="text-emerald-600 font-bold bg-emerald-50 px-1 rounded">
                            +{profit.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>

                      {!isSufficientBalance && (
                        <div className="absolute inset-0 bg-slate-100/70 rounded-xl flex items-center justify-center p-2 text-center pointer-events-none">
                          <span className="bg-rose-600 text-white text-[9.5px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                            Saldo iPay Kurang
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer: Summary & Action Buttons */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs">
            {selectedProduct ? (
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-medium">Produk Dipilih:</span>
                  <span className="font-extrabold text-slate-800">{selectedProduct.product_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Harga Jual Kasir:</span>
                  <span className="font-extrabold text-base text-blue-700 font-mono">
                    Rp {selectedProduct.selling_price.toLocaleString('id-ID')}
                  </span>
                  <span className="text-emerald-700 font-bold text-[11px] bg-emerald-100 px-2 py-0.5 rounded">
                    Untung: Rp {(selectedProduct.selling_price - selectedProduct.base_price).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            ) : activeTab === 'tagihan' && inquiryResult ? (
              <div>
                <span className="text-slate-500 font-medium">Total Tagihan Pelanggan: </span>
                <span className="font-extrabold text-base text-blue-700 font-mono">
                  Rp {(inquiryResult.amount + 3000).toLocaleString('id-ID')}
                </span>
                <span className="text-[11px] text-slate-500 ml-1.5">(Termasuk Biaya Admin)</span>
              </div>
            ) : (
              <p className="text-slate-400 italic">
                Pilih produk di atas untuk melihat detail harga & keuntungan kasir
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
            >
              Batal (Esc)
            </button>
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={(!selectedProduct && activeTab !== 'tagihan') || !targetNo.trim()}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>Masukkan ke Keranjang</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
