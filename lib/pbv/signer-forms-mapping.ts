/**
 * PRD-68: pure mapping for the member-token signer forms route.
 *
 * Extracted from `app/api/pbv-full-app/signer/[member_token]/forms/route.ts`
 * so the response-shape logic (display-name language selection, count from
 * array length, per-member signatures_complete) can be unit-tested without
 * mocking Supabase.
 *
 * The route is responsible for fetching `docs`, `templates`, `app`, and the
 * signed-form set; this helper is responsible for turning that data into the
 * `forms[]` array the signer page consumes. Response shape matches the HOH
 * route (`app/api/t/[token]/pbv-full-app/forms/route.ts`).
 */

export interface SignerFormDoc {
  id: string;
  form_id: string;
  language: string | null;
  status: string;
  generated_at: string | null;
  finalized_at: string | null;
  required_signer_member_ids: string[] | null;
  collected_signer_member_ids: string[] | null;
  conditional_trigger: string | null;
}

export interface SignerFormTemplate {
  form_id: string;
  display_name_en: string | null;
  display_name_es: string | null;
}

export interface MappedSignerForm {
  id: string;
  form_id: string;
  display_name: string;
  language: string | null;
  status: string;
  generated_at: string | null;
  finalized_at: string | null;
  required_signer_count: number;
  collected_signer_count: number;
  signatures_complete: boolean;
  conditional_trigger: string | null;
}

export function mapSignerForms(args: {
  docs: SignerFormDoc[];
  templates: SignerFormTemplate[];
  preferredLanguage: string | null | undefined;
  signedFormIds: Set<string>;
}): MappedSignerForm[] {
  const templateMap: Record<string, SignerFormTemplate> = Object.fromEntries(
    args.templates.map((t) => [t.form_id, t])
  );

  return args.docs.map((doc) => {
    const lang = args.preferredLanguage ?? doc.language ?? 'en';
    const tmpl = templateMap[doc.form_id];
    const displayName =
      lang === 'es'
        ? (tmpl?.display_name_es ?? doc.form_id)
        : (tmpl?.display_name_en ?? doc.form_id);

    return {
      id: doc.id,
      form_id: doc.form_id,
      display_name: displayName,
      language: doc.language,
      status: doc.status,
      generated_at: doc.generated_at,
      finalized_at: doc.finalized_at,
      required_signer_count: (doc.required_signer_member_ids ?? []).length,
      collected_signer_count: (doc.collected_signer_member_ids ?? []).length,
      signatures_complete: args.signedFormIds.has(doc.id),
      conditional_trigger: doc.conditional_trigger ?? null,
    };
  });
}
