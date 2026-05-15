'use client';

/**
 * components/pbv/sign/TenantDashboard.tsx
 * Post-intake hub. Four task cards.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardCard, { type CardStatus } from './DashboardCard';
import { tenantFetch } from '@/lib/tenantFetch';
import type { DashboardData } from '@/lib/pbv/hooks/useDashboardState';
import type { PreferredLanguage } from '@/types/compliance';

interface Props {
  token: string;
  data: DashboardData;
  onReload: () => void;
}

interface CopyMap {
  title: string;
  subtitle: string;
  card1_title: string;
  card1_sub_pending: string;
  card1_sub_done: string;
  card2_title: string;
  card2_sub_locked: string;
  card2_sub_pending: (signed: number, total: number) => string;
  card3_title: string;
  card3_sub_pending: (done: number, total: number) => string;
  card3_sub_done: string;
  card4_title: string;
  card4_sub_pending: (n: number) => string;
  card4_sub_done: string;
  start: string;
  resume: string;
  submit_btn: string;
  submitting: string;
  submit_error: string;
  submit_disabled_reason: string;
}

const copy: Record<PreferredLanguage, CopyMap> = {
  en: {
    title: 'Application Dashboard',
    subtitle: 'Complete all required tasks to submit your application.',
    card1_title: 'Review and sign your summary',
    card1_sub_pending: 'Read and sign the plain-language summary of your application.',
    card1_sub_done: 'Summary signed.',
    card2_title: 'Review and sign required forms',
    card2_sub_locked: 'Complete the summary step first.',
    card2_sub_pending: (signed, total) => `${signed} of ${total} forms signed.`,
    card3_title: 'Upload required documents',
    card3_sub_pending: (done, total) => `${done} of ${total} uploaded.`,
    card3_sub_done: 'All documents uploaded.',
    card4_title: 'Other adults in your household',
    card4_sub_pending: (n) => `${n} adult${n !== 1 ? 's' : ''} still need${n === 1 ? 's' : ''} to sign.`,
    card4_sub_done: 'All adults have signed.',
    start: 'Start',
    resume: 'Resume',
    submit_btn: 'Submit my application',
    submitting: 'Submitting\u2026',
    submit_error: 'Could not submit: ',
    submit_disabled_reason: 'Complete all tasks above before submitting.',
  },
  es: {
    title: 'Panel de Solicitud',
    subtitle: 'Complete todas las tareas requeridas para enviar su solicitud.',
    card1_title: 'Revisar y firmar su resumen',
    card1_sub_pending: 'Lea y firme el resumen en lenguaje sencillo de su solicitud.',
    card1_sub_done: 'Resumen firmado.',
    card2_title: 'Revisar y firmar los formularios requeridos',
    card2_sub_locked: 'Complete primero el paso del resumen.',
    card2_sub_pending: (signed, total) => `${signed} de ${total} formularios firmados.`,
    card3_title: 'Subir documentos requeridos',
    card3_sub_pending: (done, total) => `${done} de ${total} subidos.`,
    card3_sub_done: 'Todos los documentos subidos.',
    card4_title: 'Otros adultos en su hogar',
    card4_sub_pending: (n) => `${n} adulto${n !== 1 ? 's' : ''} a\u00fan deb${n === 1 ? 'e' : 'en'} firmar.`,
    card4_sub_done: 'Todos los adultos han firmado.',
    start: 'Comenzar',
    resume: 'Continuar',
    submit_btn: 'Enviar mi solicitud',
    submitting: 'Enviando\u2026',
    submit_error: 'No se pudo enviar: ',
    submit_disabled_reason: 'Complete todas las tareas para enviar.',
  },
  pt: {
    // PT: tentative — review
    title: 'Painel de Solicita\u00e7\u00e3o',
    subtitle: 'Conclua todas as tarefas obrigat\u00f3rias para enviar sua solicita\u00e7\u00e3o.',
    card1_title: 'Revisar e assinar seu resumo',
    card1_sub_pending: 'Leia e assine o resumo em linguagem simples da sua solicita\u00e7\u00e3o.',
    card1_sub_done: 'Resumo assinado.',
    card2_title: 'Revisar e assinar os formul\u00e1rios obrigat\u00f3rios',
    card2_sub_locked: 'Complete primeiro a etapa do resumo.',
    card2_sub_pending: (signed, total) => `${signed} de ${total} formul\u00e1rios assinados.`,
    card3_title: 'Enviar documentos obrigat\u00f3rios',
    card3_sub_pending: (done, total) => `${done} de ${total} enviados.`,
    card3_sub_done: 'Todos os documentos enviados.',
    card4_title: 'Outros adultos na sua fam\u00edlia',
    card4_sub_pending: (n) => `${n} adulto${n !== 1 ? 's' : ''} ainda precisa${n !== 1 ? 'm' : ''} assinar.`,
    card4_sub_done: 'Todos os adultos assinaram.',
    start: 'Iniciar',
    resume: 'Retomar',
    submit_btn: 'Enviar minha solicita\u00e7\u00e3o',
    submitting: 'Enviando\u2026',
    submit_error: 'N\u00e3o foi poss\u00edvel enviar: ',
    submit_disabled_reason: 'Conclua todas as tarefas acima para enviar.',
  },
};

export default function TenantDashboard({ token, data, onReload }: Props) {
  const lang = data.preferred_language ?? 'en';
  const c = copy[lang] ?? copy.en;
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const card1Status: CardStatus = data.summary_signed ? 'complete' : 'pending';

  const card2Status: CardStatus = !data.summary_signed
    ? 'locked'
    : data.forms_total > 0 && data.forms_signed >= data.forms_total
    ? 'complete'
    : data.forms_signed > 0
    ? 'in_progress'
    : 'pending';
  const card2Sub = !data.summary_signed
    ? c.card2_sub_locked
    : c.card2_sub_pending(data.forms_signed, data.forms_total);

  const card3Status: CardStatus =
    data.upload_total > 0 && data.upload_complete >= data.upload_total
      ? 'complete'
      : data.upload_complete > 0
      ? 'in_progress'
      : 'pending';
  const card3Sub =
    card3Status === 'complete'
      ? c.card3_sub_done
      : c.card3_sub_pending(data.upload_complete, data.upload_total);

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await tenantFetch(`/api/t/${token}/pbv-full-app/finalize`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).message || `Submit failed (${res.status})`);
      onReload();
    } catch (err: any) {
      setSubmitError(err.message || 'Submit failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <div className="max-w-lg mx-auto px-4 py-8">
        <h1 className="font-serif text-2xl text-[var(--primary)] mb-1">{c.title}</h1>
        <p className="text-sm text-[var(--muted)] mb-6">{c.subtitle}</p>

        <div className="space-y-3">
          <DashboardCard
            title={c.card1_title}
            subtitle={data.summary_signed ? c.card1_sub_done : c.card1_sub_pending}
            status={card1Status}
            actionLabel={data.summary_signed ? undefined : c.start}
            onAction={() => router.push(`/pbv-full-app/${token}/sign/summary`)}
          />

          <DashboardCard
            title={c.card2_title}
            subtitle={card2Sub}
            status={card2Status}
            actionLabel={
              card2Status === 'locked' || card2Status === 'complete' ? undefined :
              card2Status === 'in_progress' ? c.resume : c.start
            }
            onAction={card2Status !== 'locked' ? () => router.push(`/pbv-full-app/${token}/sign/forms`) : undefined}
          />

          <DashboardCard
            title={c.card3_title}
            subtitle={card3Sub}
            status={card3Status}
            actionLabel={card3Status === 'complete' ? undefined : card3Status === 'in_progress' ? c.resume : c.start}
            onAction={() => router.push(`/pbv-full-app/${token}/documents`)}
          />

          <DashboardCard
            title={c.card4_title}
            subtitle={data.additional_signers_needed ? c.card4_sub_pending(data.additional_signers_pending_count) : c.card4_sub_done}
            status={data.additional_signers_needed ? 'pending' : 'complete'}
            actionLabel={data.additional_signers_needed ? c.start : undefined}
            onAction={() => router.push(`/pbv-full-app/${token}/sign/additional-signers`)}
          />
        </div>

        <div className="mt-8">
          {submitError && (
            <p className="text-sm text-[var(--error)] mb-3">{c.submit_error}{submitError}</p>
          )}
          {!data.can_submit && (
            <p className="text-xs text-[var(--muted)] mb-2 text-center">{c.submit_disabled_reason}</p>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!data.can_submit || submitting}
            className="w-full min-h-[44px] bg-[var(--primary)] text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {submitting ? c.submitting : c.submit_btn}
          </button>
        </div>
      </div>
    </div>
  );
}
