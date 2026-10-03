import React, { useState, useEffect } from 'react';
import { 
  Store, Printer, Save, Database, Download, RefreshCw, 
  Trash2, ShieldCheck, Clock, HardDrive, AlertTriangle, CheckCircle2, RotateCcw
} from 'lucide-react';

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

export const SettingsPage: React.FC = () => {
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
  };

  const fetchBackups = () => {
    fetch('/api/backup/list')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setBackups(data);
      });
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
        alert('Database berhasil dipulihkan! Halaman akan dimuat ulang untuk menyegarkan data.');
        window.location.reload();
      } else {
        alert('Gagal memulihkan database: ' + data.error);
      }
    } catch (err: any) {
      alert('Error saat proses restore: ' + err.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-57px)] overflow-y-auto bg-slate-100 p-4 space-y-4">
      {/* Title */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-slate-800">
            Pengaturan Toko, Perangkat Keras & Auto-Backup
          </h1>
          <p className="text-xs text-slate-500">
            Konfigurasi profil minimarket, printer termal, laci kasir RJ11, dan sistem auto-backup database dinamis
          </p>
        </div>
      </div>

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
              <span>Simpan Profil & Printer</span>
            </button>
          </div>
        </div>
      </form>

      {/* ============================================================ */}
      {/* SISTEM DINAMIS AUTO-BACKUP & DATABASE RESTORATION */}
      {/* ============================================================ */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-sm text-slate-800 flex items-center gap-2">
                Sistem Dinamis Auto-Backup & Pemulihan Database
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-700">
                  SQLite Safe WAL Backup
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Pencadangan berkala non-blocking, rotasi otomatis, unduh arsip langsung, dan pemulihan darurat 1-klik
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreateBackupNow}
            disabled={isCreatingBackup}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isCreatingBackup ? 'animate-spin' : ''}`} />
            <span>{isCreatingBackup ? 'Membuat Snapshot...' : 'Backup Database Sekarang (1-Klik)'}</span>
          </button>
        </div>

        {backupMsg && (
          <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
            backupMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {backupMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
            <span>{backupMsg.text}</span>
          </div>
        )}

        {/* Dynamic Auto-Backup Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
              Status Auto-Backup
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleSaveBackupSettings({ autoBackupEnabled: true })}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  backupSettings.autoBackupEnabled ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 text-slate-600'
                }`}
              >
                Aktif
              </button>
              <button
                type="button"
                onClick={() => handleSaveBackupSettings({ autoBackupEnabled: false })}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  !backupSettings.autoBackupEnabled ? 'bg-slate-700 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-600'
                }`}
              >
                Mati
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              Frekuensi Pencadangan
            </label>
            <select
              value={backupSettings.frequency}
              onChange={e => handleSaveBackupSettings({ frequency: e.target.value as any })}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-800"
            >
              <option value="hourly">Setiap 1 Jam</option>
              <option value="every_6_hours">Setiap 6 Jam</option>
              <option value="every_12_hours">Setiap 12 Jam</option>
              <option value="daily">Harian (Setiap 24 Jam)</option>
              <option value="weekly">Mingguan (Setiap 7 Hari)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-indigo-600" />
              Retensi Rotasi File
            </label>
            <select
              value={backupSettings.retentionDays}
              onChange={e => handleSaveBackupSettings({ retentionDays: parseInt(e.target.value, 10) })}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white text-slate-800"
            >
              <option value="7">Simpan 7 Hari Terakhir</option>
              <option value="14">Simpan 14 Hari Terakhir</option>
              <option value="30">Simpan 30 Hari Terakhir</option>
              <option value="60">Simpan 60 Hari Terakhir</option>
            </select>
          </div>
        </div>

        {/* Backups List Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Daftar Arsip Snapshot Database ({backups.length} file)
            </h3>
            {backupSettings.lastBackupAt && (
              <span className="text-[11px] text-slate-500">
                Terakhir dicadangkan: <strong className="text-slate-700">{new Date(backupSettings.lastBackupAt).toLocaleString('id-ID')}</strong>
              </span>
            )}
          </div>

          {backups.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-slate-300 rounded-2xl bg-slate-50 text-slate-500 text-xs">
              Belum ada file backup database. Klik tombol "Backup Database Sekarang" di atas untuk membuat snapshot pertama.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold">
                  <tr>
                    <th className="py-2.5 px-3">Nama File Snapshot</th>
                    <th className="py-2.5 px-3">Waktu Pembuatan</th>
                    <th className="py-2.5 px-3">Ukuran File</th>
                    <th className="py-2.5 px-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {backups.map(item => (
                    <tr key={item.filename} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800 text-[11px]">
                        {item.filename}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px]">
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
    </div>
  );
};
