import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { extractWidgets } from '@/lib/field-map-authoring/introspect/widgets';
import { extractVectorRegions } from '@/lib/field-map-authoring/introspect/vectors';
import { extractFillTargets } from '@/lib/field-map-authoring/introspect/fill-targets';
import type { PrintedWord } from '@/lib/field-map-authoring/types';

const SRC = (slug: string) =>
  new Uint8Array(readFileSync(join(process.cwd(), 'assets', 'pbv-source-pdfs', `${slug}.pdf`)));

describe('extractWidgets (AcroForm)', () => {
  it('reads named text widgets with boxes from a fielded EN form', async () => {
    const widgets = await extractWidgets(SRC('main-application-en'));
    expect(widgets.length).toBeGreaterThan(100);
    const name = widgets.find((w) => /name/i.test(w.name) && w.type === 'text');
    expect(name).toBeTruthy();
    expect(name!.width).toBeGreaterThan(0);
    expect(name!.page).toBe(1);
  }, 20000);

  it('returns none for an un-fielded ES form (signal absent → fall to other strategies)', async () => {
    const widgets = await extractWidgets(SRC('main-application-es'));
    expect(widgets).toHaveLength(0);
  }, 20000);
});

describe('extractVectorRegions', () => {
  it('recovers table vertical rules at the real column boundaries', async () => {
    const v = await extractVectorRegions(SRC('main-application-en'));
    expect(v.verticalRules.length).toBeGreaterThan(0);
    // adults table band (pdf y ~490-575) has a column boundary near x=216.
    const band = v.verticalRules.filter((r) => r.page === 1 && r.yBottom < 575 && r.yTop > 490);
    const xs = band.map((r) => Math.round(r.x));
    expect(xs.some((x) => Math.abs(x - 216) <= 3)).toBe(true);
  }, 20000);
});

describe('extractFillTargets', () => {
  it('combines underscore words, underline rules and cells', () => {
    const words: PrintedWord[] = [
      { page: 1, str: '__________', x: 100, y: 700, width: 80, height: 9, cls: 'fill_line' },
      { page: 1, str: 'Name:', x: 50, y: 700, width: 40, height: 9, cls: 'real_label' },
    ];
    const vectors = {
      verticalRules: [],
      horizontalRules: [{ page: 1, y: 680, xLeft: 100, xRight: 300 }],
      cells: [{ page: 1, x: 400, y: 660, width: 60, height: 20 }],
    };
    const targets = extractFillTargets(words, vectors);
    const kinds = targets.map((t) => t.kind).sort();
    expect(kinds).toEqual(['cell', 'underline', 'underscore']);
  });
});
