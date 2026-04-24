'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import AdminSidebar from '@/components/AdminSidebar';
import { AdminAuthProvider } from '@/lib/adminAuthContext';
import CommandPalette from '@/components/admin/CommandPalette';
import AuditFooter from '@/components/admin/AuditFooter';
import ImpersonationBanner from '@/components/admin/ImpersonationBanner';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    checkAuth();
  }, [pathname]);

  useEffect(() => {
    if (!pathname || pathname === '/admin') return;
    const RECENT_KEY = 'adminRecentNav';
    const MAX = 8;
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as string[];
      const updated = [pathname, ...stored.filter((p) => p !== pathname)].slice(0, MAX);
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    } catch { /* ignore */ }
  }, [pathname]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/admin/auth');
      const data = await response.json();
      setIsAuthenticated(data.isAuthenticated);
      
      if (!data.isAuthenticated && pathname !== '/admin') {
        router.push('/admin');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <AdminAuthProvider>
      <CommandPalette />
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <AdminSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <ImpersonationBanner />
          <main className="flex-1 overflow-y-auto pb-10">
            {children}
          </main>
          <AuditFooter />
        </div>
      </div>
    </AdminAuthProvider>
  );
}
