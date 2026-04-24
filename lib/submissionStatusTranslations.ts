import { PreferredLanguage } from '@/types/compliance';

export interface SubmissionStatusStrings {
  loading: string;
  link_invalid: string;

  page_subtitle: string;
  submitted_on: (date: string) => string;

  progress_label: (approved: number, total: number) => string;

  status_approved: string;
  status_submitted: string;
  status_rejected: string;
  status_missing: string;
  status_waived: string;

  parent_pending_review: string;
  parent_under_review: string;
  parent_approved: string;
  parent_revision_requested: string;
  parent_denied: string;
  parent_completed: string;

  count_approved: string;
  count_awaiting: string;
  count_rejected: string;
  count_missing: string;
  count_waived: string;

  documents_header: string;
  optional_label: string;
  person_label: (n: number) => string;

  rejection_reason_label: string;
  scan_quality_label: string;
  scan_blurry: string;
  scan_dark: string;
  scan_low_resolution: string;
  scan_retake_btn: string;
  scan_needs_retake_summary: (count: number) => string;
  approved_locked: string;
  waived_note: string;
  missing_hint: string;

  upload_btn: string;
  replace_btn: string;
  uploading: string;
  upload_success: string;
  err_upload_failed: string;
  err_type_hint: string;

  all_done_title: string;
  all_done_body: string;
}

