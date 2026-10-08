import React, { useState, useEffect } from 'react';
import { 
  FileText, Printer, Ban, Search, CheckCircle2, 
  AlertCircle, RefreshCw, Eye, RotateCcw, TrendingUp,
  AlertTriangle, Users, Package, Trophy, Calendar, Truck
} from 'lucide-react';
import { Order } from '../types';
import { ReceiptModal } from '../components/ReceiptModal';
import { SupervisorPinModal } from '../components/SupervisorPinModal';
import { SalesReturnModal } from '../components/SalesReturnModal';

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'orders' | 'returns' | 'top_products' | 'low_stock' | 'top_entities'>('orders');
  
  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Selected Order for Receipt modal
  const [selectedReceiptText, setSelectedReceiptText] = useState('');
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState('');
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Void modal
  const [orderToVoid, setOrderToVoid] = useState<Order | null>(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  // Return modal
  const [orderForReturn, setOrderForReturn] = useState<Order | null>(null);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(false);

  // Analytics & Rankings
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'day' | 'month' | 'year'>('month');
  const [analyticsData, setAnalyticsData] = useState<{
    lowStock: any[];
    topProducts: any[];
    topCustomers: any[];
    topSuppliers: any[];
  } | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orders?limit=50');
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReturns = async () => {
    setLoadingReturns(true);
    try {
      const res = await fetch('/api/returns');
      const data = await res.json();
      setReturnsList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load returns:', err);
    } finally {
      setLoadingReturns(false);
    }
  };

  const fetchAnalytics = async (period: 'day' | 'month' | 'year') => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch(`/api/reports/analytics?period=${period}`);
      const data = await res.json();
      setAnalyticsData(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchReturns();
    fetchAnalytics(analyticsPeriod);
  }, []);

  const handlePeriodChange = (p: 'day' | 'month' | 'year') => {
    setAnalyticsPeriod(p);
    fetchAnalytics(p);
  };

  const handleViewReceipt = async (orderId: number) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      setSelectedReceiptText(data.receiptText);
      setSelectedInvoiceNo(data.order.invoice_no);
      setIsReceiptOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmVoid = async () => {
    if (!orderToVoid) return;
    const pin = prompt('Masukkan kembali PIN Supervisor untuk verifikasi final:');
    if (!pin) return;

    try {
      const res = await fetch(`/api/orders/${orderToVoid.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supervisorPin: pin,
          reason: voidReason || 'Pembatalan transaksi atas persetujuan supervisor',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        fetchOrders();
        fetchAnalytics(analyticsPeriod);
      } else {
        alert(data.error || 'Gagal membatalkan transaksi');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setOrderToVoid(null);
    }
  };

  const handleReturnSuccess = (result: any) => {
    fetchOrders();
    fetchReturns();
    fetchAnalytics(analyticsPeriod);
    const receipt = result.returnReceiptText || result.receiptText;
    const retNo = result.return?.return_no || result.return_no || 'RETUR';
    if (result.message) {
      alert(result.message);
    }
    if (receipt) {
      setSelectedReceiptText(receipt);
      setSelectedInvoiceNo(retNo);
      setIsReceiptOpen(true);
    }
  };

  const filteredOrders = orders.filter(o =>
    o.invoice_no.toLowerCase().includes(search.toLowerCase()) ||
    (o.cashier_name && o.cashier_name.toLowerCase().includes(search.toLowerCase())) ||
    (o.customer_name && o.customer_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-57px)] overflow-hidden bg-slate-100 p-4 space-y-3">
      {/* Top Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-slate-800">
            Laporan Transaksi & Analisis Penjualan
          </h1>
          <p className="text-xs text-slate-500">
            Riwayat struk kasir, retur barang, stok limit menipis, dan peringkat penjualan produk/pelanggan
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'orders' && (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari no faktur / kasir..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs font-medium w-52 sm:w-60"
              />
            </div>
          )}

          <button
            onClick={() => {
              fetchOrders();
              fetchReturns();
              fetchAnalytics(analyticsPeriod);
            }}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
            title="Muat ulang seluruh data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-2 overflow-x-auto no-scrollbar text-xs font-bold">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'orders' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Riwayat Transaksi</span>
          </button>

          <button
            onClick={() => setActiveTab('returns')}
            className={`px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'returns' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Riwayat Retur ({returnsList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('top_products')}
            className={`px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'top_products' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Peringkat Penjualan Produk</span>
          </button>

          <button
            onClick={() => setActiveTab('low_stock')}
            className={`px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'low_stock' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Stok Limit / Menipis ({analyticsData?.lowStock?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('top_entities')}
            className={`px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'top_entities' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Pelanggan & Supplier</span>
          </button>
        </div>

        {activeTab === 'top_products' && (
          <div className="flex items-center gap-1 pr-1 shrink-0">
            {(['day', 'month', 'year'] as const).map(p => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  analyticsPeriod === p ? 'bg-blue-100 text-blue-800' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {p === 'day' ? 'Hari Ini' : p === 'month' ? 'Bulan Ini' : 'Tahun Ini'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tab 1: Orders Table */}
      {activeTab === 'orders' && (
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10.5px] font-bold sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">No. Faktur</th>
                  <th className="py-2.5 px-3">Waktu Transaksi</th>
                  <th className="py-2.5 px-3">Kasir & Shift</th>
                  <th className="py-2.5 px-3">Pelanggan</th>
                  <th className="py-2.5 px-3">Metode Bayar</th>
                  <th className="py-2.5 px-3 text-right">Ritel (Rp)</th>
                  <th className="py-2.5 px-3 text-right">PPOB (Rp)</th>
                  <th className="py-2.5 px-3 text-right">Grand Total (Rp)</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 font-mono font-bold text-blue-700">{order.invoice_no}</td>
                    <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">
                      {new Date(order.created_at).toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-800">{order.cashier_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{order.shift_number}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      {order.customer_name || 'Umum (Walk-in)'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 text-slate-700">
                        {order.payment_method}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      Rp {order.total_retail.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-amber-700 font-semibold">
                      Rp {order.total_ppob.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      Rp {order.grand_total.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        order.status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleViewReceipt(order.id)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                          title="Cetak Ulang Struk Thermal"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Struk</span>
                        </button>

                        {order.status === 'PAID' && (
                          <>
                            <button
                              onClick={() => {
                                setOrderForReturn(order);
                                setIsReturnModalOpen(true);
                              }}
                              className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition"
                              title="Retur Barang dari Transaksi Ini"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Retur</span>
                            </button>

                            <button
                              onClick={() => {
                                setOrderToVoid(order);
                                const r = prompt('Masukkan alasan pembatalan (Void):');
                                if (r) {
                                  setVoidReason(r);
                                  handleConfirmVoid();
                                }
                              }}
                              className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                              title="Batalkan Transaksi (Void) - Otorisasi Supervisor"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Sales Returns History */}
      {activeTab === 'returns' && (
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div>
              <h2 className="font-extrabold text-sm text-slate-800">
                Riwayat Retur Penjualan Barang
              </h2>
              <p className="text-xs text-slate-500">
                Seluruh riwayat pengembalian barang, pemulihan stok fisik, dan jurnal pembalik kas/piutang
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500">
              Total Retur: {returnsList.length} Transaksi
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {returnsList.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Belum ada transaksi retur yang diproses.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10.5px] font-bold sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">No. Retur</th>
                    <th className="py-2.5 px-3">Faktur Asal</th>
                    <th className="py-2.5 px-3">Waktu Retur</th>
                    <th className="py-2.5 px-3">Kasir</th>
                    <th className="py-2.5 px-3">Alasan Retur</th>
                    <th className="py-2.5 px-3">Metode Refund</th>
                    <th className="py-2.5 px-3 text-right">Total Refund (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {returnsList.map(ret => (
                    <tr key={ret.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 font-mono font-bold text-rose-700">{ret.return_no}</td>
                      <td className="py-3 px-3 font-mono text-blue-700">{ret.order_invoice_no}</td>
                      <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">
                        {new Date(ret.created_at).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-3 text-slate-800 font-semibold">{ret.cashier_name}</td>
                      <td className="py-3 px-3 text-slate-600">{ret.reason}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-100 text-slate-700">
                          {ret.refund_method}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-rose-600">
                        Rp {ret.total_refund_amount?.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Top Products Ranking */}
      {activeTab === 'top_products' && (
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div>
              <h2 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>Peringkat Penjualan Produk Terlaris</span>
              </h2>
              <p className="text-xs text-slate-500">
                Peringkat barang paling laris berdasarkan kuantitas terjual, omzet, dan estimasi laba kotor
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 uppercase">
              Periode: {analyticsPeriod === 'day' ? 'Hari Ini' : analyticsPeriod === 'month' ? 'Bulan Ini' : 'Tahun Ini'}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingAnalytics ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                <span>Memuat data peringkat produk...</span>
              </div>
            ) : !analyticsData?.topProducts?.length ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Tidak ada data penjualan produk pada periode ini.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10.5px] font-bold sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-14">Rank</th>
                    <th className="py-2.5 px-3">Nama Produk</th>
                    <th className="py-2.5 px-3">SKU / Barcode</th>
                    <th className="py-2.5 px-3 text-center">Jumlah Terjual</th>
                    <th className="py-2.5 px-3 text-right">Total Omzet (Rp)</th>
                    <th className="py-2.5 px-3 text-right">Estimasi Laba Kotor (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {analyticsData.topProducts.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${
                          idx === 0
                            ? 'bg-amber-400 text-amber-950 shadow-2xs'
                            : idx === 1
                            ? 'bg-slate-300 text-slate-800'
                            : idx === 2
                            ? 'bg-amber-700/20 text-amber-900'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800">{p.item_name}</td>
                      <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">{p.barcode || p.sku || '-'}</td>
                      <td className="py-3 px-3 text-center font-mono font-black text-blue-700">
                        {p.total_sold_qty} pcs
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        Rp {p.total_revenue?.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600">
                        Rp {p.gross_profit?.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Low Stock Alert Table */}
      {activeTab === 'low_stock' && (
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
            <div>
              <h2 className="font-extrabold text-sm text-amber-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Peringatan Stok Menipis & Stok Limit</span>
              </h2>
              <p className="text-xs text-amber-700">
                Daftar produk yang stok fisiknya telah mencapai atau berada di bawah batas minimum (Segera Re-order ke Supplier)
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-200 text-amber-900">
              {analyticsData?.lowStock?.length || 0} Produk Kritis
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingAnalytics ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                <span>Memeriksa stok gudang...</span>
              </div>
            ) : !analyticsData?.lowStock?.length ? (
              <div className="py-12 text-center text-xs text-emerald-600 font-bold flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                <span>Semua stok barang aman dan berada di atas batas minimum.</span>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10.5px] font-bold sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Kode / Barcode</th>
                    <th className="py-2.5 px-3">Nama Produk</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-3 text-center">Stok Saat Ini</th>
                    <th className="py-2.5 px-3 text-center">Batas Minimum</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Harga Beli / Pokok</th>
                    <th className="py-2.5 px-3 text-right">Harga Jual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {analyticsData.lowStock.map(p => (
                    <tr key={p.id} className="hover:bg-amber-50/40 transition">
                      <td className="py-3 px-3 font-mono font-bold text-slate-700">{p.barcode || p.sku}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">{p.name}</td>
                      <td className="py-3 px-3 text-slate-500">{p.category_name || '-'}</td>
                      <td className="py-3 px-3 text-center font-mono font-black text-rose-600">
                        {p.stock_quantity} {p.base_uom || 'pcs'}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-semibold text-slate-600">
                        {p.min_stock_alert} {p.base_uom || 'pcs'}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          p.stock_quantity <= 0
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {p.stock_quantity <= 0 ? 'HABIS TOTAL' : 'MENIPIS'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500">
                        Rp {p.cost_price?.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        Rp {p.selling_price?.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Top Customers & Suppliers */}
      {activeTab === 'top_entities' && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
          {/* Top Customers */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <h3 className="font-extrabold text-sm text-slate-800">
                  Peringkat Pelanggan Terbaik
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 font-semibold">Berdasarkan Total Belanja</span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {!analyticsData?.topCustomers?.length ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Belum ada transaksi pelanggan terdaftar.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 text-center w-10">#</th>
                      <th className="py-2 px-3">Nama Pelanggan</th>
                      <th className="py-2 px-3 text-center">Transaksi</th>
                      <th className="py-2 px-3 text-right">Total Belanja</th>
                      <th className="py-2 px-3 text-right">Sisa Hutang</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {analyticsData.topCustomers.map((c, i) => (
                      <tr key={c.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 text-center font-bold text-slate-400">{i + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-800">{c.name}</div>
                          {c.phone && <div className="text-[10px] text-slate-400 font-mono">{c.phone}</div>}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-700">{c.total_transactions}x</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700">
                          Rp {c.total_spent?.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-600">
                          {c.current_debt > 0 ? `Rp ${c.current_debt.toLocaleString('id-ID')}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Top Suppliers */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-600" />
                <h3 className="font-extrabold text-sm text-slate-800">
                  Peringkat Supplier Terbesar
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 font-semibold">Berdasarkan Total Pembelian (PO)</span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {!analyticsData?.topSuppliers?.length ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Belum ada data pembelian dari supplier.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 text-center w-10">#</th>
                      <th className="py-2 px-3">Nama Supplier</th>
                      <th className="py-2 px-3 text-center">Faktur PO</th>
                      <th className="py-2 px-3 text-right">Total Pasokan</th>
                      <th className="py-2 px-3 text-right">Hutang Dagang</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {analyticsData.topSuppliers.map((s, i) => (
                      <tr key={s.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 text-center font-bold text-slate-400">{i + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-800">{s.name}</div>
                          {s.phone && <div className="text-[10px] text-slate-400 font-mono">{s.phone}</div>}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-700">{s.total_orders}x</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700">
                          Rp {s.total_purchased?.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-600">
                          {s.current_debt > 0 ? `Rp ${s.current_debt.toLocaleString('id-ID')}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        receiptText={selectedReceiptText}
        invoiceNo={selectedInvoiceNo}
      />

      <SalesReturnModal
        isOpen={isReturnModalOpen}
        onClose={() => {
          setIsReturnModalOpen(false);
          setOrderForReturn(null);
        }}
        order={orderForReturn}
        onSuccess={handleReturnSuccess}
      />
    </div>
  );
};
