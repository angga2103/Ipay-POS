import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useShift } from '../context/ShiftContext';
import { usePPOB } from '../context/PPOBContext';
import { 
  Wallet, RefreshCw, AlertTriangle, Clock, UserCheck, 
  Store, ShieldAlert, Sparkles, ChevronDown, LogOut 
} from 'lucide-react';

export const Header: React.FC = () => {
  const { currentUser, users, switchUser, logout } = useAuth();
  const { activeShift } = useShift();
  const { balance, lowBalanceAlert, mode, loading, refreshBalance } = usePPOB();
  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDate(now.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-white border-b border-slate-200 shadow-xs px-4 py-2 flex items-center justify-between z-20">
      {/* Brand & Store Name */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-linear-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-sm font-bold text-lg">
          <Store className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base tracking-tight text-slate-900">POS iPay</span>
            <span className="px-1.5 py-0.5 text-[10px] font-bold tracking-wide rounded bg-blue-100 text-blue-800 uppercase">
              Hybrid Minimarket
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium truncate max-w-[200px]">
            Toko Berkah Sejahtera
          </p>
        </div>
      </div>

      {/* Middle: Real-Time Widget Saldo ipay.my.id & Shift Status */}
      <div className="flex items-center gap-3">
        {/* PPOB Real-Time Balance Widget */}
        <div
          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all ${
            lowBalanceAlert
              ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-xs ring-2 ring-rose-200 animate-pulse'
              : 'bg-emerald-50/80 border-emerald-200 text-emerald-950 shadow-xs'
          }`}
          title={lowBalanceAlert ? 'PERINGATAN: Saldo PPOB Berada di Bawah Batas Aman!' : 'Saldo Aktif ipay.my.id'}
        >
          <div className={`p-1.5 rounded-lg ${lowBalanceAlert ? 'bg-rose-500 text-white' : 'bg-emerald-600 text-white'}`}>
            {lowBalanceAlert ? <AlertTriangle className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-600">
                Saldo ipay.my.id
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                mode === 'sandbox' ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'
              }`}>
                {mode === 'sandbox' ? 'SANDBOX' : 'LIVE'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold font-mono tracking-tight text-slate-900">
                Rp {balance.toLocaleString('id-ID')}
              </span>
              <button
                onClick={refreshBalance}
                disabled={loading}
                title="Refresh Saldo ipay.my.id"
                className="text-slate-400 hover:text-slate-700 transition p-0.5 rounded cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Shift Badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs">
          <div className={`w-2 h-2 rounded-full ${activeShift ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <div>
            <span className="font-semibold text-slate-800">
              {activeShift ? `Shift: ${activeShift.shift_number}` : 'Shift Belum Dibuka'}
            </span>
            <div className="text-[10px] text-slate-500">
              {activeShift ? `Modal: Rp ${activeShift.opening_cash.toLocaleString('id-ID')}` : 'Buka Shift Terlebih Dahulu'}
            </div>
          </div>
        </div>
      </div>

      {/* Right Side: Clock & User Profile Switcher */}
      <div className="flex items-center gap-3">
        {/* Clock */}
        <div className="hidden lg:flex items-center gap-2 text-right pr-2 border-r border-slate-200">
          <Clock className="w-4 h-4 text-slate-400" />
          <div>
            <div className="text-xs font-bold text-slate-800 font-mono leading-tight">{time}</div>
            <div className="text-[10px] text-slate-500 leading-tight">{date}</div>
          </div>
        </div>

        {/* User Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 border border-transparent hover:border-slate-200 transition cursor-pointer text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs uppercase">
              {currentUser ? currentUser.username.slice(0, 2) : 'KS'}
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-bold text-slate-800 leading-tight">
                {currentUser?.name.split(' ')[0] || 'Kasir'}
              </div>
              <div className="text-[10.5px] text-slate-500 capitalize leading-tight">
                {currentUser?.role || 'cashier'}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showUserDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50">
              <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Ganti Pengguna (RBAC)
              </div>
              {users.map(u => (
                <button
                  key={u.id}
                  onClick={() => {
                    switchUser(u.id);
                    setShowUserDropdown(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-slate-50 transition ${
                    currentUser?.id === u.id ? 'bg-blue-50/70 font-bold text-blue-700' : 'text-slate-700'
                  }`}
                >
                  <div>
                    <div>{u.name}</div>
                    <div className="text-[10px] text-slate-400 capitalize">{u.role}</div>
                  </div>
                  {currentUser?.id === u.id && <UserCheck className="w-4 h-4 text-blue-600" />}
                </button>
              ))}

              <div className="border-t border-slate-100 my-1"></div>
              <button
                onClick={() => {
                  setShowUserDropdown(false);
                  logout();
                }}
                className="w-full px-3 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-semibold cursor-pointer transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar (Logout)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
