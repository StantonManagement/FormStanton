'use client';

/**
 * app/pbv-full-app/[token]/intake/[section]/page.tsx
 *
 * Section dispatcher. Reads the [section] slug from the URL and renders
 * the matching section component inside IntakeShell.
 *
 * Navigation (Next/Back) is driven by useSectionVisibility — the ordered
 * list of visible sections, accounting for conditional sections.
 *
 * Auto-saves section data on every meaningful field change (600ms debounce).
 * Stores _resume_section in intake_data so re-entry drops here.
 */

import { use, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { tenantFetch } from '@/lib/tenantFetch';
import { useIntakeBootstrap } from '@/lib/pbv/hooks/useIntakeBootstrap';
import { useSectionVisibility } from '@/lib/pbv/hooks/useSectionVisibility';
import { useSectionAutoSave } from '@/lib/pbv/hooks/useSectionAutoSave';
import IntakeShell from '@/components/pbv/intake/IntakeShell';
import type { SectionSlug, IntakeData } from '@/lib/pbv/intake-schema';
import { isSectionComplete, SECTION_SLUGS, ALWAYS_SECTIONS } from '@/lib/pbv/intake-schema';
import type { PreferredLanguage } from '@/types/compliance';

// Section components (built in commits 2-4)
import SectionHousehold from '@/components/pbv/intake/SectionHousehold';
import SectionContact from '@/components/pbv/intake/SectionContact';
import SectionIncome from '@/components/pbv/intake/SectionIncome';
import SectionZeroIncomeDecl from '@/components/pbv/intake/SectionZeroIncomeDecl';
import SectionAssets from '@/components/pbv/intake/SectionAssets';
import SectionChildcareDisability from '@/components/pbv/intake/SectionChildcareDisability';
import SectionMedical from '@/components/pbv/intake/SectionMedical';
import SectionCriminalHistory from '@/components/pbv/intake/SectionCriminalHistory';
import SectionDvHomelessRa from '@/components/pbv/intake/SectionDvHomelessRa';
import SectionHouseholdExpenses from '@/components/pbv/intake/SectionHouseholdExpenses';
import SectionReview from '@/components/pbv/intake/SectionReview';

const SECTION_TITLES: Record<SectionSlug, Record<PreferredLanguage, string>> = {
  household: { en: 'About Your Household', es: 'Sobre su hogar', pt: 'Sobre sua família' },
  contact: { en: 'Contact Information', es: 'Información de contacto', pt: 'Informações de contato' },
  income: { en: 'Income', es: 'Ingresos', pt: 'Renda' },
  zero_income_decl: { en: 'Zero Income Declaration', es: 'Declaración de cero ingresos', pt: 'Declaração de renda zero' },
  assets: { en: 'Assets', es: 'Activos', pt: 'Bens' },
  childcare_disability: { en: 'Childcare & Disability Expenses', es: 'Gastos de cuidado infantil y discapacidad', pt: 'Despesas com creche e deficiência' },
  medical: { en: 'Medical Expenses', es: 'Gastos médicos', pt: 'Despesas médicas' },
  criminal_history: { en: 'Criminal History', es: 'Historial criminal', pt: 'Histórico criminal' },
  dv_homeless_ra: { en: 'Special Circumstances', es: 'Circunstancias especiales', pt: 'Circunstâncias especiais' },
  household_expenses: { en: 'Household Expenses', es: 'Gastos del hogar', pt: 'Despesas domésticas' },
  review: { en: 'Review Your Answers', es: 'Revise sus respuestas', pt: 'Revise suas respostas' },
};

interface Props {
  params: Promise<{ token: string; section: string }>;
}

export default function IntakeSectionPage({ params }: Props) {
  const { token, section } = use(params);
  const router = useRouter();

  const { state, reload } = useIntakeBootstrap(token);

  // Local intake data state (sourced from bootstrap, updated by section components)
  const [localIntakeData, setLocalIntakeData] = useState<IntakeData | null>(null);

  // Resolve which data to use: local (in-progress edits) or bootstrap
  const intakeData: IntakeData =
    localIntakeData ??
    (state.status === 'ready' ? state.data.intake_data : {});

  const bootstrapLanguage: PreferredLanguage =
    state.status === 'ready' ? state.data.preferred_language : 'en';
  const [languageOverride, setLanguageOverride] = useState<PreferredLanguage | null>(null);
  const language: PreferredLanguage = languageOverride ?? bootstrapLanguage;

  const visibleSections = useSectionVisibility(intakeData);
  const currentSlug = section as SectionSlug;
  const currentIndex = visibleSections.indexOf(currentSlug);
  // F9: Use max-denominator (all non-review slugs) so the count never shifts
  // as conditional sections appear or disappear during intake.
  const totalSections = SECTION_SLUGS.filter((s) => s !== 'review').length;
  // Phase 3: Use ALWAYS_SECTIONS for stable numerator (conditional sections don't shift the number)
  const alwaysIndex = ALWAYS_SECTIONS.indexOf(currentSlug);
  const sectionNumber = alwaysIndex >= 0 ? alwaysIndex + 1 : totalSections + 1;

  // Track active section data for auto-save
  const [sectionData, setSectionData] = useState<Record<string, unknown> | null>(null);
  const { saveStatus, lastSavedAt, saveNow } = useSectionAutoSave(
    token,
    currentSlug,
    sectionData,
    !!sectionData
  );

  const [navigating, setNavigating] = useState(false);
  const [navError, setNavError] = useState('');

  // PRP-015 / F2: deep-link guard. If the URL requests a section ahead of
  // the bootstrap's resume_section, redirect to the resume section.
  // Backward navigation to already-completed sections is still allowed.
  // The review section is always allowed (it has its own readiness gate).
  const resumeSection: SectionSlug | null =
    state.status === 'ready' ? (state.data.resume_section as SectionSlug | null) : null;
  useEffect(() => {
    if (state.status !== 'ready') return;
    if (!resumeSection) return;
    if (currentSlug === 'review') return;
    const resumeIndex = visibleSections.indexOf(resumeSection);
    if (resumeIndex < 0) return;
    if (currentIndex > resumeIndex) {
      router.replace(`/pbv-full-app/${token}/intake/${resumeSection}`);
    }
  }, [state.status, resumeSection, currentSlug, currentIndex, visibleSections, router, token]);

  // PRP-010 / C1: warn the tenant before they close a tab with unsaved
  // section data. Mirrors the verified-safe pattern at
  // app/pbv-full-app/[token]/documents/page.tsx:109-121. Guard engages
  // once the user has touched a field (sectionData !== null) AND the
  // debounced autosave has not yet landed (saveStatus !== 'saved'). The
  // 600ms debounce window between keystroke and save means a too-fast
  // close can still slip the prompt; the value here is catching the
  // common "type a lot then close" case where saveStatus is still
  // 'saving' / 'error'.
  useEffect(() => {
    if (!sectionData) return;
    if (saveStatus === 'saved') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [saveStatus, sectionData]);

  // PRP-015 / E1: functional updater so the merge always sees the freshest
  // prev value. The previous `[intakeData]` dep + closure could merge stale
  // intakeData over newer if a background reload landed between callback
  // creation and call. Functional updater removes the closure dependency
  // entirely; the deps are now empty (stable callback for child memos).
  const handleSectionChange = useCallback(
    (slug: SectionSlug, data: Record<string, unknown>) => {
      setSectionData(data);
      setLocalIntakeData((prev) => {
        // Prefer the freshest live value: prev (component state) if set;
        // otherwise fall back to the bootstrap snapshot (captured at first
        // render via setLocalIntakeData(null) initial state). We do not
        // close over `intakeData` directly — read it from the bootstrap
        // ref-style alternative would also work, but the prev fallback
        // is sufficient for the merge-correctness invariant.
        const base = prev ?? null;
        if (!base) return { [slug]: data };
        return { ...base, [slug]: data };
      });
    },
    []
  );

  const navigateTo = async (slug: SectionSlug) => {
    const targetIndex = visibleSections.indexOf(slug);
    const movingForward = targetIndex > currentIndex;

    if (sectionData || movingForward) {
      setNavigating(true);
      setNavError('');
      try {
        if (sectionData) {
          await saveNow();
        }
        // Advance the resume high-water mark BEFORE routing forward. The F2
        // deep-link guard (below) redirects any section ahead of
        // resume_section back to it; because autosave pins resume_section to
        // the *current* section, every forward Next would otherwise land one
        // section past resume_section and bounce straight back. Persisting the
        // target here (monotonic — never lowered server-side) lets the guard
        // admit it. Backward navigation (movingForward === false) skips this.
        if (movingForward) {
          const res = await tenantFetch(`/api/t/${token}/pbv-full-app/intake/progress`, {
            method: 'POST',
            body: { section: slug },
          });
          if (!res.ok) throw new Error(`Failed to advance progress (${res.status})`);
        }
      } catch {
        setNavError('Could not save. Please try again.');
        setNavigating(false);
        return;
      }
      setNavigating(false);
    }
    router.push(`/pbv-full-app/${token}/intake/${slug}`);
    // PRP-015 / mobile §8.2: scroll to top after section change so the
    // user lands at the top of the next section, not wherever they
    // scrolled in the previous one (mobile keyboards leave the page
    // mid-scroll). Smooth scroll honors prefers-reduced-motion.
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) navigateTo(visibleSections[currentIndex - 1]);
  };

  const handleNext = () => {
    if (currentIndex < visibleSections.length - 1) {
      navigateTo(visibleSections[currentIndex + 1]);
    }
  };

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-[var(--muted)] text-sm">Loading…</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center px-4">
        <p className="text-sm text-[var(--error)]">{state.message}</p>
      </div>
    );
  }

  const sectionTitle =
    SECTION_TITLES[currentSlug]?.[language] ?? currentSlug;

  const isReviewSection = currentSlug === 'review';
  const isLastSection = isReviewSection;

  return (
    <IntakeShell
      token={token}
      language={language}
      sectionNumber={isReviewSection ? totalSections + 1 : sectionNumber}
      totalSections={totalSections}
      sectionTitle={sectionTitle}
      saveStatus={saveStatus}
      lastSavedAt={lastSavedAt}
      canGoBack={currentIndex > 0 && !navigating}
      canGoNext={!isReviewSection && isSectionComplete(currentSlug, intakeData) && !navigating}
      isLastSection={isLastSection}
      isReviewSection={isReviewSection}
      navigating={navigating}
      navError={navError}
      onBack={handleBack}
      onNext={handleNext}
      onLanguageChange={setLanguageOverride}
    >
      <SectionRenderer
        slug={currentSlug}
        token={token}
        language={language}
        intakeData={intakeData}
        onChange={handleSectionChange}
        onNext={handleNext}
        onNavigateTo={navigateTo}
        reload={reload}
      />
    </IntakeShell>
  );
}

