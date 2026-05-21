'use client';

/**
 * app/pbv-full-app/[token]/review/page.tsx
 *
 * PRD-67 Step 2 — Tenant review-of-application surface.
 *
 * Scope cut for this PRD: READ-ONLY. The tenant can see every visible
 * intake section (rendered via the same IntakeDataDisplay that
 * SectionReview uses, with mode='review') plus the read-only Building/Unit
 * card. Editing intake answers after `intake_status='complete'` is logged
 * as a follow-up PRD (the safe regenerate-on-edit + signing-reset flow is
 * non-trivial and would risk silent packet/data desync if cut short — the
 * batch protocol's default is "stop short rather than overwrite signed
 * data"; PRD-62 Check 5 + PRD-66 generation_version are the backstops once
 * editing is wired in).
 *
 * Tenants who need to change answers see a "contact the office" line
 * (the same posture building/unit have today).
 *
 * Available before and after submission. Once `submitted_at` is set the
 * surface is identical (it was always read-only here).
 */

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useIntakeBootstrap } from '@/lib/pbv/hooks/useIntakeBootstrap';
import IntakeDataDisplay from '@/components/pbv/IntakeDataDisplay';
import { useSectionVisibility } from '@/lib/pbv/hooks/useSectionVisibility';
import { defaultOfficeContact } from '@/lib/pbv/officeContacts';
import type { PreferredLanguage } from '@/types/compliance';

interface Props {
  params: Promise<{ token: string }>;
}

interface CopyMap {
  back_to_dashboard: string;
  heading: string;
  subhead_pre_complete: string;
  subhead_post_complete: string;
  your_unit: string;
  building_label: string;
  unit_label: string;
  building_wrong: string;
  to_change_answers: string;
  call_office: string;
}

const copy: Record<PreferredLanguage, CopyMap> = {
  en: {
    back_to_dashboard: '← Back to dashboard',
    heading: 'Your answers',
    subhead_pre_complete: "Here's what you've told us so far. You can keep editing from the intake screen.",
    subhead_post_complete: "Here's what you submitted. To change an answer, please call the office.",
    your_unit: 'Your unit',
    building_label: 'Building',
    unit_label: 'Unit',
    building_wrong: "Building/unit can't be changed here. Call the office if this is wrong.",
    to_change_answers: 'To change any of your answers',
    call_office: 'call our office',
  },
  es: {
    back_to_dashboard: '← Volver al panel',
    heading: 'Sus respuestas',
    subhead_pre_complete: 'Esto es lo que nos ha dicho hasta ahora. Puede seguir editando desde la pantalla de admisión.',
    subhead_post_complete: 'Esto es lo que envió. Para cambiar una respuesta, llame a la oficina.',
    your_unit: 'Su unidad',
    building_label: 'Edificio',
    unit_label: 'Unidad',
    building_wrong: 'El edificio o unidad no se puede cambiar aquí. Llame a la oficina si esto es incorrecto.',
    to_change_answers: 'Para cambiar cualquiera de sus respuestas',
    call_office: 'llame a nuestra oficina',
  },
  pt: {
    back_to_dashboard: '← Voltar ao painel',
    heading: 'Suas respostas',
    subhead_pre_complete: 'Isto é o que você nos contou até agora. Você pode continuar editando na tela de inscrição.',
    subhead_post_complete: 'Isto é o que você enviou. Para alterar uma resposta, ligue para o escritório.',
    your_unit: 'Sua unidade',
    building_label: 'Prédio',
    unit_label: 'Unidade',
    building_wrong: 'Prédio/unidade não pode ser alterado aqui. Ligue para o escritório se estiver incorreto.',
    to_change_answers: 'Para alterar qualquer uma das suas respostas',
    call_office: 'ligue para nosso escritório',
  },
};

export default function ReviewApplicationPage({ params }: Props) {
  const { token } = use(params);
  const router = useRouter();
  const { state } = useIntakeBootstrap(token);

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-sm text-[var(--error)]">{state.message}</p>
          <button
            type="button"
            onClick={() => router.push(`/pbv-full-app/${token}/dashboard`)}
            className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const data = state.data;
  const lang: PreferredLanguage = data.preferred_language ?? 'en';
  const c = copy[lang] ?? copy.en;
  const submitted = !!data.submitted_at;
  const intakeComplete = data.intake_status === 'complete';
  const phoneHref = defaultOfficeContact.phone.replace(/[^0-9+]/g, '');

  // Visible sections per the same hook SectionReview uses, so the review-here
  // surface stays in sync with the section-list the intake flow renders.
  const visibleSlugs = useSectionVisibility(data.intake_data);

  return (
    <div
      className="min-h-screen bg-[var(--paper)] flex flex-col"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      <header className="bg-white border-b border-[var(--border)] px-4 py-4">
        <div className="max-w-lg mx-auto">
          <button
            type="button"
            onClick={() => router.push(`/pbv-full-app/${token}/dashboard`)}
            className="text-sm text-[var(--primary)] font-medium hover:opacity-80 transition-opacity min-h-[44px] px-2 -ml-2 flex items-center"
            style={{ touchAction: 'manipulation' }}
          >
            {c.back_to_dashboard}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="space-y-2">
            <h1
              className="text-2xl font-normal text-[var(--ink)] leading-tight"
              style={{ fontFamily: 'Libre Baskerville, serif' }}
            >
              {c.heading}
            </h1>
            <p className="text-sm text-[var(--body)]">
              {submitted || intakeComplete ? c.subhead_post_complete : c.subhead_pre_complete}
            </p>
          </div>

          {/* Building / unit — never editable by the tenant (Stanton-fixed). */}
          {data.building_address && (
            <div className="border border-[var(--border)] bg-white p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{c.your_unit}</p>
              <div className="grid grid-cols-[80px_1fr] gap-x-3 gap-y-2 text-sm">
                <span className="text-[var(--muted)]">{c.building_label}</span>
                <span className="font-medium text-[var(--body)]">{data.building_address}</span>
                <span className="text-[var(--muted)]">{c.unit_label}</span>
                <span className="font-medium text-[var(--body)]">{data.unit_number || '—'}</span>
              </div>
              <p className="text-xs text-[var(--muted)]">{c.building_wrong}</p>
            </div>
          )}

          {/* Visible intake sections rendered read-only. */}
          {visibleSlugs.filter((s) => s !== 'review').map((slug) => (
            <div key={slug} className="border border-[var(--border)] bg-white p-4">
              <IntakeDataDisplay
                intakeData={data.intake_data}
                language={lang}
                mode="review"
                visibleSlugs={[slug]}
              />
            </div>
          ))}

          {/* Contact-the-office line. Same posture as the building/unit card. */}
          <div className="border border-[var(--border)] bg-white p-4 text-sm text-[var(--body)]">
            <p>
              {c.to_change_answers}, {' '}
              <a href={`tel:${phoneHref}`} className="text-[var(--primary)] underline">
                {c.call_office}
              </a>
              {' '}— {defaultOfficeContact.phone}.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
