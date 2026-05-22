/**
 * lib/pbv/consent-text.ts
 *
 * Versioned per-form consent text for the hybrid signing ceremony.
 * All versions are immutable once published — increment the version key
 * when copy changes. Mark uncertain translations with:
 * // CONSENT: tentative — review
 */

export const CONSENT_TEXT_VERSION = '2026-05-15-v1';

/**
 * PRP-018 / G1: every consent_text_version the app may emit. Sign-summary
 * validates the submitted version against the DB-backed `consent_versions`
 * table at request time; this constant mirrors that table so a deploy
 * that ships a new version but forgets to insert the row is caught
 * locally too.
 *
 * Bump procedure:
 *   1. INSERT a new row into consent_versions (migration).
 *   2. Add the new version string here.
 *   3. Bump CONSENT_TEXT_VERSION above.
 */
export const KNOWN_CONSENT_VERSIONS: readonly string[] = [
  '2026-05-15-v1',
] as const;

export function isKnownConsentVersion(v: unknown): v is string {
  return typeof v === 'string' && (KNOWN_CONSENT_VERSIONS as readonly string[]).includes(v);
}

export type ConsentLanguage = 'en' | 'es' | 'pt';

// Summary document consent
export const SUMMARY_CONSENT: Record<ConsentLanguage, string> = {
  en: 'I have read and understood this summary. By signing, I confirm that the information in my application is true and complete to the best of my knowledge.',
  // CONSENT: tentative — review
  es: 'He le\u00eddo y entendido este resumen. Al firmar, confirmo que la informaci\u00f3n de mi solicitud es verdadera y completa seg\u00fan mi leal saber y entender.',
  // CONSENT: tentative — review
  pt: 'Li e entendi este resumo. Ao assinar, confirmo que as informa\u00e7\u00f5es da minha solicita\u00e7\u00e3o s\u00e3o verdadeiras e completas, conforme meu melhor conhecimento.',
};

// Per-form consent template — {formName} is replaced at render time
export const FORM_CONSENT_TEMPLATE: Record<ConsentLanguage, string> = {
  en: 'By tapping Sign, I confirm I have reviewed this document and authorize my signature to be applied. I understand this constitutes my legal signature on this form.',
  // CONSENT: tentative — review
  es: 'Al tocar Firmar, confirmo que he revisado este documento y autorizo que se aplique mi firma. Entiendo que esto constituye mi firma legal en este formulario.',
  // CONSENT: tentative — review
  pt: 'Ao tocar em Assinar, confirmo que revi este documento e autorizo a aplica\u00e7\u00e3o da minha assinatura. Entendo que isso constitui minha assinatura legal neste formul\u00e1rio.',
};

export function getFormConsent(language: ConsentLanguage): string {
  return FORM_CONSENT_TEMPLATE[language] ?? FORM_CONSENT_TEMPLATE.en;
}

export function getSummaryConsent(language: ConsentLanguage): string {
  return SUMMARY_CONSENT[language] ?? SUMMARY_CONSENT.en;
}
