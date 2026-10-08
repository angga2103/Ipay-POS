import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Store, Lock, User, AlertCircle, ArrowRight, 
  Smartphone, Sparkles, Eye, EyeOff, ShieldCheck, Zap, 
  Receipt, BarChart3, Building2, CheckCircle2, Mail,
  RefreshCw, KeyRound, Phone, HelpCircle, ArrowLeft,
  Copy, MessageSquare, Shield
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { 
    loginStep1, 
    loginVerifyPin,
    registerStoreDirect,
    recoverPasswordWithPin,
    recoverPinWithPassword,
    recoverWithKey,
    fetchTenantList,
    tenantId, 
    storeName,
    setTenant
  } = useAuth();

  // Tab State: 'login' | 'register'
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Tenant / Store Selection
  const [selectedTenantId, setSelectedTenantId] = useState<string>(tenantId === 'default' ? 'default' : tenantId);
  const [tenantList, setTenantList] = useState<{ id: string; name: string }[]>([]);

  // Login Form State
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // PIN Login Modal State (Skema 1)
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [showPinCode, setShowPinCode] = useState(false);
  const [tempSessionToken, setTempSessionToken] = useState('');
  const [loginStoreName, setLoginStoreName] = useState('');
  const [pinModalError, setPinModalError] = useState<string | null>(null);
  const [pinLoading, setPinLoading] = useState(false);

  // Register Form State (Skema 1)
  const [regStoreName, setRegStoreName] = useState('');
  const [regOwnerName, setRegOwnerName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regPin, setRegPin] = useState('');
  const [regConfirmPin, setRegConfirmPin] = useState('');
  const [showRegPin, setShowRegPin] = useState(false);

  // Register Success & Recovery Key Modal State
  const [showRegisterSuccessModal, setShowRegisterSuccessModal] = useState(false);
  const [registeredRecoveryKey, setRegisteredRecoveryKey] = useState('');
  const [registeredStoreName, setRegisteredStoreName] = useState('');
  const [copiedRecoveryKey, setCopiedRecoveryKey] = useState(false);
  const [pendingRegisteredSession, setPendingRegisteredSession] = useState<{
    user: any;
    token?: string;
    tenantId: string;
    storeName: string;
  } | null>(null);

  // Recovery Center Modal State (Lupa Password / Lupa PIN)
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryTab, setRecoveryTab] = useState<'forgot_password' | 'forgot_pin' | 'emergency'>('forgot_password');
  const [recoveryTenantId, setRecoveryTenantId] = useState(tenantId || 'default');
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryPin, setRecoveryPin] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState('');
  const [recoveryCurrentPassword, setRecoveryCurrentPassword] = useState('');
  const [recoveryNewPin, setRecoveryNewPin] = useState('');
  const [recoveryConfirmPin, setRecoveryConfirmPin] = useState('');
  const [emergencyKey, setEmergencyKey] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySuccessMsg, setRecoverySuccessMsg] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  // General Feedback State
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load registered tenants on mount
  useEffect(() => {
    fetchTenantList()
      .then(list => {
        if (list && list.length > 0) setTenantList(list);
      })
      .catch(() => {});
  }, [fetchTenantList]);

  // Handle Login Step 1: Submit Store + User/Phone + Password
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail.trim() || !password) {
      setError('Harap masukkan username atau No HP dan kata sandi');
      return;
    }
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const targetTId = selectedTenantId.trim() || 'default';
    const res = await loginStep1(targetTId, usernameOrEmail.trim(), password);
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Username/No HP atau kata sandi tidak cocok');
      return;
    }

    if (res.requiresPin && res.tempSessionToken) {
      setTempSessionToken(res.tempSessionToken);
      setLoginStoreName(res.storeName || 'Toko Anda');
      setShowPinModal(true);
      setPinCode('');
      setPinModalError(null);
    }
  };

  // Handle Login Step 2: Verify 6-digit PIN
  const handleVerifyPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinCode || pinCode.trim().length !== 6) {
      setPinModalError('PIN Keamanan Toko harus terdiri dari 6 digit angka');
      return;
    }
    setPinModalError(null);
    setPinLoading(true);

    const res = await loginVerifyPin(tempSessionToken, pinCode.trim());

    if (!res.success) {
      setPinLoading(false);
      setPinModalError(res.error || '6-Digit PIN Keamanan Toko salah');
      return;
    }

    setShowPinModal(false);
    // Masuk bersih ke aplikasi kasir POS tanpa residu state login
    window.location.href = '/';
  };

  // Handle Register: Direct Self-Registration with Password and 6-Digit PIN
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regStoreName.trim() || !regOwnerName.trim() || !regPassword || !regPin) {
      setError('Semua kolom bertanda * wajib diisi');
      return;
    }
    if (regPassword.length < 6) {
      setError('Kata sandi minimal 6 karakter');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok');
      return;
    }
    if (!/^\d{6}$/.test(regPin)) {
      setError('PIN Keamanan Master harus terdiri dari 6 digit angka');
      return;
    }
    if (regPin !== regConfirmPin) {
      setError('Konfirmasi PIN Keamanan tidak cocok');
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const res = await registerStoreDirect({
      storeName: regStoreName.trim(),
      ownerName: regOwnerName.trim(),
      phone: regPhone.trim() || undefined,
      email: regEmail.trim() || undefined,
      password: regPassword,
      pin: regPin.trim(),
    });
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Pendaftaran toko gagal diproses');
      return;
    }

    setPendingRegisteredSession({
      user: res.user,
      token: res.token,
      tenantId: res.tenantId || 'default',
      storeName: res.storeName || regStoreName,
    });
    setRegisteredRecoveryKey(res.recoveryKey || '');
    setRegisteredStoreName(res.storeName || regStoreName);
    setShowRegisterSuccessModal(true);
  };

  // Handle Recover Password (via PIN)
  const handleRecoverPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryUsername.trim() || !recoveryPin.trim() || !recoveryNewPassword) {
      setRecoveryError('Harap lengkapi semua kolom');
      return;
    }
    if (recoveryNewPassword.length < 6) {
      setRecoveryError('Kata sandi baru minimal 6 karakter');
      return;
    }
    if (recoveryNewPassword !== recoveryConfirmPassword) {
      setRecoveryError('Konfirmasi kata sandi baru tidak cocok');
      return;
    }
    setRecoveryError(null);
    setRecoveryLoading(true);

    const res = await recoverPasswordWithPin({
      tenantId: recoveryTenantId.trim() || 'default',
      username: recoveryUsername.trim(),
      pin: recoveryPin.trim(),
      newPassword: recoveryNewPassword,
    });
    setRecoveryLoading(false);

    if (!res.success) {
      setRecoveryError(res.error || 'Gagal memulihkan kata sandi');
      return;
    }

    setRecoverySuccessMsg('Kata sandi berhasil diperbarui! Silakan login dengan kata sandi baru Anda.');
    setTimeout(() => {
      setShowRecoveryModal(false);
      setRecoverySuccessMsg(null);
    }, 2500);
  };

  // Handle Recover PIN (via Password)
  const handleRecoverPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryUsername.trim() || !recoveryCurrentPassword || !recoveryNewPin) {
      setRecoveryError('Harap lengkapi semua kolom');
      return;
    }
    if (!/^\d{6}$/.test(recoveryNewPin)) {
      setRecoveryError('PIN baru harus 6 digit angka');
      return;
    }
    if (recoveryNewPin !== recoveryConfirmPin) {
      setRecoveryError('Konfirmasi PIN baru tidak cocok');
      return;
    }
    setRecoveryError(null);
    setRecoveryLoading(true);

    const res = await recoverPinWithPassword({
      tenantId: recoveryTenantId.trim() || 'default',
      username: recoveryUsername.trim(),
      password: recoveryCurrentPassword,
      newPin: recoveryNewPin.trim(),
    });
    setRecoveryLoading(false);

    if (!res.success) {
      setRecoveryError(res.error || 'Gagal memulihkan PIN keamanan');
      return;
    }

    setRecoverySuccessMsg('PIN keamanan berhasil diperbarui! Silakan gunakan PIN baru Anda.');
    setTimeout(() => {
      setShowRecoveryModal(false);
      setRecoverySuccessMsg(null);
    }, 2500);
  };

  // Handle Emergency Recovery (via Master Recovery Key)
  const handleRecoverEmergencySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryTenantId.trim() || !emergencyKey.trim()) {
      setRecoveryError('ID Toko dan Kode Pemulihan Darurat wajib diisi');
      return;
    }
    if (!recoveryNewPassword && !recoveryNewPin) {
      setRecoveryError('Masukkan kata sandi baru atau PIN baru');
      return;
    }
    if (recoveryNewPassword && recoveryNewPassword.length < 6) {
      setRecoveryError('Kata sandi baru minimal 6 karakter');
      return;
    }
    if (recoveryNewPin && !/^\d{6}$/.test(recoveryNewPin)) {
      setRecoveryError('PIN baru harus 6 digit angka');
      return;
    }

    setRecoveryError(null);
    setRecoveryLoading(true);

    const res = await recoverWithKey({
      tenantId: recoveryTenantId.trim(),
      recoveryKey: emergencyKey.trim(),
      newPassword: recoveryNewPassword || undefined,
      newPin: recoveryNewPin || undefined,
    });
    setRecoveryLoading(false);

    if (!res.success) {
      setRecoveryError(res.error || 'Kode pemulihan darurat tidak cocok');
      return;
    }

    setRecoverySuccessMsg('Akun berhasil dipulihkan! Catat kode pemulihan baru Anda: ' + (res.newRecoveryKey || ''));
    setTimeout(() => {
      setShowRecoveryModal(false);
      setRecoverySuccessMsg(null);
    }, 4000);
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
          
          {/* Left Column: Enterprise Branding & Feature Highlights */}
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
                Platform kasir modern dengan keamanan autentikasi email OTP, isolasi database multi-tenant, transaksi kilat, dan integrasi deposit PPOB otomatis.
              </p>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 text-left">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm hover:border-slate-700/80 transition group">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-2.5 group-hover:bg-blue-500/20 transition">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="text-xs font-bold text-slate-200">Kasir Ritel & Barcode</div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Pencarian kilat, multi-satuan grosir, thermal printer 58/80mm, & kasbon pelanggan.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm hover:border-slate-700/80 transition group">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2.5 group-hover:bg-emerald-500/20 transition">
                  <Receipt className="w-4 h-4" />
                </div>
                <div className="text-xs font-bold text-slate-200">PPOB 24 Jam Terpadu</div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Pulsa, PLN, e-money memotong deposit terpusat ipay.my.id dengan kode unik 3 angka.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm hover:border-slate-700/80 transition group">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-2.5 group-hover:bg-indigo-500/20 transition">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div className="text-xs font-bold text-slate-200">Konter Servis & IMEI</div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Input No. IMEI smartphone, cetak tanda terima servis resmi, & notifikasi WhatsApp.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm hover:border-slate-700/80 transition group">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mb-2.5 group-hover:bg-amber-500/20 transition">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div className="text-xs font-bold text-slate-200">Akuntansi Double-Entry</div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Jurnal otomatis, neraca, retur penjualan, & laporan operasional terpercaya.
                </p>
              </div>
            </div>

            {/* Security Assurance Badges */}
            <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-4 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5 text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Verifikasi 2-Faktor Email OTP
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <Building2 className="w-4 h-4 text-blue-400" />
                Database Mandiri & Terisolasi
              </span>
            </div>
          </section>

          {/* Right Column: Authentication Card */}
          <section className="lg:col-span-6 w-full max-w-md mx-auto">
            <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/50 backdrop-blur-xl relative overflow-hidden">
              
              {/* Subtle Ambient Glow */}
              <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

              {/* Mode Tabs: Masuk Toko vs Daftar Toko Baru */}
              <div className="grid grid-cols-2 gap-1.5 bg-slate-950/90 p-1.5 rounded-2xl border border-slate-800/90 mb-6">
                <button
                  type="button"
                  onClick={() => { setActiveTab('login'); setError(null); setSuccessMsg(null); }}
                  className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                    activeTab === 'login'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Store className="w-4 h-4" />
                  Masuk Toko
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('register'); setError(null); setSuccessMsg(null); }}
                  className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                    activeTab === 'register'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  Daftar Toko Baru
                </button>
              </div>

              {/* Feedback Alerts */}
              {error && (
                <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5 animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* TAB 1: MASUK TOKO (LOGIN KREDENSIAL + OTP) */}
              {activeTab === 'login' && (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  {/* Pilihan Toko / ID Toko */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-300">
                        Nama Toko / ID Toko
                      </label>
                      <span className="text-[10px] text-blue-400 font-medium">Multi-Tenant Cloud</span>
                    </div>
                    <div className="relative">
                      <Store className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        list="tenant-suggestions"
                        value={selectedTenantId}
                        onChange={e => setSelectedTenantId(e.target.value)}
                        placeholder="Ketik nama atau ID toko (misal: default)"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-sm focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition placeholder:text-slate-500 font-mono"
                      />
                      <datalist id="tenant-suggestions">
                        {tenantList.map(t => (
                          <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
                        ))}
                      </datalist>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Gunakan <code className="text-blue-400">default</code> untuk toko utama, atau masukkan ID toko Anda.
                    </p>
                  </div>

                  {/* Username atau No HP */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Username atau No. WhatsApp / HP
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={usernameOrEmail}
                        onChange={e => setUsernameOrEmail(e.target.value)}
                        placeholder="Contoh: owner atau 08123456789"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-sm focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition placeholder:text-slate-500"
                        required
                      />
                    </div>
                  </div>

                  {/* Kata Sandi */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-300">
                        Kata Sandi Akun
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setRecoveryTenantId(selectedTenantId || 'default');
                          setRecoveryUsername(usernameOrEmail);
                          setRecoveryError(null);
                          setRecoverySuccessMsg(null);
                          setShowRecoveryModal(true);
                          setError(null);
                        }}
                        className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                      >
                        Lupa Sandi / PIN?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Masukkan kata sandi akun"
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-sm focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition placeholder:text-slate-500"
                        required
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
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs tracking-wide transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer mt-5"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Memeriksa Kredensial...</span>
                      </>
                    ) : (
                      <>
                        <span>Masuk ke Toko</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="pt-2 text-center">
                    <p className="text-xs text-slate-400">
                      Belum memiliki akun toko?{' '}
                      <button
                        type="button"
                        onClick={() => { setActiveTab('register'); setError(null); }}
                        className="text-blue-400 hover:text-blue-300 font-bold cursor-pointer"
                      >
                        Daftar Toko Baru Di Sini
                      </button>
                    </p>
                  </div>
                </form>
              )}

              {/* TAB 2: DAFTAR TOKO BARU (SKEMA 1: PASSWORD + 6-DIGIT MASTER PIN) */}
              {activeTab === 'register' && (
                <form onSubmit={handleRegisterSubmit} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Nama Toko / Usaha <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <Store className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={regStoreName}
                        onChange={e => setRegStoreName(e.target.value)}
                        placeholder="Contoh: Toko Berkah Sejahtera"
                        className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-xs sm:text-sm focus:outline-hidden focus:border-blue-500 transition placeholder:text-slate-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Nama Pemilik (Owner) <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={regOwnerName}
                          onChange={e => setRegOwnerName(e.target.value)}
                          placeholder="Nama lengkap Anda"
                          className="w-full pl-10 pr-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-blue-500 transition placeholder:text-slate-500"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        No. HP / WhatsApp
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={regPhone}
                          onChange={e => setRegPhone(e.target.value)}
                          placeholder="081234567890"
                          className="w-full pl-10 pr-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-blue-500 transition placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Kata Sandi */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Kata Sandi <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type={showRegPassword ? 'text' : 'password'}
                          value={regPassword}
                          onChange={e => setRegPassword(e.target.value)}
                          placeholder="Min 6 karakter"
                          className="w-full pl-8 pr-3 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-blue-500 transition placeholder:text-slate-500"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Ulangi Sandi <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type={showRegPassword ? 'text' : 'password'}
                          value={regConfirmPassword}
                          onChange={e => setRegConfirmPassword(e.target.value)}
                          placeholder="Ulangi sandi"
                          className="w-full pl-8 pr-8 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-blue-500 transition placeholder:text-slate-500"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                        >
                          {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* PIN Keamanan Master Toko (6 Digit) */}
                  <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div>
                      <label className="block text-xs font-semibold text-emerald-400 mb-1">
                        PIN Master (6 Digit) <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <KeyRound className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400" />
                        <input
                          type={showRegPin ? 'text' : 'password'}
                          maxLength={6}
                          value={regPin}
                          onChange={e => setRegPin(e.target.value.replace(/\D/g, ''))}
                          placeholder="123456"
                          className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono font-bold tracking-widest focus:outline-hidden focus:border-emerald-500 transition placeholder:text-slate-500 placeholder:font-sans placeholder:tracking-normal"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-emerald-400 mb-1">
                        Konfirmasi PIN <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <KeyRound className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400" />
                        <input
                          type={showRegPin ? 'text' : 'password'}
                          maxLength={6}
                          value={regConfirmPin}
                          onChange={e => setRegConfirmPin(e.target.value.replace(/\D/g, ''))}
                          placeholder="Ulangi PIN"
                          className="w-full pl-8 pr-8 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono font-bold tracking-widest focus:outline-hidden focus:border-emerald-500 transition placeholder:text-slate-500 placeholder:font-sans placeholder:tracking-normal"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPin(!showRegPin)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                        >
                          {showRegPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-tight">
                    PIN 6-digit digunakan sebagai pengaman lapis kedua saat login dan otorisasi transaksi kasir.
                  </p>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs tracking-wide transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer mt-3"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Mendaftarkan Toko...</span>
                      </>
                    ) : (
                      <>
                        <span>Daftar Toko & Buat PIN</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Status Indicator */}
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Sistem Cloud Siap
                </span>
                <span>Multi-Tenant SQLite WAL</span>
              </div>
            </div>
          </section>

        </div>
      </main>

      {/* MODAL 1: VERIFIKASI 6-DIGIT PIN KEAMANAN TOKO (SKEMA 1) */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl animate-scale-up relative">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center mx-auto mb-3.5">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">Verifikasi PIN Keamanan Toko</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Toko: <strong className="text-emerald-300">{loginStoreName}</strong><br />
                Masukkan 6-digit PIN Master Anda untuk melanjutkan masuk ke kasir:
              </p>
            </div>

            {pinModalError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{pinModalError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyPinSubmit} className="space-y-4">
              <div>
                <div className="relative">
                  <input
                    type={showPinCode ? 'text' : 'password'}
                    maxLength={6}
                    value={pinCode}
                    onChange={e => setPinCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    autoFocus
                    className="w-full py-3.5 bg-slate-950 border border-slate-700 rounded-2xl text-white text-center text-2xl font-bold tracking-[14px] font-mono focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPinCode(!showPinCode)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showPinCode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setRecoveryTenantId(selectedTenantId || 'default');
                    setRecoveryUsername(usernameOrEmail);
                    setRecoveryTab('forgot_pin');
                    setShowRecoveryModal(true);
                  }}
                  className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                >
                  Lupa PIN Keamanan?
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => { setShowPinModal(false); setPinCode(''); }}
                  className="py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pinLoading}
                  className="py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {pinLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>Verifikasi & Masuk</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PENDAFTARAN SUKSES & MASTER RECOVERY KEY */}
      {showRegisterSuccessModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl animate-scale-up relative">
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center mx-auto mb-3.5">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">Toko Berhasil Didaftarkan!</h3>
              <p className="text-xs text-slate-400 mt-1">
                Selamat! Toko <strong className="text-emerald-300">{registeredStoreName}</strong> telah aktif dan siap digunakan.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2 mb-5">
              <div className="font-bold flex items-center gap-1.5 text-amber-300">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>Simpan Kode Pemulihan Darurat Anda!</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Catat kode ini di tempat yang aman. Kode ini berguna untuk memulihkan akses toko jika Anda sewaktu-waktu lupa kata sandi DAN PIN keamanan:
              </p>
              <div className="flex items-center justify-between bg-slate-950 px-3.5 py-2.5 rounded-xl border border-amber-500/40 text-amber-300 font-mono text-sm font-bold tracking-wider">
                <span>{registeredRecoveryKey}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(registeredRecoveryKey);
                    setCopiedRecoveryKey(true);
                    setTimeout(() => setCopiedRecoveryKey(false), 2000);
                  }}
                  className="px-2.5 py-1 text-xs font-sans font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded-lg transition cursor-pointer flex items-center gap-1"
                >
                  {copiedRecoveryKey ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRecoveryKey ? 'Disalin!' : 'Salin'}</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (pendingRegisteredSession) {
                  localStorage.setItem('pos_tenant_id', pendingRegisteredSession.tenantId);
                  localStorage.setItem('pos_user', JSON.stringify(pendingRegisteredSession.user));
                  if (pendingRegisteredSession.token) {
                    localStorage.setItem('pos_auth_token', pendingRegisteredSession.token);
                  }
                }
                window.location.href = '/';
              }}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <span>Buka Kasir Sekarang</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: PUSAT PEMULIHAN AKUN (LUPA SANDI & PIN) */}
      {showRecoveryModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl animate-scale-up relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Pusat Pemulihan Akun Toko</h3>
                  <p className="text-[11px] text-slate-400">Pilih metode pemulihan mandiri akun Anda</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRecoveryModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Tab Navigasi Pemulihan */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950 rounded-xl mb-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setRecoveryTab('forgot_password'); setRecoveryError(null); setRecoverySuccessMsg(null); }}
                className={`py-2 px-2 rounded-lg text-center transition cursor-pointer text-[11px] ${
                  recoveryTab === 'forgot_password' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Lupa Password
              </button>
              <button
                type="button"
                onClick={() => { setRecoveryTab('forgot_pin'); setRecoveryError(null); setRecoverySuccessMsg(null); }}
                className={`py-2 px-2 rounded-lg text-center transition cursor-pointer text-[11px] ${
                  recoveryTab === 'forgot_pin' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Lupa PIN
              </button>
              <button
                type="button"
                onClick={() => { setRecoveryTab('emergency'); setRecoveryError(null); setRecoverySuccessMsg(null); }}
                className={`py-2 px-2 rounded-lg text-center transition cursor-pointer text-[11px] ${
                  recoveryTab === 'emergency' ? 'bg-amber-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Darurat / CS
              </button>
            </div>

            {recoveryError && (
              <div className="mb-3.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{recoveryError}</span>
              </div>
            )}

            {recoverySuccessMsg && (
              <div className="mb-3.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{recoverySuccessMsg}</span>
              </div>
            )}

            {/* TAB 1: LUPA PASSWORD -> RESET PAKAI PIN 6-DIGIT */}
            {recoveryTab === 'forgot_password' && (
              <form onSubmit={handleRecoverPasswordSubmit} className="space-y-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px]">
                  💡 <strong>Reset via PIN:</strong> Anda dapat mengatur ulang kata sandi baru menggunakan 6-Digit PIN Keamanan Toko Anda.
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">ID Toko *</label>
                    <input
                      type="text"
                      value={recoveryTenantId}
                      onChange={e => setRecoveryTenantId(e.target.value)}
                      placeholder="default"
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Username / No HP *</label>
                    <input
                      type="text"
                      value={recoveryUsername}
                      onChange={e => setRecoveryUsername(e.target.value)}
                      placeholder="owner"
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    6-Digit PIN Keamanan Toko *
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    value={recoveryPin}
                    onChange={e => setRecoveryPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Contoh: 123456"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono tracking-widest font-bold"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Kata Sandi Baru *</label>
                    <input
                      type="password"
                      value={recoveryNewPassword}
                      onChange={e => setRecoveryNewPassword(e.target.value)}
                      placeholder="Min 6 karakter"
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Konfirmasi Sandi *</label>
                    <input
                      type="password"
                      value={recoveryConfirmPassword}
                      onChange={e => setRecoveryConfirmPassword(e.target.value)}
                      placeholder="Ulangi sandi"
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRecoveryModal(false)}
                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={recoveryLoading}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-xs cursor-pointer"
                  >
                    {recoveryLoading ? 'Menyimpan...' : 'Perbarui Kata Sandi'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: LUPA PIN -> RESET PAKAI KATA SANDI */}
            {recoveryTab === 'forgot_pin' && (
              <form onSubmit={handleRecoverPinSubmit} className="space-y-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px]">
                  💡 <strong>Reset PIN via Password:</strong> Masukkan kata sandi akun Anda untuk membuat 6-Digit PIN Keamanan baru.
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">ID Toko *</label>
                    <input
                      type="text"
                      value={recoveryTenantId}
                      onChange={e => setRecoveryTenantId(e.target.value)}
                      placeholder="default"
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Username / No HP *</label>
                    <input
                      type="text"
                      value={recoveryUsername}
                      onChange={e => setRecoveryUsername(e.target.value)}
                      placeholder="owner"
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Kata Sandi Akun Saat Ini *</label>
                  <input
                    type="password"
                    value={recoveryCurrentPassword}
                    onChange={e => setRecoveryCurrentPassword(e.target.value)}
                    placeholder="Masukkan kata sandi akun Anda"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">PIN Baru (6 Digit) *</label>
                    <input
                      type="password"
                      maxLength={6}
                      value={recoveryNewPin}
                      onChange={e => setRecoveryNewPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="Contoh: 123456"
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono tracking-widest font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Konfirmasi PIN *</label>
                    <input
                      type="password"
                      maxLength={6}
                      value={recoveryConfirmPin}
                      onChange={e => setRecoveryConfirmPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="Ulangi 6 PIN"
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono tracking-widest font-bold"
                      required
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRecoveryModal(false)}
                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={recoveryLoading}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer"
                  >
                    {recoveryLoading ? 'Menyimpan...' : 'Perbarui PIN Keamanan'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: DARURAT / LUPA KEDUANYA */}
            {recoveryTab === 'emergency' && (
              <div className="space-y-4">
                <form onSubmit={handleRecoverEmergencySubmit} className="space-y-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
                    ⚠️ <strong>Pemulihan Darurat:</strong> Gunakan Kode Pemulihan Darurat (format: <code>RCV-XXXX-XXXX-XXXX</code>) yang diterbitkan saat pendaftaran toko.
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">ID Toko *</label>
                    <input
                      type="text"
                      value={recoveryTenantId}
                      onChange={e => setRecoveryTenantId(e.target.value)}
                      placeholder="Contoh: toko-berkah"
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Kode Pemulihan Darurat (Master Key) *
                    </label>
                    <input
                      type="text"
                      value={emergencyKey}
                      onChange={e => setEmergencyKey(e.target.value.toUpperCase())}
                      placeholder="RCV-XXXX-XXXX-XXXX"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono tracking-wider font-bold"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">Kata Sandi Baru (Opsional)</label>
                      <input
                        type="password"
                        value={recoveryNewPassword}
                        onChange={e => setRecoveryNewPassword(e.target.value)}
                        placeholder="Min 6 karakter"
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">PIN Baru 6-Digit (Opsional)</label>
                      <input
                        type="password"
                        maxLength={6}
                        value={recoveryNewPin}
                        onChange={e => setRecoveryNewPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="6 digit angka"
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono tracking-widest"
                      />
                    </div>
                  </div>

                  <div className="pt-1 flex justify-end">
                    <button
                      type="submit"
                      disabled={recoveryLoading}
                      className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-xs cursor-pointer"
                    >
                      {recoveryLoading ? 'Memulihkan Akun...' : 'Pulihkan Akun Toko'}
                    </button>
                  </div>
                </form>

                {/* Bantuan WhatsApp CS */}
                <div className="pt-3 border-t border-slate-800 text-center space-y-2">
                  <p className="text-[11px] text-slate-400">
                    Tidak memiliki Kode Pemulihan Darurat? Hubungi Tim Dukungan Resmi:
                  </p>
                  <a
                    href={`https://wa.me/628123456789?text=${encodeURIComponent(
                      `Halo Admin iPay POS, saya pemilik toko (ID: ${recoveryTenantId || 'default'}), membutuhkan bantuan pemulihan akses akun toko karena lupa password dan PIN.`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Hubungi CS / Admin iPay via WhatsApp</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Production Footer */}
      <footer className="w-full text-center py-4 border-t border-slate-900 text-[11px] text-slate-400 bg-slate-950/60 backdrop-blur-xs relative z-10">
        &copy; 2026 POS iPay Hybrid System. Dilindungi oleh Enkripsi Token Bearer & Autentikasi 2-Lapis Standar m-Banking.
      </footer>
    </div>
  );
};
