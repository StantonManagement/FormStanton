/**
 * Scheduling Translations (EN/ES/PT)
 */

export type SchedulingLanguage = 'en' | 'es' | 'pt';

interface TranslationSet {
  // Page titles
  pageTitle: string;
  scheduleYourVisit: string;
  successTitle: string;

  // Language selection
  selectLanguage: string;
  continueInEnglish: string;
  continuarEnEspanol: string;
  continuarEmPortugues: string;

  // Scheduling interface
  selectDateTime: string;
  availableSlots: string;
  noSlotsAvailable: string;
  noSlotsThisWeek: string;
  tryNextWeek: string;
  previousWeek: string;
  nextWeek: string;
  select: string;

  // Confirmation
  confirmAppointment: string;
  appointmentDetails: string;
  date: string;
  time: string;
  location: string;
  withStaff: string;
  purpose: string;
  whatToBring: string;
  documentsToSign: string;
  unitInspectionInfo: string;
  confirmButton: string;
  cancelButton: string;
  backToSlots: string;

  // Success page
  appointmentConfirmed: string;
  confirmationDetails: string;
  icsDownload: string;
  addToCalendar: string;
  googleCalendar: string;
  outlookCalendar: string;
  anotherAppointment: string;
  closeWindow: string;

  // Errors
  errorLoadingSlots: string;
  errorBooking: string;
  slotNoLongerAvailable: string;
  invalidToken: string;
  expiredToken: string;

  // Purposes
  purposeSignDocuments: string;
  purposeInspection: string;
  purposeIntake: string;
  purposeDropoff: string;
  purposeOther: string;

  // Misc
  stantonAddress: string;
  secureTransmission: string;
  poweredBy: string;
}

