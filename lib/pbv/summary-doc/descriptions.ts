/**
 * lib/pbv/summary-doc/descriptions.ts
 *
 * Plain-language one-line descriptions for each federal form and upload category.
 * Used in the summary doc content tree (PRD-28).
 *
 * ES/PT: machine-aided draft — marked tentative where indicated.
 * Search for "// CONTENT: tentative" to find all strings needing review.
 */

export type Language = 'en' | 'es' | 'pt';

// ─── Form descriptions ─────────────────────────────────────────────────────────

export const FORM_DESCRIPTIONS: Record<Language, Record<string, string>> = {
  en: {
    main_application:
      'The main HCV application form with household roster, income, and demographic information.',
    briefing_docs_certification:
      'Certification that you received and reviewed 8 federal housing documents about your rights and responsibilities.',
    hud_9886a:
      'Authorization for HUD to verify your income and employment information from third-party sources.',
    hach_release:
      'Authorization for HACH to contact third parties to verify the information in your application.',
    eiv_guide_receipt:
      'Acknowledgement that you received and understand the guide to HUD\u2019s income-verification system (EIV).',
    criminal_background_release:
      'Consent for a criminal background check required for HCV eligibility screening.',
    debts_owed_phas:
      'Disclosure of any unpaid balances owed to public housing authorities from previous tenancies.',
    hud_92006:
      'Optional form providing an emergency or third-party contact for HACH\u2019s records.',
    zero_income_statement:
      'Statement declaring that a household member has no income from any source.',
    citizenship_declaration:
      'Declaration of U.S. citizenship or eligible immigration status, required for each household member.',
    obligations_of_family:
      'Acknowledgement of the responsibilities your household agrees to follow under the housing voucher program.',
    vawa_certification:
      'Optional certification related to the Violence Against Women Act — protects applicants with VAWA circumstances.',
    reasonable_accommodation_request:
      'Optional request for a program accommodation based on a disability.',
  },

  es: {
    // CONTENT: tentative — review with Dan + translator
    main_application:
      'El formulario principal de solicitud HCV con el listado del hogar, ingresos e información demográfica.',
    briefing_docs_certification:
      'Certificación de que recibió y revisó 8 documentos federales de vivienda sobre sus derechos y responsabilidades.',
    hud_9886a:
      'Autorización para que HUD verifique su información de ingresos y empleo con terceros.',
    hach_release:
      'Autorización para que HACH contacte a terceros para verificar la información de su solicitud.',
    eiv_guide_receipt:
      'Reconocimiento de que recibió y comprende la guía del sistema de verificación de ingresos de HUD (EIV).',
    criminal_background_release:
      'Consentimiento para una verificación de antecedentes penales requerida para la elegibilidad del programa HCV.',
    debts_owed_phas:
      'Declaración de cualquier saldo pendiente adeudado a autoridades de vivienda pública de arrendamientos anteriores.',
    hud_92006:
      'Formulario opcional que proporciona un contacto de emergencia o tercero para los registros de HACH.',
    zero_income_statement:
      'Declaración de que un miembro del hogar no tiene ingresos de ninguna fuente.',
    citizenship_declaration:
      'Declaración de ciudadanía estadounidense o estatus migratorio elegible, requerida para cada miembro del hogar.',
    obligations_of_family:
      'Reconocimiento de las responsabilidades que su hogar acepta cumplir bajo el programa de vales de vivienda.',
    vawa_certification:
      'Certificación opcional relacionada con la Ley de Violencia contra la Mujer (VAWA).',
    reasonable_accommodation_request:
      'Solicitud opcional de adaptación del programa por discapacidad.',
  },

  pt: {
    // CONTENT: tentative — review with Dan + translator
    main_application:
      'O formulário principal de solicita\u00e7\u00e3o HCV com a lista do dom\u00edcilio, renda e informa\u00e7\u00f5es demográficas.',
    briefing_docs_certification:
      'Certifica\u00e7\u00e3o de que recebeu e revisou 8 documentos federais de habita\u00e7\u00e3o sobre seus direitos e responsabilidades.',
    hud_9886a:
      'Autoriza\u00e7\u00e3o para que o HUD verifique suas informa\u00e7\u00f5es de renda e emprego junto a terceiros.',
    hach_release:
      'Autoriza\u00e7\u00e3o para que o HACH entre em contato com terceiros para verificar as informa\u00e7\u00f5es de sua solicita\u00e7\u00e3o.',
    eiv_guide_receipt:
      'Reconhecimento de que recebeu e compreende o guia do sistema de verifica\u00e7\u00e3o de renda do HUD (EIV).',
    criminal_background_release:
      'Consentimento para verifica\u00e7\u00e3o de antecedentes criminais exigida para elegibilidade ao programa HCV.',
    debts_owed_phas:
      'Divulga\u00e7\u00e3o de quaisquer saldos n\u00e3o pagos a autoridades de habita\u00e7\u00e3o p\u00fablica de locat\u00f3rios anteriores.',
    hud_92006:
      'Formul\u00e1rio opcional que fornece um contato de emerg\u00eancia ou terceiro para os registros do HACH.',
    zero_income_statement:
      'Declara\u00e7\u00e3o de que um membro do dom\u00edcilio n\u00e3o tem renda de nenhuma fonte.',
    citizenship_declaration:
      'Declara\u00e7\u00e3o de cidadania americana ou status de imigra\u00e7\u00e3o eleg\u00edvel, exigida para cada membro do dom\u00edcilio.',
    obligations_of_family:
      'Reconhecimento das responsabilidades que seu dom\u00edcilio concorda em cumprir no programa de vale-habita\u00e7\u00e3o.',
    vawa_certification:
      'Certifica\u00e7\u00e3o opcional relacionada \u00e0 Lei de Viol\u00eancia contra a Mulher (VAWA).',
    reasonable_accommodation_request:
      'Solicita\u00e7\u00e3o opcional de adapta\u00e7\u00e3o do programa por defici\u00eancia.',
  },
};

