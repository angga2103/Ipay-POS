import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Store, Lock, User, KeyRound, AlertCircle, ArrowRight, 
  Smartphone, Sparkles, Eye, EyeOff, ShieldCheck, Zap, 
  Receipt, BarChart3, Building2, CheckCircle2 
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, loginWithPin, storeName, tenantId, setTenant } = useAuth();
  const [loginMode, setLoginMode] = useState<'pin' | 'password'>('pin');
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [inputTenantId, setInputTenantId] = useState(tenantId === 'default' ? '' : tenantId);

  // Password mode state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // PIN mode state
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Handle physical keyboard input for PIN
  useEffect(() => {
    if (loginMode !== 'pin' || showTenantModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key >= '0' && e.key <= '9') {
        if (pin.length < 6) {
          const nextPin = pin + e.key;
          setPin(nextPin);
          setError(null);
          if (nextPin.length === 6) {
            handlePinSubmit(nextPin);
          }
        }
      } else if (e.key === 'Backspace') {
        setPin(prev => prev.slice(0, -1));
        setError(null);
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        setPin('');
        setError(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loginMode, pin, showTenantModal]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Harap masukkan username dan kata sandi');
      return;
    }
    setError(null);
    setLoading(true);
    const success = await login(username, password);
    setLoading(false);
    if (!success) {
      setError('Username atau kata sandi tidak valid');
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

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white relative overflow-hidden">
      {/* Background Ambience Glows */}
      <div className="absolute top-[-15%] left-[-10%] w-[50vw] h-[50vw] max-w-[650px] max-h-[650px] bg-blue-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50vw] h-[50vw] max-w-[650px] max-h-[650px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-cyan-500/5 rounded-full blur-[160px] pointer-events-none" />

      {/* Main Grid Container */}
      <main className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 md:py-12 flex-1 flex items-center justify-center relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center w-full">
          
          {/* Left Column: Enterprise Branding & Feature Value (Lg: Cols 1-6) */}
          <section className="lg:col-span-6 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold backdrop-blur-md">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Sistem Kasir Ritel & PPOB Terpadu v2.0</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                POS <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">iPay</span> Cloud
              </h1>
              <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Platform kasir modern dengan kecepatan transaksi kilat, integrasi deposit PPOB otomatis, servis konter HP, dan akuntansi berstandar minimarket.
              </p>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 text-left">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm hover:border-slate-700/80 transition group">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-2.5 group-hover:bg-blue-500/20 transition">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="text-xs font-bold text-slate-200">Kasir Cepat & Barcode</div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Pencarian instan, tombol preset kasir, thermal printer 58/80mm, & kasbon pelanggan.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm hover:border-slate-700/80 transition group">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2.5 group-hover:bg-emerald-500/20 transition">
                  <Receipt className="w-4 h-4" />
                </div>
                <div className="text-xs font-bold text-slate-200">PPOB Real-Time 24 Jam</div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Pulsa, paket data, PLN, & e-money langsung memotong deposit terpusat ipay.my.id.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm hover:border-slate-700/80 transition group">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-2.5 group-hover:bg-indigo-500/20 transition">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div className="text-xs font-bold text-slate-200">Konter HP & Servis IMEI</div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Input No. IMEI smartphone, tanda terima servis resmi, & tracking pengerjaan teknisi.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm hover:border-slate-700/80 transition group">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mb-2.5 group-hover:bg-amber-500/20 transition">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div className="text-xs font-bold text-slate-200">Akuntansi Double-Entry</div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Jurnal otomatis, neraca lajur, valuasi HPP produk, & laporan laba-rugi terpercaya.
                </p>
              </div>
            </div>

            {/* Security Assurance Badges */}
            <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5 text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Enkripsi Sesi HMAC-SHA256
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <Building2 className="w-4 h-4 text-blue-400" />
                Isolasi Database Multi-Tenant
              </span>
            </div>
          </section>

          {/* Right Column: Secure Production Login Card (Lg: Cols 7-12) */}
          <section className="lg:col-span-6 w-full max-w-md mx-auto">
            <div className="bg-slate-900/80 border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/50 backdrop-blur-xl relative overflow-hidden">
              
              {/* Subtle Card Glow */}
              <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

              {/* Store & Branch Badge */}
              <div className="mb-5 px-3.5 py-2 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
                    <Store className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Toko Aktif</div>
                    <div className="text-xs font-bold text-white tracking-wide truncate">
                      {storeName}
                      {tenantId !== 'default' && (
                        <span className="ml-1.5 px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[9px] rounded font-mono border border-blue-500/30">
                          {tenantId}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setInputTenantId(tenantId === 'default' ? '' : tenantId); setShowTenantModal(true); }}
                  className="text-[11px] font-bold text-blue-400 hover:text-blue-300 px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition cursor-pointer shrink-0"
                >
                  Ganti Toko
                </button>
              </div>

              {/* Mode Switcher Tabs */}
              <div className="grid grid-cols-2 gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800/90 mb-5">
                <button
                  type="button"
                  onClick={() => { setLoginMode('pin'); setError(null); }}
                  className={`py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                    loginMode === 'pin'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  PIN Kasir Cepat
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginMode('password'); setError(null); }}
                  className={`py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                    loginMode === 'password'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  Username & Sandi
                </button>
              </div>

              {/* Error Message Alert */}
              {error && (
                <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5 animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* MODE 1: Quick PIN Login */}
              {loginMode === 'pin' && (
                <div className="flex flex-col items-center">
                  <div className="w-full text-center mb-4">
                    <span className="text-xs text-slate-400 font-medium">
                      Masukkan 6 Digit PIN Kasir / Staf:
                    </span>
                    <div className="flex justify-center items-center gap-3 mt-3">
                      {[0, 1, 2, 3, 4, 5].map(idx => (
                        <div
                          key={idx}
                          className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                            idx < pin.length
                              ? 'bg-blue-500 scale-125 shadow-sm shadow-blue-400'
                              : 'bg-slate-800 border border-slate-700'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Keypad */}
                  <div className="grid grid-cols-3 gap-2.5 w-full max-w-[280px]">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleKeypadPress(num)}
                        className="h-13 rounded-xl bg-slate-800/70 hover:bg-slate-700 active:bg-blue-600 active:scale-95 text-lg font-bold text-white transition border border-slate-700/60 flex items-center justify-center shadow-xs cursor-pointer select-none"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={handleKeypadClear}
                      className="h-13 rounded-xl bg-slate-900 hover:bg-rose-500/20 active:scale-95 text-[11px] font-bold text-rose-400 transition border border-slate-800 flex items-center justify-center cursor-pointer select-none"
                    >
                      RESET
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKeypadPress('0')}
                      className="h-13 rounded-xl bg-slate-800/70 hover:bg-slate-700 active:bg-blue-600 active:scale-95 text-lg font-bold text-white transition border border-slate-700/60 flex items-center justify-center shadow-xs cursor-pointer select-none"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={handleKeypadBackspace}
                      className="h-13 rounded-xl bg-slate-900 hover:bg-amber-500/20 active:scale-95 text-[11px] font-bold text-amber-400 transition border border-slate-800 flex items-center justify-center cursor-pointer select-none"
                    >
                      HAPUS
                    </button>
                  </div>

                  {pin.length >= 4 && (
                    <button
                      type="button"
                      onClick={() => handlePinSubmit(pin)}
                      disabled={loading}
                      className="mt-4 w-full max-w-[280px] py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs tracking-wide transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {loading ? 'Memverifikasi...' : 'Masuk Aplikasi Kasir'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}

                  <p className="text-[11px] text-slate-400 mt-4 text-center">
                    Gunakan tombol di layar atau tombol angka fisik keyboard Anda.
                  </p>
                </div>
              )}

              {/* MODE 2: Username & Password Login */}
              {loginMode === 'password' && (
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Username Pengguna
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder="Masukkan username kasir atau admin"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-sm focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Kata Sandi
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Masukkan kata sandi akun"
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-sm focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition placeholder:text-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs tracking-wide transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer mt-3"
                  >
                    {loading ? 'Memverifikasi Kredensial...' : 'Masuk Aplikasi Kasir'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* Status Indicator */}
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Server POS Online
                </span>
                <span>Port 3001 • Cloud WAL</span>
              </div>
            </div>
          </section>

        </div>
      </main>

      {/* Modal Ganti ID Toko / Cabang Multi-Tenant */}
      {showTenantModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Ganti Toko / Cabang Kasir</h3>
                <p className="text-xs text-slate-400">Pilih database tenant toko Anda</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  ID Toko / Merchant ID
                </label>
                <input
                  type="text"
                  value={inputTenantId}
                  onChange={e => setInputTenantId(e.target.value)}
                  placeholder="Contoh: default atau MCH-XXXXXX"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-hidden focus:border-blue-500 font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  Ketik <code className="text-blue-400">default</code> untuk toko utama, atau masukkan Merchant ID toko cabang Anda.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/40 text-[11px] text-blue-300 leading-relaxed">
                💡 <strong>Mitra GarudaTel:</strong> Jika Anda membuka kasir melalui menu <em>Web POS</em> di dashboard GarudaTel, sesi toko Anda akan terhubung secara otomatis via Single Sign-On (SSO).
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTenantModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
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

      {/* Production Footer */}
      <footer className="w-full text-center py-4 border-t border-slate-900 text-[11px] text-slate-400 bg-slate-950/60 backdrop-blur-xs relative z-10">
        &copy; 2026 POS iPay Hybrid System. Dilindungi oleh Enkripsi Token Bearer & Akses Berbasis Peran (RBAC).
      </footer>
    </div>
  );
};
