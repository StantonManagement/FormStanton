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

import { use, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useIntakeBootstrap } from '@/lib/pbv/hooks/useIntakeBootstrap';
import { useSectionVisibility } from '@/lib/pbv/hooks/useSectionVisibility';
import { useSectionAutoSave } from '@/lib/pbv/hooks/useSectionAutoSave';
import IntakeShell from '@/components/pbv/intake/IntakeShell';
import type { SectionSlug, IntakeData } from '@/lib/pbv/intake-schema';
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
  const totalSections = visibleSections.filter((s) => s !== 'review').length;
  const sectionNumber = currentIndex >= 0 ? currentIndex + 1 : 1;

  // Track active section data for auto-save
  const [sectionData, setSectionData] = useState<Record<string, unknown> | null>(null);
  const { saveStatus, lastSavedAt } = useSectionAutoSave(
    token,
    currentSlug,
    sectionData,
    !!sectionData
  );

  const handleSectionChange = useCallback(
    (slug: SectionSlug, data: Record<string, unknown>) => {
      setSectionData(data);
      setLocalIntakeData((prev) => ({ ...(prev ?? intakeData), [slug]: data }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [intakeData]
  );

  const navigateTo = (slug: SectionSlug) => {
    router.push(`/pbv-full-app/${token}/intake/${slug}`);
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
      canGoBack={currentIndex > 0}
      canGoNext={!isReviewSection}
      isLastSection={isLastSection}
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
