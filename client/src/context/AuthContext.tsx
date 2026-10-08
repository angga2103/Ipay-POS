import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';

interface AuthContextType {
  currentUser: User | null;
  users: User[];
  tenantId: string;
  storeName: string;
  setTenant: (tenantId: string) => void;
  login: (username: string, password: string) => Promise<boolean>;
  loginWithPin: (pin: string) => Promise<boolean>;
  loginStep1: (tenantId: string, username: string, password: string) => Promise<{
    success: boolean;
    requiresPin?: boolean;
    requiresOtp?: boolean;
    tempSessionToken?: string;
    maskedEmail?: string;
    tenantId?: string;
    storeName?: string;
    userName?: string;
    hasPin?: boolean;
    simulated?: boolean;
    devOtp?: string;
    error?: string;
  }>;
  loginVerifyPin: (tempSessionToken: string, pin: string) => Promise<{
    success: boolean;
    user?: User;
    storeName?: string;
    error?: string;
  }>;
  loginVerifyOtp: (tempSessionToken: string, otpCode: string) => Promise<{
    success: boolean;
    user?: User;
    storeName?: string;
    error?: string;
  }>;
  registerStoreDirect: (data: {
    storeName: string;
    ownerName: string;
    username?: string;
    phone?: string;
    email?: string;
    password: string;
    pin: string;
  }) => Promise<{
    success: boolean;
    user?: User;
    tenantId?: string;
    storeName?: string;
    recoveryKey?: string;
    message?: string;
    error?: string;
  }>;
  registerStoreSendOtp: (storeName: string, ownerName: string, email: string) => Promise<{
    success: boolean;
    maskedEmail?: string;
    simulated?: boolean;
    devOtp?: string;
    error?: string;
  }>;
  registerStoreComplete: (data: {
    storeName: string;
    ownerName: string;
    email: string;
    phone?: string;
    password: string;
    otpCode: string;
  }) => Promise<{
    success: boolean;
    user?: User;
    tenantId?: string;
    storeName?: string;
    message?: string;
    error?: string;
  }>;
  recoverPasswordWithPin: (data: {
    tenantId: string;
    username: string;
    pin: string;
    newPassword: string;
  }) => Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }>;
  recoverPinWithPassword: (data: {
    tenantId: string;
    username: string;
    password: string;
    newPin: string;
  }) => Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }>;
  recoverWithKey: (data: {
    tenantId: string;
    recoveryKey: string;
    newPassword?: string;
    newPin?: string;
  }) => Promise<{
    success: boolean;
    newRecoveryKey?: string;
    message?: string;
    error?: string;
  }>;
  forgotPasswordSendOtp: (tenantId: string, email: string) => Promise<{
    success: boolean;
    tenantId?: string;
    maskedEmail?: string;
    simulated?: boolean;
    devOtp?: string;
    message?: string;
    error?: string;
  }>;
  resetPasswordComplete: (data: {
    tenantId: string;
    email: string;
    otpCode: string;
    newPassword: string;
  }) => Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }>;
  changePin: (oldPin: string, newPin: string) => Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }>;
  fetchRecoveryInfo: () => Promise<{ success: boolean; recoveryKey?: string }>;
  fetchTenantList: () => Promise<{ id: string; name: string }[]>;
  logout: () => void;
  switchUser: (userId: number) => void;
  setAuthenticatedUser: (user: User, token?: string) => void;
  refreshUsers: () => Promise<void>;
  verifySupervisorPin: (pin: string) => Promise<boolean>;
  hasRole: (roles: UserRole[]) => boolean;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenantId, setTenantIdState] = useState<string>(() => {
    return localStorage.getItem('pos_tenant_id') || 'default';
  });

  const [storeName, setStoreName] = useState<string>('Memuat Toko...');

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('pos_user');
    const activeTenant = localStorage.getItem('pos_tenant_id') || 'default';
    const authToken = localStorage.getItem('pos_auth_token');

    // If tenant requires auth token but token is missing, force re-login
    if (activeTenant !== 'default' && !authToken) {
      localStorage.removeItem('pos_user');
      return null;
    }

    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  });

  const [users, setUsers] = useState<User[]>([]);

  // Load tenant info & users whenever tenantId changes
  useEffect(() => {
    fetch('/api/tenant/info')
      .then(res => res.json())
      .then(data => {
        if (data.storeName) {
          setStoreName(data.storeName);
        }
      })
      .catch(() => {
        setStoreName(`KONTER ${tenantId.toUpperCase()}`);
      });

    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setUsers(data);
      })
      .catch(err => console.error('Failed to load users:', err));
  }, [tenantId]);

  const setTenant = (newTenantId: string) => {
    const clean = newTenantId.trim() || 'default';
    setTenantIdState(clean);
    localStorage.setItem('pos_tenant_id', clean);
    // Reset active user on tenant switch
    setCurrentUser(null);
    localStorage.removeItem('pos_user');
    localStorage.removeItem('pos_auth_token');
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        localStorage.setItem('pos_user', JSON.stringify(data.user));
        if (data.token) localStorage.setItem('pos_auth_token', data.token);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const loginWithPin = async (pin: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/login-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        localStorage.setItem('pos_user', JSON.stringify(data.user));
        if (data.token) localStorage.setItem('pos_auth_token', data.token);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const refreshUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch (err) {
      console.error('Failed to reload users:', err);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('pos_user');
    localStorage.removeItem('pos_auth_token');
  };

  const setAuthenticatedUser = (user: User, token?: string) => {
    setCurrentUser(user);
    localStorage.setItem('pos_user', JSON.stringify(user));
    if (token) localStorage.setItem('pos_auth_token', token);
  };

  const switchUser = (userId: number) => {
    const target = users.find(u => u.id === userId);
    if (target) {
      setCurrentUser(target);
      localStorage.setItem('pos_user', JSON.stringify(target));
    }
  };

  const verifySupervisorPin = async (pin: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      return Boolean(data.success);
    } catch {
      return false;
    }
  };

  const hasRole = (roles: UserRole[]): boolean => {
    if (!currentUser) return false;
    return roles.includes(currentUser.role);
  };

  const loginStep1 = async (targetTenantId: string, username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login-step1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: targetTenantId, username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Gagal masuk akun' };
      }
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Koneksi ke server terputus' };
    }
  };

  const loginVerifyOtp = async (tempSessionToken: string, otpCode: string) => {
    try {
      const res = await fetch('/api/auth/login-verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempSessionToken, otpCode }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Kode OTP tidak valid' };
      }
      
      setCurrentUser(data.user);
      setTenantIdState(data.tenantId);
      if (data.storeName) setStoreName(data.storeName);
      localStorage.setItem('pos_tenant_id', data.tenantId);
      localStorage.setItem('pos_user', JSON.stringify(data.user));
      if (data.token) localStorage.setItem('pos_auth_token', data.token);

      return { success: true, user: data.user, storeName: data.storeName };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal memverifikasi kode OTP' };
    }
  };

  const registerStoreSendOtp = async (newStoreName: string, ownerName: string, email: string) => {
    try {
      const res = await fetch('/api/auth/register-send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName: newStoreName, ownerName, email }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Gagal mengirim kode verifikasi' };
      }
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Koneksi ke server terputus' };
    }
  };

  const registerStoreComplete = async (payload: {
    storeName: string;
    ownerName: string;
    email: string;
    phone?: string;
    password: string;
    otpCode: string;
  }) => {
    try {
      const res = await fetch('/api/auth/register-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Pendaftaran toko gagal' };
      }

      setCurrentUser(data.user);
      setTenantIdState(data.tenantId);
      if (data.storeName) setStoreName(data.storeName);
      localStorage.setItem('pos_tenant_id', data.tenantId);
      localStorage.setItem('pos_user', JSON.stringify(data.user));
      if (data.token) localStorage.setItem('pos_auth_token', data.token);

      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal menyelesaikan pendaftaran toko' };
    }
  };

  const forgotPasswordSendOtp = async (targetTenantId: string, email: string) => {
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: targetTenantId, email }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Permintaan reset kata sandi gagal' };
      }
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Koneksi ke server terputus' };
    }
  };

  const resetPasswordComplete = async (payload: {
    tenantId: string;
    email: string;
    otpCode: string;
    newPassword: string;
  }) => {
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Gagal menyetel ulang kata sandi' };
      }
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Koneksi ke server terputus' };
    }
  };

  const changePassword = async (oldPassword: string, newPassword: string) => {
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Gagal mengubah kata sandi' };
      }
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Koneksi ke server terputus' };
    }
  };

  const changePin = async (oldPin: string, newPin: string) => {
    try {
      const res = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPin, newPin }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Gagal mengubah PIN' };
      }
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Koneksi ke server terputus' };
    }
  };

  const loginVerifyPin = async (tempSessionToken: string, pin: string) => {
    try {
      const res = await fetch('/api/auth/login-verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempSessionToken, pin }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'PIN Keamanan Toko salah' };
      }

      setCurrentUser(data.user);
      setTenantIdState(data.tenantId);
      if (data.storeName) setStoreName(data.storeName);
      localStorage.setItem('pos_tenant_id', data.tenantId);
      localStorage.setItem('pos_user', JSON.stringify(data.user));
      if (data.token) localStorage.setItem('pos_auth_token', data.token);

      return { success: true, user: data.user, storeName: data.storeName };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal memverifikasi PIN' };
    }
  };

  const registerStoreDirect = async (payload: {
    storeName: string;
    ownerName: string;
    username?: string;
    phone?: string;
    email?: string;
    password: string;
    pin: string;
  }) => {
    try {
      const res = await fetch('/api/auth/register-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Pendaftaran toko gagal' };
      }

      // Jangan panggil setCurrentUser di sini agar modal sukses registrasi & Master Recovery Key sempat tampil di LoginPage
      setTenantIdState(data.tenantId);
      if (data.storeName) setStoreName(data.storeName);
      localStorage.setItem('pos_tenant_id', data.tenantId);
      localStorage.setItem('pos_user', JSON.stringify(data.user));
      if (data.token) localStorage.setItem('pos_auth_token', data.token);

      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Koneksi ke server terputus' };
    }
  };

  const recoverPasswordWithPin = async (payload: {
    tenantId: string;
    username: string;
    pin: string;
    newPassword: string;
  }) => {
    try {
      const res = await fetch('/api/auth/recover-password-with-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Gagal memulihkan kata sandi' };
      }
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Koneksi ke server terputus' };
    }
  };

  const recoverPinWithPassword = async (payload: {
    tenantId: string;
    username: string;
    password: string;
    newPin: string;
  }) => {
    try {
      const res = await fetch('/api/auth/recover-pin-with-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Gagal memulihkan PIN' };
      }
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Koneksi ke server terputus' };
    }
  };

  const recoverWithKey = async (payload: {
    tenantId: string;
    recoveryKey: string;
    newPassword?: string;
    newPin?: string;
  }) => {
    try {
      const res = await fetch('/api/auth/recover-with-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Gagal memulihkan akun dengan kode darurat' };
      }
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Koneksi ke server terputus' };
    }
  };

  const fetchRecoveryInfo = async () => {
    try {
      const res = await fetch('/api/auth/recovery-info');
      const data = await res.json();
      return data;
    } catch {
      return { success: false };
    }
  };

  const fetchTenantList = async (): Promise<{ id: string; name: string }[]> => {
    try {
      const res = await fetch('/api/tenant/list');
      const data = await res.json();
      return Array.isArray(data.tenants) ? data.tenants : [];
    } catch {
      return [];
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        tenantId,
        storeName,
        setTenant,
        login,
        loginWithPin,
        loginStep1,
        loginVerifyPin,
        loginVerifyOtp,
        registerStoreDirect,
        registerStoreSendOtp,
        registerStoreComplete,
        recoverPasswordWithPin,
        recoverPinWithPassword,
        recoverWithKey,
        forgotPasswordSendOtp,
        resetPasswordComplete,
        changePassword,
        changePin,
        fetchRecoveryInfo,
        fetchTenantList,
        logout,
        switchUser,
        setAuthenticatedUser,
        refreshUsers,
        verifySupervisorPin,
        hasRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );

};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
