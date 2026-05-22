'use client';

/**
 * components/pbv/intake/IntakeShell.tsx
 *
 * Chrome wrapper for every intake section:
 *   - Progress bar (section N of total)
 *   - Section title
 *   - Save status indicator (top-right)
 *   - "Pick up later" button
 *   - Children slot (section content)
 *   - Footer: Back + Next buttons
 */

import type { ReactNode } from 'react';
import type { SectionSlug } from '@/lib/pbv/intake-schema';
import type { SaveStatus } from '@/lib/pbv/hooks/useSectionAutoSave';
import type { PreferredLanguage } from '@/types/compliance';
import SaveStatusIndicator from './SaveStatusIndicator';
import PickUpLaterButton from './PickUpLaterButton';
import LanguageSwitcher from './LanguageSwitcher';

interface Props {
  token: string;
  language: PreferredLanguage;
  sectionNumber: number;
  totalSections: number;
  sectionTitle: string;
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  canGoBack: boolean;
  canGoNext: boolean;
  isLastSection?: boolean;
  isReviewSection?: boolean;
  navigating?: boolean;
  navError?: string;
  onBack: () => void;
  onNext: () => void;
  onLanguageChange?: (lang: PreferredLanguage) => void;
  children: ReactNode;
}

const nextLabels: Record<PreferredLanguage, string> = {
  en: 'Next',
  es: 'Siguiente',
  pt: 'Próximo', // PT: tentative — review
};

const backLabels: Record<PreferredLanguage, string> = {
  en: 'Back',
  es: 'Atrás',
  pt: 'Voltar', // PT: tentative — review
};

const submitLabels: Record<PreferredLanguage, string> = {
  en: 'Submit my answers',
  es: 'Enviar mis respuestas',
  pt: 'Enviar minhas respostas', // PT: tentative — review
};

const sectionOfLabels: Record<PreferredLanguage, (n: number, t: number) => string> = {
  en: (n, t) => `Section ${n} of ${t}`,
  es: (n, t) => `Sección ${n} de ${t}`,
  pt: (n, t) => `Seção ${n} de ${t}`, // PT: tentative — review
};

const reviewLabels: Record<PreferredLanguage, string> = {
  en: 'Review',
  es: 'Revisión',
  pt: 'Revisão', // PT: tentative — review
};

const savingLabels: Record<PreferredLanguage, string> = {
  en: 'Saving…',
  es: 'Guardando…',
  pt: 'Salvando…', // PT: tentative — review
};

export default function IntakeShell({
  token,
  language,
  sectionNumber,
  totalSections,
  sectionTitle,
  saveStatus,
  lastSavedAt,
  canGoBack,
  canGoNext,
  isLastSection = false,
  isReviewSection = false,
  navigating = false,
  navError = '',
  onBack,
  onNext,
  onLanguageChange,
  children,
}: Props) {
  const progress = isReviewSection ? 100 : totalSections > 0 ? (sectionNumber / totalSections) * 100 : 0;

  return (
    <div className="min-h-screen bg-[var(--paper)] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b border-[var(--border)] px-4 py-3">
        <div className="max-w-lg mx-auto">
          {/* Row 1: section label + save indicator + pick-up-later */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs text-[var(--muted)] font-medium">
              {isReviewSection
                ? reviewLabels[language]
                : sectionOfLabels[language]?.(sectionNumber, totalSections)}
            </span>
            <div className="flex items-center gap-3">
              <SaveStatusIndicator
                status={saveStatus}
                lastSavedAt={lastSavedAt}
                language={language}
              />
              {onLanguageChange && (
                <LanguageSwitcher current={language} onChange={onLanguageChange} />
              )}
              <PickUpLaterButton token={token} language={language} />
            </div>
          </div>

          {/* Progress bar */}
          <div
            className="h-1 w-full bg-[var(--border)] overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={
              isReviewSection
                ? reviewLabels[language]
                : sectionOfLabels[language]?.(sectionNumber, totalSections)
            }
          >
            <div
              className="h-full bg-[var(--primary)] transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* PRP-009 A6: announce section transitions via a polite live
              region. The visually-hidden region is mounted at first render
              so a subsequent text change is observed by screen readers. */}
          <p className="sr-only" role="status" aria-live="polite" data-testid="intake-progress-live">
            {isReviewSection
              ? reviewLabels[language]
              : sectionOfLabels[language]?.(sectionNumber, totalSections)}
          </p>
        </div>
      </header>

      {/* Section title */}
      <div className="bg-white border-b border-[var(--border)] px-4 py-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-xl font-serif font-bold text-[var(--primary)]">{sectionTitle}</h1>
        </div>
      </div>

      {/* Section content. PRP-009 A7: the page-level <main> landmark lives
          in the route layout. We render a <section> here so the document
          has exactly one main landmark, not two nested ones. */}
      <section className="flex-1 px-4 py-6" aria-label={sectionTitle}>
        <div className="max-w-lg mx-auto space-y-6">
          {children}
        </div>
      </section>

      {/* Footer navigation */}
      {/* F7: Review section has its own submit button inside SectionReview.
           Don't render the footer nav bar on review — it creates a duplicate disabled button. */}
      {!isReviewSection && (
        <footer className="sticky bottom-0 bg-white border-t border-[var(--border)] px-4 py-3 z-20">
          <div className="max-w-lg mx-auto">
          {navError && (
            <p className="text-xs text-[var(--error)] mb-2">{navError}</p>
          )}
          <div className="flex gap-3">
            {canGoBack && (
              <button
                type="button"
                onClick={onBack}
                className="min-h-[44px] px-4 border border-[var(--border)] text-sm text-[var(--body)] hover:bg-[var(--paper)] transition-colors"
              >
                {backLabels[language]}
              </button>
            )}
            <button
              type="button"
              onClick={onNext}
              disabled={!canGoNext || navigating}
              className="flex-1 min-h-[44px] bg-[var(--primary)] text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {navigating ? savingLabels[language] : isLastSection ? submitLabels[language] : nextLabels[language]}
            </button>
          </div>
          </div>
        </footer>
      )}
    </div>
  );
}
