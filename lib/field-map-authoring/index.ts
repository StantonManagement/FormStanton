/**
 * lib/field-map-authoring/index.ts
 *
 * PRD-86 Phase A — orchestration. Two entry points:
 *
 *   reviewFieldMap()  — validate (and optionally auto-correct) an EXISTING map,
 *                       producing Preview A, Preview B, a validation report, and
 *                       the (possibly corrected) map. This is what fixes the 11
 *                       PBV forms.
 *   proposeFieldMap() — re-exported; scaffolds a draft map for a NEW document.
 */

import { ingestSourcePdf } from './ingest';
import { runGeometricValidators } from './geometric';
import { autoCorrectFieldMap, type AutoCorrection } from './autocorrect';
import { renderPreviewA, type PreviewAResult } from './previewA';
import { renderPreviewB } from './previewB';
import { ocrRoundTrip, sharpRasterizer, claudeVisionOcrEngine } from './ocr';
import { extractPrintedWords } from './textlayer';
import { loadStamperFont, runPlacementValidators } from './placement';
import { extractVectorRegions } from './introspect/vectors';
import {
  type FieldMap,
  type OcrEngine,
  type Rasterizer,
  type ValidationFinding,
  type ValidationReport,
  DEFAULT_OVERLAP_TOLERANCE,
} from './types';

export * from './types';
export { ingestSourcePdf } from './ingest';
export {
  fieldMapToRects,
  runGeometricValidators,
  findOutOfBounds,
  findOverlaps,
  findRowOverflows,
  rectsOverlap,
  isWithinBox,
} from './geometric';
export { autoCorrectFieldMap, type AutoCorrection, type AutoCorrectResult } from './autocorrect';
export { renderPreviewA, type PreviewAResult } from './previewA';
export { renderPreviewB } from './previewB';
export { ocrRoundTrip, sharpRasterizer, claudeVisionOcrEngine, type OcrRoundTripResult } from './ocr';
export { proposeFieldMap, type ProposeResult } from './propose';
export { extractWidgets, type Widget } from './introspect/widgets';
export { extractVectorRegions, type VectorRegions, type HorizontalRule } from './introspect/vectors';
export { extractFillTargets, type FillTarget } from './introspect/fill-targets';
export {
  resolvePlacements,
  gatherSignals,
  type ResolveResult,
  type ResolveSignals,
  type Provenance,
  type Strategy,
} from './authoring/resolve';
export {
  proposeWithVision,
  applyVisionProposals,
  parseProposals,
  anthropicVisionModel,
  pymupdfRasterizer,
  type VisionModel,
  type PageRasterizer,
  type VisionProposal,
  type VisionField,
} from './authoring/vision';
export { extractPrintedWords, classifyWord } from './textlayer';
export {
  loadStamperFont,
  valueBoxesFromMap,
  findOffPageText,
  findOverprints,
  findColumnMisalignment,
  findValueCollisions,
  runPlacementValidators,
  STAMPER_STANDARD_FONT,
  type ValueBox,
  type PlacementOptions,
} from './placement';

export interface ReviewOptions {
  /** Apply bounded auto-correction before producing previews/report. Default false. */
  autoCorrect?: boolean;
  /** Sample data for Preview B + OCR round-trip. Omit to skip Preview B. */
  sampleData?: Record<string, unknown>;
  overlapTolerance?: number;
  rasterizer?: Rasterizer;
  ocrEngine?: OcrEngine;
}

export interface ReviewResult {
  fieldMap: FieldMap;
  corrections: AutoCorrection[];
  report: ValidationReport;
  previewA: PreviewAResult;
  previewB?: Buffer;
}

export async function reviewFieldMap(
  inputMap: FieldMap,
  sourcePdfBytes: Uint8Array,
  options: ReviewOptions = {}
): Promise<ReviewResult> {
  const {
    autoCorrect = false,
    sampleData,
    overlapTolerance = DEFAULT_OVERLAP_TOLERANCE,
    rasterizer = sharpRasterizer,
    ocrEngine = claudeVisionOcrEngine,
  } = options;

  const { pages } = await ingestSourcePdf(sourcePdfBytes);

  let fieldMap = inputMap;
  let corrections: AutoCorrection[] = [];
  if (autoCorrect) {
    const result = autoCorrectFieldMap(inputMap, pages, overlapTolerance);
    fieldMap = result.fieldMap;
    corrections = result.corrections;
  }

  const geometric = runGeometricValidators(fieldMap, pages, overlapTolerance);
  const previewA = await renderPreviewA(sourcePdfBytes, fieldMap, pages);

  let previewB: Buffer | undefined;
  let ocrStatus: ValidationReport['ocrStatus'] = 'skipped';
  let ocrReason: string | undefined = 'no sample data provided';
  let ocrFindings: ValidationReport['ocr'] = [];

  // Rasterization-free placement net. Overprint/off-page need sample values;
  // column-misalignment is structural (cells vs columns) and runs regardless.
  // This is the real safety net in environments where OCR cannot rasterize.
  const font = await loadStamperFont();
  const [printed, vectors] = await Promise.all([
    extractPrintedWords(sourcePdfBytes, font),
    extractVectorRegions(sourcePdfBytes),
  ]);
  const placement: ValidationFinding[] = runPlacementValidators(
    fieldMap,
    sampleData ?? {},
    pages,
    printed,
    font,
    { overprintTolerance: overlapTolerance, verticalRules: vectors.verticalRules }
  );

  if (sampleData) {
    previewB = await renderPreviewB(sourcePdfBytes, fieldMap, sampleData);
    const rt = await ocrRoundTrip(previewB, fieldMap, sampleData, rasterizer, ocrEngine);
    ocrStatus = rt.status;
    ocrReason = rt.reason;
    ocrFindings = rt.findings;
  }

  const report: ValidationReport = {
    formId: fieldMap.form_id,
    // Fail loudly: any placement finding (improper templating) fails the form.
    pass: geometric.length === 0 && placement.length === 0 && ocrStatus !== 'flagged',
    geometric,
    placement,
    ocrStatus,
    ocrReason,
    ocr: ocrFindings,
  };

  return { fieldMap, corrections, report, previewA, previewB };
}
