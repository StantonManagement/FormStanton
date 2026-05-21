/**
 * lib/pbv/docTypeHelp.ts
 * 
 * Plain-language help text for each document type in the PBV full application.
 * F3 of PRD-41.
 * 
 * Sources:
 * - Query: SELECT doc_type, label, category, required FROM form_document_templates 
 *          WHERE form_id = 'pbv-full-application' ORDER BY display_order;
 * - 34 doc types total (22 required, 12 optional)
 */

export type DocHelpText = { 
  en: string; 
  es: string; 
  pt: string;
};

/**
 * Help content for all document types.
 * PRD-59: EN/ES/PT translations complete. ES/PT modeled on docContent.ts tone.
 */
export const DOC_TYPE_HELP: Record<string, DocHelpText> = {
  // ─── IDENTITY (1 doc — PRD-65) ────────────────────────────────────────────
  government_id: {
    en: "A current government-issued photo ID for the head of household — driver's license, state ID, or passport. Scan both the front and the back as a single 2-page document. If the ID has no information on the back (a passport, for example), scan just the page with your photo.",
    es: "Una identificación con foto emitida por el gobierno y vigente para el jefe de hogar — licencia de conducir, identificación estatal o pasaporte. Escanee tanto el frente como el reverso como un solo documento de 2 páginas. Si la identificación no tiene información en el reverso (como un pasaporte), escanee solo la página con su foto.",
    pt: "Uma identidade com foto emitida pelo governo e válida para o chefe da família — carteira de motorista, identidade estadual ou passaporte. Escaneie tanto a frente quanto o verso como um único documento de 2 páginas. Se a identidade não tiver informações no verso (um passaporte, por exemplo), escaneie apenas a página com sua foto.",
  },

  // ─── INCOME (10 docs) ──────────────────────────────────────────────────────
  paystubs: {
    en: "Your most recent pay statements showing earnings, deductions, and YTD totals. Ask your employer for the last 4 weekly stubs or 2 bi-weekly stubs. Most employers can email these or print from your employee portal.",
    es: "Tus talones de pago más recientes que muestren ingresos, deducciones y totales del año. Pídele a tu empleador los últimos 4 semanales o 2 quincenales. La mayoría puede enviarlos por correo electrónico o imprimirlos del portal de empleados.",
    pt: "Seus holerites mais recentes mostrando ganhos, deduções e totais do ano. Peça ao seu empregador os últimos 4 semanais ou 2 quinzenais. A maioria pode enviá-los por e-mail ou imprimir do portal do funcionário.",
  },
  pension_letter: {
    en: "Official letter from your pension plan or Railroad Retirement Board showing your monthly benefit amount. This verifies income for retired applicants receiving pension benefits.",
    es: "Carta oficial de tu plan de pensión mostrando tu monto mensual de beneficio. Esto verifica los ingresos de solicitantes jubilados que reciben beneficios de pensión.",
    pt: "Carta oficial do seu plano de pensão mostrando seu valor mensal de benefício. Isso verifica a renda de solicitantes aposentados que recebem benefícios de pensão.",
  },
  ssi_award_letter: {
    en: "The letter from Social Security stating your monthly SSI benefit amount. Usually mailed each year in November. You can also download from ssa.gov/myaccount or call 1-800-772-1213.",
    es: "La carta del Seguro Social que indica tu monto mensual de beneficio de SSI. Generalmente se envía por correo cada año en noviembre. También puedes descargarla de ssa.gov/myaccount o llamar al 1-800-772-1213.",
    pt: "A carta do Seguro Social indicando seu valor mensal de benefício do SSI. Geralmente enviada por correio a cada ano em novembro. Você também pode baixar em ssa.gov/myaccount ou ligar para 1-800-772-1213.",
  },
  ss_award_letter: {
    en: "The letter from Social Security Administration showing your monthly retirement, disability, or survivor benefits. Download at ssa.gov/myaccount or call 1-800-772-1213 to request a copy.",
    es: "La carta de la Administración del Seguro Social que muestra tus beneficios mensuales de jubilación, discapacidad o sobrevivencia. Descárgala en ssa.gov/myaccount o llama al 1-800-772-1213 para solicitar una copia.",
    pt: "A carta da Administração do Seguro Social mostrando seus benefícios mensais de aposentadoria, invalidez ou sobrevivência. Baixe em ssa.gov/myaccount ou ligue para 1-800-772-1213 para solicitar uma cópia.",
  },
  child_support_docs: {
    en: "Court order or payment history showing child support you pay or receive. Include 12 months of documentation from your state's child support agency or bank statements showing automatic transfers.",
    es: "Orden judicial o historial de pagos que muestren manutención infantil que pagas o recibes. Incluye 12 meses de documentación de la agencia de manutención infantil de tu estado o estados de cuenta bancarios que muestren transferencias automáticas.",
    pt: "Ordem judicial ou histórico de pagamentos mostrando pensão alimentícia que você paga ou recebe. Inclua 12 meses de documentação da agência de pensão alimentícia do seu estado ou extratos bancários mostrando transferências automáticas.",
  },
  tanf_letter: {
    en: "Official award letter from your state's TANF (cash assistance) or SNAP (food stamps) program. Shows your monthly benefit amount and case number. Contact your caseworker if you don't have this.",
    es: "Carta oficial de adjudicación del programa TANF (asistencia en efectivo) o SNAP (cupones de alimentos) de tu estado. Muestra tu monto mensual de beneficio y número de caso. Comuníquese con tu trabajador social si no tienes esto.",
    pt: "Carta oficial de concessão do programa TANF (assistência em dinheiro) ou SNAP (vale-alimentação) do seu estado. Mostra seu valor mensal de benefício e número de caso. Entre em contato com seu assistente social se você não tiver isso.",
  },
  unemployment_letter: {
    en: "Award letter from your state's unemployment office or workers compensation carrier. Shows weekly benefit amount and claim duration. Download from your state UI portal or call the claims line.",
    es: "Carta de adjudicación de la oficina de desempleo de tu estado o del seguro de compensación por accidentes laborales. Muestra el monto semanal de beneficio y duración del reclamo. Descárgala del portal de UI de tu estado o llama a la línea de reclamos.",
    pt: "Carta de concessão do escritório de desemprego do seu estado ou da seguradora de compensação por acidentes de trabalho. Mostra o valor semanal do benefício e duração do pedido. Baixe do portal de UI do seu estado ou ligue para a linha de reivindicações.",
  },
  self_employment_docs: {
    en: "Your self-employment contract AND an earnings statement showing income for the past 3-6 months. Can be invoices, 1099s, bank deposits, or a profit/loss statement you prepare.",
    es: "Tu contrato de trabajo por cuenta propia Y una declaración de ingresos que muestre ingresos de los últimos 3-6 meses. Puede ser facturas, 1099s, depósitos bancarios o una declaración de ganancias/pérdidas que prepares.",
    pt: "Seu contrato de trabalho autônomo E um demonstrativo de rendimentos mostrando renda dos últimos 3-6 meses. Pode ser faturas, 1099s, depósitos bancários ou uma declaração de lucros/prejuízos que você prepare.",
  },
  training_letter: {
    en: "Documentation from your training program, school, or grant provider showing the type and amount of assistance you receive. Include award letters, enrollment verification, or grant award notices.",
    es: "Documentación de tu programa de capacitación, escuela o proveedor de becas mostrando el tipo y monto de asistencia que recibes. Incluye cartas de adjudicación, verificación de inscripción o avisos de adjudicación de becas.",
    pt: "Documentação do seu programa de treinamento, escola ou provedor de bolsa mostrando o tipo e valor da assistência que você recebe. Inclua cartas de concessão, comprovante de matrícula ou avisos de concessão de bolsas.",
  },
  digital_payment_statements: {
    en: "Screenshots or PDF statements from Cash App, Zelle, Venmo, or PayPal showing income received. Download 2 months of activity and circle/highlight payments you received for goods or services.",
    es: "Capturas de pantalla o estados de cuenta en PDF de Cash App, Zelle, Venmo o PayPal mostrando ingresos recibidos. Descarga 2 meses de actividad y encierra/resalta los pagos que recibiste por bienes o servicios.",
    pt: "Screenshots ou extratos em PDF do Cash App, Zelle, Venmo ou PayPal mostrando renda recebida. Baixe 2 meses de atividade e circule/destaque os pagamentos que você recebeu por bens ou serviços.",
  },

  // ─── ASSETS (5 docs) ──────────────────────────────────────────────────────
  bank_statement_savings: {
    en: "Your most recent monthly savings account statement showing all transactions, current balance, and account holder name. Download from your bank's website or mobile app. All pages required.",
    es: "Tu estado de cuenta mensual de ahorros más reciente que muestre todas las transacciones, saldo actual y nombre del titular. Descárgalo del sitio web o aplicación móvil de tu banco. Se requieren todas las páginas.",
    pt: "Seu extrato mensal de poupança mais recente mostrando todas as transações, saldo atual e nome do titular. Baixe do site ou aplicativo móvel do seu banco. Todas as páginas são necessárias.",
  },
  bank_statement_checking: {
    en: "Your most recent monthly checking account statement showing all deposits, withdrawals, and ending balance. Download from your bank's website or app. Must show your name and account number.",
    es: "Tu estado de cuenta mensual de cheques más reciente que muestre todos los depósitos, retiros y saldo final. Descárgalo del sitio web o aplicación de tu banco. Debe mostrar tu nombre y número de cuenta.",
    pt: "Seu extrato mensal de conta corrente mais recente mostrando todos os depósitos, retiradas e saldo final. Baixe do site ou aplicativo do seu banco. Deve mostrar seu nome e número da conta.",
  },
  insurance_settlement: {
    en: "Letter or documentation from your insurance company showing any settlement payments you receive (disability, accident, lawsuit, etc.). Shows payment schedule and total amount.",
    es: "Carta o documentación de tu compañía de seguros mostrando cualquier pago de liquidación que recibas (discapacidad, accidente, demanda, etc.). Muestra el calendario de pagos y monto total.",
    pt: "Carta ou documentação da sua companhia de seguros mostrando qualquer pagamento de acordo que você receba (invalidez, acidente, processo, etc.). Mostra o cronograma de pagamentos e valor total.",
  },
  cd_trust_bond: {
    en: "Statements for Certificates of Deposit (CDs), trust accounts, or bonds you own. Shows current value, maturity date, and your name as owner. Request from your bank or broker.",
    es: "Estados de cuenta para Certificados de Depósito (CDs), cuentas fiduciarias o bonos que poseas. Muestra el valor actual, fecha de vencimiento y tu nombre como propietario. Solicítalos de tu banco o corredor.",
    pt: "Extratos para Certificados de Depósito (CDs), contas de trust ou títulos que você possua. Mostra o valor atual, data de vencimento e seu nome como proprietário. Solicite do seu banco ou corretor.",
  },
  life_insurance_policy: {
    en: "Your life insurance policy document showing the cash surrender value (if any). Term life policies typically have no cash value. Contact your insurance agent if unsure.",
    es: "Tu documento de póliza de seguro de vida mostrando el valor de rescate en efectivo (si lo tiene). Las pólizas de seguro de vida a término típicamente no tienen valor en efectivo. Comuníquese con tu agente de seguros si tienes dudas.",
    pt: "Seu documento de apólice de seguro de vida mostrando o valor de resgate (se houver). Apólices de seguro de vida a termo normalmente não têm valor em dinheiro. Entre em contato com seu corretor de seguros se tiver dúvidas.",
  },

  // ─── MEDICAL & CHILDCARE (3 docs) ─────────────────────────────────────────
  medical_bills: {
    en: "Doctor bills, hospital statements, or receipts for medical expenses in the last 12 months that weren't covered by insurance. These may qualify you for medical expense deductions.",
    es: "Facturas de médicos, estados de cuenta de hospital o recibos de gastos médicos en los últimos 12 meses que no fueron cubiertos por seguro. Estos pueden calificarte para deducciones de gastos médicos.",
    pt: "Contas de médicos, extratos de hospital ou recibos de despesas médicas nos últimos 12 meses que não foram cobertos pelo seguro. Estes podem qualificá-lo para deduções de despesas médicas.",
  },
  pharmacy_statements: {
    en: "Pharmacy receipts or printouts showing prescription medication costs in the last 12 months. May include copays or full cost if uninsured. Helps with medical deductions.",
    es: "Recibos de farmacia o extractos mostrando costos de medicamentos recetados en los últimos 12 meses. Pueden incluir copagos o costo total si no tienes seguro. Ayuda con deducciones médicas.",
    pt: "Recibos de farmácia ou extratos mostrando custos de medicamentos prescritos nos últimos 12 meses. Podem incluir copagamentos ou custo total se não tiver seguro. Ajuda com deduções médicas.",
  },
  care4kids_certificate: {
    en: "Care 4 Kids certificate, childcare provider letter, or receipts showing childcare expenses. Include provider's name, address, Tax ID, amount paid, and dates of care.",
    es: "Certificado de Care 4 Kids, carta del proveedor de cuidado infantil o recibos mostrando gastos de cuidado infantil. Incluye el nombre del proveedor, dirección, ID de impuestos, monto pagado y fechas de cuidado.",
    pt: "Certificado Care 4 Kids, carta do provedor de creche ou recibos mostrando despesas de creche. Inclua o nome do provedor, endereço, ID fiscal, valor pago e datas de cuidado.",
  },

  // ─── IMMIGRATION (2 docs) ────────────────────────────────────────────────
  immigration_docs: {
    en: "USCIS documents proving your immigration status: Permanent Resident Card (I-551), Arrival/Departure Record (I-94), or Employment Authorization (I-688/I-688B). Include front and back copies.",
    es: "Documentos de USCIS que prueban tu estado migratorio: Tarjeta de Residente Permanente (I-551), Registro de Llegada/Salida (I-94), o Autorización de Empleo (I-688/I-688B). Incluye copias de frente y reverso.",
    pt: "Documentos do USCIS provando seu status de imigração: Cartão de Residente Permanente (I-551), Registro de Chegada/Saída (I-94), ou Autorização de Trabalho (I-688/I-688B). Inclua cópias da frente e verso.",
  },
  proof_of_age_noncitizen: {
    en: "Birth certificate, passport, or official ID showing date of birth for non-citizen household members age 62 or older. Required to verify eligibility for elderly provisions.",
    es: "Certificado de nacimiento, pasaporte o identificación oficial mostrando fecha de nacimiento para miembros del hogar no ciudadanos de 62 años o más. Requerido para verificar elegibilidad para disposiciones de ancianos.",
    pt: "Certidão de nascimento, passaporte ou identificação oficial mostrando data de nascimento para membros da família não cidadãos com 62 anos ou mais. Necessário para verificar elegibilidade para disposições de idosos.",
  },

  // ─── SIGNED FORMS (14 docs) ───────────────────────────────────────────────
  main_application: {
    en: "The completed PBV application form with all sections filled out and signed by the head of household. This is the primary application document.",
    es: "El formulario de solicitud PBV completado con todas las secciones llenas y firmadas por el jefe de hogar. Este es el documento de solicitud principal.",
    pt: "O formulário de inscrição PBV completo com todas as seções preenchidas e assinadas pelo chefe da família. Este é o documento de inscrição principal.",
  },
  criminal_background_release: {
    en: "Authorization form allowing Stanton and HACH to conduct a criminal background check. Required for all adult household members. Sign and date where indicated.",
    es: "Formulario de autorización permitiendo a Stanton y HACH conducir una verificación de antecedentes penales. Requerido para todos los miembros adultos del hogar. Firma y fecha donde se indica.",
    pt: "Formulário de autorização permitindo que Stanton e HACH conduzam uma verificação de antecedentes criminais. Necessário para todos os membros adultos da família. Assine e date onde indicado.",
  },
  child_support_affidavit: {
    en: "Sworn statement declaring child support you pay or receive. Complete this if you have a child support order or make/receive payments. Alternative to 'No Child Support Affidavit'.",
    es: "Declaración jurada declarando manutención infantil que pagas o recibes. Completa esto si tienes una orden de manutención infantil o haces/recibes pagos. Alternativa a 'Declaración de No Manutención Infantil'.",
    pt: "Declaração juramentada declarando pensão alimentícia que você paga ou recebe. Complete isto se você tiver uma ordem de pensão alimentícia ou fizer/receber pagamentos. Alternativa à 'Declaração Sem Pensão Alimentícia'.",
  },
  no_child_support_affidavit: {
    en: "Sworn statement certifying you do NOT pay or receive child support. Complete this only if the Child Support Affidavit doesn't apply to you. Sign and date.",
    es: "Declaración jurada certificando que NO pagas ni recibes manutención infantil. Completa esto solo si la Declaración de Manutención Infantil no aplica a ti. Firma y fecha.",
    pt: "Declaração juramentada certificando que você NÃO paga nem recebe pensão alimentícia. Complete isto apenas se a Declaração de Pensão Alimentícia não se aplicar a você. Assine e date.",
  },
  hud_9886a: {
    en: "HUD form authorizing release of income and employment information to Stanton and HACH. Required federal form — your signature allows verification with employers, banks, and government agencies.",
    es: "Formulario HUD autorizando liberación de información de ingresos y empleo a Stanton y HACH. Formulario federal requerido — tu firma permite verificación con empleadores, bancos y agencias gubernamentales.",
    pt: "Formulário HUD autorizando liberação de informações de renda e emprego para Stanton e HACH. Formulário federal obrigatório — sua assinatura permite verificação com empregadores, bancos e agências governamentais.",
  },
  hach_release: {
    en: "A signed authorization letting HACH (Housing Authority) verify your income and household information directly with banks, employers, and government agencies. We'll provide this form for you to sign.",
    es: "Una autorización firmada permitiendo que HACH verifique tus ingresos e información del hogar directamente con bancos, empleadores y agencias gubernamentales. Te proporcionaremos este formulario para firmar.",
    pt: "Uma autorização assinada permitindo que HACH verifique sua renda e informações da família diretamente com bancos, empregadores e agências governamentais. Forneceremos este formulário para você assinar.",
  },
  obligations_of_family: {
    en: "Form acknowledging your responsibilities as a PBV tenant and member of the household. Explains program rules, reporting requirements, and consequences of non-compliance.",
    es: "Formulario reconociendo tus responsabilidades como inquilino PBV y miembro del hogar. Explica las reglas del programa, requisitos de reporte y consecuencias de no cumplimiento.",
    pt: "Formulário reconhecendo suas responsabilidades como inquilino PBV e membro da família. Explica as regras do programa, requisitos de relatório e consequências de não conformidade.",
  },
  briefing_docs_certification: {
    en: "Certification that you received and understand the program briefing documents. Confirms you were informed about PBV rules, rights, and responsibilities.",
    es: "Certificación de que recibiste y entiendes los documentos informativos del programa. Confirma que fuiste informado sobre las reglas, derechos y responsabilidades de PBV.",
    pt: "Certificação de que você recebeu e entendeu os documentos informativos do programa. Confirma que você foi informado sobre as regras, direitos e responsabilidades do PBV.",
  },
  debts_owed_phas: {
    en: "HUD-52675 form disclosing any money you owe to Public Housing Agencies (PHAs). Must list all PHAs and amounts owed. Required even if you owe $0 — check the 'no debts' box if applicable.",
    es: "Formulario HUD-52675 divulgando cualquier dinero que debas a Agencias de Vivienda Pública. Debe listar todas las PHAs y montos adeudados. Requerido incluso si debes $0 — marca la casilla 'sin deudas' si aplica.",
    pt: "Formulário HUD-52675 divulgando qualquer dinheiro que você deva a Agências de Habitação Pública. Deve listar todas as PHAs e valores devidos. Obrigatório mesmo se você deva $0 — marque a caixa 'sem dívidas' se aplicável.",
  },
  citizenship_declaration: {
    en: "Declaration of US citizenship or eligible immigration status for each household member. Must be completed for every person in the household. Separate form per person.",
    es: "Declaración de ciudadanía estadounidense o estado migratorio elegible para cada miembro del hogar. Debe completarse para cada persona en el hogar. Formulario separado por persona.",
    pt: "Declaração de cidadania americana ou status de imigração elegível para cada membro da família. Deve ser preenchido para cada pessoa na família. Formulário separado por pessoa.",
  },
  eiv_guide_receipt: {
    en: "Acknowledgment that you received and understand the Enterprise Income Verification (EIV) guide. EIV is the system used to verify your income electronically.",
    es: "Reconocimiento de que recibiste y entiendes la guía de Verificación de Ingresos Empresarial. EIV es el sistema utilizado para verificar tus ingresos electrónicamente.",
    pt: "Reconhecimento de que você recebeu e entendeu o guia de Verificação de Renda Empresarial. EIV é o sistema usado para verificar sua renda eletronicamente.",
  },
  hud_92006: {
    en: "HUD Supplemental Contact Form with additional household information. Captures contact details, emergency contacts, and other data not on the main application.",
    es: "Formulario Suplementario de Contacto HUD con información adicional del hogar. Captura detalles de contacto, contactos de emergencia y otros datos no incluidos en la solicitud principal.",
    pt: "Formulário Suplementar de Contato HUD com informações adicionais da família. Captura detalhes de contato, contatos de emergência e outros dados não incluídos na inscrição principal.",
  },
  vawa_certification: {
    en: "VAWA (Violence Against Women Act) certification form HUD-5382. Optional. Used if you need to request emergency transfer due to domestic violence, dating violence, sexual assault, or stalking.",
    es: "Formulario de certificación VAWA HUD-5382. Opcional. Usado si necesitas solicitar transferencia de emergencia debido a violencia doméstica, violencia en citas, agresión sexual o acoso.",
    pt: "Formulário de certificação VAWA HUD-5382. Opcional. Usado se você precisar solicitar transferência de emergência devido a violência doméstica, violência em relacionamentos, agressão sexual ou perseguição.",
  },
  reasonable_accommodation_request: {
    en: "Form to request disability-related reasonable accommodations or modifications to the unit or program. Optional. Use if you or a household member have a disability requiring accommodation.",
    es: "Formulario para solicitar acomodaciones razonables relacionadas con discapacidad o modificaciones a la unidad o programa. Opcional. Úsalo si tú o un miembro del hogar tienen una discapacidad que requiere acomodación.",
    pt: "Formulário para solicitar acomodações razoáveis relacionadas a deficiência ou modificações à unidade ou programa. Opcional. Use se você ou um membro da família tiverem uma deficiência que requeira acomodação.",
  },
};

