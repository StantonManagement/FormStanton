'use client';

/**
 * components/pbv/sign/ApplicationStatusBanner.tsx
 *
 * Status banner for tenant dashboard showing application review state.
 * PRD-36: Tenant-Facing Application Status
 */

import type { PreferredLanguage } from '@/types/compliance';

export type ApplicationReviewStatus =
  | 'in_progress'    // PRD-58: honest pre-submit acknowledgment
  | 'submitted'
  | 'under_review'
  | 'action_required'
  | 'approved'
  | 'denied'
  | 'archived';

interface OfficeContact {
  name: string;
  phone: string;
  email: string;
  hours: string;
}

interface Props {
  status: ApplicationReviewStatus | null;
  statusAt: string | null;
  statusNote: string | null;
  rejectedCount: number;
  language: PreferredLanguage;
  officeContact: OfficeContact;
  onActionRequiredClick?: () => void;
  // PRD-58: Props for in_progress status
  summarySigned?: boolean;
  formsSigned?: number;
  formsTotal?: number;
  uploadComplete?: number;
  uploadTotal?: number;
  canSubmit?: boolean;
  nextStep?: 'summary' | 'forms' | 'documents' | 'complete';
}

interface StatusCopy {
  title: string;
  message: string;
  sla?: string;
}

const copy: Record<ApplicationReviewStatus, Record<PreferredLanguage, StatusCopy>> = {
  in_progress: {
    en: {
      title: "We're processing your application",
      message: "We've got your answers. Complete the remaining steps to submit.",
    },
    es: {
      title: 'Estamos procesando su solicitud',
      message: 'Tenemos sus respuestas. Complete los pasos restantes para enviar.',
    },
    pt: {
      // PT: tentative — review
      title: 'Estamos processando sua solicitação',
      message: 'Temos suas respostas. Complete os passos restantes para enviar.',
    },
  },
  submitted: {
    en: {
      title: 'Application Submitted',
      message: 'Your application has been received.',
      sla: 'Office reviews typically within 2 weeks of submission.',
    },
    es: {
      title: 'Solicitud Enviada',
      message: 'Su solicitud ha sido recibida.',
      sla: 'La oficina revisa típicamente dentro de las 2 semanas posteriores al envío.',
    },
    pt: {
      // PT: tentative — review
      title: 'Solicitação Enviada',
      message: 'Sua solicitação foi recebida.',
      sla: 'O escritório revisa tipicamente dentro de 2 semanas após o envio.',
    },
  },
  under_review: {
    en: {
      title: 'Under Review',
      message: 'Your application is being reviewed by our office.',
    },
    es: {
      title: 'En Revisión',
      message: 'Su solicitud está siendo revisada por nuestra oficina.',
    },
    pt: {
      // PT: tentative — review
      title: 'Em Revisão',
      message: 'Sua solicitação está sendo revisada pelo nosso escritório.',
    },
  },
  action_required: {
    en: {
      title: 'Action Required',
      message: 'Some documents need to be replaced. See below for details.',
    },
    es: {
      title: 'Acción Requerida',
      message: 'Algunos documentos necesitan ser reemplazados. Vea abajo para más detalles.',
    },
    pt: {
      // PT: tentative — review
      title: 'Ação Necessária',
      message: 'Alguns documentos precisam ser substituídos. Veja abaixo para mais detalhes.',
    },
  },
  approved: {
    en: {
      title: 'Application Approved',
      message: 'Your application has been approved. The office will contact you about next steps.',
    },
    es: {
      title: 'Solicitud Aprobada',
      message: 'Su solicitud ha sido aprobada. La oficina se comunicará con usted sobre los próximos pasos.',
    },
    pt: {
      // PT: tentative — review
      title: 'Solicitação Aprovada',
      message: 'Sua solicitação foi aprovada. O escritório entrará em contato sobre os próximos passos.',
    },
  },
  denied: {
    en: {
      title: 'Application Denied',
      message: 'Your application has been denied.',
    },
    es: {
      title: 'Solicitud Denegada',
      message: 'Su solicitud ha sido denegada.',
    },
    pt: {
      // PT: tentative — review
      title: 'Solicitação Negada',
      message: 'Sua solicitação foi negada.',
    },
  },
  archived: {
    en: {
      title: 'Application Archived',
      message: 'This application has been closed and archived.',
    },
    es: {
      title: 'Solicitud Archivada',
      message: 'Esta solicitud ha sido cerrada y archivada.',
    },
    pt: {
      // PT: tentative — review
      title: 'Solicitação Arquivada',
      message: 'Esta solicitação foi fechada e arquivada.',
    },
  },
};

const contactCopy: Record<PreferredLanguage, { contactLabel: string; phoneLabel: string; emailLabel: string }> = {
  en: { contactLabel: 'Questions? Contact us:', phoneLabel: 'Phone:', emailLabel: 'Email:' },
  es: { contactLabel: '¿Preguntas? Contáctenos:', phoneLabel: 'Teléfono:', emailLabel: 'Correo:' },
  pt: { contactLabel: 'Dúvidas? Entre em contato:', phoneLabel: 'Telefone:', emailLabel: 'E-mail:' },
};

