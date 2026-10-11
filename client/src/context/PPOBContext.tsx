import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Sparkles, X } from 'lucide-react';
import { playSuccessChime } from '../utils/audio';

export type ProvisionStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

interface PPOBContextType {
  balance: number;
  lowBalanceAlert: boolean;
  mode: string;
  loading: boolean;
  isLiveConfigured: boolean;
  provisionStatus: ProvisionStatus;
  provisionRequestId: string;
  provisionReason: string;
  justApproved: boolean;
  merchantId: string;
  storeName: string;
  ownerName: string;
  phone: string;
  refreshBalance: () => Promise<void>;
  pollProvisionStatus: (forceUpstream?: boolean) => Promise<any>;
  requestAutoProvision: (params: { storeName?: string; ownerName?: string; phone?: string }) => Promise<{
    success: boolean;
    status: ProvisionStatus;
    requestId?: string;
    message: string;
  }>;
  dismissProvisionBanner: () => Promise<void>;
}

const PPOBContext = createContext<PPOBContextType | undefined>(undefined);

export const PPOBProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [balance, setBalance] = useState<number>(0);
  const [lowBalanceAlert, setLowBalanceAlert] = useState<boolean>(false);
  const [mode, setMode] = useState<string>('sandbox');
  const [loading, setLoading] = useState<boolean>(false);

  // Auto-Provisioning states
  const [isLiveConfigured, setIsLiveConfigured] = useState<boolean>(false);
  const [provisionStatus, setProvisionStatus] = useState<ProvisionStatus>('NONE');
  const [provisionRequestId, setProvisionRequestId] = useState<string>('');
  const [provisionReason, setProvisionReason] = useState<string>('');
  const [justApproved, setJustApproved] = useState<boolean>(false);
  const [merchantId, setMerchantId] = useState<string>('');
  const [storeName, setStoreName] = useState<string>('');
  const [ownerName, setOwnerName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');

  const applyProvisionData = useCallback((data: any) => {
    if (!data) return;
    if (typeof data.isLiveConfigured === 'boolean') setIsLiveConfigured(data.isLiveConfigured);
    if (data.status) setProvisionStatus(data.status as ProvisionStatus);
    if (data.provisionStatus) setProvisionStatus(data.provisionStatus as ProvisionStatus);
    if (typeof data.requestId === 'string') setProvisionRequestId(data.requestId);
    if (typeof data.rejectionReason === 'string') setProvisionReason(data.rejectionReason);
    if (typeof data.justApproved === 'boolean') {
      setJustApproved(prev => {
        if (!prev && data.justApproved) {
          try { playSuccessChime(); } catch {}
        }
        return data.justApproved;
      });
    }
    if (typeof data.merchantId === 'string') setMerchantId(data.merchantId);
    if (typeof data.storeName === 'string') setStoreName(data.storeName);
    if (typeof data.ownerName === 'string') setOwnerName(data.ownerName);
    if (typeof data.phone === 'string') setPhone(data.phone);
    if (data.mode) setMode(data.mode);
  }, []);

  const refreshBalance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ppob/balance');
      if (res.ok) {
        const data = await res.json();
        setBalance(typeof data?.balance === 'number' ? data.balance : 0);
        setLowBalanceAlert(Boolean(data?.lowBalanceAlert));
        setMode(data?.mode || 'sandbox');
        applyProvisionData(data);
      }
    } catch (err) {
      console.error('Failed to fetch PPOB balance:', err);
    } finally {
      setLoading(false);
    }
  }, [applyProvisionData]);

  const pollProvisionStatus = useCallback(async (forceUpstream = false) => {
    try {
      const res = await fetch(`/api/ppob/provision/status${forceUpstream ? '?poll=true' : ''}`);
      if (res.ok) {
        const data = await res.json();
        applyProvisionData(data);
        if (data.status === 'APPROVED' && data.isLiveConfigured) {
          refreshBalance();
        }
        return data;
      }
    } catch (err) {
      console.error('Failed to poll provision status:', err);
    }
    return null;
  }, [applyProvisionData, refreshBalance]);

  const requestAutoProvision = useCallback(async (params: { storeName?: string; ownerName?: string; phone?: string }) => {
    try {
      const res = await fetch('/api/ppob/provision/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data.success) {
        await pollProvisionStatus(false);
        await refreshBalance();
      }
      return {
        success: Boolean(data.success),
        status: (data.status || 'NONE') as ProvisionStatus,
        requestId: data.requestId,
        message: data.message || (data.success ? 'Permohonan terkirim' : 'Gagal mengirim permohonan'),
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'NONE' as ProvisionStatus,
        message: err.message || 'Gagal menghubungi server',
      };
    }
  }, [pollProvisionStatus, refreshBalance]);

  const dismissProvisionBanner = useCallback(async () => {
    setJustApproved(false);
    try {
      await fetch('/api/ppob/provision/dismiss-banner', { method: 'POST' });
    } catch {}
  }, []);

  useEffect(() => {
    refreshBalance();
    pollProvisionStatus(false);
    // Auto-poll balance every 30 seconds
    const interval = setInterval(refreshBalance, 30000);
    return () => clearInterval(interval);
  }, [refreshBalance, pollProvisionStatus]);

  // Fast 5-second auto-polling while waiting for Admin Telegram approval (PENDING)
  useEffect(() => {
    if (provisionStatus !== 'PENDING') return;
    const fastTimer = setInterval(() => {
      pollProvisionStatus(true);
    }, 5000);
    return () => clearInterval(fastTimer);
  }, [provisionStatus, pollProvisionStatus]);

  return (
    <PPOBContext.Provider
      value={{
        balance,
        lowBalanceAlert,
        mode,
        loading,
        isLiveConfigured,
        provisionStatus,
        provisionRequestId,
        provisionReason,
        justApproved,
        merchantId,
        storeName,
        ownerName,
        phone,
        refreshBalance,
        pollProvisionStatus,
        requestAutoProvision,
        dismissProvisionBanner,
      }}
    >
      {/* Global Real-Time Celebration Toast when Admin Clicks [TERIMA] in Telegram */}
      {justApproved && isLiveConfigured && (
        <div className="fixed bottom-4 right-4 z-[90] max-w-md w-full bg-linear-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-4 rounded-2xl shadow-2xl border-2 border-emerald-300 animate-bounce-short">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white/20 rounded-xl shrink-0">
                <Sparkles className="w-6 h-6 text-amber-300 fill-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 font-black text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>Akun PPOB ipay.my.id Aktif Otomatis!</span>
                </div>
                <p className="text-xs text-emerald-50 mt-1 leading-relaxed">
                  Admin baru saja menyetujui pengajuan Anda via Telegram. Kredensial Live (<strong className="font-mono">{merchantId}</strong>) & katalog produk telah tersambung otomatis!
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissProvisionBanner}
              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer shrink-0"
              title="Tutup pemberitahuan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {children}
    </PPOBContext.Provider>
  );
};

export const usePPOB = () => {
  const context = useContext(PPOBContext);
  if (!context) throw new Error('usePPOB must be used within a PPOBProvider');
  return context;
};

