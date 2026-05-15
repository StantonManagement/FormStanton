/**
 * Rejection Reason Resolution
 * Hybrid template + free-text system with three-level fallback
 *
 * Fallback order:
 * 1. Template key → localized template string
 * 2. Free-text override (rejection_reason column)
 * 3. Generic localized fallback
 */

export type Language = 'en' | 'es' | 'pt';

export interface RejectionTemplate {
  key: string;
  doc_type: string | null;
  reason_en: string;
  reason_es: string;
  reason_pt: string;
}

const GENERIC_FALLBACK: Record<Language, string> = {
  en: 'Please contact the office for details on why this document was rejected.',
  es: 'Por favor contacte la oficina para detalles sobre por qué este documento fue rechazado.',
  pt: 'Por favor entre em contato com o escritório para detalhes sobre por que este documento foi rejeitado.',
};

/**
 * Resolve a rejection reason for display to the tenant.
 *
 * @param args.key - Template key (e.g., 'generic:illegible', 'paystubs:wrong_period')
 * @param args.freeText - Free-text override from admin (rejection_reason column)
 * @param args.language - Tenant's preferred language
 * @param args.template - Pre-fetched template object (optional, avoids re-lookup)
 *
 * @returns Localized rejection reason string
 *
 * Fallback order:
 * 1. If template provided → return localized template string
 * 2. If freeText provided → return freeText
 * 3. → return generic localized fallback
 */
export function resolveRejectionReason(args: {
  key: string | null | undefined;
  freeText: string | null | undefined;
  language: Language;
  template?: RejectionTemplate;
}): string {
  // Level 1: Template key with pre-fetched template
  if (args.template) {
    const field = `reason_${args.language}` as const;
    return args.template[field] ?? GENERIC_FALLBACK[args.language];
  }

  // Level 2: Free-text override
  if (args.freeText?.trim()) {
    return args.freeText.trim();
  }

  // Level 3: Generic fallback
  return GENERIC_FALLBACK[args.language];
}

/**
 * Get the appropriate template column name for a language.
 */
export function getTemplateField(language: Language): keyof RejectionTemplate {
  return `reason_${language}`;
}

/**
 * Type guard to check if a value is a valid Language.
 */
export function isValidLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'es' || value === 'pt';
}
