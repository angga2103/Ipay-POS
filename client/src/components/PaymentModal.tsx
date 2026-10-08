import React, { useState, useEffect } from 'react';
import { 
  Banknote, QrCode, CreditCard, Users, Layers, 
  Check, X, AlertCircle, Loader2, ArrowRight, UserPlus 
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useShift } from '../context/ShiftContext';
import { useAuth } from '../context/AuthContext';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (receiptText: string, order: any, items?: any[]) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { items, grandTotal, totalRetail, totalPPOB, overallDiscount, clearCart } = useCart();
  const { activeShift } = useShift();
  const { currentUser } = useAuth();

  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS' | 'EDC' | 'KASBON' | 'SPLIT'>('CASH');
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [splitCash, setSplitCash] = useState<number>(0);
  const [splitNonCash, setSplitNonCash] = useState<number>(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // New Customer Inline Form for Kasbon
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustCreditLimit, setNewCustCreditLimit] = useState('500000');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [addCustError, setAddCustError] = useState('');

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) {
      setAddCustError('Nama pelanggan wajib diisi');
      return;
    }
    setSavingCustomer(true);
    setAddCustError('');
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCustName.trim(),
          phone: newCustPhone.trim(),
          address: newCustAddress.trim(),
          credit_limit: parseFloat(newCustCreditLimit) || 0,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.customer) {
        setCustomers(prev => [data.customer, ...prev]);
        setSelectedCustomerId(data.customer.id);
        setShowAddCustomer(false);
        setNewCustName('');
        setNewCustPhone('');
        setNewCustCreditLimit('500000');
        setNewCustAddress('');
      } else {
        setAddCustError(data.error || 'Gagal menambahkan pelanggan');
      }
    } catch (err: any) {
      setAddCustError(err.message || 'Error');
    } finally {
      setSavingCustomer(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCashTendered(grandTotal);
      setSplitCash(Math.floor(grandTotal / 2));
      setSplitNonCash(grandTotal - Math.floor(grandTotal / 2));
      setErrorMsg('');

      // Fetch live customers from database
      fetch('/api/customers')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setCustomers(data);
          }
        })
        .catch(err => console.error('Failed to load customers for kasbon:', err));
    }
  }, [isOpen, grandTotal]);

  if (!isOpen) return null;

  const changeAmount = Math.max(0, cashTendered - grandTotal);
  const isCashSufficient = paymentMethod === 'CASH' ? cashTendered >= grandTotal : true;

  const handleQuickCash = (amount: number) => {
    setCashTendered(amount);
  };

  const handleAddCash = (amount: number) => {
    setCashTendered(prev => prev + amount);
  };

  const handleCheckout = async () => {
    if (!activeShift) {
      setErrorMsg('Shift kasir belum aktif! Buka shift terlebih dahulu.');
      return;
    }

    if (paymentMethod === 'CASH' && cashTendered < grandTotal) {
      setErrorMsg('Uang pembayaran tunai kurang dari total belanja');
      return;
    }

    if (paymentMethod === 'KASBON') {
      if (!selectedCustomerId) {
        setErrorMsg('Silakan pilih nama pelanggan yang mengambil kasbon!');
        return;
      }
      const selCustomer = customers.find(c => c.id === selectedCustomerId);
      if (selCustomer && selCustomer.credit_limit > 0) {
        const newTotalDebt = (selCustomer.current_debt || 0) + grandTotal;
        if (newTotalDebt > selCustomer.credit_limit) {
          setErrorMsg(
            `Transaksi kasbon ditolak! Melebihi batas plafon Rp ${selCustomer.credit_limit.toLocaleString('id-ID')} (Hutang saat ini: Rp ${selCustomer.current_debt.toLocaleString('id-ID')}, belanja: Rp ${grandTotal.toLocaleString('id-ID')}, Total Baru: Rp ${newTotalDebt.toLocaleString('id-ID')}).`
          );
          return;
        }
      }
    }

    setIsProcessing(true);
    setErrorMsg('');

    try {
      const payload = {
        shift_id: activeShift.id,
        cashier_id: currentUser?.id || 1,
        customer_id: selectedCustomerId,
        items,
        payment_method: paymentMethod,
        cash_tendered: paymentMethod === 'CASH' ? cashTendered : grandTotal,
        discount_amount: overallDiscount,
        split_details: paymentMethod === 'SPLIT' ? { cash: splitCash, non_cash: splitNonCash } : null,
        notes,
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses pembayaran');
      }

      // Success
      clearCart();
      onSuccess(data.receiptText, data.order, data.items);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat checkout');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base text-slate-800">
                Pembayaran Kasir Terpadu
              </h3>
              <span className="kbd-shortcut">F12</span>
            </div>
            <p className="text-xs text-slate-500">
              Pilih metode bayar & selesaikan transaksi belanja
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/60 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Total Grand Banner */}
        <div className="bg-linear-to-r from-blue-700 to-indigo-800 text-white p-5 flex items-center justify-between shadow-inner">
          <div>
            <div className="text-xs font-semibold text-blue-200 uppercase tracking-wider">
              Total Tagihan Belanja
            </div>
            <div className="text-3xl font-black font-mono tracking-tight mt-0.5">
              Rp {grandTotal.toLocaleString('id-ID')}
            </div>
          </div>

          <div className="text-right text-xs text-blue-200 space-y-0.5">
            <div>Ritel: Rp {totalRetail.toLocaleString('id-ID')}</div>
            <div>PPOB: Rp {totalPPOB.toLocaleString('id-ID')}</div>
            {overallDiscount > 0 && <div className="text-amber-300">Diskon: -Rp {overallDiscount.toLocaleString('id-ID')}</div>}
          </div>
        </div>

        {/* Payment Methods Tabs */}
        <div className="grid grid-cols-5 gap-1 p-2 bg-slate-100 border-b border-slate-200 text-xs font-bold">
          {[
            { id: 'CASH', label: 'Tunai', icon: Banknote },
            { id: 'QRIS', label: 'QRIS Dinamis', icon: QrCode },
            { id: 'EDC', label: 'Kartu EDC', icon: CreditCard },
            { id: 'KASBON', label: 'Kasbon', icon: Users },
            { id: 'SPLIT', label: 'Split Pay', icon: Layers },
          ].map(m => {
            const Icon = m.icon;
            const isSel = paymentMethod === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setPaymentMethod(m.id as any)}
                className={`py-2 px-2 rounded-xl flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                  isSel ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:bg-white/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isSel ? 'text-blue-600' : 'text-slate-400'}`} />
                <span className="text-[11px] truncate">{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Method Detail Area */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {paymentMethod === 'CASH' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Uang Diterima dari Pelanggan (Rp)
                </label>
                <input
                  type="number"
                  autoFocus
                  value={cashTendered || ''}
                  onChange={e => setCashTendered(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono text-2xl font-black text-slate-900"
                />
              </div>

              {/* Fast Denomination Buttons */}
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickCash(grandTotal)}
                  className="py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 transition cursor-pointer"
                >
                  Uang Pas
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCash(10000)}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition cursor-pointer"
                >
                  +10.000
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCash(50000)}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition cursor-pointer"
                >
                  +50.000
                </button>
                <button
                  type="button"
                  onClick={() => handleAddCash(100000)}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition cursor-pointer"
                >
                  +100.000
                </button>
              </div>

              {/* Quick Rounded Buttons */}
              <div className="grid grid-cols-4 gap-2">
                {[50000, 100000, 150000, 200000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleQuickCash(val)}
                    className="py-2 px-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-mono font-bold text-xs rounded-xl border border-slate-200 transition cursor-pointer"
                  >
                    Rp {val.toLocaleString('id-ID')}
                  </button>
                ))}
              </div>

              {/* Change Box */}
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                isCashSufficient ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
              }`}>
                <div>
                  <span className={`text-xs font-bold ${isCashSufficient ? 'text-emerald-800' : 'text-rose-800'}`}>
                    {isCashSufficient ? 'Kembalian Uang Kas' : 'Uang Kurang'}
                  </span>
                  <div className={`text-2xl font-black font-mono ${isCashSufficient ? 'text-emerald-700' : 'text-rose-600'}`}>
                    Rp {(isCashSufficient ? changeAmount : grandTotal - cashTendered).toLocaleString('id-ID')}
                  </div>
                </div>
                {isCashSufficient && (
                  <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                    <Check className="w-5 h-5" />
                  </div>
                )}
              </div>
            </div>
          )}

          {paymentMethod === 'QRIS' && (
            <div className="text-center py-4 space-y-3">
              <div className="inline-block p-4 bg-white border-2 border-slate-300 rounded-2xl shadow-sm">
                {/* Simulated dynamic QRIS */}
                <div className="w-48 h-48 bg-slate-900 rounded-xl flex flex-col items-center justify-center text-white p-4">
                  <QrCode className="w-24 h-24 text-white mb-2" />
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">QRIS DINAMIS AKTIF</span>
                  <span className="text-[11px] font-mono font-bold">Rp {grandTotal.toLocaleString('id-ID')}</span>
                </div>
              </div>
              <p className="text-xs text-slate-600">
                Arahkan pelanggan untuk memindai kode QRIS di atas melalui m-Banking / E-Wallet
              </p>
            </div>
          )}

          {paymentMethod === 'EDC' && (
            <div className="space-y-3 py-2">
              <label className="block text-xs font-bold text-slate-700">
                Referensi Mesin EDC / Approval Code
              </label>
              <input
                type="text"
                placeholder="Contoh: BCA Debit - Ref #981240"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-sm"
              />
              <p className="text-[11px] text-slate-500">
                Gesek kartu pada mesin EDC toko, lalu masukkan nomor persetujuan di atas.
              </p>
            </div>
          )}

          {paymentMethod === 'KASBON' && (
            <div className="space-y-3 py-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">
                  Pilih Pelanggan Kasbon (Wajib Terdaftar)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                    {customers.length} Pelanggan
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCustomer(!showAddCustomer);
                      setAddCustError('');
                    }}
                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold flex items-center gap-1 border border-blue-200 cursor-pointer transition"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{showAddCustomer ? 'Batal Tambah' : '+ Pelanggan Baru'}</span>
                  </button>
                </div>
              </div>

              {/* Inline Add Customer Form */}
              {showAddCustomer && (
                <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3.5 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-blue-200/60 pb-2">
                    <span className="text-xs font-extrabold text-blue-900 flex items-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-blue-600" />
                      <span>Registrasi Pelanggan Baru untuk Kasbon</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddCustomer(false)}
                      className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {addCustError && (
                    <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-1.5 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{addCustError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Nama Pelanggan <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Pak Budi"
                        value={newCustName}
                        onChange={e => setNewCustName(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold focus:outline-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        No. HP / WhatsApp
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: 08123456789"
                        value={newCustPhone}
                        onChange={e => setNewCustPhone(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-mono text-xs focus:outline-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Batas Plafon Kasbon (Rp)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="50000"
                        value={newCustCreditLimit}
                        onChange={e => setNewCustCreditLimit(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-mono text-xs font-bold text-slate-800 focus:outline-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Alamat / Catatan
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: RT 03 / RW 02"
                        value={newCustAddress}
                        onChange={e => setNewCustAddress(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs focus:outline-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddCustomer(false)}
                      className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateCustomer}
                      disabled={savingCustomer}
                      className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {savingCustomer ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Simpan & Pilih Pelanggan</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Search Customer */}
              <input
                type="text"
                placeholder="Cari nama atau nomor HP pelanggan..."
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />

              {/* Customer Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-0.5">
                {customers
                  .filter(c => 
                    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
                    (c.phone && c.phone.includes(customerSearch))
                  )
                  .map(c => {
                    const isSelected = selectedCustomerId === c.id;
                    const wouldExceedLimit = c.credit_limit > 0 && (c.current_debt + grandTotal > c.credit_limit);

                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCustomerId(c.id)}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer relative ${
                          isSelected
                            ? 'bg-blue-50 border-blue-600 ring-2 ring-blue-500/20'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-extrabold text-xs text-slate-800">{c.name}</div>
                          {wouldExceedLimit && (
                            <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1 py-0.5 rounded">
                              Melebihi Plafon
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] text-slate-500 mt-1">
                          Hutang saat ini: <span className="font-mono font-bold text-slate-700">Rp {(c.current_debt || 0).toLocaleString('id-ID')}</span>
                        </div>

                        <div className="flex items-center justify-between mt-0.5 text-[10px]">
                          <span className="text-slate-400">
                            Limit: {c.credit_limit > 0 ? `Rp ${c.credit_limit.toLocaleString('id-ID')}` : 'Bebas'}
                          </span>
                          <span className={`font-mono font-bold ${
                            wouldExceedLimit ? 'text-rose-600' : 'text-emerald-600'
                          }`}>
                            Total Baru: Rp {((c.current_debt || 0) + grandTotal).toLocaleString('id-ID')}
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>

              {customers.length === 0 && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                  Belum ada pelanggan terdaftar. Tambahkan pelanggan terlebih dahulu pada menu "Pelanggan & Kasbon".
                </div>
              )}
            </div>
          )}

          {paymentMethod === 'SPLIT' && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Porsi Tunai (Rp)
                  </label>
                  <input
                    type="number"
                    value={splitCash}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      setSplitCash(val);
                      setSplitNonCash(Math.max(0, grandTotal - val));
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Porsi Non-Tunai / QRIS (Rp)
                  </label>
                  <input
                    type="number"
                    value={splitNonCash}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      setSplitNonCash(val);
                      setSplitCash(Math.max(0, grandTotal - val));
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-200 transition cursor-pointer"
          >
            Batal (Esc)
          </button>

          <button
            onClick={handleCheckout}
            disabled={isProcessing || !isCashSufficient}
            className={`px-6 py-2.5 rounded-xl text-xs font-extrabold shadow-md flex items-center gap-2 transition cursor-pointer ${
              !isCashSufficient || isProcessing
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memproses Pembayaran...</span>
              </>
            ) : (
              <>
                <span>Selesaikan Pembayaran</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
