import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Store, Lock, User, KeyRound, Shield, AlertCircle, ArrowRight, Smartphone, Sparkles } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, loginWithPin, storeName, tenantId, setTenant } = useAuth();
  const [loginMode, setLoginMode] = useState<'pin' | 'password'>('pin');
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [inputTenantId, setInputTenantId] = useState(tenantId === 'default' ? '' : tenantId);

  // Password mode state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // PIN mode state
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Masukkan username dan password');
      return;
    }
    setError(null);
    setLoading(true);
    const success = await login(username, password);
    setLoading(false);
    if (!success) {
      setError('Username atau password salah');
    }
  };

  const handlePinSubmit = async (pinValue: string) => {
    if (pinValue.length < 4) {
      setError('PIN minimal 4-6 digit');
      return;
    }
    setError(null);
    setLoading(true);
    const success = await loginWithPin(pinValue);
    setLoading(false);
    if (!success) {
      setError('PIN tidak valid atau tidak terdaftar');
      setPin('');
    }
  };

  const handleKeypadPress = (num: string) => {
    if (pin.length < 6) {
      const nextPin = pin + num;
      setPin(nextPin);
      setError(null);
      if (nextPin.length === 6) {
        handlePinSubmit(nextPin);
      }
    }
  };

  const handleKeypadBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError(null);
  };

  const handleKeypadClear = () => {
    setPin('');
    setError(null);
  };

  const fillQuickDemo = (u: string, p: string, demoPin: string) => {
    if (loginMode === 'password') {
      setUsername(u);
      setPassword(p);
    } else {
      setPin(demoPin);
      handlePinSubmit(demoPin);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-900 text-slate-100 flex flex-col justify-between overflow-y-auto selection:bg-blue-600 selection:text-white">
      {/* Top Background Glow Effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-72 bg-gradient-to-b from-blue-600/20 via-indigo-600/10 to-transparent blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-5xl mx-auto px-4 py-6 md:py-10 flex-1 flex flex-col justify-center">
        {/* Brand Header */}
        <div className="text-center mb-6 md:mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/30 text-white mb-3">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            POS iPay Hybrid & Konter HP
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
              v2.0
            </span>
          </h1>
          <p className="text-xs md:text-sm text-slate-400 max-w-md mx-auto mt-1">
            Sistem Kasir Ritel Minimarket Modern, PPOB Digital ipay.my.id, & Servis HP Terintegrasi
          </p>
        </div>

        {/* Content Box: Split for Tablets/Desktops, Stacked for Mobile */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start max-w-4xl mx-auto w-full">
          {/* Left Column: Login Card (Cols 1-7) */}
          <div className="md:col-span-7 bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-2xl p-5 md:p-7 backdrop-blur-md">
            {/* Store / Tenant Identifier */}
            <div className="mb-4 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-700/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 overflow-hidden">
                <Store className="w-4 h-4 text-blue-400 shrink-0" />
                <div className="truncate">
                  <span className="text-slate-400">Toko Aktif: </span>
                  <span className="font-bold text-white tracking-wide">{storeName}</span>
                  {tenantId !== 'default' && (
                    <span className="ml-1.5 px-1.5 py-0.2 bg-blue-500/20 text-blue-400 text-[10px] rounded font-mono border border-blue-500/30">
                      {tenantId}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setInputTenantId(tenantId === 'default' ? '' : tenantId); setShowTenantModal(true); }}
                className="text-[11px] font-bold text-blue-400 hover:text-blue-300 ml-2 px-2 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 transition cursor-pointer shrink-0"
              >
                Ganti Toko
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-700/60 mb-5">
              <button
                type="button"
                onClick={() => { setLoginMode('pin'); setError(null); }}
                className={`flex-1 py-2.5 rounded-lg text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  loginMode === 'pin'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                PIN Kasir Cepat
              </button>
              <button
                type="button"
                onClick={() => { setLoginMode('password'); setError(null); }}
                className={`flex-1 py-2.5 rounded-lg text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                  loginMode === 'password'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Lock className="w-4 h-4" />
                Username & Sandi
              </button>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Mode 1: Quick PIN Login with Touch Keypad */}
            {loginMode === 'pin' && (
              <div className="flex flex-col items-center">
                {/* PIN Display Dots */}
                <div className="w-full text-center mb-5">
                  <span className="text-xs text-slate-400 font-medium">Masukkan 6 Digit PIN Kasir / Supervisor:</span>
                  <div className="flex justify-center items-center gap-3 mt-3">
                    {[0, 1, 2, 3, 4, 5].map(idx => (
                      <div
                        key={idx}
                        className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                          idx < pin.length
                            ? 'bg-blue-500 scale-125 shadow-sm shadow-blue-400'
                            : 'bg-slate-700 border border-slate-600'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Touch-Friendly Numeric Keypad (Touch targets >= 48px) */}
                <div className="grid grid-cols-3 gap-2.5 w-full max-w-[280px]">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleKeypadPress(num)}
                      className="h-14 rounded-xl bg-slate-700/60 hover:bg-slate-600/80 active:bg-blue-600 active:scale-95 text-xl font-bold text-white transition border border-slate-600/40 flex items-center justify-center shadow-xs cursor-pointer select-none"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleKeypadClear}
                    className="h-14 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 active:scale-95 text-xs font-bold text-rose-400 transition border border-slate-700/60 flex items-center justify-center cursor-pointer select-none"
                  >
                    RESET
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('0')}
                    className="h-14 rounded-xl bg-slate-700/60 hover:bg-slate-600/80 active:bg-blue-600 active:scale-95 text-xl font-bold text-white transition border border-slate-600/40 flex items-center justify-center shadow-xs cursor-pointer select-none"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleKeypadBackspace}
                    className="h-14 rounded-xl bg-slate-800/80 hover:bg-amber-500/20 active:scale-95 text-xs font-bold text-amber-400 transition border border-slate-700/60 flex items-center justify-center cursor-pointer select-none"
                  >
                    HAPUS
                  </button>
                </div>

                {/* Submit button when pin entered */}
                {pin.length >= 4 && (
                  <button
                    type="button"
                    onClick={() => handlePinSubmit(pin)}
                    disabled={loading}
                    className="mt-4 w-full max-w-[280px] py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-sm transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading ? 'Memverifikasi...' : 'Masuk Sekarang'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Mode 2: Username & Password Login */}
            {loginMode === 'password' && (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Username</label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="Masukkan username kasir/admin"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Kata Sandi</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Masukkan kata sandi"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-sm transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  {loading ? 'Memverifikasi Akun...' : 'Masuk Aplikasi Kasir'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>

          {/* Right Column: Roles & Quick Demo Profiles (Cols 8-12) */}
          <div className="md:col-span-5 space-y-4">
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 md:p-5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                <Shield className="w-4 h-4 text-blue-400" />
                <span>Pilih Akun Demo / Uji Coba</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Klik kartu di bawah untuk login instan sesuai tingkatan hak akses:
              </p>

              {/* Demo User 1: Cashier */}
              <div
                onClick={() => fillQuickDemo('kasir1', 'kasir123', '123456')}
                className="group p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 hover:border-emerald-500/50 hover:bg-slate-800/80 transition cursor-pointer mb-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                      KS
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-emerald-300 transition">
                        Siti Rahma
                      </div>
                      <div className="text-[10px] text-slate-400">Kasir Toko (Shift 1)</div>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 uppercase">
                    Kasir
                  </span>
                </div>
                <div className="mt-2 text-[10.5px] text-slate-400 flex items-center justify-between border-t border-slate-800 pt-1.5">
                  <span>PIN: <strong className="text-slate-200 font-mono">123456</strong></span>
                  <span className="text-emerald-400 group-hover:underline">Klik untuk Masuk &rarr;</span>
                </div>
              </div>

              {/* Demo User 2: Supervisor */}
              <div
                onClick={() => fillQuickDemo('spv', 'spv123', '223344')}
                className="group p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 hover:border-indigo-500/50 hover:bg-slate-800/80 transition cursor-pointer mb-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
                      SP
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-indigo-300 transition">
                        Budi Santoso
                      </div>
                      <div className="text-[10px] text-slate-400">Supervisor & Void Auth</div>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 uppercase">
                    Supervisor
                  </span>
                </div>
                <div className="mt-2 text-[10.5px] text-slate-400 flex items-center justify-between border-t border-slate-800 pt-1.5">
                  <span>PIN: <strong className="text-slate-200 font-mono">223344</strong></span>
                  <span className="text-indigo-400 group-hover:underline">Klik untuk Masuk &rarr;</span>
                </div>
              </div>

              {/* Demo User 3: Owner */}
              <div
                onClick={() => fillQuickDemo('owner', 'admin123', '112233')}
                className="group p-3 rounded-xl bg-slate-900/60 border border-slate-700/60 hover:border-amber-500/50 hover:bg-slate-800/80 transition cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                      OW
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-amber-300 transition">
                        H. Ahmad Fauzi
                      </div>
                      <div className="text-[10px] text-slate-400">Owner (Hak Akses Penuh)</div>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 uppercase">
                    Owner
                  </span>
                </div>
                <div className="mt-2 text-[10.5px] text-slate-400 flex items-center justify-between border-t border-slate-800 pt-1.5">
                  <span>PIN: <strong className="text-slate-200 font-mono">112233</strong></span>
                  <span className="text-amber-400 group-hover:underline">Klik untuk Masuk &rarr;</span>
                </div>
              </div>
            </div>

            {/* Konter HP Highlight Badge */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-900/40 to-indigo-900/30 border border-blue-700/30 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-600/30 text-blue-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Fitur Konter HP & Servis Aktif
                </div>
                <p className="text-[10.5px] text-slate-400 mt-0.5 leading-snug">
                  Mendukung input No. IMEI smartphone, tanda terima servis 58/80mm, & tracking pengerjaan teknisi.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Ganti ID Toko / Merchant ID */}
      {showTenantModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Ganti ID Toko / Konter</h3>
                <p className="text-xs text-slate-400">Pilih atau masukkan Merchant ID toko Anda</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  ID Toko / Merchant ID (GarudaTel)
                </label>
                <input
                  type="text"
                  value={inputTenantId}
                  onChange={e => setInputTenantId(e.target.value)}
                  placeholder="Contoh: default atau MCH-XXXXXX"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-blue-500 font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  Kosongkan atau ketik <code className="text-blue-400">default</code> untuk membuka toko utama/lokal. Masukkan Merchant ID Anda jika mengelola cabang khusus.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/40 text-[11px] text-blue-300">
                💡 <strong>Tips Mitra GarudaTel:</strong> Anda juga dapat membuka kasir ini secara otomatis dengan 1-klik langsung dari menu <em>Kasir Web POS</em> di Dashboard member GarudaTel tanpa perlu mengisi form ini.
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTenantModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-700/50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTenant(inputTenantId.trim() || 'default');
                    setShowTenantModal(false);
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white transition shadow-md shadow-blue-600/30 cursor-pointer"
                >
                  Terapkan Toko
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full text-center py-4 border-t border-slate-800 text-[11px] text-slate-500">
        &copy; 2026 POS iPay Hybrid System. Dilindungi oleh Enkripsi Sesi & RBAC Standar Minimarket Modern.
      </footer>
    </div>
  );
};
