import React, { useState } from 'react';
import { 
  ShoppingCart, Zap, Wrench, Clock, MoreHorizontal, 
  Package, BookOpen, FileText, Settings, X, Shield, Users, Truck 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  cartItemCount?: number;
  onOpenMobileCart?: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ 
  activeTab, 
  setActiveTab, 
  cartItemCount = 0,
  onOpenMobileCart 
}) => {
  const { currentUser } = useAuth();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const role = currentUser?.role || 'cashier';

  const mainTabs = [
    { id: 'pos', label: 'Kasir', icon: ShoppingCart },
    { id: 'ppob', label: 'PPOB', icon: Zap },
    { id: 'services', label: 'Servis', icon: Wrench },
    { id: 'shift', label: 'Shift', icon: Clock },
  ];

  const moreItems = [
    { id: 'customers', label: 'Pelanggan & Kasbon', icon: Users, roles: ['owner', 'supervisor', 'cashier'] },
    { id: 'suppliers', label: 'Supplier & Hutang', icon: Truck, roles: ['owner', 'supervisor'] },
    { id: 'inventory', label: 'Inventaris & Stok', icon: Package, roles: ['owner', 'supervisor'] },
    { id: 'accounting', label: 'Buku Besar & P&L', icon: BookOpen, roles: ['owner', 'supervisor'] },
    { id: 'reports', label: 'Riwayat Struk', icon: FileText, roles: ['owner', 'supervisor', 'cashier'] },
    { id: 'settings', label: 'Pengaturan POS', icon: Settings, roles: ['owner'] },
  ];

  return (
    <>
      {/* Floating Action / Mobile Cart Drawer Trigger if on POS */}
      {activeTab === 'pos' && cartItemCount > 0 && onOpenMobileCart && (
        <div className="fixed bottom-18 left-0 right-0 px-4 md:hidden z-30 pointer-events-none">
          <button
            onClick={onOpenMobileCart}
            type="button"
            className="w-full pointer-events-auto py-3 px-4 rounded-2xl bg-linear-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-xl shadow-blue-600/30 flex items-center justify-between transition active:scale-98 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">
                {cartItemCount}
              </span>
              <span>Lihat Keranjang Belanja</span>
            </div>
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-lg">Bayar Sekarang &rarr;</span>
          </button>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 z-40 flex items-center justify-around px-2 shadow-lg safe-area-bottom">
        {mainTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setShowMoreMenu(false);
              }}
              className={`flex-1 h-full min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition active:scale-95 cursor-pointer relative ${
                isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600 scale-110' : 'text-slate-500'}`} />
                {tab.id === 'pos' && cartItemCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">
                    {cartItemCount}
                  </span>
                )}
              </div>
              <span className="text-[10.5px] leading-tight tracking-tight">{tab.label}</span>
              {isActive && (
                <span className="w-4 h-1 bg-blue-600 rounded-full absolute bottom-1" />
              )}
            </button>
          );
        })}

        {/* More Menu Trigger */}
        <button
          onClick={() => setShowMoreMenu(true)}
          className={`flex-1 h-full min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition active:scale-95 cursor-pointer ${
            showMoreMenu || ['inventory', 'accounting', 'reports', 'settings'].includes(activeTab)
              ? 'text-blue-600 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10.5px] leading-tight">Lainnya</span>
        </button>
      </nav>

      {/* More Modal / Bottom Sheet */}
      {showMoreMenu && (
        <div className="fixed inset-0 z-50 md:hidden bg-slate-900/60 backdrop-blur-xs flex flex-col justify-end animate-fade-in">
          <div className="bg-white rounded-t-3xl p-5 shadow-2xl border-t border-slate-200 animate-slide-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Shield className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-sm text-slate-800">Menu Tambahan POS</h3>
              </div>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 my-2">
              {moreItems
                .filter(item => item.roles.includes(role))
                .map(item => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setShowMoreMenu(false);
                      }}
                      className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition min-h-[52px] cursor-pointer ${
                        isActive
                          ? 'bg-blue-50 border-blue-300 text-blue-800 font-bold'
                          : 'bg-slate-50/80 border-slate-200/80 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className={`p-2 rounded-xl ${isActive ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 shadow-xs'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-semibold">{item.label}</span>
                    </button>
                  );
                })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-400">
                Login sebagai: <strong className="text-slate-700">{currentUser?.name}</strong> ({currentUser?.role})
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
