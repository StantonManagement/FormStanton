/**
 * consent.ts
 * 
 * Consent text resolution for electronic signature capture.
 * Loads active consent text by language from consent_text_versions table.
 */

import { supabaseAdmin } from '@/lib/supabase';

export type ConsentLanguage = 'en' | 'es' | 'ht';

export interface ConsentText {
  id: string;
  versionKey: string;
  language: ConsentLanguage;
  body: string;
  isActive: boolean;
  effectiveAt: Date;
}

/**
 * Load the active consent text for a given language.
 * Returns the currently active version (is_active = true).
 * Falls back to English if requested language has no active version.
 */
export async function loadActiveConsent(
  language: ConsentLanguage
): Promise<ConsentText> {
  // Try requested language first
  const { data, error } = await supabaseAdmin
    .from('consent_text_versions')
    .select('*')
    .eq('language', language)
    .eq('is_active', true)
    .single();

  if (data) {
    return {
      id: data.id,
      versionKey: data.version_key,
      language: data.language as ConsentLanguage,
      body: data.body,
      isActive: data.is_active,
      effectiveAt: new Date(data.effective_at),
    };
  }

  // Fallback to English
  if (language !== 'en') {
    const { data: enData, error: enError } = await supabaseAdmin
      .from('consent_text_versions')
      .select('*')
      .eq('language', 'en')
      .eq('is_active', true)
      .single();

    if (enData) {
      return {
        id: enData.id,
        versionKey: enData.version_key,
        language: 'en',
        body: enData.body,
        isActive: enData.is_active,
        effectiveAt: new Date(enData.effective_at),
      };
    }
  }

  if (error) {
    throw new Error(`Failed to load consent text: ${error.message}`);
  }

  throw new Error(`No active consent text found for language: ${language}`);
}

/**
 * Validate that a consent version is still active.
 * Used on apply step to check if consent text changed mid-flow.
 */
export async function isConsentVersionActive(
  versionKey: string,
  language: ConsentLanguage
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('consent_text_versions')
    .select('is_active')
    .eq('version_key', versionKey)
    .eq('language', language)
    .single();

  if (error || !data) return false;
  return data.is_active === true;
}
