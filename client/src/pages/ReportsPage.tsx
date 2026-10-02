import React, { useState, useEffect } from 'react';
import { 
  FileText, Printer, Ban, Search, CheckCircle2, 
  AlertCircle, RefreshCw, Eye 
} from 'lucide-react';
import { Order } from '../types';
import { ReceiptModal } from '../components/ReceiptModal';
import { SupervisorPinModal } from '../components/SupervisorPinModal';

export const ReportsPage: React.FC = () => {
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

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orders?limit=50');
      const data = await res.json();
      setOrders(data);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

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
      } else {
        alert(data.error || 'Gagal membatalkan transaksi');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setOrderToVoid(null);
    }
  };

  const filteredOrders = orders.filter(o =>
    o.invoice_no.toLowerCase().includes(search.toLowerCase()) ||
    (o.cashier_name && o.cashier_name.toLowerCase().includes(search.toLowerCase())) ||
    (o.customer_name && o.customer_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-57px)] overflow-hidden bg-slate-100 p-4 space-y-4">
      {/* Title */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-slate-800">
            Riwayat Penjualan & Cetak Ulang Struk
          </h1>
          <p className="text-xs text-slate-500">
            Daftar seluruh transaksi hibrida kasir, reprint struk thermal, dan pembatalan (Void)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari no faktur / kasir..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs font-medium w-60"
            />
          </div>

          <button
            onClick={fetchOrders}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Orders Table */}
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
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleViewReceipt(order.id)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                        title="Cetak Ulang Struk Thermal"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Struk</span>
                      </button>

                      {order.status === 'PAID' && (
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
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        receiptText={selectedReceiptText}
        invoiceNo={selectedInvoiceNo}
      />
    </div>
  );
};
