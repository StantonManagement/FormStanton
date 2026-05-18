'use client';

/**
 * DocumentCardStackLanding.tsx
 *
 * F1 — Landing screen for the PBV document card stack.
 * Shows a calm, welcoming screen with the document count.
 *
 * Mobile-first: one viewport, no scroll on iPhone SE (375x667).
 */

import { useState, useEffect } from 'react';
import type { SupportedLanguage } from '@/lib/pbv/cards/docContent';

interface DocumentCardStackLandingProps {
  /** Tenant's first name */
  firstName: string;
  /** Number of required documents */
  documentCount: number;
  /** Number already uploaded */
  uploadedCount: number;
  /** Number deferred */
  deferredCount: number;
  /** Preferred language */
  language: SupportedLanguage;
  /** Callback when user clicks "Let's start" */
  onStart: () => void;
  /** Callback when user clicks "See full list" */
  onSeeFullList: () => void;
}

const translations = {
  en: {
    greeting: (name: string) => `Hi ${name}.`,
    needCount: (count: number) =>
      count === 1
        ? `We need 1 thing from you.`
        : `We need ${count} things from you.`,
    subtitle: "We'll go one at a time.",
    helpText: "Don't have something yet? Tap 'I'll get this later' and we'll come back to it.",
    ctaStart: "Let's start →",
    ctaSeeList: 'See full list',
    progress: (uploaded: number, total: number) =>
      uploaded > 0 ? `You've already uploaded ${uploaded} of ${total}.` : '',
    deferredNote: (count: number) =>
      count === 1
        ? 'You have 1 document saved for later.'
        : `You have ${count} documents saved for later.`,
  },
  es: {
    greeting: (name: string) => `Hola ${name}.`,
    needCount: (count: number) =>
      count === 1
        ? `Necesitamos 1 cosa de usted.`
        : `Necesitamos ${count} cosas de usted.`,
    subtitle: 'Iremos de una en una.',
    helpText:
      "¿No tiene algo todavía? Toque 'Lo conseguiré más tarde' y volveremos a ello.",
    ctaStart: 'Comencemos →',
    ctaSeeList: 'Ver lista completa',
    progress: (uploaded: number, total: number) =>
      uploaded > 0 ? `Ya ha subido ${uploaded} de ${total}.` : '',
    deferredNote: (count: number) =>
      count === 1
        ? 'Tiene 1 documento guardado para más tarde.'
        : `Tiene ${count} documentos guardados para más tarde.`,
  },
  pt: {
    greeting: (name: string) => `Olá ${name}.`,
    needCount: (count: number) =>
      count === 1
        ? `Precisamos de 1 coisa de você.`
        : `Precisamos de ${count} coisas de você.`,
    subtitle: 'Vamos fazer uma de cada vez.',
    helpText:
      "Não tem algo ainda? Toque em 'Vou pegar isso depois' e voltaremos a isso.",
    ctaStart: 'Vamos começar →',
    ctaSeeList: 'Ver lista completa',
    progress: (uploaded: number, total: number) =>
      uploaded > 0 ? `Você já enviou ${uploaded} de ${total}.` : '',
    deferredNote: (count: number) =>
      count === 1
        ? 'Você tem 1 documento salvo para depois.'
        : `Você tem ${count} documentos salvos para depois.`,
  },
} as const;

export default function DocumentCardStackLanding({
  firstName,
  documentCount,
  uploadedCount,
  deferredCount,
  language,
  onStart,
  onSeeFullList,
}: DocumentCardStackLandingProps) {
  const t = translations[language];
  const [isVisible, setIsVisible] = useState(false);

  // Fade in animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const remainingCount = Math.max(0, documentCount - uploadedCount);

  return (
    <div
      className={`
        min-h-screen bg-[var(--paper)] flex flex-col justify-center px-4 py-6
        transition-opacity duration-300 ease-out
        ${isVisible ? 'opacity-100' : 'opacity-0'}
      `}
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <div className="max-w-md mx-auto w-full space-y-6">
        {/* Main greeting */}
        <div className="space-y-2">
          <h1
            className="text-2xl font-normal text-[var(--ink)] leading-tight"
            style={{ fontFamily: 'Libre Baskerville, serif' }}
          >
            {t.greeting(firstName)}
          </h1>
          <p className="text-lg text-[var(--ink)] leading-snug">
            {t.needCount(remainingCount)}
          </p>
          <p className="text-base text-[var(--muted)]">{t.subtitle}</p>
        </div>

        {/* Progress indicator (if they've already uploaded some) */}
        {uploadedCount > 0 && (
          <div className="bg-[var(--bg-section)] border border-[var(--border)] p-4">
            <p className="text-sm text-[var(--ink)]">{t.progress(uploadedCount, documentCount)}</p>
            {/* Slim progress bar */}
            <div className="mt-2 h-1 bg-[var(--border)] w-full">
              <div
                className="h-full bg-[var(--primary)] transition-all duration-500 ease-out"
                style={{ width: `${(uploadedCount / documentCount) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Deferred note (if they have deferred docs) */}
        {deferredCount > 0 && (
          <p className="text-sm text-[var(--muted)] italic">{t.deferredNote(deferredCount)}</p>
        )}

        {/* Help microcopy */}
        <p className="text-sm text-[var(--muted)] leading-relaxed">{t.helpText}</p>

        {/* CTAs */}
        <div className="space-y-3 pt-4">
          <button
            type="button"
            onClick={onStart}
            className="
              w-full min-h-[48px] px-4 py-3
              bg-[var(--primary)] text-white
              text-base font-medium
              rounded-none
              hover:opacity-90
              transition-opacity duration-200 ease-out
              focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2
            "
            style={{ touchAction: 'manipulation' }}
          >
            {t.ctaStart}
          </button>

          <button
            type="button"
            onClick={onSeeFullList}
            className="
              w-full min-h-[44px] px-4 py-2
              bg-transparent text-[var(--primary)]
              text-sm font-medium
              rounded-none
              border border-transparent
              hover:bg-[var(--bg-section)]
              transition-colors duration-200 ease-out
              focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2
            "
            style={{ touchAction: 'manipulation' }}
          >
            {t.ctaSeeList}
          </button>
        </div>
      </div>
    </div>
  );
}
