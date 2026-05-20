'use client';

/**
 * components/pbv/intake/SectionReview.tsx
 * Section 11 — Review Your Answers
 *
 * Read-only summary grouped by section, with Edit links.
 * "Submit my answers" → POST intake/complete → triggers form generation.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { tenantFetch } from '@/lib/tenantFetch';
import type { PreferredLanguage } from '@/types/compliance';
import type { IntakeData, SectionSlug } from '@/lib/pbv/intake-schema';
import { useSectionVisibility } from '@/lib/pbv/hooks/useSectionVisibility';
import IntakeDataDisplay from '@/components/pbv/IntakeDataDisplay';

interface Props {
  language: PreferredLanguage;
  intakeData: IntakeData;
  token: string;
  onNavigateTo: (slug: SectionSlug) => void;
  onSubmitted: () => void;
}

const copy: Record<PreferredLanguage, Record<string, string>> = {
  en: {
    edit: 'Edit',
    submit_btn: 'Submit my answers',
    submitting: 'Submitting...',
    error_prefix: 'Could not submit: ',
    review_intro: 'Please review your answers before submitting. Use the Edit links to make corrections.',
  },
  es: {
    edit: 'Editar',
    submit_btn: 'Enviar mis respuestas',
    submitting: 'Enviando...',
    error_prefix: 'No se pudo enviar: ',
    review_intro: 'Revise sus respuestas antes de enviar. Use los enlaces Editar para hacer correcciones.',
  },
  pt: {
    // PT: tentative -- review
    edit: 'Editar',
    submit_btn: 'Enviar minhas respostas',
    submitting: 'Enviando...',
    error_prefix: 'Nao foi possivel enviar: ',
    review_intro: 'Revise suas respostas antes de enviar. Use os links Editar para fazer correcoes.',
  },
};

// Section labels for edit buttons
const sectionLabels: Record<SectionSlug, Record<PreferredLanguage, string>> = {
  household: { en: 'About Your Household', es: 'Sobre su hogar', pt: 'Sobre sua familia' },
  contact: { en: 'Contact Information', es: 'Informacion de contacto', pt: 'Informacoes de contato' },
  income: { en: 'Income', es: 'Ingresos', pt: 'Renda' },
  zero_income_decl: { en: 'Zero Income Declaration', es: 'Declaracion de cero ingresos', pt: 'Declaracao de renda zero' },
  assets: { en: 'Assets', es: 'Activos', pt: 'Bens' },
  childcare_disability: { en: 'Childcare & Disability', es: 'Cuidado infantil y discapacidad', pt: 'Creche e deficiencia' },
  medical: { en: 'Medical Expenses', es: 'Gastos medicos', pt: 'Despesas medicas' },
  criminal_history: { en: 'Criminal History', es: 'Historial criminal', pt: 'Historico criminal' },
  dv_homeless_ra: { en: 'Special Circumstances', es: 'Circunstancias especiales', pt: 'Circunstancias especiais' },
  household_expenses: { en: 'Household Expenses', es: 'Gastos del hogar', pt: 'Despesas domesticas' },
  review: { en: 'Review', es: 'Revision', pt: 'Revisao' },
};

interface DisplayBlockWrapperProps {
  slug: SectionSlug;
  language: PreferredLanguage;
  children: React.ReactNode;
  onNavigateTo: (slug: SectionSlug) => void;
}

function DisplayBlockWrapper({ slug, language, children, onNavigateTo }: DisplayBlockWrapperProps) {
  const c = copy[language] ?? copy.en;
  const title = sectionLabels[slug][language] ?? sectionLabels[slug].en;

  return (
    <div className="border border-[var(--border)] bg-white p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--body)]">{title}</p>
        <button
          type="button"
          onClick={() => onNavigateTo(slug)}
          className="text-xs text-[var(--primary)] underline underline-offset-2 hover:opacity-75 min-h-[44px] px-2"
        >
          {c.edit}
        </button>
      </div>
      <div className="text-xs text-[var(--muted)]">{children}</div>
    </div>
  );
}

export default function SectionReview({ language, intakeData, token, onNavigateTo, onSubmitted }: Props) {
  const c = copy[language] ?? copy.en;
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const visibleSlugs = useSectionVisibility(intakeData);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await tenantFetch(`/api/t/${token}/pbv-full-app/intake/complete`, {
        method: 'POST',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || 'Submit failed (' + res.status + ')');
      }
      onSubmitted();
      router.push('/pbv-full-app/' + token + '/dashboard');
    } catch (err: any) {
      setError(err.message || 'Submit failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // We need to render blocks with edit buttons, so we manually wrap each section
  // that IntakeDataDisplay would render
  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--body)]">{c.review_intro}</p>

      {visibleSlugs.filter(s => s !== 'review').map((slug) => (
        <DisplayBlockWrapper
          key={slug}
          slug={slug}
          language={language}
          onNavigateTo={onNavigateTo}
        >
          <IntakeDataDisplay
            intakeData={intakeData}
            language={language}
            mode="review"
            visibleSlugs={[slug]}
          />
        </DisplayBlockWrapper>
      ))}

      {error && (
        <p className="text-sm text-[var(--error)]">{c.error_prefix}{error}</p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full min-h-[44px] bg-[var(--primary)] text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
      >
        {submitting ? c.submitting : c.submit_btn}
      </button>
    </div>
  );
}
