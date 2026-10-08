import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Store, Lock, User, AlertCircle, ArrowRight, 
  Smartphone, Sparkles, Eye, EyeOff, ShieldCheck, Zap, 
  Receipt, BarChart3, Building2, CheckCircle2, Mail,
  RefreshCw, KeyRound, Phone, HelpCircle, ArrowLeft
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { 
    loginStep1, 
    loginVerifyOtp, 
    registerStoreSendOtp, 
    registerStoreComplete, 
    forgotPasswordSendOtp, 
    resetPasswordComplete, 
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

  // OTP Login Modal State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [tempSessionToken, setTempSessionToken] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpDevCode, setOtpDevCode] = useState<string | undefined>(undefined);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Register Form State
  const [regStoreName, setRegStoreName] = useState('');
  const [regOwnerName, setRegOwnerName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Register OTP Modal State
  const [showRegOtpModal, setShowRegOtpModal] = useState(false);
  const [regOtpCode, setRegOtpCode] = useState('');
  const [regDevCode, setRegDevCode] = useState<string | undefined>(undefined);
  const [regMaskedEmail, setRegMaskedEmail] = useState('');

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotTenantId, setForgotTenantId] = useState(tenantId || 'default');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtpCode, setForgotOtpCode] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotDevCode, setForgotDevCode] = useState<string | undefined>(undefined);

  // Feedback State
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

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handle Login Step 1: Submit Store + User/Email + Password
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail.trim() || !password) {
      setError('Harap masukkan username atau email dan kata sandi');
      return;
    }
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const targetTId = selectedTenantId.trim() || 'default';
    const res = await loginStep1(targetTId, usernameOrEmail.trim(), password);
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Username/Email atau kata sandi tidak valid');
      return;
    }

    if (res.requiresOtp && res.tempSessionToken) {
      setTempSessionToken(res.tempSessionToken);
      setMaskedEmail(res.maskedEmail || 'email Anda');
      setOtpDevCode(res.devOtp);
      setShowOtpModal(true);
      setOtpCode(res.devOtp || '');
      setResendCooldown(60);
    }
  };

  // Handle Login Step 2: Verify 6-digit OTP
  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 4) {
      setError('Masukkan kode OTP dengan lengkap');
      return;
    }
    setError(null);
    setLoading(true);

    const res = await loginVerifyOtp(tempSessionToken, otpCode.trim());
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Kode OTP salah atau kedaluwarsa');
      return;
    }

    setShowOtpModal(false);
  };

  // Resend Login OTP
  const handleResendLoginOtp = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setError(null);
    const targetTId = selectedTenantId.trim() || 'default';
    const res = await loginStep1(targetTId, usernameOrEmail.trim(), password);
    setLoading(false);
    if (res.success && res.tempSessionToken) {
      setTempSessionToken(res.tempSessionToken);
      setMaskedEmail(res.maskedEmail || 'email Anda');
      setOtpDevCode(res.devOtp);
      setResendCooldown(60);
      setSuccessMsg('Kode OTP baru telah dikirimkan ke email Anda');
    } else {
      setError(res.error || 'Gagal mengirim ulang kode OTP');
    }
  };

  // Handle Register Step 1: Submit Store Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regStoreName.trim() || !regOwnerName.trim() || !regEmail.trim() || !regPassword) {
      setError('Semua kolom wajib diisi untuk pendaftaran toko');
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

    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const res = await registerStoreSendOtp(regStoreName.trim(), regOwnerName.trim(), regEmail.trim());
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Gagal mengirim kode verifikasi pendaftaran');
      return;
    }

    setRegMaskedEmail(res.maskedEmail || regEmail);
    setRegDevCode(res.devOtp);
    setRegOtpCode(res.devOtp || '');
    setShowRegOtpModal(true);
  };

  // Handle Register Step 2: Complete Registration with OTP
  const handleRegisterCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regOtpCode || regOtpCode.trim().length < 4) {
      setError('Harap masukkan kode OTP verifikasi pendaftaran');
      return;
    }
    setError(null);
    setLoading(true);

    const res = await registerStoreComplete({
      storeName: regStoreName.trim(),
      ownerName: regOwnerName.trim(),
      email: regEmail.trim(),
      phone: regPhone.trim() || undefined,
      password: regPassword,
      otpCode: regOtpCode.trim(),
    });
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Pendaftaran toko gagal diverifikasi');
      return;
    }

    setShowRegOtpModal(false);
  };

  // Handle Forgot Password Step 1: Send Reset OTP
  const handleForgotSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setError('Harap masukkan email akun yang terdaftar');
      return;
    }
    setError(null);
    setLoading(true);

    const res = await forgotPasswordSendOtp(forgotTenantId.trim() || 'default', forgotEmail.trim());
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Akun tidak ditemukan');
      return;
    }

    setForgotDevCode(res.devOtp);
    setForgotOtpCode(res.devOtp || '');
    setForgotStep(2);
    setSuccessMsg('Kode verifikasi reset sandi telah dikirim ke email');
  };

  // Handle Forgot Password Step 2: Complete Reset
  const handleForgotResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotOtpCode.trim() || !forgotNewPassword) {
      setError('Harap isi kode OTP dan kata sandi baru');
      return;
    }
    if (forgotNewPassword.length < 6) {
      setError('Kata sandi baru minimal 6 karakter');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok');
      return;
    }

    setError(null);
    setLoading(true);

    const res = await resetPasswordComplete({
      tenantId: forgotTenantId.trim() || 'default',
      email: forgotEmail.trim(),
      otpCode: forgotOtpCode.trim(),
      newPassword: forgotNewPassword,
    });
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Gagal menyetel ulang kata sandi');
      return;
    }

    setShowForgotModal(false);
    setForgotStep(1);
    setForgotEmail('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotOtpCode('');
    setSuccessMsg('Kata sandi Anda berhasil diperbarui! Silakan masuk dengan kata sandi baru.');
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

                  {/* Username atau Email */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Username atau Email
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={usernameOrEmail}
                        onChange={e => setUsernameOrEmail(e.target.value)}
                        placeholder="Contoh: owner atau kasir1 atau email@anda.com"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-sm focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  {/* Kata Sandi */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-300">
                        Kata Sandi
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotTenantId(selectedTenantId || 'default');
                          setShowForgotModal(true);
                          setError(null);
                        }}
                        className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                      >
                        Lupa Password?
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
                        <span>Memproses Verifikasi...</span>
                      </>
                    ) : (
                      <>
                        <span>Masuk & Minta Kode OTP</span>
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

              {/* TAB 2: DAFTAR TOKO BARU (REGISTRASI MANDIRI) */}
              {activeTab === 'register' && (
                <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
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
                        className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-sm focus:outline-hidden focus:border-blue-500 transition placeholder:text-slate-500"
                        required
                      />
                    </div>
                  </div>

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
                        className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-sm focus:outline-hidden focus:border-blue-500 transition placeholder:text-slate-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Email Pemilik (Untuk OTP & Pemulihan) <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        value={regEmail}
                        onChange={e => setRegEmail(e.target.value)}
                        placeholder="nama@email.com"
                        className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-sm focus:outline-hidden focus:border-blue-500 transition placeholder:text-slate-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Nomor HP / WhatsApp (Opsional)
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={regPhone}
                        onChange={e => setRegPhone(e.target.value)}
                        placeholder="081234567890"
                        className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-sm focus:outline-hidden focus:border-blue-500 transition placeholder:text-slate-500"
                      />
                    </div>
                  </div>

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
                        Konfirmasi Sandi <span className="text-rose-400">*</span>
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

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs tracking-wide transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer mt-4"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Mendaftarkan Toko...</span>
                      </>
                    ) : (
                      <>
                        <span>Daftar & Minta Kode Verifikasi</span>
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

      {/* MODAL 1: VERIFIKASI KODE OTP LOGIN */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl animate-scale-up relative">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center mx-auto mb-3.5">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">Verifikasi Keamanan Akun</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Kode OTP 6-digit telah dikirimkan ke email terdaftar Anda: <strong className="text-blue-300 font-mono">{maskedEmail}</strong>
              </p>
            </div>

            {/* Banner Mode Simulasi / Offline jika SMTP belum diatur */}
            {otpDevCode && (
              <div className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3">
                <div className="leading-snug">
                  <span className="font-bold">Mode Pengujian / Dev:</span><br />
                  Kode OTP Anda: <strong className="text-white font-mono text-sm tracking-widest">{otpDevCode}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setOtpCode(otpDevCode)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[11px] font-bold shrink-0 cursor-pointer"
                >
                  Isi Cepat
                </button>
              </div>
            )}

            <form onSubmit={handleVerifyOtpSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 text-center mb-2">
                  Masukkan 6 Digit Kode OTP
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  autoFocus
                  className="w-full py-3.5 bg-slate-950 border border-slate-700 rounded-2xl text-white text-center text-2xl font-bold tracking-[10px] font-mono focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span>Tidak menerima kode?</span>
                <button
                  type="button"
                  onClick={handleResendLoginOtp}
                  disabled={resendCooldown > 0 || loading}
                  className={`font-semibold cursor-pointer ${
                    resendCooldown > 0 ? 'text-slate-500 cursor-not-allowed' : 'text-blue-400 hover:text-blue-300'
                  }`}
                >
                  {resendCooldown > 0 ? `Kirim ulang (${resendCooldown}s)` : 'Kirim Ulang Kode'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => { setShowOtpModal(false); setOtpCode(''); }}
                  className="py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {loading ? (
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

      {/* MODAL 2: VERIFIKASI KODE OTP REGISTRASI TOKO */}
      {showRegOtpModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl animate-scale-up relative">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center mx-auto mb-3.5">
                <Store className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">Verifikasi Pendaftaran Toko</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Kami telah mengirimkan kode aktivasi ke <strong className="text-emerald-300 font-mono">{regMaskedEmail}</strong>
              </p>
            </div>

            {regDevCode && (
              <div className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3">
                <div className="leading-snug">
                  <span className="font-bold">Mode Pengujian / Dev:</span><br />
                  Kode Aktivasi: <strong className="text-white font-mono text-sm tracking-widest">{regDevCode}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setRegOtpCode(regDevCode)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[11px] font-bold shrink-0 cursor-pointer"
                >
                  Isi Cepat
                </button>
              </div>
            )}

            <form onSubmit={handleRegisterCompleteSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 text-center mb-2">
                  Masukkan 6 Digit Kode Aktivasi
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={regOtpCode}
                  onChange={e => setRegOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  autoFocus
                  className="w-full py-3.5 bg-slate-950 border border-slate-700 rounded-2xl text-white text-center text-2xl font-bold tracking-[10px] font-mono focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => { setShowRegOtpModal(false); setRegOtpCode(''); }}
                  className="py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {loading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>Aktifkan Toko</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: LUPA PASSWORD / RESET KATA SANDI */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl animate-scale-up relative">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Reset Kata Sandi Akun</h3>
                <p className="text-xs text-slate-400">
                  {forgotStep === 1 ? 'Langkah 1: Verifikasi identitas email toko' : 'Langkah 2: Buat kata sandi baru'}
                </p>
              </div>
            </div>

            {forgotDevCode && forgotStep === 2 && (
              <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
                <span>Kode OTP Reset: <strong className="font-mono text-white">{forgotDevCode}</strong></span>
                <button
                  type="button"
                  onClick={() => setForgotOtpCode(forgotDevCode)}
                  className="px-2 py-0.5 rounded bg-amber-500/20 text-[10px] font-bold"
                >
                  Isi
                </button>
              </div>
            )}

            {forgotStep === 1 ? (
              <form onSubmit={handleForgotSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nama / ID Toko
                  </label>
                  <input
                    type="text"
                    value={forgotTenantId}
                    onChange={e => setForgotTenantId(e.target.value)}
                    placeholder="Contoh: default atau ID Toko Anda"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-hidden focus:border-blue-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Email Terdaftar
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-hidden focus:border-blue-500"
                    required
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition shadow-md shadow-blue-600/30 cursor-pointer"
                  >
                    {loading ? 'Mengirim OTP...' : 'Kirim Kode OTP'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleForgotResetSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Kode OTP 6 Digit
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={forgotOtpCode}
                    onChange={e => setForgotOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-center font-mono text-lg font-bold tracking-widest focus:outline-hidden focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Kata Sandi Baru (Min 6 Karakter)
                  </label>
                  <input
                    type="password"
                    value={forgotNewPassword}
                    onChange={e => setForgotNewPassword(e.target.value)}
                    placeholder="Masukkan sandi baru"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-hidden focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Konfirmasi Kata Sandi Baru
                  </label>
                  <input
                    type="password"
                    value={forgotConfirmPassword}
                    onChange={e => setForgotConfirmPassword(e.target.value)}
                    placeholder="Ulangi sandi baru"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-hidden focus:border-blue-500"
                    required
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Kembali
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition shadow-md shadow-blue-600/30 cursor-pointer"
                  >
                    {loading ? 'Menyimpan...' : 'Simpan Kata Sandi'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Production Footer */}
      <footer className="w-full text-center py-4 border-t border-slate-900 text-[11px] text-slate-400 bg-slate-950/60 backdrop-blur-xs relative z-10">
        &copy; 2026 POS iPay Hybrid System. Dilindungi oleh Enkripsi Token Bearer & Autentikasi Email OTP Mandiri.
      </footer>
    </div>
  );
};
