import { Language } from './translations';

export const smokeDetectorTranslations: Record<Language, Record<string, string>> = {
  en: {
    formTitle: 'Smoke & CO Detector Acknowledgment',
    formIntro: 'Please confirm the presence and working condition of all smoke and carbon monoxide detectors in your unit. This is required by Massachusetts state law.',
    
    tenantInfoTitle: 'Tenant Information',
    tenantName: 'Tenant Name',
    tenantNamePlaceholder: 'Enter your full name',
    building: 'Building Address',
    unit: 'Unit Number',
    phone: 'Contact Phone',
    phonePlaceholder: '(860) 555-0123',
    phoneValidationError: 'Please enter a valid 10-digit phone number',
    dateSubmitted: 'Date',
    
    detectorInfoTitle: 'Detector Information',
    detectorInfoIntro: 'Please count all smoke detectors and carbon monoxide (CO) detectors in your unit.',
    detectorInfoNote: 'Massachusetts law requires at least one smoke detector on each level and outside each sleeping area, plus CO detectors on each level.',
    bedroomCount: 'Number of Bedrooms',
    smokeDetectorCount: 'Number of Smoke Detectors',
    coDetectorCount: 'Number of CO Detectors',
    selectCount: '-- Select count --',
    
    confirmationsTitle: 'Required Confirmations',
    allWorking: 'I confirm that all smoke and CO detectors are present and working properly',
    testedAll: 'I have tested all detectors using the test button',
    mustConfirmWorking: 'You must confirm all detectors are working',
    mustConfirmTested: 'You must confirm you have tested all detectors',
    importantNote: 'IMPORTANT: If any detector is missing, damaged, or not working, please submit a maintenance request immediately. Do not remove batteries from detectors.',
    
    photosTitle: 'Photos (Optional)',
    photosIntro: 'You may optionally upload photos showing the locations of your smoke and CO detectors.',
    uploadPhotos: 'Upload Detector Photos',
    uploadHelper: 'JPG, PNG up to 5MB - Max 5 photos',
    
    reviewTitle: 'Review & Sign',
    reviewSummary: 'Please review your information and sign to acknowledge.',
    reviewTenantInfo: 'Tenant Information',
    reviewDetectors: 'Detector Information',
    reviewPhotos: 'Photos',
    
    acknowledgmentTitle: 'Tenant Acknowledgment',
    knowsLocations: 'I know the location of all smoke and CO detectors in my unit',
    understandsResponsibility: 'I understand it is my responsibility to test detectors monthly and report any issues immediately',
    
    signature: 'Tenant Signature',
    signatureDate: 'Date',
    finalConfirm: 'I certify that the information provided is accurate and complete.',
    
    continue: 'Continue',
    submit: 'Submit Acknowledgment',
    submitting: 'Submitting...',
    requiredFieldsMissing: 'Please complete all required fields',
    
    successTitle: 'Acknowledgment Submitted!',
    successMessage: 'Your smoke and CO detector acknowledgment has been submitted successfully. Thank you for helping us maintain a safe living environment.',
    
    tabTenantInfo: 'Tenant Info',
    tabDetectorInfo: 'Detectors',
    tabPhotos: 'Photos',
    tabReview: 'Review & Sign',
    
    selectBuilding: '-- Select your building --',
    selectUnit: '-- Select your unit --',
    enterUnit: 'Enter your unit number',
  },
  es: {
    formTitle: 'Reconocimiento de Detectores de Humo y CO',
    formIntro: 'Confirme la presencia y el funcionamiento de todos los detectores de humo y monóxido de carbono en su unidad. Esto es requerido por la ley estatal de Massachusetts.',
    
    tenantInfoTitle: 'Información del Inquilino',
    tenantName: 'Nombre del Inquilino',
    tenantNamePlaceholder: 'Ingrese su nombre completo',
    building: 'Dirección del Edificio',
    unit: 'Número de Unidad',
    phone: 'Teléfono de Contacto',
    phonePlaceholder: '(860) 555-0123',
    phoneValidationError: 'Ingrese un número de teléfono válido de 10 dígitos',
    dateSubmitted: 'Fecha',
    
    detectorInfoTitle: 'Información de Detectores',
    detectorInfoIntro: 'Cuente todos los detectores de humo y monóxido de carbono (CO) en su unidad.',
    detectorInfoNote: 'La ley de Massachusetts requiere al menos un detector de humo en cada nivel y fuera de cada área de dormir, más detectores de CO en cada nivel.',
    bedroomCount: 'Número de Dormitorios',
    smokeDetectorCount: 'Número de Detectores de Humo',
    coDetectorCount: 'Número de Detectores de CO',
    selectCount: '-- Seleccione cantidad --',
    
    confirmationsTitle: 'Confirmaciones Requeridas',
    allWorking: 'Confirmo que todos los detectores de humo y CO están presentes y funcionan correctamente',
    testedAll: 'He probado todos los detectores usando el botón de prueba',
    mustConfirmWorking: 'Debe confirmar que todos los detectores funcionan',
    mustConfirmTested: 'Debe confirmar que ha probado todos los detectores',
    importantNote: 'IMPORTANTE: Si falta algún detector, está dañado o no funciona, envíe una solicitud de mantenimiento de inmediato. No retire las baterías de los detectores.',
    
    photosTitle: 'Fotos (Opcional)',
    photosIntro: 'Opcionalmente puede subir fotos mostrando las ubicaciones de sus detectores de humo y CO.',
    uploadPhotos: 'Subir Fotos de Detectores',
    uploadHelper: 'JPG, PNG hasta 5MB - Máximo 5 fotos',
    
    reviewTitle: 'Revisar y Firmar',
    reviewSummary: 'Revise su información y firme para reconocer.',
    reviewTenantInfo: 'Información del Inquilino',
    reviewDetectors: 'Información de Detectores',
    reviewPhotos: 'Fotos',
    
    acknowledgmentTitle: 'Reconocimiento del Inquilino',
    knowsLocations: 'Conozco la ubicación de todos los detectores de humo y CO en mi unidad',
    understandsResponsibility: 'Entiendo que es mi responsabilidad probar los detectores mensualmente y reportar cualquier problema de inmediato',
    
    signature: 'Firma del Inquilino',
    signatureDate: 'Fecha',
    finalConfirm: 'Certifico que la información proporcionada es precisa y completa.',
    
    continue: 'Continuar',
    submit: 'Enviar Reconocimiento',
    submitting: 'Enviando...',
    requiredFieldsMissing: 'Complete todos los campos requeridos',
    
    successTitle: '¡Reconocimiento Enviado!',
    successMessage: 'Su reconocimiento de detectores de humo y CO se ha enviado exitosamente. Gracias por ayudarnos a mantener un ambiente de vida seguro.',
    
    tabTenantInfo: 'Info del Inquilino',
    tabDetectorInfo: 'Detectores',
    tabPhotos: 'Fotos',
    tabReview: 'Revisar y Firmar',
    
    selectBuilding: '-- Seleccione su edificio --',
    selectUnit: '-- Seleccione su unidad --',
    enterUnit: 'Ingrese su número de unidad',
  },
  pt: {
    formTitle: 'Reconhecimento de Detectores de Fumaça e CO',
    formIntro: 'Confirme a presença e o funcionamento de todos os detectores de fumaça e monóxido de carbono em sua unidade. Isso é exigido pela lei estadual de Massachusetts.',
    
    tenantInfoTitle: 'Informações do Inquilino',
    tenantName: 'Nome do Inquilino',
    tenantNamePlaceholder: 'Digite seu nome completo',
    building: 'Endereço do Edifício',
    unit: 'Número da Unidade',
    phone: 'Telefone de Contato',
    phonePlaceholder: '(860) 555-0123',
    phoneValidationError: 'Digite um número de telefone válido de 10 dígitos',
    dateSubmitted: 'Data',
    
    detectorInfoTitle: 'Informações dos Detectores',
    detectorInfoIntro: 'Conte todos os detectores de fumaça e monóxido de carbono (CO) em sua unidade.',
    detectorInfoNote: 'A lei de Massachusetts exige pelo menos um detector de fumaça em cada nível e fora de cada área de dormir, mais detectores de CO em cada nível.',
    bedroomCount: 'Número de Quartos',
    smokeDetectorCount: 'Número de Detectores de Fumaça',
    coDetectorCount: 'Número de Detectores de CO',
    selectCount: '-- Selecione a quantidade --',
    
    confirmationsTitle: 'Confirmações Necessárias',
    allWorking: 'Confirmo que todos os detectores de fumaça e CO estão presentes e funcionando corretamente',
    testedAll: 'Testei todos os detectores usando o botão de teste',
    mustConfirmWorking: 'Você deve confirmar que todos os detectores funcionam',
    mustConfirmTested: 'Você deve confirmar que testou todos os detectores',
    importantNote: 'IMPORTANTE: Se algum detector estiver faltando, danificado ou não funcionando, envie uma solicitação de manutenção imediatamente. Não remova as baterias dos detectores.',
    
    photosTitle: 'Fotos (Opcional)',
    photosIntro: 'Você pode opcionalmente enviar fotos mostrando as localizações de seus detectores de fumaça e CO.',
    uploadPhotos: 'Enviar Fotos dos Detectores',
    uploadHelper: 'JPG, PNG até 5MB - Máximo 5 fotos',
    
    reviewTitle: 'Revisar e Assinar',
    reviewSummary: 'Revise suas informações e assine para reconhecer.',
    reviewTenantInfo: 'Informações do Inquilino',
    reviewDetectors: 'Informações dos Detectores',
    reviewPhotos: 'Fotos',
    
    acknowledgmentTitle: 'Reconhecimento do Inquilino',
    knowsLocations: 'Conheço a localização de todos os detectores de fumaça e CO em minha unidade',
    understandsResponsibility: 'Entendo que é minha responsabilidade testar os detectores mensalmente e relatar quaisquer problemas imediatamente',
    
    signature: 'Assinatura do Inquilino',
    signatureDate: 'Data',
    finalConfirm: 'Certifico que as informações fornecidas são precisas e completas.',
    
    continue: 'Continuar',
    submit: 'Enviar Reconhecimento',
    submitting: 'Enviando...',
    requiredFieldsMissing: 'Complete todos os campos obrigatórios',
    
    successTitle: 'Reconhecimento Enviado!',
    successMessage: 'Seu reconhecimento de detectores de fumaça e CO foi enviado com sucesso. Obrigado por nos ajudar a manter um ambiente de vida seguro.',
    
    tabTenantInfo: 'Info do Inquilino',
    tabDetectorInfo: 'Detectores',
    tabPhotos: 'Fotos',
    tabReview: 'Revisar e Assinar',
    
    selectBuilding: '-- Selecione seu edifício --',
    selectUnit: '-- Selecione sua unidade --',
    enterUnit: 'Digite o número da sua unidade',
  },
};
