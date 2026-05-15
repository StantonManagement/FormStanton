'use client';

/**
 * app/pbv-full-app/[token]/intake/page.tsx
 *
 * Intake landing intro screen. Shown when intake_status = 'not_started'.
 * Tenant sees: what to expect, estimated time, and "Start" button.
 *
 * "Start" navigates to the first section: /pbv-full-app/[token]/intake/household
 */

import { useParams, useRouter } from 'next/navigation';
import { useIntakeBootstrap } from '@/lib/pbv/hooks/useIntakeBootstrap';
import type { PreferredLanguage } from '@/types/compliance';

const copy: Record<PreferredLanguage, {
  title: string;
  subtitle: string;
  time_estimate: string;
  step1_title: string;
  step1_desc: string;
  step2_title: string;
  step2_desc: string;
  step3_title: string;
  step3_desc: string;
  documents_note: string;
  start_btn: string;
  resume_btn: string;
}> = {
  en: {
    title: 'Your Housing Application',
    subtitle: 'We need to gather some information about your household. You can save your progress and come back later.',
    time_estimate: 'Estimated time: 20–30 minutes',
    step1_title: 'Section 1–10: Answer questions',
    step1_desc: 'Tell us about your household, income, assets, and background.',
    step2_title: 'Review your answers',
    step2_desc: 'Look everything over before submitting.',
    step3_title: 'Sign your forms',
    step3_desc: 'Digital signatures — no printing required.',
    documents_note: 'Have recent pay stubs, tax documents, and ID ready to upload.',
    start_btn: 'Start my application',
    resume_btn: 'Continue where I left off',
  },
  es: {
    title: 'Su solicitud de vivienda',
    subtitle: 'Necesitamos información sobre su hogar. Puede guardar su progreso y regresar más tarde.',
    time_estimate: 'Tiempo estimado: 20–30 minutos',
    step1_title: 'Secciones 1–10: Responder preguntas',
    step1_desc: 'Cuéntenos sobre su hogar, ingresos, activos e historial.',
    step2_title: 'Revisar sus respuestas',
    step2_desc: 'Revise todo antes de enviar.',
    step3_title: 'Firmar sus formularios',
    step3_desc: 'Firmas digitales — no necesita imprimir nada.',
    documents_note: 'Tenga listos talones de pago, documentos fiscales e identificación.',
    start_btn: 'Comenzar mi solicitud',
    resume_btn: 'Continuar donde lo dejé',
  },
  pt: {
    title: 'Sua solicitação de moradia', // PT: tentative — review
    subtitle: 'Precisamos coletar informações sobre sua família. Você pode salvar o progresso e voltar mais tarde.',
    time_estimate: 'Tempo estimado: 20–30 minutos',
    step1_title: 'Seções 1–10: Responder perguntas',
    step1_desc: 'Fale sobre sua família, renda, bens e histórico.',
    step2_title: 'Revisar suas respostas',
    step2_desc: 'Verifique tudo antes de enviar.',
    step3_title: 'Assinar seus formulários',
    step3_desc: 'Assinaturas digitais — sem necessidade de impressão.',
    documents_note: 'Tenha contracheques, documentos fiscais e identificação prontos.',
    start_btn: 'Iniciar minha solicitação',
    resume_btn: 'Continuar de onde parei',
  },
};

export default function IntakeLandingPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';
  const router = useRouter();
  const { state } = useIntakeBootstrap(token);

  const language: PreferredLanguage =
    state.status === 'ready' ? state.data.preferred_language : 'en';
  const intakeData = state.status === 'ready' ? state.data.intake_data : {};
  const c = copy[language] ?? copy.en;

  const isResume =
    state.status === 'ready' && state.data.intake_status === 'in_progress';

  const handleStart = () => {
    const resumeSection =
      (intakeData as any)?._resume_section ?? 'household';
    router.push(`/pbv-full-app/${token}/intake/${isResume ? resumeSection : 'household'}`);
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

  return (
    <div className="min-h-screen bg-[var(--paper)] flex flex-col">
      <main className="flex-1 px-4 py-8 max-w-lg mx-auto w-full space-y-8">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[var(--primary)] mb-2">{c.title}</h1>
          <p className="text-sm text-[var(--body)]">{c.subtitle}</p>
        </div>

        <p className="text-xs font-medium text-[var(--muted)] border border-[var(--border)] bg-white px-3 py-2 inline-block">
          {c.time_estimate}
        </p>

        <ol className="space-y-4">
          {[
            { title: c.step1_title, desc: c.step1_desc },
            { title: c.step2_title, desc: c.step2_desc },
            { title: c.step3_title, desc: c.step3_desc },
          ].map((step, i) => (
            <li key={i} className="flex gap-4">
              <span className="flex-shrink-0 w-7 h-7 border border-[var(--border)] bg-white flex items-center justify-center text-xs font-bold text-[var(--primary)]">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-[var(--body)]">{step.title}</p>
                <p className="text-sm text-[var(--muted)]">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="text-xs text-[var(--muted)] border-l-2 border-[var(--border)] pl-3">
          {c.documents_note}
        </p>
      </main>

      <footer className="sticky bottom-0 bg-white border-t border-[var(--border)] px-4 py-3">
        <div className="max-w-lg mx-auto">
          <button
            type="button"
            onClick={handleStart}
            className="w-full min-h-[44px] bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {isResume ? c.resume_btn : c.start_btn}
          </button>
        </div>
      </footer>
    </div>
  );
}
