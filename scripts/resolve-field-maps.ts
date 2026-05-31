/**
 * scripts/resolve-field-maps.ts
 *
 * Authoring CLI for the layered resolver (PRD-86). For each field map it gathers
 * the source PDF's signals (AcroForm widgets, text layer, vector cells), resolves
 * each field/column to the strongest signal, and reports the placement-finding
 * count BEFORE vs AFTER — so a correction is only trusted when the deterministic
 * verifier agrees it improved. With --write, a resolved map that strictly reduces
 * findings is written back to scripts/field-maps/<slug>.json.
 *
 * Usage (Windows: use ./node_modules/.bin/tsx, see docs/SHELL-PROTOCOL.md):
 *   tsx scripts/resolve-field-maps.ts <slug> [<slug> ...]
 *   tsx scripts/resolve-field-maps.ts --all [--write] [--verbose]
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import {
  reviewFieldMap,
  gatherSignals,
  resolvePlacements,
  type FieldMap,
} from '@/lib/field-map-authoring';

const FIELD_MAP_DIR = join(process.cwd(), 'scripts', 'field-maps');
const SOURCE_PDF_DIR = join(process.cwd(), 'assets', 'pbv-source-pdfs');
const SAMPLE = join(process.cwd(), 'tests', 'fixtures', 'field-map-authoring', 'sample-data.json');

function findingCount(report: { placement: { length: number }; geometric: { length: number } }): number {
  return report.placement.length + report.geometric.length;
}

async function run() {
  const argv = process.argv.slice(2);
  const write = argv.includes('--write');
  const verbose = argv.includes('--verbose');
  const sampleData = existsSync(SAMPLE)
    ? (JSON.parse(readFileSync(SAMPLE, 'utf8')) as Record<string, unknown>)
    : undefined;

  const slugs = argv.includes('--all')
    ? readdirSync(FIELD_MAP_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''))
    : argv.filter((a) => !a.startsWith('--'));

  for (const slug of slugs) {
    const mapPath = join(FIELD_MAP_DIR, `${slug}.json`);
    const pdfPath = join(SOURCE_PDF_DIR, `${slug}.pdf`);
    if (!existsSync(mapPath) || !existsSync(pdfPath)) {
      console.warn(`[resolve] skip ${slug} (missing map or source)`);
      continue;
    }
    const original = JSON.parse(readFileSync(mapPath, 'utf8')) as FieldMap;
    const bytes = new Uint8Array(readFileSync(pdfPath));

    const signals = await gatherSignals(bytes);
    const { fieldMap: resolved, provenance } = resolvePlacements(original, signals);

    const before = await reviewFieldMap(original, bytes, { sampleData });
    const after = await reviewFieldMap(resolved, bytes, { sampleData });
    const b = findingCount(before.report);
    const a = findingCount(after.report);
    const changed = provenance.filter((p) => p.strategy !== 'kept');
    const tag = a < b ? 'IMPROVED' : a === b ? 'same' : 'WORSE';

    console.log(`[resolve] ${slug.padEnd(34)} findings ${b}→${a} (${tag}) · ${changed.length} fields moved`);
    if (verbose) {
      for (const p of changed) {
        console.log(`    ${p.strategy.padEnd(8)} ${p.field}  (${p.from.x.toFixed(0)},${p.from.y.toFixed(0)})→(${p.to.x.toFixed(0)},${p.to.y.toFixed(0)})  ${p.note ?? ''}`);
      }
      for (const f of after.report.placement) console.log(`    STILL: [${f.kind}] ${f.field} :: ${f.reason}`);
    }

    if (write && a < b) {
      writeFileSync(mapPath, JSON.stringify(resolved, null, 2) + '\n');
      console.log(`    → wrote ${slug}.json`);
    }
  }
}

run().catch((e) => {
  console.error('[resolve] fatal:', e);
  process.exit(1);
});
