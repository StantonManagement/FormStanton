/**
 * lib/pbv/cards/docContent.ts
 *
 * Plain-language content registry for the PBV document card stack (PRD-42).
 * Consolidates titles, descriptions, and fallback help text per doc_type.
 *
 * Sources:
 * - Extends lib/pbv/docTypeHelp.ts with short titles
 * - Maps 34 doc types to mobile-friendly plain language
 */

export type SupportedLanguage = 'en' | 'es' | 'pt';

export interface DocContent {
  /** Short plain-language title for card header (3-5 words max) */
  title: Record<SupportedLanguage, string>;
  /** 2-3 sentence plain-language description */
  description: Record<SupportedLanguage, string>;
  /** Fallback guidance if tenant doesn't have this doc */
  fallback: Record<SupportedLanguage, string>;
  /** Whether this doc type can accept multiple files (paystubs, bank statements) */
  multiFile: boolean;
  /** Max pages/files for multi-file docs */
  maxFiles?: number;
}

/**
 * Content for all document types in the PBV application.
 * TODO: Complete es and pt translations.
 */
export const DOC_CONTENT: Record<string, DocContent> = {
  // ─── INCOME (10 docs) ──────────────────────────────────────────────────────
  paystubs: {
    title: {
      en: 'Your paystubs',
      es: 'Sus talones de pago',
      pt: 'Seus holerites',
    },
    description: {
      en: 'Recent pay statements showing your earnings and deductions. We need the last 4 weekly or 2 bi-weekly stubs from your employer.',
      es: 'Talonarios de pago recientes que muestren sus ingresos y deducciones. Necesitamos los últimos 4 semanales o 2 quincenales.',
      pt: 'Holerites recentes mostrando seus ganhos e deduções. Precisamos dos últimos 4 semanais ou 2 quinzenais.',
    },
    fallback: {
      en: "Ask your employer to email them or print from your employee portal. If you can't get these, tap 'I'll get this later'.",
      es: "Pídale a su empleador que los envíe por correo electrónico o imprima desde su portal. Si no puede obtenerlos, toque 'Lo conseguiré más tarde'.",
      pt: "Peça ao seu empregador para enviá-los por e-mail ou imprimir do portal. Se não conseguir, toque em 'Vou pegar isso depois'.",
    },
    multiFile: true,
    maxFiles: 4,
  },

  pension_letter: {
    title: {
      en: 'Pension letter',
      es: 'Carta de pensión',
      pt: 'Carta de pensão',
    },
    description: {
      en: 'Official letter from your pension plan showing your monthly benefit amount. This confirms income if you receive pension benefits.',
      es: 'Carta oficial de su plan de pensión mostrando el monto mensual de su beneficio.',
      pt: 'Carta oficial do seu plano de pensão mostrando o valor mensal do benefício.',
    },
    fallback: {
      en: "Contact your pension plan administrator or Railroad Retirement Board. If you can't get this, tap 'I'll get this later'.",
      es: 'Comuníquese con el administrador de su plan de pensiones.',
      pt: 'Entre em contato com o administrador do seu plano de pensão.',
    },
    multiFile: false,
  },

  ssi_award_letter: {
    title: {
      en: 'SSI award letter',
      es: 'Carta de adjudicación de SSI',
      pt: 'Carta de concessão do SSI',
    },
    description: {
      en: 'The letter from Social Security showing your monthly SSI benefit. Usually mailed each November or available at ssa.gov/myaccount.',
      es: 'La carta del Seguro Social que muestra su beneficio mensual de SSI.',
      pt: 'A carta do Seguro Social mostrando seu benefício mensal do SSI.',
    },
    fallback: {
      en: "Call 1-800-772-1213 or visit ssa.gov/myaccount. If you can't get this, tap 'I'll get this later'.",
      es: 'Llame al 1-800-772-1213 o visite ssa.gov/myaccount.',
      pt: 'Ligue para 1-800-772-1213 ou visite ssa.gov/myaccount.',
    },
    multiFile: false,
  },

  ss_award_letter: {
    title: {
      en: 'Social Security letter',
      es: 'Carta del Seguro Social',
      pt: 'Carta do Seguro Social',
    },
    description: {
      en: 'Letter showing your monthly Social Security retirement, disability, or survivor benefits.',
      es: 'Carta que muestra sus beneficios mensuales de jubilación, discapacidad o supervivencia del Seguro Social.',
      pt: 'Carta mostrando seus benefícios mensais de aposentadoria, invalidez ou sobrevivência do Seguro Social.',
    },
    fallback: {
      en: "Download at ssa.gov/myaccount or call 1-800-772-1213. If you can't get this, tap 'I'll get this later'.",
      es: 'Descargue en ssa.gov/myaccount o llame al 1-800-772-1213.',
      pt: 'Baixe em ssa.gov/myaccount ou ligue para 1-800-772-1213.',
    },
    multiFile: false,
  },

  child_support_docs: {
    title: {
      en: 'Child support documents',
      es: 'Documentos de manutención infantil',
      pt: 'Documentos de pensão alimentícia',
    },
    description: {
      en: 'Court order or payment history showing child support you pay or receive. Include 12 months of documentation.',
      es: 'Orden judicial o historial de pagos que muestren manutención infantil que paga o recibe.',
      pt: 'Ordem judicial ou histórico de pagamentos mostrando pensão alimentícia que você paga ou recebe.',
    },
    fallback: {
      en: "Request from your state's child support agency or use bank statements showing transfers. If you don't have this, tap 'Doesn't apply to me'.",
      es: 'Solicite a la agencia de manutención infantil de su estado.',
      pt: 'Solicite à agência de pensão alimentícia do seu estado.',
    },
    multiFile: true,
    maxFiles: 3,
  },

  tanf_letter: {
    title: {
      en: 'TANF/SNAP letter',
      es: 'Carta de TANF/SNAP',
      pt: 'Carta TANF/SNAP',
    },
    description: {
      en: 'Award letter from your state showing TANF (cash assistance) or SNAP (food stamps) benefits.',
      es: 'Carta de adjudicación de su estado mostrando beneficios de TANF o SNAP.',
      pt: 'Carta de concessão do seu estado mostrando benefícios do TANF ou SNAP.',
    },
    fallback: {
      en: "Contact your caseworker or state benefits office. If you can't get this, tap 'I'll get this later'.",
      es: 'Comuníquese con su trabajador social u oficina de beneficios estatales.',
      pt: 'Entre em contato com seu assistente social ou escritório de benefícios estadual.',
    },
    multiFile: false,
  },

  unemployment_letter: {
    title: {
      en: 'Unemployment letter',
      es: 'Carta de desempleo',
      pt: 'Carta de desemprego',
    },
    description: {
      en: 'Award letter from unemployment office or workers compensation showing your weekly benefit amount.',
      es: 'Carta de adjudicación de la oficina de desempleo mostrando su beneficio semanal.',
      pt: 'Carta de concessão do escritório de desemprego mostrando seu benefício semanal.',
    },
    fallback: {
      en: "Download from your state UI portal or call the claims line. If you can't get this, tap 'I'll get this later'.",
      es: 'Descargue desde el portal de UI de su estado o llame a la línea de reclamos.',
      pt: 'Baixe do portal de UI do seu estado ou ligue para a linha de reivindicações.',
    },
    multiFile: false,
  },

  self_employment_docs: {
    title: {
      en: 'Self-employment docs',
      es: 'Documentos de trabajo por cuenta propia',
      pt: 'Documentos de trabalho autônomo',
    },
    description: {
      en: 'Your self-employment contract AND earnings statement for the past 3-6 months. Can be invoices, 1099s, or bank deposits.',
      es: 'Su contrato de trabajo por cuenta propia Y declaración de ingresos de los últimos 3-6 meses.',
      pt: 'Seu contrato de trabalho autônomo E demonstrativo de rendimentos dos últimos 3-6 meses.',
    },
    fallback: {
      en: "Use invoices, 1099s, or bank statements showing business deposits. If you don't have these, tap 'I'll get this later'.",
      es: 'Use facturas, 1099s o estados de cuenta bancarios.',
      pt: 'Use faturas, 1099s ou extratos bancários.',
    },
    multiFile: true,
    maxFiles: 3,
  },

  training_letter: {
    title: {
      en: 'Training grant letter',
      es: 'Carta de beca de capacitación',
      pt: 'Carta de bolsa de treinamento',
    },
    description: {
      en: 'Documentation from your training program, school, or grant provider showing assistance you receive.',
      es: 'Documentación de su programa de capacitación o proveedor de becas mostrando la asistencia que recibe.',
      pt: 'Documentação do seu programa de treinamento ou provedor de bolsa mostrando a assistência que você recebe.',
    },
    fallback: {
      en: "Request from your school financial aid office or training provider. If you can't get this, tap 'I'll get this later'.",
      es: 'Solicite a la oficina de ayuda financiera de su escuela.',
      pt: 'Solicite ao escritório de ajuda financeira da sua escola.',
    },
    multiFile: false,
  },

  digital_payment_statements: {
    title: {
      en: 'Digital payment records',
      es: 'Registros de pagos digitales',
      pt: 'Registros de pagamentos digitais',
    },
    description: {
      en: 'Screenshots or PDFs from Cash App, Zelle, Venmo, or PayPal showing income received. Download 2 months of activity.',
      es: 'Capturas de pantalla o PDFs de Cash App, Zelle, Venmo o PayPal mostrando ingresos recibidos.',
      pt: 'Screenshots ou PDFs do Cash App, Zelle, Venmo ou PayPal mostrando renda recebida.',
    },
    fallback: {
      en: "Download activity from your payment app. Circle income payments. If you don't have these, tap 'I'll get this later'.",
      es: 'Descargue la actividad de su aplicación de pagos.',
      pt: 'Baixe a atividade do seu aplicativo de pagamentos.',
    },
    multiFile: true,
    maxFiles: 2,
  },

  // ─── ASSETS (5 docs) ──────────────────────────────────────────────────────
  bank_statement_savings: {
    title: {
      en: 'Savings account statement',
      es: 'Estado de cuenta de ahorros',
      pt: 'Extrato de poupança',
    },
    description: {
      en: 'Your most recent monthly savings statement showing balance and transactions. All pages required.',
      es: 'Su estado de cuenta de ahorros mensual más reciente mostrando saldo y transacciones.',
      pt: 'Seu extrato mensal de poupança mais recente mostrando saldo e transações.',
    },
    fallback: {
      en: "Download from your bank's website or mobile app. If you can't get this, tap 'I'll get this later'.",
      es: 'Descargue del sitio web o aplicación móvil de su banco.',
      pt: 'Baixe do site ou aplicativo móvel do seu banco.',
    },
    multiFile: false,
  },

  bank_statement_checking: {
    title: {
      en: 'Checking account statement',
      es: 'Estado de cuenta de cheques',
      pt: 'Extrato de conta corrente',
    },
    description: {
      en: 'Your most recent monthly checking statement showing deposits, withdrawals, and balance.',
      es: 'Su estado de cuenta de cheques mensual más reciente mostrando depósitos, retiros y saldo.',
      pt: 'Seu extrato mensal de conta corrente mais recente mostrando depósitos, retiradas e saldo.',
    },
    fallback: {
      en: "Download from your bank's website or mobile app. If you can't get this, tap 'I'll get this later'.",
      es: 'Descargue del sitio web o aplicación móvil de su banco.',
      pt: 'Baixe do site ou aplicativo móvel do seu banco.',
    },
    multiFile: false,
  },

  insurance_settlement: {
    title: {
      en: 'Insurance settlement',
      es: 'Liquidación de seguro',
      pt: 'Acordo de seguro',
    },
    description: {
      en: 'Letter from your insurance company showing any settlement payments you receive.',
      es: 'Carta de su compañía de seguros mostrando cualquier pago de liquidación que reciba.',
      pt: 'Carta da sua companhia de seguros mostrando qualquer pagamento de acordo que você receba.',
    },
    fallback: {
      en: "Request from your insurance company. If this doesn't apply, tap 'Doesn't apply to me'.",
      es: 'Solicite a su compañía de seguros.',
      pt: 'Solicite à sua companhia de seguros.',
    },
    multiFile: false,
  },

  cd_trust_bond: {
    title: {
      en: 'CD, trust, or bond',
      es: 'CD, fideicomiso o bono',
      pt: 'CD, trust ou título',
    },
    description: {
      en: 'Statements for Certificates of Deposit, trust accounts, or bonds you own. Shows current value and your name as owner.',
      es: 'Estados de cuenta para certificados de depósito, cuentas fiduciarias o bonos que posea.',
      pt: 'Extratos para certificados de depósito, contas de trust ou títulos que você possui.',
    },
    fallback: {
      en: "Request from your bank or broker. If you don't own these, tap 'Doesn't apply to me'.",
      es: 'Solicite a su banco o corredor.',
      pt: 'Solicite ao seu banco ou corretor.',
    },
    multiFile: true,
    maxFiles: 3,
  },

  life_insurance_policy: {
    title: {
      en: 'Life insurance policy',
      es: 'Póliza de seguro de vida',
      pt: 'Apólice de seguro de vida',
    },
    description: {
      en: 'Your life insurance policy showing cash surrender value, if any. Term life policies typically have no cash value.',
      es: 'Su póliza de seguro de vida mostrando el valor de rescate en efectivo, si lo tiene.',
      pt: 'Sua apólice de seguro de vida mostrando o valor de resgate, se houver.',
    },
    fallback: {
      en: "Contact your insurance agent if unsure. If you don't have life insurance, tap 'Doesn't apply to me'.",
      es: 'Comuníquese con su agente de seguros.',
      pt: 'Entre em contato com seu corretor de seguros.',
    },
    multiFile: false,
  },

  // ─── MEDICAL & CHILDCARE (3 docs) ─────────────────────────────────────────
  medical_bills: {
    title: {
      en: 'Medical bills',
      es: 'Facturas médicas',
      pt: 'Contas médicas',
    },
    description: {
      en: 'Doctor bills, hospital statements, or receipts for medical expenses in the last 12 months not covered by insurance.',
      es: 'Facturas de médicos, estados de cuenta de hospital o recibos de gastos médicos en los últimos 12 meses.',
      pt: 'Contas de médicos, extratos de hospital ou recibos de despesas médicas nos últimos 12 meses.',
    },
    fallback: {
      en: "Gather any medical receipts you have. If you don't have medical expenses, tap 'Doesn't apply to me'.",
      es: 'Reúna cualquier recibo médico que tenga.',
      pt: 'Junte quaisquer recibos médicos que você tenha.',
    },
    multiFile: true,
    maxFiles: 5,
  },

  pharmacy_statements: {
    title: {
      en: 'Pharmacy receipts',
      es: 'Recibos de farmacia',
      pt: 'Recibos de farmácia',
    },
    description: {
      en: 'Pharmacy receipts or printouts showing prescription medication costs in the last 12 months.',
      es: 'Recibos de farmacia o extractos mostrando costos de medicamentos recetados en los últimos 12 meses.',
      pt: 'Recibos de farmácia ou extratos mostrando custos de medicamentos prescritos nos últimos 12 meses.',
    },
    fallback: {
      en: "Request from your pharmacy or use prescription discount app history. If you don't have these, tap 'Doesn't apply to me'.",
      es: 'Solicite a su farmacia o use el historial de la aplicación de descuentos.',
      pt: 'Solicite à sua farmácia ou use o histórico do aplicativo de desconto.',
    },
    multiFile: true,
    maxFiles: 3,
  },

  care4kids_certificate: {
    title: {
      en: 'Childcare documents',
      es: 'Documentos de cuidado infantil',
      pt: 'Documentos de creche',
    },
    description: {
      en: 'Care 4 Kids certificate, childcare provider letter, or receipts showing childcare expenses.',
      es: 'Certificado de Care 4 Kids, carta del proveedor de cuidado infantil o recibos mostrando gastos de cuidado infantil.',
      pt: 'Certificado Care 4 Kids, carta do provedor de creche ou recibos mostrando despesas de creche.',
    },
    fallback: {
      en: "Request from your childcare provider. If you don't pay for childcare, tap 'Doesn't apply to me'.",
      es: 'Solicite a su proveedor de cuidado infantil.',
      pt: 'Solicite ao seu provedor de creche.',
    },
    multiFile: true,
    maxFiles: 2,
  },

  // ─── IMMIGRATION (2 docs) ────────────────────────────────────────────────
  immigration_docs: {
    title: {
      en: 'Immigration documents',
      es: 'Documentos de inmigración',
      pt: 'Documentos de imigração',
    },
    description: {
      en: 'USCIS documents proving immigration status: Green Card, I-94, or Employment Authorization. Include front and back.',
      es: 'Documentos de USCIS que prueban estado migratorio: Green Card, I-94 o Autorización de Empleo.',
      pt: 'Documentos do USCIS provando status de imigração: Green Card, I-94 ou Autorização de Trabalho.',
    },
    fallback: {
      en: "These are required for non-citizens. If you're a US citizen, this will be marked differently. Contact us if you need help.",
      es: 'Estos son requeridos para no ciudadanos.',
      pt: 'Estes são necessários para não cidadãos.',
    },
    multiFile: true,
    maxFiles: 2,
  },

  proof_of_age_noncitizen: {
    title: {
      en: 'Proof of age (non-citizen)',
      es: 'Prueba de edad (no ciudadano)',
      pt: 'Prova de idade (não cidadão)',
    },
    description: {
      en: 'Birth certificate, passport, or official ID showing date of birth for non-citizen household members age 62+.',
      es: 'Certificado de nacimiento, pasaporte o identificación oficial mostrando fecha de nacimiento.',
      pt: 'Certidão de nascimento, passaporte ou identificação oficial mostrando data de nascimento.',
    },
    fallback: {
      en: "Required for elderly non-citizens. If this doesn't apply, tap 'Doesn't apply to me'.",
      es: 'Requerido para ancianos no ciudadanos.',
      pt: 'Necessário para idosos não cidadãos.',
    },
    multiFile: false,
  },

  // ─── SIGNED FORMS (14 docs) ───────────────────────────────────────────────
  main_application: {
    title: {
      en: 'Main application form',
      es: 'Formulario de solicitud principal',
      pt: 'Formulário principal de inscrição',
    },
    description: {
      en: 'The completed PBV application form with all sections filled out and signed by the head of household.',
      es: 'El formulario de solicitud PBV completado con todas las secciones llenas y firmadas.',
      pt: 'O formulário de inscrição PBV completo com todas as seções preenchidas e assinadas.',
    },
    fallback: {
      en: "We'll provide this form for you to sign after your documents are reviewed.",
      es: 'Le proporcionaremos este formulario para firmar después de revisar sus documentos.',
      pt: 'Forneceremos este formulário para você assinar após a revisão dos seus documentos.',
    },
    multiFile: false,
  },

  criminal_background_release: {
    title: {
      en: 'Background check release',
      es: 'Autorización de verificación de antecedentes',
      pt: 'Autorização de verificação de antecedentes',
    },
    description: {
      en: 'Authorization allowing Stanton and HACH to conduct a criminal background check for all adult household members.',
      es: 'Autorización permitiendo a Stanton y HACH conducir una verificación de antecedentes penales.',
      pt: 'Autorização permitindo que Stanton e HACH conduzam uma verificação de antecedentes criminais.',
    },
    fallback: {
      en: "We'll provide this form for you to sign. Required for all adult household members.",
      es: 'Le proporcionaremos este formulario para firmar.',
      pt: 'Forneceremos este formulário para você assinar.',
    },
    multiFile: false,
  },

  child_support_affidavit: {
    title: {
      en: 'Child support affidavit',
      es: 'Declaración jurada de manutención infantil',
      pt: 'Declaração juramentada de pensão alimentícia',
    },
    description: {
      en: 'Sworn statement declaring child support you pay or receive. Complete this if you have a child support order.',
      es: 'Declaración jurada declarando manutención infantil que paga o recibe.',
      pt: 'Declaração juramentada declarando pensão alimentícia que você paga ou recebe.',
    },
    fallback: {
      en: "We'll provide this form. Alternative to 'No Child Support Affidavit' — choose the one that applies.",
      es: 'Le proporcionaremos este formulario.',
      pt: 'Forneceremos este formulário.',
    },
    multiFile: false,
  },

  no_child_support_affidavit: {
    title: {
      en: 'No child support affidavit',
      es: 'Declaración jurada de no manutención infantil',
      pt: 'Declaração juramentada sem pensão alimentícia',
    },
    description: {
      en: 'Sworn statement certifying you do NOT pay or receive child support. Only complete if the other affidavit does not apply.',
      es: 'Declaración jurada certificando que NO paga o recibe manutención infantil.',
      pt: 'Declaração juramentada certificando que você NÃO paga ou recebe pensão alimentícia.',
    },
    fallback: {
      en: "We'll provide this form. Only complete if you truly don't have any child support.",
      es: 'Le proporcionaremos este formulario.',
      pt: 'Forneceremos este formulário.',
    },
    multiFile: false,
  },

  hud_9886a: {
    title: {
      en: 'HUD income release form',
      es: 'Formulario HUD de liberación de ingresos',
      pt: 'Formulário HUD de liberação de renda',
    },
    description: {
      en: 'HUD form authorizing release of income and employment information to Stanton and HACH. Required federal form.',
      es: 'Formulario HUD autorizando liberación de información de ingresos a Stanton y HACH.',
      pt: 'Formulário HUD autorizando liberação de informações de renda para Stanton e HACH.',
    },
    fallback: {
      en: "We'll provide this form for you to sign. This is a required federal form.",
      es: 'Le proporcionaremos este formulario para firmar.',
      pt: 'Forneceremos este formulário para você assinar.',
    },
    multiFile: false,
  },

  hach_release: {
    title: {
      en: 'HACH release form',
      es: 'Formulario de liberación de HACH',
      pt: 'Formulário de liberação HACH',
    },
    description: {
      en: 'Authorization letting HACH verify your income and household information directly with banks and employers.',
      es: 'Autorización permitiendo a HACH verificar sus ingresos directamente con bancos y empleadores.',
      pt: 'Autorização permitindo que HACH verifique sua renda diretamente com bancos e empregadores.',
    },
    fallback: {
      en: "We'll provide this form for you to sign. This helps speed up your application.",
      es: 'Le proporcionaremos este formulario para firmar.',
      pt: 'Forneceremos este formulário para você assinar.',
    },
    multiFile: false,
  },

  obligations_of_family: {
    title: {
      en: 'Family obligations form',
      es: 'Formulario de obligaciones familiares',
      pt: 'Formulário de obrigações familiares',
    },
    description: {
      en: 'Form acknowledging your responsibilities as a PBV tenant and member of the household. Explains program rules.',
      es: 'Formulario reconociendo sus responsabilidades como inquilino PBV y miembro del hogar.',
      pt: 'Formulário reconhecendo suas responsabilidades como inquilino PBV e membro da família.',
    },
    fallback: {
      en: "We'll provide this form for you to sign. This explains the program rules.",
      es: 'Le proporcionaremos este formulario para firmar.',
      pt: 'Forneceremos este formulário para você assinar.',
    },
    multiFile: false,
  },

  briefing_docs_certification: {
    title: {
      en: 'Briefing certification',
      es: 'Certificación de sesión informativa',
      pt: 'Certificação de orientação',
    },
    description: {
      en: 'Certification that you received and understand the program briefing documents. Confirms you were informed about PBV rules.',
      es: 'Certificación de que recibió y entiende los documentos de la sesión informativa del programa.',
      pt: 'Certificação de que você recebeu e entendeu os documentos de orientação do programa.',
    },
    fallback: {
      en: "We'll provide this form for you to sign after your briefing.",
      es: 'Le proporcionaremos este formulario para firmar después de su sesión informativa.',
      pt: 'Forneceremos este formulário para você assinar após sua orientação.',
    },
    multiFile: false,
  },

  debts_owed_phas: {
    title: {
      en: 'Debts to housing agencies',
      es: 'Deudas a agencias de vivienda',
      pt: 'Dívidas com agências de habitação',
    },
    description: {
      en: 'HUD-52675 form disclosing any money you owe to Public Housing Agencies. Must list all PHAs and amounts.',
      es: 'Formulario HUD-52675 divulgando cualquier dinero que deba a Agencias de Vivienda Pública.',
      pt: 'Formulário HUD-52675 divulgando qualquer dinheiro que você deva a Agências de Habitação Pública.',
    },
    fallback: {
      en: "We'll provide this form. Required even if you owe $0 — check the 'no debts' box.",
      es: 'Le proporcionaremos este formulario.',
      pt: 'Forneceremos este formulário.',
    },
    multiFile: false,
  },

  citizenship_declaration: {
    title: {
      en: 'Citizenship declaration',
      es: 'Declaración de ciudadanía',
      pt: 'Declaração de cidadania',
    },
    description: {
      en: 'Declaration of US citizenship or eligible immigration status for each household member. Separate form per person.',
      es: 'Declaración de ciudadanía estadounidense o estado migratorio elegible para cada miembro del hogar.',
      pt: 'Declaração de cidadania americana ou status de imigração elegível para cada membro da família.',
    },
    fallback: {
      en: "We'll provide this form for each household member to sign. Required for every person in the household.",
      es: 'Le proporcionaremos este formulario para que cada miembro del hogar firme.',
      pt: 'Forneceremos este formulário para cada membro da família assinar.',
    },
    multiFile: false,
  },

  eiv_guide_receipt: {
    title: {
      en: 'Income verification receipt',
      es: 'Recibo de verificación de ingresos',
      pt: 'Recibo de verificação de renda',
    },
    description: {
      en: 'Acknowledgment that you received and understand the Enterprise Income Verification (EIV) guide.',
      es: 'Reconocimiento de que recibió y entiende la guía de Verificación de Ingresos Empresarial (EIV).',
      pt: 'Reconhecimento de que você recebeu e entendeu o guia de Verificação de Renda Empresarial (EIV).',
    },
    fallback: {
      en: "We'll provide this form for you to sign. This explains how we verify income electronically.",
      es: 'Le proporcionaremos este formulario para firmar.',
      pt: 'Forneceremos este formulário para você assinar.',
    },
    multiFile: false,
  },

  hud_92006: {
    title: {
      en: 'Supplemental contact form',
      es: 'Formulario de contacto suplementario',
      pt: 'Formulário de contato suplementar',
    },
    description: {
      en: 'HUD Supplemental Contact Form with additional household information, emergency contacts, and other details.',
      es: 'Formulario de Contacto Suplementario HUD con información adicional del hogar y contactos de emergencia.',
      pt: 'Formulário de Contato Suplementar HUD com informações adicionais da família e contatos de emergência.',
    },
    fallback: {
      en: "We'll provide this form for you to complete. This captures additional household details.",
      es: 'Le proporcionaremos este formulario para completar.',
      pt: 'Forneceremos este formulário para você completar.',
    },
    multiFile: false,
  },

  vawa_certification: {
    title: {
      en: 'VAWA certification',
      es: 'Certificación VAWA',
      pt: 'Certificação VAWA',
    },
    description: {
      en: 'VAWA (Violence Against Women Act) certification form. Optional. Used if you need emergency transfer due to domestic violence.',
      es: 'Formulario de certificación VAWA (Ley de Violencia contra la Mujer). Opcional.',
      pt: 'Formulário de certificação VAWA (Lei de Violência contra a Mulher). Opcional.',
    },
    fallback: {
      en: "Optional form. Only complete if you need emergency transfer due to domestic violence, dating violence, sexual assault, or stalking.",
      es: 'Formulario opcional.',
      pt: 'Formulário opcional.',
    },
    multiFile: false,
  },

  reasonable_accommodation_request: {
    title: {
      en: 'Accommodation request',
      es: 'Solicitud de acomodación',
      pt: 'Solicitação de acomodação',
    },
    description: {
      en: 'Form to request disability-related reasonable accommodations or modifications to the unit or program. Optional.',
      es: 'Formulario para solicitar acomodaciones razonables relacionadas con discapacidad. Opcional.',
      pt: 'Formulário para solicitar acomodações razoáveis relacionadas a deficiência. Opcional.',
    },
    fallback: {
      en: "Optional form. Use if you or a household member have a disability requiring accommodation.",
      es: 'Formulario opcional.',
      pt: 'Formulário opcional.',
    },
    multiFile: false,
  },
};

