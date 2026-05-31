import { describe, it, expect } from 'vitest';
import {
  proposeWithVision,
  applyVisionProposals,
  parseProposals,
  type PageRasterizer,
  type VisionModel,
} from '@/lib/field-map-authoring/authoring/vision';
import type { FieldMap } from '@/lib/field-map-authoring/types';

describe('parseProposals', () => {
  it('extracts a JSON array from fenced / prose-wrapped model output', () => {
    const out = 'Here you go:\n```json\n[{"field":"name","x":60,"y":700,"confidence":0.9}]\n```';
    const p = parseProposals(out);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ field: 'name', x: 60, y: 700 });
  });
  it('returns [] when no array / invalid', () => {
    expect(parseProposals('no coordinates here')).toEqual([]);
  });
});

describe('proposeWithVision', () => {
  const rasterOk: PageRasterizer = {
    async rasterize() {
      return { pngBase64: 'AAAA', widthPx: 1275, heightPx: 1650 };
    },
  };
  const rasterNone: PageRasterizer = { async rasterize() { return null; } };
  const model: VisionModel = {
    async propose() {
      return [{ field: 'applicant_full_name', x: 60, y: 700, confidence: 0.92 }];
    },
  };

  it('returns proposals when rasterization + model succeed', async () => {
    const p = await proposeWithVision(
      new Uint8Array([1]), 1, 612, 792,
      [{ name: 'applicant_full_name', label: 'Name', page: 1 }],
      rasterOk, model
    );
    expect(p).toHaveLength(1);
    expect(p[0].field).toBe('applicant_full_name');
  });

  it('returns [] when rasterization is unavailable (fields stay unresolved)', async () => {
    const p = await proposeWithVision(
      new Uint8Array([1]), 1, 612, 792,
      [{ name: 'x', label: 'X', page: 1 }],
      rasterNone, model
    );
    expect(p).toEqual([]);
  });
});

describe('applyVisionProposals', () => {
  const map: FieldMap = {
    form_id: 'f',
    source_pdf: 's',
    fields: [{ name: 'applicant_full_name', type: 'text', page: 1, x: 18, y: 776, font_size: 9, label: 'Name' }],
  };

  it('applies a high-confidence proposal and records vision provenance', () => {
    const { fieldMap, provenance } = applyVisionProposals(map, [
      { field: 'applicant_full_name', x: 60, y: 700, confidence: 0.9 },
    ]);
    expect(fieldMap.fields[0].x).toBe(60);
    expect(provenance[0].strategy).toBe('vision');
  });

  it('ignores low-confidence proposals (never invents placements)', () => {
    const { fieldMap, provenance } = applyVisionProposals(map, [
      { field: 'applicant_full_name', x: 60, y: 700, confidence: 0.3 },
    ]);
    expect(fieldMap.fields[0].x).toBe(18); // unchanged
    expect(provenance).toHaveLength(0);
  });
});
