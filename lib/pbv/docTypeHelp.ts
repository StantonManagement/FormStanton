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
 * TODO: Complete es and pt translations. Currently using English as placeholders.
 */
export const DOC_TYPE_HELP: Record<string, DocHelpText> = {
  // ─── INCOME (10 docs) ──────────────────────────────────────────────────────
  paystubs: {
    en: "Your most recent pay statements showing earnings, deductions, and YTD totals. Ask your employer for the last 4 weekly stubs or 2 bi-weekly stubs. Most employers can email these or print from your employee portal.",
    es: "TODO: Your most recent pay statements showing earnings, deductions, and YTD totals. Ask your employer for the last 4 weekly stubs or 2 bi-weekly stubs.",
    pt: "TODO: Your most recent pay statements showing earnings, deductions, and YTD totals. Ask your employer for the last 4 weekly stubs or 2 bi-weekly stubs.",
  },
  pension_letter: {
    en: "Official letter from your pension plan or Railroad Retirement Board showing your monthly benefit amount. This verifies income for retired applicants receiving pension benefits.",
    es: "TODO: Official letter from your pension plan showing monthly benefit amount.",
    pt: "TODO: Official letter from your pension plan showing monthly benefit amount.",
  },
  ssi_award_letter: {
    en: "The letter from Social Security stating your monthly SSI benefit amount. Usually mailed each year in November. You can also download from ssa.gov/myaccount or call 1-800-772-1213.",
    es: "TODO: The letter from Social Security stating your monthly SSI benefit amount.",
    pt: "TODO: The letter from Social Security stating your monthly SSI benefit amount.",
  },
  ss_award_letter: {
    en: "The letter from Social Security Administration showing your monthly retirement, disability, or survivor benefits. Download at ssa.gov/myaccount or call 1-800-772-1213 to request a copy.",
    es: "TODO: The letter from Social Security showing your monthly retirement or disability benefits.",
    pt: "TODO: The letter from Social Security showing your monthly retirement or disability benefits.",
  },
  child_support_docs: {
    en: "Court order or payment history showing child support you pay or receive. Include 12 months of documentation from your state's child support agency or bank statements showing automatic transfers.",
    es: "TODO: Court order or payment history showing child support you pay or receive.",
    pt: "TODO: Court order or payment history showing child support you pay or receive.",
  },
  tanf_letter: {
    en: "Official award letter from your state's TANF (cash assistance) or SNAP (food stamps) program. Shows your monthly benefit amount and case number. Contact your caseworker if you don't have this.",
    es: "TODO: Official award letter from your state's TANF or food stamps program.",
    pt: "TODO: Official award letter from your state's TANF or food stamps program.",
  },
  unemployment_letter: {
    en: "Award letter from your state's unemployment office or workers compensation carrier. Shows weekly benefit amount and claim duration. Download from your state UI portal or call the claims line.",
    es: "TODO: Award letter from unemployment office or workers compensation carrier.",
    pt: "TODO: Award letter from unemployment office or workers compensation carrier.",
  },
  self_employment_docs: {
    en: "Your self-employment contract AND an earnings statement showing income for the past 3-6 months. Can be invoices, 1099s, bank deposits, or a profit/loss statement you prepare.",
    es: "TODO: Self-employment contract and earnings statement for past 3-6 months.",
    pt: "TODO: Self-employment contract and earnings statement for past 3-6 months.",
  },
  training_letter: {
    en: "Documentation from your training program, school, or grant provider showing the type and amount of assistance you receive. Include award letters, enrollment verification, or grant award notices.",
    es: "TODO: Documentation from training program, school, or grant provider.",
    pt: "TODO: Documentation from training program, school, or grant provider.",
  },
  digital_payment_statements: {
    en: "Screenshots or PDF statements from Cash App, Zelle, Venmo, or PayPal showing income received. Download 2 months of activity and circle/highlight payments you received for goods or services.",
    es: "TODO: Screenshots or statements from Cash App, Zelle, Venmo, or PayPal.",
    pt: "TODO: Screenshots or statements from Cash App, Zelle, Venmo, or PayPal.",
  },

  // ─── ASSETS (5 docs) ──────────────────────────────────────────────────────
  bank_statement_savings: {
    en: "Your most recent monthly savings account statement showing all transactions, current balance, and account holder name. Download from your bank's website or mobile app. All pages required.",
    es: "TODO: Your most recent monthly savings account statement.",
    pt: "TODO: Your most recent monthly savings account statement.",
  },
  bank_statement_checking: {
    en: "Your most recent monthly checking account statement showing all deposits, withdrawals, and ending balance. Download from your bank's website or app. Must show your name and account number.",
    es: "TODO: Your most recent monthly checking account statement.",
    pt: "TODO: Your most recent monthly checking account statement.",
  },
  insurance_settlement: {
    en: "Letter or documentation from your insurance company showing any settlement payments you receive (disability, accident, lawsuit, etc.). Shows payment schedule and total amount.",
    es: "TODO: Letter from insurance company showing settlement payments.",
    pt: "TODO: Letter from insurance company showing settlement payments.",
  },
  cd_trust_bond: {
    en: "Statements for Certificates of Deposit (CDs), trust accounts, or bonds you own. Shows current value, maturity date, and your name as owner. Request from your bank or broker.",
    es: "TODO: Statements for CDs, trust accounts, or bonds.",
    pt: "TODO: Statements for CDs, trust accounts, or bonds.",
  },
  life_insurance_policy: {
    en: "Your life insurance policy document showing the cash surrender value (if any). Term life policies typically have no cash value. Contact your insurance agent if unsure.",
    es: "TODO: Life insurance policy showing cash surrender value.",
    pt: "TODO: Life insurance policy showing cash surrender value.",
  },

  // ─── MEDICAL & CHILDCARE (3 docs) ─────────────────────────────────────────
  medical_bills: {
    en: "Doctor bills, hospital statements, or receipts for medical expenses in the last 12 months that weren't covered by insurance. These may qualify you for medical expense deductions.",
    es: "TODO: Doctor bills or hospital statements for last 12 months.",
    pt: "TODO: Doctor bills or hospital statements for last 12 months.",
  },
  pharmacy_statements: {
    en: "Pharmacy receipts or printouts showing prescription medication costs in the last 12 months. May include copays or full cost if uninsured. Helps with medical deductions.",
    es: "TODO: Pharmacy receipts showing prescription costs.",
    pt: "TODO: Pharmacy receipts showing prescription costs.",
  },
  care4kids_certificate: {
    en: "Care 4 Kids certificate, childcare provider letter, or receipts showing childcare expenses. Include provider's name, address, Tax ID, amount paid, and dates of care.",
    es: "TODO: Care 4 Kids certificate or childcare documentation.",
    pt: "TODO: Care 4 Kids certificate or childcare documentation.",
  },

  // ─── IMMIGRATION (2 docs) ────────────────────────────────────────────────
  immigration_docs: {
    en: "USCIS documents proving your immigration status: Permanent Resident Card (I-551), Arrival/Departure Record (I-94), or Employment Authorization (I-688/I-688B). Include front and back copies.",
    es: "TODO: USCIS documents proving immigration status: I-551, I-94, I-688, or I-688B.",
    pt: "TODO: USCIS documents proving immigration status: I-551, I-94, I-688, or I-688B.",
  },
  proof_of_age_noncitizen: {
    en: "Birth certificate, passport, or official ID showing date of birth for non-citizen household members age 62 or older. Required to verify eligibility for elderly provisions.",
    es: "TODO: Birth certificate or ID showing date of birth for non-citizens 62+.",
    pt: "TODO: Birth certificate or ID showing date of birth for non-citizens 62+.",
  },

  // ─── SIGNED FORMS (14 docs) ───────────────────────────────────────────────
  main_application: {
    en: "The completed PBV application form with all sections filled out and signed by the head of household. This is the primary application document.",
    es: "TODO: Completed PBV application form signed by head of household.",
    pt: "TODO: Completed PBV application form signed by head of household.",
  },
  criminal_background_release: {
    en: "Authorization form allowing Stanton and HACH to conduct a criminal background check. Required for all adult household members. Sign and date where indicated.",
    es: "TODO: Authorization for criminal background check for all adult members.",
    pt: "TODO: Authorization for criminal background check for all adult members.",
  },
  child_support_affidavit: {
    en: "Sworn statement declaring child support you pay or receive. Complete this if you have a child support order or make/receive payments. Alternative to 'No Child Support Affidavit'.",
    es: "TODO: Sworn statement declaring child support paid or received.",
    pt: "TODO: Sworn statement declaring child support paid or received.",
  },
  no_child_support_affidavit: {
    en: "Sworn statement certifying you do NOT pay or receive child support. Complete this only if the Child Support Affidavit doesn't apply to you. Sign and date.",
    es: "TODO: Sworn statement certifying you do not pay or receive child support.",
    pt: "TODO: Sworn statement certifying you do not pay or receive child support.",
  },
  hud_9886a: {
    en: "HUD form authorizing release of income and employment information to Stanton and HACH. Required federal form — your signature allows verification with employers, banks, and government agencies.",
    es: "TODO: HUD form authorizing release of income information to housing agency.",
    pt: "TODO: HUD form authorizing release of income information to housing agency.",
  },
  hach_release: {
    en: "A signed authorization letting HACH (Housing Authority) verify your income and household information directly with banks, employers, and government agencies. We'll provide this form for you to sign.",
    es: "TODO: Authorization letting HACH verify income and household information.",
    pt: "TODO: Authorization letting HACH verify income and household information.",
  },
  obligations_of_family: {
    en: "Form acknowledging your responsibilities as a PBV tenant and member of the household. Explains program rules, reporting requirements, and consequences of non-compliance.",
    es: "TODO: Form acknowledging responsibilities as a PBV tenant.",
    pt: "TODO: Form acknowledging responsibilities as a PBV tenant.",
  },
  briefing_docs_certification: {
    en: "Certification that you received and understand the program briefing documents. Confirms you were informed about PBV rules, rights, and responsibilities.",
    es: "TODO: Certification that you received program briefing documents.",
    pt: "TODO: Certification that you received program briefing documents.",
  },
  debts_owed_phas: {
    en: "HUD-52675 form disclosing any money you owe to Public Housing Agencies (PHAs). Must list all PHAs and amounts owed. Required even if you owe $0 — check the 'no debts' box if applicable.",
    es: "TODO: Form disclosing money owed to Public Housing Agencies.",
    pt: "TODO: Form disclosing money owed to Public Housing Agencies.",
  },
  citizenship_declaration: {
    en: "Declaration of US citizenship or eligible immigration status for each household member. Must be completed for every person in the household. Separate form per person.",
    es: "TODO: Declaration of citizenship or eligible immigration status per member.",
    pt: "TODO: Declaration of citizenship or eligible immigration status per member.",
  },
  eiv_guide_receipt: {
    en: "Acknowledgment that you received and understand the Enterprise Income Verification (EIV) guide. EIV is the system used to verify your income electronically.",
    es: "TODO: Acknowledgment of receiving the EIV (income verification) guide.",
    pt: "TODO: Acknowledgment of receiving the EIV (income verification) guide.",
  },
  hud_92006: {
    en: "HUD Supplemental Contact Form with additional household information. Captures contact details, emergency contacts, and other data not on the main application.",
    es: "TODO: HUD Supplemental Contact Form with additional household information.",
    pt: "TODO: HUD Supplemental Contact Form with additional household information.",
  },
  vawa_certification: {
    en: "VAWA (Violence Against Women Act) certification form HUD-5382. Optional. Used if you need to request emergency transfer due to domestic violence, dating violence, sexual assault, or stalking.",
    es: "TODO: VAWA certification form for domestic violence, sexual assault, or stalking survivors.",
    pt: "TODO: VAWA certification form for domestic violence, sexual assault, or stalking survivors.",
  },
  reasonable_accommodation_request: {
    en: "Form to request disability-related reasonable accommodations or modifications to the unit or program. Optional. Use if you or a household member have a disability requiring accommodation.",
    es: "TODO: Form to request disability-related accommodations or modifications.",
    pt: "TODO: Form to request disability-related accommodations or modifications.",
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