export const submissionStatusTranslations: Record<PreferredLanguage, SubmissionStatusStrings> = {
  en: {
    loading: 'Loading your documents...',
    link_invalid: 'This link is not valid or has expired. Contact your property manager for a new one.',

    page_subtitle: 'Document Status',
    submitted_on: (date) => `Submitted ${date}`,

    progress_label: (approved, total) => `${approved} of ${total} required documents complete`,

    status_approved: 'Approved',
    status_submitted: 'Awaiting Review',
    status_rejected: 'Changes Needed',
    status_missing: 'Not Uploaded',
    status_waived: 'Not Required',

    parent_pending_review: 'Awaiting Review',
    parent_under_review: 'Under Review',
    parent_approved: 'Approved',
    parent_revision_requested: 'Documents Need Attention',
    parent_denied: 'Not Approved',
    parent_completed: 'Complete',

    count_approved: 'Approved',
    count_awaiting: 'Awaiting',
    count_rejected: 'Need Changes',
    count_missing: 'Not Uploaded',
    count_waived: 'Not Required',

    documents_header: 'Your Documents',
    optional_label: 'Optional',
    person_label: (n) => `Person ${n}`,

    rejection_reason_label: 'What to fix:',
    scan_quality_label: 'Scan quality issue:',
    scan_blurry: 'Blurry',
    scan_dark: 'Too dark',
    scan_low_resolution: 'Low resolution',
    scan_retake_btn: 'Retake',
    scan_needs_retake_summary: (count) => `${count} document${count === 1 ? '' : 's'} may need to be retaken`,
    approved_locked: 'Approved — no changes needed',
    waived_note: 'Not required for your household',
    missing_hint: 'Not yet uploaded',

    upload_btn: 'Upload',
    replace_btn: 'Upload Replacement',
    uploading: 'Uploading...',
    upload_success: 'Uploaded — awaiting review',
    err_upload_failed: 'Upload failed. Please try again.',
    err_type_hint: 'Accepted: PDF, JPG, PNG (max 20 MB)',

    all_done_title: "You're all set.",
    all_done_body: 'All required documents have been received. You will be contacted if anything else is needed.',
  },

  es: {
    loading: 'Cargando sus documentos...',
    link_invalid: 'Este enlace no es válido o ha expirado. Comuníquese con su administrador de propiedad.',

    page_subtitle: 'Estado de Documentos',
    submitted_on: (date) => `Enviado el ${date}`,

    progress_label: (approved, total) => `${approved} de ${total} documentos requeridos completos`,

    status_approved: 'Aprobado',
    status_submitted: 'En espera de revisión',
    status_rejected: 'Cambios requeridos',
    status_missing: 'No enviado',
    status_waived: 'No requerido',

    parent_pending_review: 'En espera de revisión',
    parent_under_review: 'En revisión',
    parent_approved: 'Aprobado',
    parent_revision_requested: 'Documentos requieren atención',
    parent_denied: 'No aprobado',
    parent_completed: 'Completo',

    count_approved: 'Aprobados',
    count_awaiting: 'En espera',
    count_rejected: 'Con cambios',
    count_missing: 'Sin enviar',
    count_waived: 'No requeridos',

    documents_header: 'Sus Documentos',
    optional_label: 'Opcional',
    person_label: (n) => `Persona ${n}`,

    rejection_reason_label: 'Qué corregir:',
    scan_quality_label: 'Problema de calidad del escaneo:',
    scan_blurry: 'Borroso',
    scan_dark: 'Demasiado oscuro',
    scan_low_resolution: 'Baja resolución',
    scan_retake_btn: 'Volver a tomar',
    scan_needs_retake_summary: (count) => `${count} documento${count === 1 ? '' : 's'} podría${count === 1 ? '' : 'n'} necesitar volver a tomarse`,
    approved_locked: 'Aprobado — no se necesitan cambios',
    waived_note: 'No requerido para su hogar',
    missing_hint: 'Aún no enviado',

    upload_btn: 'Subir',
    replace_btn: 'Subir reemplazo',
    uploading: 'Subiendo...',
    upload_success: 'Subido — en espera de revisión',
    err_upload_failed: 'Error al subir. Intente nuevamente.',
    err_type_hint: 'Aceptados: PDF, JPG, PNG (máx. 20 MB)',

    all_done_title: 'Todo listo.',
    all_done_body: 'Todos los documentos requeridos han sido recibidos. Se le contactará si se necesita algo más.',
  },

  pt: {
    loading: 'Carregando seus documentos...',
    link_invalid: 'Este link não é válido ou expirou. Entre em contato com seu gerente de propriedade.',

    page_subtitle: 'Status dos Documentos',
    submitted_on: (date) => `Enviado em ${date}`,

    progress_label: (approved, total) => `${approved} de ${total} documentos obrigatórios concluídos`,

    status_approved: 'Aprovado',
    status_submitted: 'Aguardando revisão',
    status_rejected: 'Alterações necessárias',
    status_missing: 'Não enviado',
    status_waived: 'Não obrigatório',

    parent_pending_review: 'Aguardando revisão',
    parent_under_review: 'Em revisão',
    parent_approved: 'Aprovado',
    parent_revision_requested: 'Documentos precisam de atenção',
    parent_denied: 'Não aprovado',
    parent_completed: 'Concluído',

    count_approved: 'Aprovados',
    count_awaiting: 'Aguardando',
    count_rejected: 'Com alterações',
    count_missing: 'Não enviados',
    count_waived: 'Não obrigatórios',

    documents_header: 'Seus Documentos',
    optional_label: 'Opcional',
    person_label: (n) => `Pessoa ${n}`,

    rejection_reason_label: 'O que corrigir:',
    scan_quality_label: 'Problema de qualidade da digitalização:',
    scan_blurry: 'Borrado',
    scan_dark: 'Muito escuro',
    scan_low_resolution: 'Baixa resolução',
    scan_retake_btn: 'Refazer foto',
    scan_needs_retake_summary: (count) => `${count} documento${count === 1 ? '' : 's'} pode${count === 1 ? '' : 'm'} precisar ser reenviado${count === 1 ? '' : 's'}`,
    approved_locked: 'Aprovado — sem alterações necessárias',
    waived_note: 'Não obrigatório para sua família',
    missing_hint: 'Ainda não enviado',

    upload_btn: 'Enviar',
    replace_btn: 'Enviar substituto',
    uploading: 'Enviando...',
    upload_success: 'Enviado — aguardando revisão',
    err_upload_failed: 'Falha no envio. Tente novamente.',
    err_type_hint: 'Aceitos: PDF, JPG, PNG (máx. 20 MB)',

    all_done_title: 'Tudo pronto.',
    all_done_body: 'Todos os documentos obrigatórios foram recebidos. Você será contatado se precisarmos de mais alguma coisa.',
  },
};
