import React, { useState, useEffect } from 'react';
import { 
  Store, Printer, Save, Database, Download, RefreshCw, 
  Trash2, ShieldCheck, Clock, HardDrive, AlertTriangle, CheckCircle2, RotateCcw,
  Users, UserPlus, KeyRound, Edit, Lock, Shield, Check, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { User, UserRole } from '../types';

interface BackupItem {
  filename: string;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
}

interface BackupSettings {
  autoBackupEnabled: boolean;
  frequency: 'hourly' | 'every_6_hours' | 'every_12_hours' | 'daily' | 'weekly';
  retentionDays: number;
  lastBackupAt: string | null;
}

interface OperatorItem {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  is_active: number;
  created_at: string;
  has_pin: number;
}

export const SettingsPage: React.FC = () => {
  const { currentUser, refreshUsers } = useAuth();
  const [activeTab, setActiveTab] = useState<'store' | 'operators' | 'backup'>('store');

  // Store profile & hardware
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeFooter, setStoreFooter] = useState('');
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('58mm');
  const [autoOpenDrawer, setAutoOpenDrawer] = useState('true');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Backup state
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [backupSettings, setBackupSettings] = useState<BackupSettings>({
    autoBackupEnabled: true,
    frequency: 'daily',
    retentionDays: 14,
    lastBackupAt: null,
  });
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupMsg, setBackupMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Operators state (RBAC)
  const [operators, setOperators] = useState<OperatorItem[]>([]);
  const [loadingOperators, setLoadingOperators] = useState(false);
  const [operatorModalOpen, setOperatorModalOpen] = useState(false);
  const [editingOperator, setEditingOperator] = useState<OperatorItem | null>(null);
  const [operatorForm, setOperatorForm] = useState({
    username: '',
    name: '',
    role: 'cashier' as UserRole,
    password: '',
    pin: '',
    is_active: 1,
  });
  const [operatorFormError, setOperatorFormError] = useState('');
  const [submittingOperator, setSubmittingOperator] = useState(false);
  const [operatorAlert, setOperatorAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSettings = () => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setStoreName(data.store_name || '');
        setStoreAddress(data.store_address || '');
        setStorePhone(data.store_phone || '');
        setStoreFooter(data.store_footer_msg || '');
        setPaperWidth(data.printer_paper_width || '58mm');
        setAutoOpenDrawer(data.auto_open_drawer || 'true');
      });

    fetch('/api/backup/settings')
      .then(res => res.json())
      .then(data => {
        if (data) setBackupSettings(data);
      });

    fetchBackups();
    fetchOperators();
  };

  const fetchBackups = () => {
    fetch('/api/backup/list')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setBackups(data);
      });
  };

  const fetchOperators = async () => {
    setLoadingOperators(true);
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (Array.isArray(data)) setOperators(data);
    } catch (err) {
      console.error('Failed to load operators:', err);
    } finally {
      setLoadingOperators(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_name: storeName,
          store_address: storeAddress,
          store_phone: storePhone,
          store_footer_msg: storeFooter,
          printer_paper_width: paperWidth,
          auto_open_drawer: autoOpenDrawer,
        }),
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveBackupSettings = async (newSettings: Partial<BackupSettings>) => {
    const updated = { ...backupSettings, ...newSettings };
    setBackupSettings(updated);
    try {
      await fetch('/api/backup/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      setBackupMsg({ type: 'success', text: 'Pengaturan auto backup berhasil diperbarui' });
      setTimeout(() => setBackupMsg(null), 3000);
    } catch (err) {
      setBackupMsg({ type: 'error', text: 'Gagal memperbarui pengaturan backup' });
    }
  };

  const handleCreateBackupNow = async () => {
    setIsCreatingBackup(true);
    setBackupMsg(null);
    try {
      const res = await fetch('/api/backup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'manual_ui' }),
      });
      const data = await res.json();
      if (data.success) {
        setBackupMsg({ type: 'success', text: `Backup database '${data.backup.filename}' berhasil dibuat!` });
        fetchBackups();
        fetchSettings();
      } else {
        setBackupMsg({ type: 'error', text: data.error || 'Gagal membuat backup' });
      }
    } catch (err: any) {
      setBackupMsg({ type: 'error', text: err.message });
    } finally {
      setIsCreatingBackup(false);
      setTimeout(() => setBackupMsg(null), 4000);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!window.confirm(`Hapus file snapshot backup '${filename}'?`)) return;
    try {
      await fetch(`/api/backup/${filename}`, { method: 'DELETE' });
      fetchBackups();
      setBackupMsg({ type: 'success', text: `File backup ${filename} berhasil dihapus.` });
      setTimeout(() => setBackupMsg(null), 3000);
    } catch {
      setBackupMsg({ type: 'error', text: 'Gagal menghapus file backup.' });
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    const confirmRestore = window.prompt(
      `PERINGATAN: Memulihkan database akan menimpa data transaksi saat ini dengan isi file '${filename}'.\n\nKetik 'PULIHKAN' untuk melanjutkan:`
    );
    if (confirmRestore !== 'PULIHKAN') return;

    try {
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Pemulihan database berhasil! Aplikasi akan disegarkan.');
        window.location.reload();
      } else {
        alert(data.error || 'Gagal memulihkan database.');
      }
    } catch (err: any) {
      alert('Error saat proses restore: ' + err.message);
    }
  };

  // --- Operator Management Handlers ---
  const handleOpenAddOperator = () => {
    setEditingOperator(null);
    setOperatorForm({
      username: '',
      name: '',
      role: 'cashier',
      password: '',
      pin: '',
      is_active: 1,
    });
    setOperatorFormError('');
    setOperatorModalOpen(true);
  };

  const handleOpenEditOperator = (op: OperatorItem) => {
    setEditingOperator(op);
    setOperatorForm({
      username: op.username,
      name: op.name,
      role: op.role,
      password: '',
      pin: '',
      is_active: op.is_active ?? 1,
    });
    setOperatorFormError('');
    setOperatorModalOpen(true);
  };

  const handleSaveOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorForm.name.trim()) {
      setOperatorFormError('Nama operator wajib diisi');
      return;
    }
    if (!editingOperator && !operatorForm.username.trim()) {
      setOperatorFormError('Username wajib diisi');
      return;
    }
    if (!editingOperator && !operatorForm.password.trim()) {
      setOperatorFormError('Password wajib diisi untuk operator baru');
      return;
    }

    setSubmittingOperator(true);
    setOperatorFormError('');

    try {
      if (editingOperator) {
        // Edit existing operator
        const payload: any = {
          name: operatorForm.name.trim(),
          role: operatorForm.role,
          is_active: operatorForm.is_active,
        };
        if (operatorForm.password.trim()) payload.password = operatorForm.password.trim();
        if (operatorForm.pin.trim()) payload.pin = operatorForm.pin.trim();

        const res = await fetch(`/api/users/${editingOperator.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memperbarui operator');

        setOperatorAlert({ type: 'success', text: `Operator ${operatorForm.name} berhasil diperbarui!` });
      } else {
        // Create new operator
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: operatorForm.username.trim(),
            name: operatorForm.name.trim(),
            role: operatorForm.role,
            password: operatorForm.password.trim(),
            pin: operatorForm.pin.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal mendaftarkan operator');

        setOperatorAlert({ type: 'success', text: `Operator baru ${operatorForm.name} berhasil dibuat!` });
      }

      setOperatorModalOpen(false);
      fetchOperators();
      refreshUsers();
      setTimeout(() => setOperatorAlert(null), 3000);
    } catch (err: any) {
      setOperatorFormError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setSubmittingOperator(false);
    }
  };

  const handleDeleteOperator = async (op: OperatorItem) => {
    if (op.id === currentUser?.id) {
      alert('Anda tidak dapat menghapus akun operator yang sedang Anda gunakan saat ini.');
      return;
    }
    if (!window.confirm(`Hapus akun operator '${op.name}' (@${op.username})?`)) return;

    try {
      const res = await fetch(`/api/users/${op.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus operator');

      setOperatorAlert({ type: 'success', text: `Operator ${op.name} berhasil dihapus.` });
      fetchOperators();
      refreshUsers();
      setTimeout(() => setOperatorAlert(null), 3000);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-57px)] overflow-y-auto bg-slate-100 p-4 space-y-4">
      {/* Title */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-slate-800">
            Pengaturan Sistem & Hak Akses
          </h1>
          <p className="text-xs text-slate-500">
            Konfigurasi toko, printer termal, akun operator (RBAC), dan backup otomatis
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('store')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'store' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Profil & Hardware</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('operators')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'operators' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Kelola Operator (RBAC)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'backup' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Auto-Backup</span>
          </button>
        </div>
      </div>

      {/* TAB 1: STORE & HARDWARE */}
      {activeTab === 'store' && (
        <form onSubmit={handleSaveStore} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Store Profile */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Store className="w-4 h-4 text-blue-600" />
              <h2 className="font-extrabold text-sm text-slate-800">Profil Minimarket</h2>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nama Toko</label>
              <input
                type="text"
                value={storeName}
                onChange={e => setStoreName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Alamat Toko</label>
              <input
                type="text"
                value={storeAddress}
                onChange={e => setStoreAddress(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nomor Telepon / WA</label>
              <input
                type="text"
                value={storePhone}
                onChange={e => setStorePhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Kaki Struk (Footer)</label>
              <textarea
                rows={2}
                value={storeFooter}
                onChange={e => setStoreFooter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>
          </div>

          {/* Hardware & Printer Settings */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Printer className="w-4 h-4 text-emerald-600" />
              <h2 className="font-extrabold text-sm text-slate-800">Thermal Printer & Hardware</h2>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Lebar Kertas Struk</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaperWidth('58mm')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    paperWidth === '58mm' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-xs' : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  58 mm (Standar Kasir Portable)
                </button>
                <button
                  type="button"
                  onClick={() => setPaperWidth('80mm')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    paperWidth === '80mm' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-xs' : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  80 mm (Format Lebar Minimarket)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Laci Kasir RJ11 (Cash Drawer)</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAutoOpenDrawer('true')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    autoOpenDrawer === 'true' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs' : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  Otomatis Tendang Laci saat Bayar
                </button>
                <button
                  type="button"
                  onClick={() => setAutoOpenDrawer('false')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    autoOpenDrawer === 'false' ? 'bg-slate-100 border-slate-400 text-slate-800 shadow-xs' : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  Manual (Hanya jika ditekan)
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              {savedSuccess ? (
                <span className="text-xs font-bold text-emerald-600">Profil & printer berhasil disimpan!</span>
              ) : <span />}

              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Pengaturan</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: OPERATOR MANAGEMENT (RBAC) */}
      {activeTab === 'operators' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-600" />
                <h2 className="font-extrabold text-sm text-slate-800">
                  Manajemen Akun Operator & Level Hak Akses (RBAC)
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Admin dapat mendaftarkan operator, mengatur tingkatan role (Owner, Supervisor, Kasir), dan menetapkan PIN/Password keamanan
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenAddOperator}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
            >
              <UserPlus className="w-4 h-4" />
              <span>Tambah Operator Baru</span>
            </button>
          </div>

          {operatorAlert && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              operatorAlert.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{operatorAlert.text}</span>
            </div>
          )}

          {/* Operators Table */}
          <div className="border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10.5px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Nama Operator</th>
                  <th className="py-2.5 px-3">Username</th>
                  <th className="py-2.5 px-3">Level Hak Akses (Role)</th>
                  <th className="py-2.5 px-3">Keamanan PIN</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {operators.map(op => (
                  <tr key={op.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-800 flex items-center gap-2">
                        <span>{op.name}</span>
                        {op.id === currentUser?.id && (
                          <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-blue-100 text-blue-700">
                            Anda
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-600">
                      @{op.username}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                        op.role === 'owner'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : op.role === 'supervisor'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {op.role === 'owner' ? '👑 Owner (Akses Penuh)' : op.role === 'supervisor' ? '🛡️ Supervisor' : '🛒 Kasir Toko'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {op.has_pin ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <KeyRound className="w-3 h-3" />
                          <span>PIN Aktif</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Belum diatur</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        op.is_active !== 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {op.is_active !== 0 ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditOperator(op)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          <Edit className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        {op.id !== currentUser?.id && (
                          <button
                            type="button"
                            onClick={() => handleDeleteOperator(op)}
                            className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title="Hapus Operator"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: AUTO BACKUP */}
      {activeTab === 'backup' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600" />
              <h2 className="font-extrabold text-sm text-slate-800">
                Sistem Auto-Backup & Snapshot Database Dinamis
              </h2>
            </div>
            <button
              type="button"
              disabled={isCreatingBackup}
              onClick={handleCreateBackupNow}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCreatingBackup ? 'animate-spin' : ''}`} />
              <span>{isCreatingBackup ? 'Mencadangkan...' : 'Cadangkan Sekarang'}</span>
            </button>
          </div>

          {backupMsg && (
            <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
              backupMsg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              {backupMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span>{backupMsg.text}</span>
            </div>
          )}

          {/* Backup Configurations Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Jadwal Pencadangan</label>
              <select
                value={backupSettings.frequency}
                onChange={e => handleSaveBackupSettings({ frequency: e.target.value as any })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white cursor-pointer"
              >
                <option value="hourly">Setiap 1 Jam</option>
                <option value="every_6_hours">Setiap 6 Jam</option>
                <option value="every_12_hours">Setiap 12 Jam</option>
                <option value="daily">Setiap Hari (Rekomendasi)</option>
                <option value="weekly">Setiap Minggu</option>
              </select>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Masa Retensi File</label>
              <select
                value={backupSettings.retentionDays}
                onChange={e => handleSaveBackupSettings({ retentionDays: parseInt(e.target.value, 10) })}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white cursor-pointer"
              >
                <option value={7}>Simpan 7 Hari Terakhir</option>
                <option value={14}>Simpan 14 Hari Terakhir</option>
                <option value={30}>Simpan 30 Hari Terakhir</option>
                <option value={60}>Simpan 60 Hari Terakhir</option>
              </select>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Status Scheduler</label>
              <div className="flex items-center gap-2 pt-1">
                <span className={`w-2.5 h-2.5 rounded-full ${backupSettings.autoBackupEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                <span className="text-xs font-bold text-slate-800">
                  {backupSettings.autoBackupEnabled ? 'Aktif (Berjalan di Latar)' : 'Nonaktif'}
                </span>
              </div>
            </div>
          </div>

          {/* Backup Files Table */}
          <div className="pt-2">
            <h3 className="font-extrabold text-xs text-slate-700 mb-2">
              Daftar Berkas Snapshot Cadangan ({backups.length} File)
            </h3>
            {backups.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                Belum ada snapshot backup tersimpan. Klik "Cadangkan Sekarang" untuk membuat cadangan pertama.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10.5px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Nama Berkas Snapshot</th>
                      <th className="py-2.5 px-3">Waktu Pencadangan</th>
                      <th className="py-2.5 px-3">Ukuran</th>
                      <th className="py-2.5 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {backups.map(item => (
                      <tr key={item.filename} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800 text-[11px]">
                          {item.filename}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                          {new Date(item.createdAt).toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-indigo-700 text-[11px]">
                          {item.sizeFormatted}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <a
                              href={`/api/backup/download/${item.filename}`}
                              download={item.filename}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] flex items-center gap-1 transition"
                              title="Unduh ke komputer lokal"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Unduh</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => handleRestoreBackup(item.filename)}
                              className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                              title="Pulihkan database dari snapshot ini"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Pulihkan</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBackup(item.filename)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition cursor-pointer"
                              title="Hapus backup"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL TAMBAH / EDIT OPERATOR */}
      {operatorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-sm text-slate-800">
                  {editingOperator ? 'Edit Data Operator' : 'Tambah Operator Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOperatorModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOperator} className="p-5 space-y-3.5">
              {operatorFormError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{operatorFormError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap Operator *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Prasetyo"
                  value={operatorForm.name}
                  onChange={e => setOperatorForm({ ...operatorForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Username (Untuk Login) *
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingOperator)}
                  placeholder="Contoh: budi"
                  value={operatorForm.username}
                  onChange={e => setOperatorForm({ ...operatorForm, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Level Hak Akses (Role RBAC) *
                </label>
                <select
                  value={operatorForm.role}
                  onChange={e => setOperatorForm({ ...operatorForm, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white cursor-pointer"
                >
                  <option value="cashier">🛒 Kasir Toko (Hanya Transaksi Kasir, Servis & Cek Stok)</option>
                  <option value="supervisor">🛡️ Supervisor (Kasir, Buka/Tutup Shift, Retur, Pengeluaran & Stok)</option>
                  <option value="owner">👑 Owner Toko (Akses Penuh: Pengaturan, Laporan P&L, Operator)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {editingOperator ? 'Password Baru (Opsional)' : 'Password Akun *'}
                  </label>
                  <input
                    type="password"
                    placeholder={editingOperator ? 'Kosongkan jika tak diubah' : 'Min. 4 karakter'}
                    value={operatorForm.password}
                    onChange={e => setOperatorForm({ ...operatorForm, password: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    PIN Cepat Masuk (6 Angka)
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="Contoh: 123456"
                    value={operatorForm.pin}
                    onChange={e => setOperatorForm({ ...operatorForm, pin: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono text-center tracking-widest font-bold"
                  />
                </div>
              </div>

              {editingOperator && (
                <div className="pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={operatorForm.is_active === 1}
                      onChange={e => setOperatorForm({ ...operatorForm, is_active: e.target.checked ? 1 : 0 })}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    <span>Akun Operator Aktif</span>
                  </label>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOperatorModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingOperator}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
                >
                  {submittingOperator ? 'Menyimpan...' : 'Simpan Operator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
