import type { Language } from '@/lib/translations';

export interface RentalApplicationStrings {
  formTitle: string;
  formSubtitle: string;

  // Tabs
  tab1: string;
  tab2: string;
  tab3: string;

  // Section A - Personal
  sectionPersonal: string;
  fullName: string;
  fullNamePlaceholder: string;
  phone: string;
  phonePlaceholder: string;
  email: string;
  emailPlaceholder: string;
  dob: string;
  currentAddress: string;
  currentAddressPlaceholder: string;
  addressDuration: string;
  addressDurationPlaceholder: string;

  // Section C - Household
  sectionHousehold: string;
  householdSize: string;
  occupantsTitle: string;
  occupantName: string;
  occupantDob: string;
  occupantRelationship: string;
  addOccupant: string;
  removeOccupant: string;

  // Section B - Employment
  sectionIncome: string;
  incomeSource1: string;
  incomeSource2: string;
  employerName: string;
  employerPhone: string;
  jobTitle: string;
  howLong: string;
  proofAttached: string;
  yes: string;
  no: string;
  monthlyIncome: string;
  incomeUnder1500: string;
  income1500to2500: string;
  income2500to3500: string;
  income3500to5000: string;
  income5000to7500: string;
  income7500plus: string;

  // Section F - Needs
  sectionNeeds: string;
  bedroomsNeeded: string;
  studio: string;
  oneBed: string;
  twoBed: string;
  threeBed: string;
  fourBed: string;
  areasOfInterest: string;
  northEnd: string;
  southEnd: string;
  westEnd: string;
  parkStreet: string;
  noPreference: string;
  desiredMoveIn: string;

  // Section G - Payment
  sectionPayment: string;
  paymentType: string;
  marketRate: string;
  section8: string;

  // Section D - Pets
  sectionPets: string;
  hasPets: string;
  petType: string;
  petWeight: string;
  addPet: string;
  removePet: string;

  // Section E - Rental History
  sectionRentalHistory: string;
  currentLandlord: string;
  landlordPhone: string;
  reasonForMoving: string;
  reasonPlaceholder: string;

  // Section H - Market Rate
  sectionMarketRate: string;
  marketRateAuth: string;

  // Section I - Section 8
  sectionSection8: string;
  housingAuthority: string;
  voucherBedSize: string;
  paymentStandard: string;
  voucherExpiration: string;
  caseworkerName: string;
  caseworkerPhone: string;
  caseworkerEmail: string;
  docsVoucher: string;
  docsMovingPacket: string;
  docsBankStatement: string;
  s8Auth: string;

  // Section J - Additional
  sectionAdditional: string;
  ssnOrTaxId: string;
  docsPhotoId: string;
  docsSsnCard: string;

  // Signature
  sectionSignature: string;
  signatureLabel: string;
  signatureDate: string;
  certLabel: string;
  clearSignature: string;

  // Navigation
  next: string;
  previous: string;
  submit: string;
  submitting: string;
  printForm: string;

  // Success
  successTitle: string;
  successMessage: string;

  // Validation
  errFullName: string;
  errPhone: string;
  errHouseholdSize: string;
  errSignature: string;
}

