import React, { useState } from 'react';
import { PauseCircle, PlayCircle, Trash2, X, Clock, AlertCircle } from 'lucide-react';
import { useCart } from '../context/CartContext';

interface HoldRecallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HoldRecallModal: React.FC<HoldRecallModalProps> = ({ isOpen, onClose }) => {
  const { items, heldBills, holdCurrentCart, recallCart, grandTotal } = useCart();
  const [label, setLabel] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [activeTab, setActiveTab] = useState<'recall' | 'hold'>('recall');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleHold = async () => {
    if (items.length === 0) {
      setErrorMsg('Keranjang kosong, tidak ada barang yang dapat ditahan');
      return;
    }

    try {
      await holdCurrentCart(label || `Antrean ${new Date().toLocaleTimeString('id-ID')}`, customerName);
      setLabel('');
      setCustomerName('');
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menahan transaksi');
    }
  };

  const handleRecall = async (id: number) => {
    try {
      await recallCart(id);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memanggil transaksi');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-600 text-white">
              <PauseCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-slate-800">
                  Tahan & Panggil Transaksi
                </h3>
                <span className="kbd-shortcut">F8</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Simpan sementara antrean kasir agar tidak terhambat
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

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 text-xs font-bold bg-slate-100 p-1">
          <button
            onClick={() => setActiveTab('recall')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'recall' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
            }`}
          >
            <PlayCircle className="w-4 h-4" />
            <span>Panggil Antrean ({heldBills.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('hold')}
            className={`flex-1 py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'hold' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
            }`}
          >
            <PauseCircle className="w-4 h-4" />
            <span>Tahan Keranjang Aktif</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'recall' ? (
            <div className="space-y-2.5">
              {heldBills.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Tidak ada antrean transaksi yang sedang ditahan.
                </div>
              ) : (
                heldBills.map(b => (
                  <div
                    key={b.id}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-300 bg-slate-50/60 hover:bg-indigo-50/30 transition flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-800 flex items-center gap-2">
                        <span>{b.label}</span>
                        {b.customer_name && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                            {b.customer_name}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(b.created_at).toLocaleTimeString('id-ID')}
                        </span>
                        <span>•</span>
                        <span>{b.cart?.length || 0} item</span>
                      </div>
                      <div className="text-xs font-mono font-bold text-slate-900 mt-1">
                        Total: Rp {b.total_amount?.toLocaleString('id-ID')}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRecall(b.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <PlayCircle className="w-4 h-4" />
                      <span>Muat Kembali</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Label / Keterangan Tahan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Antrean Pelanggan Ambil Susu"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Pelanggan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Ibu Rina"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                Keranjang aktif ({items.length} item, Rp {grandTotal.toLocaleString('id-ID')}) akan dikosongkan setelah disimpan agar Anda dapat melayani pembeli berikutnya.
              </div>

              <button
                onClick={handleHold}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <PauseCircle className="w-4 h-4" />
                <span>Simpan & Tahan Keranjang</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
