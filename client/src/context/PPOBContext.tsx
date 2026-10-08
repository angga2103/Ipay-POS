import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface PPOBContextType {
  balance: number;
  lowBalanceAlert: boolean;
  mode: string;
  loading: boolean;
  refreshBalance: () => Promise<void>;
}

const PPOBContext = createContext<PPOBContextType | undefined>(undefined);

export const PPOBProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [balance, setBalance] = useState<number>(0);
  const [lowBalanceAlert, setLowBalanceAlert] = useState<boolean>(false);
  const [mode, setMode] = useState<string>('sandbox');
  const [loading, setLoading] = useState<boolean>(false);

  const refreshBalance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ppob/balance');
      if (res.ok) {
        const data = await res.json();
        setBalance(typeof data?.balance === 'number' ? data.balance : 0);
        setLowBalanceAlert(Boolean(data?.lowBalanceAlert));
        setMode(data?.mode || 'sandbox');
      }
    } catch (err) {
      console.error('Failed to fetch PPOB balance:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBalance();
    // Auto-poll balance every 30 seconds
    const interval = setInterval(refreshBalance, 30000);
    return () => clearInterval(interval);
  }, [refreshBalance]);

  return (
    <PPOBContext.Provider value={{ balance, lowBalanceAlert, mode, loading, refreshBalance }}>
      {children}
    </PPOBContext.Provider>
  );
};

export const usePPOB = () => {
  const context = useContext(PPOBContext);
  if (!context) throw new Error('usePPOB must be used within a PPOBProvider');
  return context;
};
