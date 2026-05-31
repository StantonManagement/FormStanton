/**
 * lib/field-map-authoring/authoring/vision.ts
 *
 * Vision-assisted authoring — the LAST rung of the ladder, for fields the
 * deterministic resolver (AcroForm/anchor/geometry) leaves unresolved on
 * arbitrary or scanned PDFs. It renders the page to an image and asks Claude to
 * locate each remaining field's blank, returning a baseline coordinate in PDF
 * points. Proposals are NEVER applied at runtime and NEVER auto-trusted: they
 * flow back through the resolver/compile step, are gated by the deterministic
 * verifier, and require human approval. "Never invent placements" silently.
 *
 * Both the rasterizer and the model are injectable so this is unit-testable
 * without a live API or a rasterizer, and so the offline CLI can swap in
 * PyMuPDF (sharp cannot rasterize PDFs in this environment).
 */

import type { FieldMap, FlatField } from '../types';
import type { Provenance } from './resolve';

export interface RasterPage {
  pngBase64: string;
  widthPx: number;
  heightPx: number;
}

export interface PageRasterizer {
  /** Render 1-based `page` of the PDF to a PNG. Return null if unavailable. */
  rasterize(pdfBytes: Uint8Array, page: number, dpi?: number): Promise<RasterPage | null>;
}

export interface VisionField {
  name: string;
  label: string;
  page: number;
}

export interface VisionProposal {
  field: string;
  /** PDF points, bottom-left origin (text baseline start). */
  x: number;
  y: number;
  confidence: number; // 0..1
  reasoning?: string;
}

export interface VisionModel {
  propose(input: {
    pngBase64: string;
    widthPx: number;
    heightPx: number;
    pageWidthPt: number;
    pageHeightPt: number;
    fields: VisionField[];
  }): Promise<VisionProposal[]>;
}

const SYSTEM_PROMPT = `You locate where to type values onto a blank government form.
You are given a rendered image of ONE form page and a list of fields (each with a human label).
For EACH field, find the blank line / box / underscores where that field's value should be written,
and return the position of the START of the value text BASELINE.
Return coordinates in PDF POINTS with a BOTTOM-LEFT origin (y increases upward), not image pixels.
Use the provided image pixel size and PDF point size to convert.
Respond with ONLY a JSON array: [{"field": "<name>", "x": <number>, "y": <number>, "confidence": 0..1}].
Omit a field entirely if you cannot confidently locate it. Do not add commentary.`;

/** Default model: Claude vision via the repo's Anthropic SDK. Offline/authoring use. */
export const anthropicVisionModel: VisionModel = {
  async propose(input) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey === 'sk-ant-your-key-here') return [];
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });
    const model = process.env.FIELD_MAP_VISION_MODEL ?? 'claude-opus-4-5';
    const user = `Image size: ${input.widthPx}x${input.heightPx} px. PDF page size: ${input.pageWidthPt}x${input.pageHeightPt} pt.
Fields:\n${input.fields.map((f) => `- ${f.name}: "${f.label}"`).join('\n')}`;
    const resp = await client.messages.create({
      model,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: input.pngBase64 } },
            { type: 'text', text: user },
          ],
        },
      ],
    });
    const text = resp.content.map((b: any) => (b.type === 'text' ? b.text : '')).join('');
    return parseProposals(text);
  },
};

/** Parse the model's JSON array, tolerating code fences / surrounding prose. */
export function parseProposals(text: string): VisionProposal[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((p) => p && typeof p.field === 'string' && typeof p.x === 'number' && typeof p.y === 'number')
      .map((p) => ({ field: p.field, x: p.x, y: p.y, confidence: typeof p.confidence === 'number' ? p.confidence : 0.5, reasoning: p.reasoning }));
  } catch {
    return [];
  }
}

/** Default rasterizer: shell out to PyMuPDF (sharp lacks PDF rasterization here). */
export const pymupdfRasterizer: PageRasterizer = {
  async rasterize(pdfBytes, page, dpi = 150) {
    try {
      const { spawnSync } = await import('child_process');
      const os = await import('os');
      const fs = await import('fs');
      const path = await import('path');
      const tmp = path.join(os.tmpdir(), `fmauth-${page}-${pdfBytes.length}.pdf`);
      fs.writeFileSync(tmp, Buffer.from(pdfBytes));
      const code = `import fitz,base64,sys,json
d=fitz.open(${JSON.stringify(tmp)});pg=d[${page - 1}]
pix=pg.get_pixmap(dpi=${dpi})
print(json.dumps({"png":base64.b64encode(pix.tobytes("png")).decode(),"w":pix.width,"h":pix.height}))`;
      const out = spawnSync('python', ['-c', code], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      fs.unlinkSync(tmp);
      if (out.status !== 0 || !out.stdout) return null;
      const j = JSON.parse(out.stdout);
      return { pngBase64: j.png, widthPx: j.w, heightPx: j.h };
    } catch {
      return null;
    }
  },
};

/**
 * Propose placements for unresolved fields on one page via vision. Returns [] if
 * rasterization is unavailable (caller treats the fields as still unresolved).
 */
export async function proposeWithVision(
  pdfBytes: Uint8Array,
  page: number,
  pageWidthPt: number,
  pageHeightPt: number,
  fields: VisionField[],
  rasterizer: PageRasterizer = pymupdfRasterizer,
  model: VisionModel = anthropicVisionModel
): Promise<VisionProposal[]> {
  if (!fields.length) return [];
  const raster = await rasterizer.rasterize(pdfBytes, page);
  if (!raster) return [];
  return model.propose({
    pngBase64: raster.pngBase64,
    widthPx: raster.widthPx,
    heightPx: raster.heightPx,
    pageWidthPt,
    pageHeightPt,
    fields,
  });
}

/**
 * Apply vision proposals to a map's flat fields (above a confidence floor),
 * recording provenance. Returns a new map; never mutates input. Caller MUST
 * re-run the verifier and obtain human approval before trusting the result.
 */
export function applyVisionProposals(
  inputMap: FieldMap,
  proposals: VisionProposal[],
  minConfidence = 0.6
): { fieldMap: FieldMap; provenance: Provenance[] } {
  const fieldMap: FieldMap = JSON.parse(JSON.stringify(inputMap));
  const provenance: Provenance[] = [];
  const byName = new Map(proposals.filter((p) => p.confidence >= minConfidence).map((p) => [p.field, p]));
  for (const field of (fieldMap.fields ?? []) as FlatField[]) {
    const p = byName.get(field.name);
    if (!p) continue;
    const from = { x: field.x, y: field.y };
    field.x = p.x;
    field.y = p.y;
    provenance.push({
      field: field.name,
      strategy: 'vision',
      from,
      to: { x: p.x, y: p.y },
      note: `vision confidence ${p.confidence.toFixed(2)}`,
    });
  }
  return { fieldMap, provenance };
}
