'use client';

/**
 * components/pbv/sign/FormsStack.tsx
 *
 * Lists all generated pbv_form_documents with per-form sign status.
 * Sort: unsigned first, signed last.
 * "Sign all my forms" runs a stepper: opens each unsigned form modal in sequence.
 * Per-form "Sign this form" opens that form's modal directly.
 *
 * Open decision resolved: stepper for "Sign all" — each form still shows its own
 * per-form confirmation modal; signing is serial with clear progress. No bulk-sign.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import FormReviewSignModal from './FormReviewSignModal';
import { useSigningCeremony } from '@/lib/pbv/hooks/useSigningCeremony';
import type { FormDoc } from '@/lib/pbv/hooks/useFormStack';
import type { PreferredLanguage } from '@/types/compliance';

interface Props {
  token: string;
  language: PreferredLanguage;
  forms: FormDoc[];
  hohName: string;
  hohMemberId: string;
  summarySigningComplete: boolean;
  onFormsUpdated: () => void;
}

interface CopyMapWithFn {
  title: string;
  subtitle: string;
  summary_blocked: string;
  sign_all: string;
  sign_this: string;
  signed_label: string;
  back: string;
  all_done_title: string;
  all_done_body: string;
  return_dashboard: string;
  signing_progress: (current: number, total: number) => string;
  no_forms: string;
}

const typedCopy: Record<PreferredLanguage, CopyMapWithFn> = {
  en: {
    title: 'Review and Sign Your Forms',
    subtitle: 'You must sign each form individually.',
    summary_blocked: 'You must sign the application summary before signing any forms.',
    sign_all: 'Sign all my forms',
    sign_this: 'Sign',
    signed_label: 'Signed \u2713',
    back: '\u2190 Back to dashboard',
    all_done_title: 'All forms signed!',
    all_done_body: 'Return to the dashboard to check your remaining tasks.',
    return_dashboard: 'Return to dashboard',
    signing_progress: (current, total) => `Signing ${current} of ${total}\u2026`,
    no_forms: 'No forms to sign yet. Forms are generated when you submit your intake.',
  },
  es: {
    title: 'Revise y Firme Sus Formularios',
    subtitle: 'Debe firmar cada formulario individualmente.',
    summary_blocked: 'Debe firmar el resumen de la solicitud antes de firmar los formularios.',
    sign_all: 'Firmar todos mis formularios',
    sign_this: 'Firmar',
    signed_label: 'Firmado \u2713',
    back: '\u2190 Volver al panel',
    all_done_title: '\u00a1Todos los formularios firmados!',
    all_done_body: 'Regrese al panel para verificar las tareas restantes.',
    return_dashboard: 'Volver al panel',
    signing_progress: (current, total) => `Firmando ${current} de ${total}\u2026`,
    no_forms: 'A\u00fan no hay formularios para firmar.',
  },
  pt: {
    // PT: tentative — review
    title: 'Revise e Assine Seus Formul\u00e1rios',
    subtitle: 'Voc\u00ea deve assinar cada formul\u00e1rio individualmente.',
    summary_blocked: 'Voc\u00ea deve assinar o resumo da solicita\u00e7\u00e3o antes de assinar os formul\u00e1rios.',
    sign_all: 'Assinar todos os meus formul\u00e1rios',
    sign_this: 'Assinar',
    signed_label: 'Assinado \u2713',
    back: '\u2190 Voltar ao painel',
    all_done_title: 'Todos os formul\u00e1rios assinados!',
    all_done_body: 'Volte ao painel para verificar suas tarefas restantes.',
    return_dashboard: 'Voltar ao painel',
    signing_progress: (current, total) => `Assinando ${current} de ${total}\u2026`,
    no_forms: 'Nenhum formul\u00e1rio para assinar ainda.',
  },
};

export default function FormsStack({
  token, language, forms, hohName, hohMemberId, summarySigningComplete, onFormsUpdated,
}: Props) {
  const c = typedCopy[language] ?? typedCopy.en;
  const router = useRouter();
  const ceremony = useSigningCeremony(token, hohMemberId, language);

  // Which form modal is open (single-form sign)
  const [activeFormId, setActiveFormId] = useState<string | null>(null);

  // Stepper state for "Sign all"
  const [stepperQueue, setStepperQueue] = useState<string[]>([]);
  const [stepperIndex, setStepperIndex] = useState(0);

  // PRP-008 / E4: memoize the sort so the array reference is stable across
  // re-renders that don't change `forms`. Prevents the row list from
  // re-rendering every time stepperIndex/activeFormId/etc. change.
  const sorted = useMemo(
    () =>
      [...forms].sort((a, b) => {
        if (a.signatures_complete && !b.signatures_complete) return 1;
        if (!a.signatures_complete && b.signatures_complete) return -1;
        return a.display_name.localeCompare(b.display_name);
      }),
    [forms]
  );

  const unsigned = sorted.filter((f) => !f.signatures_complete);
  const allSigned = forms.length > 0 && unsigned.length === 0;

  const activeForm =
    activeFormId
      ? forms.find((f) => f.id === activeFormId) ?? null
      : stepperQueue.length > 0
      ? forms.find((f) => f.id === stepperQueue[stepperIndex]) ?? null
      : null;

  const handleSign = async (formDocId: string, sigDataUrl: string | null, typedName: string) => {
    let success: boolean;
    if (sigDataUrl) {
      success = await ceremony.captureAndSign(formDocId, sigDataUrl, typedName);
    } else {
      success = await ceremony.signWithExisting(formDocId, typedName);
    }

    if (success) {
      onFormsUpdated();
      ceremony.clearError();

      if (stepperQueue.length > 0) {
        // Stepper: advance or finish
        if (stepperIndex + 1 < stepperQueue.length) {
          setStepperIndex((i) => i + 1);
        } else {
          setStepperQueue([]);
          setStepperIndex(0);
        }
      } else {
        setActiveFormId(null);
      }
    }
  };

  const startSignAll = () => {
    const ids = unsigned.map((f) => f.id);
    if (ids.length === 0) return;
    setStepperIndex(0);
    setStepperQueue(ids);
  };

  if (allSigned) {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-4xl">&#10003;</div>
          <h1 className="font-serif text-2xl text-[var(--primary)]">{c.all_done_title}</h1>
          <p className="text-sm text-[var(--body)]">{c.all_done_body}</p>
          <button
            type="button"
            onClick={() => router.push(`/pbv-full-app/${token}/dashboard`)}
            className="w-full min-h-[44px] bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {c.return_dashboard}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <div className="max-w-lg mx-auto px-4 py-8">
        <button type="button" onClick={() => router.push(`/pbv-full-app/${token}/dashboard`)}
          className="text-sm text-[var(--muted)] mb-4 block hover:text-[var(--body)]">
          {c.back}
        </button>

        <h1 className="font-serif text-2xl text-[var(--primary)] mb-1">{c.title}</h1>
        <p className="text-sm text-[var(--muted)] mb-6">{c.subtitle}</p>

        {!summarySigningComplete && (
          <div className="border border-amber-300 bg-amber-50 p-4 mb-6">
            <p className="text-sm text-amber-800">{c.summary_blocked}</p>
          </div>
        )}

        {forms.length === 0 && (
          <p className="text-sm text-[var(--muted)]">{c.no_forms}</p>
        )}

        {/* Sign all button */}
        {summarySigningComplete && unsigned.length > 1 && (
          <button
            type="button"
            onClick={startSignAll}
            className="w-full min-h-[44px] border-2 border-[var(--primary)] text-[var(--primary)] text-sm font-semibold mb-6 hover:bg-[var(--primary)] hover:text-white transition-colors"
          >
            {c.sign_all}
          </button>
        )}

        {/* Stepper progress — PRP-008 A8: persistent aria-live region.
            Mounted always so SR observes the change rather than a brand-new
            region appearing with text already in it (which is not announced). */}
        <p
          className="text-xs text-[var(--muted)] mb-4 text-center"
          role="status"
          aria-live="polite"
          data-testid="stepper-progress"
        >
          {stepperQueue.length > 0
            ? c.signing_progress(stepperIndex + 1, stepperQueue.length)
            : ''}
        </p>

        {/* Stepper errors — PRP-008 A3: own live region, polite, mounted
            always so the empty-then-filled write is announced. */}
        <div role="status" aria-live="polite" data-testid="stepper-error" className="min-h-[0.5rem]">
          {ceremony.error && stepperQueue.length > 0 && (
            <p className="text-xs text-[var(--error)] mb-4 text-center">{ceremony.error}</p>
          )}
        </div>

        {/* Form rows */}
        <div className="space-y-2">
          {sorted.map((form) => (
            <div key={form.id}
              className="flex items-center gap-3 bg-white border border-[var(--border)] px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--body)] truncate">{form.display_name}</p>
                {form.conditional_trigger && (
                  <p className="text-xs text-[var(--muted)]">{form.conditional_trigger}</p>
                )}
              </div>
              {form.signatures_complete ? (
                <span className="text-xs text-emerald-600 font-medium flex-shrink-0">{c.signed_label}</span>
              ) : (
                <button
                  type="button"
                  disabled={!summarySigningComplete || ceremony.submitting}
                  onClick={() => { ceremony.clearError(); setActiveFormId(form.id); }}
                  className="flex-shrink-0 min-h-[44px] px-4 bg-[var(--primary)] text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  {c.sign_this}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {activeForm && (
        <FormReviewSignModal
          token={token}
          language={language}
          form={activeForm}
          hasSignature={ceremony.hasSignature}
          hohName={hohName}
          submitting={ceremony.submitting}
          error={ceremony.error}
          onSign={handleSign}
          onClose={() => {
            setActiveFormId(null);
            setStepperQueue([]);
            ceremony.clearError();
          }}
        />
      )}
    </div>
  );
}
