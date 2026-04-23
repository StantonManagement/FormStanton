import { PreferredLanguage } from '@/types/compliance';

export interface PbvFormStrings {
  // Page title
  form_title: string;
  form_subtitle: string;

  // Section headers
  section1_title: string;
  section2_title: string;
  section3_title: string;
  section4_title: string;

  // Section 1 fields
  hoh_name_label: string;
  hoh_dob_label: string;
  building_label: string;
  unit_label: string;

  // Section 2 fields
  member_name_label: string;
  member_dob_label: string;
  member_relationship_label: string;
  member_income_label: string;
  member_income_sources_label: string;
  add_member_btn: string;
  remove_member_btn: string;
  total_income_label: string;
  income_total_display: (amount: string) => string;

  // Relationship options
  rel_self: string;
  rel_spouse: string;
  rel_partner: string;
  rel_child: string;
  rel_parent: string;
  rel_sibling: string;
  rel_other: string;

  // Income source options
  src_employment: string;
  src_ssi: string;
  src_ss: string;
  src_pension: string;
  src_tanf: string;
  src_child_support: string;
  src_unemployment: string;
  src_self_employment: string;
  src_other: string;
  src_none: string;

  // Section 3 citizenship
  citizen_question_hoh: string;
  citizen_question_other: string;
  yes: string;
  no: string;

  // Section 4 signature
  cert_checkbox_label: string;
  signature_label: string;
  clear_signature: string;
  date_label: string;

  // Actions
  submit_btn: string;
  submitting: string;

  // Validation errors
  err_hoh_name: string;
  err_hoh_dob: string;
  err_hoh_age: string;
  err_member_name: (n: number) => string;
  err_member_dob: (n: number) => string;
  err_member_relationship: (n: number) => string;
  err_member_income: (n: number) => string;
  err_citizenship: string;
  err_cert: string;
  err_signature: string;

  // Confirmation screen
  confirm_title: string;
  confirm_body: string;
  confirm_contact: string;

  // Already submitted
  already_submitted: string;

  // Loading
  loading: string;
}

