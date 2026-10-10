import React, { useState } from 'react';
import { Tag, Printer, X, Check, Search, Layers, Sparkles, Copy, Sliders } from 'lucide-react';
import { Product } from '../types';

interface ShelfTagPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
}

export const ShelfTagPrintModal: React.FC<ShelfTagPrintModalProps> = ({
  isOpen,
  onClose,
  products,
}) => {
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [tagFormat, setTagFormat] = useState<'SHELF_TAG' | 'PRODUCT_STICKER' | 'MINI_STICKER'>('SHELF_TAG');
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [searchFilter, setSearchFilter] = useState('');
  const [showStoreName, setShowStoreName] = useState(true);

  if (!isOpen) return null;

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  const toggleSelectProduct = (id: number) => {
    setSelectedProductIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    if (!quantities[id]) {
      setQuantities(prev => ({ ...prev, [id]: 1 }));
    }
  };

  const handleSelectAll = () => {
    if (selectedProductIds.length === filteredProducts.length) {
      setSelectedProductIds([]);
    } else {
      const allIds = filteredProducts.map(p => p.id);
      setSelectedProductIds(allIds);
      const newQty: Record<number, number> = { ...quantities };
      allIds.forEach(id => {
        if (!newQty[id]) newQty[id] = 1;
      });
      setQuantities(newQty);
    }
  };

  const selectedProductsList = products.filter(p => selectedProductIds.includes(p.id));

  // Compute total labels to print
  const totalLabels = selectedProductsList.reduce((acc, p) => acc + (quantities[p.id] || 1), 0);

  const handlePrint = () => {
    window.print();
  };

  /**
   * Generates a visual 1D barcode pattern using deterministic bars
   */
  const renderVisualBarcode = (code: string) => {
    const cleanCode = (code || '000000').toUpperCase();
    const bars: boolean[] = [];

    // Quiet zone
    bars.push(true, false, true);

    for (let i = 0; i < cleanCode.length; i++) {
      const charCode = cleanCode.charCodeAt(i);
      bars.push((charCode % 2 === 0), (charCode % 3 === 0), (charCode % 5 !== 0), true, false);
    }

    bars.push(true, false, true, true);

    return (
      <div className="flex items-stretch justify-center h-7 sm:h-9 overflow-hidden my-1">
        {bars.map((isBlack, idx) => (
          <div
            key={idx}
            className={`w-[1.6px] sm:w-[2px] ${isBlack ? 'bg-slate-900' : 'bg-transparent'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[92vh] border border-slate-200">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-800">
                Pencetak Label Rak & Barcode Produk
              </h3>
              <p className="text-[11px] text-slate-500">
                Cetak label harga rak etalase warung atau stiker barcode kemasan produk
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="p-3 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 text-xs print:hidden">
          {/* Format selector */}
          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setTagFormat('SHELF_TAG')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                tagFormat === 'SHELF_TAG'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🏷️ Label Rak (Shelf Tag)
            </button>
            <button
              onClick={() => setTagFormat('PRODUCT_STICKER')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                tagFormat === 'PRODUCT_STICKER'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📦 Stiker Produk
            </button>
            <button
              onClick={() => setTagFormat('MINI_STICKER')}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                tagFormat === 'MINI_STICKER'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🔖 Stiker Mini
            </button>
          </div>

          <label className="flex items-center gap-1.5 text-slate-700 font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={showStoreName}
              onChange={e => setShowStoreName(e.target.checked)}
              className="rounded"
            />
            <span>Tampilkan Nama Toko</span>
          </label>

          <div className="font-extrabold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-200">
            Total Label: {totalLabels} lembar
          </div>
        </div>

        {/* Body Split Grid */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Panel: Product Selection */}
          <div className="w-full md:w-80 border-r border-slate-200 flex flex-col bg-slate-50/50 print:hidden">
            <div className="p-3 border-b border-slate-200 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari produk / barcode..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white font-medium"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 px-1">
                <span>Daftar Produk ({filteredProducts.length})</span>
                <button
                  onClick={handleSelectAll}
                  className="text-indigo-600 hover:underline cursor-pointer"
                >
                  {selectedProductIds.length === filteredProducts.length ? 'Batal Semua' : 'Pilih Semua'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-60 md:max-h-full">
              {filteredProducts.map(prod => {
                const isSelected = selectedProductIds.includes(prod.id);
                return (
                  <div
                    key={prod.id}
                    onClick={() => toggleSelectProduct(prod.id)}
                    className={`p-2 rounded-xl border text-xs flex items-center justify-between gap-2 cursor-pointer transition ${
                      isSelected
                        ? 'bg-indigo-50/90 border-indigo-300 shadow-2xs'
                        : 'bg-white hover:bg-slate-100/70 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border ${
                          isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 truncate">{prod.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Rp {prod.selling_price.toLocaleString('id-ID')} • {prod.barcode || '-'}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded-lg border border-slate-200 shrink-0"
                      >
                        <span className="text-[10px] text-slate-500 font-bold">Qty:</span>
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={quantities[prod.id] || 1}
                          onChange={e => {
                            const val = Math.max(1, parseInt(e.target.value) || 1);
                            setQuantities(prev => ({ ...prev, [prod.id]: val }));
                          }}
                          className="w-8 text-center text-xs font-bold font-mono border-0 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Live Print Preview */}
          <div className="flex-1 p-4 overflow-y-auto bg-slate-200/50 print:bg-white print:p-0 flex flex-col items-center">
            {selectedProductsList.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                <Tag className="w-12 h-12 stroke-[1.5] mb-2 text-slate-300" />
                <div className="font-extrabold text-slate-600 text-sm">Belum Ada Produk Dipilih</div>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  Silakan centang produk di panel sebelah kiri untuk melihat pratinjau label yang akan dicetak.
                </p>
              </div>
            ) : (
              <div className="w-full max-w-2xl bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 print:shadow-none print:border-none print:p-0">
                {/* Print Sheet Grid */}
                <div
                  className={`grid gap-3 sm:gap-4 print:gap-2 ${
                    tagFormat === 'SHELF_TAG'
                      ? 'grid-cols-1 sm:grid-cols-2'
                      : tagFormat === 'PRODUCT_STICKER'
                      ? 'grid-cols-2 sm:grid-cols-3'
                      : 'grid-cols-2 sm:grid-cols-4'
                  }`}
                >
                  {selectedProductsList.flatMap(prod => {
                    const count = quantities[prod.id] || 1;
                    return Array.from({ length: count }).map((_, idx) => (
                      <div
                        key={`${prod.id}-${idx}`}
                        className={`border-2 border-dashed border-slate-300 print:border-slate-800 rounded-xl p-3 flex flex-col justify-between bg-white relative break-inside-avoid ${
                          tagFormat === 'SHELF_TAG' ? 'min-h-[145px]' : 'min-h-[110px]'
                        }`}
                      >
                        {showStoreName && (
                          <div className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 print:text-black border-b border-slate-100 print:border-slate-300 pb-1 flex justify-between">
                            <span>POS IPAY RETAIL</span>
                            <span>{new Date().toLocaleDateString('id-ID')}</span>
                          </div>
                        )}

                        <div className="my-1">
                          <div className="font-black text-xs sm:text-sm text-slate-900 leading-snug line-clamp-2">
                            {prod.name}
                          </div>
                          <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                            Satuan: {prod.base_uom || 'PCS'}
                          </div>
                        </div>

                        {/* Jumbo Price */}
                        <div className="bg-slate-50 print:bg-transparent p-1.5 rounded-lg border border-slate-200 print:border-none flex items-baseline justify-between">
                          <span className="text-[10px] font-bold text-slate-600">Harga:</span>
                          <span className="text-base sm:text-xl font-black text-slate-900 font-mono tracking-tight">
                            Rp {prod.selling_price.toLocaleString('id-ID')}
                          </span>
                        </div>

                        {/* Barcode line */}
                        <div className="mt-1 text-center">
                          {renderVisualBarcode(prod.barcode || String(prod.id))}
                          <div className="font-mono text-[9px] tracking-widest text-slate-700 font-bold">
                            {prod.barcode || `PRD-${String(prod.id).padStart(6, '0')}`}
                          </div>
                        </div>
                      </div>
                    ));
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Action Bar */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between print:hidden">
          <div className="text-xs text-slate-500">
            💡 <em>Gunakan kertas stiker A4 Tom & Jerry atau printer label termal untuk hasil terbaik.</em>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              disabled={selectedProductsList.length === 0}
              onClick={handlePrint}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak {totalLabels} Label Sekarang</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
