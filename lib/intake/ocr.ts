/**
 * ocr.ts
 *
 * Claude API vision wrapper for packet intake page OCR.
 * Returns extracted text and a confidence level derived from response heuristics.
 * Never throws — on any failure returns { text: '', confidence: 'none' }.
 */

import Anthropic from '@anthropic-ai/sdk';

export type OcrConfidence = 'high' | 'medium' | 'low' | 'none';

export interface OcrResult {
  text: string;
  confidence: OcrConfidence;
}

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

const MODEL = process.env.INTAKE_OCR_MODEL ?? 'claude-opus-4-5';

const SYSTEM_PROMPT = `You are an OCR assistant for a housing authority document intake system.
Extract ALL text visible on the document page exactly as it appears.
Do not summarize, interpret, or add information.
Output only the raw extracted text, preserving line breaks where visible.
If the page is blank or illegible, output exactly: [BLANK]`;

/**
 * Derive a confidence bucket from the extracted text.
 * Heuristics:
 *   - [BLANK] or very short text → none
 *   - ≥300 chars with structured content indicators → high
 *   - ≥100 chars → medium
 *   - otherwise → low
 */
function deriveConfidence(text: string): OcrConfidence {
  if (!text || text.trim() === '[BLANK]' || text.trim().length < 20) {
    return 'none';
  }
  const len = text.trim().length;
  const hasStructure =
    /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(text) ||
    /\$[\d,]+\.\d{2}/.test(text) ||
    /[A-Z][a-z]+\s+[A-Z][a-z]+/.test(text);

  if (len >= 300 && hasStructure) return 'high';
  if (len >= 100) return 'medium';
  return 'low';
}

/**
 * Run OCR on a single page image (base64-encoded JPEG).
 *
 * @param base64Image  Base64-encoded JPEG image data (no data URI prefix)
 */
export async function runOcr(base64Image: string): Promise<OcrResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'sk-ant-your-key-here') {
    return { text: '', confidence: 'none' };
  }

  try {
    const client = getClient();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: 'Extract all text from this document page.',
            },
          ],
        },
      ],
    });

    const textBlock = message.content.find((c) => c.type === 'text');
    const text = textBlock && textBlock.type === 'text' ? textBlock.text.trim() : '';
    return { text, confidence: deriveConfidence(text) };
  } catch (err) {
    console.error('[intake/ocr] OCR failed:', err);
    return { text: '', confidence: 'none' };
  }
}
