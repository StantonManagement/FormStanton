'use client';

import { useState, useEffect, useCallback } from 'react';

interface ToastItem {
  id: number;
  message: string;
  onUndo?: () => void;
  variant?: 'success' | 'info' | 'error';
}

interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

export type { ToastItem };

export default function Toast({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((toast) => (
        <ToastEntry key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastEntry({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(toast.id), 250);
    }, 6000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const handleUndo = useCallback(() => {
    toast.onUndo?.();
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 250);
  }, [toast, onDismiss]);

  const handleDismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 250);
  }, [toast.id, onDismiss]);

  const borderColor =
    toast.variant === 'error' ? 'border-[var(--error)]' :
    toast.variant === 'success' ? 'border-[var(--success)]' :
    'border-[var(--primary)]';

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 bg-white border ${borderColor} shadow-lg transition-all duration-250 ease-out ${
        visible && !exiting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      <span className="text-sm text-[var(--ink)]">{toast.message}</span>
      {toast.onUndo && (
        <button
          onClick={handleUndo}
          className="px-2 py-1 text-xs font-medium text-[var(--primary)] border border-[var(--primary)]/40 rounded-none hover:bg-[var(--primary)]/5 transition-colors duration-200 ease-out whitespace-nowrap"
        >
          Undo
        </button>
      )}
      <button
        onClick={handleDismiss}
        className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors duration-200 ease-out ml-1"
        title="Dismiss"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
