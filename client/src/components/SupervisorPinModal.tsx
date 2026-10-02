import React, { useState } from 'react';
import { Lock, X, AlertCircle, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SupervisorPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthorized: () => void;
  title?: string;
  description?: string;
}

export const SupervisorPinModal: React.FC<SupervisorPinModalProps> = ({
  isOpen,
  onClose,
  onAuthorized,
  title = 'Otorisasi Supervisor Diperlukan',
  description = 'Aksi ini memerlukan persetujuan Supervisor / Kepala Toko dengan memasukkan PIN',
}) => {
  const { verifySupervisorPin } = useAuth();
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;

    setLoading(true);
    setErrorMsg('');

    const valid = await verifySupervisorPin(pin);
    setLoading(false);

    if (valid) {
      setPin('');
      onAuthorized();
      onClose();
    } else {
      setErrorMsg('PIN Supervisor tidak valid');
    }
  };

  const handleKeypad = (digit: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + digit);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500 text-white">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-800">{title}</h3>
              <p className="text-[10.5px] text-slate-500 line-clamp-1">{description}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PIN Form & Keypad */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="text-center">
            <div className="text-xs text-slate-500 mb-2">Masukkan PIN Supervisor (4-6 digit)</div>
            <div className="flex justify-center gap-2 my-2">
              {[0, 1, 2, 3, 4, 5].map(idx => (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border-2 transition ${
                    pin.length > idx ? 'bg-blue-600 border-blue-600 scale-110' : 'border-slate-300 bg-white'
                  }`}
                />
              ))}
            </div>
            <input
              type="password"
              maxLength={6}
              value={pin}
              autoFocus
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              className="sr-only"
            />
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map(btn => (
              <button
                key={btn}
                type="button"
                onClick={() => {
                  if (btn === 'C') setPin('');
                  else if (btn === '⌫') handleBackspace();
                  else handleKeypad(btn);
                }}
                className="py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-base transition active:scale-95 cursor-pointer"
              >
                {btn}
              </button>
            ))}
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || pin.length < 4}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Verifikasi</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
