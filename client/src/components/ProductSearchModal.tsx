import React, { useState, useEffect } from 'react';
import { Search, Package, Plus, X, Loader2 } from 'lucide-react';
import { Product } from '../types';
import { useCart } from '../context/CartContext';

interface ProductSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct?: (product: Product, unitName?: string) => void;
}

export const ProductSearchModal: React.FC<ProductSearchModalProps> = ({ isOpen, onClose, onSelectProduct }) => {
  const { addItem } = useCart();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSelect = (prod: Product, unitName?: string) => {
    if (onSelectProduct) {
      onSelectProduct(prod, unitName);
    } else {
      addItem(prod, unitName);
    }
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch(`/api/products/search?q=${encodeURIComponent(query)}`)
      .then(res => res.json())
      .then(data => {
        setResults(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setResults([]);
        setLoading(false);
      });
  }, [isOpen, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-600 text-white">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-slate-800">
                  Cari Katalog Produk Ritel
                </h3>
                <span className="kbd-shortcut">F2</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Ketik nama barang, kode barcode, atau SKU
              </p>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/60">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              autoFocus
              placeholder="Cari berdasarkan nama, barcode, atau SKU..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm font-medium"
            />
          </div>
        </div>

        {/* Results List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
          {loading ? (
            <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-xs">Mencari produk...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Tidak ada produk yang cocok dengan pencarian.
            </div>
          ) : (
            results.map(prod => (
              <div
                key={prod.id}
                className="p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-xs text-slate-800">{prod.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                    <span>Barcode: {prod.barcode}</span>
                    <span>•</span>
                    <span>Stok: {prod.stock_quantity} {prod.base_uom}</span>
                  </div>
                  <div className="text-xs font-mono font-bold text-blue-700 mt-1">
                    Rp {(prod.selling_price ?? 0).toLocaleString('id-ID')} / {prod.base_uom || 'Pcs'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Base UOM button */}
                  <button
                    onClick={() => handleSelect(prod, prod.base_uom)}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ {prod.base_uom || 'Pcs'}</span>
                  </button>

                  {/* Multi-UOM buttons if available */}
                  {prod.units?.map(u => (
                    <button
                      key={u.id}
                      onClick={() => handleSelect(prod, u.unit_name)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300 cursor-pointer"
                      title={`Jual 1 ${u.unit_name} (isi ${u.conversion_factor} ${prod.base_uom || 'Pcs'}) - Rp ${(u.selling_price ?? 0).toLocaleString('id-ID')}`}
                    >
                      + {u.unit_name}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
