'use client';

import { useState, useCallback, useRef } from 'react';
import type { ToastItem } from '@/components/kit/Toast';

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(0);

  const showToast = useCallback((message: string, onUndo?: () => void) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, onUndo, variant: 'success' as const }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, showToast, dismissToast };
}
