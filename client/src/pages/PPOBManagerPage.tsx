import React, { useState, useEffect } from 'react';
import { 
  Zap, Key, ShieldCheck, RefreshCw, Sliders, CheckCircle2, CheckCircle, XCircle, X,
  AlertTriangle, Copy, Play, Loader2, ArrowRight, Download, Package,
  Wallet, CreditCard, History, Settings, Search, Check, ExternalLink,
  Eye, EyeOff, MessageSquare, Phone, ArrowUpRight, Clock, Shield
} from 'lucide-react';
import { usePPOB } from '../context/PPOBContext';
import { useAuth } from '../context/AuthContext';

export const PPOBManagerPage: React.FC = () => {
  const { balance, refreshBalance, mode } = usePPOB();
  const { currentUser } = useAuth();
  
  const role = (currentUser?.role || 'cashier').toLowerCase();
  const canManageConfig = role === 'owner' || role === 'supervisor';
  const canDeposit = role === 'owner' || role === 'supervisor';

  // Navigation tab state ('history' | 'deposit' | 'config')
  const [activeTab, setActiveTab] = useState<'history' | 'deposit' | 'config'>('history');

  // API Settings state
  const [apiKey, setApiKey] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [activeMode, setActiveMode] = useState<'sandbox' | 'live'>('sandbox');
  const [baseUrl, setBaseUrl] = useState('https://ipay.my.id');
  const [lowBalanceThreshold, setLowBalanceThreshold] = useState('150000');

  // Product Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string; count?: number } | null>(null);
  const [totalProducts, setTotalProducts] = useState(0);

  // Markup Rules state
  const [markupType, setMarkupType] = useState<'FIXED' | 'PERCENT'>('FIXED');
  const [markupValue, setMarkupValue] = useState('2000');
  const [markupSuccess, setMarkupSuccess] = useState(false);

  // Connection testing state
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  // Transactions list & filtering
  const [transactions, setTransactions] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'PENDING' | 'FAILED'>('ALL');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Status Sync states
  const [syncingRefId, setSyncingRefId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  // Deposit Feature states
  const [depositInfo, setDepositInfo] = useState<any>(null);
  const [loadingDepositInfo, setLoadingDepositInfo] = useState(false);
  const [ledgerBalance, setLedgerBalance] = useState<number>(0);
  const [syncingLedger, setSyncingLedger] = useState(false);
  const [syncLedgerMsg, setSyncLedgerMsg] = useState<string | null>(null);

  // Deposit Ticket Form states
  const [depositAmount, setDepositAmount] = useState<string>('100000');
  const [depositChannel, setDepositChannel] = useState<string>('DANA');
  const [depositSource, setDepositSource] = useState<string>('1-1001'); // 1-1001: Kas Laci Kasir, 1-1002: Kas Bank Toko
  const [depositNotes, setDepositNotes] = useState<string>('');
  const [submittingDeposit, setSubmittingDeposit] = useState(false);
  const [depositTicket, setDepositTicket] = useState<any>(null);
  const [depositError, setDepositError] = useState<string | null>(null);

  // Deposit History & Verification State
  const [depositHistory, setDepositHistory] = useState<any[]>([]);
  const [loadingDepositHistory, setLoadingDepositHistory] = useState(false);
  const [processingRefId, setProcessingRefId] = useState<string | null>(null);

  // Simulator Webhook Tester
  const [simRefId, setSimRefId] = useState('');
  const [simStatus, setSimStatus] = useState<'success' | 'failed'>('success');
  const [simMsg, setSimMsg] = useState('');

  // Fallback to 'history' if a cashier tries to open 'config'
  useEffect(() => {
    if (!canManageConfig && activeTab === 'config') {
      setActiveTab('history');
    }
  }, [canManageConfig, activeTab]);

  // Fetch initial data
  useEffect(() => {
    fetchSettings();
    fetchTransactions();
    fetchProductsCount();
    fetchDepositInfo();
    fetchDepositHistory();
  }, []);

  const fetchDepositHistory = async () => {
    setLoadingDepositHistory(true);
    try {
      const res = await fetch('/api/ppob/deposit/history');
      const data = await res.json();
      if (Array.isArray(data)) {
        setDepositHistory(data);
      }
    } catch (err) {
      console.error('Failed to load deposit history:', err);
    } finally {
      setLoadingDepositHistory(false);
    }
  };

  const handleApproveDeposit = async (refId: string) => {
    if (!confirm(`Verifikasi & Setujui deposit ${refId}?\nSaldo PPOB dan mutasi kas 1-1003 akan ditambahkan ke pembukuan.`)) return;
    setProcessingRefId(refId);
    try {
      const res = await fetch(`/api/ppob/deposit/${encodeURIComponent(refId)}/approve`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(`Deposit ${refId} BERHASIL diverifikasi! Saldo iPay dan Buku Kas telah bertambah.`);
        fetchDepositHistory();
        fetchDepositInfo();
        refreshBalance();
      } else {
        alert(`Gagal: ${data.message || 'Error'}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setProcessingRefId(null);
    }
  };

  const handleRejectDeposit = async (refId: string) => {
    const reason = prompt(`Masukkan alasan penolakan deposit ${refId}:`, 'Bukti transfer tidak valid / dana belum masuk');
    if (reason === null) return;
    setProcessingRefId(refId);
    try {
      const res = await fetch(`/api/ppob/deposit/${encodeURIComponent(refId)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Deposit ${refId} berhasil ditolak.`);
        fetchDepositHistory();
      } else {
        alert(`Gagal: ${data.message || 'Error'}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setProcessingRefId(null);
    }
  };

  const fetchDepositInfo = async () => {
    setLoadingDepositInfo(true);
    try {
      const res = await fetch('/api/ppob/deposit/info');
      const data = await res.json();
      if (data.success) {
        setDepositInfo(data);
        if (typeof data.ledgerBalance === 'number') {
          setLedgerBalance(data.ledgerBalance);
        }
      }
    } catch (err) {
      console.error('Failed to load deposit info:', err);
    } finally {
      setLoadingDepositInfo(false);
    }
  };

  const handleSyncLedger = async () => {
    setSyncingLedger(true);
    setSyncLedgerMsg(null);
    try {
      const res = await fetch('/api/ppob/deposit/sync-ledger', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncLedgerMsg(`Buku kas berhasil disinkronkan dengan saldo live: Rp ${data.balance?.toLocaleString('id-ID')}`);
        setLedgerBalance(data.balance);
        refreshBalance();
        fetchDepositInfo();
      } else {
        setSyncLedgerMsg(`Gagal sinkronisasi: ${data.message || 'Error'}`);
      }
    } catch (err: any) {
      setSyncLedgerMsg(`Error: ${err.message}`);
    } finally {
      setSyncingLedger(false);
    }
  };

  const handleCreateDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(depositAmount);
    if (!amountNum || amountNum < 10000) {
      alert('Nominal deposit minimal Rp 10.000');
      return;
    }
    setSubmittingDeposit(true);
    setDepositError(null);
    try {
      const res = await fetch('/api/ppob/deposit/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          channel: depositChannel,
          sourceAccount: depositSource,
          notes: depositNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDepositTicket(data);
        fetchDepositInfo();
        fetchDepositHistory();
        // NOTE: Saldo TIDAK otomatis bertambah saat tiket dibuat. Menunggu persetujuan admin ipay.my.id!
      } else {
        setDepositError(data.message || 'Gagal membuat tiket deposit');
      }
    } catch (err: any) {
      setDepositError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setSubmittingDeposit(false);
    }
  };

  const handleSyncStatus = async (refId: string) => {
    setSyncingRefId(refId);
    try {
      const res = await fetch(`/api/ppob/sync-status/${encodeURIComponent(refId)}`, { method: 'POST' });
      const data = await res.json();
      fetchTransactions();
      refreshBalance();
      if (data.success) {
        alert(`Status Ref ID ${refId}: ${data.status}\nSN / Keterangan: ${data.sn_token || '-'}`);
      } else {
        alert(`Gagal cek status: ${data.message || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSyncingRefId(null);
    }
  };

  const handleSyncAllPending = async () => {
    setSyncingAll(true);
    try {
      const res = await fetch('/api/ppob/sync-pending', { method: 'POST' });
      const data = await res.json();
      fetchTransactions();
      refreshBalance();
      alert(`Sinkronisasi selesai! ${data.synced || 0} transaksi pending diperiksa.`);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSyncingAll(false);
    }
  };

  const fetchProductsCount = async () => {
    try {
      const res = await fetch('/api/ppob/products');
      const data = await res.json();
      if (Array.isArray(data)) {
        setTotalProducts(data.length);
      }
    } catch (err) {
      console.error('Failed to load products count:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setApiKey(data.ipay_api_key || '');
      setMerchantId(data.ipay_merchant_id || '');
      setSecretKey(data.ipay_secret_key || '');
      setActiveMode((data.ipay_mode as any) || 'sandbox');
      setBaseUrl(data.ipay_base_url || 'https://ipay.my.id');
      setLowBalanceThreshold(data.low_balance_threshold || '150000');
      setMarkupType((data.global_markup_type as any) || 'FIXED');
      setMarkupValue(data.global_markup_value || '2000');
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/ppob/transactions');
      const data = await res.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    }
  };

  const handleSyncProducts = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/ppob/sync-catalog', { method: 'POST' });
      const data = await res.json();
      setSyncResult(data);
      if (data.success) {
        fetchProductsCount();
      }
    } catch (err: any) {
      setSyncResult({ success: false, message: err.message, count: 0 });
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipay_api_key: apiKey,
          ipay_merchant_id: merchantId,
          ipay_secret_key: secretKey,
          ipay_mode: activeMode,
          ipay_base_url: baseUrl,
          low_balance_threshold: lowBalanceThreshold,
        }),
      });
      alert('Pengaturan PPOB ipay.my.id berhasil disimpan!');
      refreshBalance();
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/ppob/test-connection', { method: 'POST' });
      const data = await res.json();
      setTestResult(data);
      refreshBalance();
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleApplyMarkup = async () => {
    try {
      const res = await fetch('/api/ppob/markup-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          markupType,
          markupValue: parseFloat(markupValue),
        }),
      });
      if (res.ok) {
        setMarkupSuccess(true);
        setTimeout(() => setMarkupSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulateWebhook = async () => {
    if (!simRefId) {
      alert('Masukkan ref_id transaksi untuk simulasi webhook');
      return;
    }

    try {
      const res = await fetch('/api/ppob/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref_id: simRefId,
          status: simStatus,
          sn: simStatus === 'success' ? 'SN20261001-9988112233' : '',
        }),
      });
      await res.json();
      setSimMsg(`Simulasi Webhook [${simStatus.toUpperCase()}] berhasil dieksekusi untuk ${simRefId}`);
      fetchTransactions();
      refreshBalance();
      setTimeout(() => setSimMsg(''), 4000);
    } catch (err: any) {
      alert('Gagal mengeksekusi simulasi webhook: ' + err.message);
    }
  };

  // Filtered transactions for Tab 1
  const filteredTransactions = transactions.filter(t => {
    const matchSearch = 
      (t.customer_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.ref_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.product_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.sku_code || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchSearch) return false;
    if (statusFilter === 'ALL') return true;
    return t.status === statusFilter;
  });

  // Calculate transaction stats
  const totalCount = transactions.length;
  const successCount = transactions.filter(t => t.status === 'SUCCESS').length;
  const pendingCount = transactions.filter(t => t.status === 'PENDING').length;
  const failedCount = transactions.filter(t => t.status === 'FAILED').length;
  const totalSales = transactions
    .filter(t => t.status === 'SUCCESS')
    .reduce((acc, t) => acc + (t.selling_price || 0), 0);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-57px)] overflow-y-auto bg-slate-100 p-4 space-y-4">
      {/* Top Banner with Balance and Navigation */}
      <div className="bg-linear-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-5 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-400/20 rounded-xl border border-amber-400/30">
              <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight">
                  PPOB & Digital Engine (ipay.my.id)
                </h1>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                  mode === 'sandbox' ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                }`}>
                  {mode === 'sandbox' ? 'Sandbox Mode' : 'Production Live'}
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                Integrasi pulsa, data, token PLN, e-money & pembayaran tagihan ke buku besar kasir POS.
              </p>
            </div>
          </div>
        </div>

        {/* Live Balance Overview Box */}
        <div className="flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/20 text-right">
            <div className="text-[11px] text-blue-200 uppercase font-semibold flex items-center justify-end gap-1.5">
              <span>Saldo iPay Live</span>
              <button 
                onClick={refreshBalance} 
                title="Refresh Saldo"
                className="hover:text-white transition cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
            <div className="text-2xl font-black font-mono text-emerald-400">
              Rp {balance.toLocaleString('id-ID')}
            </div>
          </div>

          {canDeposit && (
            <button
              onClick={() => setActiveTab('deposit')}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition cursor-pointer shrink-0"
            >
              <Wallet className="w-4 h-4" />
              <span>Isi Deposit</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center justify-between bg-white px-3 py-2 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5">
          {/* Tab 1: Riwayat Transaksi (Always Visible) */}
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>📋 Riwayat Transaksi PPOB</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeTab === 'history' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {transactions.length}
            </span>
          </button>

          {/* Tab 2: Deposit Saldo (Owner & Supervisor) */}
          {canDeposit && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('deposit');
                fetchDepositInfo();
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'deposit'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>💳 Deposit & Saldo iPay</span>
              {depositInfo && (
                <span className={`w-2 h-2 rounded-full ${balance > 50000 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              )}
            </button>
          )}

          {/* Tab 3: Konfigurasi API & Margin (Owner & Supervisor Only) */}
          {canManageConfig && (
            <button
              type="button"
              onClick={() => setActiveTab('config')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'config'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>⚙️ Konfigurasi API & Margin</span>
            </button>
          )}
        </div>

        {/* Current Active User Role Badge */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 hidden sm:inline">Role Akses:</span>
          <span className={`px-2.5 py-1 rounded-lg font-bold text-[11px] uppercase flex items-center gap-1.5 ${
            role === 'owner' 
              ? 'bg-purple-100 text-purple-800 border border-purple-200' 
              : role === 'supervisor' 
              ? 'bg-blue-100 text-blue-800 border border-blue-200' 
              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
          }`}>
            <Shield className="w-3 h-3" />
            <span>{currentUser?.name || currentUser?.username || 'Kasir'} ({role})</span>
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: RIWAYAT TRANSAKSI PPOB (TAMPILAN BERSIH KASIR & SUPERVISOR)       */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Transaksi</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-black font-mono text-slate-800">{totalCount}</span>
                <span className="text-xs font-semibold text-slate-500">Order</span>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-2xs">
              <span className="text-[11px] font-semibold text-emerald-700 uppercase">Sukses</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-black font-mono text-emerald-700">{successCount}</span>
                <span className="text-xs font-bold text-emerald-600 font-mono">Rp {totalSales.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className={`p-3.5 rounded-2xl border shadow-2xs ${
              pendingCount > 0 ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-200'
            }`}>
              <span className="text-[11px] font-semibold text-amber-700 uppercase">Pending / Proses</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-black font-mono text-amber-800">{pendingCount}</span>
                {pendingCount > 0 && (
                  <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-bold animate-pulse">
                    Perlu Cek
                  </span>
                )}
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-rose-200 bg-rose-50/30 shadow-2xs">
              <span className="text-[11px] font-semibold text-rose-700 uppercase">Gagal / Dibatalkan</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-black font-mono text-rose-700">{failedCount}</span>
                <span className="text-xs font-semibold text-rose-600">Reversed</span>
              </div>
            </div>
          </div>

          {/* Table Container Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            {/* Action Bar: Search & Status Filters */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              {/* Search Box */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nomor tujuan, ref ID, nama produk..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-blue-500 bg-slate-50 focus:bg-white transition"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-slate-400 font-semibold mr-1">Status:</span>
                {(['ALL', 'SUCCESS', 'PENDING', 'FAILED'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      statusFilter === st
                        ? 'bg-slate-800 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st === 'ALL' ? 'Semua' : st}
                  </button>
                ))}
              </div>

              {/* Sync Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSyncAllPending}
                  disabled={syncingAll}
                  className="text-xs bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-bold transition shadow-2xs cursor-pointer disabled:opacity-50"
                  title="Cek seluruh transaksi pending ke server ipay.my.id"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
                  <span>{syncingAll ? 'Memeriksa...' : 'Sinkronkan Pending'}</span>
                </button>
                <button
                  onClick={fetchTransactions}
                  className="text-xs text-blue-600 hover:bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-semibold transition cursor-pointer"
                  title="Muat ulang riwayat dari database POS"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Muat Ulang</span>
                </button>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10.5px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Waktu</th>
                    <th className="py-2.5 px-3">Ref ID</th>
                    <th className="py-2.5 px-3">Produk / Layanan</th>
                    <th className="py-2.5 px-3">No. Tujuan / Meteran</th>
                    <th className="py-2.5 px-3 text-right">Modal</th>
                    <th className="py-2.5 px-3 text-right">Harga Jual</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3">Token / SN Provider</th>
                    {canManageConfig && mode === 'sandbox' && (
                      <th className="py-2.5 px-3 text-center">Simulasi</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={canManageConfig && mode === 'sandbox' ? 9 : 8} className="py-10 text-center text-slate-400">
                        <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold">Tidak ada transaksi PPOB yang ditemukan.</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {searchTerm ? 'Coba kata kunci pencarian lain.' : 'Transaksi dari kasir akan tercatat di sini.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition">
                        {/* Waktu */}
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          {new Date(t.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                          {' '}
                          <span className="text-slate-400">
                            {new Date(t.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>

                        {/* Ref ID */}
                        <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(t.ref_id);
                              alert(`Ref ID disalin: ${t.ref_id}`);
                            }}
                            title="Klik untuk menyalin Ref ID"
                            className="hover:text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>{t.ref_id}</span>
                            <Copy className="w-3 h-3 text-slate-400 opacity-60" />
                          </button>
                        </td>

                        {/* Produk / Layanan */}
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-800">{t.product_name || t.sku_code}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{t.sku_code}</div>
                        </td>

                        {/* No Tujuan */}
                        <td className="py-2.5 px-3 font-mono text-slate-800 font-bold whitespace-nowrap">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(t.customer_no);
                              alert(`No Tujuan disalin: ${t.customer_no}`);
                            }}
                            title="Klik untuk menyalin No Tujuan"
                            className="hover:text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>{t.customer_no}</span>
                            <Copy className="w-3 h-3 text-slate-400 opacity-60" />
                          </button>
                        </td>

                        {/* Modal */}
                        <td className="py-2.5 px-3 text-right font-mono text-slate-500 whitespace-nowrap">
                          Rp {t.base_price?.toLocaleString('id-ID')}
                        </td>

                        {/* Harga Jual */}
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700 whitespace-nowrap">
                          Rp {t.selling_price?.toLocaleString('id-ID')}
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              t.status === 'SUCCESS'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : t.status === 'PENDING'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}>
                              {t.status}
                            </span>
                            {t.status === 'PENDING' && (
                              <button
                                onClick={() => handleSyncStatus(t.ref_id)}
                                disabled={syncingRefId === t.ref_id}
                                title="Periksa status transaksi terkini ke ipay.my.id"
                                className="p-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
                              >
                                <RefreshCw className={`w-3 h-3 ${syncingRefId === t.ref_id ? 'animate-spin' : ''}`} />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Token / SN */}
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          {t.sn_token ? (
                            <div className="flex items-center gap-1.5">
                              <span 
                                className="font-semibold text-slate-800 bg-slate-100 px-2 py-1 rounded border border-slate-200 cursor-pointer hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition max-w-[260px] truncate"
                                title={`Klik untuk salin:\n${t.sn_token}`}
                                onClick={() => {
                                  navigator.clipboard.writeText(t.sn_token);
                                  setCopiedToken(t.sn_token);
                                  setTimeout(() => setCopiedToken(null), 2000);
                                }}
                              >
                                {t.sn_token}
                              </span>
                              {copiedToken === t.sn_token ? (
                                <span className="text-emerald-600 font-bold text-[10px] flex items-center">
                                  <Check className="w-3.5 h-3.5" />
                                </span>
                              ) : (
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(t.sn_token);
                                    setCopiedToken(t.sn_token);
                                    setTimeout(() => setCopiedToken(null), 2000);
                                  }}
                                  className="text-slate-400 hover:text-blue-600 cursor-pointer"
                                  title="Salin SN"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">-</span>
                          )}
                        </td>

                        {/* Simulasi Action (owner/supervisor only in sandbox) */}
                        {canManageConfig && mode === 'sandbox' && (
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <button
                              onClick={() => {
                                setActiveTab('config');
                                setSimRefId(t.ref_id);
                              }}
                              className="text-[10px] text-purple-600 font-bold hover:underline cursor-pointer"
                              title="Pilih transaksi ini untuk simulasi Webhook callback"
                            >
                              Simulasi Webhook
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DEPOSIT & SALDO IPAY (FITUR DEPOSIT SYNC DENGAN IPAY.MY.ID)       */}
      {/* ========================================================================= */}
      {activeTab === 'deposit' && canDeposit && (
        <div className="space-y-4">
          {/* Card 1: Balance Comparison & Ledger Reconciliation */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-600" />
                <h2 className="font-extrabold text-sm text-slate-800">
                  Sinkronisasi Saldo Deposit & Buku Kas POS
                </h2>
              </div>
              <button
                type="button"
                onClick={fetchDepositInfo}
                disabled={loadingDepositInfo}
                className="text-xs text-blue-600 hover:bg-blue-50 border border-blue-200 px-3 py-1 rounded-lg flex items-center gap-1 font-semibold cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loadingDepositInfo ? 'animate-spin' : ''}`} />
                <span>Refresh Info</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Server Live Balance Card */}
              <div className="p-4 rounded-xl bg-linear-to-br from-emerald-50 to-teal-50 border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    Saldo Live Server ipay.my.id
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-900">
                    Online
                  </span>
                </div>
                <div className="text-3xl font-black font-mono text-emerald-700">
                  Rp {(depositInfo?.live_balance ?? balance).toLocaleString('id-ID')}
                </div>
                <div className="text-[11px] text-emerald-700/80">
                  Merchant ID: <span className="font-mono font-bold">{depositInfo?.merchant_id || merchantId || '-'}</span>
                </div>
              </div>

              {/* Local Ledger Balance Card (Account 1-1003) */}
              <div className="p-4 rounded-xl bg-linear-to-br from-blue-50 to-indigo-50 border border-blue-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">
                    Saldo Akuntansi POS (Akun 1-1003)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-200 text-blue-900">
                    Buku Besar
                  </span>
                </div>
                <div className="text-3xl font-black font-mono text-blue-800">
                  Rp {ledgerBalance.toLocaleString('id-ID')}
                </div>
                <div className="text-[11px] text-blue-700/80">
                  Aset Lancar: Deposit Saldo PPOB (ipay.my.id)
                </div>
              </div>
            </div>

            {/* Reconciliation status bar */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                {Math.abs((depositInfo?.live_balance ?? balance) - ledgerBalance) === 0 ? (
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Saldo buku besar kasir sinkron 100% dengan saldo server iPay.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-700">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Ada selisih pembukuan Rp {Math.abs((depositInfo?.live_balance ?? balance) - ledgerBalance).toLocaleString('id-ID')} antara server iPay dan Akun 1-1003.
                    </span>
                  </div>
                )}
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Klik tombol di samping untuk merekonsiliasi jurnal penyesuaian otomatis.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSyncLedger}
                disabled={syncingLedger}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingLedger ? 'animate-spin' : ''}`} />
                <span>{syncingLedger ? 'Menyelaraskan...' : 'Sinkronkan Buku Kas'}</span>
              </button>
            </div>

            {syncLedgerMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{syncLedgerMsg}</span>
              </div>
            )}
          </div>

          {/* Card 2: Top-Up / Deposit Request Form */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Box: Form Permohonan Deposit */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <h2 className="font-extrabold text-sm text-slate-800">
                  Form Top-Up / Isi Deposit Saldo
                </h2>
              </div>

              <form onSubmit={handleCreateDeposit} className="space-y-4">
                {/* Nominal Presets */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Pilih Nominal Cepat
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['50000', '100000', '250000', '500000', '1000000'].map(amt => (
                      <button
                        type="button"
                        key={amt}
                        onClick={() => setDepositAmount(amt)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition cursor-pointer text-center ${
                          depositAmount === amt
                            ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        Rp {parseInt(amt).toLocaleString('id-ID')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Nominal Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nominal Transfer (Rp)
                  </label>
                  <input
                    type="number"
                    min="10000"
                    step="1000"
                    value={depositAmount}
                    onChange={e => setDepositAmount(e.target.value)}
                    placeholder="Minimal Rp 10.000"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono text-sm font-bold text-slate-900 focus:outline-blue-500"
                    required
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Terbilang: <span className="font-semibold text-slate-700">Rp {parseInt(depositAmount || '0').toLocaleString('id-ID')}</span>
                  </span>
                </div>

                {/* Channel Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Metode Pembayaran / Transfer
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'DANA', name: 'DANA', sub: depositInfo?.deposit_channels?.dana_number || '081775700114' },
                      { id: 'GOPAY', name: 'GoPay', sub: depositInfo?.deposit_channels?.gopay_number || '081775700114' },
                      { id: 'SHOPEEPAY', name: 'ShopeePay', sub: depositInfo?.deposit_channels?.shopeepay_number || '081775700114' },
                      { id: 'BANK_TRANSFER', name: 'Transfer Bank', sub: 'BCA / Mandiri / BRI' },
                    ].map(ch => (
                      <button
                        type="button"
                        key={ch.id}
                        onClick={() => setDepositChannel(ch.id)}
                        className={`p-2.5 rounded-xl text-left border transition cursor-pointer ${
                          depositChannel === ch.id
                            ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-bold text-xs">{ch.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{ch.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Source Account (Sumber Kas Toko) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Sumber Dana Toko (Pengeluaran Kas)
                  </label>
                  <select
                    value={depositSource}
                    onChange={e => setDepositSource(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-blue-500"
                  >
                    <option value="1-1001">1-1001: Kas Laci Kasir (Cash Drawer)</option>
                    <option value="1-1002">1-1002: Kas Rekening Bank Toko</option>
                  </select>
                  <span className="text-[10.5px] text-slate-500 mt-1 block">
                    Mutasi kas ganda (double-entry) otomatis dicatat: Kas Toko berkurang & Deposit PPOB bertambah.
                  </span>
                </div>

                {/* Notes Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Catatan Deposit (Opsional)
                  </label>
                  <input
                    type="text"
                    value={depositNotes}
                    onChange={e => setDepositNotes(e.target.value)}
                    placeholder="Contoh: Top-up saldo modal shift pagi"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submittingDeposit}
                  className="w-full py-3 rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submittingDeposit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Memproses Tiket Deposit...</span>
                    </>
                  ) : (
                    <>
                      <Wallet className="w-4 h-4" />
                      <span>Buat Tiket Deposit & Catat Kas Toko</span>
                    </>
                  )}
                </button>

                {depositError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{depositError}</span>
                  </div>
                )}
              </form>
            </div>

            {/* Right Box: Ticket Result / Transfer Confirmation Card */}
            <div className="space-y-4">
              {depositTicket ? (
                <div className="bg-white p-5 rounded-2xl border-2 border-emerald-500 shadow-md space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-emerald-700 font-extrabold text-sm">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>Tiket Deposit Berhasil Dibuat</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      Menunggu Transfer
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                      <span className="text-[11px] text-slate-500 font-semibold">Nomor Referensi (Ref ID):</span>
                      <div className="flex items-center justify-between font-mono font-bold text-xs text-slate-900">
                        <span>{depositTicket.ref_id}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(depositTicket.ref_id);
                            alert(`Ref ID disalin: ${depositTicket.ref_id}`);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-center">
                      <span className="text-[11px] text-emerald-700 font-semibold uppercase">Nominal Ditransfer:</span>
                      <div className="text-2xl font-black font-mono text-emerald-800">
                        Rp {depositTicket.amount?.toLocaleString('id-ID')}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
                      <span className="text-[11px] text-slate-500 font-semibold">Tujuan Pembayaran:</span>
                      <div className="font-bold text-slate-800">{depositTicket.target_account}</div>
                      <div className="text-[11px] text-slate-500">
                        a.n <span className="font-semibold text-slate-700">GarudaTel / iPay</span>
                      </div>
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
                      <div className="font-bold text-amber-900 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Menunggu Verifikasi Persetujuan:</span>
                      </div>
                      <p className="text-[11px] text-amber-800">
                        Tiket deposit berstatus <strong>PENDING</strong>. Saldo PPOB dan pembukuan kas 1-1003 baru akan ditambahkan setelah diverifikasi dan disetujui oleh admin atau gateway iPay.
                      </p>
                    </div>

                    {/* WhatsApp Direct Confirmation Button */}
                    {depositTicket.whatsapp_url && (
                      <a
                        href={depositTicket.whatsapp_url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <MessageSquare className="w-4 h-4 fill-white" />
                        <span>Konfirmasi Pembayaran via WhatsApp</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => setDepositTicket(null)}
                      className="w-full py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 transition cursor-pointer"
                    >
                      Buat Tiket Baru
                    </button>
                  </div>
                </div>
              ) : (
                /* Information & Instructions Card */
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <Phone className="w-4 h-4 text-blue-600" />
                    <h2 className="font-extrabold text-sm text-slate-800">
                      Petunjuk & Saluran Resmi Deposit
                    </h2>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    Setiap permohonan deposit di sistem Web POS ini terhubung langsung ke gateway <span className="font-bold text-slate-800">ipay.my.id</span> dan otomatis dicatat ke jurnal keuangan minimarket setelah disetujui.
                  </p>

                  <div className="space-y-2.5 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0 text-xs">
                        1
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">Buat Tiket Permohonan</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Tentukan nominal transfer dan sumber kas toko yang digunakan.
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0 text-xs">
                        2
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">Transfer Sesuai Nominal</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Kirim ke nomor e-wallet / rekening bank resmi GarudaTel iPay.
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0 text-xs">
                        3
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">Konfirmasi via WhatsApp</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Kirim bukti transfer ke WhatsApp admin. Saldo akan masuk otomatis setelah disetujui oleh admin iPay.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800">
                    <span className="font-bold">Tips Operasional:</span> Lakukan pengisian deposit sebelum saldo mencapai batas minimum agar transaksi kasir tidak terhenti saat melayani pembeli.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Riwayat & Status Verifikasi Tiket Deposit */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600" />
                <h2 className="font-extrabold text-sm text-slate-800">
                  Riwayat & Status Verifikasi Tiket Deposit
                </h2>
              </div>
              <button
                type="button"
                onClick={fetchDepositHistory}
                disabled={loadingDepositHistory}
                className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingDepositHistory ? 'animate-spin' : ''}`} />
                <span>Segarkan Riwayat</span>
              </button>
            </div>

            {loadingDepositHistory ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                <span>Memuat riwayat deposit...</span>
              </div>
            ) : depositHistory.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Belum ada tiket deposit yang dibuat.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-[10.5px] font-bold text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Waktu Permohonan</th>
                      <th className="py-2.5 px-3">No. Referensi (Ref ID)</th>
                      <th className="py-2.5 px-3">Saluran Transfer</th>
                      <th className="py-2.5 px-3">Sumber Kas</th>
                      <th className="py-2.5 px-3 text-right">Nominal (Rp)</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3">Keterangan</th>
                      {canDeposit && <th className="py-2.5 px-3 text-center">Verifikasi / Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {depositHistory.map((dep: any) => (
                      <tr key={dep.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                          {new Date(dep.created_at).toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                          {dep.ref_id}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {dep.payment_channel}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                          {dep.source_account}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900">
                          Rp {dep.amount?.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            dep.status === 'APPROVED' || dep.status === 'SUCCESS'
                              ? 'bg-emerald-100 text-emerald-800'
                              : dep.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-800 animate-pulse'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {dep.status === 'PENDING' ? '⏳ Menunggu Persetujuan' : dep.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          {dep.notes || '-'}
                        </td>
                        {canDeposit && (
                          <td className="py-2.5 px-3 text-center">
                            {dep.status === 'PENDING' ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleApproveDeposit(dep.ref_id)}
                                  disabled={processingRefId === dep.ref_id}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[10.5px] transition cursor-pointer flex items-center gap-1 shadow-xs"
                                  title="Verifikasi persetujuan admin iPay dan tambahkan saldo"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Setujui</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRejectDeposit(dep.ref_id)}
                                  disabled={processingRefId === dep.ref_id}
                                  className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-[10.5px] transition cursor-pointer flex items-center gap-1"
                                  title="Tolak tiket deposit ini"
                                >
                                  <X className="w-3 h-3" />
                                  <span>Tolak</span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px]">-</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: KONFIGURASI API & MARGIN (KHUSUS OWNER & SUPERVISOR)               */}
      {/* ========================================================================= */}
      {activeTab === 'config' && (
        canManageConfig ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Column: API Credentials & Handshake */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-blue-600" />
                  <h2 className="font-extrabold text-sm text-slate-800">
                    Kredensial & Konfigurasi API
                  </h2>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  activeMode === 'sandbox' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  Mode: {activeMode}
                </span>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mode Integrasi
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveMode('sandbox')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        activeMode === 'sandbox'
                          ? 'bg-amber-50 border-amber-400 text-amber-900 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Built-in Sandbox Simulator (Uji Coba)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveMode('live')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        activeMode === 'live'
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-900 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Live Production API (api.ipay.my.id)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Merchant ID
                  </label>
                  <input
                    type="text"
                    value={merchantId}
                    onChange={e => setMerchantId(e.target.value)}
                    placeholder="Contoh: IPAY_MCH_00789"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:outline-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    API Key
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder="Masukkan API Key dari dashboard ipay.my.id"
                      className="w-full px-3 py-2 pr-9 rounded-xl border border-slate-300 font-mono text-xs focus:outline-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Secret Key (Signature Verification)
                  </label>
                  <div className="relative">
                    <input
                      type={showSecretKey ? 'text' : 'password'}
                      value={secretKey}
                      onChange={e => setSecretKey(e.target.value)}
                      placeholder="Masukkan Secret Key"
                      className="w-full px-3 py-2 pr-9 rounded-xl border border-slate-300 font-mono text-xs focus:outline-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecretKey(!showSecretKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showSecretKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Ambang Saldo Kritis (Alert)
                    </label>
                    <input
                      type="number"
                      value={lowBalanceThreshold}
                      onChange={e => setLowBalanceThreshold(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs font-bold focus:outline-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Base URL API
                    </label>
                    <input
                      type="text"
                      value={baseUrl}
                      onChange={e => setBaseUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:outline-blue-500"
                    />
                  </div>
                </div>

                {/* Webhook Endpoint Display */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[11px] font-bold text-slate-700">Webhook URL Callback Toko:</span>
                  <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-[11px] text-slate-800">
                    <span className="truncate">http://[IP-Kasir]:3001/api/ppob/webhook</span>
                    <button
                      type="button"
                      onClick={() => alert('Webhook URL disalin: http://[IP-Kasir]:3001/api/ppob/webhook')}
                      className="text-slate-400 hover:text-slate-700 ml-2"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="px-4 py-2 rounded-xl border border-blue-300 bg-blue-50 text-blue-800 font-bold text-xs flex items-center gap-1.5 hover:bg-blue-100 transition cursor-pointer"
                  >
                    {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span>Test Connection</span>
                  </button>

                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                  >
                    Simpan Konfigurasi
                  </button>
                </div>

                {testResult && (
                  <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                    <span>{testResult.message}</span>
                  </div>
                )}
              </form>
            </div>

            {/* Right Column: Catalog Sync, Auto-Pricing Markup & Simulator Tester */}
            <div className="space-y-4">
              {/* Card 0: Tarik / Sinkronkan Produk PPOB dari ipay.my.id */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    <h2 className="font-extrabold text-sm text-slate-800">
                      Katalog Produk PPOB (ipay.my.id)
                    </h2>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                    {totalProducts} Produk Tersimpan
                  </span>
                </div>

                <p className="text-xs text-slate-500">
                  Tarik seluruh daftar produk digital (Pulsa, Paket Data, Token PLN, E-Money, dan Pascabayar) langsung dari server <span className="font-bold text-slate-700">ipay.my.id</span> ke kasir toko Anda.
                </p>

                <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-500">
                    Harga modal langsung ter-update & markup otomatis diterapkan.
                  </div>

                  <button
                    type="button"
                    onClick={handleSyncProducts}
                    disabled={syncing}
                    className="px-4 py-2.5 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {syncing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sedang Menarik Produk...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Tarik / Sinkronkan Produk</span>
                      </>
                    )}
                  </button>
                </div>

                {syncResult && (
                  <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    syncResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    {syncResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />}
                    <span className="font-semibold">{syncResult.message}</span>
                  </div>
                )}
              </div>

              {/* Card 1: Auto-Pricing Margin Rules */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Sliders className="w-4 h-4 text-emerald-600" />
                  <h2 className="font-extrabold text-sm text-slate-800">
                    Aturan Markup Harga Jual Otomatis (Auto-Pricing)
                  </h2>
                </div>

                <p className="text-xs text-slate-500">
                  Menjaga keuntungan minimarket tetap aman. Saat harga modal di `ipay.my.id` naik, sistem secara otomatis menaikkan harga jual di kasir sesuai rumus margin di bawah.
                </p>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tipe Margin
                    </label>
                    <select
                      value={markupType}
                      onChange={e => setMarkupType(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-blue-500"
                    >
                      <option value="FIXED">Nominal Tetap (Rp)</option>
                      <option value="PERCENT">Persentase (%)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nilai Margin ({markupType === 'FIXED' ? 'Rp' : '%'})
                    </label>
                    <input
                      type="number"
                      value={markupValue}
                      onChange={e => setMarkupValue(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs font-bold focus:outline-blue-500"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    Contoh: Modal Rp 20.150 + Rp 2.000 = <span className="font-bold font-mono text-slate-800">Rp 22.200</span>
                  </span>

                  <button
                    type="button"
                    onClick={handleApplyMarkup}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                  >
                    Terapkan ke Semua SKU
                  </button>
                </div>

                {markupSuccess && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold">
                    Aturan margin baru berhasil diterapkan ke seluruh katalog PPOB!
                  </div>
                )}
              </div>

              {/* Card 2: Sandbox Simulator & Webhook Tester */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Play className="w-4 h-4 text-purple-600" />
                  <h2 className="font-extrabold text-sm text-slate-800">
                    Simulator Webhook & Auto-Reversal Tester
                  </h2>
                </div>

                <p className="text-xs text-slate-500">
                  Uji skenario penanganan transaksi PPOB yang statusnya berubah asynchronous via Webhook (Pending &rarr; Gagal memicu Jurnal Pembalik otomatis).
                </p>

                <div className="space-y-2 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nomor Referensi (ref_id)
                    </label>
                    <input
                      type="text"
                      placeholder="Masukkan ref_id transaksi..."
                      value={simRefId}
                      onChange={e => setSimRefId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs focus:outline-purple-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSimStatus('success')}
                      className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        simStatus === 'success' ? 'bg-emerald-50 border-emerald-400 text-emerald-900' : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      Callback: SUCCESS (Token Terbit)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimStatus('failed')}
                      className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        simStatus === 'failed' ? 'bg-rose-50 border-rose-400 text-rose-900' : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      Callback: FAILED (Auto-Reversal)
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSimulateWebhook}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                  >
                    Tembak Webhook Callback
                  </button>

                  {simMsg && (
                    <div className="p-2.5 bg-purple-50 border border-purple-200 text-purple-900 rounded-xl text-xs font-semibold">
                      {simMsg}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-800">Akses Dibatasi</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Hanya akun dengan role <span className="font-bold text-slate-700">Owner (Pemilik)</span> dan <span className="font-bold text-slate-700">Supervisor</span> yang memiliki wewenang untuk melihat dan mengelola kredensial API serta margin harga jual PPOB.
            </p>
          </div>
        )
      )}
    </div>
  );
};
