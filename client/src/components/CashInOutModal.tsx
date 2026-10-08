import React, { useState } from 'react';
import { 
  ArrowDownLeft, ArrowUpRight, DollarSign, X, AlertCircle, 
  Loader2, Tag, Building2, Wallet 
} from 'lucide-react';
import { useShift } from '../context/ShiftContext';

interface CashInOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CashInOutModal: React.FC<CashInOutModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { addCashMovement, activeShift } = useShift();
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [category, setCategory] = useState<string>('Operasional Toko');
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState<string>('');
  const [accountCode, setAccountCode] = useState<string>('1-1001'); // 1-1001: Kas Laci Kasir, 1-1002: Kas Bank Toko
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const expenseChips = [
    'Operasional Toko',
    'Beli Kantong Plastik / ATK',
    'Listrik & Air',
    'Kebersihan & Konsumsi',
    'Beban Perlengkapan',
    'Beban Lainnya',
  ];

  const incomeChips = [
    'Jual Kardus / Rongsok Bekas',
    'Jasa Titip / Ekspedisi',
    'Pendapatan Bunga Bank',
    'Pemasukan Lain-lain',
  ];

  const currentChips = type === 'EXPENSE' ? expenseChips : incomeChips;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      setErrorMsg('Masukkan nominal uang yang valid');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Keterangan / rincian transaksi wajib diisi');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Post to operational transactions endpoint (Double-entry accounting journal)
      const res = await fetch('/api/operational-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          category: category.trim() || (type === 'EXPENSE' ? 'Beban Operasional' : 'Pendapatan Lain-lain'),
          description: description.trim(),
          amount,
          account_code: accountCode,
          notes: notes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan transaksi operasional');
      }

      // 2. If paid/received from cash drawer 1-1001 and shift is active, sync with shift movement
      if (accountCode === '1-1001' && activeShift) {
        const shiftType = type === 'INCOME' ? 'CASH_IN' : 'CASH_OUT';
        const shiftReason = `[${category}] ${description}`;
        await addCashMovement(shiftType, amount, shiftReason).catch(() => {});
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mencatat mutasi kas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg text-white ${type === 'INCOME' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-slate-800">
                  {type === 'EXPENSE' ? 'Pengeluaran Umum (Beban Toko)' : 'Pemasukan Lain-lain'}
                </h3>
                <span className="kbd-shortcut">F10</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Pencatatan kas operasional toko dinamis terhubung ke Buku Besar POS
              </p>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/60 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type Toggle */}
        <div className="flex p-2 bg-slate-100 border-b border-slate-200 gap-2">
          <button
            type="button"
            onClick={() => {
              setType('EXPENSE');
              setCategory('Operasional Toko');
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              type === 'EXPENSE' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-700 hover:bg-white/50'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Pengeluaran Umum (Expense)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setType('INCOME');
              setCategory('Jual Kardus / Rongsok Bekas');
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              type === 'INCOME' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-700 hover:bg-white/50'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>Pemasukan Lain-lain (Income)</span>
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

          {/* Quick Category Chips */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-slate-500" />
              <span>Pilih Kategori Cepat atau Ketik Bebas:</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {currentChips.map(ch => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setCategory(ch)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    category === ch
                      ? type === 'EXPENSE'
                        ? 'bg-rose-50 border-rose-400 text-rose-800 font-bold'
                        : 'bg-emerald-50 border-emerald-400 text-emerald-800 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="Kategori dinamis (bebas diubah)..."
              className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-blue-500"
              required
            />
          </div>

          {/* Nominal Amount */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nominal Uang (Rp)
            </label>
            <input
              type="number"
              min="1"
              autoFocus
              value={amount || ''}
              onChange={e => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-xl font-black text-slate-900 focus:outline-blue-500"
              placeholder="0"
              required
            />
            {amount > 0 && (
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Terbilang: <strong className="text-slate-800">Rp {amount.toLocaleString('id-ID')}</strong>
              </span>
            )}
          </div>

          {/* Dynamic Description / Keterangan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Keterangan Transaksi (Dinamis)
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={type === 'EXPENSE' ? 'Contoh: Beli lakban 2 roll dan kantong kresek hitam' : 'Contoh: Hasil penjualan kardus bekas packing 30kg'}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-blue-500"
              required
            />
          </div>

          {/* Account Source/Destination Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {type === 'EXPENSE' ? 'Sumber Dana Toko (Kas Pengeluaran)' : 'Penyetoran Dana (Kas Masuk)'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAccountCode('1-1001')}
                className={`p-2.5 rounded-xl text-left border transition cursor-pointer ${
                  accountCode === '1-1001'
                    ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Wallet className="w-3.5 h-3.5 text-blue-600" />
                  <span>Kas Laci Kasir</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-mono">Akun 1-1001 (Cash Drawer)</div>
              </button>

              <button
                type="button"
                onClick={() => setAccountCode('1-1002')}
                className={`p-2.5 rounded-xl text-left border transition cursor-pointer ${
                  accountCode === '1-1002'
                    ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Rekening Bank</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-mono">Akun 1-1002 (Bank Toko)</div>
              </button>
            </div>
            <span className="text-[10.5px] text-slate-400 mt-1 block">
              Transaksi otomatis dibukukan double-entry dan disinkronkan ke jurnal umum.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50 ${
                type === 'INCOME' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan Transaksi Kas</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
