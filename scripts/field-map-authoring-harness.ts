/**
 * scripts/field-map-authoring-harness.ts
 *
 * PRD-86 Phase A dev harness for the field-map authoring/preview/validate tool.
 *
 * Single-form mode:
 *   npx tsx scripts/field-map-authoring-harness.ts <source.pdf> [field-map.json] <sample-data.json> \
 *       [--out <dir>] [--autocorrect] [--write-map <path>]
 *   - With a field-map.json: reviews (validates + optionally auto-corrects) it.
 *   - Without one: proposes a draft map from the PDF (greenfield scaffolding).
 *
 * Batch mode (correct the live PBV forms):
 *   npx tsx scripts/field-map-authoring-harness.ts --all-pbv [--autocorrect] [--write] \
 *       [--out <dir>] [--sample <data.json>]
 *   - Iterates every scripts/field-maps/*.json against its assets/pbv-source-pdfs/*.pdf,
 *     emits preview-A.pdf, preview-B.pdf, validation-report.json per form, and (with
 *     --write) writes auto-corrected maps back in place.
 *
 * Outputs go to <out>/<slug>/ (default: ./.field-map-authoring-out/).
 * Note: OCR round-trip is skipped where PDF rasterization is unavailable (it
 * reports `skipped` in the report); geometric validation always runs.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import {
  reviewFieldMap,
  proposeFieldMap,
  ingestSourcePdf,
  type FieldMap,
} from '@/lib/field-map-authoring';

const FIELD_MAP_DIR = join(process.cwd(), 'scripts', 'field-maps');
const SOURCE_PDF_DIR = join(process.cwd(), 'assets', 'pbv-source-pdfs');
const DEFAULT_OUT = join(process.cwd(), '.field-map-authoring-out');

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

interface ReportSummary {
  slug: string;
  geometricFindings: number;
  placementFindings: number;
  corrections: number;
  ocrStatus: string;
  pass: boolean;
}

async function processOne(
  slug: string,
  sourcePdfPath: string,
  fieldMapPath: string | null,
  sampleData: Record<string, unknown> | undefined,
  outDir: string,
  opts: { autoCorrect: boolean; writeMap?: string }
): Promise<ReportSummary> {
  const sourceBytes = new Uint8Array(readFileSync(sourcePdfPath));
  const formOut = join(outDir, slug);
  ensureDir(formOut);

  let fieldMap: FieldMap;
  if (fieldMapPath && existsSync(fieldMapPath)) {
    fieldMap = loadJson<FieldMap>(fieldMapPath);
  } else {
    const { pages } = await ingestSourcePdf(sourceBytes);
    const proposed = await proposeFieldMap(slug, basename(sourcePdfPath), sourceBytes, pages);
    fieldMap = proposed.fieldMap;
    writeFileSync(join(formOut, 'proposed-map.json'), JSON.stringify(fieldMap, null, 2));
  }

  const result = await reviewFieldMap(fieldMap, sourceBytes, {
    autoCorrect: opts.autoCorrect,
    sampleData,
  });

  writeFileSync(join(formOut, 'preview-A.pdf'), result.previewA.pdf);
  if (result.previewB) writeFileSync(join(formOut, 'preview-B.pdf'), result.previewB);
  writeFileSync(
    join(formOut, 'validation-report.json'),
    JSON.stringify({ ...result.report, corrections: result.corrections }, null, 2)
  );
  if (opts.autoCorrect) {
    writeFileSync(join(formOut, 'corrected-map.json'), JSON.stringify(result.fieldMap, null, 2));
  }

  // Write corrected map back in place only when asked and something changed.
  if (opts.writeMap && opts.autoCorrect && result.corrections.length > 0) {
    writeFileSync(opts.writeMap, JSON.stringify(result.fieldMap, null, 2) + '\n');
  }

  return {
    slug,
    geometricFindings: result.report.geometric.length,
    placementFindings: result.report.placement.length,
    corrections: result.corrections.length,
    ocrStatus: result.report.ocrStatus,
    pass: result.report.pass,
  };
}

async function runBatch(argv: string[]) {
  const autoCorrect = argv.includes('--autocorrect');
  const write = argv.includes('--write');
  const outIdx = argv.indexOf('--out');
  const outDir = outIdx >= 0 ? argv[outIdx + 1] : DEFAULT_OUT;
  const sampleIdx = argv.indexOf('--sample');
  const samplePath = sampleIdx >= 0
    ? argv[sampleIdx + 1]
    : join(process.cwd(), 'tests', 'fixtures', 'field-map-authoring', 'sample-data.json');
  const sampleData = existsSync(samplePath)
    ? loadJson<Record<string, unknown>>(samplePath)
    : undefined;

  ensureDir(outDir);
  const mapFiles = readdirSync(FIELD_MAP_DIR).filter((f) => f.endsWith('.json'));
  const summaries: ReportSummary[] = [];

  for (const file of mapFiles) {
    const slug = file.replace(/\.json$/, '');
    const sourcePdfPath = join(SOURCE_PDF_DIR, `${slug}.pdf`);
    if (!existsSync(sourcePdfPath)) {
      console.warn(`[harness] no source PDF for ${slug} (${sourcePdfPath}) — skipping`);
      continue;
    }
    try {
      const summary = await processOne(
        slug,
        sourcePdfPath,
        join(FIELD_MAP_DIR, file),
        sampleData,
        outDir,
        { autoCorrect, writeMap: write ? join(FIELD_MAP_DIR, file) : undefined }
      );
      summaries.push(summary);
      console.log(
        `[harness] ${slug.padEnd(34)} geom=${summary.geometricFindings} place=${summary.placementFindings} fixed=${summary.corrections} ocr=${summary.ocrStatus} pass=${summary.pass}`
      );
    } catch (err) {
      console.error(`[harness] FAILED ${slug}:`, err instanceof Error ? err.message : err);
    }
  }

  const totalFindings = summaries.reduce((s, r) => s + r.geometricFindings, 0);
  const totalPlacement = summaries.reduce((s, r) => s + r.placementFindings, 0);
  const totalFixed = summaries.reduce((s, r) => s + r.corrections, 0);
  const failed = summaries.filter((r) => !r.pass).length;
  console.log(
    `\n[harness] ${summaries.length} forms processed · ${totalFindings} geometric · ${totalPlacement} placement findings · ${totalFixed} auto-corrections · ${failed} form(s) failing${write ? ' (written in place)' : ' (dry run)'}`
  );
  console.log(`[harness] outputs in ${outDir}`);
}

async function runSingle(argv: string[]) {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const flagVal = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const autoCorrect = argv.includes('--autocorrect');
  const outDir = flagVal('--out') ?? DEFAULT_OUT;
  const writeMap = flagVal('--write-map');

  const sourcePdf = positional[0];
  if (!sourcePdf) {
    console.error('Usage: tsx scripts/field-map-authoring-harness.ts <source.pdf> [field-map.json] <sample-data.json> [--out dir] [--autocorrect] [--write-map path]');
    console.error('   or: tsx scripts/field-map-authoring-harness.ts --all-pbv [--autocorrect] [--write] [--out dir] [--sample data.json]');
    process.exit(1);
  }

  // Disambiguate the two optional positionals by extension.
  let fieldMapPath: string | null = null;
  let samplePath: string | undefined;
  for (const p of positional.slice(1)) {
    if (p.endsWith('.json') && /field|map/i.test(basename(p)) && !fieldMapPath) fieldMapPath = p;
    else if (p.endsWith('.json')) samplePath = p;
  }
  const sampleData = samplePath && existsSync(samplePath)
    ? loadJson<Record<string, unknown>>(samplePath)
    : undefined;

  const slug = basename(sourcePdf).replace(/\.pdf$/i, '');
  ensureDir(outDir);
  const summary = await processOne(slug, sourcePdf, fieldMapPath, sampleData, outDir, {
    autoCorrect,
    writeMap,
  });
  console.log(`[harness] ${JSON.stringify(summary, null, 2)}`);
  console.log(`[harness] outputs in ${join(outDir, slug)}`);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--all-pbv')) {
    await runBatch(argv);
  } else {
    await runSingle(argv);
  }
}

main().catch((err) => {
  console.error('[harness] fatal:', err);
  process.exit(1);
});
