/**
 * lib/pbv/form-generation/source-pdfs.ts
 *
 * Loads source PDFs from docs/templates/ at module import time.
 * PDFs are embedded as Buffer constants — loaded once, never re-read per request.
 * Path resolution is relative to the project root (process.cwd() in Next.js server context).
 *
 * Only forms with generation_enabled=TRUE are loaded here.
 * Source-pending forms (vawa, reasonable_accommodation, zero_income_statement, eiv_guide_receipt)
 * are excluded until their source PDFs land and generation_enabled is flipped.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function loadPdf(relativePath: string): Buffer {
  const fullPath = join(process.cwd(), relativePath);
  if (!existsSync(fullPath)) {
    throw new Error(`Source PDF not found: ${fullPath}. Ensure docs/templates/ is present at runtime.`);
  }
  return readFileSync(fullPath);
}

function tryLoadPdf(relativePath: string): Buffer | null {
  try {
    return loadPdf(relativePath);
  } catch {
    return null;
  }
}

// ─── Source PDF registry (generation_enabled=TRUE forms only) ─────────────────

export const SOURCE_PDFS: Record<string, { en: Buffer | null; es: Buffer | null }> = {
  main_application: {
    en: tryLoadPdf('docs/templates/main-application-en.pdf'),
    es: tryLoadPdf('docs/templates/main-application-es.pdf'),
  },
  citizenship_declaration: {
    en: tryLoadPdf('docs/templates/citizenship-declaration-en.pdf'),
    es: tryLoadPdf('docs/templates/citizenship-declaration-es.pdf'),
  },
  obligations_of_family: {
    en: tryLoadPdf('docs/templates/obligations-of-family-en.pdf'),
    es: tryLoadPdf('docs/templates/obligations-of-family-es.pdf'),
  },
  hud_9886a: {
    en: tryLoadPdf('docs/templates/hud-9886a-en.pdf'),
    es: tryLoadPdf('docs/templates/hud-9886a-es.pdf'),
  },
  hach_release: {
    en: tryLoadPdf('docs/templates/hach-release-en.pdf'),
    es: tryLoadPdf('docs/templates/hach-release-es.pdf'),
  },
  hud_92006: {
    en: tryLoadPdf('docs/templates/hud-92006-en.pdf'),
    es: tryLoadPdf('docs/templates/hud-92006-es.pdf'),
  },
  child_support_affidavit: {
    en: tryLoadPdf('docs/templates/child-support-affidavit-en.pdf'),
    es: tryLoadPdf('docs/templates/child-support-affidavit-es.pdf'),
  },
  no_child_support_affidavit: {
    en: tryLoadPdf('docs/templates/no-child-support-affidavit-en.pdf'),
    es: tryLoadPdf('docs/templates/no-child-support-affidavit-es.pdf'),
  },
  pet_addendum: {
    en: tryLoadPdf('docs/templates/pet-addendum-en.pdf'),
    es: tryLoadPdf('docs/templates/pet-addendum-es.pdf'),
  },
  vehicle_addendum: {
    en: tryLoadPdf('docs/templates/vehicle-addendum-en.pdf'),
    es: tryLoadPdf('docs/templates/vehicle-addendum-es.pdf'),
  },
  self_employment_worksheet: {
    en: tryLoadPdf('docs/templates/self-employment-worksheet-en.pdf'),
    es: tryLoadPdf('docs/templates/self-employment-worksheet-es.pdf'),
  },
  briefing_docs_certification: {
    en: tryLoadPdf('docs/templates/briefing-cert-en.pdf'),
    es: tryLoadPdf('docs/templates/briefing-cert-es.pdf'),
  },
  debts_owed_phas: {
    en: tryLoadPdf('docs/templates/debts-owed-phas-en.pdf'),
    es: tryLoadPdf('docs/templates/debts-owed-phas-es.pdf'),
  },
};

/**
 * Retrieve source PDF bytes for a form/language combination.
 * Returns null if the form is not in the registry or the file was missing at load time.
 */
export function getSourcePdf(formId: string, language: 'en' | 'es'): Buffer | null {
  return SOURCE_PDFS[formId]?.[language] ?? null;
}

/**
 * Compute SHA-256 hex hash of a buffer.
 * Used for source_pdf_hash in pbv_form_documents.
 */
export function sha256Hex(buf: Buffer): string {
  const { createHash } = require('crypto');
  return createHash('sha256').update(buf).digest('hex');
}
