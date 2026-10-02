import React from 'react';
import { 
  ShoppingCart, Package, Zap, Clock, BookOpen, 
  FileText, Settings, Shield, Wrench, Users, Truck 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
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
    <aside className="hidden md:flex md:w-56 bg-white border-r border-slate-200 flex-col justify-between select-none">
      <div className="py-3 px-2 space-y-1">
        {menuItems
          .filter(item => item.roles.includes(role))
          .map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition font-semibold text-xs cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/30'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                title={item.label}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span className="hidden md:inline truncate">{item.label}</span>
                {item.hotkey && (
                  <span className={`hidden md:inline-block ml-auto text-[9px] px-1 py-0.5 rounded font-mono ${
                    isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {item.hotkey}
                  </span>
                )}
              </button>
            );
          })}
      </div>

      {/* Bottom Footer Info */}
      <div className="p-3 border-t border-slate-100 hidden md:block">
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            <span>Double-Entry POS</span>
          </div>
          <p className="text-[10px] leading-relaxed">
            HPP Ritel & Saldo Deposit PPOB tercatat terpisah dan otomatis.
          </p>
        </div>
      </div>
    </aside>
  );
};
