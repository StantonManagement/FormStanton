'use client';

/**
 * components/pbv/intake/AdultWizard.tsx
 *
 * Reusable one-adult-at-a-time wizard shell.
 * Renders a progress dot row ("Adult 1 of 3"), wraps children,
 * and provides Previous/Next adult navigation.
 */

import type { ReactNode } from 'react';
import type { PreferredLanguage } from '@/types/compliance';

interface AdultWizardProps {
  adults: Array<{ name: string; slot: number }>;
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
  language?: PreferredLanguage;
  children: ReactNode;
}

const adultOfLabels: Record<PreferredLanguage, (n: number, t: number) => string> = {
  en: (n, t) => `Adult ${n} of ${t}`,
  es: (n, t) => `Adulto ${n} de ${t}`,
  pt: (n, t) => `Adulto ${n} de ${t}`, // PT: tentative — review
};

const prevLabels: Record<PreferredLanguage, string> = {
  en: '← Previous adult',
  es: '← Adulto anterior',
  pt: '← Adulto anterior', // PT: tentative — review
};

const nextLabels: Record<PreferredLanguage, string> = {
  en: 'Next adult →',
  es: 'Siguiente adulto →',
  pt: 'Próximo adulto →', // PT: tentative — review
};

export default function AdultWizard({
  adults,
  currentIndex,
  onPrev,
  onNext,
  language = 'en',
  children,
}: AdultWizardProps) {
  const total = adults.length;
  const current = adults[currentIndex];

  return (
    <div className="space-y-4">
      {/* Progress dots */}
      {total > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted)]">
            {adultOfLabels[language]?.(currentIndex + 1, total)}
          </span>
          <div className="flex gap-1.5">
            {adults.map((_, i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i === currentIndex ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Adult name badge */}
      {current && (
        <p className="text-sm font-medium text-[var(--body)] border-l-2 border-[var(--primary)] pl-3">
          {current.name || `Adult ${currentIndex + 1}`}
        </p>
      )}

      {/* Section content */}
      {children}

      {/* Navigation */}
      {total > 1 && (
        <div className="flex gap-3 pt-2">
          {currentIndex > 0 && (
            <button
              type="button"
              onClick={onPrev}
              className="min-h-[44px] px-4 border border-[var(--border)] text-sm text-[var(--body)] hover:bg-[var(--paper)] transition-colors"
            >
              {prevLabels[language]}
            </button>
          )}
          {currentIndex < total - 1 && (
            <button
              type="button"
              onClick={onNext}
              className="min-h-[44px] px-4 bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              {nextLabels[language]}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
