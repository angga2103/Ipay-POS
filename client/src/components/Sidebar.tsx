import React from 'react';
import { 
  ShoppingCart, Package, Zap, Clock, BookOpen, 
  FileText, Settings, Shield, Wrench, Users, Truck,
  ChevronLeft, PanelLeftClose, PanelLeftOpen 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const { currentUser } = useAuth();
  const role = currentUser?.role || 'cashier';

  const menuItems = [
    {
      id: 'pos',
      label: 'Kasir POS',
      icon: ShoppingCart,
      hotkey: 'F1-F12',
      badge: 'Utama',
      roles: ['owner', 'supervisor', 'cashier'],
    },
    {
      id: 'ppob',
      label: 'PPOB ipay.my.id',
      icon: Zap,
      badge: 'Engine',
      roles: ['owner', 'supervisor', 'cashier'],
    },
    {
      id: 'services',
      label: 'Servis HP & Gadget',
      icon: Wrench,
      badge: 'Baru',
      roles: ['owner', 'supervisor', 'cashier'],
    },
    {
      id: 'customers',
      label: 'Pelanggan & Kasbon',
      icon: Users,
      badge: 'Kasbon',
      roles: ['owner', 'supervisor', 'cashier'],
    },
    {
      id: 'suppliers',
      label: 'Supplier & Hutang',
      icon: Truck,
      badge: 'Hutang',
      roles: ['owner', 'supervisor'],
    },
    {
      id: 'inventory',
      label: 'Katalog & Inventaris',
      icon: Package,
      roles: ['owner', 'supervisor'],
    },
    {
      id: 'shift',
      label: 'Shift & Kas Laci',
      icon: Clock,
      roles: ['owner', 'supervisor', 'cashier'],
    },
    {
      id: 'accounting',
      label: 'Buku Besar & P&L',
      icon: BookOpen,
      roles: ['owner', 'supervisor'],
    },
    {
      id: 'reports',
      label: 'Riwayat & Struk',
      icon: FileText,
      roles: ['owner', 'supervisor', 'cashier'],
    },
    {
      id: 'settings',
      label: 'Pengaturan & Hardware',
      icon: Settings,
      roles: ['owner'],
    },
  ];

  return (
    <aside className={`hidden md:flex bg-white border-r border-slate-200 flex-col justify-between select-none transition-all duration-200 ease-in-out shrink-0 ${
      isCollapsed ? 'md:w-16' : 'md:w-56'
    }`}>
      <div className={`py-3 space-y-1 ${isCollapsed ? 'px-2' : 'px-2.5'}`}>
        {menuItems
          .filter(item => item.roles.includes(role))
          .map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <div key={item.id} className="relative group">
                <button
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center rounded-xl text-left transition font-semibold text-xs cursor-pointer ${
                    isCollapsed 
                      ? 'justify-center p-2.5' 
                      : 'gap-3 px-3 py-2.5'
                  } ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/30'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  title={isCollapsed ? `${item.label} ${item.hotkey ? `(${item.hotkey})` : ''}` : undefined}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  
                  {!isCollapsed && (
                    <>
                      <span className="truncate">{item.label}</span>
                      {item.hotkey && (
                        <span className={`ml-auto text-[9px] px-1 py-0.5 rounded font-mono ${
                          isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {item.hotkey}
                        </span>
                      )}
                    </>
                  )}
                </button>

                {/* Floating Tooltip saat Sidebar Dikecilkan (Hanya Ikon) */}
                {isCollapsed && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden group-hover:flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-xl whitespace-nowrap z-50 pointer-events-none animate-fade-in border border-slate-800">
                    <span>{item.label}</span>
                    {item.hotkey && (
                      <span className="text-[9.5px] bg-slate-800 text-blue-300 px-1.5 py-0.5 rounded font-mono border border-slate-700">
                        {item.hotkey}
                      </span>
                    )}
                    {item.badge && (
                      <span className="text-[9px] bg-blue-500/30 text-blue-300 px-1.5 py-0.5 rounded font-bold uppercase">
                        {item.badge}
                      </span>
                    )}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 -mr-1 border-4 border-transparent border-r-slate-900" />
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Bottom Footer Info & Collapse Toggle */}
      <div className={`border-t border-slate-100 hidden md:block ${isCollapsed ? 'p-2' : 'p-3'}`}>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            type="button"
            className={`w-full flex items-center rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer mb-2 ${
              isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2 text-xs font-semibold'
            }`}
            title={isCollapsed ? "Perluas Sidebar Menu" : "Kecilkan Sidebar (Hanya Ikon)"}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-5 h-5 text-slate-600 hover:text-blue-600" />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <PanelLeftClose className="w-4 h-4 text-slate-500" />
                  <span>Kecilkan Menu</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </>
            )}
          </button>
        )}

        {/* Double-Entry POS Info Card (Tampil saat Diperluas) */}
        {!isCollapsed ? (
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              <span>Double-Entry POS</span>
            </div>
            <p className="text-[10px] leading-relaxed">
              HPP Ritel & Saldo Deposit PPOB tercatat terpisah dan otomatis.
            </p>
          </div>
        ) : (
          <div className="flex justify-center py-1 text-slate-400" title="Double-Entry Accounting POS Aktif">
            <Shield className="w-4 h-4 text-slate-400 hover:text-blue-600 transition" />
          </div>
        )}
      </div>
    </aside>
  );
};
