/**
 * PRP-016 — Scanner & camera mobile-correctness + bundle-cost tests.
 *
 * Mostly source-grep — rendering the full DocumentScanner in jsdom drags
 * in OpenCV/Scanic. The deferred runtime gates exercise the real flow on
 * a device.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const scannerPath = join(process.cwd(), 'components', 'DocumentScanner', 'DocumentScanner.tsx');
const permPath = join(process.cwd(), 'components', 'DocumentScanner', 'usePermissionPrompt.ts');

describe('PRP-016 / B1 — pdf-lib is dynamic-imported, not statically bundled', () => {
  const src = readFileSync(scannerPath, 'utf8');
  it('the only `import` from "pdf-lib" is a type-only import', () => {
    // Verify by absence of a non-type runtime static import:
    expect(src).not.toMatch(/^import\s+\{[^}]*PDFDocument[^}]*\}\s+from\s+['"]pdf-lib['"]/m);
    // And presence of a type-only import.
    expect(src).toMatch(/import\s+type\s+\{[^}]+\}\s+from\s+['"]pdf-lib['"]/);
  });
  it('`buildPdf` uses `await import("pdf-lib")` at runtime', () => {
    expect(src).toMatch(/buildPdf[\s\S]{0,500}await\s+import\(\s*['"]pdf-lib['"]\s*\)/);
  });
});

describe('PRP-016 / B2 — preview blob is downsampled', () => {
  const src = readFileSync(scannerPath, 'utf8');
  it('exposes a makePreviewBlob helper with a maxLongEdge default of 1200', () => {
    expect(src).toMatch(/function\s+makePreviewBlob\([\s\S]{0,200}maxLongEdge\s*=\s*1200/);
  });
  it('previewUrl is built from the downsampled blob, not the full processedBlob', () => {
    expect(src).toMatch(/const\s+previewBlob\s*=\s*await\s+makePreviewBlob\(processedBlob\)/);
    expect(src).toMatch(/previewUrl:\s*URL\.createObjectURL\(previewBlob\)/);
  });
});

describe('PRP-016 / H2 + mobile §2.4 — getUserMedia uses { ideal: "environment" }', () => {
  const src = readFileSync(permPath, 'utf8');
  it('facingMode is the soft `{ ideal: "environment" }` form', () => {
    expect(src).toMatch(/facingMode:\s*\{\s*ideal:\s*['"]environment['"]\s*\}/);
    // And not the hard string form anywhere else.
    expect(src).not.toMatch(/facingMode:\s*['"]environment['"]/);
  });
});

describe('PRP-016 / mobile §9 — preview <img> heights use dvh', () => {
  const src = readFileSync(scannerPath, 'utf8');
  it('preview images use max-h-[50dvh] (not the old max-h-[50vh])', () => {
    expect(src).toMatch(/max-h-\[50dvh\]/);
    expect(src).not.toMatch(/max-h-\[50vh\]/);
  });
});

describe('PRP-016 / §11.7 — HEIC conversion shows a dedicated loading state', () => {
  const src = readFileSync(scannerPath, 'utf8');
  it("Stage union includes 'converting_heic'", () => {
    expect(src).toMatch(/'converting_heic'/);
  });
  it("setStage('converting_heic') fires before the heic2any dynamic import", () => {
    expect(src).toMatch(/setStage\('converting_heic'\)[\s\S]{0,200}heic2any/);
  });
  it("the stage renders a role=status aria-live region", () => {
    expect(src).toMatch(/stage === 'converting_heic'[\s\S]{0,200}role="status"[\s\S]{0,200}aria-live="polite"/);
  });
});
