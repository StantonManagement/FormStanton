'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { UserPermission } from '@/lib/auth';

interface AdminUser {
  username: string;
  displayName: string;
  departmentId: string | null;
  departmentCode: string | null;
  permissions: UserPermission[];
  isSuperAdmin: boolean;
}

interface Impersonator {
  userId: string | null;
  displayName: string;
  startedAt: string;
}

interface AdminAuthContextValue {
  user: AdminUser | null;
  isLoading: boolean;
  isSuperAdmin: boolean;
  impersonator: Impersonator | null;
  hasPermission: (resource: string, action: string) => boolean;
  refreshAuth: () => Promise<void>;
  startImpersonate: (userId: string) => Promise<{ success: boolean; message?: string }>;
  stopImpersonate: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue>({
  user: null,
  isLoading: true,
  isSuperAdmin: false,
  impersonator: null,
  hasPermission: () => false,
  refreshAuth: async () => {},
  startImpersonate: async () => ({ success: false }),
  stopImpersonate: async () => {},
});

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [impersonator, setImpersonator] = useState<Impersonator | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/auth');
      const data = await res.json();
      if (data.isAuthenticated) {
        setUser({
          username: data.username ?? '',
          displayName: data.displayName ?? '',
          departmentId: data.departmentId ?? null,
          departmentCode: data.departmentCode ?? null,
          permissions: data.permissions ?? [],
          isSuperAdmin: data.isSuperAdmin === true,
        });
        setImpersonator(data.impersonator ?? null);
      } else {
        setUser(null);
        setImpersonator(null);
      }
    } catch {
      setUser(null);
      setImpersonator(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  // Super admins always pass; otherwise require an explicit grant (read/write/delete/admin).
  const hasPermission = useCallback(
    (resource: string, action: string): boolean => {
      if (!user) return false;
      if (user.isSuperAdmin) return true;
      return user.permissions.some(
        (p) => p.resource === resource && (p.action === action || p.action === 'admin')
      );
    },
    [user]
  );

  const startImpersonate = useCallback(
    async (userId: string): Promise<{ success: boolean; message?: string }> => {
      try {
        const res = await fetch('/api/admin/impersonate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        const data = await res.json();
        if (!data.success) {
          return { success: false, message: data.message ?? 'Failed to impersonate' };
        }
        await refreshAuth();
        return { success: true };
      } catch (err: any) {
        return { success: false, message: err?.message ?? 'Failed to impersonate' };
      }
    },
    [refreshAuth]
  );

  const stopImpersonate = useCallback(async () => {
    try {
      await fetch('/api/admin/impersonate', { method: 'DELETE' });
    } finally {
      await refreshAuth();
    }
  }, [refreshAuth]);

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        isLoading,
        isSuperAdmin: user?.isSuperAdmin === true && impersonator === null,
        impersonator,
        hasPermission,
        refreshAuth,
        startImpersonate,
        stopImpersonate,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
