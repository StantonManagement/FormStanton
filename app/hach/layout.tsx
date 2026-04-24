'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const ACCENT = '#0f4c5c';
const FONT = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif";

export default function HachLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authState, setAuthState] = useState<'loading' | 'ready' | 'redirecting'>('loading');
  const [displayName, setDisplayName] = useState('');
  const [userType, setUserType] = useState('');

  useEffect(() => {
    // Load IBM Plex Sans if not already present
    if (!document.getElementById('ibm-plex-link')) {
      const link = document.createElement('link');
      link.id = 'ibm-plex-link';
      link.rel = 'stylesheet';
      link.href =
        'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    const isLoginPage =
      pathname === '/hach/login' || pathname.startsWith('/hach/login');
    const isAcceptInvite =
      pathname === '/hach/accept-invite' || pathname.startsWith('/hach/accept-invite');
    if (isLoginPage || isAcceptInvite) {
      setAuthState('ready');
      return;
    }
    checkAuth();
  }, [pathname]);

  async function checkAuth() {
    try {
      const res = await fetch('/api/admin/auth');
      const data = await res.json();

      if (!data.isAuthenticated) {
        setAuthState('redirecting');
        router.push('/hach/login');
        return;
      }
      if (data.user_type === 'stanton_staff' || !data.user_type) {
        setAuthState('redirecting');
        router.push('/admin');
        return;
      }
      setDisplayName(data.displayName || '');
      setUserType(data.user_type || '');
      setAuthState('ready');
    } catch {
      setAuthState('redirecting');
      router.push('/hach/login');
    }
  }

  async function handleLogout() {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    router.push('/hach/login');
  }

  const isLoginPage =
    pathname === '/hach/login' || pathname.startsWith('/hach/login');
  const isAcceptInvitePage =
    pathname === '/hach/accept-invite' || pathname.startsWith('/hach/accept-invite');

  if (authState === 'loading') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#fafaf9',
          fontFamily: FONT,
          color: '#78716c',
          fontSize: 14,
        }}
      >
        Loading…
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf9', fontFamily: FONT }}>
      {!isLoginPage && !isAcceptInvitePage && (
        <header
          style={{
            height: 52,
            background: ACCENT,
            display: 'flex',
            alignItems: 'center',
            padding: '0 24px',
            gap: 16,
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          <a
            href="/hach"
            style={{
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: '0.05em',
              textDecoration: 'none',
              textTransform: 'uppercase',
            }}
          >
            HACH · Reviewer Portal
          </a>
          {userType === 'hach_admin' && (
            <div style={{ display: 'flex', gap: 2, marginLeft: 24 }}>
              <a
                href="/hach/admin/users"
                style={{
                  color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 500,
                  textDecoration: 'none', padding: '4px 10px',
                  background: pathname.startsWith('/hach/admin/users') ? 'rgba(255,255,255,0.15)' : 'transparent',
                }}
              >
                Users
              </a>
              <a
                href="/hach/admin/audit-log"
                style={{
                  color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 500,
                  textDecoration: 'none', padding: '4px 10px',
                  background: pathname.startsWith('/hach/admin/audit-log') ? 'rgba(255,255,255,0.15)' : 'transparent',
                }}
              >
                Audit Log
              </a>
            </div>
          )}
          <div style={{ flex: 1 }} />
          {displayName && (
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
              {displayName}
            </span>
          )}
          <button
            onClick={handleLogout}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.35)',
              color: 'rgba(255,255,255,0.9)',
              padding: '4px 12px',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: FONT,
              letterSpacing: '0.02em',
            }}
          >
            Sign out
          </button>
        </header>
      )}
      <main>{children}</main>
    </div>
  );
}
