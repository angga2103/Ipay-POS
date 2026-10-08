import React, { useState, useEffect } from 'react';
import { 
  Clock, DollarSign, CheckCircle2, AlertTriangle, FileText, 
  ArrowDownLeft, ArrowUpRight, Lock, Printer, RefreshCw 
} from 'lucide-react';
import { useShift } from '../context/ShiftContext';
import { useAuth } from '../context/AuthContext';

export const ShiftManagementPage: React.FC = () => {
  const { activeShift, openShift, closeShift, refreshShift } = useShift();
  const { currentUser, users } = useAuth();

  const [openingCashInput, setOpeningCashInput] = useState<number>(200000);
  const [actualCashInput, setActualCashInput] = useState<number>(0);
  const [closingNotes, setClosingNotes] = useState<string>('');

  // Open Shift Form State
  const [selectedCashierId, setSelectedCashierId] = useState<number>(currentUser?.id || 1);
  const [pinInput, setPinInput] = useState<string>('');
  const [openShiftError, setOpenShiftError] = useState<string>('');
  const [openingShiftLoading, setOpeningShiftLoading] = useState<boolean>(false);

  const [xReportData, setXReportData] = useState<any | null>(null);
  const [zReportData, setZReportData] = useState<any | null>(null);
  const [showCloseModal, setShowCloseModal] = useState<boolean>(false);
  const [showOpenModal, setShowOpenModal] = useState<boolean>(false);
  const [shiftHistory, setShiftHistory] = useState<any[]>([]);

  useEffect(() => {
    if (currentUser?.id) {
      setSelectedCashierId(currentUser.id);
    }
  }, [currentUser]);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/shifts/history');
      const data = await res.json();
      setShiftHistory(data);
    } catch (err) {
      console.error('Failed to load shift history:', err);
    }
  };

  const fetchXReport = async () => {
    if (!activeShift) return;
    try {
      const res = await fetch(`/api/shifts/${activeShift.id}/x-report`);
      const data = await res.json();
      setXReportData(data);
    } catch (err) {
      console.error('Failed to fetch X-report:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
    if (activeShift) {
      fetchXReport();
    }
  }, [activeShift]);

  const handleOpenShift = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pinInput) {
      setOpenShiftError('PIN operator wajib diisi');
      return;
    }
    setOpeningShiftLoading(true);
    setOpenShiftError('');
    try {
      await openShift(openingCashInput, selectedCashierId, pinInput);
      setShowOpenModal(false);
      setPinInput('');
      setOpenShiftError('');
      fetchHistory();
    } catch (err: any) {
      setOpenShiftError(err.message || 'Gagal membuka shift');
    } finally {
      setOpeningShiftLoading(false);
    }
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;
    try {
      const zReport = await closeShift(actualCashInput, closingNotes);
      setZReportData(zReport);
      setShowCloseModal(false);
      fetchHistory();
    } catch (err: any) {
      alert(err.message || 'Gagal menutup shift');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-57px)] overflow-y-auto bg-slate-100 p-4 space-y-4">
      {/* Title */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-slate-800">
            Manajemen Shift Kasir & Rekonsiliasi Kas
          </h1>
          <p className="text-xs text-slate-500">
            Pembukaan kasir, pencatatan mutasi laci, X-Report berjalan, dan penutupan Z-Report
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeShift ? (
            <button
              onClick={() => {
                fetchXReport();
                setActualCashInput(xReportData?.expectedCashInDrawer || activeShift.expected_cash);
                setShowCloseModal(true);
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Tutup Shift & Z-Report</span>
            </button>
          ) : (
            <button
              onClick={() => setShowOpenModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Clock className="w-4 h-4" />
              <span>Buka Shift Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Shift Dashboard Card */}
      {activeShift ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <div>
                <h2 className="font-extrabold text-sm text-slate-800">
                  Shift Aktif: {activeShift.shift_number}
                </h2>
                <p className="text-xs text-slate-500">
                  Dibuka pada {new Date(activeShift.opened_at).toLocaleString('id-ID')} oleh {activeShift.cashier_name}
                </p>
              </div>
            </div>

            <button
              onClick={fetchXReport}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Update X-Report</span>
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-semibold text-slate-500">Modal Awal Laci</span>
              <div className="text-lg font-black font-mono text-slate-900 mt-1">
                Rp {activeShift.opening_cash.toLocaleString('id-ID')}
              </div>
            </div>

            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl">
              <span className="text-[11px] font-semibold text-blue-700">Penjualan Ritel Fisik</span>
              <div className="text-lg font-black font-mono text-blue-900 mt-1">
                Rp {(xReportData?.ordersSummary?.retail_sales || 0).toLocaleString('id-ID')}
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
              <span className="text-[11px] font-semibold text-amber-700">Penjualan Digital PPOB</span>
              <div className="text-lg font-black font-mono text-amber-900 mt-1">
                Rp {(xReportData?.ordersSummary?.ppob_sales || 0).toLocaleString('id-ID')}
              </div>
            </div>

            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-[11px] font-semibold text-emerald-800">Ekspektasi Uang Tunai di Laci</span>
              <div className="text-lg font-black font-mono text-emerald-950 mt-1">
                Rp {(xReportData?.expectedCashInDrawer || activeShift.expected_cash).toLocaleString('id-ID')}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center text-amber-900 space-y-2">
          <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto" />
          <h3 className="font-extrabold text-base">Tidak Ada Shift Kasir yang Sedang Berjalan</h3>
          <p className="text-xs text-amber-700 max-w-md mx-auto">
            Silakan buka shift terlebih dahulu dengan memasukkan nominal modal awal uang kembalian sebelum memulai transaksi di meja kasir.
          </p>
          <button
            onClick={() => setShowOpenModal(true)}
            className="mt-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
          >
            Buka Shift Sekarang
          </button>
        </div>
      )}

      {/* Shift History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
        <h2 className="font-extrabold text-sm text-slate-800 pb-2 border-b border-slate-100">
          Riwayat Shift Kasir (Z-Reports)
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10.5px] font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">No. Shift</th>
                <th className="py-2.5 px-3">Kasir</th>
                <th className="py-2.5 px-3">Buka</th>
                <th className="py-2.5 px-3">Tutup</th>
                <th className="py-2.5 px-3 text-right">Modal Awal</th>
                <th className="py-2.5 px-3 text-right">Omzet Ritel</th>
                <th className="py-2.5 px-3 text-right">Omzet PPOB</th>
                <th className="py-2.5 px-3 text-right">Kas Dihitung</th>
                <th className="py-2.5 px-3 text-center">Selisih</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shiftHistory.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="py-3 px-3 font-mono font-bold text-slate-800">{s.shift_number}</td>
                  <td className="py-3 px-3 text-slate-700">{s.cashier_name}</td>
                  <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                    {new Date(s.opened_at).toLocaleTimeString('id-ID')}
                  </td>
                  <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                    {s.closed_at ? new Date(s.closed_at).toLocaleTimeString('id-ID') : '-'}
                  </td>
                  <td className="py-3 px-3 text-right font-mono">Rp {s.opening_cash.toLocaleString('id-ID')}</td>
                  <td className="py-3 px-3 text-right font-mono">Rp {s.total_retail_sales.toLocaleString('id-ID')}</td>
                  <td className="py-3 px-3 text-right font-mono text-amber-700 font-semibold">
                    Rp {s.total_ppob_sales.toLocaleString('id-ID')}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold">
                    {s.closing_cash_actual !== null ? `Rp ${s.closing_cash_actual.toLocaleString('id-ID')}` : '-'}
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold">
                    {s.status === 'CLOSED' ? (
                      <span className={s.discrepancy < 0 ? 'text-rose-600' : s.discrepancy > 0 ? 'text-emerald-600' : 'text-slate-400'}>
                        {s.discrepancy === 0 ? 'Pas' : `Rp ${s.discrepancy.toLocaleString('id-ID')}`}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      s.status === 'OPEN' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Buka Shift dengan Pilihan Operator & Verifikasi PIN */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-800">
                    Buka Sesi Shift Kasir Baru
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pilih operator yang bertugas & masukkan PIN otorisasi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowOpenModal(false);
                  setOpenShiftError('');
                  setPinInput('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            {openShiftError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{openShiftError}</span>
              </div>
            )}

            <form onSubmit={handleOpenShift} className="space-y-4">
              {/* Pilihan Operator Kasir */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Pilih Operator Kasir yang Membuka Shift:
                </label>
                <select
                  value={selectedCashierId}
                  onChange={e => {
                    setSelectedCashierId(parseInt(e.target.value, 10));
                    setOpenShiftError('');
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-bold text-xs text-slate-800 focus:outline-emerald-500 cursor-pointer"
                >
                  {(users && users.length > 0 ? users.filter(u => u.is_active !== 0) : (currentUser ? [currentUser] : [])).map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.role === 'owner' ? 'Owner / Pemilik' : u.role === 'supervisor' ? 'Supervisor' : 'Kasir'} (@{u.username})
                    </option>
                  ))}
                </select>
                <span className="text-[10.5px] text-slate-500 mt-1 block">
                  Sesi shift kasir dan pembukuan uang laci akan terdaftar atas nama operator ini.
                </span>
              </div>

              {/* PIN Akun Operator */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>PIN Operator (6 Digit) <span className="text-rose-500">*</span></span>
                  <span className="text-[10.5px] font-normal text-slate-400">PIN Akun Operator</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    maxLength={6}
                    autoFocus
                    placeholder="••••••"
                    value={pinInput}
                    onChange={e => {
                      setPinInput(e.target.value.replace(/\D/g, ''));
                      setOpenShiftError('');
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono text-center text-lg tracking-widest font-bold text-slate-900 focus:outline-emerald-500"
                    required
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                </div>
                <span className="text-[10.5px] text-slate-500 mt-1 block">
                  Wajib memasukkan PIN akun operator untuk mengonfirmasi pembukaan shift.
                </span>
              </div>

              {/* Modal Awal Uang Kembalian */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Modal Awal Uang Kembalian (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  step="10000"
                  value={openingCashInput}
                  onChange={e => setOpeningCashInput(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono text-base font-bold text-slate-900 focus:outline-emerald-500"
                />
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {[100000, 200000, 500000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setOpeningCashInput(amt)}
                      className={`py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                        openingCashInput === amt
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Rp {amt.toLocaleString('id-ID')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowOpenModal(false);
                    setOpenShiftError('');
                    setPinInput('');
                  }}
                  className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={openingShiftLoading || !pinInput}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {openingShiftLoading ? (
                    <span>Memverifikasi PIN...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verifikasi & Buka Shift</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tutup Shift & Z-Report */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4">
            <h3 className="font-extrabold text-sm text-slate-800">
              Penutupan Shift Kasir & Rekonsiliasi (Z-Report)
            </h3>
            <p className="text-xs text-slate-500">
              Hitung uang fisik di laci kasir dan masukkan ke kolom di bawah. Sistem akan mencatat selisih secara otomatis ke buku besar.
            </p>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span>Ekspektasi Kas Laci:</span>
                <span className="font-bold font-mono">
                  Rp {(xReportData?.expectedCashInDrawer || activeShift?.expected_cash || 0).toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Jumlah Uang Fisik Hasil Hitung (Rp)
              </label>
              <input
                type="number"
                autoFocus
                value={actualCashInput || ''}
                onChange={e => setActualCashInput(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-xl font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Catatan Penutupan Kasir (Opsional)
              </label>
              <input
                type="text"
                value={closingNotes}
                onChange={e => setClosingNotes(e.target.value)}
                placeholder="Catatan kendala shift..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-700"
              >
                Batal
              </button>
              <button
                onClick={handleCloseShift}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Kunci & Terbitkan Z-Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