// ── Section renderer — dispatches to the correct section component ────────────

interface RendererProps {
  slug: SectionSlug;
  token: string;
  language: PreferredLanguage;
  intakeData: IntakeData;
  onChange: (slug: SectionSlug, data: Record<string, unknown>) => void;
  onNext: () => void;
  onNavigateTo: (slug: SectionSlug) => void;
  reload: () => void;
}

function SectionRenderer({
  slug,
  token,
  language,
  intakeData,
  onChange,
  onNext,
  onNavigateTo,
  reload,
}: RendererProps) {
  const commonProps = { language, intakeData, onChange };

  switch (slug) {
    case 'household':
      return <SectionHousehold {...commonProps} />;
    case 'contact':
      return <SectionContact {...commonProps} />;
    case 'income':
      return <SectionIncome {...commonProps} />;
    case 'zero_income_decl':
      return <SectionZeroIncomeDecl {...commonProps} />;
    case 'assets':
      return <SectionAssets {...commonProps} />;
    case 'childcare_disability':
      return <SectionChildcareDisability {...commonProps} />;
    case 'medical':
      return <SectionMedical {...commonProps} />;
    case 'criminal_history':
      return <SectionCriminalHistory {...commonProps} />;
    case 'dv_homeless_ra':
      return <SectionDvHomelessRa {...commonProps} />;
    case 'household_expenses':
      return <SectionHouseholdExpenses {...commonProps} />;
    case 'review':
      return (
        <SectionReview
          language={language}
          intakeData={intakeData}
          token={token}
          onNavigateTo={onNavigateTo}
          onSubmitted={reload}
        />
      );
    default:
      return (
        <p className="text-sm text-[var(--error)]">Unknown section: {slug}</p>
      );
  }
}
