/**
 * lib/pbv/form-templates.ts
 *
 * Typed access to pbv_form_templates rows.
 */

import { supabaseAdmin } from '@/lib/supabase';

export interface PbvFormTemplate {
  form_id: string;
  display_name_en: string;
  display_name_es: string;
  display_name_pt: string | null;
  generation_enabled: boolean;
  source_pdf_status: 'pending' | 'sourced' | 'verified';
  per_person_scope: 'submission_level' | 'head_of_household_only' | 'each_adult' | 'each_member' | 'individual';
  conditional_rule: string | null;
  category: string | null;
  notes: string | null;
}

/**
 * Returns all form templates where generation_enabled = TRUE.
 * These are the forms eligible for stamping at generate-forms time.
 */
export async function getEnabledFormTemplates(): Promise<PbvFormTemplate[]> {
  const { data, error } = await supabaseAdmin
    .from('pbv_form_templates')
    .select('*')
    .eq('generation_enabled', true);

  if (error) throw error;
  return (data ?? []) as unknown as PbvFormTemplate[];
}

/**
 * Returns a single template by form_id.
 */
export async function getFormTemplate(formId: string): Promise<PbvFormTemplate | null> {
  const { data, error } = await supabaseAdmin
    .from('pbv_form_templates')
    .select('*')
    .eq('form_id', formId)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as PbvFormTemplate | null;
}

/**
 * Returns all templates (enabled and disabled), ordered by category + form_id.
 */
export async function getAllFormTemplates(): Promise<PbvFormTemplate[]> {
  const { data, error } = await supabaseAdmin
    .from('pbv_form_templates')
    .select('*')
    .order('category', { ascending: true })
    .order('form_id', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as PbvFormTemplate[];
}
