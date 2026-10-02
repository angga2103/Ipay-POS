import React, { useState, useEffect } from 'react';
import { 
  Truck, Plus, Search, DollarSign, CreditCard, 
  FileText, CheckCircle2, AlertTriangle, Printer, 
  X, Check, Edit2, Trash2, Building, Phone, User, 
  ArrowRight, ShieldAlert, History, Wallet, ExternalLink
} from 'lucide-react';
import { Supplier, SupplierDebtPayment } from '../types';
import { useShift } from '../context/ShiftContext';
import { useAuth } from '../context/AuthContext';

export const SupplierPage: React.FC = () => {
  const { currentShift } = useShift();
  const { currentUser } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DEBT' | 'CLEAR'>('ALL');

  // Modal States
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    contact_person: '',
    bank_name: '',
    bank_account_number: '',
    bank_account_name: '',
    initial_debt: '0',
  });

  // Pay Debt Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedSupplierForPay, setSelectedSupplierForPay] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [sourceAccount, setSourceAccount] = useState<'1-1001' | '1-1002'>('1-1001');
  const [payNotes, setPayNotes] = useState('');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // Receipt / Voucher Modal State
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [voucherReceiptText, setVoucherReceiptText] = useState('');

  // History / Detail Modal State
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedSupplierDetail, setSelectedSupplierDetail] = useState<(Supplier & { payments?: SupplierDebtPayment[]; purchaseOrders?: any[] }) | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/suppliers');
      const data = await res.json();
      if (Array.isArray(data)) {
        setSuppliers(data);
      }
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const openAddModal = () => {
    setEditingSupplier(null);
    setFormData({
      name: '',
      phone: '',
      address: '',
      contact_person: '',
      bank_name: '',
      bank_account_number: '',
      bank_account_name: '',
      initial_debt: '0',
    });
    setIsAddEditModalOpen(true);
  };

  const openEditModal = (sup: Supplier) => {
    setEditingSupplier(sup);
    setFormData({
      name: sup.name,
      phone: sup.phone || '',
      address: sup.address || '',
      contact_person: sup.contact_person || '',
      bank_name: sup.bank_name || '',
      bank_account_number: sup.bank_account_number || '',
      bank_account_name: sup.bank_account_name || '',
      initial_debt: String(sup.current_debt || 0),
    });
    setIsAddEditModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Nama supplier / distributor wajib diisi');
      return;
    }

    try {
      const url = editingSupplier ? `/api/suppliers/${editingSupplier.id}` : '/api/suppliers';
      const method = editingSupplier ? 'PUT' : 'POST';

      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        contact_person: formData.contact_person.trim(),
        bank_name: formData.bank_name.trim(),
        bank_account_number: formData.bank_account_number.trim(),
        bank_account_name: formData.bank_account_name.trim(),
        ...(editingSupplier ? { current_debt: parseFloat(formData.initial_debt) || 0 } : { initial_debt: parseFloat(formData.initial_debt) || 0 }),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menyimpan supplier');
      }

      setIsAddEditModalOpen(false);
      fetchSuppliers();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleDeleteSupplier = async (sup: Supplier) => {
    if (sup.current_debt > 0) {
      alert(`Supplier "${sup.name}" masih memiliki sisa hutang Rp ${sup.current_debt.toLocaleString('id-ID')}. Lunasi terlebih dahulu sebelum menghapus data!`);
      return;
    }

    if (!confirm(`Yakin ingin menghapus/menonaktifkan supplier "${sup.name}"?`)) return;

    try {
      const res = await fetch(`/api/suppliers/${sup.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus');
      alert(data.message || 'Supplier berhasil dihapus');
      fetchSuppliers();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const openPayModal = (sup: Supplier) => {
    setSelectedSupplierForPay(sup);
    setPayAmount(String(sup.current_debt));
    setPayMethod('CASH');
    setSourceAccount('1-1001');
    setPayNotes(`Pelunasan faktur ${sup.name}`);
    setIsPayModalOpen(true);
  };

  const handleProcessPayDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierForPay) return;

    const amountNum = parseFloat(payAmount);
    if (!amountNum || amountNum <= 0) {
      alert('Nominal pembayaran harus lebih dari 0');
      return;
    }

    if (amountNum > selectedSupplierForPay.current_debt) {
      alert('Nominal pembayaran melebihi sisa hutang supplier!');
      return;
    }

    setIsSubmittingPay(true);
    try {
      const res = await fetch(`/api/suppliers/${selectedSupplierForPay.id}/pay-debt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          payment_method: payMethod,
          source_account: sourceAccount,
          notes: payNotes,
          user_id: currentUser?.id,
          shift_id: currentShift?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses pembayaran hutang');
      }

      setIsPayModalOpen(false);
      setVoucherReceiptText(data.voucherText);
      setIsVoucherModalOpen(true);
      fetchSuppliers();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const openHistoryModal = async (sup: Supplier) => {
    setHistoryLoading(true);
    setIsHistoryModalOpen(true);
    try {
      const res = await fetch(`/api/suppliers/${sup.id}`);
      const data = await res.json();
      setSelectedSupplierDetail(data);
    } catch (err) {
      console.error('Failed to load supplier detail:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Calculations
  const totalDebtAll = suppliers.reduce((sum, s) => sum + (s.current_debt || 0), 0);
  const totalWithDebtCount = suppliers.filter(s => s.current_debt > 0).length;
  const totalClearCount = suppliers.filter(s => s.current_debt <= 0).length;

  const filteredSuppliers = suppliers.filter(s => {
    const matchSearch = 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.contact_person && s.contact_person.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.phone && s.phone.includes(searchTerm));

    if (!matchSearch) return false;
    if (statusFilter === 'DEBT') return s.current_debt > 0;
    if (statusFilter === 'CLEAR') return s.current_debt <= 0;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-57px)] overflow-y-auto bg-slate-100 p-3 md:p-4 space-y-3 md:space-y-4 pb-20 md:pb-4">
      {/* Top Banner */}
      <div className="bg-white p-3 md:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-indigo-600" />
            <h1 className="text-base md:text-lg font-black text-slate-800">
              Manajemen Supplier & Hutang Usaha
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Pencatatan distributor/agen, rekening bank transfer, jadwal pembayaran, dan bukti pengeluaran kas (voucher)
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-600/30 flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Supplier Baru</span>
        </button>
      </div>

      {/* KPI Cards Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        <div className="bg-white p-3 md:p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500">Total Hutang Toko</div>
            <div className="text-sm md:text-base font-black text-rose-600">
              Rp {totalDebtAll.toLocaleString('id-ID')}
            </div>
          </div>
        </div>

        <div className="bg-white p-3 md:p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500">Total Supplier</div>
            <div className="text-sm md:text-base font-black text-slate-800">
              {suppliers.length} Agen/Mitra
            </div>
          </div>
        </div>

        <div className="bg-white p-3 md:p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500">Ada Tagihan Hutang</div>
            <div className="text-sm md:text-base font-black text-amber-600">
              {totalWithDebtCount} Supplier
            </div>
          </div>
        </div>

        <div className="bg-white p-3 md:p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500">Lunas / Bebas Hutang</div>
            <div className="text-sm md:text-base font-black text-emerald-600">
              {totalClearCount} Supplier
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari nama supplier, PIC, atau no HP..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600 text-xs"
          />
        </div>

        <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto no-scrollbar">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer whitespace-nowrap ${
              statusFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Semua ({suppliers.length})
          </button>
          <button
            onClick={() => setStatusFilter('DEBT')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer whitespace-nowrap ${
              statusFilter === 'DEBT' ? 'bg-rose-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Ada Hutang ({totalWithDebtCount})
          </button>
          <button
            onClick={() => setStatusFilter('CLEAR')}
            className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer whitespace-nowrap ${
              statusFilter === 'CLEAR' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Lunas ({totalClearCount})
          </button>
        </div>
      </div>

      {/* Supplier List */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200">
          Memuat data supplier...
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
          <Truck className="w-8 h-8 text-slate-300 mx-auto" />
          <div className="text-xs font-bold text-slate-600">Tidak ada data supplier yang cocok</div>
          <p className="text-[11px] text-slate-400">Tambahkan supplier baru atau sesuaikan kata kunci pencarian</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredSuppliers.map(sup => {
            const hasDebt = sup.current_debt > 0;
            return (
              <div 
                key={sup.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between hover:border-indigo-300 transition space-y-3"
              >
                <div>
                  {/* Header Card: Name & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                        {sup.name}
                      </h3>
                      {sup.contact_person && (
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>PIC: {sup.contact_person}</span>
                        </div>
                      )}
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg shrink-0 ${
                      hasDebt 
                        ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {hasDebt ? 'ADA HUTANG' : 'LUNAS'}
                    </span>
                  </div>

                  {/* Contact & Bank Details */}
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-1 text-xs text-slate-600">
                    {sup.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-mono">{sup.phone}</span>
                        <a 
                          href={`https://wa.me/${sup.phone.replace(/[^0-9]/g, '')}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[10px] text-emerald-600 font-bold hover:underline flex items-center gap-0.5 ml-1"
                        >
                          WA <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    )}
                    {sup.bank_name && (
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                        <span>{sup.bank_name}: <strong className="text-slate-700 font-mono">{sup.bank_account_number}</strong> {sup.bank_account_name ? `(${sup.bank_account_name})` : ''}</span>
                      </div>
                    )}
                    {sup.address && (
                      <div className="text-[11px] text-slate-400 truncate">
                        {sup.address}
                      </div>
                    )}
                  </div>
                </div>

                {/* Financial Summary & Actions */}
                <div className="pt-2.5 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-500">Sisa Hutang:</span>
                    <span className={`text-base font-black font-mono ${hasDebt ? 'text-rose-600' : 'text-emerald-600'}`}>
                      Rp {sup.current_debt.toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {hasDebt ? (
                      <button
                        onClick={() => openPayModal(sup)}
                        className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Bayar Hutang</span>
                      </button>
                    ) : (
                      <button
                        disabled
                        className="flex-1 py-2 px-3 rounded-xl bg-slate-100 text-slate-400 font-bold text-xs flex items-center justify-center gap-1 cursor-not-allowed"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Tidak Ada Tagihan</span>
                      </button>
                    )}

                    <button
                      onClick={() => openHistoryModal(sup)}
                      className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                      title="Riwayat Pembayaran & Detail"
                    >
                      <History className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => openEditModal(sup)}
                      className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                      title="Edit Supplier"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteSupplier(sup)}
                      className="p-2 rounded-xl border border-slate-200 text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                      title="Hapus Supplier"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Tambah / Edit Supplier */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-600" />
                <span>{editingSupplier ? 'Edit Data Supplier' : 'Tambah Supplier / Distributor Baru'}</span>
              </h3>
              <button
                onClick={() => setIsAddEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-5 overflow-y-auto space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Supplier / Distributor <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PT. Indofood Sukses Makmur / Agen Pulsa Nusantara"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nama Sales / PIC
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Pak Bambang"
                    value={formData.contact_person}
                    onChange={e => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    No. Telepon / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="08123456789"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Alamat Kantor / Gudang Supplier
                </label>
                <textarea
                  rows={2}
                  placeholder="Jl. Industri Raya No. 12, Kawasan Industri..."
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Informasi Rekening Pembayaran Transfer</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10.5px] text-slate-500 mb-0.5">Nama Bank</label>
                    <input
                      type="text"
                      placeholder="BCA / Mandiri"
                      value={formData.bank_name}
                      onChange={e => setFormData({ ...formData, bank_name: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] text-slate-500 mb-0.5">No. Rekening</label>
                    <input
                      type="text"
                      placeholder="1234567890"
                      value={formData.bank_account_number}
                      onChange={e => setFormData({ ...formData, bank_account_number: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] text-slate-500 mb-0.5">Atas Nama</label>
                    <input
                      type="text"
                      placeholder="PT Indofood..."
                      value={formData.bank_account_name}
                      onChange={e => setFormData({ ...formData, bank_account_name: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Saldo Hutang Berjalan (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.initial_debt}
                  onChange={e => setFormData({ ...formData, initial_debt: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold text-rose-600 focus:outline-none focus:border-indigo-600"
                />
                <span className="text-[10px] text-slate-400">
                  Total sisa hutang toko ke supplier ini saat ini
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-md flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingSupplier ? 'Simpan Perubahan' : 'Tambahkan Supplier'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Bayar Hutang Supplier */}
      {isPayModalOpen && selectedSupplierForPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-rose-50">
              <div>
                <h3 className="font-extrabold text-sm text-rose-900 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-rose-600" />
                  <span>Pembayaran Hutang Supplier</span>
                </h3>
                <p className="text-xs text-rose-700 font-semibold">
                  {selectedSupplierForPay.name}
                </p>
              </div>
              <button
                onClick={() => setIsPayModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProcessPayDebt} className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Debt overview banner */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 font-mono">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-sans">Total Hutang Saat Ini:</span>
                  <span className="font-black text-rose-600">
                    Rp {selectedSupplierForPay.current_debt.toLocaleString('id-ID')}
                  </span>
                </div>
                {selectedSupplierForPay.bank_name && (
                  <div className="text-[11px] font-sans text-slate-500 pt-1 border-t border-slate-200">
                    Rekening Tujuan: <strong>{selectedSupplierForPay.bank_name} {selectedSupplierForPay.bank_account_number}</strong> ({selectedSupplierForPay.bank_account_name || selectedSupplierForPay.name})
                  </div>
                )}
              </div>

              {/* Source Account & Method Selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Sumber Dana & Metode Pembayaran <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPayMethod('CASH');
                      setSourceAccount('1-1001');
                    }}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                      sourceAccount === '1-1001'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-600/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-extrabold text-xs">
                      <Wallet className="w-4 h-4 text-indigo-600" />
                      <span>Kas Laci Toko (Tunai)</span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Akun 1-1001 (Otomatis potong kas laci shift aktif)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPayMethod('BANK_TRANSFER');
                      setSourceAccount('1-1002');
                    }}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition cursor-pointer ${
                      sourceAccount === '1-1002'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-600/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-extrabold text-xs">
                      <CreditCard className="w-4 h-4 text-indigo-600" />
                      <span>Rekening Bank (Transfer)</span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Akun 1-1002 (Transfer via m-banking / bank toko)
                    </span>
                  </button>
                </div>
              </div>

              {/* Amount input with Quick Fill */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">
                    Nominal Pembayaran (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setPayAmount(String(selectedSupplierForPay.current_debt))}
                    className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    Bayar Lunas Total
                  </button>
                </div>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedSupplierForPay.current_debt}
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono text-base font-black text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>

              {/* Remaining debt live preview */}
              <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-200 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600">Sisa Hutang Setelah Bayar:</span>
                <span className="font-black font-mono text-indigo-700 text-sm">
                  Rp {Math.max(0, selectedSupplierForPay.current_debt - (parseFloat(payAmount) || 0)).toLocaleString('id-ID')}
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Catatan / Nomor Faktur Pembelian
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Faktur No. INV-8921 tgl 25/09/2026"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPay}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold shadow-md flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>{isSubmittingPay ? 'Memproses...' : 'Bayar Hutang & Buat Voucher'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Struk / Voucher Pengeluaran Kas Bukti Pembayaran */}
      {isVoucherModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                <Printer className="w-4 h-4 text-indigo-600" />
                <span>Bukti Pengeluaran Kas (Voucher)</span>
              </h3>
              <button
                onClick={() => setIsVoucherModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto">
              <pre className="bg-slate-950 text-emerald-400 p-4 rounded-xl font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre">
                {voucherReceiptText}
              </pre>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(voucherReceiptText);
                  alert('Teks voucher berhasil disalin!');
                }}
                className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Salin Teks
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Nota Termal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Riwayat Pembayaran & Detail Supplier */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600" />
                  <span>Detail & Riwayat Mutasi Hutang Supplier</span>
                </h3>
                {selectedSupplierDetail && (
                  <p className="text-xs text-slate-500 font-bold">{selectedSupplierDetail.name}</p>
                )}
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {historyLoading || !selectedSupplierDetail ? (
                <div className="py-8 text-center text-slate-400">Memuat rincian transaksi...</div>
              ) : (
                <>
                  {/* Supplier Summary Card */}
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-[11px] text-slate-500">Sisa Hutang Berjalan:</span>
                      <div className="text-base font-black text-rose-600 font-mono">
                        Rp {selectedSupplierDetail.current_debt.toLocaleString('id-ID')}
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500">Rekening Tujuan:</span>
                      <div className="text-xs font-bold text-slate-700">
                        {selectedSupplierDetail.bank_name ? `${selectedSupplierDetail.bank_name} ${selectedSupplierDetail.bank_account_number}` : '-'}
                      </div>
                    </div>
                  </div>

                  {/* Payment History List */}
                  <div>
                    <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Riwayat Pembayaran Hutang ({selectedSupplierDetail.payments?.length || 0})</span>
                    </h4>

                    {(!selectedSupplierDetail.payments || selectedSupplierDetail.payments.length === 0) ? (
                      <div className="p-4 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400">
                        Belum ada riwayat pembayaran hutang ke supplier ini
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedSupplierDetail.payments.map(p => (
                          <div key={p.id} className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                            <div>
                              <div className="font-extrabold text-slate-800 font-mono text-xs">{p.payment_no}</div>
                              <div className="text-[10px] text-slate-400">
                                {new Date(p.created_at).toLocaleString('id-ID')} • {p.payment_method === 'CASH' ? 'Kas Laci (Tunai)' : 'Transfer Bank'}
                              </div>
                              {p.notes && <div className="text-[11px] text-slate-600 mt-0.5">{p.notes}</div>}
                            </div>
                            <div className="text-right">
                              <div className="font-black text-emerald-600 font-mono text-xs">
                                -Rp {p.amount.toLocaleString('id-ID')}
                              </div>
                              <div className="text-[10px] text-slate-400">Oleh: {p.user_name || 'Staff'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 transition cursor-pointer"
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