export const rentalApplicationTranslations: Record<Language, RentalApplicationStrings> = {
  en: {
    formTitle: 'Full Tenant Application',
    formSubtitle: 'Complete this application after your showing. All information is kept confidential.',

    tab1: 'About You',
    tab2: 'Income & Needs',
    tab3: 'Details & Sign',

    sectionPersonal: 'Personal Information',
    fullName: 'Full Name',
    fullNamePlaceholder: 'First and last name',
    phone: 'Phone Number',
    phonePlaceholder: '(860) 000-0000',
    email: 'Email Address',
    emailPlaceholder: 'your@email.com',
    dob: 'Date of Birth',
    currentAddress: 'Current Address',
    currentAddressPlaceholder: '123 Main Street, Hartford CT',
    addressDuration: 'How long at current address?',
    addressDurationPlaceholder: 'e.g. 2 years',

    sectionHousehold: 'Household',
    householdSize: 'Number of people who will live in the unit (including yourself)',
    occupantsTitle: 'Additional Occupants',
    occupantName: 'Full Name',
    occupantDob: 'Date of Birth',
    occupantRelationship: 'Relationship',
    addOccupant: 'Add Occupant',
    removeOccupant: 'Remove',

    sectionIncome: 'Employment & Income',
    incomeSource1: 'Income Source 1',
    incomeSource2: 'Income Source 2',
    employerName: 'Employer / Source Name',
    employerPhone: 'Phone Number',
    jobTitle: 'Position / Job Title',
    howLong: 'How long?',
    proofAttached: 'Proof of income attached',
    yes: 'Yes',
    no: 'No',
    monthlyIncome: 'Approximate total monthly household income',
    incomeUnder1500: 'Under $1,500',
    income1500to2500: '$1,500 - $2,500',
    income2500to3500: '$2,500 - $3,500',
    income3500to5000: '$3,500 - $5,000',
    income5000to7500: '$5,000 - $7,500',
    income7500plus: '$7,500+',

    sectionNeeds: 'What Are You Applying For?',
    bedroomsNeeded: 'Bedrooms Needed',
    studio: 'Studio',
    oneBed: '1 Bedroom',
    twoBed: '2 Bedrooms',
    threeBed: '3 Bedrooms',
    fourBed: '4 Bedrooms',
    areasOfInterest: 'Areas of Interest',
    northEnd: 'North End',
    southEnd: 'South End',
    westEnd: 'West End',
    parkStreet: 'Park Street Corridor',
    noPreference: 'No Preference',
    desiredMoveIn: 'Desired Move-In Date',

    sectionPayment: 'Payment Type',
    paymentType: 'How will you be paying rent?',
    marketRate: 'Market Rate',
    section8: 'Section 8 / Housing Voucher',

    sectionPets: 'Pets',
    hasPets: 'Do you have any pets?',
    petType: 'Type (Dog / Cat / Other)',
    petWeight: 'Approx. Weight',
    addPet: 'Add Pet',
    removePet: 'Remove',

    sectionRentalHistory: 'Rental History',
    currentLandlord: 'Current or Most Recent Landlord Name',
    landlordPhone: 'Landlord Phone Number',
    reasonForMoving: 'Reason for Moving',
    reasonPlaceholder: 'Brief explanation...',

    sectionMarketRate: 'Market Rate Authorization',
    marketRateAuth: 'I authorize Stanton Management to verify the information provided in this application, including contacting my employer and landlord references.',

    sectionSection8: 'Section 8 / Housing Voucher Details',
    housingAuthority: 'Housing Authority Name',
    voucherBedSize: 'Voucher Bedroom Size',
    paymentStandard: 'Payment Standard / Amount',
    voucherExpiration: 'Voucher Expiration Date',
    caseworkerName: 'Caseworker Name',
    caseworkerPhone: 'Caseworker Phone',
    caseworkerEmail: 'Caseworker Email',
    docsVoucher: 'Voucher or approval letter',
    docsMovingPacket: 'Moving packet / moving papers',
    docsBankStatement: 'Most recent bank statement(s)',
    s8Auth: 'I authorize Stanton Management to verify the information provided in this application, including contacting my employer, landlord references, and housing authority caseworker.',

    sectionAdditional: 'Additional Information',
    ssnOrTaxId: 'Social Security Number or Tax ID',
    docsPhotoId: 'Government-issued photo ID (driver\'s license, passport, state ID, or foreign ID)',
    docsSsnCard: 'Social Security card or Tax ID document (SSN card or ITIN letter)',

    sectionSignature: 'Certification & Signature',
    signatureLabel: 'Applicant Signature',
    signatureDate: 'Date',
    certLabel: 'By signing this application, I confirm that all information provided is accurate to the best of my knowledge.',
    clearSignature: 'Clear',

    next: 'Next',
    previous: 'Previous',
    submit: 'Submit Application',
    submitting: 'Submitting...',
    printForm: 'Print Form',

    successTitle: 'Application Submitted',
    successMessage: 'Thank you. Your application has been received. Our leasing team will be in touch.',

    errFullName: 'Full name is required',
    errPhone: 'A valid phone number is required',
    errHouseholdSize: 'Household size is required',
    errSignature: 'Signature is required',
  },

  es: {
    formTitle: 'Solicitud Completa de Inquilino',
    formSubtitle: 'Complete esta solicitud despues de su visita. Toda la informacion se mantiene confidencial.',

    tab1: 'Sobre Usted',
    tab2: 'Ingresos y Necesidades',
    tab3: 'Detalles y Firma',

    sectionPersonal: 'Informacion Personal',
    fullName: 'Nombre Completo',
    fullNamePlaceholder: 'Nombre y apellido',
    phone: 'Numero de Telefono',
    phonePlaceholder: '(860) 000-0000',
    email: 'Correo Electronico',
    emailPlaceholder: 'su@correo.com',
    dob: 'Fecha de Nacimiento',
    currentAddress: 'Direccion Actual',
    currentAddressPlaceholder: '123 Calle Principal, Hartford CT',
    addressDuration: 'Cuanto tiempo en la direccion actual?',
    addressDurationPlaceholder: 'ej. 2 anos',

    sectionHousehold: 'Hogar',
    householdSize: 'Numero de personas que viviran en la unidad (incluyendose usted)',
    occupantsTitle: 'Ocupantes Adicionales',
    occupantName: 'Nombre Completo',
    occupantDob: 'Fecha de Nacimiento',
    occupantRelationship: 'Relacion',
    addOccupant: 'Agregar Ocupante',
    removeOccupant: 'Eliminar',

    sectionIncome: 'Empleo e Ingresos',
    incomeSource1: 'Fuente de Ingresos 1',
    incomeSource2: 'Fuente de Ingresos 2',
    employerName: 'Empleador / Nombre de la Fuente',
    employerPhone: 'Numero de Telefono',
    jobTitle: 'Puesto / Titulo del Trabajo',
    howLong: 'Cuanto tiempo?',
    proofAttached: 'Comprobante de ingresos adjunto',
    yes: 'Si',
    no: 'No',
    monthlyIncome: 'Ingresos mensuales aproximados del hogar',
    incomeUnder1500: 'Menos de $1,500',
    income1500to2500: '$1,500 - $2,500',
    income2500to3500: '$2,500 - $3,500',
    income3500to5000: '$3,500 - $5,000',
    income5000to7500: '$5,000 - $7,500',
    income7500plus: '$7,500+',

    sectionNeeds: 'Que Esta Solicitando?',
    bedroomsNeeded: 'Habitaciones Necesarias',
    studio: 'Estudio',
    oneBed: '1 Habitacion',
    twoBed: '2 Habitaciones',
    threeBed: '3 Habitaciones',
    fourBed: '4 Habitaciones',
    areasOfInterest: 'Areas de Interes',
    northEnd: 'Zona Norte',
    southEnd: 'Zona Sur',
    westEnd: 'Zona Oeste',
    parkStreet: 'Corredor Park Street',
    noPreference: 'Sin Preferencia',
    desiredMoveIn: 'Fecha de Entrada Deseada',

    sectionPayment: 'Tipo de Pago',
    paymentType: 'Como pagara el alquiler?',
    marketRate: 'Precio de Mercado',
    section8: 'Seccion 8 / Voucher de Vivienda',

    sectionPets: 'Mascotas',
    hasPets: 'Tiene mascotas?',
    petType: 'Tipo (Perro / Gato / Otro)',
    petWeight: 'Peso Aproximado',
    addPet: 'Agregar Mascota',
    removePet: 'Eliminar',

    sectionRentalHistory: 'Historial de Alquiler',
    currentLandlord: 'Nombre del Propietario Actual o Mas Reciente',
    landlordPhone: 'Telefono del Propietario',
    reasonForMoving: 'Razon para Mudarse',
    reasonPlaceholder: 'Breve explicacion...',

    sectionMarketRate: 'Autorizacion de Precio de Mercado',
    marketRateAuth: 'Autorizo a Stanton Management a verificar la informacion proporcionada en esta solicitud, incluyendo contactar a mi empleador y referencias de propietarios.',

    sectionSection8: 'Detalles de Seccion 8 / Voucher',
    housingAuthority: 'Nombre de la Autoridad de Vivienda',
    voucherBedSize: 'Tamano de Habitacion del Voucher',
    paymentStandard: 'Estandar de Pago / Monto',
    voucherExpiration: 'Fecha de Vencimiento del Voucher',
    caseworkerName: 'Nombre del Trabajador Social',
    caseworkerPhone: 'Telefono del Trabajador Social',
    caseworkerEmail: 'Correo del Trabajador Social',
    docsVoucher: 'Voucher o carta de aprobacion',
    docsMovingPacket: 'Paquete de mudanza / papeles de mudanza',
    docsBankStatement: 'Estado(s) de cuenta bancaria mas reciente(s)',
    s8Auth: 'Autorizo a Stanton Management a verificar la informacion proporcionada, incluyendo contactar a mi empleador, referencias de propietarios y trabajador social.',

    sectionAdditional: 'Informacion Adicional',
    ssnOrTaxId: 'Numero de Seguro Social o ID Fiscal',
    docsPhotoId: 'Identificacion oficial con foto (licencia de conducir, pasaporte, ID estatal o extranjero)',
    docsSsnCard: 'Tarjeta de Seguro Social o documento de ID Fiscal (tarjeta SSN o carta ITIN)',

    sectionSignature: 'Certificacion y Firma',
    signatureLabel: 'Firma del Solicitante',
    signatureDate: 'Fecha',
    certLabel: 'Al firmar esta solicitud, confirmo que toda la informacion proporcionada es correcta segun mi conocimiento.',
    clearSignature: 'Borrar',

    next: 'Siguiente',
    previous: 'Anterior',
    submit: 'Enviar Solicitud',
    submitting: 'Enviando...',
    printForm: 'Imprimir',

    successTitle: 'Solicitud Enviada',
    successMessage: 'Gracias. Su solicitud ha sido recibida. Nuestro equipo de arrendamiento se comunicara con usted.',

    errFullName: 'El nombre completo es obligatorio',
    errPhone: 'Se requiere un numero de telefono valido',
    errHouseholdSize: 'El tamano del hogar es obligatorio',
    errSignature: 'La firma es obligatoria',
  },

  pt: {
    formTitle: 'Solicitacao Completa de Inquilino',
    formSubtitle: 'Preencha esta solicitacao apos sua visita. Todas as informacoes sao mantidas em sigilo.',

    tab1: 'Sobre Voce',
    tab2: 'Renda e Necessidades',
    tab3: 'Detalhes e Assinatura',

    sectionPersonal: 'Informacoes Pessoais',
    fullName: 'Nome Completo',
    fullNamePlaceholder: 'Nome e sobrenome',
    phone: 'Numero de Telefone',
    phonePlaceholder: '(860) 000-0000',
    email: 'Endereco de Email',
    emailPlaceholder: 'seu@email.com',
    dob: 'Data de Nascimento',
    currentAddress: 'Endereco Atual',
    currentAddressPlaceholder: '123 Rua Principal, Hartford CT',
    addressDuration: 'Ha quanto tempo no endereco atual?',
    addressDurationPlaceholder: 'ex. 2 anos',

    sectionHousehold: 'Residentes',
    householdSize: 'Numero de pessoas que morarao na unidade (incluindo voce)',
    occupantsTitle: 'Ocupantes Adicionais',
    occupantName: 'Nome Completo',
    occupantDob: 'Data de Nascimento',
    occupantRelationship: 'Relacao',
    addOccupant: 'Adicionar Ocupante',
    removeOccupant: 'Remover',

    sectionIncome: 'Emprego e Renda',
    incomeSource1: 'Fonte de Renda 1',
    incomeSource2: 'Fonte de Renda 2',
    employerName: 'Empregador / Nome da Fonte',
    employerPhone: 'Numero de Telefone',
    jobTitle: 'Cargo / Titulo do Trabalho',
    howLong: 'Ha quanto tempo?',
    proofAttached: 'Comprovante de renda anexado',
    yes: 'Sim',
    no: 'Nao',
    monthlyIncome: 'Renda mensal total aproximada do domicilio',
    incomeUnder1500: 'Menos de $1.500',
    income1500to2500: '$1.500 - $2.500',
    income2500to3500: '$2.500 - $3.500',
    income3500to5000: '$3.500 - $5.000',
    income5000to7500: '$5.000 - $7.500',
    income7500plus: '$7.500+',

    sectionNeeds: 'O Que Voce Esta Solicitando?',
    bedroomsNeeded: 'Quartos Necessarios',
    studio: 'Studio',
    oneBed: '1 Quarto',
    twoBed: '2 Quartos',
    threeBed: '3 Quartos',
    fourBed: '4 Quartos',
    areasOfInterest: 'Areas de Interesse',
    northEnd: 'North End',
    southEnd: 'South End',
    westEnd: 'West End',
    parkStreet: 'Corredor Park Street',
    noPreference: 'Sem Preferencia',
    desiredMoveIn: 'Data de Mudanca Desejada',

    sectionPayment: 'Tipo de Pagamento',
    paymentType: 'Como voce pagara o aluguel?',
    marketRate: 'Preco de Mercado',
    section8: 'Secao 8 / Voucher de Moradia',

    sectionPets: 'Animais de Estimacao',
    hasPets: 'Voce tem animais de estimacao?',
    petType: 'Tipo (Cao / Gato / Outro)',
    petWeight: 'Peso Aproximado',
    addPet: 'Adicionar Animal',
    removePet: 'Remover',

    sectionRentalHistory: 'Historico de Aluguel',
    currentLandlord: 'Nome do Proprietario Atual ou Mais Recente',
    landlordPhone: 'Telefone do Proprietario',
    reasonForMoving: 'Motivo da Mudanca',
    reasonPlaceholder: 'Breve explicacao...',

    sectionMarketRate: 'Autorizacao de Preco de Mercado',
    marketRateAuth: 'Autorizo a Stanton Management a verificar as informacoes fornecidas nesta solicitacao, incluindo contato com meu empregador e referencias de proprietarios.',

    sectionSection8: 'Detalhes da Secao 8 / Voucher',
    housingAuthority: 'Nome da Autoridade de Habitacao',
    voucherBedSize: 'Tamanho do Quarto do Voucher',
    paymentStandard: 'Padrao de Pagamento / Valor',
    voucherExpiration: 'Data de Vencimento do Voucher',
    caseworkerName: 'Nome do Assistente Social',
    caseworkerPhone: 'Telefone do Assistente Social',
    caseworkerEmail: 'Email do Assistente Social',
    docsVoucher: 'Voucher ou carta de aprovacao',
    docsMovingPacket: 'Pacote de mudanca / papeis de mudanca',
    docsBankStatement: 'Extrato(s) bancario(s) mais recente(s)',
    s8Auth: 'Autorizo a Stanton Management a verificar as informacoes fornecidas, incluindo contato com meu empregador, referencias de proprietarios e assistente social.',

    sectionAdditional: 'Informacoes Adicionais',
    ssnOrTaxId: 'Numero de Seguridade Social ou ID Fiscal',
    docsPhotoId: 'Documento oficial com foto (carteira de motorista, passaporte, ID estadual ou estrangeiro)',
    docsSsnCard: 'Cartao de Seguridade Social ou documento de ID Fiscal (cartao SSN ou carta ITIN)',

    sectionSignature: 'Certificacao e Assinatura',
    signatureLabel: 'Assinatura do Solicitante',
    signatureDate: 'Data',
    certLabel: 'Ao assinar esta solicitacao, confirmo que todas as informacoes fornecidas sao precisas ao melhor do meu conhecimento.',
    clearSignature: 'Limpar',

    next: 'Proximo',
    previous: 'Anterior',
    submit: 'Enviar Solicitacao',
    submitting: 'Enviando...',
    printForm: 'Imprimir',

    successTitle: 'Solicitacao Enviada',
    successMessage: 'Obrigado. Sua solicitacao foi recebida. Nossa equipe de locacao entrara em contato.',

    errFullName: 'Nome completo e obrigatorio',
    errPhone: 'Um numero de telefone valido e obrigatorio',
    errHouseholdSize: 'O numero de residentes e obrigatorio',
    errSignature: 'A assinatura e obrigatoria',
  },
};
