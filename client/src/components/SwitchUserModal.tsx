import React, { useState } from 'react';
import { ShieldCheck, X, AlertCircle, Loader2, KeyRound, UserCheck } from 'lucide-react';
import { User } from '../types';

interface SwitchUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: User | null;
  onSuccess: (updatedUser: User, token?: string) => void;
}

export const SwitchUserModal: React.FC<SwitchUserModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  onSuccess,
}) => {
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen || !targetUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret.trim()) {
      setErrorMsg('Masukkan PIN atau Password operator');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/switch-user-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: targetUser.id,
          secret: secret.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSecret('');
        onSuccess(data.user, data.token);
        onClose();
      } else {
        setErrorMsg(data.error || 'Autentikasi gagal. PIN atau Password salah.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-800">
                Pindah Akun Operator
              </h3>
              <p className="text-[11px] text-slate-500">
                Verifikasi keamanan akses (RBAC)
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setSecret('');
              setErrorMsg('');
              onClose();
            }}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Target User Info Card */}
          <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm uppercase shadow-xs">
              {targetUser.username.slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-extrabold text-sm text-slate-900 truncate">
                {targetUser.name}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] font-mono text-slate-500">@{targetUser.username}</span>
                <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold uppercase tracking-wider ${
                  targetUser.role === 'owner'
                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                    : targetUser.role === 'supervisor'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}>
                  {targetUser.role}
                </span>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Masukkan PIN atau Password:
            </label>
            <input
              type="password"
              autoFocus
              value={secret}
              onChange={e => setSecret(e.target.value)}
              placeholder="PIN (6 digit) atau Password akun"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-center tracking-widest text-base font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-[10.5px] text-slate-400 mt-1">
              {targetUser.role === 'owner' 
                ? '⚠️ Memerlukan kredensial resmi Pemilik Toko (Owner).' 
                : 'Masukkan PIN atau kata sandi operator yang dituju.'}
            </p>
          </div>

          {/* Quick Keypad for PIN convenience */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => setSecret(prev => prev + num)}
                className="py-2 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 transition cursor-pointer"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSecret('')}
              className="py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl text-xs border border-rose-200 transition cursor-pointer"
            >
              C
            </button>
            <button
              type="button"
              onClick={() => setSecret(prev => prev + '0')}
              className="py-2 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 transition cursor-pointer"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => setSecret(prev => prev.slice(0, -1))}
              className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 transition cursor-pointer"
            >
              ⌫
            </button>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setSecret('');
                setErrorMsg('');
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Beralih Operator</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
