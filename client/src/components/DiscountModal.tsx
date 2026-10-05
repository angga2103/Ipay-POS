import React, { useState, useEffect, useRef } from 'react';
import { Tag, X, Check, Percent, DollarSign } from 'lucide-react';

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDiscount: number;
  subtotal: number;
  onApply: (discountAmount: number) => void;
}

export const DiscountModal: React.FC<DiscountModalProps> = ({
  isOpen,
  onClose,
  currentDiscount,
  subtotal,
  onApply,
}) => {
  const [mode, setMode] = useState<'nominal' | 'percent'>('nominal');
  const [value, setValue] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMode('nominal');
      setValue(currentDiscount > 0 ? String(currentDiscount) : '');
      setTimeout(() => inputRef.current?.select(), 50);
    }
  }, [isOpen, currentDiscount]);

  if (!isOpen) return null;

  const numVal = Math.max(0, parseFloat(value) || 0);
  const calculatedDiscount = mode === 'percent'
    ? Math.round((subtotal * Math.min(100, numVal)) / 100)
    : Math.min(subtotal, numVal);

  const finalTotal = Math.max(0, subtotal - calculatedDiscount);

  const handleSave = () => {
    onApply(calculatedDiscount);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
            <Tag className="w-5 h-5 text-emerald-600" />
            <span>Diskon Total Belanja (F9)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Mode Switcher */}
          <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setMode('nominal')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                mode === 'nominal'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" /> Nominal (Rp)
            </button>
            <button
              type="button"
              onClick={() => setMode('percent')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                mode === 'percent'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Percent className="w-3.5 h-3.5" /> Persentase (%)
            </button>
          </div>

          {/* Input Box */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">
              {mode === 'nominal' ? 'Nominal Potongan Diskon (Rp):' : 'Persentase Diskon (%):'}
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-sm text-slate-400">
                {mode === 'nominal' ? 'Rp' : '%'}
              </span>
              <input
                ref={inputRef}
                type="number"
                min="0"
                max={mode === 'percent' ? 100 : subtotal}
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="0"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-lg font-bold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Quick Presets */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Pilihan Cepat
            </div>
            {mode === 'nominal' ? (
              <div className="grid grid-cols-4 gap-1.5">
                {[2000, 5000, 10000, 20000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setValue(String(amt))}
                    className="py-1.5 text-xs font-bold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-lg transition-colors border border-slate-200"
                  >
                    Rp {(amt / 1000).toLocaleString('id-ID')}k
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {[5, 10, 15, 20].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setValue(String(pct))}
                    className="py-1.5 text-xs font-bold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-lg transition-colors border border-slate-200"
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Summary Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal Belanja:</span>
              <span className="font-semibold text-slate-700">Rp {subtotal.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-emerald-600 font-bold">
              <span>Potongan Diskon:</span>
              <span>- Rp {calculatedDiscount.toLocaleString('id-ID')}</span>
            </div>
            <div className="border-t border-slate-200 pt-1.5 flex justify-between text-sm font-extrabold text-slate-900">
              <span>Total Akhir:</span>
              <span className="text-emerald-700">Rp {finalTotal.toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              onApply(0);
              onClose();
            }}
            className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
          >
            Hapus Diskon
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Batal (Esc)
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Check className="w-4 h-4" /> Terapkan (Enter)
          </button>
        </div>
      </div>
    </div>
  );
};
