import React, { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, DollarSign, X, AlertCircle } from 'lucide-react';
import { useShift } from '../context/ShiftContext';

interface CashInOutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CashInOutModal: React.FC<CashInOutModalProps> = ({ isOpen, onClose }) => {
  const { addCashMovement } = useShift();
  const [type, setType] = useState<'CASH_IN' | 'CASH_OUT'>('CASH_OUT');
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      setErrorMsg('Masukkan nominal kas yang valid');
      return;
    }
    if (!reason.trim()) {
      setErrorMsg('Alasan transaksi kas wajib diisi');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      await addCashMovement(type, amount, reason);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mencatat mutasi kas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg text-white ${type === 'CASH_IN' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-slate-800">
                  Mutasi Kas Laci Kasir
                </h3>
                <span className="kbd-shortcut">F10</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Pencatatan kas masuk / keluar laci toko
              </p>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/60">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type Toggle */}
        <div className="flex p-2 bg-slate-100 border-b border-slate-200 gap-2">
          <button
            type="button"
            onClick={() => setType('CASH_OUT')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              type === 'CASH_OUT' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-700 hover:bg-white/50'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Kas Keluar (Cash Out)</span>
          </button>

          <button
            type="button"
            onClick={() => setType('CASH_IN')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              type === 'CASH_IN' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-700 hover:bg-white/50'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Kas Masuk (Cash In)</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nominal Uang (Rp)
            </label>
            <input
              type="number"
              autoFocus
              value={amount || ''}
              onChange={e => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-lg font-bold"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Keterangan / Alasan
            </label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={type === 'CASH_OUT' ? 'Contoh: Beli kantong kresek / lakban' : 'Contoh: Tambahan modal kembalian'}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-xs ${
                type === 'CASH_IN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              Simpan Mutasi Kas
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
