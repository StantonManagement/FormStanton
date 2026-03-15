import { Language } from './translations';

export const petFeeExemptionTranslations = {
  en: {
    // Form metadata
    formTitle: 'Pet Fee Exemption Request',
    formIntro: 'Request an exemption from pet fees for qualified reasons. Service animals and emotional support animals may be exempt from certain pet fees with proper documentation.',
    
    // Tabs
    tabTenantInfo: 'Tenant Information',
    tabExemptionDetails: 'Exemption Details',
    tabDocuments: 'Documents',
    tabReview: 'Review & Submit',
    
    // Section 1: Tenant Info
    tenantInfoTitle: 'Tenant Information',
    tenantName: 'Full Name',
    tenantNamePlaceholder: 'Enter your full legal name',
    phone: 'Phone Number',
    phonePlaceholder: '(555) 123-4567',
    phoneValidationError: 'Please enter a valid 10-digit phone number',
    email: 'Email Address',
    emailPlaceholder: 'your.email@example.com',
    emailValidationError: 'Please enter a valid email address',
    building: 'Building Address',
    selectBuilding: 'Select your building',
    unit: 'Unit Number',
    selectUnit: 'Select your unit',
    enterUnit: 'Enter your unit number',
    dateSubmitted: 'Date Submitted',
    
    // Section 2: Exemption Details
    exemptionDetailsTitle: 'Exemption Details',
    exemptionReason: 'Exemption Reason',
    exemptionReasonPlaceholder: 'Select the reason for your exemption request',
    exemptionReasonRequired: 'Please select an exemption reason',
    reasonExplanation: 'Explanation',
    reasonExplanationPlaceholder: 'Please provide additional details about your exemption request',
    petDescription: 'Pet Description',
    petDescriptionPlaceholder: 'Describe the animal(s) for which you are requesting exemption',
    
    // Exemption Reasons
    reasonEmotionalSupport: 'Emotional Support Animal (ESA)',
    reasonServiceAnimal: 'Service Animal (ADA)',
    reasonMedicalNecessity: 'Medical Necessity',
    reasonOther: 'Other',
    
    // Reason Descriptions
    esaDescription: 'Animal prescribed by a licensed mental health professional to provide therapeutic support',
    serviceDescription: 'Animal trained to perform tasks for a person with a disability under the Americans with Disabilities Act',
    medicalDescription: 'Animal required for medical treatment or health reasons with documentation from a healthcare provider',
    otherDescription: 'Another valid reason for exemption (please explain)',
    
    // Section 3: Documents
    documentsTitle: 'Supporting Documents',
    documentsIntro: 'Please upload all relevant documentation to support your exemption request. Accepted file types: PDF, JPG, PNG. Maximum file size: 10MB per file.',
    uploadDocuments: 'Upload Documents',
    uploadHelper: 'Click to upload or drag and drop',
    maxFilesReached: 'Maximum 5 files allowed',
    fileTooLarge: 'File size exceeds 10MB limit',
    invalidFileType: 'Only PDF, JPG, and PNG files are allowed',
    
    // Required Documents by Type
    esaDocuments: 'ESA Letter from licensed mental health professional (dated within last year)',
    serviceDocuments: 'Service animal certification or training documentation',
    medicalDocuments: 'Letter from healthcare provider explaining medical necessity',
    otherDocuments: 'Any relevant documentation supporting your exemption request',
    
    // Section 4: Review
    reviewTitle: 'Review and Submit',
    reviewSummary: 'Please review your information before submitting.',
    reviewTenantInfo: 'Tenant Information',
    reviewExemptionDetails: 'Exemption Details',
    reviewDocuments: 'Documents',
    
    // Terms
    termsTitle: 'Declaration',
    termsIntro: 'By submitting this form, you certify that:',
    term1: 'All provided information is true and accurate',
    term2: 'The uploaded documents are authentic and unaltered',
    term3: 'You understand that fraudulent claims may result in lease violations',
    term4: 'You will provide additional documentation if requested',
    term5: 'Management reserves the right to verify all information provided',
    
    // Signature
    signature: 'Signature',
    signatureDate: 'Date',
    finalConfirm: 'I certify that the above information is true and correct',
    
    // Buttons
    continue: 'Continue',
    submit: 'Submit Request',
    submitting: 'Submitting...',
    addFile: 'Add File',
    removeFile: 'Remove',
    
    // Success
    successTitle: 'Exemption Request Submitted',
    successMessage: 'Your pet fee exemption request has been submitted successfully. You will be notified of the decision within 5-7 business days.',
    
    // Error messages
    requiredFieldsMissing: 'This field is required',
    submissionFailed: 'Submission failed. Please try again.',
    
    // Status messages
    statusPending: 'Pending Review',
    statusApproved: 'Approved',
    statusDenied: 'Denied',
    statusMoreInfo: 'More Info Needed',
  },
  
  es: {
    // Form metadata
    formTitle: 'Solicitud de Exención de Tarifa de Mascota',
    formIntro: 'Solicite una exención de las tarifas de mascotas por razones calificadas. Los animales de servicio y los animales de apoyo emocional pueden estar exentos de ciertas tarifas de mascotas con la documentación adecuada.',
    
    // Tabs
    tabTenantInfo: 'Información del Inquilino',
    tabExemptionDetails: 'Detalles de Exención',
    tabDocuments: 'Documentos',
    tabReview: 'Revisar y Enviar',
    
    // Section 1: Tenant Info
    tenantInfoTitle: 'Información del Inquilino',
    tenantName: 'Nombre Completo',
    tenantNamePlaceholder: 'Ingrese su nombre legal completo',
    phone: 'Número de Teléfono',
    phonePlaceholder: '(555) 123-4567',
    phoneValidationError: 'Por favor ingrese un número de teléfono válido de 10 dígitos',
    email: 'Correo Electrónico',
    emailPlaceholder: 'su.correo@ejemplo.com',
    emailValidationError: 'Por favor ingrese una dirección de correo válida',
    building: 'Dirección del Edificio',
    selectBuilding: 'Seleccione su edificio',
    unit: 'Número de Apartamento',
    selectUnit: 'Seleccione su apartamento',
    enterUnit: 'Ingrese su número de apartamento',
    dateSubmitted: 'Fecha de Envío',
    
    // Section 2: Exemption Details
    exemptionDetailsTitle: 'Detalles de Exención',
    exemptionReason: 'Razón de Exención',
    exemptionReasonPlaceholder: 'Seleccione la razón para su solicitud de exención',
    exemptionReasonRequired: 'Por favor seleccione una razón de exención',
    reasonExplanation: 'Explicación',
    reasonExplanationPlaceholder: 'Por favor proporcione detalles adicionales sobre su solicitud de exención',
    petDescription: 'Descripción de Mascota',
    petDescriptionPlaceholder: 'Describa el/los animal(es) para los cuales solicita exención',
    
    // Exemption Reasons
    reasonEmotionalSupport: 'Animal de Apoyo Emocional (ESAE)',
    reasonServiceAnimal: 'Animal de Servicio (ADA)',
    reasonMedicalNecessity: 'Necesidad Médica',
    reasonOther: 'Otro',
    
    // Reason Descriptions
    esaDescription: 'Animal recetado por un profesional de salud mental licenciado para proporcionar apoyo terapéutico',
    serviceDescription: 'Animal entrenado para realizar tareas para una persona con discapacidad bajo la Ley de Estadounidenses con Discapacidades',
    medicalDescription: 'Animal requerido por razones médicas o de tratamiento con documentación de un proveedor de atención médica',
    otherDescription: 'Otra razón válida para exención (por favor explique)',
    
    // Section 3: Documents
    documentsTitle: 'Documentos de Apoyo',
    documentsIntro: 'Por favor suba toda la documentación relevante para respaldar su solicitud de exención. Tipos de archivo aceptados: PDF, JPG, PNG. Tamaño máximo: 10MB por archivo.',
    uploadDocuments: 'Subir Documentos',
    uploadHelper: 'Haga clic para subir o arrastre y suelte',
    maxFilesReached: 'Máximo 5 archivos permitidos',
    fileTooLarge: 'El tamaño del archivo excede el límite de 10MB',
    invalidFileType: 'Solo se permiten archivos PDF, JPG y PNG',
    
    // Required Documents by Type
    esaDocuments: 'Carta ESA de profesional de salud mental licenciado (fechada dentro del último año)',
    serviceDocuments: 'Certificación de animal de servicio o documentación de entrenamiento',
    medicalDocuments: 'Carta de proveedor de atención médica explicando la necesidad médica',
    otherDocuments: 'Cualquier documentación relevante que respalde su solicitud de exención',
    
    // Section 4: Review
    reviewTitle: 'Revisar y Enviar',
    reviewSummary: 'Por favor revise su información antes de enviar.',
    reviewTenantInfo: 'Información del Inquilino',
    reviewExemptionDetails: 'Detalles de Exención',
    reviewDocuments: 'Documentos',
    
    // Terms
    termsTitle: 'Declaración',
    termsIntro: 'Al enviar este formulario, usted certifica que:',
    term1: 'Toda la información proporcionada es verdadera y precisa',
    term2: 'Los documentos subidos son auténticos y sin alterar',
    term3: 'Usted entiende que las reclamaciones fraudulentas pueden resultar en violaciones del contrato de arrendamiento',
    term4: 'Usted proporcionará documentación adicional si se solicita',
    term5: 'La administración se reserva el derecho de verificar toda la información proporcionada',
    
    // Signature
    signature: 'Firma',
    signatureDate: 'Fecha',
    finalConfirm: 'Certifico que la información anterior es verdadera y correcta',
    
    // Buttons
    continue: 'Continuar',
    submit: 'Enviar Solicitud',
    submitting: 'Enviando...',
    addFile: 'Agregar Archivo',
    removeFile: 'Remover',
    
    // Success
    successTitle: 'Solicitud de Exención Enviada',
    successMessage: 'Su solicitud de exención de tarifa de mascota ha sido enviada exitosamente. Se le notificará de la decisión dentro de 5-7 días hábiles.',
    
    // Error messages
    requiredFieldsMissing: 'Este campo es requerido',
    submissionFailed: 'Envío fallido. Por favor intente nuevamente.',
    
    // Status messages
    statusPending: 'Pendiente de Revisión',
    statusApproved: 'Aprobado',
    statusDenied: 'Denegado',
    statusMoreInfo: 'Se Necesita Más Información',
  },
  
  pt: {
    // Form metadata
    formTitle: 'Solicitação de Isenção de Taxa de Mascote',
    formIntro: 'Solicite uma isenção das taxas de mascote por motivos qualificados. Animais de serviço e animais de apoio emocional podem estar isentos de certas taxas de mascote com documentação adequada.',
    
    // Tabs
    tabTenantInfo: 'Informações do Inquilino',
    tabExemptionDetails: 'Detalhes da Isenção',
    tabDocuments: 'Documentos',
    tabReview: 'Revisar e Enviar',
    
    // Section 1: Tenant Info
    tenantInfoTitle: 'Informações do Inquilino',
    tenantName: 'Nome Completo',
    tenantNamePlaceholder: 'Digite seu nome legal completo',
    phone: 'Número de Telefone',
    phonePlaceholder: '(555) 123-4567',
    phoneValidationError: 'Por favor digite um número de telefone válido de 10 dígitos',
    email: 'Endereço de Email',
    emailPlaceholder: 'seu.email@exemplo.com',
    emailValidationError: 'Por favor digite um endereço de email válido',
    building: 'Endereço do Edifício',
    selectBuilding: 'Selecione seu edifício',
    unit: 'Número do Apartamento',
    selectUnit: 'Selecione seu apartamento',
    enterUnit: 'Digite seu número de apartamento',
    dateSubmitted: 'Data de Envio',
    
    // Section 2: Exemption Details
    exemptionDetailsTitle: 'Detalhes da Isenção',
    exemptionReason: 'Motivo da Isenção',
    exemptionReasonPlaceholder: 'Selecione o motivo para sua solicitação de isenção',
    exemptionReasonRequired: 'Por favor selecione um motivo de isenção',
    reasonExplanation: 'Explicação',
    reasonExplanationPlaceholder: 'Por favor forneça detalhes adicionais sobre sua solicitação de isenção',
    petDescription: 'Descrição do Mascote',
    petDescriptionPlaceholder: 'Descreva o(s) animal(is) para o(s) qual(is) você está solicitando isenção',
    
    // Exemption Reasons
    reasonEmotionalSupport: 'Animal de Apoio Emocional (AAE)',
    reasonServiceAnimal: 'Animal de Serviço (ADA)',
    reasonMedicalNecessity: 'Necessidade Médica',
    reasonOther: 'Outro',
    
    // Reason Descriptions
    esaDescription: 'Animal prescrito por profissional de saúde mental licenciado para fornecer apoio terapêutico',
    serviceDescription: 'Animal treinado para realizar tarefas para pessoa com deficiência sob a Lei dos Americanos com Deficiências',
    medicalDescription: 'Animal necessário por razões médicas ou de tratamento com documentação de profissional de saúde',
    otherDescription: 'Outro motivo válido para isenção (por favor explique)',
    
    // Section 3: Documents
    documentsTitle: 'Documentos de Apoio',
    documentsIntro: 'Por favor envie toda a documentação relevante para apoiar sua solicitação de isenção. Tipos de arquivo aceitos: PDF, JPG, PNG. Tamanho máximo: 10MB por arquivo.',
    uploadDocuments: 'Enviar Documentos',
    uploadHelper: 'Clique para enviar ou arraste e solte',
    maxFilesReached: 'Máximo de 5 arquivos permitidos',
    fileTooLarge: 'O tamanho do arquivo excede o limite de 10MB',
    invalidFileType: 'Apenas arquivos PDF, JPG e PNG são permitidos',
    
    // Required Documents by Type
    esaDocuments: 'Carta AAE de profissional de saúde mental licenciado (datada dentro do último ano)',
    serviceDocuments: 'Certificação de animal de serviço ou documentação de treinamento',
    medicalDocuments: 'Carta de profissional de saúde explicando necessidade médica',
    otherDocuments: 'Qualquer documentação relevante apoiando sua solicitação de isenção',
    
    // Section 4: Review
    reviewTitle: 'Revisar e Enviar',
    reviewSummary: 'Por favor revise suas informações antes de enviar.',
    reviewTenantInfo: 'Informações do Inquilino',
    reviewExemptionDetails: 'Detalhes da Isenção',
    reviewDocuments: 'Documentos',
    
    // Terms
    termsTitle: 'Declaração',
    termsIntro: 'Ao enviar este formulário, você certifica que:',
    term1: 'Todas as informações fornecidas são verdadeiras e precisas',
    term2: 'Os documentos enviados são autênticos e inalterados',
    term3: 'Você entende que reivindicações fraudulentas podem resultar em violações de contrato',
    term4: 'Você fornecerá documentação adicional se solicitado',
    term5: 'A administração reserva o direito de verificar todas as informações fornecidas',
    
    // Signature
    signature: 'Assinatura',
    signatureDate: 'Data',
    finalConfirm: 'Certifico que as informações acima são verdadeiras e corretas',
    
    // Buttons
    continue: 'Continuar',
    submit: 'Enviar Solicitação',
    submitting: 'Enviando...',
    addFile: 'Adicionar Arquivo',
    removeFile: 'Remover',
    
    // Success
    successTitle: 'Solicitação de Isenção Enviada',
    successMessage: 'Sua solicitação de isenção de taxa de mascote foi enviada com sucesso. Você será notificado da decisão dentro de 5-7 dias úteis.',
    
    // Error messages
    requiredFieldsMissing: 'Este campo é obrigatório',
    submissionFailed: 'Envio falhou. Por favor tente novamente.',
    
    // Status messages
    statusPending: 'Aguardando Revisão',
    statusApproved: 'Aprovado',
    statusDenied: 'Negado',
    statusMoreInfo: 'Mais Informações Necessárias',
  },
} as const satisfies Record<Language, Record<string, string>>;
