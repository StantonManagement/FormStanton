'use client';

/**
 * components/pbv/sign/TenantDashboard.tsx
 * Post-intake hub. Four task cards.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardCard, { type CardStatus } from './DashboardCard';
import DocumentProgressBar from './DocumentProgressBar';
import ApplicationStatusBanner, { type ApplicationReviewStatus } from './ApplicationStatusBanner';
import { tenantFetch } from '@/lib/tenantFetch';
import { getOfficeContact } from '@/lib/pbv/officeContacts';
import { computeHubProgress } from '@/lib/pbv/computeHubProgress';
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
  hub_progress: (completed: number, total: number) => string;
  card1_title: string;
  card1_sub_pending: string;
  card1_sub_done: string;
  card2_title: string;
  card2_sub_locked: string;
  card2_sub_pending: (signed: number, total: number) => string;
  card3_title: string;
  card3_title_action_required: (n: number) => string;
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
  download_copy: string;
  download_copy_sub: string;
  view_documents: string;
  review_application: string;
}

const copy: Record<PreferredLanguage, CopyMap> = {
  en: {
    title: 'Application Dashboard',
    subtitle: 'Complete all required tasks to submit your application.',
    hub_progress: (completed, total) => `Step ${completed} of ${total} complete`,
    card1_title: 'Review and sign your summary',
    card1_sub_pending: 'Read and sign the plain-language summary of your application.',
    card1_sub_done: 'Summary signed.',
    card2_title: 'Review and sign required forms',
    card2_sub_locked: 'Complete the summary step first.',
    card2_sub_pending: (signed, total) => `${signed} of ${total} forms signed.`,
    card3_title: 'Upload required documents',
    card3_title_action_required: (n) => `Replace rejected documents (${n})`,
    card3_sub_pending: (done, total) => `${done} of ${total} uploaded.`,
  // Note: card3 now uses DocumentProgressBar component instead of text subtitle
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
    download_copy: 'Download my application copy',
    download_copy_sub: 'Get a PDF copy of your submitted application for your records.',
    view_documents: 'View my documents',
    review_application: 'Review my application',
  },
  es: {
    title: 'Panel de Solicitud',
    subtitle: 'Complete todas las tareas requeridas para enviar su solicitud.',
    hub_progress: (completed, total) => `Paso ${completed} de ${total} completado`,
    card1_title: 'Revisar y firmar su resumen',
    card1_sub_pending: 'Lea y firme el resumen en lenguaje sencillo de su solicitud.',
    card1_sub_done: 'Resumen firmado.',
    card2_title: 'Revisar y firmar los formularios requeridos',
    card2_sub_locked: 'Complete primero el paso del resumen.',
    card2_sub_pending: (signed, total) => `${signed} de ${total} formularios firmados.`,
    card3_title: 'Subir documentos requeridos',
    card3_title_action_required: (n) => `Reemplazar documentos rechazados (${n})`,
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
    download_copy: 'Descargar copia de mi solicitud',
    download_copy_sub: 'Obtenga una copia PDF de su solicitud para sus archivos.',
    view_documents: 'Ver mis documentos',
    review_application: 'Revisar mi solicitud',
  },
  pt: {
    // PT: tentative — review
    title: 'Painel de Solicita\u00e7\u00e3o',
    subtitle: 'Conclua todas as tarefas obrigat\u00f3rias para enviar sua solicita\u00e7\u00e3o.',
    hub_progress: (completed, total) => `Etapa ${completed} de ${total} conclu\u00edda`,
    card1_title: 'Revisar e assinar seu resumo',
    card1_sub_pending: 'Leia e assine o resumo em linguagem simples da sua solicita\u00e7\u00e3o.',
    card1_sub_done: 'Resumo assinado.',
    card2_title: 'Revisar e assinar os formul\u00e1rios obrigat\u00f3rios',
    card2_sub_locked: 'Complete primeiro a etapa do resumo.',
    card2_sub_pending: (signed, total) => `${signed} de ${total} formul\u00e1rios assinados.`,
    card3_title: 'Enviar documentos obrigatórios',
    card3_title_action_required: (n) => `Substituir documentos rejeitados (${n})`,
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
    download_copy: 'Baixar c\u00f3pia da solicita\u00e7\u00e3o',
    download_copy_sub: 'Obtenha uma c\u00f3pia PDF da sua solicita\u00e7\u00e3o para seus registros.',
    view_documents: 'Ver meus documentos',
    review_application: 'Revisar minha inscri\u00e7\u00e3o',
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
  
  // F4: Action-required surfacing — change documents card when action_required
  const isActionRequired = data.application_review_status === 'action_required';
  const card3Title = isActionRequired && data.rejected_documents_count > 0
    ? c.card3_title_action_required(data.rejected_documents_count)
    : c.card3_title;
  const card3Sub =
    card3Status === 'complete'
      ? c.card3_sub_done
      : c.card3_sub_pending(data.upload_complete, data.upload_total);

  const card4Status: CardStatus = data.additional_signers_needed ? 'pending' : 'complete';

  // PRD-73 U7: hub-level progress across the four task cards.
  const hub = computeHubProgress([card1Status, card2Status, card3Status, card4Status]);

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

  // Office contact for banner (hardcoded V1 per PRD-36)
  const officeContact = getOfficeContact(data.building_address);

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <div className="max-w-lg mx-auto px-4 py-8">
        <h1 className="font-serif text-2xl text-[var(--primary)] mb-1">{c.title}</h1>
        <p className="text-sm text-[var(--muted)] mb-4">{c.subtitle}</p>

        {/* PRD-73 U7: hub-level progress indicator. Always rendered (a green
            4/4 bar on a submitted application is a useful confirmation). */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--ink)]">{c.hub_progress(hub.completed, hub.total)}</span>
            <span className="text-sm font-medium text-[var(--ink)]">{hub.percentage}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-none overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ease-out ${
                hub.percentage === 100 ? 'bg-green-600' : hub.percentage > 0 ? 'bg-amber-500' : 'bg-gray-400'
              }`}
              style={{ width: `${hub.percentage}%` }}
              role="progressbar"
              aria-valuenow={hub.completed}
              aria-valuemin={0}
              aria-valuemax={hub.total}
              aria-label={c.hub_progress(hub.completed, hub.total)}
            />
          </div>
        </div>

        {/* PRD-58 Phase 1: Banner keyed on true submission state.
            - Show submitted/review banner only if truly submitted (submitted_at set)
              OR if office has set a review status.
            - Otherwise show honest in-progress acknowledgment. */}
        {data.intake_status === 'complete' && (
          <ApplicationStatusBanner
            status={
              (data.submitted_at || data.application_review_status)
                ? (data.application_review_status as ApplicationReviewStatus ?? 'submitted')
                : 'in_progress'
            }
            statusAt={data.application_review_status_at}
            statusNote={data.application_review_status_note}
            rejectedCount={data.rejected_documents_count}
            language={lang}
            officeContact={officeContact}
            onActionRequiredClick={
              isActionRequired
                ? () => router.push(`/pbv-full-app/${token}/documents?filter=rejected`)
                : undefined
            }
            summarySigned={data.summary_signed}
            formsSigned={data.forms_signed}
            formsTotal={data.forms_total}
            uploadComplete={data.upload_complete}
            uploadTotal={data.upload_total}
            canSubmit={data.can_submit}
            nextStep={data.can_submit ? 'complete' : data.summary_signed ? (data.forms_signed < data.forms_total ? 'forms' : 'documents') : 'summary'}
          />
        )}

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
            title={card3Title}
            subtitle={
              <DocumentProgressBar
                uploaded={data.upload_complete}
                total={data.upload_total}
                optionalUploaded={data.optional_uploaded_count}
                language={lang}
              />
            }
            status={card3Status}
            actionLabel={
              isActionRequired
                ? c.start
                : card3Status === 'complete'
                ? undefined
                : card3Status === 'in_progress'
                ? c.resume
                : c.start
            }
            onAction={() => router.push(`/pbv-full-app/${token}/documents${isActionRequired ? '?filter=rejected' : ''}`)}
          />

          <DashboardCard
            title={c.card4_title}
            subtitle={data.additional_signers_needed ? c.card4_sub_pending(data.additional_signers_pending_count) : c.card4_sub_done}
            status={card4Status}
            actionLabel={data.additional_signers_needed ? c.start : undefined}
            onAction={() => router.push(`/pbv-full-app/${token}/sign/additional-signers`)}
          />
        </div>

        {/* PRD-67: secondary actions (view docs, review answers) — available
            before & after submission. */}
        <div className="mt-6 pt-6 border-t border-[var(--border)] space-y-3">
          <button
            type="button"
            onClick={() => router.push(`/pbv-full-app/${token}/documents?view=all`)}
            className="w-full text-sm text-[var(--primary)] underline hover:opacity-75 transition-opacity text-center min-h-[44px]"
          >
            {c.view_documents}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/pbv-full-app/${token}/review`)}
            className="w-full text-sm text-[var(--primary)] underline hover:opacity-75 transition-opacity text-center min-h-[44px]"
          >
            {c.review_application}
          </button>
        </div>

        {/* Download application copy link - PRD-67 U2/Gate 6: gated on
            submitted_at (the print/download endpoint 403s until then). */}
        {data.submitted_at && (
          <div className="mt-6 pt-6 border-t border-[var(--border)]">
            <a
              href={`/api/t/${token}/pbv-full-app/print/download`}
              download
              className="flex items-center justify-center gap-2 text-sm text-[var(--primary)] hover:opacity-75 transition-opacity"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>{c.download_copy}</span>
            </a>
            <p className="text-xs text-[var(--muted)] text-center mt-1">{c.download_copy_sub}</p>
          </div>
        )}

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
