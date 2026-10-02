import React, { useState, useEffect, useRef } from 'react';
import { Smartphone, ScanBarcode, Check, X, ShieldAlert } from 'lucide-react';
import { Product } from '../types';

interface IMEIPromptModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (imeiSn: string) => void;
}

export const IMEIPromptModal: React.FC<IMEIPromptModalProps> = ({
  product,
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [imei1, setImei1] = useState('');
  const [imei2, setImei2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setImei1('');
      setImei2('');
      setError(null);
      // Auto-focus scanner on IMEI input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanImei = imei1.trim();
    if (!cleanImei) {
      setError('Nomor IMEI 1 wajib diisi atau discan');
      return;
    }

    if (cleanImei.length < 8) {
      setError('Nomor IMEI / Serial Number terlalu pendek (minimal 8 karakter)');
      return;
    }

    const fullImeiString = imei2.trim() 
      ? `IMEI1: ${cleanImei} | IMEI2: ${imei2.trim()}`
      : `IMEI: ${cleanImei}`;

    onSubmit(fullImeiString);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/20">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm md:text-base leading-tight">Registrasi IMEI / SN</h3>
              <p className="text-[11px] text-blue-100">Wajib untuk kartu garansi & lacak unit konter</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product Info Banner */}
        <div className="bg-slate-50 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-800">{product.name}</div>
            <div className="text-[11px] text-slate-500 font-mono">SKU: {product.sku}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-extrabold text-blue-600">
              Rp {product.selling_price.toLocaleString('id-ID')}
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase">
              Wajib IMEI
            </span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>Nomor IMEI 1 (Utama) *</span>
              <span className="text-[10px] text-slate-400 font-normal">Gunakan Barcode Scanner</span>
            </label>
            <div className="relative">
              <ScanBarcode className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                value={imei1}
                onChange={e => {
                  setImei1(e.target.value);
                  setError(null);
                }}
                placeholder="Scan / Ketik 15 digit IMEI 1..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
              <span>Nomor IMEI 2 / Serial Number (Opsional)</span>
              <span className="text-[10px] text-slate-400 font-normal">Bila Dual SIM</span>
            </label>
            <div className="relative">
              <ScanBarcode className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={imei2}
                onChange={e => setImei2(e.target.value)}
                placeholder="Scan / Ketik IMEI 2 bila ada..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono focus:bg-white focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
            </div>
          </div>

          <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-[11px] text-amber-800 leading-tight">
            💡 Nomor IMEI ini akan otomatis tercetak di struk belanja pelanggan sebagai bukti garansi resmi konter.
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs cursor-pointer transition min-h-[48px]"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer transition min-h-[48px]"
            >
              <Check className="w-4 h-4" />
              Masukkan Keranjang
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