// Color schemes per status (using CSS variables)
const statusStyles: Record<ApplicationReviewStatus, { bg: string; border: string; icon: string }> = {
  in_progress:   { bg: 'bg-blue-50',    border: 'border-blue-200',    icon: 'text-blue-600' },
  submitted:     { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600' },
  under_review:  { bg: 'bg-blue-50',    border: 'border-blue-200',    icon: 'text-blue-600' },
  action_required: { bg: 'bg-amber-50',  border: 'border-amber-200',   icon: 'text-amber-600' },
  approved:      { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-600' },
  denied:        { bg: 'bg-red-50',     border: 'border-red-200',     icon: 'text-red-600' },
  archived:      { bg: 'bg-gray-50',    border: 'border-gray-200',    icon: 'text-gray-500' },
};

// Status icons (SVG paths)
const statusIcons: Record<ApplicationReviewStatus, string> = {
  in_progress: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', // clock (same as under_review)
  submitted: 'M5 13l4 4L19 7', // check
  under_review: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', // clock
  action_required: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', // warning triangle
  approved: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', // check circle
  denied: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M7 7l10 10L7 7z', // x
  archived: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4', // archive
};

export default function ApplicationStatusBanner({
  status,
  statusAt,
  statusNote,
  rejectedCount,
  language,
  officeContact,
  onActionRequiredClick,
  summarySigned,
  formsSigned,
  formsTotal,
  uploadComplete,
  uploadTotal,
  canSubmit,
  nextStep,
}: Props) {
  // Don't render if no status
  if (!status) return null;

  const c = copy[status][language] ?? copy[status].en;
  const styles = statusStyles[status];
  const contact = contactCopy[language];

  // PRD-58: Build next-step message for in_progress status
  const getNextStepMessage = (): string => {
    if (!nextStep || canSubmit) return '';
    const steps: Record<string, string> = {
      summary: language === 'es' ? 'Revisa y firma tu resumen' : language === 'pt' ? 'Revise e assine seu resumo' : 'Review and sign your summary',
      forms: language === 'es' ? 'Firma los formularios requeridos' : language === 'pt' ? 'Assine os formulários obrigatórios' : 'Sign required forms',
      documents: language === 'es' ? 'Sube los documentos requeridos' : language === 'pt' ? 'Envie os documentos obrigatórios' : 'Upload required documents',
    };
    const prefix = language === 'es' ? 'Siguiente paso: ' : language === 'pt' ? 'Próximo passo: ' : 'Next step: ';
    return prefix + (steps[nextStep] ?? '');
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mb-6 border ${styles.border} ${styles.bg} rounded-none p-4`}
    >
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div className="flex-shrink-0">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className={`w-6 h-6 ${styles.icon}`}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={statusIcons[status]} />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h2 className="font-serif text-base font-semibold text-[var(--ink)]">
            {c.title}
          </h2>

          <p className="text-sm text-[var(--muted)] mt-1">
            {c.message}
          </p>

          {/* PRD-58: Next step hint for in_progress status */}
          {status === 'in_progress' && (
            <p className="text-sm text-[var(--primary)] mt-2 font-medium">
              {getNextStepMessage()}
            </p>
          )}

          {/* SLA copy for submitted status */}
          {c.sla && (
            <p className="text-sm text-[var(--muted)] mt-1 italic">
              {c.sla}
            </p>
          )}

          {/* Status note for denied status */}
          {status === 'denied' && statusNote && (
            <p className="text-sm text-red-700 mt-2 font-medium">
              Reason: {statusNote}
            </p>
          )}

          {/* Rejected documents count for action_required */}
          {status === 'action_required' && rejectedCount > 0 && (
            <p className="text-sm text-amber-700 mt-2">
              <strong>{rejectedCount}</strong> document{rejectedCount !== 1 ? 's' : ''} need{rejectedCount === 1 ? 's' : ''} replacement.
              {onActionRequiredClick && (
                <button
                  onClick={onActionRequiredClick}
                  className="ml-2 underline hover:no-underline text-[var(--primary)] font-medium"
                >
                  View rejected documents
                </button>
              )}
            </p>
          )}

          {/* Office contact for denied and action_required */}
          {(status === 'denied' || status === 'action_required') && (
            <div className="mt-3 pt-3 border-t border-[var(--border)] text-sm text-[var(--muted)]">
              <p className="font-medium">{contact.contactLabel}</p>
              <p className="mt-1">
                {contact.phoneLabel} <a href={`tel:${officeContact.phone.replace(/\D/g, '')}`} className="underline hover:no-underline">{officeContact.phone}</a>
              </p>
              <p>
                {contact.emailLabel} <a href={`mailto:${officeContact.email}`} className="underline hover:no-underline">{officeContact.email}</a>
              </p>
              {officeContact.hours && <p className="text-xs mt-1">{officeContact.hours}</p>}
            </div>
          )}

          {/* Timestamp */}
          {statusAt && (
            <p className="text-xs text-[var(--muted)] mt-2">
              {new Date(statusAt).toLocaleDateString(language === 'es' ? 'es-ES' : language === 'pt' ? 'pt-BR' : 'en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
