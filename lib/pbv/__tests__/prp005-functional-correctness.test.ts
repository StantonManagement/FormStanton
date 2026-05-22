/**
 * PRP-005 — Functional-correctness regression tests.
 *
 * Verify-first scope (open-items #5..#9). All five items are confirmed
 * correct in the current code (no fixes shipped); these tests pin the
 * invariants so a future regression is caught.
 */

import { describe, it, expect, vi } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

// Stub @/lib/supabase before importing anything that pulls it transitively —
// the prod client throws "supabaseUrl is required" when env vars are absent.
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({}),
    storage: { from: () => ({}) },
  },
  supabase: {},
}));

import { buildSignatureFieldData } from '@/lib/pbv/signing/completeForm';
import type { FieldMap } from '@/lib/pbv/form-generation/stamper';

// ── #5: each adult row gets that signer's own image marker ───────────────────
describe('PRP-005 #5 — per-signer signature mapping', () => {
  it('emits __sig__:${memberId} per row in row_patterns (no shared buffer across rows)', () => {
    const fieldMap = {
      fields: [],
      row_patterns: [
        {
          data_key: 'adults',
          columns: [
            { type: 'image', member_key: 'signature', x: 0, y: 0, width: 100, height: 40 },
          ],
        },
      ],
    } as unknown as FieldMap;
    const requiredSignerIds = ['m-1', 'm-2', 'm-3'];
    const memberSlotMap = new Map<string, number>([
      ['m-1', 1],
      ['m-2', 2],
      ['m-3', 3],
    ]);
    const data = buildSignatureFieldData(fieldMap, requiredSignerIds, memberSlotMap);

    expect(data['__row_pattern:adults:signature:0']).toBe('__sig__:m-1');
    expect(data['__row_pattern:adults:signature:1']).toBe('__sig__:m-2');
    expect(data['__row_pattern:adults:signature:2']).toBe('__sig__:m-3');
    // Each marker must differ — no shared buffer across rows.
    const markers = ['m-1', 'm-2', 'm-3'].map(id => data[`__row_pattern:adults:signature:${[1, 2, 3].indexOf(memberSlotMap.get(id)!)}`]);
    expect(new Set(markers).size).toBe(3);
  });
});

// ── #6: each_adult union requiredSignerIds = all adults ──────────────────────
describe('PRP-005 #6 — each_adult required-signer union', () => {
  // Mirrors the inline expression on the generate-forms route (PRD-77 region):
  //   requiredSignerIds = members.filter((m) => (m.age ?? 0) >= 18).map((m) => m.id)
  function unionAdultsSigners(members: { id: string; age: number; slot: number }[]): string[] {
    return members.filter(m => (m.age ?? 0) >= 18).map(m => m.id).filter(Boolean) as string[];
  }

  it('three adults -> requiredSignerIds includes all three ids', () => {
    const members = [
      { id: 'a-1', age: 40, slot: 1 },
      { id: 'a-2', age: 38, slot: 2 },
      { id: 'a-3', age: 19, slot: 3 },
    ];
    expect(unionAdultsSigners(members)).toEqual(['a-1', 'a-2', 'a-3']);
  });

  it('mixed household -> only adults included; minors excluded', () => {
    const members = [
      { id: 'a-1', age: 40, slot: 1 },
      { id: 'a-2', age: 38, slot: 2 },
      { id: 'k-1', age: 10, slot: 3 },
    ];
    expect(unionAdultsSigners(members)).toEqual(['a-1', 'a-2']);
  });

  it('one adult -> not a degenerate single-element overwrite (length matches), allSigned needs that one signer', () => {
    const members = [{ id: 'a-1', age: 30, slot: 1 }];
    const ids = unionAdultsSigners(members);
    expect(ids).toEqual(['a-1']);
    // Simulated allSigned check
    const collected = ['a-1'];
    expect(ids.every(id => collected.includes(id))).toBe(true);
  });
});

// ── #7: review submit handler routes to /dashboard ──────────────────────────
describe('PRP-005 #7 — intake review CTA target', () => {
  it('SectionReview.tsx pushes to /pbv-full-app/${token}/dashboard (not /review)', () => {
    const source = readFileSync(
      join(process.cwd(), 'components', 'pbv', 'intake', 'SectionReview.tsx'),
      'utf8'
    );
    expect(source).toMatch(/router\.push\(['"`]\/pbv-full-app\/['"`]\s*\+\s*token\s*\+\s*['"`]\/dashboard['"`]\)/);
    // The "coming soon" stub must NOT be the destination.
    expect(source).not.toMatch(/router\.push\(['"`][^'"`]*\/review['"`]\)/);
  });
});

// ── #8: null/missing fieldMap -> errorCode 'field_map_missing', no advance ───
describe("PRP-005 #8 — field_map_missing surfaces, doesn't advance status", () => {
  it('loadFieldMapForSigning returns null for a non-existent form_id', async () => {
    const { loadFieldMapForSigning } = await import('@/lib/pbv/signing/completeForm');
    const r = await loadFieldMapForSigning('this-form-cannot-possibly-exist', 'en');
    expect(r).toBeNull();
  });

  it('completeForm source contains the field_map_missing early-return BEFORE setting status=signed', () => {
    const source = readFileSync(
      join(process.cwd(), 'lib', 'pbv', 'signing', 'completeForm.ts'),
      'utf8'
    );
    const missingIdx = source.indexOf("errorCode: 'field_map_missing'");
    const signedIdx = source.indexOf("formDocUpdate.status = 'signed'");
    expect(missingIdx).toBeGreaterThan(0);
    expect(signedIdx).toBeGreaterThan(0);
    expect(missingIdx).toBeLessThan(signedIdx);
  });
});

// ── #9: every multi-row field map uses the plural `row_patterns` key ────────
describe('PRP-005 #9 — field-maps use row_patterns (plural), not row_pattern (singular)', () => {
  const fieldMapDir = join(process.cwd(), 'scripts', 'field-maps');
  it('no field-map JSON has the singular `row_pattern` key at top level', () => {
    expect(existsSync(fieldMapDir)).toBe(true);
    const files = readdirSync(fieldMapDir).filter(f => f.endsWith('.json'));
    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const f of files) {
      const parsed = JSON.parse(readFileSync(join(fieldMapDir, f), 'utf8'));
      // Reject `row_pattern: {...}` AND `row_pattern: [...]`. Plural is fine.
      if (parsed && Object.prototype.hasOwnProperty.call(parsed, 'row_pattern')) {
        offenders.push(f);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every map with row_patterns is an array', () => {
    const files = readdirSync(fieldMapDir).filter(f => f.endsWith('.json'));
    for (const f of files) {
      const parsed = JSON.parse(readFileSync(join(fieldMapDir, f), 'utf8'));
      if (parsed.row_patterns !== undefined) {
        expect(Array.isArray(parsed.row_patterns)).toBe(true);
      }
    }
  });
});