// ─── Upload category descriptions ─────────────────────────────────────────────

export const UPLOAD_DESCRIPTIONS: Record<Language, Record<string, string>> = {
  en: {
    paystubs: 'Recent pay stubs (last 4 pay periods) for employed household members.',
    ssi_award_letter: 'Award letter from the Social Security Administration confirming SSI benefits.',
    ss_award_letter: 'Award letter from the Social Security Administration confirming Social Security benefits.',
    pension_award_letter: 'Award or benefit letter confirming pension or retirement income.',
    tanf_letter: 'Letter from the Department of Social Services confirming TANF/cash assistance.',
    child_support_documentation: 'Court order or documentation confirming child support payments received.',
    unemployment_documentation: 'Benefit letter from the state confirming unemployment insurance payments.',
    student_schedule_or_letter: 'Current school enrollment letter or class schedule for full-time students.',
    self_employment_documentation: 'Tax returns or profit/loss statement for self-employment income.',
    government_id: 'Government-issued photo ID for the head of household (passport, state ID, or driver\u2019s license).',
    birth_certificates: 'Birth certificates or proof of age for all household members.',
    social_security_cards: 'Social Security cards for all household members who have them.',
    immigration_documents: 'Immigration status documents for non-U.S.-citizen household members.',
    medical_expense_documentation: 'Receipts or letters confirming ongoing medical expenses for elderly or disabled members.',
    disability_documentation: 'Documentation confirming a household member\u2019s disability status.',
    childcare_receipts: 'Receipts from licensed childcare providers for working household members.',
  },

  es: {
    // CONTENT: tentative — review with Dan + translator
    paystubs: 'Talones de pago recientes (últimos 4 períodos) para los miembros del hogar empleados.',
    ssi_award_letter: 'Carta de adjudicación de la Administración del Seguro Social que confirma los beneficios del SSI.',
    ss_award_letter: 'Carta de adjudicación de la Administración del Seguro Social que confirma los beneficios del Seguro Social.',
    pension_award_letter: 'Carta de adjudicación o beneficio que confirma los ingresos por pensión o jubilación.',
    tanf_letter: 'Carta del Departamento de Servicios Sociales que confirma la asistencia TANF/efectivo.',
    child_support_documentation: 'Orden judicial o documentación que confirme los pagos de manutención recibidos.',
    unemployment_documentation: 'Carta de beneficios del estado que confirma los pagos del seguro de desempleo.',
    student_schedule_or_letter: 'Carta de inscripción escolar actual o horario de clases para estudiantes a tiempo completo.',
    self_employment_documentation: 'Declaraciones de impuestos o estado de ganancias y pérdidas para ingresos por cuenta propia.',
    government_id: 'Identificación oficial con foto del jefe de hogar (pasaporte, identificación estatal o licencia de conducir).',
    birth_certificates: 'Certificados de nacimiento o prueba de edad para todos los miembros del hogar.',
    social_security_cards: 'Tarjetas del Seguro Social para todos los miembros del hogar que las tengan.',
    immigration_documents: 'Documentos de estatus migratorio para los miembros del hogar que no sean ciudadanos estadounidenses.',
    medical_expense_documentation: 'Recibos o cartas que confirmen gastos médicos continuos para personas mayores o discapacitadas.',
    disability_documentation: 'Documentación que confirme el estatus de discapacidad de un miembro del hogar.',
    childcare_receipts: 'Recibos de proveedores de cuidado infantil con licencia para los miembros del hogar que trabajan.',
  },

  pt: {
    // CONTENT: tentative — review with Dan + translator
    paystubs: 'Holerites recentes (últimos 4 períodos de pagamento) para membros empregados do domicílio.',
    ssi_award_letter: 'Carta de concess\u00e3o da Administra\u00e7\u00e3o do Seguro Social confirmando os benef\u00edcios do SSI.',
    ss_award_letter: 'Carta de concess\u00e3o da Administra\u00e7\u00e3o do Seguro Social confirmando os benef\u00edcios da Previd\u00eancia Social.',
    pension_award_letter: 'Carta de concess\u00e3o ou benef\u00edcio confirmando renda de pens\u00e3o ou aposentadoria.',
    tanf_letter: 'Carta do Departamento de Servi\u00e7os Sociais confirmando assist\u00eancia TANF/dinheiro.',
    child_support_documentation: 'Ordem judicial ou documenta\u00e7\u00e3o confirmando pagamentos de pens\u00e3o aliment\u00edcia recebidos.',
    unemployment_documentation: 'Carta de benef\u00edcios do estado confirmando pagamentos do seguro-desemprego.',
    student_schedule_or_letter: 'Carta de matr\u00edcula escolar atual ou hor\u00e1rio de aulas para estudantes em tempo integral.',
    self_employment_documentation: 'Declara\u00e7\u00f5es de impostos ou demonstrativo de lucros e perdas para renda aut\u00f4noma.',
    government_id: 'Documento de identidade oficial com foto do chefe de fam\u00edlia (passaporte, documento de identidade estadual ou carteira de habilitação).',
    birth_certificates: 'Certid\u00f5es de nascimento ou comprovante de idade para todos os membros do domic\u00edlio.',
    social_security_cards: 'Cart\u00f5es do Seguro Social para todos os membros do domic\u00edlio que os possuam.',
    immigration_documents: 'Documentos de status de imigra\u00e7\u00e3o para membros do domic\u00edlio que n\u00e3o sejam cidad\u00e3os americanos.',
    medical_expense_documentation: 'Recibos ou cartas confirmando despesas m\u00e9dicas cont\u00ednuas para membros idosos ou com defici\u00eancia.',
    disability_documentation: 'Documenta\u00e7\u00e3o confirmando o status de defici\u00eancia de um membro do domic\u00edlio.',
    childcare_receipts: 'Recibos de provedores de cuidados infantis licenciados para membros do domic\u00edlio que trabalham.',
  },
};

export function getFormDescription(language: Language, formId: string): string {
  return FORM_DESCRIPTIONS[language]?.[formId] ?? FORM_DESCRIPTIONS.en[formId] ?? formId;
}

export function getUploadDescription(language: Language, categoryKey: string): string {
  return UPLOAD_DESCRIPTIONS[language]?.[categoryKey] ?? UPLOAD_DESCRIPTIONS.en[categoryKey] ?? categoryKey;
}
