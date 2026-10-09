import React, { useState, useEffect } from 'react';
import { 
  BookOpen, TrendingUp, Layers, CheckCircle2, 
  ArrowRight, Download, RefreshCw, Scale, HelpCircle, 
  PlusCircle, Sparkles, DollarSign, X, Check, FileText,
  Truck, Users, Package, AlertCircle, ArrowUpRight, ShieldCheck,
  Wallet, Tag, ShoppingBag, Zap
} from 'lucide-react';
import { ProfitAndLossReport, JournalEntry, ChartOfAccount, Supplier, Customer, OpeningBalanceStatus, InventoryValuation } from '../types';
import { CashInOutModal } from '../components/CashInOutModal';

export const AccountingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pl' | 'journals' | 'ledger' | 'trial_balance' | 'coa' | 'operational'>('pl');
  const [plData, setPlData] = useState<ProfitAndLossReport | null>(null);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [trialBalance, setTrialBalance] = useState<{ accounts: any[]; totalDebit: number; totalCredit: number; isBalanced: boolean } | null>(null);
  const [coaList, setCoaList] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(false);

  // Operational Transactions (Pengeluaran Umum & Pemasukan Lain-lain)
  const [operationalList, setOperationalList] = useState<any[]>([]);
  const [loadingOperational, setLoadingOperational] = useState(false);
  const [isCashInOutModalOpen, setIsCashInOutModalOpen] = useState(false);

  // General Ledger per-account state
  const [selectedLedgerAccount, setSelectedLedgerAccount] = useState<string>('1-1001');
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Opening Balance & Sync Status
  const [syncStatus, setSyncStatus] = useState<OpeningBalanceStatus | null>(null);
  const [valuationData, setValuationData] = useState<InventoryValuation | null>(null);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [customersList, setCustomersList] = useState<Customer[]>([]);

  // Opening Balance Modal State
  const [isOpeningBalanceModalOpen, setIsOpeningBalanceModalOpen] = useState(false);
  const [openingForm, setOpeningForm] = useState({
    cash_drawer: '500000',
    bank_balance: '2500000',
    ppob_deposit: '1500000',
    receivables: '0',
    inventory_value: '0',
    payables: '0',
    notes: 'Inisialisasi Saldo Awal Neraca (Day 1 Setup)',
  });
  const [supplierDebtsMap, setSupplierDebtsMap] = useState<Record<number, string>>({});
  const [customerDebtsMap, setCustomerDebtsMap] = useState<Record<number, string>>({});
  const [showSupplierBreakdown, setShowSupplierBreakdown] = useState(false);
  const [showCustomerBreakdown, setShowCustomerBreakdown] = useState(false);
  const [isSubmittingOpening, setIsSubmittingOpening] = useState(false);

  // Educational Guide Modal State
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);

  const fetchOperational = async () => {
    setLoadingOperational(true);
    try {
      const res = await fetch('/api/operational-transactions');
      const data = await res.json();
      setOperationalList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load operational transactions:', err);
    } finally {
      setLoadingOperational(false);
    }
  };

  const fetchAccountingData = async () => {
    setLoading(true);
    try {
      fetchOperational();
      const [resPl, resJournals, resTb, resCoa, resSync, resVal, resSup, resCust] = await Promise.all([
        fetch('/api/accounting/profit-loss'),
        fetch('/api/accounting/journals?limit=50'),
        fetch('/api/accounting/trial-balance'),
        fetch('/api/accounting/coa'),
        fetch('/api/accounting/opening-balance-status'),
        fetch('/api/inventory/valuation'),
        fetch('/api/suppliers'),
        fetch('/api/customers'),
      ]);

      const [dataPl, dataJournals, dataTb, dataCoa, dataSync, dataVal, dataSup, dataCust] = await Promise.all([
        resPl.json(),
        resJournals.json(),
        resTb.json(),
        resCoa.json(),
        resSync.json(),
        resVal.json(),
        resSup.json(),
        resCust.json(),
      ]);

      setPlData(dataPl);
      setJournals(Array.isArray(dataJournals) ? dataJournals : []);
      setTrialBalance(dataTb?.accounts ? dataTb : null);
      setCoaList(Array.isArray(dataCoa) ? dataCoa : []);
      setSyncStatus(dataSync);
      if (dataVal && dataVal.summary) {
        setValuationData(dataVal);
      } else {
        setValuationData(null);
      }
      if (Array.isArray(dataSup)) {
        setSuppliersList(dataSup);
        const sMap: Record<number, string> = {};
        dataSup.forEach((s: Supplier) => {
          if (s.current_debt > 0) sMap[s.id] = String(s.current_debt);
        });
        setSupplierDebtsMap(sMap);
      }
      if (Array.isArray(dataCust)) {
        setCustomersList(dataCust);
        const cMap: Record<number, string> = {};
        dataCust.forEach((c: Customer) => {
          if (c.current_debt > 0) cMap[c.id] = String(c.current_debt);
        });
        setCustomerDebtsMap(cMap);
      }
    } catch (err) {
      console.error('Failed to load accounting data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLedger = async (accountCode: string) => {
    setLedgerLoading(true);
    try {
      const res = await fetch(`/api/accounting/general-ledger/${accountCode}`);
      const data = await res.json();
      setLedgerData(data);
    } catch (err) {
      console.error('Failed to load general ledger for account:', err);
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountingData();
  }, []);

  useEffect(() => {
    if (activeTab === 'ledger') {
      fetchLedger(selectedLedgerAccount);
    }
  }, [activeTab, selectedLedgerAccount]);

  const openOpeningModalWithSync = () => {
    if (syncStatus?.is_configured && syncStatus.balances) {
      setOpeningForm({
        cash_drawer: String(syncStatus.balances.cash_drawer || 0),
        bank_balance: String(syncStatus.balances.bank_balance || 0),
        ppob_deposit: String(syncStatus.balances.ppob_deposit || 0),
        receivables: String(syncStatus.balances.receivables || 0),
        inventory_value: String(syncStatus.balances.inventory_value || 0),
        payables: String(syncStatus.balances.payables || 0),
        notes: syncStatus.entry?.description || 'Inisialisasi Saldo Awal Neraca (Day 1 Setup)',
      });
    } else if (valuationData?.summary.total_cost_value) {
      setOpeningForm(prev => ({
        ...prev,
        inventory_value: String(valuationData.summary.total_cost_value),
      }));
    }
    setIsOpeningBalanceModalOpen(true);
  };

  // Handle Opening Balance Submit
  const handleSaveOpeningBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingOpening(true);

    try {
      const supplierDebtsPayload = Object.entries(supplierDebtsMap).map(([id, amt]) => ({
        supplier_id: parseInt(id, 10),
        amount: parseFloat(amt) || 0,
      })).filter(x => x.amount > 0);

      const customerDebtsPayload = Object.entries(customerDebtsMap).map(([id, amt]) => ({
        customer_id: parseInt(id, 10),
        amount: parseFloat(amt) || 0,
      })).filter(x => x.amount > 0);

      const res = await fetch('/api/accounting/opening-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...openingForm,
          supplier_debts: supplierDebtsPayload,
          customer_debts: customerDebtsPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan saldo awal');
      }

      alert('Inisialisasi Saldo Awal Neraca berhasil disinkronkan ke Buku Besar, Daftar Supplier, dan Daftar Pelanggan!');
      setIsOpeningBalanceModalOpen(false);
      fetchAccountingData();
      if (activeTab === 'ledger') fetchLedger(selectedLedgerAccount);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsSubmittingOpening(false);
    }
  };

  // Calculations for Opening Balance Simulation
  const calcAssets = 
    (parseFloat(openingForm.cash_drawer) || 0) +
    (parseFloat(openingForm.bank_balance) || 0) +
    (parseFloat(openingForm.ppob_deposit) || 0) +
    (parseFloat(openingForm.receivables) || 0) +
    (parseFloat(openingForm.inventory_value) || 0);

  const calcLiabilities = parseFloat(openingForm.payables) || 0;
  const calcEquity = calcAssets - calcLiabilities;

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-57px)] overflow-y-auto bg-slate-100 p-3 md:p-4 space-y-3 md:space-y-4 pb-16 md:pb-4">
      {/* Top Banner */}
      <div className="bg-white p-3 md:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-blue-600" />
            <h1 className="text-base md:text-lg font-black text-slate-800">
              Modul Akuntansi & Double-Entry Bookkeeping
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Penjurnalan otomatis, pemisahan HPP Ritel vs HPP Deposit PPOB, neraca saldo, dan buku besar terpadu
          </p>
        </div>

        {/* Action Buttons: Setup Saldo Awal & Panduan */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsGuideModalOpen(true)}
            className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-blue-600" />
            <span>Panduan Pemakaian Pertama</span>
          </button>

          <button
            onClick={openOpeningModalWithSync}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-600/30 flex items-center gap-1.5 transition cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Setup Saldo Awal (Day 1)</span>
          </button>
        </div>
      </div>

      {/* Live Synchronization Status Banner (Day 1) */}
      {syncStatus?.is_configured ? (
        <div className="bg-white p-3.5 md:p-4 rounded-2xl border border-emerald-200 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <div className="font-black text-xs md:text-sm text-slate-800 flex items-center gap-1.5 flex-wrap">
                  <span>Status Pembukuan Saldo Awal (Day 1): Terbuku & Tersinkronisasi</span>
                  <span className="text-[10px] font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200">
                    {syncStatus.entry?.entry_no}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Ditetapkan pada {syncStatus.entry?.transaction_date ? new Date(syncStatus.entry.transaction_date).toLocaleString('id-ID') : '-'} • Neraca Saldo Seimbang
                </div>
              </div>
            </div>

            <button
              onClick={openOpeningModalWithSync}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 self-start md:self-auto cursor-pointer"
            >
              <span>Sesuaikan / Update Saldo Awal &rarr;</span>
            </button>
          </div>

          {/* Sync reconciliation metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10.5px] text-slate-500 block truncate">1-1001 Kas Laci</span>
              <span className="font-extrabold font-mono text-slate-800 text-xs">
                Rp {syncStatus.balances.cash_drawer.toLocaleString('id-ID')}
              </span>
              <span className="text-[10px] text-emerald-600 block mt-0.5 font-bold">🟢 Sesuai Laci</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10.5px] text-slate-500 block truncate">1-1002 Rek Bank</span>
              <span className="font-extrabold font-mono text-slate-800 text-xs">
                Rp {syncStatus.balances.bank_balance.toLocaleString('id-ID')}
              </span>
              <span className="text-[10px] text-emerald-600 block mt-0.5 font-bold">🟢 Sesuai Bank</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10.5px] text-slate-500 block truncate">1-1003 PPOB iPay</span>
              <span className="font-extrabold font-mono text-slate-800 text-xs">
                Rp {syncStatus.balances.ppob_deposit.toLocaleString('id-ID')}
              </span>
              <span className="text-[10px] text-emerald-600 block mt-0.5 font-bold">🟢 Deposit Aktif</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10.5px] text-slate-500 block truncate">1-1005 Persediaan</span>
              <span className="font-extrabold font-mono text-slate-800 text-xs">
                Rp {syncStatus.balances.inventory_value.toLocaleString('id-ID')}
              </span>
              <span className={`text-[10px] block mt-0.5 font-bold ${syncStatus.reconciliation.inventory_matches ? 'text-emerald-600' : 'text-amber-600'}`}>
                {syncStatus.reconciliation.inventory_matches ? '🟢 Klop dg Stok' : '⚠️ Beda dg Stok'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10.5px] text-slate-500 block truncate">1-1004 Piutang</span>
              <span className="font-extrabold font-mono text-slate-800 text-xs">
                Rp {syncStatus.balances.receivables.toLocaleString('id-ID')}
              </span>
              <span className={`text-[10px] block mt-0.5 font-bold ${syncStatus.reconciliation.receivables_matches ? 'text-emerald-600' : 'text-amber-600'}`}>
                {syncStatus.reconciliation.receivables_matches ? '🟢 Klop Pelanggan' : '⚠️ Beda Kasbon'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10.5px] text-slate-500 block truncate">2-1001 Hutang Sup</span>
              <span className="font-extrabold font-mono text-rose-600 text-xs">
                Rp {syncStatus.balances.payables.toLocaleString('id-ID')}
              </span>
              <span className={`text-[10px] block mt-0.5 font-bold ${syncStatus.reconciliation.payables_matches ? 'text-emerald-600' : 'text-amber-600'}`}>
                {syncStatus.reconciliation.payables_matches ? '🟢 Klop Supplier' : '⚠️ Beda Hutang'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200">
              <span className="text-[10.5px] text-blue-600 block truncate font-bold">3-1001 Modal Pemilik</span>
              <span className="font-extrabold font-mono text-blue-800 text-xs">
                Rp {syncStatus.balances.owner_equity.toLocaleString('id-ID')}
              </span>
              <span className="text-[10px] text-blue-700 block mt-0.5 font-bold">
                {syncStatus.reconciliation.is_balanced ? '🟢 100% Seimbang' : '⚠️ Unbalanced'}
              </span>
            </div>
          </div>

          {/* Quick Jump Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] font-semibold text-slate-600">
            <span className="text-slate-400">Verifikasi Cepat:</span>
            <button 
              onClick={() => setActiveTab('journals')}
              className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
            >
              Lihat di Jurnal Umum &rarr;
            </button>
            <button 
              onClick={() => {
                setSelectedLedgerAccount('1-1005');
                setActiveTab('ledger');
              }}
              className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
            >
              Buku Besar Persediaan &rarr;
            </button>
            <button 
              onClick={() => {
                setSelectedLedgerAccount('2-1001');
                setActiveTab('ledger');
              }}
              className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
            >
              Buku Besar Hutang &rarr;
            </button>
            <button 
              onClick={() => setActiveTab('trial_balance')}
              className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
            >
              Cek Neraca Saldo &rarr;
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 p-3.5 md:p-4 rounded-2xl border border-amber-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-extrabold text-xs md:text-sm text-amber-900">
                Saldo Awal Neraca (Day 1) Belum Dikonfigurasi
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                Agar seluruh pembukuan toko, neraca saldo, buku besar per akun, dan saldo kas awal tercatat secara resmi, silakan lakukan inisialisasi saldo awal.
              </p>
            </div>
          </div>
          <button
            onClick={openOpeningModalWithSync}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Setup Saldo Awal Sekarang</span>
          </button>
        </div>
      )}

      {/* Tab Controls Bar - Modern Executive Navigation Cards */}
      <div className="bg-white p-2.5 md:p-3 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-2.5">
          {[
            { id: 'pl', label: 'Laba Rugi (P&L)', desc: 'Performa & Margin Toko', icon: TrendingUp },
            { id: 'ledger', label: 'Buku Besar per Akun', desc: 'Detail Mutasi Akun', icon: BookOpen },
            { id: 'journals', label: 'Jurnal Umum', desc: 'Audit Debet / Kredit', icon: FileText },
            { id: 'trial_balance', label: 'Neraca Saldo', desc: 'Keseimbangan Neraca', icon: Scale },
            { id: 'coa', label: 'Bagan Akun (COA)', desc: 'Daftar Kode Akun', icon: Layers },
            { id: 'operational', label: 'Pengeluaran & Pemasukan Lain', desc: 'Kas Operasional & Biaya', icon: Wallet },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`group p-2.5 md:py-3.5 md:px-3 rounded-xl transition-all duration-200 flex items-center gap-2.5 cursor-pointer text-left min-h-[64px] h-full ${
                  isActive
                    ? 'bg-linear-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white shadow-md shadow-blue-500/25 ring-2 ring-blue-500/30'
                    : 'bg-slate-50/90 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/80 hover:border-blue-300 hover:shadow-xs'
                }`}
              >
                <div
                  className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 ${
                    isActive
                      ? 'bg-white/20 text-white shadow-inner'
                      : 'bg-white text-blue-600 border border-slate-200/70 group-hover:bg-blue-50 group-hover:border-blue-200 shadow-2xs'
                  }`}
                >
                  <Icon className="w-5 h-5 md:w-5.5 md:h-5.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className={`block font-black text-xs md:text-sm leading-tight ${
                      isActive ? 'text-white' : 'text-slate-800 group-hover:text-blue-700'
                    }`}
                  >
                    {tab.label}
                  </span>
                  <span
                    className={`block text-[10.5px] md:text-[11px] leading-tight truncate mt-1 ${
                      isActive ? 'text-blue-100 font-medium' : 'text-slate-400 group-hover:text-slate-500 font-normal'
                    }`}
                  >
                    {tab.desc}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: Segregated & Combined Profit & Loss (P&L) */}
      {activeTab === 'pl' && plData && (
        <div className="space-y-4">
          {/* Highlight Cards: Segregated Margin (PRD Section 4) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Retail P&L */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3.5 hover:shadow-md transition">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight block">
                      Operasional Ritel Fisik
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Penjualan Barang Minimarket</span>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100/90 text-blue-800 border border-blue-200/60">
                  Barang Toko
                </span>
              </div>
              <div className="space-y-2 text-xs">
                {(plData.retail.discounts ?? 0) > 0 ? (
                  <>
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-slate-500 font-medium">Penjualan Kotor (4-1001):</span>
                      <span className="font-mono font-bold text-slate-900">Rp {(plData.retail.grossRevenue ?? plData.retail.revenue).toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5">
                      <span className="text-rose-600 font-medium">Diskon Penjualan (4-1004):</span>
                      <span className="font-mono font-bold text-rose-600">-Rp {(plData.retail.discounts || 0).toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between items-center py-0.5 font-semibold text-slate-800">
                      <span>Penjualan Bersih:</span>
                      <span className="font-mono font-bold">Rp {plData.retail.revenue.toLocaleString('id-ID')}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center py-0.5">
                    <span className="text-slate-500 font-medium">Omzet Penjualan (4-1001):</span>
                    <span className="font-mono font-bold text-slate-900">Rp {plData.retail.revenue.toLocaleString('id-ID')}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500 font-medium">HPP Persediaan (5-1001):</span>
                  <span className="font-mono font-bold text-rose-600">-Rp {plData.retail.cogs.toLocaleString('id-ID')}</span>
                </div>
                <div className="pt-2.5 border-t border-slate-100 flex justify-between items-center">
                  <span className="font-bold text-slate-800">Laba Kotor Ritel:</span>
                  <span className="font-mono text-base font-black text-blue-700">
                    Rp {plData.retail.grossProfit.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-end pt-0.5">
                  <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                    Margin: {plData.retail.marginPercent.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* PPOB P&L */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3.5 hover:shadow-md transition">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight block">
                      Produk Digital PPOB
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Pulsa, Paket Data, Tagihan</span>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100/90 text-amber-800 border border-amber-200/60">
                  ipay.my.id
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500 font-medium">Omzet Penjualan (4-1002):</span>
                  <span className="font-mono font-bold text-slate-900">Rp {plData.ppob.revenue.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-500 font-medium">HPP Deposit Modal (5-1002):</span>
                  <span className="font-mono font-bold text-rose-600">-Rp {plData.ppob.cogs.toLocaleString('id-ID')}</span>
                </div>
                <div className="pt-2.5 border-t border-slate-100 flex justify-between items-center">
                  <span className="font-bold text-slate-800">Laba Kotor PPOB:</span>
                  <span className="font-mono text-base font-black text-amber-600">
                    Rp {plData.ppob.grossProfit.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-end pt-0.5">
                  <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100">
                    Margin: {plData.ppob.marginPercent.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Combined Net Profit */}
            <div className="bg-linear-to-br from-slate-950 via-slate-900 to-indigo-950 text-white p-5 rounded-2xl shadow-md space-y-3.5 border border-slate-800 relative overflow-hidden">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-100 uppercase tracking-tight block">
                      Laba Bersih Gabungan
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Ritel + PPOB + Operasional</span>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                  Unified Ledger
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-300 py-0.5">
                  <span className="text-slate-400 font-medium">Total Omzet Toko:</span>
                  <span className="font-mono font-bold text-white">Rp {plData.combined.totalRevenue.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300 py-0.5">
                  <span className="text-slate-400 font-medium">Total HPP (Ritel + Deposit):</span>
                  <span className="font-mono font-bold text-rose-300">-Rp {plData.combined.totalCOGS.toLocaleString('id-ID')}</span>
                </div>
                {plData.operatingExpenses > 0 && (
                  <div className="flex justify-between items-center text-slate-300 py-0.5">
                    <span className="text-slate-400 font-medium">Beban Selisih / Ops:</span>
                    <span className="font-mono font-bold text-rose-300">-Rp {plData.operatingExpenses.toLocaleString('id-ID')}</span>
                  </div>
                )}
                <div className="pt-2.5 border-t border-slate-800/80 flex justify-between items-center">
                  <span className="font-bold text-white">Laba Bersih Toko:</span>
                  <span className="font-mono text-xl font-black text-emerald-400">
                    Rp {plData.combined.netProfit.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-end pt-0.5">
                  <span className="text-[10.5px] font-black px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Profit Margin: {plData.combined.marginPercent.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Formal Structured Financial Statement (Laporan Laba Rugi Komprehensif) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800">
                  Laporan Laba Rugi Standar (Income Statement)
                </h3>
                <p className="text-xs text-slate-500">
                  Format baku laporan keuangan akuntansi ritel & produk digital
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-200 text-slate-700">
                Standar Akuntansi POS
              </span>
            </div>

            <div className="p-5 font-sans text-xs space-y-4">
              {/* I. PENDAPATAN OPERASIONAL */}
              <div className="space-y-1.5">
                <div className="font-bold text-slate-900 uppercase text-[11px] tracking-wide border-b border-slate-200 pb-1">
                  I. Pendapatan Operasional Usaha
                </div>
                <div className="flex justify-between pl-4 text-slate-600 py-0.5">
                  <span>4-1001 Penjualan Kotor Barang Ritel Toko</span>
                  <span className="font-mono font-medium">Rp {(plData.retail.grossRevenue ?? plData.retail.revenue).toLocaleString('id-ID')}</span>
                </div>
                {(plData.retail.discounts ?? 0) > 0 && (
                  <div className="flex justify-between pl-4 text-rose-600 py-0.5">
                    <span>4-1004 Potongan & Diskon Penjualan (Kontra Pendapatan)</span>
                    <span className="font-mono font-medium">(Rp {(plData.retail.discounts || 0).toLocaleString('id-ID')})</span>
                  </div>
                )}
                {(plData.retail.discounts ?? 0) > 0 && (
                  <div className="flex justify-between pl-6 text-slate-700 font-semibold py-0.5 bg-slate-50/80 rounded px-2">
                    <span>Penjualan Bersih Ritel</span>
                    <span className="font-mono">Rp {plData.retail.revenue.toLocaleString('id-ID')}</span>
                  </div>
                )}
                <div className="flex justify-between pl-4 text-slate-600 py-0.5">
                  <span>4-1002 Penjualan Produk Digital PPOB (iPay)</span>
                  <span className="font-mono font-medium">Rp {plData.ppob.revenue.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-800 pt-1 border-t border-dashed border-slate-200 pl-2">
                  <span>Total Pendapatan Operasional (Net)</span>
                  <span className="font-mono">Rp {(plData.retail.revenue + plData.ppob.revenue).toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* II. HARGA POKOK PENJUALAN */}
              <div className="space-y-1.5 pt-2">
                <div className="font-bold text-slate-900 uppercase text-[11px] tracking-wide border-b border-slate-200 pb-1">
                  II. Beban Pokok Penjualan (HPP)
                </div>
                <div className="flex justify-between pl-4 text-slate-600 py-0.5">
                  <span>5-1001 Harga Pokok Penjualan Persediaan Ritel</span>
                  <span className="font-mono font-medium">Rp {plData.retail.cogs.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between pl-4 text-slate-600 py-0.5">
                  <span>5-1002 Beban Modal / HPP Transaksi PPOB</span>
                  <span className="font-mono font-medium">Rp {plData.ppob.cogs.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-800 pt-1 border-t border-dashed border-slate-200 pl-2">
                  <span>Total Beban Pokok Penjualan (HPP)</span>
                  <span className="font-mono text-rose-700">(Rp {plData.combined.totalCOGS.toLocaleString('id-ID')})</span>
                </div>
              </div>

              {/* III. LABA KOTOR */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between font-bold text-blue-950">
                <div>
                  <span className="text-xs uppercase tracking-wide">III. Laba Kotor Usaha (Gross Profit)</span>
                  <span className="text-[11px] text-blue-700 font-normal ml-2">Margin: {plData.combined.marginPercent.toFixed(1)}%</span>
                </div>
                <span className="text-sm font-mono font-extrabold text-blue-800">
                  Rp {(plData.combined.totalRevenue - plData.combined.totalCOGS).toLocaleString('id-ID')}
                </span>
              </div>

              {/* IV. BEBAN OPERASIONAL */}
              <div className="space-y-1.5 pt-1">
                <div className="font-bold text-slate-900 uppercase text-[11px] tracking-wide border-b border-slate-200 pb-1">
                  IV. Beban Operasional & Toko
                </div>
                <div className="flex justify-between pl-4 text-slate-600 py-0.5">
                  <span>6-1001 Beban Operasional Toko (Listrik, Air, Gaji, ATK)</span>
                  <span className="font-mono font-medium">
                    Rp {(plData.generalExpenses ?? plData.operatingExpenses ?? 0).toLocaleString('id-ID')}
                  </span>
                </div>
                {(plData.cashDiscrepancyExpense ?? 0) !== 0 && (
                  <div className="flex justify-between pl-4 text-slate-600 py-0.5">
                    <span>5-1003 Beban Selisih Kas / Penyusutan Persediaan</span>
                    <span className="font-mono font-medium">
                      Rp {(plData.cashDiscrepancyExpense || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-800 pt-1 border-t border-dashed border-slate-200 pl-2">
                  <span>Total Beban Operasional</span>
                  <span className="font-mono text-rose-700">(Rp {(plData.operatingExpenses || 0).toLocaleString('id-ID')})</span>
                </div>
              </div>

              {/* V. PENDAPATAN LAIN-LAIN */}
              <div className="space-y-1.5 pt-1">
                <div className="font-bold text-slate-900 uppercase text-[11px] tracking-wide border-b border-slate-200 pb-1">
                  V. Pendapatan (Beban) Lain-lain
                </div>
                <div className="flex justify-between pl-4 text-slate-600 py-0.5">
                  <span>4-1003 Pendapatan Lain-lain (Admin Fee, Servis, Selisih Lebih Kas)</span>
                  <span className="font-mono font-medium text-emerald-700">
                    Rp {(plData.otherRevenue || 0).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* VI. LABA BERSIH */}
              <div className="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-xl flex items-center justify-between text-emerald-950 font-bold">
                <div>
                  <span className="text-sm uppercase tracking-wider font-extrabold">
                    VI. Laba Bersih Berjalan (Net Income)
                  </span>
                  <p className="text-[11px] text-emerald-700 font-normal mt-0.5">
                    Laba Kotor dikurangi Beban Operasional ditambah Pendapatan Lain-lain
                  </p>
                </div>
                <span className="text-xl font-mono font-black text-emerald-700">
                  Rp {plData.combined.netProfit.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 1B: Buku Besar per Akun (General Ledger) */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 md:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="font-extrabold text-sm text-slate-800">
                Buku Besar per Akun (Individual General Ledger)
              </h2>
              <p className="text-xs text-slate-500">
                Lacak seluruh riwayat mutasi debit, kredit, memo transaksi, dan saldo berjalan
              </p>
            </div>

            {/* Account Selector Dropdown */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-600 whitespace-nowrap">Pilih Akun:</label>
              <select
                value={selectedLedgerAccount}
                onChange={e => setSelectedLedgerAccount(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {coaList.map(acc => (
                  <option key={acc.code} value={acc.code}>
                    {acc.code} - {acc.name} ({acc.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {ledgerLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
              <span>Memuat mutasi buku besar...</span>
            </div>
          ) : ledgerData ? (
            <div className="space-y-4">
              {/* Account Summary Banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-blue-700 text-sm">{ledgerData.account.code}</span>
                    <span className="font-extrabold text-slate-800 text-sm">{ledgerData.account.name}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                    <span>Klasifikasi: <strong className="text-slate-700">{ledgerData.account.type}</strong></span>
                    <span>Saldo Normal: <strong className="text-slate-700">{ledgerData.account.normal_balance}</strong></span>
                  </div>
                </div>

                <div className="text-right sm:border-l sm:border-slate-200 sm:pl-4">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Saldo Akhir Berjalan
                  </div>
                  <div className="text-xl font-mono font-black text-slate-900 mt-0.5">
                    Rp {ledgerData.finalBalance.toLocaleString('id-ID')}
                  </div>
                </div>
              </div>

              {/* 4 Summary Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10.5px] font-bold text-slate-500 uppercase block">Saldo Normal</span>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">
                    {ledgerData.account.normal_balance}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                  <span className="text-[10.5px] font-bold text-blue-700 uppercase block">Total Debit</span>
                  <div className="text-sm font-mono font-black text-blue-800 mt-0.5">
                    Rp {ledgerData.entries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0).toLocaleString('id-ID')}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                  <span className="text-[10.5px] font-bold text-indigo-700 uppercase block">Total Kredit</span>
                  <div className="text-sm font-mono font-black text-indigo-800 mt-0.5">
                    Rp {ledgerData.entries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0).toLocaleString('id-ID')}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10.5px] font-bold text-emerald-700 uppercase block">Total Mutasi</span>
                  <div className="text-sm font-mono font-black text-emerald-800 mt-0.5">
                    {ledgerData.entries.length} Entri
                  </div>
                </div>
              </div>

              {/* Ledger Entries Table */}
              {ledgerData.entries.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  Belum ada mutasi jurnal yang tercatat untuk akun ini.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-[10.5px] font-bold text-slate-500 uppercase border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Tanggal & Waktu</th>
                        <th className="py-2.5 px-3">No. Jurnal</th>
                        <th className="py-2.5 px-3">Ref / Tipe</th>
                        <th className="py-2.5 px-3">Keterangan / Memo</th>
                        <th className="py-2.5 px-3 text-right">Debit (Rp)</th>
                        <th className="py-2.5 px-3 text-right">Kredit (Rp)</th>
                        <th className="py-2.5 px-3 text-right">Saldo Berjalan (Rp)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11.5px]">
                      {ledgerData.entries.map((entry: any) => (
                        <tr key={entry.id} className="hover:bg-slate-50/80 transition">
                          <td className="py-2.5 px-3 text-slate-500 font-sans">
                            {new Date(entry.transaction_date).toLocaleString('id-ID')}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-blue-600">{entry.entry_no}</td>
                          <td className="py-2.5 px-3 font-sans">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                              {entry.reference_type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-sans text-slate-700">{entry.memo}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                            {entry.debit > 0 ? entry.debit.toLocaleString('id-ID') : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                            {entry.credit > 0 ? entry.credit.toLocaleString('id-ID') : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900 bg-slate-50/60">
                            Rp {entry.running_balance.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Tab 2: General Journal Entries (Audit Trail) */}
      {activeTab === 'journals' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="font-extrabold text-sm text-slate-800">
              Buku Jurnal Umum (Audit Trail Auto-Journaling)
            </h2>
            <button onClick={fetchAccountingData} className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-semibold">
              <RefreshCw className="w-3 h-3" />
              <span>Muat Ulang</span>
            </button>
          </div>

          <div className="space-y-3">
            {journals.map(entry => (
              <div key={entry.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {entry.entry_no}
                    </span>
                    <span className="font-bold text-slate-800">{entry.description}</span>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {new Date(entry.transaction_date).toLocaleString('id-ID')}
                  </span>
                </div>

                {/* Lines Table */}
                <table className="w-full text-left text-xs border-t border-slate-200 mt-2">
                  <thead className="text-[10px] text-slate-400 uppercase">
                    <tr>
                      <th className="py-1 px-2">Kode Akun</th>
                      <th className="py-1 px-2">Nama Akun & Memo</th>
                      <th className="py-1 px-2 text-right">Debit (Rp)</th>
                      <th className="py-1 px-2 text-right">Kredit (Rp)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {entry.lines.map(line => (
                      <tr key={line.id}>
                        <td className="py-1 px-2 font-bold text-slate-700">{line.account_code}</td>
                        <td className="py-1 px-2 font-sans text-slate-600">
                          <span className="font-semibold text-slate-800">{line.account_name}</span>
                          {line.memo && <span className="text-[11px] text-slate-400 ml-2">({line.memo})</span>}
                        </td>
                        <td className="py-1 px-2 text-right font-bold text-slate-800">
                          {line.debit > 0 ? line.debit.toLocaleString('id-ID') : '-'}
                        </td>
                        <td className="py-1 px-2 text-right font-bold text-slate-800">
                          {line.credit > 0 ? line.credit.toLocaleString('id-ID') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Trial Balance (Neraca Saldo) */}
      {activeTab === 'trial_balance' && trialBalance && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h2 className="font-extrabold text-sm text-slate-800">
                Neraca Saldo (Trial Balance Equilibrium)
              </h2>
              <p className="text-xs text-slate-500">
                Memastikan keseimbangan total Debit dan Kredit seluruh akun buku besar
              </p>
            </div>

            <div className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
              trialBalance.isBalanced ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}>
              <CheckCircle2 className="w-4 h-4" />
              <span>{trialBalance.isBalanced ? 'Seimbang (Balanced)' : 'Tidak Seimbang'}</span>
            </div>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10.5px] font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Kode</th>
                <th className="py-2.5 px-3">Nama Akun Buku Besar</th>
                <th className="py-2.5 px-3">Klasifikasi</th>
                <th className="py-2.5 px-3 text-right">Debit (Rp)</th>
                <th className="py-2.5 px-3 text-right">Kredit (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {trialBalance.accounts.map(acc => (
                <tr key={acc.code} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-slate-800">{acc.code}</td>
                  <td className="py-2.5 px-3 font-sans font-medium text-slate-800">{acc.name}</td>
                  <td className="py-2.5 px-3 font-sans text-slate-500 text-[11px]">{acc.type}</td>
                  <td className="py-2.5 px-3 text-right font-bold">
                    {acc.debit > 0 ? acc.debit.toLocaleString('id-ID') : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold">
                    {acc.credit > 0 ? acc.credit.toLocaleString('id-ID') : '-'}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                <td colSpan={3} className="py-3 px-3 font-sans text-right">TOTAL</td>
                <td className="py-3 px-3 text-right">Rp {trialBalance.totalDebit.toLocaleString('id-ID')}</td>
                <td className="py-3 px-3 text-right">Rp {trialBalance.totalCredit.toLocaleString('id-ID')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: Chart of Accounts (COA) */}
      {activeTab === 'coa' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <h2 className="font-extrabold text-sm text-slate-800 pb-2 border-b border-slate-100">
            Daftar Bagan Akun (Chart of Accounts)
          </h2>

          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10.5px] font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Kode Akun</th>
                <th className="py-2.5 px-3">Nama Akun</th>
                <th className="py-2.5 px-3">Tipe</th>
                <th className="py-2.5 px-3">Saldo Normal</th>
                <th className="py-2.5 px-3 text-right">Saldo Saat Ini (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {coaList.map(c => (
                <tr key={c.code} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-bold text-blue-700">{c.code}</td>
                  <td className="py-2.5 px-3 font-sans font-bold text-slate-800">{c.name}</td>
                  <td className="py-2.5 px-3 font-sans text-slate-600">{c.type}</td>
                  <td className="py-2.5 px-3 text-slate-600">{c.normal_balance}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                    Rp {c.balance.toLocaleString('id-ID')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 5: Pengeluaran Umum & Pemasukan Lain-lain */}
      {activeTab === 'operational' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 md:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="font-extrabold text-sm text-slate-800">
                Pencatatan Pengeluaran Umum & Pemasukan Lain-lain
              </h2>
              <p className="text-xs text-slate-500">
                Kelola kas masuk/keluar non-penjualan utama (misal: jual kardus bekas, beli kresek/lakban, listrik)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchOperational}
                disabled={loadingOperational}
                className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 cursor-pointer"
                title="Muat ulang transaksi operasional"
              >
                <RefreshCw className={`w-4 h-4 ${loadingOperational ? 'animate-spin' : ''}`} />
              </button>

              <button
                type="button"
                onClick={() => setIsCashInOutModalOpen(true)}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer transition"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Catat Mutasi Kas</span>
              </button>
            </div>
          </div>

          {/* Quick Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200">
              <span className="text-[11px] font-bold text-rose-800 uppercase block">Total Pengeluaran Umum</span>
              <div className="text-xl font-mono font-black text-rose-700 mt-1">
                Rp {operationalList
                  .filter(o => o.type === 'EXPENSE')
                  .reduce((sum, o) => sum + (o.amount || 0), 0)
                  .toLocaleString('id-ID')}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-[11px] font-bold text-emerald-800 uppercase block">Total Pemasukan Lain-lain</span>
              <div className="text-xl font-mono font-black text-emerald-700 mt-1">
                Rp {operationalList
                  .filter(o => o.type === 'INCOME')
                  .reduce((sum, o) => sum + (o.amount || 0), 0)
                  .toLocaleString('id-ID')}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-bold text-slate-600 uppercase block">Total Transaksi Operasional</span>
              <div className="text-xl font-mono font-black text-slate-900 mt-1">
                {operationalList.length} Transaksi
              </div>
            </div>
          </div>

          {/* Table */}
          {loadingOperational ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
              <span>Memuat transaksi operasional...</span>
            </div>
          ) : operationalList.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Belum ada transaksi pengeluaran umum atau pemasukan lain yang dicatat.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-[10.5px] font-bold text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Tanggal & Waktu</th>
                    <th className="py-2.5 px-3">Tipe</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-3">Keterangan / Rincian Dinamis</th>
                    <th className="py-2.5 px-3">Akun Kas Toko</th>
                    <th className="py-2.5 px-3 text-right">Nominal (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {operationalList.map(op => (
                    <tr key={op.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                        {new Date(op.created_at).toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          op.type === 'INCOME'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {op.type === 'INCOME' ? 'Pemasukan Lain' : 'Pengeluaran'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800">
                        {op.category}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {op.description}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                        {op.account_code} {op.account_code === '1-1001' ? '(Kas Laci)' : '(Bank Toko)'}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono font-black ${
                        op.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {op.type === 'INCOME' ? '+' : '-'}Rp {op.amount?.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Setup Saldo Awal Neraca (Day 1 Setup) */}
      {isOpeningBalanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>Inisialisasi Saldo Awal Neraca (Day 1 Setup)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Input posisi aset, kasbon, dan modal awal toko saat pertama kali menggunakan POS
                </p>
              </div>
              <button
                onClick={() => setIsOpeningBalanceModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOpeningBalance} className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    1. Kas Laci Kasir (1-1001) Rp
                  </label>
                  <input
                    type="number"
                    value={openingForm.cash_drawer}
                    onChange={e => setOpeningForm({ ...openingForm, cash_drawer: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400">Uang tunai modal kasir awal</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    2. Kas Rekening Bank (1-1002) Rp
                  </label>
                  <input
                    type="number"
                    value={openingForm.bank_balance}
                    onChange={e => setOpeningForm({ ...openingForm, bank_balance: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400">Saldo rekening penampung toko</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    3. Deposit PPOB ipay.my.id (1-1003) Rp
                  </label>
                  <input
                    type="number"
                    value={openingForm.ppob_deposit}
                    onChange={e => setOpeningForm({ ...openingForm, ppob_deposit: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400">Saldo akun ipay untuk transaksi digital</span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">
                      4. Piutang Kasbon Awal (1-1004) Rp
                    </label>
                    {customersList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowCustomerBreakdown(!showCustomerBreakdown)}
                        className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer"
                      >
                        {showCustomerBreakdown ? 'Tutup Rincian' : `📋 Rincikan per Pelanggan (${customersList.length})`}
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    value={openingForm.receivables}
                    onChange={e => setOpeningForm({ ...openingForm, receivables: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400">Total kasbon pelanggan lama yang belum dibayar</span>

                  {showCustomerBreakdown && customersList.length > 0 && (
                    <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 max-h-36 overflow-y-auto">
                      <div className="text-[10px] font-bold text-slate-500 mb-1">Alokasikan ke masing-masing pelanggan:</div>
                      {customersList.map(cust => (
                        <div key={cust.id} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="truncate flex-1 font-semibold text-slate-700">{cust.name}</span>
                          <input
                            type="number"
                            placeholder="0"
                            value={customerDebtsMap[cust.id] || ''}
                            onChange={e => {
                              const val = e.target.value;
                              const newMap = { ...customerDebtsMap, [cust.id]: val };
                              setCustomerDebtsMap(newMap);
                              const sum = Object.values(newMap).reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
                              setOpeningForm(prev => ({ ...prev, receivables: String(sum) }));
                            }}
                            className="w-24 px-2 py-1 rounded-lg border border-slate-300 text-right font-mono text-[11px]"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">
                      5. Persediaan Fisik Toko (1-1005) Rp
                    </label>
                    {valuationData?.summary?.total_cost_value ? (
                      <button
                        type="button"
                        onClick={() => setOpeningForm(prev => ({ ...prev, inventory_value: String(valuationData.summary.total_cost_value) }))}
                        className="text-[10px] text-blue-600 font-bold hover:underline cursor-pointer"
                        title="Tarik nilai total modal HPP dari seluruh produk di katalog"
                      >
                        ⚡ Tarik HPP Katalog (Rp {(valuationData.summary.total_cost_value ?? 0).toLocaleString('id-ID')})
                      </button>
                    ) : null}
                  </div>
                  <input
                    type="number"
                    value={openingForm.inventory_value}
                    onChange={e => setOpeningForm({ ...openingForm, inventory_value: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400">Total modal HPP fisik barang di toko</span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">
                      6. Hutang Supplier Awal (2-1001) Rp
                    </label>
                    {suppliersList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowSupplierBreakdown(!showSupplierBreakdown)}
                        className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer"
                      >
                        {showSupplierBreakdown ? 'Tutup Rincian' : `📋 Rincikan per Supplier (${suppliersList.length})`}
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    value={openingForm.payables}
                    onChange={e => setOpeningForm({ ...openingForm, payables: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold text-rose-600"
                  />
                  <span className="text-[10px] text-slate-400">Hutang faktur lama ke supplier/distributor</span>

                  {showSupplierBreakdown && suppliersList.length > 0 && (
                    <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 max-h-36 overflow-y-auto">
                      <div className="text-[10px] font-bold text-slate-500 mb-1">Alokasikan ke masing-masing supplier:</div>
                      {suppliersList.map(sup => (
                        <div key={sup.id} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="truncate flex-1 font-semibold text-slate-700">{sup.name}</span>
                          <input
                            type="number"
                            placeholder="0"
                            value={supplierDebtsMap[sup.id] || ''}
                            onChange={e => {
                              const val = e.target.value;
                              const newMap = { ...supplierDebtsMap, [sup.id]: val };
                              setSupplierDebtsMap(newMap);
                              const sum = Object.values(newMap).reduce((acc, v) => acc + (parseFloat(v) || 0), 0);
                              setOpeningForm(prev => ({ ...prev, payables: String(sum) }));
                            }}
                            className="w-24 px-2 py-1 rounded-lg border border-slate-300 text-right font-mono text-[11px]"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Automatic Equilibrium Banner */}
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 space-y-1.5 font-mono">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Total Aset (Aktiva):</span>
                  <span className="font-bold text-blue-700">Rp {calcAssets.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Total Hutang (Liabilitas):</span>
                  <span className="font-bold text-rose-600">Rp {calcLiabilities.toLocaleString('id-ID')}</span>
                </div>
                <div className="pt-1.5 border-t border-blue-200 flex items-center justify-between font-bold text-xs">
                  <span className="text-slate-800 font-sans">Modal Pemilik (Ekuitas Awal 3-1001):</span>
                  <span className="text-emerald-700 text-sm">Rp {calcEquity.toLocaleString('id-ID')}</span>
                </div>
                <p className="text-[10px] font-sans text-blue-800 pt-1">
                  Persamaan Akuntansi: <strong>Aset = Hutang + Modal</strong> (Otomatis Seimbang 100%).
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpeningBalanceModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOpening}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold shadow-md flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmittingOpening ? 'Menyimpan...' : 'Simpan & Terapkan Saldo Awal'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Panduan Alur Kerja Buku Besar bagi Pemula */}
      {isGuideModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-blue-600" />
                  <span>Panduan Alur Kerja Buku Besar (Pemakaian Pertama)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Konsep akuntansi terpadu minimarket & PPOB tanpa cacat logika
                </p>
              </div>
              <button
                onClick={() => setIsGuideModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Step 1 */}
              <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 space-y-1">
                <div className="font-extrabold text-blue-800 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px]">1</span>
                  <span>Hari Pertama: Setup Saldo Awal Neraca (Opening Balance)</span>
                </div>
                <p className="text-slate-600 leading-relaxed pl-7">
                  Saat pertama kali membuka toko dengan sistem POS, toko sudah memiliki aset (uang tunai di laci, rekening bank, saldo deposit PPOB ipay.my.id, dan stok barang fisik). Sistem otomatis menyeimbangkannya ke <strong>Modal Pemilik (Ekuitas)</strong>: <code className="bg-white px-1 py-0.5 rounded font-mono">Modal = Total Aset - Total Hutang</code>.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="font-extrabold text-slate-800 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-700 text-white flex items-center justify-center text-[11px]">2</span>
                  <span>Penjualan Barang Ritel Fisik (Minimarket)</span>
                </div>
                <p className="text-slate-600 leading-relaxed pl-7">
                  Ketika kasir checkout barang fisik:
                  <br />• <strong>Debit:</strong> Kas Laci Kasir (1-1001) bertambah sejumlah uang yang diterima.
                  <br />• <strong>Kredit:</strong> Pendapatan Penjualan Ritel (4-1001) bertambah.
                  <br />• <strong>Debit:</strong> HPP Barang Dagangan (5-1001) dicatat sesuai harga modal beli rata-rata.
                  <br />• <strong>Kredit:</strong> Persediaan Barang (1-1005) berkurang nilainya.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="font-extrabold text-slate-800 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-700 text-white flex items-center justify-center text-[11px]">3</span>
                  <span>Penjualan Produk Digital PPOB (ipay.my.id)</span>
                </div>
                <p className="text-slate-600 leading-relaxed pl-7">
                  Ketika pelanggan beli pulsa/token listrik di kasir yang sama:
                  <br />• <strong>Debit:</strong> Kas Laci Kasir (1-1001) bertambah (harga jual).
                  <br />• <strong>Kredit:</strong> Pendapatan Penjualan PPOB (4-1002) bertambah.
                  <br />• <strong>Debit:</strong> HPP PPOB (5-1002) bertambah sebesar harga modal server.
                  <br />• <strong>Kredit:</strong> Deposit PPOB ipay.my.id (1-1003) berkurang sesuai saldo yang terpotong.
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 space-y-1">
                <div className="font-extrabold text-amber-800 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[11px]">4</span>
                  <span>Transaksi Kasbon & Pelunasan Hutang</span>
                </div>
                <p className="text-slate-600 leading-relaxed pl-7">
                  • <strong>Saat Ambil Kasbon:</strong> Sistem mencatat Debit Piutang Usaha (1-1004) dan memeriksa apakah melampaui plafon (credit limit).
                  <br />• <strong>Saat Pelunasan:</strong> Pelanggan mencicil/melunasi kasbon di kasir &rarr; Sistem mencatat Debit Kas Laci (1-1001), Kredit Piutang (1-1004), otomatis menambah uang kas masuk ke sesi shift kasir, dan mencetak struk termal bukti pelunasan.
                </p>
              </div>

              {/* Step 5 */}
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-1">
                <div className="font-extrabold text-emerald-800 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px]">5</span>
                  <span>Laporan Laba Rugi (P&L) & Neraca Saldo Otomatis</span>
                </div>
                <p className="text-slate-600 leading-relaxed pl-7">
                  Pemilik dapat melihat laba rugi gabungan maupun terpisah (berapa laba bersih dari ritel dan berapa laba dari PPOB) secara akurat tanpa perlu pembukuan manual lagi. Neraca saldo selalu seimbang (*balanced*).
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setIsGuideModalOpen(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cash In / Out (Pengeluaran Umum & Pemasukan Lain-lain) Modal */}
      <CashInOutModal
        isOpen={isCashInOutModalOpen}
        onClose={() => setIsCashInOutModalOpen(false)}
        onSuccess={() => {
          fetchOperational();
          fetchAccountingData();
        }}
      />
    </div>
  );
};
