import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Search, DollarSign, AlertCircle, 
  CheckCircle2, Clock, CreditCard, ChevronRight, Edit3, 
  Trash2, Receipt, X, ArrowRight, Printer, AlertTriangle, 
  Phone, MapPin, ShieldAlert, Check, RefreshCw
} from 'lucide-react';
import { Customer, CustomerDebtPayment } from '../types';
import { useAuth } from '../context/AuthContext';
import { useShift } from '../context/ShiftContext';

export const CustomerPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { activeShift } = useShift();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'WITH_DEBT' | 'CLEAR'>('ALL');
  const [loading, setLoading] = useState(false);

  // Add / Edit Customer Modal
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    phone: '',
    address: '',
    credit_limit: '',
  });

  // Debt Payment Modal
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedCustomerForPay, setSelectedCustomerForPay] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'QRIS'>('CASH');
  const [payNotes, setPayNotes] = useState<string>('');
  const [isProcessingPay, setIsProcessingPay] = useState(false);
  const [payError, setPayError] = useState<string>('');

  // Thermal Receipt Modal
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptText, setReceiptText] = useState<string>('');

  // Detail / History Modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers();
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Financial Stats
  const totalDebtAll = customers.reduce((sum, c) => sum + (c.current_debt || 0), 0);
  const customersWithDebtCount = customers.filter(c => c.current_debt > 0).length;
  const customersClearCount = customers.filter(c => c.current_debt === 0).length;

  // Filtered List
  const filteredCustomers = customers.filter(c => {
    if (filterTab === 'WITH_DEBT') return c.current_debt > 0;
    if (filterTab === 'CLEAR') return c.current_debt === 0;
    return true;
  });

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setCustomerForm({
      name: '',
      phone: '',
      address: '',
      credit_limit: '500000',
    });
    setIsCustomerModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setCustomerForm({
      name: c.name,
      phone: c.phone || '',
      address: c.address || '',
      credit_limit: String(c.credit_limit || 0),
    });
    setIsCustomerModalOpen(true);
  };

  // Save Customer (POST / PUT)
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerForm.name.trim()) {
      alert('Nama pelanggan wajib diisi');
      return;
    }

    try {
      const url = editingCustomer ? `/api/customers/${editingCustomer.id}` : '/api/customers';
      const method = editingCustomer ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customerForm.name.trim(),
          phone: customerForm.phone.trim(),
          address: customerForm.address.trim(),
          credit_limit: parseFloat(customerForm.credit_limit) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Gagal menyimpan data pelanggan');
        return;
      }

      setIsCustomerModalOpen(false);
      fetchCustomers();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  // Delete Customer
  const handleDeleteCustomer = async (c: Customer) => {
    if (c.current_debt > 0) {
      alert(`Tidak dapat menghapus! Pelanggan "${c.name}" masih memiliki sisa kasbon sebesar Rp ${c.current_debt.toLocaleString('id-ID')}. Lunasi terlebih dahulu.`);
      return;
    }

    if (!confirm(`Hapus data pelanggan "${c.name}"?`)) return;

    try {
      const res = await fetch(`/api/customers/${c.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        fetchCustomers();
      } else {
        alert(data.error || 'Gagal menghapus pelanggan');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  // Open Pay Debt Modal
  const handleOpenPay = (c: Customer) => {
    setSelectedCustomerForPay(c);
    setPayAmount(String(c.current_debt));
    setPayMethod('CASH');
    setPayNotes('');
    setPayError('');
    setIsPayModalOpen(true);
  };

  // Execute Debt Payment
  const handleExecutePayment = async () => {
    if (!selectedCustomerForPay) return;
    const amountNum = parseFloat(payAmount);

    if (!amountNum || amountNum <= 0) {
      setPayError('Nominal pembayaran harus lebih besar dari 0');
      return;
    }

    if (amountNum > selectedCustomerForPay.current_debt) {
      setPayError(`Nominal tidak boleh melebihi total kasbon (Rp ${selectedCustomerForPay.current_debt.toLocaleString('id-ID')})`);
      return;
    }

    setIsProcessingPay(true);
    setPayError('');

    try {
      const res = await fetch(`/api/customers/${selectedCustomerForPay.id}/pay-debt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          payment_method: payMethod,
          notes: payNotes || 'Pelunasan/Cicilan Kasbon',
          cashier_id: currentUser?.id || 1,
          shift_id: activeShift?.id || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses pembayaran kasbon');
      }

      setIsPayModalOpen(false);
      setReceiptText(data.receiptText);
      setReceiptModalOpen(true);
      fetchCustomers();
    } catch (err: any) {
      setPayError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setIsProcessingPay(false);
    }
  };

  // View Customer History
  const handleViewHistory = async (c: Customer) => {
    setHistoryLoading(true);
    setHistoryModalOpen(true);
    try {
      const res = await fetch(`/api/customers/${c.id}`);
      const data = await res.json();
      setHistoryCustomer(data);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-57px)] overflow-hidden bg-slate-100 p-3 md:p-4 space-y-3 pb-16 md:pb-4">
      {/* Top Header Card */}
      <div className="bg-white p-3 md:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base md:text-lg font-black text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>Manajemen Pelanggan & Kasbon (Piutang)</span>
          </h1>
          <p className="text-xs text-slate-500">
            Kelola data pelanggan, plafon batas hutang (credit limit), cicilan/pelunasan kasbon, dan cetak bukti struk
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah Pelanggan Baru</span>
        </button>
      </div>

      {/* KPI Stats Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3">
        {/* Total Piutang Kasbon */}
        <div className="bg-white p-3.5 rounded-2xl border border-rose-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Kasbon Aktif
            </span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg md:text-xl font-black font-mono text-rose-600 mt-1">
            Rp {totalDebtAll.toLocaleString('id-ID')}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Total piutang toko belum tertagih
          </p>
        </div>

        {/* Total Pelanggan */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Pelanggan
            </span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg md:text-xl font-black font-mono text-slate-800 mt-1">
            {customers.length} Orang
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Terdaftar di sistem kasir
          </p>
        </div>

        {/* Ada Hutang / Menunggak */}
        <div className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Ada Saldo Kasbon
            </span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg md:text-xl font-black font-mono text-amber-600 mt-1">
            {customersWithDebtCount} Orang
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Perlu ditagih / pelunasan
          </p>
        </div>

        {/* Lancar Bebas Kasbon */}
        <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Bebas Kasbon (Lancar)
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg md:text-xl font-black font-mono text-emerald-600 mt-1">
            {customersClearCount} Orang
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Hutang Rp 0 (Lancar)
          </p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama pelanggan atau no. HP..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold self-start sm:self-auto">
          <button
            onClick={() => setFilterTab('ALL')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              filterTab === 'ALL' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            Semua ({customers.length})
          </button>
          <button
            onClick={() => setFilterTab('WITH_DEBT')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
              filterTab === 'WITH_DEBT' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>Ada Kasbon ({customersWithDebtCount})</span>
          </button>
          <button
            onClick={() => setFilterTab('CLEAR')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
              filterTab === 'CLEAR' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Lunas ({customersClearCount})</span>
          </button>
        </div>
      </div>

      {/* Customer List Container */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            <span>Memuat data pelanggan...</span>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-6 text-center">
            <Users className="w-12 h-12 text-slate-300 mb-2" />
            <p className="font-bold text-sm text-slate-600">Tidak ada pelanggan ditemukan</p>
            <p className="text-xs text-slate-400 mt-1">Coba ubah kata kunci pencarian atau tambah pelanggan baru</p>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Nama Pelanggan</th>
                  <th className="py-3 px-3 hidden sm:table-cell">Kontak & Alamat</th>
                  <th className="py-3 px-3 text-right">Plafon Kasbon</th>
                  <th className="py-3 px-3 text-right">Total Kasbon Saat Ini</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Aksi Operasional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map(c => {
                  const hasDebt = c.current_debt > 0;
                  const isOverLimit = c.credit_limit > 0 && c.current_debt > c.credit_limit;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        <div className="font-extrabold text-slate-800 text-xs">{c.name}</div>
                        <div className="text-[11px] text-slate-500 sm:hidden mt-0.5">
                          {c.phone || '-'} {c.address ? `• ${c.address}` : ''}
                        </div>
                      </td>

                      <td className="py-3 px-3 hidden sm:table-cell">
                        <div className="text-slate-700 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{c.phone || '-'}</span>
                        </div>
                        {c.address && (
                          <div className="text-slate-400 text-[11px] flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span className="truncate max-w-[200px]">{c.address}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-600">
                        {c.credit_limit > 0 ? `Rp ${c.credit_limit.toLocaleString('id-ID')}` : (
                          <span className="text-slate-400 font-normal">Tak Terbatas</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className={`font-mono font-black text-sm ${hasDebt ? 'text-rose-600' : 'text-slate-400'}`}>
                          Rp {c.current_debt.toLocaleString('id-ID')}
                        </div>
                        {hasDebt && c.credit_limit > 0 && (
                          <div className="text-[10px] text-slate-400 font-medium">
                            Sisa limit: Rp {(c.remaining_credit || 0).toLocaleString('id-ID')}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        {isOverLimit ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 inline-flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3" />
                            <span>Over Limit</span>
                          </span>
                        ) : hasDebt ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Ada Kasbon</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 inline-flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            <span>Lancar</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {hasDebt && (
                            <button
                              onClick={() => handleOpenPay(c)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1 transition cursor-pointer"
                              title="Bayar / Cicil Kasbon"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>Bayar</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleViewHistory(c)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="Riwayat Kasbon & Transaksi"
                          >
                            <Receipt className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleOpenEdit(c)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                            title="Edit Data Pelanggan"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteCustomer(c)}
                            disabled={hasDebt}
                            className={`p-1.5 rounded-lg transition ${
                              hasDebt 
                                ? 'text-slate-300 cursor-not-allowed' 
                                : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                            }`}
                            title={hasDebt ? 'Tidak bisa dihapus: masih ada kasbon' : 'Hapus Pelanggan'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal 1: Tambah / Edit Pelanggan */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span>{editingCustomer ? 'Edit Data Pelanggan' : 'Tambah Pelanggan Baru'}</span>
              </h3>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Lengkap Pelanggan *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pak Haji Rahmat / Bu Siti Warung"
                  value={customerForm.name}
                  onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor HP / WhatsApp
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 081234567890"
                  value={customerForm.phone}
                  onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat / Wilayah Domisili
                </label>
                <input
                  type="text"
                  placeholder="Contoh: RT 02 / RW 05, Blok C No. 12"
                  value={customerForm.address}
                  onChange={e => setCustomerForm({ ...customerForm, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Plafon Maksimal Kasbon (Credit Limit)
                </label>
                <input
                  type="number"
                  placeholder="0 jika tidak dibatasi"
                  value={customerForm.credit_limit}
                  onChange={e => setCustomerForm({ ...customerForm, credit_limit: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Batas maksimal nilai belanja yang dapat diambil secara kasbon. Kasir akan diperingatkan jika hutang melampaui angka ini.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white shadow-md transition cursor-pointer"
                >
                  Simpan Pelanggan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Bayar / Cicil Kasbon */}
      {isPayModalOpen && selectedCustomerForPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800">
                  Pelunasan / Cicilan Kasbon
                </h3>
                <p className="text-[11px] text-slate-500">
                  Pelanggan: <span className="font-bold text-slate-800">{selectedCustomerForPay.name}</span>
                </p>
              </div>
              <button
                onClick={() => setIsPayModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Debt Info Card */}
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">
                    Total Hutang Kasbon
                  </span>
                  <div className="text-xl font-black font-mono text-rose-600 mt-0.5">
                    Rp {selectedCustomerForPay.current_debt.toLocaleString('id-ID')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPayAmount(String(selectedCustomerForPay.current_debt))}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shadow-xs transition cursor-pointer"
                >
                  Bayar Lunas
                </button>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nominal Pembayaran (Rp) *
                </label>
                <input
                  type="number"
                  autoFocus
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-mono text-xl font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Remaining Debt Simulation */}
              {parseFloat(payAmount) > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Sisa Kasbon Setelah Bayar:</span>
                  <span className="font-mono font-bold text-slate-800">
                    Rp {Math.max(0, selectedCustomerForPay.current_debt - (parseFloat(payAmount) || 0)).toLocaleString('id-ID')}
                  </span>
                </div>
              )}

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'CASH', label: 'Tunai (Kasir)' },
                    { id: 'BANK_TRANSFER', label: 'Transfer Bank' },
                    { id: 'QRIS', label: 'QRIS Dinamis' },
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPayMethod(m.id as any)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition cursor-pointer text-center ${
                        payMethod === m.id
                          ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Pembayaran
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Titip lewat tetangga / Cicilan ke-1"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              {payError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{payError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={handleExecutePayment}
                  disabled={isProcessingPay}
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/30 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  {isProcessingPay ? (
                    <span>Memproses...</span>
                  ) : (
                    <>
                      <span>Konfirmasi Pembayaran</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Struk Bukti Pelunasan Termal */}
      {receiptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                <Printer className="w-4 h-4 text-emerald-600" />
                <span>Bukti Pembayaran Kasbon</span>
              </h3>
              <button
                onClick={() => setReceiptModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-900 text-emerald-400 font-mono text-[11px] leading-relaxed whitespace-pre overflow-x-auto max-h-[60vh] rounded-xl m-4 select-all shadow-inner">
              {receiptText}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => setReceiptModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                Selesai
              </button>

              <button
                onClick={() => window.print()}
                className="px-5 py-2 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center gap-1.5 transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Struk (F11)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Riwayat Kasbon & Transaksi Pelanggan */}
      {historyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800">
                  Riwayat Transaksi & Pelunasan Kasbon
                </h3>
                <p className="text-xs text-slate-500">
                  Pelanggan: <span className="font-bold text-slate-800">{historyCustomer?.customer?.name}</span>
                </p>
              </div>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {historyLoading ? (
                <div className="py-8 text-center text-xs text-slate-400">Memuat riwayat...</div>
              ) : (
                <>
                  {/* Riwayat Pembayaran Kasbon */}
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-700 mb-2 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <span>Riwayat Cicilan / Pembayaran Kasbon</span>
                    </h4>
                    {historyCustomer?.payments?.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">Belum ada catatan pembayaran kasbon.</p>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">
                            <tr>
                              <th className="py-2 px-3">No. Bukti</th>
                              <th className="py-2 px-3">Waktu</th>
                              <th className="py-2 px-3">Metode</th>
                              <th className="py-2 px-3">Kasir</th>
                              <th className="py-2 px-3 text-right">Nominal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {historyCustomer?.payments?.map((p: any) => (
                              <tr key={p.id}>
                                <td className="py-2 px-3 font-mono font-bold text-blue-600">{p.payment_no}</td>
                                <td className="py-2 px-3 text-slate-500">{new Date(p.created_at).toLocaleString('id-ID')}</td>
                                <td className="py-2 px-3">{p.payment_method}</td>
                                <td className="py-2 px-3 text-slate-600">{p.cashier_name || 'Kasir'}</td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">
                                  Rp {p.amount.toLocaleString('id-ID')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Riwayat Belanja Kasir */}
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-700 mb-2 flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-blue-600" />
                      <span>Riwayat Transaksi Belanja</span>
                    </h4>
                    {historyCustomer?.orders?.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">Belum ada riwayat transaksi belanja.</p>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">
                            <tr>
                              <th className="py-2 px-3">No. Nota</th>
                              <th className="py-2 px-3">Waktu</th>
                              <th className="py-2 px-3">Metode</th>
                              <th className="py-2 px-3">Status</th>
                              <th className="py-2 px-3 text-right">Total Belanja</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {historyCustomer?.orders?.map((o: any) => (
                              <tr key={o.id}>
                                <td className="py-2 px-3 font-mono font-bold text-slate-800">{o.invoice_no}</td>
                                <td className="py-2 px-3 text-slate-500">{new Date(o.created_at).toLocaleString('id-ID')}</td>
                                <td className="py-2 px-3">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    o.payment_method === 'KASBON' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                                  }`}>
                                    {o.payment_method}
                                  </span>
                                </td>
                                <td className="py-2 px-3">
                                  <span className="text-emerald-600 font-bold">{o.status}</span>
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                                  Rp {o.grand_total.toLocaleString('id-ID')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300 transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
