import { Language } from './translations';

export const apartmentInquiryTranslations: Record<Language, Record<string, string>> = {
  en: {
    formTitle: 'Apartment Inquiry',
    formIntro: 'Interested in renting with Stanton Management? Fill out this quick form and we will be in touch.',

    // Contact
    fullName: 'Full Name',
    fullNamePlaceholder: 'Enter your full name',
    phone: 'Phone Number',
    phonePlaceholder: '(860) 555-0123',
    phoneValidationError: 'Please enter a valid 10-digit phone number',
    email: 'Email Address',
    emailPlaceholder: 'your.email@example.com',
    emailValidationError: 'Please enter a valid email address',

    // Housing Needs
    housingNeedsTitle: 'What Are You Looking For?',
    bedrooms: 'Bedrooms Needed',
    bedroomsPlaceholder: '-- Select --',
    bedroomsStudio: 'Studio',
    bedrooms1: '1 Bedroom',
    bedrooms2: '2 Bedrooms',
    bedrooms3: '3 Bedrooms',
    bedroomsNotSure: 'Not Sure',

    moveInTimeframe: 'Move-In Timeframe',
    moveInPlaceholder: '-- Select --',
    moveInASAP: 'ASAP',
    moveIn1to2: '1-2 Months',
    moveIn3to6: '3-6 Months',
    moveInJustLooking: 'Just Looking',

    voucher: 'Do you have a housing voucher (Section 8)?',
    voucherYes: 'Yes',
    voucherNo: 'No',
    voucherNotSure: 'Not Sure',

    // Areas
    areasTitle: 'Areas of Interest',
    areasDescription: 'Select any neighborhoods you are interested in:',
    areaParkSt: 'Park St',
    areaMapleAve: 'Maple Ave',
    areaSeymourAffleck: 'Seymour / Affleck',
    areaFranklinAve: 'Franklin Ave',
    areaMainSt: 'Main St',
    areaBroadSt: 'Broad St',
    areaOther: 'Other / No Preference',

    // Referral
    referralSource: 'How Did You Hear About Us?',
    referralPlaceholder: '-- Select --',
    referralFlyer: 'Flyer / Banner',
    referralReferral: 'Referral',
    referralTruck: 'Truck',
    referralWalkBy: 'Walk-by',
    referralOnline: 'Online',
    referralOther: 'Other',

    // Comments
    comments: 'Additional Comments',
    commentsPlaceholder: 'Anything else you would like us to know?',

    // Actions
    submit: 'Submit Inquiry',
    submitting: 'Submitting...',
    required: 'Required',
    optional: '(Optional)',

    // Success
    successTitle: 'Inquiry Received',
    successMessage: 'Thank you for your interest. A member of our team will be in touch shortly.',
  },

  es: {
    formTitle: 'Consulta de Apartamento',
    formIntro: 'Interesado en alquilar con Stanton Management? Complete este formulario rapido y nos pondremos en contacto.',

    fullName: 'Nombre Completo',
    fullNamePlaceholder: 'Ingrese su nombre completo',
    phone: 'Numero de Telefono',
    phonePlaceholder: '(860) 555-0123',
    phoneValidationError: 'Ingrese un numero de telefono valido de 10 digitos',
    email: 'Correo Electronico',
    emailPlaceholder: 'su.correo@ejemplo.com',
    emailValidationError: 'Ingrese un correo electronico valido',

    housingNeedsTitle: 'Que Esta Buscando?',
    bedrooms: 'Habitaciones Necesarias',
    bedroomsPlaceholder: '-- Seleccionar --',
    bedroomsStudio: 'Estudio',
    bedrooms1: '1 Habitacion',
    bedrooms2: '2 Habitaciones',
    bedrooms3: '3 Habitaciones',
    bedroomsNotSure: 'No Estoy Seguro',

    moveInTimeframe: 'Fecha de Mudanza',
    moveInPlaceholder: '-- Seleccionar --',
    moveInASAP: 'Lo Antes Posible',
    moveIn1to2: '1-2 Meses',
    moveIn3to6: '3-6 Meses',
    moveInJustLooking: 'Solo Buscando',

    voucher: 'Tiene un vale de vivienda (Seccion 8)?',
    voucherYes: 'Si',
    voucherNo: 'No',
    voucherNotSure: 'No Estoy Seguro',

    areasTitle: 'Areas de Interes',
    areasDescription: 'Seleccione los vecindarios que le interesan:',
    areaParkSt: 'Park St',
    areaMapleAve: 'Maple Ave',
    areaSeymourAffleck: 'Seymour / Affleck',
    areaFranklinAve: 'Franklin Ave',
    areaMainSt: 'Main St',
    areaBroadSt: 'Broad St',
    areaOther: 'Otro / Sin Preferencia',

    referralSource: 'Como Se Entero de Nosotros?',
    referralPlaceholder: '-- Seleccionar --',
    referralFlyer: 'Volante / Cartel',
    referralReferral: 'Referencia',
    referralTruck: 'Camion',
    referralWalkBy: 'Pasando por ahi',
    referralOnline: 'Internet',
    referralOther: 'Otro',

    comments: 'Comentarios Adicionales',
    commentsPlaceholder: 'Algo mas que le gustaria que sepamos?',

    submit: 'Enviar Consulta',
    submitting: 'Enviando...',
    required: 'Requerido',
    optional: '(Opcional)',

    successTitle: 'Consulta Recibida',
    successMessage: 'Gracias por su interes. Un miembro de nuestro equipo se comunicara con usted pronto.',
  },

  pt: {
    formTitle: 'Consulta de Apartamento',
    formIntro: 'Interessado em alugar com a Stanton Management? Preencha este formulario rapido e entraremos em contato.',

    fullName: 'Nome Completo',
    fullNamePlaceholder: 'Digite seu nome completo',
    phone: 'Numero de Telefone',
    phonePlaceholder: '(860) 555-0123',
    phoneValidationError: 'Digite um numero de telefone valido de 10 digitos',
    email: 'Endereco de Email',
    emailPlaceholder: 'seu.email@exemplo.com',
    emailValidationError: 'Digite um endereco de email valido',

    housingNeedsTitle: 'O Que Voce Esta Procurando?',
    bedrooms: 'Quartos Necessarios',
    bedroomsPlaceholder: '-- Selecionar --',
    bedroomsStudio: 'Estudio',
    bedrooms1: '1 Quarto',
    bedrooms2: '2 Quartos',
    bedrooms3: '3 Quartos',
    bedroomsNotSure: 'Nao Tenho Certeza',

    moveInTimeframe: 'Prazo de Mudanca',
    moveInPlaceholder: '-- Selecionar --',
    moveInASAP: 'O Mais Rapido Possivel',
    moveIn1to2: '1-2 Meses',
    moveIn3to6: '3-6 Meses',
    moveInJustLooking: 'Apenas Pesquisando',

    voucher: 'Voce tem um vale de moradia (Secao 8)?',
    voucherYes: 'Sim',
    voucherNo: 'Nao',
    voucherNotSure: 'Nao Tenho Certeza',

    areasTitle: 'Areas de Interesse',
    areasDescription: 'Selecione os bairros que lhe interessam:',
    areaParkSt: 'Park St',
    areaMapleAve: 'Maple Ave',
    areaSeymourAffleck: 'Seymour / Affleck',
    areaFranklinAve: 'Franklin Ave',
    areaMainSt: 'Main St',
    areaBroadSt: 'Broad St',
    areaOther: 'Outro / Sem Preferencia',

    referralSource: 'Como Soube de Nos?',
    referralPlaceholder: '-- Selecionar --',
    referralFlyer: 'Folheto / Faixa',
    referralReferral: 'Indicacao',
    referralTruck: 'Caminhao',
    referralWalkBy: 'Passando pela rua',
    referralOnline: 'Internet',
    referralOther: 'Outro',

    comments: 'Comentarios Adicionais',
    commentsPlaceholder: 'Algo mais que gostaria que soubessemos?',

    submit: 'Enviar Consulta',
    submitting: 'Enviando...',
    required: 'Obrigatorio',
    optional: '(Opcional)',

    successTitle: 'Consulta Recebida',
    successMessage: 'Obrigado pelo seu interesse. Um membro da nossa equipe entrara em contato em breve.',
  },
};
