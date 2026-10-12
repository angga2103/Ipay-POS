import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Store, Lock, User, AlertCircle, ArrowRight, 
  Smartphone, Sparkles, Eye, EyeOff, ShieldCheck, Zap, 
  Receipt, BarChart3, Building2, CheckCircle2,
  RefreshCw, KeyRound, Phone,
  Copy, MessageSquare, ChevronDown, ChevronUp
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { 
    loginStep1, 
    loginVerifyPin,
    loginWaSendOtp,
    loginWaVerifyOtp,
    registerWaSendOtp,
    registerStoreDirect,
    recoveryWaSendOtp,
    recoveryWaReset,
    recoverWithKey,
    fetchTenantList,
    tenantId, 
  } = useAuth();

  // Main Tab State: 'login' | 'register'
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login Sub-Mode: 'password_pin' (Harian Cepat) | 'wa_otp' (Tanpa Password via WA OTP Baileys)
  const [loginMode, setLoginMode] = useState<'password_pin' | 'wa_otp'>('password_pin');

  // Tenant / Store Selection (Optional — Auto-detected by Backend)
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [showStoreInput, setShowStoreInput] = useState<boolean>(false);
  const [tenantList, setTenantList] = useState<{ id: string; name: string }[]>([]);
  const [candidateStores, setCandidateStores] = useState<{ tenantId: string; storeName: string; userName: string; role: string }[]>([]);

  // Login Form State (Mode 1: Password + PIN)
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Login Form State (Mode 2: WhatsApp OTP)
  const [waLoginPhone, setWaLoginPhone] = useState('');
  const [waLoginStep, setWaLoginStep] = useState<'request' | 'verify'>('request');
  const [waLoginOtp, setWaLoginOtp] = useState('');
  const [waLoginMaskedPhone, setWaLoginMaskedPhone] = useState('');
  const [waLoginDetectedStore, setWaLoginDetectedStore] = useState<{ tenantId: string; storeName: string; userName?: string } | null>(null);
  const [waLoginCountdown, setWaLoginCountdown] = useState(0);

  // PIN Login Modal State (Mode 1 Step 2)
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [showPinCode, setShowPinCode] = useState(false);
  const [tempSessionToken, setTempSessionToken] = useState('');
  const [loginStoreName, setLoginStoreName] = useState('');
  const [loginDetectedTenantId, setLoginDetectedTenantId] = useState('');
  const [pinModalError, setPinModalError] = useState<string | null>(null);
  const [pinLoading, setPinLoading] = useState(false);

  // Register Form State
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
  const [regAutoProvisionPpob, setRegAutoProvisionPpob] = useState(true);
  const [regExistingStoreConflict, setRegExistingStoreConflict] = useState<{ tenantId: string; storeName: string } | null>(null);

  // Register WA OTP Verification Modal State
  const [showRegOtpModal, setShowRegOtpModal] = useState(false);
  const [regOtpCode, setRegOtpCode] = useState('');
  const [regMaskedPhone, setRegMaskedPhone] = useState('');
  const [regOtpMessage, setRegOtpMessage] = useState('');
  const [regOtpError, setRegOtpError] = useState<string | null>(null);
  const [regOtpLoading, setRegOtpLoading] = useState(false);
  const [regOtpCountdown, setRegOtpCountdown] = useState(0);
  const [regAllowMultipleStores, setRegAllowMultipleStores] = useState(false);

  // Register Success & Recovery Key Modal State
  const [showRegisterSuccessModal, setShowRegisterSuccessModal] = useState(false);
  const [registeredRecoveryKey, setRegisteredRecoveryKey] = useState('');
  const [registeredStoreName, setRegisteredStoreName] = useState('');
  const [registeredTenantId, setRegisteredTenantId] = useState('');
  const [registeredLoginPhone, setRegisteredLoginPhone] = useState('');
  const [registeredUsername, setRegisteredUsername] = useState('');
  const [registeredProvisionResult, setRegisteredProvisionResult] = useState<any | null>(null);
  const [copiedRecoveryKey, setCopiedRecoveryKey] = useState(false);
  const [copiedTenantId, setCopiedTenantId] = useState(false);
  const [pendingRegisteredSession, setPendingRegisteredSession] = useState<{
    user: any;
    token?: string;
    tenantId: string;
    storeName: string;
  } | null>(null);

  // Recovery Center Modal State (Pusat Pemulihan Akun: WA OTP & Kode Darurat)
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryTab, setRecoveryTab] = useState<'wa_otp' | 'emergency'>('wa_otp');
  const [recoveryTargetType, setRecoveryTargetType] = useState<'both' | 'password' | 'pin'>('both');
  const [recoveryTenantId, setRecoveryTenantId] = useState('');
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryWaStep, setRecoveryWaStep] = useState<'request' | 'verify'>('request');
  const [recoveryWaOtp, setRecoveryWaOtp] = useState('');
  const [recoveryWaMaskedPhone, setRecoveryWaMaskedPhone] = useState('');
  const [recoveryWaDetectedStore, setRecoveryWaDetectedStore] = useState<{ tenantId: string; storeName: string; userName?: string } | null>(null);
  const [recoveryCandidateStores, setRecoveryCandidateStores] = useState<{ tenantId: string; storeName: string; userName: string; role: string }[]>([]);
  const [recoveryCountdown, setRecoveryCountdown] = useState(0);

  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState('');
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
  const [recoveryNewPin, setRecoveryNewPin] = useState('');
  const [recoveryConfirmPin, setRecoveryConfirmPin] = useState('');
  const [showRecoveryPin, setShowRecoveryPin] = useState(false);
  const [emergencyKey, setEmergencyKey] = useState('');
  const [rotatedNewRecoveryKey, setRotatedNewRecoveryKey] = useState<string | null>(null);
  const [copiedRotatedKey, setCopiedRotatedKey] = useState(false);
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

  // Countdown timers for OTP resend
  useEffect(() => {
    if (waLoginCountdown <= 0) return;
    const timer = setTimeout(() => setWaLoginCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [waLoginCountdown]);

  useEffect(() => {
    if (regOtpCountdown <= 0) return;
    const timer = setTimeout(() => setRegOtpCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [regOtpCountdown]);

  useEffect(() => {
    if (recoveryCountdown <= 0) return;
    const timer = setTimeout(() => setRecoveryCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [recoveryCountdown]);

  // ============================================================================
  // MODE 1: LOGIN HARIAN CEPAT (AUTO-DETECT STORE + PASSWORD + 6-DIGIT PIN)
  // ============================================================================
  const handleLoginSubmit = async (e: React.FormEvent, overrideTenantId?: string) => {
    e.preventDefault();
    if (!usernameOrEmail.trim() || !password) {
      setError('Harap masukkan No. WhatsApp / Username dan Kata Sandi Anda.');
      return;
    }
    setError(null);
    setSuccessMsg(null);
    setCandidateStores([]);
    setLoading(true);

    const targetTId = overrideTenantId !== undefined ? overrideTenantId : selectedTenantId.trim();
    const res = await loginStep1(targetTId, usernameOrEmail.trim(), password);
    setLoading(false);

    if (!res.success) {
      if (res.requiresStoreSelection && res.stores && res.stores.length > 1) {
        setCandidateStores(res.stores);
        setError('Nomor WA / Username Anda terdaftar di beberapa toko. Silakan klik salah satu toko di bawah ini:');
        return;
      }
      setError(res.error || 'No. WhatsApp / Username atau Kata Sandi tidak cocok.');
      return;
    }

    if (res.requiresPin && res.tempSessionToken) {
      setTempSessionToken(res.tempSessionToken);
      setLoginStoreName(res.storeName || 'Toko Anda');
      setLoginDetectedTenantId(res.tenantId || '');
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
    window.location.href = '/';
  };

  // ============================================================================
  // MODE 2: LOGIN INSTAN VIA OTP WHATSAPP (BOT BAILEYS IPAY.MY.ID)
  // ============================================================================
  const handleWaLoginSendOtp = async (e?: React.FormEvent, overrideTenantId?: string) => {
    if (e) e.preventDefault();
    if (!waLoginPhone.trim() || waLoginPhone.trim().length < 8) {
      setError('Masukkan Nomor WhatsApp terdaftar yang valid (contoh: 081234567890).');
      return;
    }
    setError(null);
    setSuccessMsg(null);
    setCandidateStores([]);
    setLoading(true);

    const targetTId = overrideTenantId !== undefined ? overrideTenantId : selectedTenantId.trim();
    const res = await loginWaSendOtp(waLoginPhone.trim(), targetTId || undefined);
    setLoading(false);

    if (!res.success) {
      if (res.requiresStoreSelection && res.stores && res.stores.length > 1) {
        setCandidateStores(res.stores);
        setError('Nomor WhatsApp ini terdaftar di beberapa toko. Pilih toko yang ingin Anda masuki:');
        return;
      }
      setError(res.error || 'Gagal mengirim OTP WhatsApp.');
      return;
    }

    setWaLoginStep('verify');
    setWaLoginOtp('');
    setWaLoginMaskedPhone(res.maskedPhone || waLoginPhone);
    setWaLoginDetectedStore({
      tenantId: res.tenantId || '',
      storeName: res.storeName || 'Toko Anda',
      userName: res.userName,
    });
    setWaLoginCountdown(60);
    setSuccessMsg(res.message || 'Kode OTP 6-digit telah dikirim ke WhatsApp Anda.');
  };

  const handleWaLoginVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waLoginOtp || waLoginOtp.trim().length !== 6) {
      setError('Masukkan 6 digit angka Kode OTP WhatsApp.');
      return;
    }
    setError(null);
    setLoading(true);

    const res = await loginWaVerifyOtp(
      waLoginPhone.trim(),
      waLoginOtp.trim(),
      waLoginDetectedStore?.tenantId || selectedTenantId.trim() || undefined
    );
    setLoading(false);

    if (!res.success) {
      setError(res.error || 'Kode OTP WhatsApp salah atau kadaluarsa.');
      return;
    }

    window.location.href = '/';
  };

  // ============================================================================
  // TAB 2: PENDAFTARAN TOKO BARU DENGAN VERIFIKASI OTP WHATSAPP BAILEYS
  // ============================================================================
  const handleRegisterRequestOtp = async (e?: React.FormEvent, forceAllowMultiple = false) => {
    if (e) e.preventDefault();
    setRegExistingStoreConflict(null);

    if (!regStoreName.trim() || !regOwnerName.trim() || !regPhone.trim() || !regPassword || !regPin) {
      setError('Semua kolom bertanda * wajib diisi.');
      return;
    }
    if (regPhone.replace(/\D/g, '').length < 9) {
      setError('Nomor WhatsApp tidak valid. Masukkan nomor WA aktif (contoh: 081234567890).');
      return;
    }
    if (regPassword.length < 6) {
      setError('Kata sandi minimal 6 karakter.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    if (!/^\d{6}$/.test(regPin)) {
      setError('PIN Keamanan Master harus terdiri dari 6 digit angka.');
      return;
    }
    if (regPin !== regConfirmPin) {
      setError('Konfirmasi PIN Keamanan tidak cocok.');
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const allowMulti = forceAllowMultiple || regAllowMultipleStores;
    const otpRes = await registerWaSendOtp({
      storeName: regStoreName.trim(),
      ownerName: regOwnerName.trim(),
      phone: regPhone.trim(),
      allowMultipleStores: allowMulti,
    });
    setLoading(false);

    if (!otpRes.success) {
      if (otpRes.existingStore) {
        setRegExistingStoreConflict(otpRes.existingStore);
      }
      setError(otpRes.error || 'Gagal mengirim OTP verifikasi WhatsApp.');
      return;
    }

    setRegAllowMultipleStores(allowMulti);
    setRegMaskedPhone(otpRes.maskedPhone || regPhone.trim());
    setRegOtpMessage(otpRes.message || 'Kode OTP telah dikirim ke nomor WhatsApp Anda.');
    setRegOtpCode('');
    setRegOtpError(null);
    setRegOtpCountdown(60);
    setShowRegOtpModal(true);
  };

  const handleRegisterCompleteWithOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regOtpCode || regOtpCode.trim().length !== 6) {
      setRegOtpError('Masukkan 6 digit kode OTP yang dikirim ke WhatsApp Anda.');
      return;
    }

    setRegOtpError(null);
    setRegOtpLoading(true);

    const res = await registerStoreDirect({
      storeName: regStoreName.trim(),
      ownerName: regOwnerName.trim(),
      phone: regPhone.trim(),
      email: regEmail.trim() || undefined,
      password: regPassword,
      pin: regPin.trim(),
      otpCode: regOtpCode.trim(),
      allowMultipleStores: regAllowMultipleStores,
      autoProvisionPpob: regAutoProvisionPpob,
    });
    setRegOtpLoading(false);

    if (!res.success) {
      setRegOtpError(res.error || 'Verifikasi OTP atau pendaftaran toko gagal.');
      return;
    }

    setShowRegOtpModal(false);
    setPendingRegisteredSession({
      user: res.user,
      token: res.token,
      tenantId: res.tenantId || 'default',
      storeName: res.storeName || regStoreName,
    });
    setRegisteredRecoveryKey(res.recoveryKey || '');
    setRegisteredStoreName(res.storeName || regStoreName);
    setRegisteredTenantId(res.tenantId || '');
    setRegisteredLoginPhone(res.loginPhone || regPhone.trim());
    setRegisteredUsername(res.user?.username || '');
    setRegisteredProvisionResult(res.provisionResult || null);
    setShowRegisterSuccessModal(true);
  };

  // ============================================================================
  // MODAL 3: PUSAT PEMULIHAN AKUN (VIA WA OTP BAILEYS & KODE DARURAT)
  // ============================================================================
  const handleRecoverySendWaOtp = async (e?: React.FormEvent, overrideTenantId?: string) => {
    if (e) e.preventDefault();
    if (!recoveryUsername.trim()) {
      setRecoveryError('Masukkan Nomor WhatsApp terdaftar atau Username akun Anda.');
      return;
    }
    setRecoveryError(null);
    setRecoverySuccessMsg(null);
    setRecoveryCandidateStores([]);
    setRecoveryLoading(true);

    const targetTId = overrideTenantId !== undefined ? overrideTenantId : recoveryTenantId.trim();
    const res = await recoveryWaSendOtp({
      phoneOrUsername: recoveryUsername.trim(),
      tenantId: targetTId || undefined,
      action: recoveryTargetType === 'pin' ? 'reset_pin' : 'reset_password',
    });
    setRecoveryLoading(false);

    if (!res.success) {
      if (res.requiresStoreSelection && res.stores && res.stores.length > 1) {
        setRecoveryCandidateStores(res.stores);
        setRecoveryError('Nomor WhatsApp / Username ini terdaftar di beberapa toko. Pilih toko yang ingin dipulihkan:');
        return;
      }
      setRecoveryError(res.error || 'Gagal mengirim OTP pemulihan ke WhatsApp.');
      return;
    }

    setRecoveryWaStep('verify');
    setRecoveryWaOtp('');
    setRecoveryWaMaskedPhone(res.maskedPhone || recoveryUsername);
    setRecoveryWaDetectedStore({
      tenantId: res.tenantId || '',
      storeName: res.storeName || 'Toko Anda',
      userName: res.userName,
    });
    setRecoveryCountdown(60);
    setRecoverySuccessMsg(res.message || 'Kode OTP pemulihan 6-digit telah dikirim ke WhatsApp Anda.');
  };

  const handleRecoveryVerifyWaOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryWaOtp || recoveryWaOtp.trim().length !== 6) {
      setRecoveryError('Masukkan 6 digit Kode OTP dari WhatsApp Anda.');
      return;
    }

    const needPassword = recoveryTargetType === 'both' || recoveryTargetType === 'password';
    const needPin = recoveryTargetType === 'both' || recoveryTargetType === 'pin';

    if (needPassword) {
      if (!recoveryNewPassword || recoveryNewPassword.length < 6) {
        setRecoveryError('Kata sandi baru minimal 6 karakter.');
        return;
      }
      if (recoveryNewPassword !== recoveryConfirmPassword) {
        setRecoveryError('Konfirmasi kata sandi baru tidak cocok.');
        return;
      }
    }

    if (needPin) {
      if (!recoveryNewPin || !/^\d{6}$/.test(recoveryNewPin)) {
        setRecoveryError('PIN Keamanan baru harus terdiri dari 6 digit angka.');
        return;
      }
      if (recoveryNewPin !== recoveryConfirmPin) {
        setRecoveryError('Konfirmasi PIN 6-digit baru tidak cocok.');
        return;
      }
    }

    setRecoveryError(null);
    setRecoveryLoading(true);

    const res = await recoveryWaReset({
      phoneOrUsername: recoveryUsername.trim(),
      tenantId: recoveryWaDetectedStore?.tenantId || recoveryTenantId.trim() || undefined,
      otpCode: recoveryWaOtp.trim(),
      action: recoveryTargetType === 'pin' ? 'reset_pin' : 'reset_password',
      newPassword: needPassword ? recoveryNewPassword : undefined,
      newPin: needPin ? recoveryNewPin.trim() : undefined,
    });
    setRecoveryLoading(false);

    if (!res.success) {
      setRecoveryError(res.error || 'Gagal menyetel ulang kredensial akun.');
      return;
    }

    setRecoverySuccessMsg(res.message || 'Kredensial akun berhasil diperbarui! Silakan masuk dengan sandi/PIN baru Anda.');
    if (res.phone || res.username) {
      setUsernameOrEmail(res.phone || res.username || '');
    }
    if (res.tenantId) {
      setSelectedTenantId(res.tenantId);
    }
  };

  // Handle Emergency Recovery (via Master Recovery Key — Auto-detects store if tenantId left blank!)
  const handleRecoverEmergencySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emergencyKey.trim()) {
      setRecoveryError('Kode Pemulihan Darurat (RCV-XXXX-XXXX-XXXX) wajib diisi.');
      return;
    }
    if (!recoveryNewPassword && !recoveryNewPin) {
      setRecoveryError('Masukkan minimal Kata Sandi Baru atau PIN 6-Digit Baru.');
      return;
    }
    if (recoveryNewPassword) {
      if (recoveryNewPassword.length < 6) {
        setRecoveryError('Kata sandi baru minimal 6 karakter.');
        return;
      }
      if (recoveryNewPassword !== recoveryConfirmPassword) {
        setRecoveryError('Konfirmasi kata sandi baru tidak cocok.');
        return;
      }
    }
    if (recoveryNewPin) {
      if (!/^\d{6}$/.test(recoveryNewPin)) {
        setRecoveryError('PIN baru harus terdiri dari 6 digit angka.');
        return;
      }
      if (recoveryNewPin !== recoveryConfirmPin) {
        setRecoveryError('Konfirmasi PIN baru tidak cocok.');
        return;
      }
    }

    setRecoveryError(null);
    setRecoveryLoading(true);

    const res = await recoverWithKey({
      tenantId: recoveryTenantId.trim() || undefined,
      recoveryKey: emergencyKey.trim(),
      newPassword: recoveryNewPassword || undefined,
      newPin: recoveryNewPin || undefined,
    });
    setRecoveryLoading(false);

    if (!res.success) {
      setRecoveryError(res.error || 'Kode Pemulihan Darurat tidak valid.');
      return;
    }

    // Tampilkan Kode Darurat Baru secara PERSISTEN (tidak auto-close sebelum user klik tombol konfirmasi!)
    setRotatedNewRecoveryKey(res.newRecoveryKey || '');
    setRecoverySuccessMsg(res.message || 'Akun berhasil dipulihkan!');
    if (res.phone || res.username) {
      setUsernameOrEmail(res.phone || res.username || '');
    }
    if (res.tenantId) {
      setSelectedTenantId(res.tenantId);
    }
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
              <span>Sistem Kasir Ritel & PPOB Terpadu v2.5 Hybrid WA OTP</span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                POS <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">iPay</span> Cloud
              </h1>
              <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Platform kasir modern dengan keamanan <strong>Hybrid Login (Password + 6-Digit PIN &amp; OTP WhatsApp Baileys)</strong>, deteksi toko otomatis dari Nomor WA, dan integrasi deposit PPOB <code className="text-blue-300">ipay.my.id</code>.
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
                  Pulsa, PLN, e-money memotong deposit terpusat ipay.my.id dengan 1-Click Auto-Provisioning.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm hover:border-slate-700/80 transition group">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-2.5 group-hover:bg-indigo-500/20 transition">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div className="text-xs font-bold text-slate-200">OTP WhatsApp Baileys</div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Verifikasi pendaftaran, login instan tanpa sandi, dan reset PIN/Sandi langsung via WA.
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
                2FA PIN + WhatsApp OTP Baileys
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <Building2 className="w-4 h-4 text-blue-400" />
                Auto-Detect Toko dari Nomor WA
              </span>
            </div>
          </section>

          {/* Right Column: Authentication Card */}
          <section className="lg:col-span-6 w-full max-w-md mx-auto">
            <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/50 backdrop-blur-xl relative overflow-hidden">
              
              {/* Subtle Ambient Glow */}
              <div className="absolute top-0 right-0 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

              {/* Mode Tabs: Masuk Toko vs Daftar Toko Baru */}
              <div className="grid grid-cols-2 gap-1.5 bg-slate-950/90 p-1.5 rounded-2xl border border-slate-800/90 mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('login');
                    setError(null);
                    setSuccessMsg(null);
                    setCandidateStores([]);
                  }}
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
                  onClick={() => {
                    setActiveTab('register');
                    setError(null);
                    setSuccessMsg(null);
                    setCandidateStores([]);
                  }}
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
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <div className="flex-1 leading-relaxed">{error}</div>
                </div>
              )}

              {/* Multi-Store Selector when Phone/Username matches multiple stores */}
              {candidateStores.length > 1 && activeTab === 'login' && (
                <div className="mb-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-2">
                  <div className="text-[11px] font-bold text-blue-300">Pilih Toko Anda:</div>
                  <div className="space-y-1.5">
                    {candidateStores.map(st => (
                      <button
                        key={st.tenantId}
                        type="button"
                        onClick={e => {
                          setSelectedTenantId(st.tenantId);
                          if (loginMode === 'password_pin') {
                            handleLoginSubmit(e as any, st.tenantId);
                          } else {
                            handleWaLoginSendOtp(undefined, st.tenantId);
                          }
                        }}
                        className="w-full p-2.5 rounded-lg bg-slate-950/90 hover:bg-blue-600/20 border border-slate-800 hover:border-blue-500/40 text-left flex items-center justify-between transition cursor-pointer"
                      >
                        <div>
                          <div className="text-xs font-bold text-white">{st.storeName}</div>
                          <div className="text-[10px] text-slate-400">
                            ID: <span className="font-mono text-blue-300">{st.tenantId}</span> • Akun: {st.userName}
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-blue-400" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {successMsg && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  <span className="leading-relaxed">{successMsg}</span>
                </div>
              )}

              {/* ============================================================ */}
              {/* TAB 1: MASUK TOKO (HYBRID: PASSWORD+PIN ATAU WA OTP BAILEYS) */}
              {/* ============================================================ */}
              {activeTab === 'login' && (
                <div className="space-y-4">
                  {/* Sub-mode Toggle: Password+PIN vs OTP WhatsApp */}
                  <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950/80 border border-slate-800/80 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setLoginMode('password_pin');
                        setError(null);
                        setSuccessMsg(null);
                        setCandidateStores([]);
                      }}
                      className={`py-2 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        loginMode === 'password_pin'
                          ? 'bg-slate-800 text-white border border-slate-700 shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                      <span>Password + PIN</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLoginMode('wa_otp');
                        setError(null);
                        setSuccessMsg(null);
                        setCandidateStores([]);
                      }}
                      className={`py-2 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        loginMode === 'wa_otp'
                          ? 'bg-emerald-600/25 text-emerald-300 border border-emerald-500/40 shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Login OTP WhatsApp</span>
                    </button>
                  </div>

                  {/* MODE 1A: PASSWORD + 6-DIGIT PIN */}
                  {loginMode === 'password_pin' && (
                    <form onSubmit={e => handleLoginSubmit(e)} className="space-y-4">
                      {/* No. WhatsApp atau Username */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                          No. WhatsApp Terdaftar atau Username
                        </label>
                        <div className="relative">
                          <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={usernameOrEmail}
                            onChange={e => setUsernameOrEmail(e.target.value)}
                            placeholder="Contoh: 081234567890 atau owner"
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-sm focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition placeholder:text-slate-500"
                            required
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          💡 Cukup ketik <strong>Nomor WhatsApp</strong> Anda — sistem otomatis mendeteksi toko Anda.
                        </p>
                      </div>

                      {/* Kata Sandi */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-semibold text-slate-200">
                            Kata Sandi Akun
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setRecoveryTenantId(selectedTenantId);
                              setRecoveryUsername(usernameOrEmail);
                              setRecoveryTab('wa_otp');
                              setRecoveryWaStep('request');
                              setRecoveryError(null);
                              setRecoverySuccessMsg(null);
                              setRotatedNewRecoveryKey(null);
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

                      {/* Opsional: Pilih / Ketik Nama atau ID Toko secara spesifik */}
                      <div className="pt-0.5">
                        <button
                          type="button"
                          onClick={() => setShowStoreInput(!showStoreInput)}
                          className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                        >
                          <Store className="w-3.5 h-3.5 text-blue-400" />
                          <span>
                            {selectedTenantId
                              ? `Toko dipilih: ${selectedTenantId}`
                              : 'Punya banyak cabang? Pilih Nama / ID Toko (Opsional)'}
                          </span>
                          {showStoreInput ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {showStoreInput && (
                          <div className="mt-2">
                            <input
                              type="text"
                              list="tenant-suggestions"
                              value={selectedTenantId}
                              onChange={e => setSelectedTenantId(e.target.value)}
                              placeholder="Kosongkan untuk deteksi otomatis, atau ketik nama/ID toko"
                              className="w-full px-3.5 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-blue-500 transition placeholder:text-slate-500 font-mono"
                            />
                            <datalist id="tenant-suggestions">
                              {tenantList.map(t => (
                                <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
                              ))}
                            </datalist>
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs tracking-wide transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer mt-2"
                      >
                        {loading ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Mendeteksi Toko & Memeriksa Akun...</span>
                          </>
                        ) : (
                          <>
                            <span>Lanjut Verifikasi PIN</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </form>
                  )}

                  {/* MODE 1B: LOGIN INSTAN VIA OTP WHATSAPP BAILEYS */}
                  {loginMode === 'wa_otp' && (
                    <div className="space-y-4">
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-[11px] text-emerald-200 leading-relaxed">
                        📲 <strong>Login Tanpa Kata Sandi:</strong> Masukkan Nomor WhatsApp yang terdaftar di toko Anda. Bot WhatsApp <strong>ipay.my.id</strong> akan mengirimkan 6-digit Kode OTP.
                      </div>

                      {waLoginStep === 'request' ? (
                        <form onSubmit={e => handleWaLoginSendOtp(e)} className="space-y-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                              Nomor WhatsApp Terdaftar
                            </label>
                            <div className="relative">
                              <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400" />
                              <input
                                type="tel"
                                value={waLoginPhone}
                                onChange={e => setWaLoginPhone(e.target.value)}
                                placeholder="Contoh: 081234567890"
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-white text-sm font-mono focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition placeholder:text-slate-500 placeholder:font-sans"
                                required
                              />
                            </div>
                          </div>

                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs tracking-wide transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {loading ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Mengirim OTP ke WhatsApp...</span>
                              </>
                            ) : (
                              <>
                                <MessageSquare className="w-4 h-4" />
                                <span>Kirim Kode OTP ke WhatsApp</span>
                              </>
                            )}
                          </button>
                        </form>
                      ) : (
                        <form onSubmit={handleWaLoginVerifyOtp} className="space-y-4">
                          {waLoginDetectedStore && (
                            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center justify-between">
                              <div>
                                <div className="text-[10px] text-slate-400">Toko Terdeteksi:</div>
                                <div className="font-bold text-emerald-300">{waLoginDetectedStore.storeName}</div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  ID: {waLoginDetectedStore.tenantId} • WA: {waLoginMaskedPhone}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setWaLoginStep('request');
                                  setWaLoginOtp('');
                                  setSuccessMsg(null);
                                }}
                                className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                              >
                                Ganti Nomor
                              </button>
                            </div>
                          )}

                          <div>
                            <label className="block text-xs font-semibold text-slate-200 mb-1.5 text-center">
                              Masukkan 6-Digit Kode OTP WhatsApp
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              value={waLoginOtp}
                              onChange={e => setWaLoginOtp(e.target.value.replace(/\D/g, ''))}
                              placeholder="••••••"
                              autoFocus
                              className="w-full py-3 bg-slate-950 border border-emerald-500/50 rounded-2xl text-white text-center text-2xl font-bold tracking-[12px] font-mono focus:outline-hidden focus:border-emerald-400"
                              required
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>Belum menerima pesan WA?</span>
                            {waLoginCountdown > 0 ? (
                              <span className="text-slate-500">Kirim ulang dalam {waLoginCountdown}d</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleWaLoginSendOtp(undefined, waLoginDetectedStore?.tenantId)}
                                className="text-emerald-400 hover:text-emerald-300 font-bold cursor-pointer"
                              >
                                Kirim Ulang OTP WA
                              </button>
                            )}
                          </div>

                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs tracking-wide transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {loading ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Memverifikasi OTP...</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Verifikasi OTP & Masuk Kasir</span>
                              </>
                            )}
                          </button>
                        </form>
                      )}
                    </div>
                  )}

                  <div className="pt-2 text-center border-t border-slate-800/60">
                    <p className="text-xs text-slate-400">
                      Belum memiliki akun toko?{' '}
                      <button
                        type="button"
                        onClick={() => { setActiveTab('register'); setError(null); setSuccessMsg(null); }}
                        className="text-blue-400 hover:text-blue-300 font-bold cursor-pointer"
                      >
                        Daftar Toko Baru Di Sini
                      </button>
                    </p>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* TAB 2: DAFTAR TOKO BARU (VERIFIKASI WA OTP BAILEYS)          */}
              {/* ============================================================ */}
              {activeTab === 'register' && (
                <form onSubmit={e => handleRegisterRequestOtp(e, false)} className="space-y-3">
                  {/* Alert Konflik jika Nomor WA sudah pernah didaftarkan ke toko lain */}
                  {regExistingStoreConflict && (
                    <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs space-y-2.5">
                      <div className="font-bold text-amber-300 flex items-center gap-1.5">
                        <Store className="w-4 h-4 shrink-0" />
                        <span>Nomor WA Ini Sudah Terdaftar!</span>
                      </div>
                      <p className="text-[11px] text-slate-200 leading-relaxed">
                        Nomor <strong>{regPhone}</strong> sudah memiliki toko aktif: <strong className="text-emerald-300">{regExistingStoreConflict.storeName}</strong> (ID: <code className="text-amber-300">{regExistingStoreConflict.tenantId}</code>).
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('login');
                            setUsernameOrEmail(regPhone.trim());
                            setSelectedTenantId(regExistingStoreConflict.tenantId);
                            setError(null);
                            setRegExistingStoreConflict(null);
                          }}
                          className="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] cursor-pointer transition text-center"
                        >
                          Masuk ke {regExistingStoreConflict.storeName}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRegisterRequestOtp(undefined, true)}
                          className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-500/30 font-semibold text-[11px] cursor-pointer transition text-center"
                        >
                          Tetap Buat Cabang Baru
                        </button>
                      </div>
                    </div>
                  )}

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
                        placeholder="Contoh: Konter Berkah Cell"
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
                      <label className="block text-xs font-semibold text-emerald-400 mb-1">
                        No. WhatsApp Aktif <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400" />
                        <input
                          type="tel"
                          value={regPhone}
                          onChange={e => setRegPhone(e.target.value)}
                          placeholder="081234567890"
                          className="w-full pl-10 pr-3 py-2 bg-slate-950/80 border border-emerald-500/40 rounded-xl text-white text-xs font-mono focus:outline-hidden focus:border-emerald-500 transition placeholder:text-slate-500 placeholder:font-sans"
                          required
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 -mt-1">
                    📲 Nomor WA digunakan sebagai <strong>ID Login Utama</strong>, penerimaan <strong>OTP Baileys</strong>, dan <strong>Jalur PPOB</strong>.
                  </p>

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
                          inputMode="numeric"
                          maxLength={6}
                          value={regPin}
                          onChange={e => setRegPin(e.target.value.replace(/\D/g, ''))}
                          placeholder="6 angka"
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
                          inputMode="numeric"
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

                  {/* Checkbox 1-Click Auto-Provisioning PPOB ipay.my.id */}
                  <label className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-950/40 border border-blue-500/30 cursor-pointer hover:bg-blue-950/60 transition">
                    <input
                      type="checkbox"
                      checked={regAutoProvisionPpob}
                      onChange={e => setRegAutoProvisionPpob(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                    />
                    <div className="text-[11px] leading-snug">
                      <span className="font-bold text-blue-200 flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        Sekalian ajukan aktivasi otomatis jalur Pulsa & PPOB (ipay.my.id)
                      </span>
                      <span className="text-slate-400 block mt-0.5">
                        Kirim notifikasi 1-Klik ke Bot Telegram Admin iPay. Begitu disetujui, API Key Live langsung tersambung otomatis.
                      </span>
                    </div>
                  </label>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs tracking-wide transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer mt-3"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Mengirim OTP ke WhatsApp...</span>
                      </>
                    ) : (
                      <>
                        <MessageSquare className="w-4 h-4" />
                        <span>Kirim OTP WhatsApp & Daftar Toko</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Status Indicator */}
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Baileys WA Gateway Ready
                </span>
                <span>Multi-Tenant SQLite WAL</span>
              </div>
            </div>
          </section>

        </div>
      </main>

      {/* ================================================================== */}
      {/* MODAL 1: VERIFIKASI 6-DIGIT PIN KEAMANAN TOKO (SAAT LOGIN HARIAN)  */}
      {/* ================================================================== */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl animate-scale-up relative">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center mx-auto mb-3.5">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">Verifikasi PIN Keamanan Toko</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Toko: <strong className="text-emerald-300">{loginStoreName}</strong>
                {loginDetectedTenantId && (
                  <span className="text-slate-500 font-mono"> ({loginDetectedTenantId})</span>
                )}
                <br />
                Masukkan 6-digit PIN Keamanan Anda untuk membuka kasir:
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
                    inputMode="numeric"
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

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setLoginMode('wa_otp');
                    setWaLoginPhone(usernameOrEmail);
                  }}
                  className="text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                >
                  Login via WA OTP Saja
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setRecoveryTenantId(loginDetectedTenantId || selectedTenantId);
                    setRecoveryUsername(usernameOrEmail);
                    setRecoveryTab('wa_otp');
                    setRecoveryTargetType('pin');
                    setRecoveryWaStep('request');
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

      {/* ================================================================== */}
      {/* MODAL 1B: VERIFIKASI OTP WHATSAPP SAAT PENDAFTARAN TOKO BARU       */}
      {/* ================================================================== */}
      {showRegOtpModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl animate-scale-up relative">
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center mx-auto mb-3.5">
                <MessageSquare className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-white">Verifikasi Nomor WhatsApp</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {regOtpMessage || `Kode OTP 6-digit telah dikirim ke WhatsApp ${regMaskedPhone}`}
              </p>
            </div>

            {regOtpError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{regOtpError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterCompleteWithOtp} className="space-y-4">
              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={regOtpCode}
                  onChange={e => setRegOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  autoFocus
                  className="w-full py-3.5 bg-slate-950 border border-emerald-500/50 rounded-2xl text-white text-center text-2xl font-bold tracking-[14px] font-mono focus:outline-hidden focus:border-emerald-400"
                  required
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Nomor WA: <strong className="text-slate-200">{regPhone}</strong></span>
                {regOtpCountdown > 0 ? (
                  <span className="text-slate-500">Kirim ulang ({regOtpCountdown}d)</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRegisterRequestOtp(undefined, regAllowMultipleStores)}
                    className="text-emerald-400 hover:text-emerald-300 font-bold cursor-pointer"
                  >
                    Kirim Ulang OTP
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegOtpModal(false)}
                  className="py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  disabled={regOtpLoading}
                  className="py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {regOtpLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Mengaktifkan...</span>
                    </>
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

      {/* ================================================================== */}
      {/* MODAL 2: PENDAFTARAN SUKSES, INFO LOGIN & MASTER RECOVERY KEY      */}
      {/* ================================================================== */}
      {showRegisterSuccessModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl animate-scale-up relative my-auto">
            <div className="text-center mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center mx-auto mb-2.5">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-white">Toko Berhasil Didaftarkan!</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Salinan informasi login ini juga telah dikirim ke WhatsApp Anda.
              </p>
            </div>

            {/* Kartu Informasi Login Toko */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Nama Toko:</span>
                <span className="font-bold text-white">{registeredStoreName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">ID Toko (Slug):</span>
                <div className="flex items-center gap-1.5">
                  <code className="font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">{registeredTenantId}</code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(registeredTenantId);
                      setCopiedTenantId(true);
                      setTimeout(() => setCopiedTenantId(false), 2000);
                    }}
                    className="text-[10px] text-slate-400 hover:text-white cursor-pointer"
                  >
                    {copiedTenantId ? '✓' : 'Salin'}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">No. WhatsApp Login:</span>
                <span className="font-mono font-bold text-emerald-400">{registeredLoginPhone}</span>
              </div>
              {registeredUsername && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Username Alternatif:</span>
                  <span className="font-mono text-slate-200">{registeredUsername}</span>
                </div>
              )}
            </div>

            {/* Master Recovery Key */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2 mb-4">
              <div className="font-bold flex items-center gap-1.5 text-amber-300">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>Kode Pemulihan Darurat (Master Key)</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Gunakan kode ini jika sewaktu-waktu nomor WhatsApp Anda hilang/tidak aktif dan Anda lupa sandi/PIN:
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

            {registeredProvisionResult && (
              <div className={`p-3 rounded-2xl border text-xs space-y-1 mb-4 ${
                registeredProvisionResult.status === 'APPROVED'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                  : 'bg-blue-500/15 border-blue-500/40 text-blue-200'
              }`}>
                <div className="font-bold flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
                  <span>
                    {registeredProvisionResult.status === 'APPROVED'
                      ? '🎉 Jalur PPOB ipay.my.id Langsung Aktif (LIVE)!'
                      : '⏳ Permohonan PPOB Terkirim ke Bot Telegram Admin'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {registeredProvisionResult.status === 'APPROVED'
                    ? 'Akun PPOB Anda sudah disetujui dan API Key Live telah dipasang otomatis.'
                    : 'Notifikasi persetujuan telah dikirim ke Bot Telegram Admin iPay. Begitu Admin menekan TERIMA, jalur PPOB toko Anda akan aktif otomatis!'}
                </p>
              </div>
            )}

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

      {/* ================================================================== */}
      {/* MODAL 3: PUSAT PEMULIHAN AKUN (VIA WA OTP & KODE DARURAT)          */}
      {/* ================================================================== */}
      {showRecoveryModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl animate-scale-up relative my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Pusat Pemulihan Akun & PIN Toko</h3>
                  <p className="text-[11px] text-slate-400">Verifikasi aman via OTP WhatsApp Baileys atau Kode Darurat</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRecoveryModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Tab Navigasi Pemulihan */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl mb-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setRecoveryTab('wa_otp');
                  setRecoveryError(null);
                  setRecoverySuccessMsg(null);
                  setRotatedNewRecoveryKey(null);
                }}
                className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer text-[11px] ${
                  recoveryTab === 'wa_otp'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Via OTP WhatsApp (Utama)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRecoveryTab('emergency');
                  setRecoveryError(null);
                  setRecoverySuccessMsg(null);
                  setRotatedNewRecoveryKey(null);
                }}
                className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer text-[11px] ${
                  recoveryTab === 'emergency'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Kode Darurat (RCV-...)</span>
              </button>
            </div>

            {recoveryError && (
              <div className="mb-3.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{recoveryError}</span>
              </div>
            )}

            {/* Multi-store picker inside Recovery Modal */}
            {recoveryCandidateStores.length > 1 && recoveryTab === 'wa_otp' && (
              <div className="mb-3.5 p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-1.5">
                <div className="text-[11px] font-bold text-blue-300">Pilih Toko yang Ingin Dipulihkan:</div>
                {recoveryCandidateStores.map(st => (
                  <button
                    key={st.tenantId}
                    type="button"
                    onClick={() => {
                      setRecoveryTenantId(st.tenantId);
                      handleRecoverySendWaOtp(undefined, st.tenantId);
                    }}
                    className="w-full p-2 rounded-lg bg-slate-950 hover:bg-blue-600/20 border border-slate-800 text-left flex items-center justify-between text-xs cursor-pointer"
                  >
                    <span>
                      <strong className="text-white">{st.storeName}</strong>{' '}
                      <span className="text-slate-400 font-mono">({st.tenantId})</span>
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                  </button>
                ))}
              </div>
            )}

            {recoverySuccessMsg && (
              <div className="mb-3.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{recoverySuccessMsg}</span>
              </div>
            )}

            {/* ============================================================ */}
            {/* TAB PEMULIHAN 1: RESET SANDI / PIN VIA OTP WHATSAPP BAILEYS  */}
            {/* ============================================================ */}
            {recoveryTab === 'wa_otp' && (
              <div className="space-y-3.5">
                {recoveryWaStep === 'request' ? (
                  <form onSubmit={e => handleRecoverySendWaOtp(e)} className="space-y-3.5">
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-[11px] leading-relaxed">
                      📲 Masukkan <strong>Nomor WhatsApp</strong> terdaftar Anda. Bot Baileys <strong>ipay.my.id</strong> akan mengirim 6-digit Kode OTP untuk menyetel ulang Kata Sandi dan/atau PIN 6-Digit.
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-200 mb-1">
                        Nomor WhatsApp Terdaftar / Username <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400" />
                        <input
                          type="text"
                          value={recoveryUsername}
                          onChange={e => setRecoveryUsername(e.target.value)}
                          placeholder="Contoh: 081234567890"
                          className="w-full pl-10 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-hidden focus:border-emerald-500"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Nama / ID Toko (Opsional — Otomatis Terdeteksi)
                      </label>
                      <input
                        type="text"
                        value={recoveryTenantId}
                        onChange={e => setRecoveryTenantId(e.target.value)}
                        placeholder="Kosongkan agar otomatis dicari dari Nomor WA"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                      />
                    </div>

                    <div className="pt-1 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowRecoveryModal(false)}
                        className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={recoveryLoading}
                        className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer flex items-center gap-1.5"
                      >
                        {recoveryLoading ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Mengirim OTP...</span>
                          </>
                        ) : (
                          <>
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Kirim Kode OTP ke WhatsApp</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleRecoveryVerifyWaOtpSubmit} className="space-y-3">
                    {recoveryWaDetectedStore && (
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center justify-between">
                        <div>
                          <span className="text-slate-400">Toko: </span>
                          <strong className="text-emerald-300">{recoveryWaDetectedStore.storeName}</strong>{' '}
                          <span className="text-slate-500 font-mono">({recoveryWaDetectedStore.tenantId})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setRecoveryWaStep('request');
                            setRecoverySuccessMsg(null);
                          }}
                          className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                        >
                          Ubah Nomor
                        </button>
                      </div>
                    )}

                    {/* Input 6-Digit WA OTP */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-emerald-300">
                          Kode OTP WhatsApp (6 Digit) *
                        </label>
                        {recoveryCountdown > 0 ? (
                          <span className="text-[10px] text-slate-500">Kirim ulang ({recoveryCountdown}d)</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRecoverySendWaOtp(undefined, recoveryWaDetectedStore?.tenantId)}
                            className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold cursor-pointer"
                          >
                            Kirim Ulang OTP
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={recoveryWaOtp}
                        onChange={e => setRecoveryWaOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="Masukkan 6 angka OTP dari WA"
                        className="w-full px-3 py-2.5 bg-slate-950 border border-emerald-500/50 rounded-xl text-white text-center text-lg font-mono tracking-[8px] font-bold"
                        required
                      />
                    </div>

                    {/* Pilihan Apa yang Ingin Direset */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Apa yang ingin Anda atur ulang?
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: 'both', label: 'Sandi & PIN' },
                          { id: 'password', label: 'Hanya Sandi' },
                          { id: 'pin', label: 'Hanya PIN' },
                        ].map(opt => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setRecoveryTargetType(opt.id as any)}
                            className={`py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                              recoveryTargetType === opt.id
                                ? 'bg-blue-600/25 border-blue-500 text-blue-200'
                                : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Input Kata Sandi Baru */}
                    {(recoveryTargetType === 'both' || recoveryTargetType === 'password') && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">Kata Sandi Baru *</label>
                          <div className="relative">
                            <input
                              type={showRecoveryPassword ? 'text' : 'password'}
                              value={recoveryNewPassword}
                              onChange={e => setRecoveryNewPassword(e.target.value)}
                              placeholder="Min 6 karakter"
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                              required
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">Ulangi Sandi Baru *</label>
                          <div className="relative">
                            <input
                              type={showRecoveryPassword ? 'text' : 'password'}
                              value={recoveryConfirmPassword}
                              onChange={e => setRecoveryConfirmPassword(e.target.value)}
                              placeholder="Konfirmasi sandi"
                              className="w-full pl-3 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowRecoveryPassword(!showRecoveryPassword)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                            >
                              {showRecoveryPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Input PIN 6-Digit Baru */}
                    {(recoveryTargetType === 'both' || recoveryTargetType === 'pin') && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-emerald-400 mb-1">PIN 6-Digit Baru *</label>
                          <input
                            type={showRecoveryPin ? 'text' : 'password'}
                            inputMode="numeric"
                            maxLength={6}
                            value={recoveryNewPin}
                            onChange={e => setRecoveryNewPin(e.target.value.replace(/\D/g, ''))}
                            placeholder="6 angka"
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono tracking-widest font-bold"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-emerald-400 mb-1">Ulangi PIN Baru *</label>
                          <div className="relative">
                            <input
                              type={showRecoveryPin ? 'text' : 'password'}
                              inputMode="numeric"
                              maxLength={6}
                              value={recoveryConfirmPin}
                              onChange={e => setRecoveryConfirmPin(e.target.value.replace(/\D/g, ''))}
                              placeholder="Ulangi 6 angka"
                              className="w-full pl-3 pr-8 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono tracking-widest font-bold"
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowRecoveryPin(!showRecoveryPin)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                            >
                              {showRecoveryPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="pt-2 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowRecoveryModal(false)}
                        className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer"
                      >
                        Tutup
                      </button>
                      <button
                        type="submit"
                        disabled={recoveryLoading}
                        className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer"
                      >
                        {recoveryLoading ? 'Menyimpan...' : 'Verifikasi OTP & Simpan'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* TAB PEMULIHAN 2: KODE DARURAT (MASTER RECOVERY KEY)          */}
            {/* ============================================================ */}
            {recoveryTab === 'emergency' && (
              <div className="space-y-4">
                {rotatedNewRecoveryKey ? (
                  /* Tampilan Persisten Kode Pemulihan Darurat Baru (Tidak Auto-Close!) */
                  <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 space-y-3">
                    <div className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4" />
                      <span>PENTING: Simpan Kode Pemulihan Darurat Baru Anda!</span>
                    </div>
                    <p className="text-[11px] text-slate-200 leading-relaxed">
                      Kode darurat lama Anda telah dinonaktifkan demi keamanan. Berikut adalah <strong>Kode Pemulihan Darurat Baru</strong> Anda:
                    </p>
                    <div className="flex items-center justify-between bg-slate-950 px-3.5 py-2.5 rounded-xl border border-amber-500/40 text-amber-300 font-mono text-sm font-bold tracking-wider">
                      <span>{rotatedNewRecoveryKey}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(rotatedNewRecoveryKey);
                          setCopiedRotatedKey(true);
                          setTimeout(() => setCopiedRotatedKey(false), 2000);
                        }}
                        className="px-2.5 py-1 text-xs font-sans font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded-lg transition cursor-pointer flex items-center gap-1"
                      >
                        {copiedRotatedKey ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedRotatedKey ? 'Disalin!' : 'Salin'}</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setRotatedNewRecoveryKey(null);
                        setShowRecoveryModal(false);
                      }}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer transition"
                    >
                      Saya Sudah Menyimpan Kode Baru Ini — Lanjut Login
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleRecoverEmergencySubmit} className="space-y-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-[11px] leading-relaxed">
                      ⚠️ Gunakan <strong>Kode Pemulihan Darurat</strong> (format: <code>RCV-XXXX-XXXX-XXXX</code>) jika nomor WhatsApp Anda hilang/tidak aktif. Sistem otomatis mengenali toko Anda dari kode tersebut.
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-amber-300 mb-1">
                        Kode Pemulihan Darurat (Master Key) *
                      </label>
                      <input
                        type="text"
                        value={emergencyKey}
                        onChange={e => setEmergencyKey(e.target.value.toUpperCase())}
                        placeholder="RCV-XXXX-XXXX-XXXX"
                        className="w-full px-3 py-2.5 bg-slate-950 border border-amber-500/40 rounded-xl text-white text-xs font-mono tracking-wider font-bold"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        ID Toko (Opsional — Otomatis Terdeteksi dari Master Key)
                      </label>
                      <input
                        type="text"
                        value={recoveryTenantId}
                        onChange={e => setRecoveryTenantId(e.target.value)}
                        placeholder="Kosongkan agar otomatis dicari"
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">Kata Sandi Baru</label>
                        <input
                          type={showRecoveryPassword ? 'text' : 'password'}
                          value={recoveryNewPassword}
                          onChange={e => setRecoveryNewPassword(e.target.value)}
                          placeholder="Min 6 karakter"
                          className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">Konfirmasi Sandi Baru</label>
                        <div className="relative">
                          <input
                            type={showRecoveryPassword ? 'text' : 'password'}
                            value={recoveryConfirmPassword}
                            onChange={e => setRecoveryConfirmPassword(e.target.value)}
                            placeholder="Ulangi sandi"
                            className="w-full pl-3 pr-8 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => setShowRecoveryPassword(!showRecoveryPassword)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                          >
                            {showRecoveryPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-emerald-400 mb-1">PIN Baru 6-Digit</label>
                        <input
                          type={showRecoveryPin ? 'text' : 'password'}
                          inputMode="numeric"
                          maxLength={6}
                          value={recoveryNewPin}
                          onChange={e => setRecoveryNewPin(e.target.value.replace(/\D/g, ''))}
                          placeholder="6 digit angka"
                          className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono tracking-widest"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-emerald-400 mb-1">Konfirmasi PIN Baru</label>
                        <div className="relative">
                          <input
                            type={showRecoveryPin ? 'text' : 'password'}
                            inputMode="numeric"
                            maxLength={6}
                            value={recoveryConfirmPin}
                            onChange={e => setRecoveryConfirmPin(e.target.value.replace(/\D/g, ''))}
                            placeholder="Ulangi 6 angka"
                            className="w-full pl-3 pr-8 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-mono tracking-widest"
                          />
                          <button
                            type="button"
                            onClick={() => setShowRecoveryPin(!showRecoveryPin)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                          >
                            {showRecoveryPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="pt-1 flex justify-end">
                      <button
                        type="submit"
                        disabled={recoveryLoading}
                        className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-xs cursor-pointer"
                      >
                        {recoveryLoading ? 'Memulihkan Akun...' : 'Pulihkan Akun dengan Kode Darurat'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Production Footer */}
      <footer className="w-full text-center py-4 border-t border-slate-900 text-[11px] text-slate-400 bg-slate-950/60 backdrop-blur-xs relative z-10">
        &copy; 2026 POS iPay Hybrid System. Dilindungi oleh Enkripsi Token Bearer, 2FA PIN &amp; OTP WhatsApp Baileys ipay.my.id.
      </footer>
    </div>
  );
};
