import { PreferredLanguage } from '@/types/compliance';

export interface PbvFullAppStrings {
  // Page
  form_title: string;
  form_subtitle: string;
  loading: string;
  already_submitted: string;
  confirm_title: string;
  confirm_body: string;
  confirm_contact: string;

  // Navigation
  tab_household: string;
  tab_income: string;
  tab_assets: string;
  tab_expenses: string;
  tab_background: string;
  tab_circumstances: string;
  tab_certify: string;
  continue_btn: string;
  back_btn: string;
  submit_btn: string;
  submitting: string;

  // Section 1 — Household
  section1_title: string;
  hoh_name_label: string;
  hoh_dob_label: string;
  building_label: string;
  unit_label: string;
  member_name_label: string;
  member_dob_label: string;
  member_relationship_label: string;
  member_citizenship_label: string;
  member_ssn_label: string;
  member_ssn_helper: string;
  member_disability_label: string;
  member_student_label: string;
  add_member_btn: string;
  remove_member_btn: string;

  // Relationship options
  rel_head: string;
  rel_spouse: string;
  rel_partner: string;
  rel_child: string;
  rel_other: string;

  // Citizenship options
  cs_citizen: string;
  cs_eligible_non_citizen: string;
  cs_ineligible: string;
  cs_not_reported: string;

  // Section 2 — Income
  section2_title: string;
  income_intro: string;
  member_income_label: string;
  member_income_sources_label: string;
  income_total_display: (amount: string) => string;

  // Income sources
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

  // Section 3 — Assets
  section3_title: string;
  assets_intro: string;
  has_insurance_settlement_label: string;
  has_cd_trust_bond_label: string;
  has_life_insurance_label: string;
  yes: string;
  no: string;

  // Section 4 — Expenses
  section4_title: string;
  medical_deduction_label: string;
  medical_deduction_helper: string;
  childcare_label: string;

  // Section 5 — Background
  section5_title: string;
  background_intro: string;
  criminal_history_question: (name: string) => string;
  criminal_yes: string;
  criminal_no: string;
  criminal_not_answered: string;
  background_minors_note: string;

  // Section 6 — Circumstances
  section6_title: string;
  dv_status_label: string;
  dv_status_note: string;
  homeless_label: string;
  ra_label: string;
  ra_note: string;

  // Section 7 — Certify
  section7_title: string;
  review_intro: string;
  review_household_size: string;
  review_total_income: string;
  review_building: string;
  review_unit: string;
  cert_checkbox_label: string;
  cert_note: string;

  // Phase 4 — Signatures
  tab_signatures: string;
  sig_section_title: string;
  sig_loading: string;
  sig_signer_progress: (current: number, total: number) => string;
  sig_handoff_title: (name: string) => string;
  sig_handoff_body: string;
  sig_confirm_label: string;
  sig_confirm_btn: string;
  sig_confirm_mismatch: string;
  sig_forms_header: (name: string) => string;
  sig_sign_instruction: string;
  sig_clear_btn: string;
  sig_save_btn: string;
  sig_saving: string;
  sig_unsigned_error: string;
  sig_signer_done_title: (name: string) => string;
  sig_signer_done_body: string;
  sig_next_signer_btn: (name: string) => string;
  sig_last_signer_done_btn: string;
  sig_all_signed_title: string;
  sig_all_signed_body: string;

  // Phase 5 — Docs ready
  docs_ready_title: string;
  docs_ready_body: string;
  docs_portal_btn: string;

  // Errors
  err_hoh_name: string;
  err_hoh_dob: string;
  err_hoh_age: string;
  err_member_name: (n: number) => string;
  err_member_dob: (n: number) => string;
  err_member_relationship: (n: number) => string;
  err_member_income: (n: number) => string;
  err_member_income_sources: (n: number) => string;
  err_background_required: (name: string) => string;
  err_cert: string;
}

