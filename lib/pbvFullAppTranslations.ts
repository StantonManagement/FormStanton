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

  // Already Submitted Re-entry (PRD-20)
  already_submitted_title: string;
  already_submitted_subtitle: string;
  already_submitted_timestamp_label: string;
  already_submitted_docs_heading: string;
  already_submitted_signatures_heading: string;
  already_submitted_contact_heading: string;
  already_submitted_contact_body: string;
  already_submitted_print_btn: string;

  // Intro / What to Expect
  intro_title: string;
  intro_step1_title: string;
  intro_step1_desc: string;
  intro_step2_title: string;
  intro_step2_desc: string;
  intro_step3_title: string;
  intro_step3_desc: string;
  intro_time_estimate: string;
  intro_documents_needed: string;
  intro_start_btn: string;

  // Action Items / Progress
  action_items_title: string;
  action_items_subtitle: string;
  step_1_label: string;
  step_1_status_complete: string;
  step_2_label: string;
  step_2_status_complete: string;
  step_2_status_pending: (signed: number, total: number) => string;
  step_3_label: string;
  step_3_status_complete: string;
  step_3_status_pending: (remaining: number, uploaded: number) => string;
  step_4_label: string;
  step_4_status_waiting: string;
  step_4_status_complete: string;
  approved_documents_title: string;
  approved_documents_count: (count: number) => string;
  action_required_title: string;
  action_required_count: (count: number) => string;
  signature_action_btn: string;
  reupload_action_btn: string;
  upload_action_btn: string;
  view_all_action_items: string;
  back_to_dashboard: string;
  all_requirements_met: string;

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
  background_reassurance: string;
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
  sig_first_signer_title: (name: string) => string;
  sig_first_signer_body: (count: number) => string;
  sig_confirm_label: string;
  sig_confirm_btn: string;
  sig_confirm_mismatch: string;
  sig_forms_header: (name: string) => string;
  sig_sign_instruction: string;
  sig_form_count: (current: number, total: number) => string;
  sig_form_descriptions: Record<string, string>;
  sig_clear_btn: string;
  sig_save_btn: string;
  sig_saving: string;
  sig_unsigned_error: string;
  sig_signer_done_title: (name: string) => string;
  sig_signer_done_body: string;
  sig_signer_done_body_single: string;
  sig_next_signer_btn: (name: string) => string;
  sig_last_signer_done_btn: string;
  sig_all_signed_title: string;
  sig_all_signed_body: string;
  sig_consent_label: string;
  sig_review_title: string;
  sig_review_subtitle: string;
  sig_review_signer_label: (name: string) => string;
  sig_review_resign_btn: string;
  sig_review_confirm_btn: string;
  sig_review_missing_error: (signer: string, doc: string) => string;
  finalize_validation_error: string;
  finalize_network_error: string;
  finalize_retry_btn: string;

  // Document Categories
  category_income: string;
  category_assets: string;
  category_medical_childcare: string;
  category_immigration: string;
  category_signed_forms: string;
  category_custom: string;

  // Phase 5 — Docs ready
  docs_ready_title: string;
  docs_ready_body: string;
  docs_portal_btn: string;
  progress_title: string;
  sig_section_needed: string;
  sig_section_needed_subtitle: string;
  sig_resume_btn: string;
  docs_section_needed: string;
  docs_upload_btn: string;
  all_complete_title: string;
  all_complete_body: string;
  rejected_docs_title: string;
  rejected_docs_body: string;
  upload_new_version_btn: string;
  back_to_summary: string;

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

  // Phase 4 — Phone + Language confirmation
  phone_label: string;
  phone_helper: string;
  phone_prefill_prompt: string;
  err_phone_required: string;
  err_phone_invalid: string;
  lang_confirm_label: (langName: string) => string;
  lang_confirm_btn: string;
  lang_change_label: string;
  err_lang_not_confirmed: string;
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

    // Already Submitted Re-entry (PRD-20)
    already_submitted_title: 'Application Submitted',
    already_submitted_subtitle: 'Your PBV application is in review. The office will contact you.',
    already_submitted_timestamp_label: 'Submitted on',
    already_submitted_docs_heading: 'Documents you submitted',
    already_submitted_signatures_heading: 'Signatures captured',
    already_submitted_contact_heading: 'Need to make a change?',
    already_submitted_contact_body: 'Contact the office at (860) 993-3401.',
    already_submitted_print_btn: 'Print this page',

    // Intro / What to Expect
    intro_title: 'What to Expect',
    intro_step1_title: '1. Household Information',
    intro_step1_desc: 'Tell us about your household members, income, and circumstances.',
    intro_step2_title: '2. Signatures',
    intro_step2_desc: 'All adult household members will sign required HUD/HACH forms.',
    intro_step3_title: '3. Document Upload',
    intro_step3_desc: 'Upload supporting documents (IDs, pay stubs, etc.).',
    intro_time_estimate: 'This process takes about 15–20 minutes.',
    intro_documents_needed: 'You will need: Social Security cards or IDs for all members, and proof of income.',
    intro_start_btn: 'Start Application',

    // Action Items / Progress
    action_items_title: 'Application Progress',
    action_items_subtitle: 'Complete these items to finish your application',
    step_1_label: 'Household Information',
    step_1_status_complete: 'Complete',
    step_2_label: 'Signatures',
    step_2_status_complete: 'Complete',
    step_2_status_pending: (signed: number, total: number) => `${signed} of ${total} done`,
    step_3_label: 'Documents',
    step_3_status_complete: 'Complete',
    step_3_status_pending: (remaining: number, uploaded: number) => `${remaining} remaining · ${uploaded} uploaded`,
    step_4_label: 'Under Review',
    step_4_status_waiting: 'Waiting for documents',
    step_4_status_complete: 'Application submitted',
    approved_documents_title: 'Approved Documents',
    approved_documents_count: (count: number) => `Approved (${count})`,
    action_required_title: 'Action Required',
    action_required_count: (count: number) => `${count} items need attention`,
    signature_action_btn: 'Sign Now',
    reupload_action_btn: 'Replace',
    upload_action_btn: 'Upload',
    view_all_action_items: 'View All',
    back_to_dashboard: '← Back to Dashboard',
    all_requirements_met: 'All requirements complete!',

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
    background_reassurance:
      'This information is required by HUD. A felony conviction does not automatically disqualify your household — your application will be reviewed on a case-by-case basis.',
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

    phone_label: 'Phone Number',
    phone_helper: "We'll use this number to send you important updates about your application.",
    phone_prefill_prompt: 'Is this your current phone number?',
    err_phone_required: 'A phone number is required.',
    err_phone_invalid: 'Please enter a valid 10-digit US phone number.',
    lang_confirm_label: (langName) => `We\'ll send you messages in ${langName}. Is that correct?`,
    lang_confirm_btn: 'Yes, that is correct',
    lang_change_label: 'Change language',
    err_lang_not_confirmed: 'Please confirm your preferred language before continuing.',

    tab_signatures: 'Signatures',
    sig_section_title: 'Signature Collection',
    sig_loading: 'Loading signature forms...',
    sig_signer_progress: (current, total) => `Signer ${current} of ${total}`,
    sig_handoff_title: (name) => `Pass the device to ${name}`,
    sig_handoff_body:
      'The next step requires this person to sign required HUD/HACH forms on this device. Please hand the device to them now.',
    sig_first_signer_title: (name) => `Welcome, ${name}`,
    sig_first_signer_body: (count) =>
      `You are about to sign ${count} required HUD/HACH form${count !== 1 ? 's' : ''}. Please read the description of each form and sign in the box provided.`,
    sig_confirm_label: 'Please type your full name to confirm your identity before signing:',
    sig_confirm_btn: 'Confirm & Begin Signing',
    sig_confirm_mismatch: 'The name you entered does not match our records. Please try again.',
    sig_forms_header: (name) => `Signing forms for: ${name}`,
    sig_sign_instruction: 'Read each description below and sign in the box provided. Your signature confirms you have been informed of the contents of each document.',
    sig_form_count: (current, total) => `Form ${current} of ${total}`,
    sig_form_descriptions: {
      main_application: 'Confirms that the information you provided in this application is true and accurate to the best of your knowledge.',
      criminal_background_release: 'Authorizes HACH to conduct a criminal background check on your behalf as required for the voucher program.',
      hud_9886a: 'Authorizes HUD and HACH to verify your income and household information with government agencies and employers.',
      hach_release: 'Authorizes HACH to verify your information with local agencies, service providers, and other housing authorities.',
      citizenship_declaration: 'Declares the citizenship or eligible immigration status of each member of your household.',
      debts_owed_phas: 'Confirms whether any household member owes money to another public housing authority (HUD Form HUD-52675).',
      obligations_of_family: 'Acknowledges the responsibilities and obligations your household agrees to uphold as a condition of receiving housing assistance.',
      briefing_docs_certification: 'Certifies that you received and reviewed all required HUD informational materials provided at your briefing.',
      eiv_guide_receipt: 'Confirms that you received the HUD guide explaining how your income and employment information is verified through the EIV system.',
      hud_92006: 'Provides an optional emergency contact person that HUD may notify if your housing assistance is at risk of termination.',
      no_child_support_affidavit: 'Certifies that a household member has no child support obligation or child support income to report.',
    },
    sig_clear_btn: 'Clear',
    sig_save_btn: 'Submit My Signatures',
    sig_saving: 'Saving signatures...',
    sig_unsigned_error: 'All forms require a signature before you can continue.',
    sig_signer_done_title: (name) => `${name}'s signatures have been saved.`,
    sig_signer_done_body: 'Please return the device to the head of household.',
    sig_signer_done_body_single: 'Your signatures have been saved. You may now proceed.',
    sig_next_signer_btn: (name) => `Continue to ${name}`,
    sig_last_signer_done_btn: 'Proceed to Document Upload',
    sig_all_signed_title: 'All signatures collected.',
    sig_all_signed_body: 'All required adult household members have signed. You may now upload your supporting documents.',
    sig_consent_label: 'By checking this box, I agree that my electronic signature constitutes my legal signature on all forms I am about to sign, and that I am signing these documents voluntarily.',
    sig_review_title: 'Review Your Signatures',
    sig_review_subtitle: 'Please review all signatures before submitting your application. You may re-sign any document if needed.',
    sig_review_signer_label: (name) => `Signed by: ${name}`,
    sig_review_resign_btn: 'Re-sign',
    sig_review_confirm_btn: 'Confirm and Submit Application',
    sig_review_missing_error: (signer, doc) => `${signer} — ${doc} is still missing a signature.`,
    finalize_validation_error: 'Some items are still missing. Please review and try again.',
    finalize_network_error: "We couldn't submit your application. Please try again.",
    finalize_retry_btn: 'Try Again',

    category_income: 'Income Verification',
    category_assets: 'Banking & Assets',
    category_medical_childcare: 'Medical & Childcare',
    category_immigration: 'Citizenship & Immigration',
    category_signed_forms: 'Signed Forms',
    category_custom: 'Additional Documents',

    docs_ready_title: 'Application Ready for Documents',
    docs_ready_body:
      'Your household information and signatures have been submitted. Use the button below to access the document upload portal and upload all required supporting documents.',
    docs_portal_btn: 'Go to Document Upload',
    progress_title: 'Application Progress',
    sig_section_needed: 'Signatures Needed',
    sig_section_needed_subtitle: 'All adult household members must sign the required HUD/HACH forms.',
    sig_resume_btn: 'Resume Signatures',
    docs_section_needed: 'Documents Needed',
    docs_upload_btn: 'Go to Document Upload',
    all_complete_title: 'Application Complete',
    all_complete_body: 'Your application has been submitted for review.',
    rejected_docs_title: 'Action Required: Documents to Resubmit',
    rejected_docs_body: 'These documents were rejected during review. Please upload corrected versions before we can proceed.',
    upload_new_version_btn: 'Upload New Version',
    back_to_summary: '← Back to Summary',
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

    // Already Submitted Re-entry (PRD-20)
    already_submitted_title: 'Solicitud Enviada',
    already_submitted_subtitle: 'Su solicitud PBV está en revisión. La oficina se comunicará con usted.',
    already_submitted_timestamp_label: 'Enviada el',
    already_submitted_docs_heading: 'Documentos que envió',
    already_submitted_signatures_heading: 'Firmas capturadas',
    already_submitted_contact_heading: '¿Necesita hacer un cambio?',
    already_submitted_contact_body: 'Comuníquese con la oficina al (860) 993-3401.',
    already_submitted_print_btn: 'Imprimir esta página',

    // Intro / What to Expect
    intro_title: 'Qué Esperar',
    intro_step1_title: '1. Información del Hogar',
    intro_step1_desc: 'Cuéntenos sobre los miembros de su hogar, ingresos y circunstancias.',
    intro_step2_title: '2. Firmas',
    intro_step2_desc: 'Todos los adultos del hogar firmarán los formularios requeridos de HUD/HACH.',
    intro_step3_title: '3. Carga de Documentos',
    intro_step3_desc: 'Suba documentos de respaldo (identificaciones, talones de pago, etc.).',
    intro_time_estimate: 'Este proceso toma aproximadamente 15–20 minutos.',
    intro_documents_needed: 'Necesitará: Tarjetas de Seguro Social o identificaciones para todos los miembros, y comprobante de ingresos.',
    intro_start_btn: 'Comenzar Solicitud',

    // Action Items / Progress
    action_items_title: 'Progreso de la Solicitud',
    action_items_subtitle: 'Complete estos elementos para finalizar su solicitud',
    step_1_label: 'Información del Hogar',
    step_1_status_complete: 'Completo',
    step_2_label: 'Firmas',
    step_2_status_complete: 'Completo',
    step_2_status_pending: (signed: number, total: number) => `${signed} de ${total} hechas`,
    step_3_label: 'Documentos',
    step_3_status_complete: 'Completo',
    step_3_status_pending: (remaining: number, uploaded: number) => `${remaining} pendientes · ${uploaded} subidos`,
    step_4_label: 'En Revisión',
    step_4_status_waiting: 'Esperando documentos',
    step_4_status_complete: 'Solicitud enviada',
    approved_documents_title: 'Documentos Aprobados',
    approved_documents_count: (count: number) => `Aprobados (${count})`,
    action_required_title: 'Acción Requerida',
    action_required_count: (count: number) => `${count} elementos requieren atención`,
    signature_action_btn: 'Firmar Ahora',
    reupload_action_btn: 'Reemplazar',
    upload_action_btn: 'Subir',
    view_all_action_items: 'Ver Todo',
    back_to_dashboard: '← Volver al Panel',
    all_requirements_met: '¡Todos los requisitos completos!',

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
    background_reassurance:
      'Esta información es requerida por HUD. Una condena por delito grave no descalifica automáticamente a su hogar — su solicitud será revisada caso por caso.',
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

    phone_label: 'Número de Teléfono',
    phone_helper: 'Usaremos este número para enviarle actualizaciones importantes sobre su solicitud.',
    phone_prefill_prompt: '¿Es este su número de teléfono actual?',
    err_phone_required: 'Se requiere un número de teléfono.',
    err_phone_invalid: 'Por favor ingrese un número de teléfono de EE. UU. de 10 dígitos válido.',
    lang_confirm_label: (langName) => `Le enviaremos mensajes en ${langName}. ¿Es correcto?`,
    lang_confirm_btn: 'Sí, es correcto',
    lang_change_label: 'Cambiar idioma',
    err_lang_not_confirmed: 'Por favor confirme su idioma preferido antes de continuar.',

    tab_signatures: 'Firmas',
    sig_section_title: 'Recopilación de Firmas',
    sig_loading: 'Cargando formularios de firma...',
    sig_signer_progress: (current, total) => `Firmante ${current} de ${total}`,
    sig_handoff_title: (name) => `Pase el dispositivo a ${name}`,
    sig_handoff_body:
      'El siguiente paso requiere que esta persona firme los formularios requeridos de HUD/HACH en este dispositivo. Por favor entrégueselo ahora.',
    sig_first_signer_title: (name) => `Bienvenido/a, ${name}`,
    sig_first_signer_body: (count) =>
      `Está a punto de firmar ${count} formulario${count !== 1 ? 's' : ''} requerido${count !== 1 ? 's' : ''} de HUD/HACH. Por favor lea la descripción de cada formulario y firme en el recuadro.`,
    sig_confirm_label: 'Por favor escriba su nombre completo para confirmar su identidad antes de firmar:',
    sig_confirm_btn: 'Confirmar y Comenzar a Firmar',
    sig_confirm_mismatch: 'El nombre ingresado no coincide con nuestros registros. Por favor intente de nuevo.',
    sig_forms_header: (name) => `Firmando formularios para: ${name}`,
    sig_sign_instruction: 'Lea cada descripción a continuación y firme en el recuadro. Su firma confirma que ha sido informado/a del contenido de cada documento.',
    sig_form_count: (current, total) => `Formulario ${current} de ${total}`,
    sig_form_descriptions: {
      main_application: 'Confirma que la información que proporcionó en esta solicitud es verdadera y precisa según su leal saber y entender.',
      criminal_background_release: 'Autoriza a HACH a realizar una verificación de antecedentes penales en su nombre, según lo requerido por el programa de vales.',
      hud_9886a: 'Autoriza a HUD y HACH a verificar sus ingresos e información del hogar con agencias gubernamentales y empleadores.',
      hach_release: 'Autoriza a HACH a verificar su información con agencias locales, proveedores de servicios y otras autoridades de vivienda.',
      citizenship_declaration: 'Declara el estado de ciudadanía o el estatus migratorio elegible de cada miembro de su hogar.',
      debts_owed_phas: 'Confirma si algún miembro del hogar debe dinero a otra autoridad de vivienda pública (Formulario HUD HUD-52675).',
      obligations_of_family: 'Reconoce las responsabilidades y obligaciones que su hogar acepta cumplir como condición para recibir asistencia habitacional.',
      briefing_docs_certification: 'Certifica que recibió y revisó todos los materiales informativos requeridos de HUD proporcionados en su sesión informativa.',
      eiv_guide_receipt: 'Confirma que recibió la guía de HUD que explica cómo se verifica su información de ingresos y empleo a través del sistema EIV.',
      hud_92006: 'Proporciona un contacto de emergencia opcional al que HUD puede notificar si su asistencia habitacional está en riesgo de terminación.',
      no_child_support_affidavit: 'Certifica que un miembro del hogar no tiene obligación de manutención infantil ni ingresos por manutención que declarar.',
    },
    sig_clear_btn: 'Borrar',
    sig_save_btn: 'Enviar Mis Firmas',
    sig_saving: 'Guardando firmas...',
    sig_unsigned_error: 'Todos los formularios requieren una firma antes de continuar.',
    sig_signer_done_title: (name) => `Las firmas de ${name} han sido guardadas.`,
    sig_signer_done_body: 'Por favor devuelva el dispositivo al jefe de hogar.',
    sig_signer_done_body_single: 'Sus firmas han sido guardadas. Ahora puede continuar.',
    sig_next_signer_btn: (name) => `Continuar con ${name}`,
    sig_last_signer_done_btn: 'Proceder a la Carga de Documentos',
    sig_all_signed_title: 'Todas las firmas recopiladas.',
    sig_all_signed_body: 'Todos los adultos del hogar requeridos han firmado. Ahora puede cargar sus documentos de respaldo.',
    sig_consent_label: 'Al marcar esta casilla, acepto que mi firma electrónica constituye mi firma legal en todos los formularios que estoy a punto de firmar, y que estoy firmando estos documentos voluntariamente.',
    sig_review_title: 'Revise Sus Firmas',
    sig_review_subtitle: 'Por favor revise todas las firmas antes de enviar su solicitud. Puede volver a firmar cualquier documento si es necesario.',
    sig_review_signer_label: (name) => `Firmado por: ${name}`,
    sig_review_resign_btn: 'Volver a Firmar',
    sig_review_confirm_btn: 'Confirmar y Enviar Solicitud',
    sig_review_missing_error: (signer, doc) => `${signer} — ${doc} aún no tiene firma.`,
    finalize_validation_error: 'Algunos elementos aún faltan. Por favor revise e intente de nuevo.',
    finalize_network_error: 'No pudimos enviar su solicitud. Por favor intente de nuevo.',
    finalize_retry_btn: 'Intentar de Nuevo',

    category_income: 'Verificación de Ingresos',
    category_assets: 'Cuentas y Bienes',
    category_medical_childcare: 'Médico y Cuidado Infantil',
    category_immigration: 'Ciudadanía e Inmigración',
    category_signed_forms: 'Formularios Firmados',
    category_custom: 'Documentos Adicionales',

    docs_ready_title: 'Solicitud Lista para Documentos',
    docs_ready_body:
      'La información de su hogar y las firmas han sido enviadas. Use el botón a continuación para acceder al portal de carga de documentos y cargar todos los documentos de respaldo requeridos.',
    docs_portal_btn: 'Ir a la Carga de Documentos',
    progress_title: 'Progreso de la Solicitud',
    sig_section_needed: 'Firmas Necesarias',
    sig_section_needed_subtitle: 'Todos los adultos del hogar deben firmar los formularios requeridos de HUD/HACH.',
    sig_resume_btn: 'Continuar con Firmas',
    docs_section_needed: 'Documentos Necesarios',
    docs_upload_btn: 'Ir a la Carga de Documentos',
    all_complete_title: 'Solicitud Completa',
    all_complete_body: 'Su solicitud ha sido enviada para revisión.',
    rejected_docs_title: 'Acción Requerida: Documentos a Reenviar',
    rejected_docs_body: 'Estos documentos fueron rechazados durante la revisión. Por favor suba versiones corregidas antes de continuar.',
    upload_new_version_btn: 'Subir Nueva Versión',
    back_to_summary: '← Volver al Resumen',
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

    // Already Submitted Re-entry (PRD-20)
    already_submitted_title: 'Solicitação Enviada',
    already_submitted_subtitle: 'Sua solicitação PBV está em revisão. O escritório entrará em contato.',
    already_submitted_timestamp_label: 'Enviada em',
    already_submitted_docs_heading: 'Documentos que você enviou',
    already_submitted_signatures_heading: 'Assinaturas capturadas',
    already_submitted_contact_heading: 'Precisa fazer uma alteração?',
    already_submitted_contact_body: 'Entre em contato com o escritório pelo (860) 993-3401.',
    already_submitted_print_btn: 'Imprimir esta página',

    // Intro / What to Expect
    intro_title: 'O Que Esperar',
    intro_step1_title: '1. Informações do Domicílio',
    intro_step1_desc: 'Conte-nos sobre os membros do seu domicílio, renda e circunstâncias.',
    intro_step2_title: '2. Assinaturas',
    intro_step2_desc: 'Todos os adultos do domicílio assinarão os formulários obrigatórios da HUD/HACH.',
    intro_step3_title: '3. Envio de Documentos',
    intro_step3_desc: 'Envie documentos de suporte (identidades, contracheques, etc.).',
    intro_time_estimate: 'Este processo leva cerca de 15–20 minutos.',
    intro_documents_needed: 'Você precisará de: Cartões de Seguro Social ou identidades para todos os membros, e comprovante de renda.',
    intro_start_btn: 'Iniciar Solicitação',

    // Action Items / Progress
    action_items_title: 'Progresso da Solicitação',
    action_items_subtitle: 'Complete estes itens para finalizar sua solicitação',
    step_1_label: 'Informações do Domicílio',
    step_1_status_complete: 'Completo',
    step_2_label: 'Assinaturas',
    step_2_status_complete: 'Completo',
    step_2_status_pending: (signed: number, total: number) => `${signed} de ${total} feitas`,
    step_3_label: 'Documentos',
    step_3_status_complete: 'Completo',
    step_3_status_pending: (remaining: number, uploaded: number) => `${remaining} pendentes · ${uploaded} enviados`,
    step_4_label: 'Em Revisão',
    step_4_status_waiting: 'Aguardando documentos',
    step_4_status_complete: 'Solicitação enviada',
    approved_documents_title: 'Documentos Aprovados',
    approved_documents_count: (count: number) => `Aprovados (${count})`,
    action_required_title: 'Ação Necessária',
    action_required_count: (count: number) => `${count} itens precisam de atenção`,
    signature_action_btn: 'Assinar Agora',
    reupload_action_btn: 'Substituir',
    upload_action_btn: 'Enviar',
    view_all_action_items: 'Ver Todos',
    back_to_dashboard: '← Voltar ao Painel',
    all_requirements_met: 'Todos os requisitos completos!',

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
    background_reassurance:
      'Esta informação é exigida pelo HUD. Uma condenação por crime grave não desqualifica automaticamente o seu domicílio — sua solicitação será analisada caso a caso.',
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

    phone_label: 'Número de Telefone',
    phone_helper: 'Usaremos este número para enviar atualizações importantes sobre sua solicitação.',
    phone_prefill_prompt: 'Este é o seu número de telefone atual?',
    err_phone_required: 'Um número de telefone é obrigatório.',
    err_phone_invalid: 'Por favor, insira um número de telefone americano válido com 10 dígitos.',
    lang_confirm_label: (langName) => `Enviaremos mensagens para você em ${langName}. Está correto?`,
    lang_confirm_btn: 'Sim, está correto',
    lang_change_label: 'Alterar idioma',
    err_lang_not_confirmed: 'Por favor, confirme seu idioma preferido antes de continuar.',

    tab_signatures: 'Assinaturas',
    sig_section_title: 'Coleta de Assinaturas',
    sig_loading: 'Carregando formulários de assinatura...',
    sig_signer_progress: (current, total) => `Signatário ${current} de ${total}`,
    sig_handoff_title: (name) => `Passe o dispositivo para ${name}`,
    sig_handoff_body:
      'O próximo passo requer que esta pessoa assine os formulários obrigatórios do HUD/HACH neste dispositivo. Por favor, entregue o dispositivo a ela agora.',
    sig_first_signer_title: (name) => `Bem-vindo/a, ${name}`,
    sig_first_signer_body: (count) =>
      `Você está prestes a assinar ${count} formulário${count !== 1 ? 's' : ''} obrigatório${count !== 1 ? 's' : ''} do HUD/HACH. Por favor, leia a descrição de cada formulário e assine no campo indicado.`,
    sig_confirm_label: 'Por favor, digite seu nome completo para confirmar sua identidade antes de assinar:',
    sig_confirm_btn: 'Confirmar e Começar a Assinar',
    sig_confirm_mismatch: 'O nome digitado não corresponde aos nossos registros. Por favor, tente novamente.',
    sig_forms_header: (name) => `Assinando formulários para: ${name}`,
    sig_sign_instruction: 'Leia cada descrição abaixo e assine no campo indicado. Sua assinatura confirma que você foi informado/a sobre o conteúdo de cada documento.',
    sig_form_count: (current, total) => `Formulário ${current} de ${total}`,
    sig_form_descriptions: {
      main_application: 'Confirma que as informações fornecidas nesta solicitação são verdadeiras e precisas conforme seu melhor conhecimento.',
      criminal_background_release: 'Autoriza o HACH a realizar uma verificação de antecedentes criminais em seu nome, conforme exigido pelo programa de vouchers.',
      hud_9886a: 'Autoriza o HUD e o HACH a verificar sua renda e informações do domicílio com agências governamentais e empregadores.',
      hach_release: 'Autoriza o HACH a verificar suas informações com agências locais, prestadores de serviços e outras autoridades habitacionais.',
      citizenship_declaration: 'Declara a cidadania ou o status de imigração elegível de cada membro do seu domicílio.',
      debts_owed_phas: 'Confirma se algum membro do domicílio deve dinheiro a outra autoridade habitacional pública (Formulário HUD HUD-52675).',
      obligations_of_family: 'Reconhece as responsabilidades e obrigações que seu domicílio concorda em cumprir como condição para receber auxílio habitacional.',
      briefing_docs_certification: 'Certifica que você recebeu e revisou todos os materiais informativos obrigatórios do HUD fornecidos em sua orientação.',
      eiv_guide_receipt: 'Confirma que você recebeu o guia do HUD explicando como sua renda e informações de emprego são verificadas pelo sistema EIV.',
      hud_92006: 'Fornece um contato de emergência opcional que o HUD pode notificar se o seu auxílio habitacional estiver em risco de rescisão.',
      no_child_support_affidavit: 'Certifica que um membro do domicílio não tem obrigação de pensão alimentar nem renda de pensão a declarar.',
    },
    sig_clear_btn: 'Limpar',
    sig_save_btn: 'Enviar Minhas Assinaturas',
    sig_saving: 'Salvando assinaturas...',
    sig_unsigned_error: 'Todos os formulários exigem assinatura antes de continuar.',
    sig_signer_done_title: (name) => `As assinaturas de ${name} foram salvas.`,
    sig_signer_done_body: 'Por favor, devolva o dispositivo ao chefe de família.',
    sig_signer_done_body_single: 'Suas assinaturas foram salvas. Você já pode prosseguir.',
    sig_next_signer_btn: (name) => `Continuar para ${name}`,
    sig_last_signer_done_btn: 'Prosseguir para Upload de Documentos',
    sig_all_signed_title: 'Todas as assinaturas coletadas.',
    sig_all_signed_body: 'Todos os adultos do domicílio necessários assinaram. Agora você pode fazer upload dos documentos de suporte.',
    sig_consent_label: 'Ao marcar esta caixa, concordo que minha assinatura eletrônica constitui minha assinatura legal em todos os formulários que estou prestes a assinar, e que estou assinando estes documentos voluntariamente.',
    sig_review_title: 'Revise Suas Assinaturas',
    sig_review_subtitle: 'Por favor, revise todas as assinaturas antes de enviar sua inscrição. Você pode reassinar qualquer documento se necessário.',
    sig_review_signer_label: (name) => `Assinado por: ${name}`,
    sig_review_resign_btn: 'Reassinar',
    sig_review_confirm_btn: 'Confirmar e Enviar Inscrição',
    sig_review_missing_error: (signer, doc) => `${signer} — ${doc} ainda está sem assinatura.`,
    finalize_validation_error: 'Alguns itens ainda estão faltando. Por favor, revise e tente novamente.',
    finalize_network_error: 'Não conseguimos enviar sua solicitação. Por favor, tente novamente.',
    finalize_retry_btn: 'Tentar Novamente',

    category_income: 'Verificação de Renda',
    category_assets: 'Contas e Bens',
    category_medical_childcare: 'Médico e Creche',
    category_immigration: 'Cidadania e Imigração',
    category_signed_forms: 'Formulários Assinados',
    category_custom: 'Documentos Adicionais',

    docs_ready_title: 'Solicitação Pronta para Documentos',
    docs_ready_body:
      'As informações do seu domicílio e as assinaturas foram enviadas. Use o botão abaixo para acessar o portal de upload de documentos e enviar todos os documentos de suporte necessários.',
    docs_portal_btn: 'Ir para Upload de Documentos',
    progress_title: 'Progresso da Solicitação',
    sig_section_needed: 'Assinaturas Necessárias',
    sig_section_needed_subtitle: 'Todos os adultos do domicílio devem assinar os formulários obrigatórios do HUD/HACH.',
    sig_resume_btn: 'Retomar Assinaturas',
    docs_section_needed: 'Documentos Necessários',
    docs_upload_btn: 'Ir para Upload de Documentos',
    all_complete_title: 'Solicitação Completa',
    all_complete_body: 'Sua solicitação foi enviada para revisão.',
    rejected_docs_title: 'Ação Necessária: Documentos a Reenviar',
    rejected_docs_body: 'Estes documentos foram rejeitados durante a revisão. Por favor, envie versões corrigidas antes de continuar.',
    upload_new_version_btn: 'Enviar Nova Versão',
    back_to_summary: '← Voltar ao Resumo',
  },
};