/**
 * Get content for a document type in the specified language.
 * Falls back to English if translation is missing.
 */
export function getDocContent(docType: string, lang: SupportedLanguage): DocContent | null {
  const content = DOC_CONTENT[docType];
  if (!content) {
    return null;
  }

  // If translation is missing, fall back to English
  const safeLang = content.title[lang] ? lang : 'en';

  return {
    ...content,
    title: {
      [lang]: content.title[safeLang] || content.title.en,
    } as Record<SupportedLanguage, string>,
    description: {
      [lang]: content.description[safeLang] || content.description.en,
    } as Record<SupportedLanguage, string>,
    fallback: {
      [lang]: content.fallback[safeLang] || content.fallback.en,
    } as Record<SupportedLanguage, string>,
  };
}

/**
 * Check if a document type supports multiple files.
 */
export function isMultiFileDoc(docType: string): boolean {
  return DOC_CONTENT[docType]?.multiFile ?? false;
}

/**
 * Get max files for a document type.
 */
export function getMaxFiles(docType: string): number {
  return DOC_CONTENT[docType]?.maxFiles ?? 1;
}

/**
 * Get short title for a document type.
 */
export function getDocTitle(docType: string, lang: SupportedLanguage): string {
  return DOC_CONTENT[docType]?.title[lang] ?? DOC_CONTENT[docType]?.title.en ?? docType;
}

/**
 * Get description for a document type.
 */
export function getDocDescription(docType: string, lang: SupportedLanguage): string {
  return DOC_CONTENT[docType]?.description[lang] ?? DOC_CONTENT[docType]?.description.en ?? '';
}
