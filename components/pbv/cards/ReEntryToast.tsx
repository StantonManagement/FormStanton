'use client';

/**
 * components/pbv/cards/ReEntryToast.tsx
 *
 * PRD-44 F1 — Welcome back affirmation toast for mid-flow re-entry.
 * Auto-dismisses after 3s, tap to dismiss earlier.
 * Doesn't block interaction with the card underneath.
 */

import { useState, useEffect, useCallback } from 'react';
import type { SupportedLanguage } from '@/lib/pbv/cards/docContent';

type ToastVariant = 'mid_flow' | 'rejection_pending';

interface ReEntryToastProps {
  /** Which toast variant to show */
  variant: ToastVariant;
  /** Preferred language for copy */
  language: SupportedLanguage;
  /** Called when toast is dismissed */
  onDismiss?: () => void;
}

interface ToastCopy {
  message: string;
  ariaLabel: string;
}

const copy: Record<SupportedLanguage, Record<ToastVariant, ToastCopy>> = {
  en: {
    mid_flow: {
      message: 'Welcome back — picking up where you left off.',
      ariaLabel: 'Welcome back. Picking up where you left off.',
    },
    rejection_pending: {
      message: "You're back — let's fix one thing first.",
      ariaLabel: "You're back. Let's fix one thing first.",
    },
  },
  es: {
    mid_flow: {
      message: 'Bienvenido de nuevo — continuando donde lo dejó.',
      ariaLabel: 'Bienvenido de nuevo. Continuando donde lo dejó.',
    },
    rejection_pending: {
      message: 'Ha vuelto — arreglemos una cosa primero.',
      ariaLabel: 'Ha vuelto. Arreglemos una cosa primero.',
    },
  },
  pt: {
    mid_flow: {
      message: 'Bem-vindo de volta — continuando de onde parou.',
      ariaLabel: 'Bem-vindo de volta. Continuando de onde parou.',
    },
    rejection_pending: {
      message: 'Você voltou — vamos consertar uma coisa primeiro.',
      ariaLabel: 'Você voltou. Vamos consertar uma coisa primeiro.',
    },
  },
};

const AUTO_DISMISS_MS = 3000;

export default function ReEntryToast({ variant, language, onDismiss }: ReEntryToastProps) {
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Auto-dismiss after 3 seconds
  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timer);
  }, [visible, onDismiss]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  if (!visible) return null;

  const t = copy[language]?.[variant] ?? copy.en[variant];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="
        fixed top-0 left-0 right-0 z-50
        flex justify-center
        pointer-events-none
      "
      style={{
        animation: reducedMotion ? 'none' : 'slideDown 300ms ease-out',
      }}
    >
      <button
        type="button"
        onClick={handleDismiss}
        className="
          pointer-events-auto
          mt-4 mx-4
          bg-[var(--ink)] text-white
          px-4 py-3
          text-sm font-medium
          rounded-none
          shadow-lg
          hover:opacity-90
          active:opacity-80
          transition-opacity duration-200 ease-out
          max-w-md
          text-center
          cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2
        "
        style={{ touchAction: 'manipulation' }}
      >
        <span className="sr-only">{t.ariaLabel} Tap to dismiss.</span>
        <span aria-hidden="true">{t.message}</span>
      </button>

    </div>
  );
}
