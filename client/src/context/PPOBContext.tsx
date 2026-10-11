import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, Sparkles, X, Megaphone, AlertTriangle, Info, Gift, Flame, BellRing } from 'lucide-react';
import { playSuccessChime } from '../utils/audio';
import { useAuth } from './AuthContext';

export type ProvisionStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PPOBBroadcast {
  id: number | string;
  title: string;
  message: string;
  level: 'info' | 'warning' | 'promo' | 'urgent' | string;
  created_at?: string;
}

interface WebhookToastData {
  id: string;
  event: string;
  message: string;
  level?: string;
  timestamp?: string;
}

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
  broadcasts: PPOBBroadcast[];
  dismissedBroadcastIds: string[];
  dismissBroadcast: (id: number | string) => void;
  refreshBroadcasts: () => Promise<void>;
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

const DISMISSED_BROADCASTS_KEY = 'pos_dismissed_broadcasts_v1';

export const PPOBProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, tenantId } = useAuth();
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

  // Broadcasts & Command Center Webhook states
  const [broadcasts, setBroadcasts] = useState<PPOBBroadcast[]>([]);
  const [dismissedBroadcastIds, setDismissedBroadcastIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(DISMISSED_BROADCASTS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [webhookToast, setWebhookToast] = useState<WebhookToastData | null>(null);
  const lastSeenWebhookIdRef = useRef<string | null>(null);

  const dismissBroadcast = useCallback((id: number | string) => {
    const strId = String(id);
    setDismissedBroadcastIds(prev => {
      const next = prev.includes(strId) ? prev : [...prev, strId];
      try {
        localStorage.setItem(DISMISSED_BROADCASTS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const refreshBroadcasts = useCallback(async () => {
    try {
      const res = await fetch('/api/ppob/broadcasts');
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json?.broadcasts)
          ? json.broadcasts
          : (Array.isArray(json?.data) ? json.data : null);
        if (Array.isArray(list)) {
          setBroadcasts(list);
        }
      }
    } catch {}
  }, []);

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
    if (Array.isArray(data.broadcasts)) {
      setBroadcasts(data.broadcasts);
    }
    if (data.lastWebhookEvent && data.lastWebhookEvent.id) {
      const evt = data.lastWebhookEvent as WebhookToastData;
      if (lastSeenWebhookIdRef.current === null) {
        lastSeenWebhookIdRef.current = evt.id;
        // If the webhook event happened within the last 15 seconds, show it!
        const ageMs = evt.timestamp ? Date.now() - new Date(evt.timestamp).getTime() : 999999;
        if (ageMs >= 0 && ageMs < 15000) {
          setWebhookToast(evt);
          try { playSuccessChime(); } catch {}
        }
      } else if (lastSeenWebhookIdRef.current !== evt.id) {
        lastSeenWebhookIdRef.current = evt.id;
        setWebhookToast(evt);
        try { playSuccessChime(); } catch {}
      }
    }
  }, []);

  // Auto-hide webhook toast after 8 seconds
  useEffect(() => {
    if (!webhookToast) return;
    const t = setTimeout(() => setWebhookToast(null), 8000);
    return () => clearTimeout(t);
  }, [webhookToast]);

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
    if (!currentUser) return;
    refreshBalance();
    pollProvisionStatus(true);
    // Auto-poll balance & active broadcasts every 15 seconds
    const interval = setInterval(refreshBalance, 15000);
    return () => clearInterval(interval);
  }, [currentUser, tenantId, refreshBalance, pollProvisionStatus]);

  // Fast 5-second auto-polling while waiting for Admin Telegram approval (PENDING or unconfigured store)
  useEffect(() => {
    if (!currentUser) return;
    if (isLiveConfigured && provisionStatus !== 'PENDING') return;
    if (provisionStatus !== 'PENDING' && tenantId === 'default') return;
    const fastTimer = setInterval(() => {
      pollProvisionStatus(true);
    }, 5000);
    return () => clearInterval(fastTimer);
  }, [currentUser, tenantId, isLiveConfigured, provisionStatus, pollProvisionStatus]);

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
        broadcasts,
        dismissedBroadcastIds,
        dismissBroadcast,
        refreshBroadcasts,
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

      {/* Real-Time Webhook Push Toast (POS Command Center: transaction.updated, balance.updated, deposit.approved, pos.broadcast, credentials.synced) */}
      {webhookToast && (
        <div className="fixed bottom-4 left-4 z-[90] max-w-md w-full bg-slate-900 text-white p-3.5 rounded-2xl shadow-2xl border border-indigo-400/50">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl shrink-0">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-black uppercase tracking-wider text-indigo-300">
                  Update Instan Pusat iPay ({webhookToast.event})
                </div>
                <p className="text-xs text-slate-100 mt-0.5 leading-relaxed font-medium">
                  {webhookToast.message}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setWebhookToast(null)}
              className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white cursor-pointer shrink-0"
              title="Tutup notifikasi"
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

/**
 * Top Broadcast Banner Bar from Admin ipay.my.id (supports level: info | warning | promo | urgent & per-id dismiss)
 */
export const POSBroadcastBanner: React.FC = () => {
  const { broadcasts, dismissedBroadcastIds, dismissBroadcast } = usePPOB();

  const visibleBroadcasts = broadcasts.filter(
    b => b && (b.title || b.message) && !dismissedBroadcastIds.includes(String(b.id))
  );

  if (visibleBroadcasts.length === 0) return null;

  const getLevelConfig = (rawLevel: string) => {
    const level = String(rawLevel || 'info').toLowerCase();
    if (level === 'urgent' || level === 'danger' || level === 'error') {
      return {
        container: 'bg-linear-to-r from-rose-600 via-red-600 to-rose-700 text-white border-b border-rose-400/50',
        badge: 'bg-white/20 text-white border border-white/30',
        badgeLabel: 'URGENT',
        icon: <Flame className="w-4 h-4 text-amber-200 shrink-0" />,
        closeBtn: 'bg-white/15 hover:bg-white/25 text-white',
      };
    }
    if (level === 'warning' || level === 'warn') {
      return {
        container: 'bg-linear-to-r from-amber-500 via-orange-500 to-amber-600 text-white border-b border-amber-300/60',
        badge: 'bg-black/20 text-amber-50 border border-white/25',
        badgeLabel: 'PERINGATAN',
        icon: <AlertTriangle className="w-4 h-4 text-amber-100 shrink-0" />,
        closeBtn: 'bg-black/15 hover:bg-black/25 text-white',
      };
    }
    if (level === 'promo' || level === 'success') {
      return {
        container: 'bg-linear-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white border-b border-emerald-400/50',
        badge: 'bg-white/20 text-emerald-50 border border-white/30',
        badgeLabel: 'PROMO',
        icon: <Gift className="w-4 h-4 text-amber-200 shrink-0" />,
        closeBtn: 'bg-white/15 hover:bg-white/25 text-white',
      };
    }
    // default: info (blue)
    return {
      container: 'bg-linear-to-r from-blue-600 via-indigo-600 to-blue-700 text-white border-b border-blue-400/50',
      badge: 'bg-white/20 text-blue-50 border border-white/30',
      badgeLabel: 'INFO PUSAT',
      icon: <Info className="w-4 h-4 text-blue-100 shrink-0" />,
      closeBtn: 'bg-white/15 hover:bg-white/25 text-white',
    };
  };

  return (
    <div className="w-full shrink-0 z-30 flex flex-col">
      {visibleBroadcasts.map(item => {
        const cfg = getLevelConfig(item.level);
        return (
          <div
            key={String(item.id)}
            className={`px-3 py-2 shadow-sm transition-all ${cfg.container}`}
          >
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="p-1.5 rounded-lg bg-white/15 shrink-0 flex items-center justify-center">
                  {cfg.icon || <Megaphone className="w-4 h-4" />}
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${cfg.badge}`}>
                  {cfg.badgeLabel}
                </span>
                <div className="min-w-0 flex-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  {item.title && (
                    <span className="font-extrabold text-xs sm:text-sm tracking-tight">
                      {item.title}
                    </span>
                  )}
                  {item.message && (
                    <span className="text-xs text-white/95 font-medium leading-snug">
                      {item.title ? `— ${item.message}` : item.message}
                    </span>
                  )}
                  {item.created_at && (
                    <span className="text-[10px] text-white/75 font-mono shrink-0">
                      ({item.created_at})
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismissBroadcast(item.id)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0 transition-colors ${cfg.closeBtn}`}
                title="Tutup pengumuman ini"
              >
                <span className="hidden sm:inline">Tutup</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const usePPOB = () => {
  const context = useContext(PPOBContext);
  if (!context) throw new Error('usePPOB must be used within a PPOBProvider');
  return context;
};

