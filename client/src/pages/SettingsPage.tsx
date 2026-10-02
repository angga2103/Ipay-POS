import React, { useState, useEffect } from 'react';
import { Settings, Printer, Store, Save, DollarSign } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeFooter, setStoreFooter] = useState('');
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('58mm');
  const [autoOpenDrawer, setAutoOpenDrawer] = useState('true');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
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
  }, []);

  const handleSave = async (e: React.FormEvent) => {
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

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-57px)] overflow-y-auto bg-slate-100 p-4 space-y-4">
      {/* Title */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-lg font-black text-slate-800">
            Pengaturan Toko & Perangkat Keras
          </h1>
          <p className="text-xs text-slate-500">
            Profil minimarket, ukuran kertas thermal printer (58mm/80mm), dan laci kasir RJ11
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              rows={3}
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
              <span className="text-xs font-bold text-emerald-600">Pengaturan berhasil disimpan!</span>
            ) : <span />}

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
