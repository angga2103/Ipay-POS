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
  logout: () => void;
  switchUser: (userId: number) => void;
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
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('pos_user');
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
        logout,
        switchUser,
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
