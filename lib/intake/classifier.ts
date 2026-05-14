/**
 * classifier.ts
 *
 * Signature-based doc-type classifier for packet intake pages.
 * Loads doc_type_signatures from the DB for a given form_id and scores each page.
 */

import { supabaseAdmin } from '@/lib/supabase';

export type OcrConfidence = 'high' | 'medium' | 'low' | 'none';

export interface ClassifyResult {
  suggested_doc_type: string | null;
  suggested_person_slot: number | null;
  suggested_score: number | null;
  ocr_confidence: OcrConfidence;
}

interface Signature {
  doc_type: string;
  signature_kind: 'regex' | 'phrase' | 'form_number';
  pattern: string;
  weight: number;
  negative: boolean;
  min_score_for_match: number;
}

interface HouseholdMember {
  first_name?: string;
  last_name?: string;
  person_slot?: number;
}

const signatureCache = new Map<string, Signature[]>();

async function loadSignatures(formId: string): Promise<Signature[]> {
  const cached = signatureCache.get(formId);
  if (cached) return cached;

  const { data, error } = await supabaseAdmin
    .from('doc_type_signatures')
    .select('doc_type, signature_kind, pattern, weight, negative, min_score_for_match')
    .eq('form_id', formId);

  if (error || !data) {
    console.error('[classifier] Failed to load signatures:', error);
    return [];
  }

  const sigs = data as Signature[];
  signatureCache.set(formId, sigs);
  return sigs;
}

function scoreText(text: string, signatures: Signature[]): Map<string, number> {
  const scores = new Map<string, number>();
  const lowerText = text.toLowerCase();

  for (const sig of signatures) {
    const lowerPattern = sig.pattern.toLowerCase();
    let matched = false;

    if (sig.signature_kind === 'phrase' || sig.signature_kind === 'form_number') {
      matched = lowerText.includes(lowerPattern);
    } else if (sig.signature_kind === 'regex') {
      try {
        matched = new RegExp(sig.pattern, 'i').test(text);
      } catch {
        matched = false;
      }
    }

    if (matched) {
      const current = scores.get(sig.doc_type) ?? 0;
      if (sig.negative) {
        scores.set(sig.doc_type, current - sig.weight);
      } else {
        scores.set(sig.doc_type, current + sig.weight);
      }
    }
  }

  return scores;
}

function getMinScoreForDocType(docType: string, signatures: Signature[]): number {
  const sig = signatures.find((s) => s.doc_type === docType);
  return sig?.min_score_for_match ?? 0.6;
}

function deriveConfidence(
  topScore: number,
  minScore: number,
  secondScore: number | null
): OcrConfidence {
  if (topScore < minScore) return 'none';
  const headroom = topScore - minScore;
  const range = topScore;
  const headroomRatio = range > 0 ? headroom / range : 0;

  if (secondScore !== null && secondScore >= minScore) {
    const gap = topScore - secondScore;
    if (gap / topScore < 0.2) return 'medium';
  }

  if (headroomRatio > 0.5) return 'high';
  if (topScore >= minScore * 1.2) return 'medium';
  return 'low';
}

/**
 * Detect which household member is named on this page.
 * Returns the person_slot of the member if exactly one match; null otherwise.
 */
function detectPersonSlot(text: string, members: HouseholdMember[]): number | null {
  if (!members.length) return null;
  const lowerText = text.toLowerCase();
  const matches: number[] = [];

  for (const member of members) {
    if (!member.first_name && !member.last_name) continue;
    const lastName = (member.last_name ?? '').toLowerCase().trim();

    if (!lastName) continue;

    const hasLastName = lowerText.includes(lastName);
    const firstName = ((member.first_name ?? '').trim()).toLowerCase();
    const hasFirstName = firstName ? lowerText.includes(firstName) : false;

    if (hasLastName && hasFirstName && member.person_slot !== undefined) {
      matches.push(member.person_slot);
    }
  }

  if (matches.length === 1) return matches[0];
  return null;
}

/**
 * Classify a single page of extracted text.
 *
 * @param text  OCR-extracted text for the page
 * @param householdMembers  Members from the application's form_data
 * @param formId  The form template to load signatures for
 */
export function classifyPage(
  text: string,
  householdMembers: HouseholdMember[],
  formId: string
): ClassifyResult {
  if (!text || text.trim() === '[BLANK]' || text.trim().length < 20) {
    return {
      suggested_doc_type: null,
      suggested_person_slot: null,
      suggested_score: null,
      ocr_confidence: 'none',
    };
  }

  const cachedSigs = signatureCache.get(formId);
  if (!cachedSigs || cachedSigs.length === 0) {
    return {
      suggested_doc_type: null,
      suggested_person_slot: null,
      suggested_score: null,
      ocr_confidence: 'low',
    };
  }

  const scores = scoreText(text, cachedSigs);

  if (scores.size === 0) {
    return {
      suggested_doc_type: null,
      suggested_person_slot: null,
      suggested_score: null,
      ocr_confidence: 'none',
    };
  }

  const sorted = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
  const [topDocType, topScore] = sorted[0];
  const secondScore = sorted.length > 1 ? sorted[1][1] : null;
  const minScore = getMinScoreForDocType(topDocType, cachedSigs);

  if (topScore < minScore) {
    return {
      suggested_doc_type: null,
      suggested_person_slot: null,
      suggested_score: topScore,
      ocr_confidence: 'none',
    };
  }

  const confidence = deriveConfidence(topScore, minScore, secondScore);
  const personSlot = detectPersonSlot(text, householdMembers);

  return {
    suggested_doc_type: topDocType,
    suggested_person_slot: personSlot,
    suggested_score: topScore,
    ocr_confidence: confidence,
  };
}

/**
 * Pre-warm the signature cache for a given form_id.
 * Call this once at the start of an upload request so all classifyPage calls are synchronous.
 */
export async function warmSignatureCache(formId: string): Promise<void> {
  await loadSignatures(formId);
}
