import { supabaseAdmin } from '@/lib/supabase';

export interface RejectionReasonTemplate {
  code: string;
  label: string;
  template_en: string;
  template_es: string;
  template_pt: string;
  sort_order: number;
  is_active: boolean;
}

/**
 * Fetch all active rejection reason templates ordered by sort_order.
 */
export async function fetchRejectionTemplates(): Promise<RejectionReasonTemplate[]> {
  const { data, error } = await supabaseAdmin
    .from('rejection_reason_templates')
    .select('code, label, template_en, template_es, template_pt, sort_order, is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(`Failed to fetch rejection templates: ${error.message}`);
  return data ?? [];
}

/**
 * Interpolate a template string, stripping unused placeholders gracefully.
 * Supported placeholders: {tenant}, {doc}, {doc_short}, {custom}
 */
function interpolate(
  template: string,
  vars: { tenant: string; doc: string; doc_short: string; custom?: string }
): string {
  return template
    .replace(/\{tenant\}/g, vars.tenant)
    .replace(/\{doc\}/g, vars.doc)
    .replace(/\{doc_short\}/g, vars.doc_short)
    .replace(/\{custom\}/g, vars.custom ?? '')
    .replace(/\{[^}]+\}/g, ''); // strip any unknown placeholders
}

/**
 * Fetch a template by code and language, interpolate variables, return the message.
 * Throws if the code is not found or is inactive.
 */
export async function renderTemplate(
  code: string,
  lang: 'en' | 'es' | 'pt',
  vars: { tenant: string; doc: string; doc_short: string; custom?: string }
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('rejection_reason_templates')
    .select('template_en, template_es, template_pt, is_active')
    .eq('code', code)
    .single();

  if (error || !data) throw new Error(`Rejection template '${code}' not found`);
  if (!data.is_active) throw new Error(`Rejection template '${code}' is inactive`);

  const templateField = `template_${lang}` as 'template_en' | 'template_es' | 'template_pt';
  const raw = (data as Record<string, string>)[templateField] ?? data.template_en;

  return interpolate(raw, vars);
}

/**
 * Client-safe interpolation for live preview (does not hit DB).
 * Pass the raw template string directly.
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
