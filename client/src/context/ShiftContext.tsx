import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Shift } from '../types';
import { useAuth } from './AuthContext';

interface ShiftContextType {
  activeShift: Shift | null;
  loading: boolean;
  refreshShift: () => Promise<void>;
  openShift: (openingCash: number, cashierId?: number, pin?: string) => Promise<any>;
  closeShift: (actualCash: number, notes?: string) => Promise<any>;
  addCashMovement: (type: 'CASH_IN' | 'CASH_OUT', amount: number, reason: string) => Promise<void>;
}

const ShiftContext = createContext<ShiftContextType | undefined>(undefined);

export const ShiftProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, setAuthenticatedUser } = useAuth();
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshShift = useCallback(async () => {
    try {
      const url = currentUser ? `/api/shifts/active?cashierId=${currentUser.id}` : '/api/shifts/active';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && data.id && typeof data.shift_number === 'string') {
          setActiveShift(data);
        } else {
          setActiveShift(null);
        }
      } else {
        setActiveShift(null);
      }
    } catch (err) {
      console.error('Failed to load active shift:', err);
      setActiveShift(null);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    refreshShift();
  }, [refreshShift]);

  const openShift = async (openingCash: number, cashierId?: number, pin?: string) => {
    const targetCashierId = cashierId || currentUser?.id;
    if (!targetCashierId) throw new Error('Silakan pilih operator');
    const res = await fetch('/api/shifts/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cashierId: targetCashierId, openingCash, pin }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Gagal membuka shift');
    }
    const data = await res.json();
    if (data.user && setAuthenticatedUser) {
      setAuthenticatedUser(data.user, data.token);
    }
    await refreshShift();
    return data;
  };

  const closeShift = async (actualCash: number, notes?: string) => {
    if (!activeShift) throw new Error('Tidak ada shift aktif untuk ditutup');
    const res = await fetch(`/api/shifts/${activeShift.id}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actualCash, notes }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Gagal menutup shift');
    }
    const zReport = await res.json();
    await refreshShift();
    return zReport;
  };

  const addCashMovement = async (type: 'CASH_IN' | 'CASH_OUT', amount: number, reason: string) => {
    if (!activeShift || !currentUser) throw new Error('Shift aktif tidak ditemukan');
    const res = await fetch('/api/shifts/cash-movement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shiftId: activeShift.id,
        cashierId: currentUser.id,
        type,
        amount,
        reason,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Gagal mencatat transaksi kas');
    }
    await refreshShift();
  };

  return (
    <ShiftContext.Provider value={{ activeShift, loading, refreshShift, openShift, closeShift, addCashMovement }}>
      {children}
    </ShiftContext.Provider>
  );
};

export const useShift = () => {
  const context = useContext(ShiftContext);
  if (!context) throw new Error('useShift must be used within a ShiftProvider');
  return context;
};
