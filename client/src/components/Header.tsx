import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useShift } from '../context/ShiftContext';
import { usePPOB } from '../context/PPOBContext';
import { 
  Wallet, RefreshCw, AlertTriangle, Clock, UserCheck, 
  Store, ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen 
} from 'lucide-react';
import { SwitchUserModal } from './SwitchUserModal';
import { User } from '../types';

interface HeaderProps {
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ isSidebarCollapsed, onToggleSidebar }) => {
  const { currentUser, users, setAuthenticatedUser, logout, storeName, tenantId } = useAuth();
  const { activeShift } = useShift();
  const { balance, lowBalanceAlert, mode, loading, refreshBalance } = usePPOB();
  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [switchModalOpen, setSwitchModalOpen] = useState(false);
  const [targetUserForSwitch, setTargetUserForSwitch] = useState<User | null>(null);

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

  const handleSelectUserToSwitch = (target: User) => {
    setShowUserDropdown(false);
    if (currentUser?.id === target.id) return;
    setTargetUserForSwitch(target);
    setSwitchModalOpen(true);
  };

  return (
    <>
      <header className="bg-white border-b border-slate-200 shadow-xs px-2.5 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between z-20 gap-2">
        {/* Brand & Store Name */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              type="button"
              className="hidden md:flex p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition cursor-pointer"
              title={isSidebarCollapsed ? "Tampilkan Nama Menu Sidebar" : "Sembunyikan Teks Menu (Perlebar Layar)"}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="w-5 h-5 text-blue-600" />
              ) : (
                <PanelLeftClose className="w-5 h-5 text-slate-600" />
              )}
            </button>
          )}

          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-linear-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-xs font-bold text-base shrink-0">
            <Store className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 whitespace-nowrap">
                POS iPay
              </span>
              <span className="hidden sm:inline-block px-1.5 py-0.2 text-[9.5px] font-bold tracking-wide rounded bg-blue-100 text-blue-800 uppercase">
                Hybrid
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-600 font-semibold truncate max-w-[110px] xs:max-w-[150px] sm:max-w-[220px]" title={storeName}>
              {storeName}
              {tenantId !== 'default' && (
                <span className="hidden sm:inline-block ml-1 px-1 py-0.2 text-[9px] font-mono bg-slate-200 text-slate-700 rounded">
                  {tenantId}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Middle: Real-Time Widget Saldo ipay.my.id & Shift Status */}
        <div className="flex items-center gap-2 shrink-0">
          {/* PPOB Real-Time Balance Widget - Responsive Mobile Pill */}
          <div
            className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border transition-all ${
              lowBalanceAlert
                ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-xs ring-2 ring-rose-200 animate-pulse'
                : 'bg-emerald-50/80 border-emerald-200 text-emerald-950 shadow-xs'
            }`}
            title={lowBalanceAlert ? 'PERINGATAN: Saldo PPOB Berada di Bawah Batas Aman!' : 'Saldo Aktif ipay.my.id'}
          >
            <div className={`p-1 sm:p-1.5 rounded-lg shrink-0 ${lowBalanceAlert ? 'bg-rose-500 text-white' : 'bg-emerald-600 text-white'}`}>
              {lowBalanceAlert ? <AlertTriangle className="w-3.5 h-3.5" /> : <Wallet className="w-3.5 h-3.5" />}
            </div>
            <div>
              {/* Desktop detailed label */}
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  Saldo iPay
                </span>
                <span className={`text-[8.5px] font-bold px-1 py-0.2 rounded-full uppercase ${
                  mode === 'sandbox' ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'
                }`}>
                  {mode === 'sandbox' ? 'SANDBOX' : 'LIVE'}
                </span>
              </div>
              {/* Amount display */}
              <div className="flex items-center gap-1 sm:gap-2">
                <span className="text-xs sm:text-sm font-bold font-mono tracking-tight text-slate-900 whitespace-nowrap">
                  Rp {(typeof balance === 'number' ? balance : 0).toLocaleString('id-ID')}
                </span>
                <button
                  onClick={refreshBalance}
                  disabled={loading}
                  title="Refresh Saldo ipay.my.id"
                  className="text-slate-400 hover:text-slate-700 transition p-0.5 rounded cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Shift Badge (Desktop / Tablet only) */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs">
            <div className={`w-2 h-2 rounded-full ${activeShift && activeShift.id ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <div>
              <span className="font-semibold text-slate-800">
                {activeShift && activeShift.shift_number ? `Shift: ${activeShift.shift_number}` : 'Shift Belum Dibuka'}
              </span>
              <div className="text-[10px] text-slate-500">
                {activeShift && typeof activeShift.opening_cash === 'number'
                  ? `Modal: Rp ${activeShift.opening_cash.toLocaleString('id-ID')}`
                  : 'Buka Shift Terlebih Dahulu'}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Clock & User Profile Switcher */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Clock (Desktop only) */}
          <div className="hidden xl:flex items-center gap-2 text-right pr-2 border-r border-slate-200">
            <Clock className="w-4 h-4 text-slate-400" />
            <div>
              <div className="text-xs font-bold text-slate-800 font-mono leading-tight">{time}</div>
              <div className="text-[10px] text-slate-500 leading-tight">{date}</div>
            </div>
          </div>

          {/* User Switcher Dropdown with RBAC Security */}
          <div className="relative">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-2.5 py-1 rounded-xl hover:bg-slate-100 border border-transparent hover:border-slate-200 transition cursor-pointer text-left"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                {currentUser?.username ? currentUser.username.slice(0, 2).toUpperCase() : 'OP'}
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-bold text-slate-800 leading-tight">
                  {currentUser?.name ? currentUser.name.split(' ')[0] : (currentUser?.username || 'Operator')}
                </div>
                <div className="text-[10px] text-slate-500 capitalize leading-tight">
                  {currentUser?.role || 'cashier'}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-fade-in">
                <div className="px-3.5 py-1.5 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Ganti Operator</span>
                  <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">PIN Terproteksi</span>
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                  {Array.isArray(users) && users.map(u => (
                    <button
                      key={u.id}
                      onClick={() => handleSelectUserToSwitch(u)}
                      className={`w-full px-3.5 py-2 text-left text-xs flex items-center justify-between hover:bg-slate-50 transition cursor-pointer ${
                        currentUser?.id === u.id ? 'bg-blue-50/70 font-bold text-blue-700' : 'text-slate-700'
                      }`}
                    >
                      <div>
                        <div className="font-semibold">{u.name}</div>
                        <div className="text-[10px] text-slate-400 capitalize flex items-center gap-1 mt-0.5">
                          <span>@{u.username}</span>
                          <span>•</span>
                          <span className={`px-1 py-0.2 rounded text-[9px] font-bold uppercase ${
                            u.role === 'owner' ? 'bg-purple-100 text-purple-700' :
                            u.role === 'supervisor' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {u.role}
                          </span>
                        </div>
                      </div>
                      {currentUser?.id === u.id && <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />}
                    </button>
                  ))}
                </div>

                <div className="border-t border-slate-100 my-1"></div>
                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    logout();
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-semibold cursor-pointer transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Keluar (Logout)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* PIN / Password Protected Operator Switch Modal */}
      <SwitchUserModal
        isOpen={switchModalOpen}
        onClose={() => setSwitchModalOpen(false)}
        targetUser={targetUserForSwitch}
        onSuccess={(updatedUser, token) => {
          setAuthenticatedUser(updatedUser, token);
        }}
      />
    </>
  );
};
