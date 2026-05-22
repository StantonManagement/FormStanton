'use client';

/**
 * lib/pbv/context/OnlineStatusProvider.tsx
 *
 * Tiny provider + `useOnlineStatus()` hook that exposes the browser's
 * online/offline state to the tenant tree.
 *
 * PRP-011 / C4: dashboards and other tenant pages render an offline banner
 * + disable submit when this returns `false`. The default value is the
 * current `navigator.onLine` at mount; the provider then listens for
 * `online` / `offline` window events and updates.
 *
 * SSR-safe: initial server render returns `true` (treat as online) so the
 * banner doesn't flash; the client hydrates and reconciles.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const OnlineStatusContext = createContext<boolean>(true);

interface ProviderProps {
  children: ReactNode;
  /** Test-only override (skips navigator + listeners). */
  initialOnline?: boolean;
}

export function OnlineStatusProvider({ children, initialOnline }: ProviderProps) {
  const [online, setOnline] = useState<boolean>(() => {
    if (typeof initialOnline === 'boolean') return initialOnline;
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    // Reconcile in case navigator.onLine changed between mount and effect.
    if (typeof navigator !== 'undefined' && navigator.onLine !== online) {
      setOnline(navigator.onLine);
    }
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <OnlineStatusContext.Provider value={online}>{children}</OnlineStatusContext.Provider>;
}

/**
 * Returns `true` when the browser believes it is online, `false` otherwise.
 * If no provider is mounted, returns `true` (graceful default for pages
 * that haven't opted in to the banner).
 */
export function useOnlineStatus(): boolean {
  return useContext(OnlineStatusContext);
}