export const pbvFullAppTranslations: Record<PreferredLanguage, PbvFullAppStrings> = {
  en: {
    form_title: 'PBV Full Application',
    form_subtitle: 'Project-Based Voucher — Full Application',
    loading: 'Loading...',
    already_submitted:
      'Your application information has already been submitted. If you have questions, contact our office at (860) 993-3401.',
    confirm_title: 'Application Saved.',
    confirm_body:
      'Your household information has been received. You will receive further instructions regarding document submission and signatures.',
    confirm_contact: 'Questions? Contact our office at (860) 993-3401.',

    tab_household: 'Household',
    tab_income: 'Income',
    tab_assets: 'Assets',
    tab_expenses: 'Expenses',
    tab_background: 'Background',
    tab_circumstances: 'Circumstances',
    tab_certify: 'Certify',
    continue_btn: 'Continue',
    back_btn: 'Back',
    submit_btn: 'Submit Application',
    submitting: 'Submitting...',

    section1_title: 'Household Composition',
    hoh_name_label: 'Full Legal Name',
    hoh_dob_label: 'Date of Birth',
    building_label: 'Building',
    unit_label: 'Unit',
    member_name_label: 'Full Legal Name',
    member_dob_label: 'Date of Birth',
    member_relationship_label: 'Relationship to Head of Household',
    member_citizenship_label: 'Citizenship / Immigration Status',
    member_ssn_label: 'Social Security Number (optional)',
    member_ssn_helper: 'Enter as 123-45-6789. Your SSN is encrypted and stored securely.',
    member_disability_label: 'Has a disability',
    member_student_label: 'Full-time student',
    add_member_btn: 'Add Household Member',
    remove_member_btn: 'Remove',

    rel_head: 'Self (Head of Household)',
    rel_spouse: 'Spouse',
    rel_partner: 'Domestic Partner',
    rel_child: 'Child',
    rel_other: 'Other',

    cs_citizen: 'U.S. Citizen',
    cs_eligible_non_citizen: 'Eligible Non-Citizen',
    cs_ineligible: 'Ineligible Non-Citizen',
    cs_not_reported: 'Prefer Not to State',

    section2_title: 'Income',
    income_intro:
      'For each household member, select all income sources that apply and enter the total annual gross income.',
    member_income_label: 'Annual Gross Income ($)',
    member_income_sources_label: 'Income Source(s)',
    income_total_display: (amount) => `Total Household Income: ${amount}/year`,

    src_employment: 'Employment',
    src_ssi: 'SSI',
    src_ss: 'Social Security',
    src_pension: 'Pension / Railroad Retirement',
    src_tanf: 'TANF / Food Stamps / Public Assistance',
    src_child_support: 'Child Support',
    src_unemployment: 'Unemployment / Workers Comp',
    src_self_employment: 'Self-Employment',
    src_other: 'Other Income',
    src_none: 'No Income',

    section3_title: 'Assets & Banking',
    assets_intro:
      'Bank statements (savings and checking) will be required for each adult household member. Answer Yes or No for the following additional assets.',
    has_insurance_settlement_label:
      'Does anyone in the household have an insurance settlement or insurance proceeds?',
    has_cd_trust_bond_label: 'Does anyone in the household have a CD, trust, or bond?',
    has_life_insurance_label:
      'Does anyone in the household have a life insurance policy with cash value?',
    yes: 'Yes',
    no: 'No',

    section4_title: 'Expenses & Deductions',
    medical_deduction_label: 'Are you claiming a medical expense deduction?',
    medical_deduction_helper:
      'Households with unreimbursed medical expenses may qualify for an allowance deduction. Documentation will be required.',
    childcare_label: 'Does the household have childcare or dependent care expenses?',

    section5_title: 'Background',
    background_intro:
      'For each adult household member (age 18 or older), please answer the following question honestly. This information is required for the application.',
    criminal_history_question: (name) =>
      `Has ${name} been convicted of or pled guilty to a drug-related felony in the past 3 years, or any felony in the past 5 years?`,
    criminal_yes: 'Yes',
    criminal_no: 'No',
    criminal_not_answered: 'Prefer Not to Answer',
    background_minors_note: 'This question does not apply to household members under 18.',

    section6_title: 'Special Circumstances',
    dv_status_label:
      'Is any household member a victim of domestic violence, dating violence, sexual assault, or stalking?',
    dv_status_note:
      'If yes, VAWA (Violence Against Women Act) protections apply. Certification documents will be required.',
    homeless_label: 'Is the household currently homeless or at risk of homelessness?',
    ra_label:
      'Does any household member require a reasonable accommodation due to a disability?',
    ra_note:
      'If yes, a Reasonable Accommodation Request form will be required.',

    section7_title: 'Review & Certify',
    review_intro: 'Please review the information below before certifying and submitting.',
    review_household_size: 'Household Size',
    review_total_income: 'Total Annual Income',
    review_building: 'Building',
    review_unit: 'Unit',
    cert_checkbox_label:
      'I certify that all information provided in this application is true and accurate to the best of my knowledge. I understand that providing false information may result in denial or termination of housing assistance.',
    cert_note:
      'Signatures from all adult household members will be collected in a separate step.',

    err_hoh_name: 'Head of household name is required.',
    err_hoh_dob: 'Date of birth is required.',
    err_hoh_age: 'Head of household must be at least 18 years old.',
    err_member_name: (n) => `Member ${n}: full legal name is required.`,
    err_member_dob: (n) => `Member ${n}: date of birth is required.`,
    err_member_relationship: (n) => `Member ${n}: relationship is required.`,
    err_member_income: (n) => `Member ${n}: enter an annual income (enter 0 if no income).`,
    err_member_income_sources: (n) =>
      `Member ${n}: select at least one income source (select "No Income" if applicable).`,
    err_background_required: (name) =>
      `Please answer the background question for ${name}.`,
    err_cert: 'You must check the certification box before submitting.',

    tab_signatures: 'Signatures',
    sig_section_title: 'Signature Collection',
    sig_loading: 'Loading signature forms...',
    sig_signer_progress: (current, total) => `Signer ${current} of ${total}`,
    sig_handoff_title: (name) => `Pass the device to ${name}`,
    sig_handoff_body:
      'The next step requires this person to sign required HUD/HACH forms on this device. Please hand the device to them now.',
    sig_confirm_label: 'Please type your full name to confirm your identity before signing:',
    sig_confirm_btn: 'Confirm & Begin Signing',
    sig_confirm_mismatch: 'The name you entered does not match our records. Please try again.',
    sig_forms_header: (name) => `Signing forms for: ${name}`,
    sig_sign_instruction: 'Sign your name in the box below for each form.',
    sig_clear_btn: 'Clear',
    sig_save_btn: 'Submit My Signatures',
    sig_saving: 'Saving signatures...',
    sig_unsigned_error: 'All forms require a signature before you can continue.',
    sig_signer_done_title: (name) => `${name}'s signatures have been saved.`,
    sig_signer_done_body: 'Please return the device to the head of household.',
    sig_next_signer_btn: (name) => `Continue to ${name}`,
    sig_last_signer_done_btn: 'Proceed to Document Upload',
    sig_all_signed_title: 'All signatures collected.',
    sig_all_signed_body: 'All required adult household members have signed. You may now upload your supporting documents.',

    docs_ready_title: 'Application Ready for Documents',
    docs_ready_body:
      'Your household information and signatures have been submitted. Use the button below to access the document upload portal and upload all required supporting documents.',
    docs_portal_btn: 'Go to Document Upload',
  },

  es: {
    form_title: 'Solicitud Completa PBV',
    form_subtitle: 'Cupón Basado en Proyecto — Solicitud Completa',
    loading: 'Cargando...',
    already_submitted:
      'La información de su solicitud ya ha sido enviada. Si tiene preguntas, comuníquese con nuestra oficina al (860) 993-3401.',
    confirm_title: 'Solicitud Guardada.',
    confirm_body:
      'La información de su hogar ha sido recibida. Recibirá instrucciones adicionales sobre el envío de documentos y firmas.',
    confirm_contact: '¿Preguntas? Comuníquese con nuestra oficina al (860) 993-3401.',

    tab_household: 'Hogar',
    tab_income: 'Ingresos',
    tab_assets: 'Activos',
    tab_expenses: 'Gastos',
    tab_background: 'Antecedentes',
    tab_circumstances: 'Circunstancias',
    tab_certify: 'Certificar',
    continue_btn: 'Continuar',
    back_btn: 'Atrás',
    submit_btn: 'Enviar Solicitud',
    submitting: 'Enviando...',

    section1_title: 'Composición del Hogar',
    hoh_name_label: 'Nombre Legal Completo',
    hoh_dob_label: 'Fecha de Nacimiento',
    building_label: 'Edificio',
    unit_label: 'Unidad',
    member_name_label: 'Nombre Legal Completo',
    member_dob_label: 'Fecha de Nacimiento',
    member_relationship_label: 'Parentesco con el Jefe de Hogar',
    member_citizenship_label: 'Estado de Ciudadanía / Inmigración',
    member_ssn_label: 'Número de Seguro Social (opcional)',
    member_ssn_helper: 'Ingrese como 123-45-6789. Su SSN se cifra y almacena de forma segura.',
    member_disability_label: 'Tiene una discapacidad',
    member_student_label: 'Estudiante de tiempo completo',
    add_member_btn: 'Agregar Miembro del Hogar',
    remove_member_btn: 'Eliminar',

    rel_head: 'El/Ella Mismo/a (Jefe de Hogar)',
    rel_spouse: 'Cónyuge',
    rel_partner: 'Pareja Doméstica',
    rel_child: 'Hijo/a',
    rel_other: 'Otro',

    cs_citizen: 'Ciudadano/a Estadounidense',
    cs_eligible_non_citizen: 'No Ciudadano/a Elegible',
    cs_ineligible: 'No Ciudadano/a No Elegible',
    cs_not_reported: 'Prefiero No Indicar',

    section2_title: 'Ingresos',
    income_intro:
      'Para cada miembro del hogar, seleccione todas las fuentes de ingresos que correspondan e ingrese el ingreso bruto anual total.',
    member_income_label: 'Ingreso Bruto Anual ($)',
    member_income_sources_label: 'Fuente(s) de Ingresos',
    income_total_display: (amount) => `Ingreso Total del Hogar: ${amount}/año`,

    src_employment: 'Empleo',
    src_ssi: 'SSI',
    src_ss: 'Seguro Social',
    src_pension: 'Pensión / Jubilación Ferroviaria',
    src_tanf: 'TANF / Cupones de Alimentos / Asistencia Pública',
    src_child_support: 'Manutención Infantil',
    src_unemployment: 'Desempleo / Compensación Laboral',
    src_self_employment: 'Autoempleo',
    src_other: 'Otros Ingresos',
    src_none: 'Sin Ingresos',

    section3_title: 'Activos y Cuenta Bancaria',
    assets_intro:
      'Se requerirán estados de cuenta bancarios (ahorro y corriente) para cada adulto del hogar. Responda Sí o No a los siguientes activos adicionales.',
    has_insurance_settlement_label:
      '¿Algún miembro del hogar tiene una liquidación o ganancia de seguro?',
    has_cd_trust_bond_label: '¿Algún miembro del hogar tiene un CD, fideicomiso o bono?',
    has_life_insurance_label:
      '¿Algún miembro del hogar tiene una póliza de seguro de vida con valor en efectivo?',
    yes: 'Sí',
    no: 'No',

    section4_title: 'Gastos y Deducciones',
    medical_deduction_label: '¿Está solicitando una deducción por gastos médicos?',
    medical_deduction_helper:
      'Los hogares con gastos médicos no reembolsados pueden calificar para una deducción. Se requerirá documentación.',
    childcare_label: '¿El hogar tiene gastos de cuidado infantil o de dependientes?',

    section5_title: 'Antecedentes',
    background_intro:
      'Para cada adulto del hogar (18 años o más), responda la siguiente pregunta con honestidad. Esta información es obligatoria para la solicitud.',
    criminal_history_question: (name) =>
      `¿Ha sido ${name} condenado/a o se ha declarado culpable de un delito grave relacionado con drogas en los últimos 3 años, o de cualquier delito grave en los últimos 5 años?`,
    criminal_yes: 'Sí',
    criminal_no: 'No',
    criminal_not_answered: 'Prefiero No Responder',
    background_minors_note: 'Esta pregunta no aplica a miembros del hogar menores de 18 años.',

    section6_title: 'Circunstancias Especiales',
    dv_status_label:
      '¿Es algún miembro del hogar víctima de violencia doméstica, violencia en el noviazgo, agresión sexual o acoso?',
    dv_status_note:
      'En caso afirmativo, aplican las protecciones de VAWA. Se requerirán documentos de certificación.',
    homeless_label: '¿El hogar se encuentra actualmente sin hogar o en riesgo de quedarse sin hogar?',
    ra_label:
      '¿Algún miembro del hogar necesita un ajuste razonable debido a una discapacidad?',
    ra_note: 'En caso afirmativo, se requerirá un formulario de Solicitud de Ajuste Razonable.',

    section7_title: 'Revisión y Certificación',
    review_intro: 'Por favor revise la información a continuación antes de certificar y enviar.',
    review_household_size: 'Tamaño del Hogar',
    review_total_income: 'Ingreso Anual Total',
    review_building: 'Edificio',
    review_unit: 'Unidad',
    cert_checkbox_label:
      'Certifico que toda la información proporcionada en esta solicitud es verdadera y precisa según mi mejor conocimiento. Entiendo que proporcionar información falsa puede resultar en la denegación o terminación de la asistencia de vivienda.',
    cert_note:
      'Las firmas de todos los miembros adultos del hogar se recopilarán en un paso separado.',

    err_hoh_name: 'El nombre del jefe de hogar es obligatorio.',
    err_hoh_dob: 'La fecha de nacimiento es obligatoria.',
    err_hoh_age: 'El jefe de hogar debe tener al menos 18 años.',
    err_member_name: (n) => `Miembro ${n}: el nombre legal completo es obligatorio.`,
    err_member_dob: (n) => `Miembro ${n}: la fecha de nacimiento es obligatoria.`,
    err_member_relationship: (n) => `Miembro ${n}: el parentesco es obligatorio.`,
    err_member_income: (n) =>
      `Miembro ${n}: ingrese un ingreso anual (ingrese 0 si no tiene ingresos).`,
    err_member_income_sources: (n) =>
      `Miembro ${n}: seleccione al menos una fuente de ingresos (seleccione "Sin Ingresos" si corresponde).`,
    err_background_required: (name) =>
      `Por favor responda la pregunta de antecedentes para ${name}.`,
    err_cert: 'Debe marcar la casilla de certificación antes de enviar.',

    tab_signatures: 'Firmas',
    sig_section_title: 'Recopilación de Firmas',
    sig_loading: 'Cargando formularios de firma...',
    sig_signer_progress: (current, total) => `Firmante ${current} de ${total}`,
    sig_handoff_title: (name) => `Pase el dispositivo a ${name}`,
    sig_handoff_body:
      'El siguiente paso requiere que esta persona firme los formularios requeridos de HUD/HACH en este dispositivo. Por favor entrégueselo ahora.',
    sig_confirm_label: 'Por favor escriba su nombre completo para confirmar su identidad antes de firmar:',
    sig_confirm_btn: 'Confirmar y Comenzar a Firmar',
    sig_confirm_mismatch: 'El nombre ingresado no coincide con nuestros registros. Por favor intente de nuevo.',
    sig_forms_header: (name) => `Firmando formularios para: ${name}`,
    sig_sign_instruction: 'Firme su nombre en el recuadro a continuación para cada formulario.',
    sig_clear_btn: 'Borrar',
    sig_save_btn: 'Enviar Mis Firmas',
    sig_saving: 'Guardando firmas...',
    sig_unsigned_error: 'Todos los formularios requieren una firma antes de continuar.',
    sig_signer_done_title: (name) => `Las firmas de ${name} han sido guardadas.`,
    sig_signer_done_body: 'Por favor devuelva el dispositivo al jefe de hogar.',
    sig_next_signer_btn: (name) => `Continuar con ${name}`,
    sig_last_signer_done_btn: 'Proceder a la Carga de Documentos',
    sig_all_signed_title: 'Todas las firmas recopiladas.',
    sig_all_signed_body: 'Todos los adultos del hogar requeridos han firmado. Ahora puede cargar sus documentos de respaldo.',

    docs_ready_title: 'Solicitud Lista para Documentos',
    docs_ready_body:
      'La información de su hogar y las firmas han sido enviadas. Use el botón a continuación para acceder al portal de carga de documentos y cargar todos los documentos de respaldo requeridos.',
    docs_portal_btn: 'Ir a la Carga de Documentos',
  },

  pt: {
    form_title: 'Solicitação Completa PBV',
    form_subtitle: 'Voucher Baseado em Projeto — Solicitação Completa',
    loading: 'Carregando...',
    already_submitted:
      'As informações da sua solicitação já foram enviadas. Se tiver dúvidas, entre em contato com nosso escritório pelo (860) 993-3401.',
    confirm_title: 'Solicitação Salva.',
    confirm_body:
      'As informações do seu domicílio foram recebidas. Você receberá instruções adicionais sobre o envio de documentos e assinaturas.',
    confirm_contact: 'Dúvidas? Entre em contato pelo (860) 993-3401.',

    tab_household: 'Domicílio',
    tab_income: 'Renda',
    tab_assets: 'Ativos',
    tab_expenses: 'Despesas',
    tab_background: 'Antecedentes',
    tab_circumstances: 'Circunstâncias',
    tab_certify: 'Certificar',
    continue_btn: 'Continuar',
    back_btn: 'Voltar',
    submit_btn: 'Enviar Solicitação',
    submitting: 'Enviando...',

    section1_title: 'Composição do Domicílio',
    hoh_name_label: 'Nome Legal Completo',
    hoh_dob_label: 'Data de Nascimento',
    building_label: 'Edifício',
    unit_label: 'Unidade',
    member_name_label: 'Nome Legal Completo',
    member_dob_label: 'Data de Nascimento',
    member_relationship_label: 'Parentesco com o Chefe de Família',
    member_citizenship_label: 'Status de Cidadania / Imigração',
    member_ssn_label: 'Número de Seguridade Social (opcional)',
    member_ssn_helper:
      'Digite como 123-45-6789. Seu SSN é criptografado e armazenado com segurança.',
    member_disability_label: 'Tem uma deficiência',
    member_student_label: 'Estudante em tempo integral',
    add_member_btn: 'Adicionar Membro do Domicílio',
    remove_member_btn: 'Remover',

    rel_head: 'Eu Mesmo/a (Chefe de Família)',
    rel_spouse: 'Cônjuge',
    rel_partner: 'Parceiro/a Doméstico/a',
    rel_child: 'Filho/a',
    rel_other: 'Outro',

    cs_citizen: 'Cidadão/ã Americano/a',
    cs_eligible_non_citizen: 'Não Cidadão/ã Elegível',
    cs_ineligible: 'Não Cidadão/ã Não Elegível',
    cs_not_reported: 'Prefiro Não Informar',

    section2_title: 'Renda',
    income_intro:
      'Para cada membro do domicílio, selecione todas as fontes de renda aplicáveis e insira a renda bruta anual total.',
    member_income_label: 'Renda Bruta Anual ($)',
    member_income_sources_label: 'Fonte(s) de Renda',
    income_total_display: (amount) => `Renda Total do Domicílio: ${amount}/ano`,

    src_employment: 'Emprego',
    src_ssi: 'SSI',
    src_ss: 'Seguridade Social',
    src_pension: 'Pensão / Aposentadoria Ferroviária',
    src_tanf: 'TANF / Cupons Alimentares / Assistência Pública',
    src_child_support: 'Pensão Alimentícia',
    src_unemployment: 'Seguro Desemprego / Compensação de Trabalhadores',
    src_self_employment: 'Trabalho Autônomo',
    src_other: 'Outras Rendas',
    src_none: 'Sem Renda',

    section3_title: 'Ativos e Conta Bancária',
    assets_intro:
      'Extratos bancários (poupança e conta corrente) serão exigidos para cada adulto do domicílio. Responda Sim ou Não para os ativos adicionais abaixo.',
    has_insurance_settlement_label:
      'Algum membro do domicílio possui uma indenização ou receita de seguro?',
    has_cd_trust_bond_label: 'Algum membro do domicílio possui CD, trust ou título?',
    has_life_insurance_label:
      'Algum membro do domicílio possui apólice de seguro de vida com valor em dinheiro?',
    yes: 'Sim',
    no: 'Não',

    section4_title: 'Despesas e Deduções',
    medical_deduction_label: 'Você está solicitando uma dedução de despesas médicas?',
    medical_deduction_helper:
      'Domicílios com despesas médicas não reembolsadas podem ter direito a uma dedução. A documentação será exigida.',
    childcare_label: 'O domicílio tem despesas com creche ou cuidado de dependentes?',

    section5_title: 'Antecedentes',
    background_intro:
      'Para cada adulto do domicílio (18 anos ou mais), responda a seguinte pergunta com honestidade. Esta informação é obrigatória para a solicitação.',
    criminal_history_question: (name) =>
      `${name} foi condenado/a ou se declarou culpado/a de um crime grave relacionado a drogas nos últimos 3 anos, ou qualquer crime grave nos últimos 5 anos?`,
    criminal_yes: 'Sim',
    criminal_no: 'Não',
    criminal_not_answered: 'Prefiro Não Responder',
    background_minors_note: 'Esta pergunta não se aplica a membros do domicílio menores de 18 anos.',

    section6_title: 'Circunstâncias Especiais',
    dv_status_label:
      'Algum membro do domicílio é vítima de violência doméstica, violência no namoro, agressão sexual ou perseguição?',
    dv_status_note:
      'Em caso afirmativo, aplicam-se as proteções da VAWA. Documentos de certificação serão exigidos.',
    homeless_label:
      'O domicílio está atualmente sem moradia ou em risco de ficar sem moradia?',
    ra_label:
      'Algum membro do domicílio necessita de acomodação razoável devido a uma deficiência?',
    ra_note:
      'Em caso afirmativo, será necessário um formulário de Solicitação de Acomodação Razoável.',

    section7_title: 'Revisão e Certificação',
    review_intro: 'Por favor, revise as informações abaixo antes de certificar e enviar.',
    review_household_size: 'Tamanho do Domicílio',
    review_total_income: 'Renda Anual Total',
    review_building: 'Edifício',
    review_unit: 'Unidade',
    cert_checkbox_label:
      'Certifico que todas as informações fornecidas nesta solicitação são verdadeiras e precisas ao melhor do meu conhecimento. Entendo que fornecer informações falsas pode resultar na negação ou rescisão da assistência habitacional.',
    cert_note:
      'As assinaturas de todos os membros adultos do domicílio serão coletadas em uma etapa separada.',

    err_hoh_name: 'O nome do chefe de família é obrigatório.',
    err_hoh_dob: 'A data de nascimento é obrigatória.',
    err_hoh_age: 'O chefe de família deve ter pelo menos 18 anos.',
    err_member_name: (n) => `Membro ${n}: o nome legal completo é obrigatório.`,
    err_member_dob: (n) => `Membro ${n}: a data de nascimento é obrigatória.`,
    err_member_relationship: (n) => `Membro ${n}: o parentesco é obrigatório.`,
    err_member_income: (n) =>
      `Membro ${n}: insira uma renda anual (insira 0 se não tiver renda).`,
    err_member_income_sources: (n) =>
      `Membro ${n}: selecione pelo menos uma fonte de renda (selecione "Sem Renda" se aplicável).`,
    err_background_required: (name) =>
      `Por favor, responda a pergunta de antecedentes para ${name}.`,
    err_cert: 'Você deve marcar a caixa de certificação antes de enviar.',

    tab_signatures: 'Assinaturas',
    sig_section_title: 'Coleta de Assinaturas',
    sig_loading: 'Carregando formulários de assinatura...',
    sig_signer_progress: (current, total) => `Signatário ${current} de ${total}`,
    sig_handoff_title: (name) => `Passe o dispositivo para ${name}`,
    sig_handoff_body:
      'O próximo passo requer que esta pessoa assine os formulários obrigatórios do HUD/HACH neste dispositivo. Por favor, entregue o dispositivo a ela agora.',
    sig_confirm_label: 'Por favor, digite seu nome completo para confirmar sua identidade antes de assinar:',
    sig_confirm_btn: 'Confirmar e Começar a Assinar',
    sig_confirm_mismatch: 'O nome digitado não corresponde aos nossos registros. Por favor, tente novamente.',
    sig_forms_header: (name) => `Assinando formulários para: ${name}`,
    sig_sign_instruction: 'Assine seu nome no campo abaixo para cada formulário.',
    sig_clear_btn: 'Limpar',
    sig_save_btn: 'Enviar Minhas Assinaturas',
    sig_saving: 'Salvando assinaturas...',
    sig_unsigned_error: 'Todos os formulários exigem assinatura antes de continuar.',
    sig_signer_done_title: (name) => `As assinaturas de ${name} foram salvas.`,
    sig_signer_done_body: 'Por favor, devolva o dispositivo ao chefe de família.',
    sig_next_signer_btn: (name) => `Continuar para ${name}`,
    sig_last_signer_done_btn: 'Prosseguir para Upload de Documentos',
    sig_all_signed_title: 'Todas as assinaturas coletadas.',
    sig_all_signed_body: 'Todos os adultos do domicílio necessários assinaram. Agora você pode fazer upload dos documentos de suporte.',

    docs_ready_title: 'Solicitação Pronta para Documentos',
    docs_ready_body:
      'As informações do seu domicílio e as assinaturas foram enviadas. Use o botão abaixo para acessar o portal de upload de documentos e enviar todos os documentos de suporte necessários.',
    docs_portal_btn: 'Ir para Upload de Documentos',
  },
};
