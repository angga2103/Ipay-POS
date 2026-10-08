import React, { useState, useEffect } from 'react';
import { 
  RotateCcw, X, Check, AlertCircle, Loader2, Package, 
  DollarSign, CheckSquare, Square, RefreshCw 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SalesReturnModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (returnResult: any) => void;
}

export const SalesReturnModal: React.FC<SalesReturnModalProps> = ({
  order,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentUser } = useAuth();

  const [loadingItems, setLoadingItems] = useState(false);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [returnQtys, setReturnQtys] = useState<Record<number, number>>({});
  const [restockMap, setRestockMap] = useState<Record<number, boolean>>({});
  const [reason, setReason] = useState('Barang Cacat / Rusak');
  const [customReason, setCustomReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'KASBON_REDUCTION'>(
    order?.payment_method === 'KASBON' ? 'KASBON_REDUCTION' : 'CASH'
  );
  const [customerData, setCustomerData] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successResult, setSuccessResult] = useState<any>(null);

  // Fetch complete order items, existing returns, and customer debt info when modal opens
  useEffect(() => {
    if (isOpen && order?.id) {
      setLoadingItems(true);
      setErrorMsg('');
      setSuccessResult(null);
      setReturnQtys({});
      setRestockMap({});
      setRefundMethod(order?.payment_method === 'KASBON' ? 'KASBON_REDUCTION' : 'CASH');

      // Fetch customer detail if order has customer_id
      if (order.customer_id) {
        fetch('/api/customers')
          .then(res => res.json())
          .then(custs => {
            if (Array.isArray(custs)) {
              const found = custs.find((c: any) => c.id === order.customer_id);
              if (found) setCustomerData(found);
            }
          })
          .catch(() => {});
      }

      Promise.all([
        fetch(`/api/orders/${order.id}`).then(res => res.json()),
        fetch(`/api/orders/${order.id}/returns`).then(res => res.json()).catch(() => []),
      ])
        .then(([orderData, returnsData]) => {
          const items = orderData?.items || [];
          // Calculate already returned quantities
          const returnedMap: Record<number, number> = {};
          if (Array.isArray(returnsData)) {
            returnsData.forEach((ret: any) => {
              if (Array.isArray(ret.items)) {
                ret.items.forEach((ri: any) => {
                  returnedMap[ri.order_item_id] = (returnedMap[ri.order_item_id] || 0) + ri.quantity;
                });
              }
            });
          }

          // Filter for RETAIL items (PPOB transactions cannot be returned physically)
          const eligibleItems = items
            .filter((it: any) => it.item_type === 'RETAIL')
            .map((it: any) => {
              const alreadyReturned = returnedMap[it.id] || 0;
              const maxReturnable = Math.max(0, it.quantity - alreadyReturned);
              return {
                ...it,
                already_returned: alreadyReturned,
                max_returnable: maxReturnable,
              };
            });

          setOrderItems(eligibleItems);

          // Default restock to true for all items
          const initialRestock: Record<number, boolean> = {};
          eligibleItems.forEach((it: any) => {
            initialRestock[it.id] = true;
          });
          setRestockMap(initialRestock);
        })
        .catch(err => {
          setErrorMsg(err.message || 'Gagal memuat rincian transaksi');
        })
        .finally(() => {
          setLoadingItems(false);
        });
    }
  }, [isOpen, order?.id]);

  if (!isOpen || !order) return null;

  const handleQtyChange = (itemId: number, max: number, val: number) => {
    const clamped = Math.max(0, Math.min(max, val || 0));
    setReturnQtys(prev => ({ ...prev, [itemId]: clamped }));
  };

  const handleToggleRestock = (itemId: number) => {
    setRestockMap(prev => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  // Calculate total refund
  const totalRefund = orderItems.reduce((sum, it) => {
    const q = returnQtys[it.id] || 0;
    return sum + (q * it.unit_price);
  }, 0);

  const totalItemsToReturn = Object.values(returnQtys).reduce((a, b) => a + b, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalItemsToReturn <= 0) {
      setErrorMsg('Pilih minimal 1 item produk yang akan diretur');
      return;
    }

    const finalReason = reason === 'Lainnya' ? (customReason.trim() || 'Lainnya') : reason;

    const returnItemsPayload = orderItems
      .filter(it => (returnQtys[it.id] || 0) > 0)
      .map(it => ({
        order_item_id: it.id,
        product_id: it.product_id,
        quantity: returnQtys[it.id],
        restock: restockMap[it.id] !== false,
      }));

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: order.id,
          cashier_id: currentUser?.id || 1,
          reason: finalReason,
          refund_method: refundMethod,
          items: returnItemsPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses retur penjualan');
      }

      onSuccess(data);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat memproses retur');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 animate-in fade-in">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-600 text-white shadow-xs">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-slate-800">
                  Form Retur Penjualan Barang
                </h3>
                <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {order.invoice_no}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Kembalikan stok produk & catat jurnal balik pengembalian dana
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/60 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Reason & Refund Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Alasan Retur Barang
              </label>
              <select
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white focus:outline-blue-500 cursor-pointer"
              >
                <option value="Barang Cacat / Rusak">Barang Cacat / Rusak</option>
                <option value="Kadaluarsa / Expired">Kadaluarsa / Expired</option>
                <option value="Salah Beli / Beda Ukuran">Salah Beli / Beda Ukuran</option>
                <option value="Pelanggan Komplain / Batal">Pelanggan Komplain / Batal</option>
                <option value="Lainnya">Alasan Lainnya (Ketik Manual)</option>
              </select>
              {reason === 'Lainnya' && (
                <input
                  type="text"
                  placeholder="Ketik alasan retur..."
                  value={customReason}
                  onChange={e => setCustomReason(e.target.value)}
                  className="w-full mt-2 px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Metode Pengembalian Dana (Refund)
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setRefundMethod('CASH')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                    refundMethod === 'CASH'
                      ? 'bg-rose-50 border-rose-400 text-rose-800 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Tunai (Cash Laci)
                </button>
                <button
                  type="button"
                  onClick={() => setRefundMethod('KASBON_REDUCTION')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                    refundMethod === 'KASBON_REDUCTION'
                      ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Potong Kasbon
                </button>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">
                {refundMethod === 'CASH' ? 'Uang diambil dari kas laci kasir saat ini.' : 'Saldo piutang / hutang kasbon pelanggan akan dikurangi.'}
              </span>
            </div>
          </div>

          {/* Customer & Kasbon Context Banner */}
          {(order.payment_method === 'KASBON' || customerData) && (
            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5 text-xs text-blue-900 animate-in fade-in">
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  <span>Pelanggan: {customerData?.name || order.customer_name || 'Pelanggan Terdaftar'}</span>
                </span>
                <span className="font-mono bg-blue-100 text-blue-900 px-2.5 py-0.5 rounded-lg text-xs font-black">
                  Hutang Aktif: Rp {Number(customerData?.current_debt || 0).toLocaleString('id-ID')}
                </span>
              </div>
              {refundMethod === 'KASBON_REDUCTION' ? (
                <div className="text-[11px] text-blue-800 bg-white/70 p-2 rounded-lg border border-blue-100 leading-relaxed">
                  💡 <strong>Simulasi Potong Hutang:</strong> Nilai retur <span className="font-bold font-mono">Rp {totalRefund.toLocaleString('id-ID')}</span> akan memotong hutang pelanggan sehingga sisa hutang menjadi <span className="font-bold font-mono text-emerald-700">Rp {Math.max(0, (customerData?.current_debt || 0) - totalRefund).toLocaleString('id-ID')}</span>.
                </div>
              ) : (
                <div className="text-[11px] text-amber-900 bg-amber-50 p-2.5 rounded-lg border border-amber-300 leading-relaxed">
                  ⚠️ <strong>Perhatian:</strong> Transaksi awal dibeli via <span className="font-bold font-mono">KASBON</span>. Jika memilih "Tunai", uang kas laci akan keluar ke pembeli, namun hutang kasbon pembeli <strong>TIDAK AKAN BERKURANG</strong>. Disarankan memilih opsi <strong>"Potong Kasbon"</strong>.
                </div>
              )}
            </div>
          )}

          {/* Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">
                Pilih Item Produk yang Diretur
              </label>
              <span className="text-[11px] text-slate-500">
                {orderItems.length} Produk Ritel
              </span>
            </div>

            {loadingItems ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                <span>Memuat daftar barang transaksi...</span>
              </div>
            ) : orderItems.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                Tidak ada produk ritel fisik pada transaksi ini yang dapat diretur.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-[10.5px] font-bold text-slate-500 uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Nama Produk</th>
                      <th className="py-2 px-3 text-right">Harga (Rp)</th>
                      <th className="py-2 px-3 text-center">Beli / Sisa</th>
                      <th className="py-2 px-3 text-center w-28">Qty Retur</th>
                      <th className="py-2 px-3 text-center">Kembalikan Stok</th>
                      <th className="py-2 px-3 text-right">Subtotal Refund</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {orderItems.map(it => {
                      const qtyRet = returnQtys[it.id] || 0;
                      const subRefund = qtyRet * it.unit_price;
                      const isRestock = restockMap[it.id] !== false;

                      return (
                        <tr key={it.id} className={qtyRet > 0 ? 'bg-rose-50/40' : 'hover:bg-slate-50/60'}>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-800">{it.item_name}</div>
                            {it.imei_sn && (
                              <div className="text-[10px] text-slate-400 font-mono">SN: {it.imei_sn}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            Rp {it.unit_price.toLocaleString('id-ID')}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono">
                            <span className="font-bold text-slate-800">{it.quantity}</span>
                            {it.already_returned > 0 && (
                              <span className="text-[10px] text-rose-500 block">
                                (Retur: {it.already_returned})
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {it.max_returnable > 0 ? (
                              <input
                                type="number"
                                min="0"
                                max={it.max_returnable}
                                value={qtyRet || ''}
                                onChange={e => handleQtyChange(it.id, it.max_returnable, parseInt(e.target.value, 10))}
                                placeholder="0"
                                className="w-16 px-2 py-1 text-center font-mono font-bold text-xs rounded-lg border border-slate-300 focus:outline-blue-500"
                              />
                            ) : (
                              <span className="text-[10px] text-slate-400 font-bold">Habis</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleRestock(it.id)}
                              disabled={qtyRet <= 0}
                              className={`p-1 rounded cursor-pointer transition ${
                                qtyRet <= 0 ? 'opacity-30 cursor-not-allowed text-slate-300' : isRestock ? 'text-emerald-600' : 'text-slate-400'
                              }`}
                              title={isRestock ? 'Stok produk akan bertambah kembali di gudang' : 'Barang rusak tidak dimasukkan ke stok'}
                            >
                              {isRestock ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            Rp {subRefund.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Refund Grand Total Card */}
          <div className="p-4 bg-linear-to-r from-rose-500 to-rose-700 text-white rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-rose-100 uppercase tracking-wider block">
                Total Nilai Pengembalian Dana (Refund)
              </span>
              <div className="text-2xl font-black font-mono tracking-tight mt-0.5">
                Rp {totalRefund.toLocaleString('id-ID')}
              </div>
            </div>
            <div className="text-right text-xs text-rose-100">
              <div>Total Item: <strong>{totalItemsToReturn} pcs</strong></div>
              <div>Metode: <strong>{refundMethod === 'CASH' ? 'Tunai Laci' : 'Potong Kasbon'}</strong></div>
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 leading-relaxed">
            <strong>Catatan Akuntansi POS:</strong> Mutasi jurnal otomatis dibuat saat retur disetujui. Akun Pendapatan Toko dan Kas/Piutang akan disesuaikan, serta stok fisik barang yang dicentang restock akan kembali bertambah secara realtime.
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || totalItemsToReturn <= 0}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memproses Retur...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  <span>Konfirmasi & Cetak Retur</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