const translations: Record<SchedulingLanguage, TranslationSet> = {
  en: {
    pageTitle: 'Schedule Your Visit',
    scheduleYourVisit: 'Schedule your visit to Stanton Management',
    successTitle: 'Appointment Confirmed',

    selectLanguage: 'Please select your language to continue:',
    continueInEnglish: 'Continue in English',
    continuarEnEspanol: 'Continuar en Español',
    continuarEmPortugues: 'Continuar em Português',

    selectDateTime: 'Select a date and time',
    availableSlots: 'Available slots',
    noSlotsAvailable: 'No slots available',
    noSlotsThisWeek: 'No slots available this week',
    tryNextWeek: 'Try next week',
    previousWeek: '← Previous',
    nextWeek: 'Next →',
    select: 'Select',

    confirmAppointment: 'Confirm your appointment',
    appointmentDetails: 'Appointment Details',
    date: 'Date',
    time: 'Time',
    location: 'Location',
    withStaff: 'With',
    purpose: 'Purpose',
    whatToBring: 'What to bring',
    documentsToSign: 'Please bring valid identification and any documents mentioned in your application.',
    unitInspectionInfo: 'A staff member will inspect your unit during this appointment.',
    confirmButton: 'Confirm Appointment',
    cancelButton: 'Cancel',
    backToSlots: '← Back to available slots',

    appointmentConfirmed: 'Your appointment is confirmed',
    confirmationDetails: 'We look forward to seeing you.',
    icsDownload: 'Download calendar invite (.ics)',
    addToCalendar: 'Add to your calendar',
    googleCalendar: 'Google Calendar',
    outlookCalendar: 'Outlook',
    anotherAppointment: 'Schedule another appointment',
    closeWindow: 'Close',

    errorLoadingSlots: 'Unable to load available slots. Please try again.',
    errorBooking: 'Unable to book appointment. Please try again.',
    slotNoLongerAvailable: 'This slot is no longer available. Please select another time.',
    invalidToken: 'Invalid or expired link. Please request a new scheduling link.',
    expiredToken: 'This scheduling link has expired.',

    purposeSignDocuments: 'Document Signing',
    purposeInspection: 'Unit Inspection',
    purposeIntake: 'Application Assistance',
    purposeDropoff: 'Document Drop-off',
    purposeOther: 'Office Visit',

    stantonAddress: '421 Park Street, Hartford CT 06106',
    secureTransmission: 'Your information is transmitted securely',
    poweredBy: 'Stanton Management LLC',
  },

  es: {
    pageTitle: 'Programe su Visita',
    scheduleYourVisit: 'Programe su visita a Stanton Management',
    successTitle: 'Cita Confirmada',

    selectLanguage: 'Por favor seleccione su idioma para continuar:',
    continueInEnglish: 'Continue in English',
    continuarEnEspanol: 'Continuar en Español',
    continuarEmPortugues: 'Continuar em Português',

    selectDateTime: 'Seleccione fecha y hora',
    availableSlots: 'Horarios disponibles',
    noSlotsAvailable: 'No hay horarios disponibles',
    noSlotsThisWeek: 'No hay horarios disponibles esta semana',
    tryNextWeek: 'Pruebe la próxima semana',
    previousWeek: '← Anterior',
    nextWeek: 'Siguiente →',
    select: 'Seleccionar',

    confirmAppointment: 'Confirme su cita',
    appointmentDetails: 'Detalles de la Cita',
    date: 'Fecha',
    time: 'Hora',
    location: 'Ubicación',
    withStaff: 'Con',
    purpose: 'Propósito',
    whatToBring: 'Qué traer',
    documentsToSign: 'Por favor traiga identificación válida y cualquier documento mencionado en su solicitud.',
    unitInspectionInfo: 'Un miembro del personal inspeccionará su unidad durante esta cita.',
    confirmButton: 'Confirmar Cita',
    cancelButton: 'Cancelar',
    backToSlots: '← Volver a horarios disponibles',

    appointmentConfirmed: 'Su cita está confirmada',
    confirmationDetails: 'Esperamos verle.',
    icsDownload: 'Descargar invitación de calendario (.ics)',
    addToCalendar: 'Agregar a su calendario',
    googleCalendar: 'Google Calendar',
    outlookCalendar: 'Outlook',
    anotherAppointment: 'Programar otra cita',
    closeWindow: 'Cerrar',

    errorLoadingSlots: 'No se pueden cargar los horarios disponibles. Por favor intente de nuevo.',
    errorBooking: 'No se pudo reservar la cita. Por favor intente de nuevo.',
    slotNoLongerAvailable: 'Este horario ya no está disponible. Por favor seleccione otro.',
    invalidToken: 'Enlace inválido o expirado. Por favor solicite un nuevo enlace.',
    expiredToken: 'Este enlace de programación ha expirado.',

    purposeSignDocuments: 'Firma de Documentos',
    purposeInspection: 'Inspección de Unidad',
    purposeIntake: 'Asistencia con Solicitud',
    purposeDropoff: 'Entrega de Documentos',
    purposeOther: 'Visita de Oficina',

    stantonAddress: '421 Park Street, Hartford CT 06106',
    secureTransmission: 'Su información se transmite de forma segura',
    poweredBy: 'Stanton Management LLC',
  },

  pt: {
    pageTitle: 'Agende sua Visita',
    scheduleYourVisit: 'Agende sua visita à Stanton Management',
    successTitle: 'Compromisso Confirmado',

    selectLanguage: 'Por favor selecione seu idioma para continuar:',
    continueInEnglish: 'Continue in English',
    continuarEnEspanol: 'Continuar en Español',
    continuarEmPortugues: 'Continuar em Português',

    selectDateTime: 'Selecione data e hora',
    availableSlots: 'Horários disponíveis',
    noSlotsAvailable: 'Nenhum horário disponível',
    noSlotsThisWeek: 'Nenhum horário disponível esta semana',
    tryNextWeek: 'Tente a próxima semana',
    previousWeek: '← Anterior',
    nextWeek: 'Próximo →',
    select: 'Selecionar',

    confirmAppointment: 'Confirme seu compromisso',
    appointmentDetails: 'Detalhes do Compromisso',
    date: 'Data',
    time: 'Hora',
    location: 'Local',
    withStaff: 'Com',
    purpose: 'Propósito',
    whatToBring: 'O que trazer',
    documentsToSign: 'Por favor traga identificação válida e quaisquer documentos mencionados em sua inscrição.',
    unitInspectionInfo: 'Um membro da equipe inspecionará sua unidade durante este compromisso.',
    confirmButton: 'Confirmar Compromisso',
    cancelButton: 'Cancelar',
    backToSlots: '← Voltar aos horários disponíveis',

    appointmentConfirmed: 'Seu compromisso está confirmado',
    confirmationDetails: 'Aguardamos a sua visita.',
    icsDownload: 'Baixar convite de calendário (.ics)',
    addToCalendar: 'Adicionar ao seu calendário',
    googleCalendar: 'Google Calendar',
    outlookCalendar: 'Outlook',
    anotherAppointment: 'Agendar outro compromisso',
    closeWindow: 'Fechar',

    errorLoadingSlots: 'Não foi possível carregar os horários disponíveis. Por favor tente novamente.',
    errorBooking: 'Não foi possível agendar o compromisso. Por favor tente novamente.',
    slotNoLongerAvailable: 'Este horário não está mais disponível. Por favor selecione outro.',
    invalidToken: 'Link inválido ou expirado. Por favor solicite um novo link.',
    expiredToken: 'Este link de agendamento expirou.',

    purposeSignDocuments: 'Assinatura de Documentos',
    purposeInspection: 'Inspeção da Unidade',
    purposeIntake: 'Assistência com Inscrição',
    purposeDropoff: 'Entrega de Documentos',
    purposeOther: 'Visita ao Escritório',

    stantonAddress: '421 Park Street, Hartford CT 06106',
    secureTransmission: 'Suas informações são transmitidas com segurança',
    poweredBy: 'Stanton Management LLC',
  },
};

export function getSchedulingTranslations(lang: SchedulingLanguage): TranslationSet {
  return translations[lang] || translations.en;
}

export function mapPreferredLanguage(lang: string | null): SchedulingLanguage {
  if (!lang) return 'en';
  
  const normalized = lang.toLowerCase().trim();
  
  if (normalized.startsWith('es') || normalized === 'spanish' || normalized === 'español') {
    return 'es';
  }
  if (normalized.startsWith('pt') || normalized === 'portuguese' || normalized === 'português') {
    return 'pt';
  }
  
  return 'en';
}
