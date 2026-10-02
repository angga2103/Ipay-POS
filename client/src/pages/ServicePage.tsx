import React, { useState, useEffect } from 'react';
import { 
  Wrench, Plus, Search, Filter, Phone, Smartphone, 
  CheckCircle, Clock, AlertTriangle, Printer, DollarSign, 
  Calendar, Check, X, ShieldAlert, ArrowRight, Eye, ShieldCheck
} from 'lucide-react';
import { ServiceOrder, ServiceStatus } from '../types';

export const ServicePage: React.FC = () => {
  const [services, setServices] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeStatusTab, setActiveStatusTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Intake Modal State
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [intakeForm, setIntakeForm] = useState({
    customer_name: '',
    customer_phone: '',
    device_brand_model: '',
    imei_sn: '',
    passcode: '',
    issue_description: '',
    completeness: 'Unit HP batangan',
    estimated_cost: '',
    down_payment: '0',
    technician_name: 'Teknisi 1',
    technician_notes: '',
  });

  // Pickup & Settle Modal State
  const [selectedForPickup, setSelectedForPickup] = useState<ServiceOrder | null>(null);
  const [pickupForm, setPickupForm] = useState({
    payment_method: 'CASH' as 'CASH' | 'QRIS' | 'EDC',
    cash_tendered: '',
    notes: '',
  });

  // Status Update Modal State
  const [selectedForStatus, setSelectedForStatus] = useState<ServiceOrder | null>(null);
  const [statusForm, setStatusForm] = useState({
    status: '' as ServiceStatus,
    technicianNotes: '',
    finalCost: '',
  });

  // Receipt Modal State
  const [receiptModal, setReceiptModal] = useState<{ isOpen: boolean; text: string; title: string }>({
    isOpen: false,
    text: '',
    title: '',
  });

  const fetchServices = async () => {
    setLoading(true);
    try {
      const url = activeStatusTab === 'ALL' 
        ? '/api/services' 
        : `/api/services?status=${activeStatusTab}`;
      const res = await fetch(url);
      const data = await res.json();
      setServices(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load services:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [activeStatusTab]);

  const handleCreateIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intakeForm.customer_name || !intakeForm.customer_phone || !intakeForm.device_brand_model || !intakeForm.issue_description) {
      alert('Harap isi nama, no telepon, tipe HP, dan kerusakan');
      return;
    }

    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...intakeForm,
          estimated_cost: parseFloat(intakeForm.estimated_cost) || 0,
          down_payment: parseFloat(intakeForm.down_payment) || 0,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setShowIntakeModal(false);
        // Reset form
        setIntakeForm({
          customer_name: '',
          customer_phone: '',
          device_brand_model: '',
          imei_sn: '',
          passcode: '',
          issue_description: '',
          completeness: 'Unit HP batangan',
          estimated_cost: '',
          down_payment: '0',
          technician_name: 'Teknisi 1',
          technician_notes: '',
        });
        fetchServices();
        if (data.receiptText) {
          setReceiptModal({
            isOpen: true,
            text: data.receiptText,
            title: `Tanda Terima Servis: ${data.service.service_no}`,
          });
        }
      } else {
        alert(data.error || 'Gagal menyimpan data servis');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedForStatus) return;
    try {
      const res = await fetch(`/api/services/${selectedForStatus.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: statusForm.status,
          technicianNotes: statusForm.technicianNotes,
          finalCost: statusForm.finalCost ? parseFloat(statusForm.finalCost) : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedForStatus(null);
        fetchServices();
      } else {
        alert(data.error || 'Gagal memperbarui status');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleExecutePickup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForPickup) return;

    const remaining = Math.max(0, selectedForPickup.final_cost - selectedForPickup.down_payment);
    const tendered = parseFloat(pickupForm.cash_tendered) || remaining;

    if (pickupForm.payment_method === 'CASH' && tendered < remaining) {
      alert(`Uang tunai kurang! Sisa biaya pelunasan adalah Rp ${remaining.toLocaleString('id-ID')}`);
      return;
    }

    try {
      const res = await fetch(`/api/services/${selectedForPickup.id}/pickup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: pickupForm.payment_method,
          cash_tendered: tendered,
          notes: pickupForm.notes,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSelectedForPickup(null);
        fetchServices();
        if (data.receiptText) {
          setReceiptModal({
            isOpen: true,
            text: data.receiptText,
            title: `Nota Pelunasan Servis: ${selectedForPickup.service_no}`,
          });
        }
      } else {
        alert(data.error || 'Gagal memproses pelunasan');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handlePrintReceipt = async (srv: ServiceOrder, type: 'intake' | 'pickup' = 'intake') => {
    try {
      const res = await fetch(`/api/services/${srv.id}/receipt?type=${type}`);
      const data = await res.json();
      if (data.receiptText) {
        setReceiptModal({
          isOpen: true,
          text: data.receiptText,
          title: type === 'pickup' ? `Nota Pelunasan: ${srv.service_no}` : `Tanda Terima: ${srv.service_no}`,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered list
  const filteredServices = services.filter(srv => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      srv.service_no.toLowerCase().includes(q) ||
      srv.customer_name.toLowerCase().includes(q) ||
      srv.customer_phone.toLowerCase().includes(q) ||
      srv.device_brand_model.toLowerCase().includes(q) ||
      (srv.imei_sn && srv.imei_sn.toLowerCase().includes(q))
    );
  });

  const getStatusBadge = (status: ServiceStatus) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">Antrean (Pending)</span>;
      case 'PROCESSING':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">Sedang Dikerjakan</span>;
      case 'WAITING_PARTS':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">Menunggu Sparepart</span>;
      case 'COMPLETED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Siap Diambil</span>;
      case 'PICKED_UP':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">Sudah Diambil</span>;
      case 'CANCELLED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">Dibatalkan</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden pb-16 md:pb-0">
      {/* Top Header & Actions */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-600 text-white">
              <Wrench className="w-5 h-5" />
            </div>
            <h1 className="text-lg md:text-xl font-extrabold text-slate-800">
              Servis HP & Gadget Center
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manajemen penerimaan servis, tracking pengerjaan teknisi, & nota pelunasan bergaransi
          </p>
        </div>

        <button
          onClick={() => setShowIntakeModal(true)}
          className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs md:text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer min-h-[44px] transition"
        >
          <Plus className="w-4 h-4" />
          <span>Terima Servis Baru</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Horizontal Status Tabs (Touch-friendly scroll) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {[
            { id: 'ALL', label: 'Semua Servis' },
            { id: 'PENDING', label: 'Antrean' },
            { id: 'PROCESSING', label: 'Dikerjakan' },
            { id: 'WAITING_PARTS', label: 'Tunggu Part' },
            { id: 'COMPLETED', label: 'Siap Diambil' },
            { id: 'PICKED_UP', label: 'Selesai' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveStatusTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 min-h-[36px] ${
                activeStatusTab === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari No. Servis, Nama, HP, IMEI..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-blue-500 transition"
          />
        </div>
      </div>

      {/* Service List / Cards */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-xs">
            Memuat data servis...
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
            <Smartphone className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">Belum ada data pesanan servis</p>
            <p className="text-xs mt-1">Klik tombol "Terima Servis Baru" untuk mencatat unit masuk.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredServices.map(srv => {
              const remaining = Math.max(0, srv.final_cost - srv.down_payment);
              return (
                <div
                  key={srv.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition p-4 flex flex-col justify-between"
                >
                  <div>
                    {/* Header: No Servis & Status */}
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                      <div>
                        <span className="text-xs font-mono font-bold text-blue-600">{srv.service_no}</span>
                        <div className="text-[10px] text-slate-400">
                          {new Date(srv.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      {getStatusBadge(srv.status)}
                    </div>

                    {/* Customer & Device */}
                    <div className="py-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-800">{srv.customer_name}</span>
                        <a
                          href={`https://wa.me/${srv.customer_phone.replace(/^0/, '62')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg hover:bg-emerald-100 transition"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{srv.customer_phone}</span>
                        </a>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                        <Smartphone className="w-4 h-4 text-blue-500 shrink-0" />
                        <span>{srv.device_brand_model}</span>
                      </div>

                      {srv.imei_sn && (
                        <div className="text-[11px] text-slate-500 font-mono">
                          SN/IMEI: {srv.imei_sn}
                        </div>
                      )}

                      {srv.passcode && (
                        <div className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md inline-block font-mono">
                          Pola/PIN: {srv.passcode}
                        </div>
                      )}

                      {/* Kerusakan */}
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs text-slate-600 mt-2">
                        <span className="font-bold text-slate-700 block text-[11px] mb-0.5">Keluhan Kerusakan:</span>
                        <p className="line-clamp-2">{srv.issue_description}</p>
                      </div>

                      {srv.technician_notes && (
                        <div className="text-[11px] text-slate-500 italic mt-1">
                          Catatan Teknisi: {srv.technician_notes}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial & Actions Footer */}
                  <div className="pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs mb-3">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Total Biaya</span>
                        <span className="font-extrabold text-slate-800">
                          Rp {srv.final_cost.toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">
                          {srv.status === 'PICKED_UP' ? 'Status Pembayaran' : 'Sisa Pelunasan'}
                        </span>
                        {srv.status === 'PICKED_UP' ? (
                          <span className="font-bold text-emerald-600 text-xs">LUNAS</span>
                        ) : (
                          <span className={`font-extrabold ${remaining > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            Rp {remaining.toLocaleString('id-ID')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handlePrintReceipt(srv, srv.status === 'PICKED_UP' ? 'pickup' : 'intake')}
                        title="Cetak Tanda Terima / Nota"
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                      </button>

                      {srv.status !== 'PICKED_UP' && srv.status !== 'CANCELLED' && (
                        <button
                          onClick={() => {
                            setSelectedForStatus(srv);
                            setStatusForm({
                              status: srv.status,
                              technicianNotes: srv.technician_notes || '',
                              finalCost: String(srv.final_cost),
                            });
                          }}
                          className="flex-1 py-2 px-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold text-center cursor-pointer transition"
                        >
                          Update Status
                        </button>
                      )}

                      {srv.status === 'COMPLETED' && (
                        <button
                          onClick={() => {
                            setSelectedForPickup(srv);
                            const rem = Math.max(0, srv.final_cost - srv.down_payment);
                            setPickupForm({
                              payment_method: 'CASH',
                              cash_tendered: String(rem),
                              notes: '',
                            });
                          }}
                          className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition shadow-xs"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Serah Terima</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 1. Modal Terima Servis Baru (Intake) */}
      {showIntakeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-scale-up">
            <div className="bg-linear-to-r from-blue-600 to-indigo-600 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/20">
                  <Wrench className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base leading-tight">Penerimaan Servis Baru</h3>
                  <p className="text-[11px] text-blue-100">Cetak tanda terima resmi untuk pelanggan</p>
                </div>
              </div>
              <button
                onClick={() => setShowIntakeModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateIntake} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Customer Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nama Pelanggan *</label>
                  <input
                    type="text"
                    required
                    value={intakeForm.customer_name}
                    onChange={e => setIntakeForm({ ...intakeForm, customer_name: e.target.value })}
                    placeholder="Contoh: Rian Pratama"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">No. WhatsApp / HP *</label>
                  <input
                    type="tel"
                    required
                    value={intakeForm.customer_phone}
                    onChange={e => setIntakeForm({ ...intakeForm, customer_phone: e.target.value })}
                    placeholder="Contoh: 08123456789"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Device Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tipe & Seri HP *</label>
                  <input
                    type="text"
                    required
                    value={intakeForm.device_brand_model}
                    onChange={e => setIntakeForm({ ...intakeForm, device_brand_model: e.target.value })}
                    placeholder="Contoh: Xiaomi Redmi Note 12"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">No. IMEI / SN (Opsional)</label>
                  <input
                    type="text"
                    value={intakeForm.imei_sn}
                    onChange={e => setIntakeForm({ ...intakeForm, imei_sn: e.target.value })}
                    placeholder="Scan / ketik IMEI bila ada"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pola / PIN Layar</label>
                  <input
                    type="text"
                    value={intakeForm.passcode}
                    onChange={e => setIntakeForm({ ...intakeForm, passcode: e.target.value })}
                    placeholder="Bila pelanggan memberikan sandi"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kelengkapan Unit</label>
                  <input
                    type="text"
                    value={intakeForm.completeness}
                    onChange={e => setIntakeForm({ ...intakeForm, completeness: e.target.value })}
                    placeholder="Contoh: Unit Batangan, Charger"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Issue Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Keluhan & Kerusakan *</label>
                <textarea
                  required
                  rows={2}
                  value={intakeForm.issue_description}
                  onChange={e => setIntakeForm({ ...intakeForm, issue_description: e.target.value })}
                  placeholder="Deskripsikan kondisi kerusakan (contoh: Layar bergaris dan touchscreen pojok kanan atas tidak respon)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* Cost & Down Payment */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Estimasi Biaya Servis (Rp) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={intakeForm.estimated_cost}
                    onChange={e => setIntakeForm({ ...intakeForm, estimated_cost: e.target.value })}
                    placeholder="Contoh: 250000"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Uang Muka / DP (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={intakeForm.down_payment}
                    onChange={e => setIntakeForm({ ...intakeForm, down_payment: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-emerald-700"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowIntakeModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 min-h-[44px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 min-h-[44px]"
                >
                  <Printer className="w-4 h-4" />
                  <span>Simpan & Cetak Struk</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal Update Status Teknisi */}
      {selectedForStatus && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
            <div className="bg-slate-800 px-5 py-3.5 text-white flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm">Update Status Pengerjaan</h3>
                <p className="text-[11px] text-slate-300">{selectedForStatus.service_no} - {selectedForStatus.device_brand_model}</p>
              </div>
              <button
                onClick={() => setSelectedForStatus(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Status Baru</label>
                <select
                  value={statusForm.status}
                  onChange={e => setStatusForm({ ...statusForm, status: e.target.value as ServiceStatus })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                >
                  <option value="PENDING">PENDING - Antrean Masuk</option>
                  <option value="PROCESSING">PROCESSING - Sedang Dikerjakan Teknisi</option>
                  <option value="WAITING_PARTS">WAITING_PARTS - Menunggu Kedatangan Sparepart</option>
                  <option value="COMPLETED">COMPLETED - Selesai & Siap Diambil Pelanggan</option>
                  <option value="CANCELLED">CANCELLED - Dibatalkan / Tidak Bisa Diperbaiki</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Total Biaya Akhir (Rp)</label>
                <input
                  type="number"
                  value={statusForm.finalCost}
                  onChange={e => setStatusForm({ ...statusForm, finalCost: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Pengerjaan Teknisi</label>
                <textarea
                  rows={2}
                  value={statusForm.technicianNotes}
                  onChange={e => setStatusForm({ ...statusForm, technicianNotes: e.target.value })}
                  placeholder="Contoh: Ganti IC power selesai, tested normal 24 jam"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedForStatus(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={handleUpdateStatus}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal Pelunasan & Serah Terima Unit */}
      {selectedForPickup && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
            <div className="bg-emerald-600 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/20">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">Pelunasan & Serah Terima</h3>
                  <p className="text-[11px] text-emerald-100">Klaim garansi 7 hari & cetak nota lunas</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedForPickup(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecutePickup} className="p-5 space-y-4">
              <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Pelanggan:</span>
                  <span className="font-bold text-slate-800">{selectedForPickup.customer_name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Perangkat:</span>
                  <span className="font-bold text-slate-800">{selectedForPickup.device_brand_model}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-emerald-200/60 pt-2">
                  <span className="text-slate-600">Total Biaya:</span>
                  <span className="font-bold">Rp {selectedForPickup.final_cost.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600">Uang Muka (DP):</span>
                  <span className="font-bold text-emerald-700">-Rp {selectedForPickup.down_payment.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold border-t border-emerald-200 pt-2 text-emerald-950">
                  <span>Sisa Pelunasan:</span>
                  <span className="text-base text-rose-600">
                    Rp {Math.max(0, selectedForPickup.final_cost - selectedForPickup.down_payment).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Metode Pelunasan</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['CASH', 'QRIS', 'EDC'] as const).map(pm => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => setPickupForm({ ...pickupForm, payment_method: pm })}
                      className={`py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                        pickupForm.payment_method === pm
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {pm}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash tendered if Cash */}
              {pickupForm.payment_method === 'CASH' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Uang Diterima (Rp)</label>
                  <input
                    type="number"
                    required
                    value={pickupForm.cash_tendered}
                    onChange={e => setPickupForm({ ...pickupForm, cash_tendered: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold focus:bg-white"
                  />
                  {parseFloat(pickupForm.cash_tendered) >= Math.max(0, selectedForPickup.final_cost - selectedForPickup.down_payment) && (
                    <div className="mt-1 text-xs text-emerald-700 font-semibold flex justify-between">
                      <span>Kembalian:</span>
                      <span>
                        Rp {(parseFloat(pickupForm.cash_tendered) - Math.max(0, selectedForPickup.final_cost - selectedForPickup.down_payment)).toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedForPickup(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20"
                >
                  <Check className="w-4 h-4" />
                  <span>Pelunasan Selesai</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Thermal Receipt Modal View */}
      {receiptModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
            <div className="bg-slate-800 px-4 py-3 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-blue-400" />
                <h3 className="font-extrabold text-xs">{receiptModal.title}</h3>
              </div>
              <button
                onClick={() => setReceiptModal({ isOpen: false, text: '', title: '' })}
                className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-50">
              <div className="bg-white p-3 rounded-xl border border-slate-300 font-mono text-[10px] md:text-xs leading-relaxed whitespace-pre overflow-x-auto shadow-inner text-slate-800">
                {receiptModal.text}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setReceiptModal({ isOpen: false, text: '', title: '' })}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold"
                >
                  Tutup
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak thermal</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