/**
 * Get help text for a document type in the specified language.
 * Falls back to English if the requested language is not available.
 * Logs a warning in development mode if translation is missing.
 */
export function getDocHelp(docType: string, lang: 'en' | 'es' | 'pt'): string {
  const help = DOC_TYPE_HELP[docType];
  
  if (!help) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[docTypeHelp] Missing help content for doc_type: ${docType}`);
    }
    return '';
  }
  
  // If requested language is not available, fall back to English
  const text = help[lang];
  if (!text || text.startsWith('TODO:')) {
    if (process.env.NODE_ENV === 'development' && lang !== 'en') {
      console.warn(`[docTypeHelp] Missing ${lang} translation for doc_type: ${docType}, falling back to English`);
    }
    return help.en;
  }
  
  return text;
}

/**
 * Check if a document type has help content defined.
 */
export function hasDocHelp(docType: string): boolean {
  return docType in DOC_TYPE_HELP;
}

/**
 * Get count of document types with complete translations.
 * Useful for build reports and verification.
 */
export function getTranslationCoverage(): { 
  total: number; 
  en: number; 
  es: number; 
  pt: number;
  missingEs: string[];
  missingPt: string[];
} {
  const docTypes = Object.keys(DOC_TYPE_HELP);
  const total = docTypes.length;
  
  let es = 0;
  let pt = 0;
  const missingEs: string[] = [];
  const missingPt: string[] = [];
  
  for (const docType of docTypes) {
    const help = DOC_TYPE_HELP[docType];
    if (help.es && !help.es.startsWith('TODO:')) {
      es++;
    } else {
      missingEs.push(docType);
    }
    if (help.pt && !help.pt.startsWith('TODO:')) {
      pt++;
    } else {
      missingPt.push(docType);
    }
  }
  
  return { total, en: total, es, pt, missingEs, missingPt };
}
