import React, { useState, useEffect } from 'react';
import { 
  Printer, X, Share2, Sparkles, CheckCircle2, DollarSign, 
  MessageSquare, Copy, Check, ExternalLink, Smartphone, RefreshCw 
} from 'lucide-react';

interface ReceiptModalProps {
  receiptText: string;
  isOpen: boolean;
  onClose: () => void;
  invoiceNo?: string;
  customerPhone?: string;
  order?: any;
  orderItems?: any[];
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  receiptText,
  isOpen,
  onClose,
  invoiceNo,
  customerPhone = '',
  order,
  orderItems = [],
}) => {
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('58mm');
  const [drawerKicked, setDrawerKicked] = useState(false);
  const [activeView, setActiveView] = useState<'thermal' | 'whatsapp'>('thermal');
  const [targetPhone, setTargetPhone] = useState(customerPhone);
  const [copied, setCopied] = useState(false);
  const [currentItems, setCurrentItems] = useState<any[]>(orderItems || []);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Sync items when orderItems prop changes
  useEffect(() => {
    setCurrentItems(orderItems || []);
  }, [orderItems]);

  const handleCheckPPOBStatus = async () => {
    const ppobItem = currentItems.find((it: any) => it.item_type === 'PPOB' && it.ppob_ref_id);
    if (!ppobItem?.ppob_ref_id) return;
    setCheckingStatus(true);
    try {
      const res = await fetch(`/api/ppob/sync-status/${encodeURIComponent(ppobItem.ppob_ref_id)}`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.status === 'SUCCESS') {
        setCurrentItems(prev => prev.map(it => {
          if (it.ppob_ref_id === ppobItem.ppob_ref_id) {
            return {
              ...it,
              ppob_status: data.status,
              ppob_sn_token: data.sn_token,
            };
          }
          return it;
        }));
      }
    } catch (err) {
      console.error('Failed to sync PPOB status:', err);
    } finally {
      setCheckingStatus(false);
    }
  };

  // Sync phone when modal opens or customerPhone changes, plus auto-check if pending
  useEffect(() => {
    if (isOpen) {
      setTargetPhone(customerPhone || '');
      setCopied(false);
      setCurrentItems(orderItems || []);
      // If order contains PPOB, default to showing whatsapp preview option readily
      const hasPPOB = orderItems?.some((it: any) => it.item_type === 'PPOB');
      if (hasPPOB && !customerPhone) {
        const ppobItem = orderItems.find((it: any) => it.ppob_target_no);
        if (ppobItem?.ppob_target_no) {
          setTargetPhone(ppobItem.ppob_target_no);
        }
      }

      // Auto-check status if any PPOB item is still PENDING
      const hasPending = orderItems?.some((it: any) => it.item_type === 'PPOB' && (it.ppob_status === 'PENDING' || String(it.ppob_sn_token || '').includes('Pending')));
      if (hasPending) {
        const timer = setTimeout(() => {
          handleCheckPPOBStatus();
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, customerPhone, orderItems]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleKickDrawer = () => {
    setDrawerKicked(true);
    setTimeout(() => setDrawerKicked(false), 2000);
  };

  // Generate neat, professional WhatsApp formatted receipt
  const generateWhatsAppMessage = () => {
    const ppobItems = currentItems?.filter((it: any) => it.item_type === 'PPOB') || [];
    const retailItems = currentItems?.filter((it: any) => it.item_type === 'RETAIL') || [];

    let text = `🧾 *STRUK TRANSAKSI RESMI*\n`;
    text += `*POS IPAY - SISTEM KASIR & DIGITAL*\n`;
    text += `─────────────────────────\n`;
    text += `No. Struk : *${invoiceNo || order?.invoice_no || 'TRX-' + Date.now()}*\n`;
    text += `Waktu     : ${order?.created_at ? new Date(order.created_at).toLocaleString('id-ID') : new Date().toLocaleString('id-ID')}\n`;
    if (order?.cashier_name) text += `Kasir     : ${order.cashier_name}\n`;
    if (order?.customer_name) text += `Pelanggan : ${order.customer_name}\n`;
    text += `─────────────────────────\n\n`;

    if (ppobItems.length > 0) {
      text += `*📱 LAYANAN PPOB & PRODUK DIGITAL:*\n`;
      for (const it of ppobItems) {
        text += `• *${it.item_name}*\n`;
        if (it.ppob_target_no) text += `  No. Tujuan : *${it.ppob_target_no}*\n`;
        if (it.ppob_customer_name) text += `  Atas Nama  : ${it.ppob_customer_name}\n`;
        text += `  Tagihan/Harga : Rp ${Number(it.subtotal || it.unit_price || 0).toLocaleString('id-ID')}\n`;

        // Token / SN Highlight Framed Box
        if (it.ppob_sn_token) {
          text += `  ┌───────────────────────┐\n`;
          text += `  │ 🔑 *TOKEN / SERIAL NUMBER:*  │\n`;
          text += `  │ *${it.ppob_sn_token}*\n`;
          text += `  └───────────────────────┘\n`;
        } else if (it.ppob_status === 'PENDING') {
          text += `  ⏳ _Status: Sedang Diproses Provider (Pending)_\n`;
        }
      }
      text += `\n`;
    }

    if (retailItems.length > 0) {
      text += `*🛍️ PRODUK RITEL & TOKO:*\n`;
      for (const it of retailItems) {
        text += `• ${it.item_name} (${it.quantity}x @ Rp ${Number(it.unit_price).toLocaleString('id-ID')})\n`;
        if (it.imei_sn) text += `  IMEI/SN: ${it.imei_sn}\n`;
        text += `  Subtotal: Rp ${Number(it.subtotal).toLocaleString('id-ID')}\n`;
      }
      text += `\n`;
    }

    text += `─────────────────────────\n`;
    text += `*TOTAL BAYAR : Rp ${Number(order?.grand_total || 0).toLocaleString('id-ID')}*\n`;
    text += `Metode Bayar : ${order?.payment_method || 'CASH'}\n`;
    if (order?.cash_tendered) {
      text += `Diterima     : Rp ${Number(order.cash_tendered).toLocaleString('id-ID')}\n`;
      text += `Kembalian    : Rp ${Number(order.change_amount || 0).toLocaleString('id-ID')}\n`;
    }
    text += `Status       : *LUNAS ✅*\n`;
    text += `─────────────────────────\n`;
    text += `Terima kasih atas kepercayaan Anda!\n`;
    text += `_Simpan pesan ini sebagai bukti pembayaran resmi._`;
    return text;
  };

  const getCleanPhone = () => {
    let clean = targetPhone.replace(/\D/g, '');
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    } else if (!clean.startsWith('62') && clean.length > 0) {
      clean = '62' + clean;
    }
    return clean;
  };

  const handleShareWhatsApp = () => {
    const phone = getCleanPhone();
    const text = encodeURIComponent(generateWhatsAppMessage());
    const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  const handleCopyWhatsApp = () => {
    const msg = generateWhatsAppMessage();
    navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[94vh] border border-slate-200 animate-fade-in">
        {/* Header Modal */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
              <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-slate-800">
                  Transaksi Berhasil
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  LUNAS
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                {invoiceNo || order?.invoice_no || 'Struk Kasir'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher: Thermal vs WhatsApp */}
            <div className="flex items-center bg-slate-200 p-0.5 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveView('thermal')}
                className={`px-3 py-1 rounded-lg cursor-pointer transition flex items-center gap-1 ${
                  activeView === 'thermal' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Struk Thermal</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('whatsapp')}
                className={`px-3 py-1 rounded-lg cursor-pointer transition flex items-center gap-1 ${
                  activeView === 'whatsapp' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Format WA</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/60 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 bg-slate-100/70 space-y-3">
          {/* Real-time Status Alert for PPOB items */}
          {currentItems?.some((it: any) => it.item_type === 'PPOB' && (it.ppob_status === 'PENDING' || String(it.ppob_sn_token || '').includes('Pending'))) && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <RefreshCw className={`w-4 h-4 text-amber-600 ${checkingStatus ? 'animate-spin' : ''}`} />
                <div className="text-xs text-amber-900 font-semibold">
                  Transaksi PPOB sedang diproses provider. Token/SN akan terbit otomatis.
                </div>
              </div>
              <button
                type="button"
                onClick={handleCheckPPOBStatus}
                disabled={checkingStatus}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
              >
                <RefreshCw className={`w-3 h-3 ${checkingStatus ? 'animate-spin' : ''}`} />
                <span>{checkingStatus ? 'Mengecek...' : 'Cek Status Terkini'}</span>
              </button>
            </div>
          )}

          {activeView === 'thermal' ? (
            <div className="space-y-3">
              {/* Paper Width Selector */}
              <div className="flex items-center justify-between bg-white px-3.5 py-2 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-600 font-medium">Ukuran Kertas Printer Thermal:</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPaperWidth('58mm')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      paperWidth === '58mm' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    58mm (Standar)
                  </button>
                  <button
                    onClick={() => setPaperWidth('80mm')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      paperWidth === '80mm' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    80mm (Lebar)
                  </button>
                </div>
              </div>

              {/* Thermal Paper Preview */}
              <div className={`flex justify-center ${paperWidth === '80mm' ? 'paper-80mm' : ''}`}>
                <div
                  id="thermal-receipt-print-area"
                  className={`bg-white p-5 shadow-md border border-slate-300 text-slate-900 rounded-xs font-mono text-[11px] leading-relaxed whitespace-pre-wrap transition-all select-text relative ${
                    paperWidth === '80mm' ? 'w-[80mm] max-w-[340px]' : 'w-[58mm] max-w-[280px]'
                  }`}
                  style={{
                    boxShadow: '0 4px 20px -2px rgba(0,0,0,0.1), 0 2px 6px -1px rgba(0,0,0,0.06)',
                  }}
                >
                  {receiptText}
                  <div className="mt-4 pt-2 border-t border-dashed border-slate-300 text-center text-[10px] text-slate-400 print:hidden select-none">
                    - - - - Batas Kertas Thermal - - - -
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* WhatsApp Share Mode */
            <div className="space-y-3.5">
              {/* Target Phone Input */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Nomor WhatsApp Pelanggan:</span>
                  </span>
                  <span className="text-[10.5px] text-slate-400 font-normal">
                    Format: 08xxx atau 628xxx
                  </span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Contoh: 081775700114"
                    value={targetPhone}
                    onChange={e => setTargetPhone(e.target.value)}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-sm font-bold focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Buka WA</span>
                  </button>
                </div>
              </div>

              {/* WhatsApp Message Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Preview Pesan WhatsApp:</span>
                  <button
                    type="button"
                    onClick={handleCopyWhatsApp}
                    className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Tersalin ke Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Salin Teks WA</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-emerald-950/90 text-emerald-50 p-4 rounded-2xl font-sans text-xs leading-relaxed border border-emerald-800 shadow-inner whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                  {generateWhatsAppMessage()}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="p-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row gap-2.5 justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleKickDrawer}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                drawerKicked
                  ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                  : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
              }`}
              title="Kirim sinyal pulsa RJ11 ke printer untuk membuka laci kasir"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>{drawerKicked ? 'Laci Terbuka!' : 'Buka Laci (RJ11)'}</span>
            </button>

            <button
              onClick={handleShareWhatsApp}
              className="px-3.5 py-2 rounded-xl text-xs font-bold border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Kirim Struk via WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Kirim WhatsApp</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              Selesai (Esc)
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs flex items-center gap-2 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Thermal</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
