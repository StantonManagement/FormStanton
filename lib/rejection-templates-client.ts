/**
 * Client-safe utilities for rejection template interpolation.
 * No server imports — safe to bundle in client components.
 */

/**
 * Interpolate a raw template string with variables.
 * Unused placeholders are stripped gracefully.
 */
export function interpolateTemplate(
  template: string,
  vars: { tenant: string; doc: string; doc_short: string; custom?: string }
): string {
  return template
    .replace(/\{tenant\}/g, vars.tenant)
    .replace(/\{doc\}/g, vars.doc)
    .replace(/\{doc_short\}/g, vars.doc_short)
    .replace(/\{custom\}/g, vars.custom ?? '[your note here]')
    .replace(/\{[^}]+\}/g, '');
}

/**
 * Map a language code to a display name for the SMS preview label.
 */
export function langDisplayName(lang: string): string {
  switch (lang) {
    case 'es': return 'Spanish';
    case 'pt': return 'Portuguese';
    default:   return 'English';
  }
}