export const pbvFormTranslations: Record<PreferredLanguage, PbvFormStrings> = {
  en: {
    form_title: 'PBV Pre-Application',
    form_subtitle: 'Housing Choice Voucher Pre-Screening',

    section1_title: 'Head of Household',
    section2_title: 'Household Members',
    section3_title: 'Citizenship Status',
    section4_title: 'Certification & Signature',

    hoh_name_label: 'Full Name',
    hoh_dob_label: 'Date of Birth',
    building_label: 'Building',
    unit_label: 'Unit',

    member_name_label: 'Full Name',
    member_dob_label: 'Date of Birth',
    member_relationship_label: 'Relationship to Head of Household',
    member_income_label: 'Annual Gross Income ($)',
    member_income_sources_label: 'Income Source(s)',
    add_member_btn: 'Add Household Member',
    remove_member_btn: 'Remove',
    total_income_label: 'Total Household Income',
    income_total_display: (amount) => `Total Household Income: ${amount}/year`,

    rel_self: 'Self',
    rel_spouse: 'Spouse',
    rel_partner: 'Partner',
    rel_child: 'Child',
    rel_parent: 'Parent',
    rel_sibling: 'Sibling',
    rel_other: 'Other',

    src_employment: 'Employment',
    src_ssi: 'SSI',
    src_ss: 'Social Security',
    src_pension: 'Pension',
    src_tanf: 'TANF',
    src_child_support: 'Child Support',
    src_unemployment: 'Unemployment',
    src_self_employment: 'Self-Employment',
    src_other: 'Other',
    src_none: 'None',

    citizen_question_hoh: 'Is the head of household a U.S. citizen or eligible non-citizen?',
    citizen_question_other: 'Is there another adult in the household who is a U.S. citizen or eligible non-citizen?',
    yes: 'Yes',
    no: 'No',

    cert_checkbox_label: 'I certify that the information provided is true and accurate to the best of my knowledge.',
    signature_label: 'Your Signature',
    clear_signature: 'Clear Signature',
    date_label: 'Date',

    submit_btn: 'Submit Pre-Application',
    submitting: 'Submitting...',

    err_hoh_name: 'Head of household name is required.',
    err_hoh_dob: 'Date of birth is required.',
    err_hoh_age: 'Head of household must be at least 18 years old.',
    err_member_name: (n) => `Member ${n}: name is required.`,
    err_member_dob: (n) => `Member ${n}: date of birth is required.`,
    err_member_relationship: (n) => `Member ${n}: relationship is required.`,
    err_member_income: (n) => `Member ${n}: please enter an annual income (enter 0 if none).`,
    err_citizenship: 'Please answer the citizenship question.',
    err_cert: 'You must check the certification box.',
    err_signature: 'Signature is required.',

    confirm_title: 'Thank You.',
    confirm_body: 'Your pre-application has been received. We will review your information and be in touch about next steps.',
    confirm_contact: 'If you have questions, contact our office at (860) 993-3401.',

    already_submitted: 'Your pre-application has already been submitted. Thank you.',

    loading: 'Loading...',
  },

  es: {
    form_title: 'Pre-Solicitud PBV',
    form_subtitle: 'Pre-Evaluación de Cupón de Elección de Vivienda',

    section1_title: 'Jefe de Hogar',
    section2_title: 'Miembros del Hogar',
    section3_title: 'Estado de Ciudadanía',
    section4_title: 'Certificación y Firma',

    hoh_name_label: 'Nombre Completo',
    hoh_dob_label: 'Fecha de Nacimiento',
    building_label: 'Edificio',
    unit_label: 'Unidad',

    member_name_label: 'Nombre Completo',
    member_dob_label: 'Fecha de Nacimiento',
    member_relationship_label: 'Parentesco con el Jefe de Hogar',
    member_income_label: 'Ingreso Bruto Anual ($)',
    member_income_sources_label: 'Fuente(s) de Ingreso',
    add_member_btn: 'Agregar Miembro del Hogar',
    remove_member_btn: 'Eliminar',
    total_income_label: 'Ingreso Total del Hogar',
    income_total_display: (amount) => `Ingreso Total del Hogar: ${amount}/año`,

    rel_self: 'El/Ella Mismo/a',
    rel_spouse: 'Cónyuge',
    rel_partner: 'Pareja',
    rel_child: 'Hijo/a',
    rel_parent: 'Padre/Madre',
    rel_sibling: 'Hermano/a',
    rel_other: 'Otro',

    src_employment: 'Empleo',
    src_ssi: 'SSI',
    src_ss: 'Seguro Social',
    src_pension: 'Pensión',
    src_tanf: 'TANF',
    src_child_support: 'Manutención',
    src_unemployment: 'Desempleo',
    src_self_employment: 'Autoempleo',
    src_other: 'Otro',
    src_none: 'Ninguno',

    citizen_question_hoh: '¿El jefe del hogar es ciudadano estadounidense o no ciudadano elegible?',
    citizen_question_other: '¿Hay otro adulto en el hogar que sea ciudadano estadounidense o no ciudadano elegible?',
    yes: 'Sí',
    no: 'No',

    cert_checkbox_label: 'I certify that the information provided is true and accurate to the best of my knowledge.',
    signature_label: 'Su Firma',
    clear_signature: 'Borrar Firma',
    date_label: 'Fecha',

    submit_btn: 'Enviar Pre-Solicitud',
    submitting: 'Enviando...',

    err_hoh_name: 'El nombre del jefe de hogar es obligatorio.',
    err_hoh_dob: 'La fecha de nacimiento es obligatoria.',
    err_hoh_age: 'El jefe de hogar debe tener al menos 18 años.',
    err_member_name: (n) => `Miembro ${n}: el nombre es obligatorio.`,
    err_member_dob: (n) => `Miembro ${n}: la fecha de nacimiento es obligatoria.`,
    err_member_relationship: (n) => `Miembro ${n}: el parentesco es obligatorio.`,
    err_member_income: (n) => `Miembro ${n}: ingrese un ingreso anual (ingrese 0 si no tiene).`,
    err_citizenship: 'Por favor responda la pregunta sobre ciudadanía.',
    err_cert: 'Debe marcar la casilla de certificación.',
    err_signature: 'La firma es obligatoria.',

    confirm_title: 'Gracias.',
    confirm_body: 'Su pre-solicitud ha sido recibida. Revisaremos su información y nos pondremos en contacto sobre los próximos pasos.',
    confirm_contact: 'Si tiene preguntas, comuníquese con nuestra oficina al (860) 993-3401.',

    already_submitted: 'Su pre-solicitud ya ha sido enviada. Gracias.',

    loading: 'Cargando...',
  },

  pt: {
    form_title: 'Pré-Inscrição PBV',
    form_subtitle: 'Pré-Triagem do Voucher de Escolha de Habitação',

    section1_title: 'Chefe de Família',
    section2_title: 'Membros da Família',
    section3_title: 'Status de Cidadania',
    section4_title: 'Certificação e Assinatura',

    hoh_name_label: 'Nome Completo',
    hoh_dob_label: 'Data de Nascimento',
    building_label: 'Edifício',
    unit_label: 'Unidade',

    member_name_label: 'Nome Completo',
    member_dob_label: 'Data de Nascimento',
    member_relationship_label: 'Parentesco com o Chefe de Família',
    member_income_label: 'Renda Bruta Anual ($)',
    member_income_sources_label: 'Fonte(s) de Renda',
    add_member_btn: 'Adicionar Membro da Família',
    remove_member_btn: 'Remover',
    total_income_label: 'Renda Total da Família',
    income_total_display: (amount) => `Renda Total da Família: ${amount}/ano`,

    rel_self: 'Eu Mesmo',
    rel_spouse: 'Cônjuge',
    rel_partner: 'Parceiro/a',
    rel_child: 'Filho/a',
    rel_parent: 'Pai/Mãe',
    rel_sibling: 'Irmão/Irmã',
    rel_other: 'Outro',

    src_employment: 'Emprego',
    src_ssi: 'SSI',
    src_ss: 'Seguridade Social',
    src_pension: 'Pensão',
    src_tanf: 'TANF',
    src_child_support: 'Pensão Alimentícia',
    src_unemployment: 'Desemprego',
    src_self_employment: 'Trabalho Autônomo',
    src_other: 'Outro',
    src_none: 'Nenhum',

    citizen_question_hoh: 'O chefe de família é cidadão americano ou não cidadão elegível?',
    citizen_question_other: 'Há outro adulto na família que seja cidadão americano ou não cidadão elegível?',
    yes: 'Sim',
    no: 'Não',

    cert_checkbox_label: 'I certify that the information provided is true and accurate to the best of my knowledge.',
    signature_label: 'Sua Assinatura',
    clear_signature: 'Limpar Assinatura',
    date_label: 'Data',

    submit_btn: 'Enviar Pré-Inscrição',
    submitting: 'Enviando...',

    err_hoh_name: 'O nome do chefe de família é obrigatório.',
    err_hoh_dob: 'A data de nascimento é obrigatória.',
    err_hoh_age: 'O chefe de família deve ter pelo menos 18 anos.',
    err_member_name: (n) => `Membro ${n}: o nome é obrigatório.`,
    err_member_dob: (n) => `Membro ${n}: a data de nascimento é obrigatória.`,
    err_member_relationship: (n) => `Membro ${n}: o parentesco é obrigatório.`,
    err_member_income: (n) => `Membro ${n}: insira uma renda anual (insira 0 se não tiver).`,
    err_citizenship: 'Por favor responda a pergunta sobre cidadania.',
    err_cert: 'Você deve marcar a caixa de certificação.',
    err_signature: 'A assinatura é obrigatória.',

    confirm_title: 'Obrigado.',
    confirm_body: 'Sua pré-inscrição foi recebida. Revisaremos suas informações e entraremos em contato sobre os próximos passos.',
    confirm_contact: 'Se você tiver dúvidas, entre em contato com nosso escritório pelo (860) 993-3401.',

    already_submitted: 'Sua pré-inscrição já foi enviada. Obrigado.',

    loading: 'Carregando...',
  },
};
