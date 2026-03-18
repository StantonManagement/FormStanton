import { PreferredLanguage } from '@/types/compliance';

export interface PortalStrings {
  deadline_label: string;
  progress_label: (n: number, total: number) => string;
  link_invalid: string;
  link_expired: string;
  task_locked: string;
  staff_check_label: string;
  submit: string;
  clear: string;
  all_complete_title: string;
  all_complete_body: string;
  acknowledgment_default: string;
  loading: string;
  submitting: string;
  upload_file: string;
  take_photo: string;
  select_file: string;
  open_form: string;
  signature_required: string;
  file_required: string;
  completed: string;
  pending: string;
  tasks_title: string;
}

export const portalTranslations: Record<PreferredLanguage, PortalStrings> = {
  en: {
    deadline_label: 'Complete by',
    progress_label: (n, total) => `${n} of ${total} tasks complete`,
    link_invalid: 'This link is not valid.',
    link_expired: 'This link has expired. Contact your property manager for a new one.',
    task_locked: 'Complete previous tasks first.',
    staff_check_label: 'Will be verified by staff.',
    submit: 'Submit',
    clear: 'Clear',
    all_complete_title: "You're done.",
    all_complete_body: 'Thank you for completing your tasks.',
    acknowledgment_default: 'I acknowledge receipt of this document.',
    loading: 'Loading...',
    submitting: 'Submitting...',
    upload_file: 'Upload File',
    take_photo: 'Take Photo',
    select_file: 'Select File',
    open_form: 'Open Form',
    signature_required: 'Signature is required.',
    file_required: 'Please select a file.',
    completed: 'Completed',
    pending: 'Pending',
    tasks_title: 'Your Tasks',
  },
  es: {
    deadline_label: 'Completar antes del',
    progress_label: (n, total) => `${n} de ${total} tareas completadas`,
    link_invalid: 'Este enlace no es válido.',
    link_expired: 'Este enlace ha expirado. Contacte a su administrador.',
    task_locked: 'Complete las tareas anteriores primero.',
    staff_check_label: 'Será verificado por el personal.',
    submit: 'Enviar',
    clear: 'Limpiar',
    all_complete_title: 'Listo.',
    all_complete_body: 'Gracias por completar sus tareas.',
    acknowledgment_default: 'Reconozco haber recibido este documento.',
    loading: 'Cargando...',
    submitting: 'Enviando...',
    upload_file: 'Subir Archivo',
    take_photo: 'Tomar Foto',
    select_file: 'Seleccionar Archivo',
    open_form: 'Abrir Formulario',
    signature_required: 'La firma es obligatoria.',
    file_required: 'Por favor seleccione un archivo.',
    completed: 'Completado',
    pending: 'Pendiente',
    tasks_title: 'Sus Tareas',
  },
  pt: {
    deadline_label: 'Concluir até',
    progress_label: (n, total) => `${n} de ${total} tarefas concluídas`,
    link_invalid: 'Este link não é válido.',
    link_expired: 'Este link expirou. Entre em contato com seu gerente.',
    task_locked: 'Conclua as tarefas anteriores primeiro.',
    staff_check_label: 'Será verificado pela equipe.',
    submit: 'Enviar',
    clear: 'Limpar',
    all_complete_title: 'Concluído.',
    all_complete_body: 'Obrigado por concluir suas tarefas.',
    acknowledgment_default: 'Reconheço o recebimento deste documento.',
    loading: 'Carregando...',
    submitting: 'Enviando...',
    upload_file: 'Carregar Arquivo',
    take_photo: 'Tirar Foto',
    select_file: 'Selecionar Arquivo',
    open_form: 'Abrir Formulário',
    signature_required: 'A assinatura é obrigatória.',
    file_required: 'Por favor selecione um arquivo.',
    completed: 'Concluído',
    pending: 'Pendente',
    tasks_title: 'Suas Tarefas',
  },
};
