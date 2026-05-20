/**
 * render.ts
 *
 * Interpolates a template body with provided slot values.
 * Missing slots are left as literal {slot} text — never throws.
 * Supported slots: {tenant_name}, {portal_url}, {doc_label},
 *                  {custom_note}, {deadline_date}, {message_body}
 */

export function renderBody(
  templateBody: string,
  interpolations: Record<string, string>
): string {
  return templateBody.replace(/\{([^}]+)\}/g, (_match, slot: string) => {
    if (Object.prototype.hasOwnProperty.call(interpolations, slot)) {
      return interpolations[slot];
    }
    console.warn(`[notifications/render] missing slot: {${slot}}`);
    return `{${slot}}`;
  });
}
