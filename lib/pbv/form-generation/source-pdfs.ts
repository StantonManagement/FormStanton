/**
 * lib/pbv/form-generation/source-pdfs.ts
 *
 * Loads source PDFs from assets/pbv-source-pdfs/ at module import time.
 * PDFs are embedded as Buffer constants — loaded once, never re-read per request.
 * Path resolution is relative to the project root (process.cwd() in Next.js server context).
 *
 * Why assets/ and not docs/templates/: .vercelignore strips docs/, so PDFs there
 * are absent from the serverless bundle at runtime. assets/ is bundled via
 * next.config.js outputFileTracingIncludes (see '/api/t/[token]/pbv-full-app/generate-forms').
 *
 * Only forms with generation_enabled=TRUE are loaded here.
 * Source-pending forms (vawa, reasonable_accommodation, zero_income_statement)
 * are excluded until their source PDFs land and generation_enabled is flipped.
 *
 * PRD-55b (2026-05-21): re-added criminal_background_release + eiv_guide_receipt
 * after PRD-55 wrongly disabled them — sources existed in docs/templates/ but
 * PRD-55 only checked assets/pbv-source-pdfs/. PDFs copied to assets/ now.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SOURCE_PDF_DIR = 'assets/pbv-source-pdfs';

function loadPdf(fileName: string): Buffer {
  const fullPath = join(process.cwd(), SOURCE_PDF_DIR, fileName);
  if (!existsSync(fullPath)) {
    throw new Error(`Source PDF not found: ${fullPath}. Ensure ${SOURCE_PDF_DIR}/ is present at runtime.`);
  }
  return readFileSync(fullPath);
}

function tryLoadPdf(fileName: string): Buffer | null {
  try {
    return loadPdf(fileName);
  } catch (err: any) {
    // PRD-66 (audit #13): the pre-PRD-66 empty catch swallowed every error
    // — permission denied, EMFILE, anything — and made them indistinguishable
    // from "this form isn't sourced." Distinguish the intentional not-found
    // path (loadPdf throws a generic Error with "Source PDF not found" when
    // existsSync is false; fs.readFileSync would throw ENOENT) from a real
    // operational failure, which we log at ERROR with the file name so it
    // shows up in monitoring instead of silently returning null.
    const code = err?.code;
    const message = String(err?.message ?? '');
    const isNotFound = code === 'ENOENT' || message.includes('Source PDF not found');

    if (!isNotFound) {
      console.error(`[source-pdfs] Failed to load ${fileName}:`, err);
    }
    return null;
  }
}

// ─── Source PDF registry (generation_enabled=TRUE forms only) ─────────────────

export const SOURCE_PDFS: Record<string, { en: Buffer | null; es: Buffer | null }> = {
  main_application: {
    en: tryLoadPdf('main-application-en.pdf'),
    es: tryLoadPdf('main-application-es.pdf'),
  },
  citizenship_declaration: {
    en: tryLoadPdf('citizenship-declaration-en.pdf'),
    es: tryLoadPdf('citizenship-declaration-es.pdf'),
  },
  obligations_of_family: {
    en: tryLoadPdf('obligations-of-family-en.pdf'),
    es: tryLoadPdf('obligations-of-family-es.pdf'),
  },
  hud_9886a: {
    en: tryLoadPdf('hud-9886a-en.pdf'),
    es: tryLoadPdf('hud-9886a-es.pdf'),
  },
  hach_release: {
    en: tryLoadPdf('hach-release-en.pdf'),
    es: tryLoadPdf('hach-release-es.pdf'),
  },
  hud_92006: {
    en: tryLoadPdf('hud-92006-en.pdf'),
    es: tryLoadPdf('hud-92006-es.pdf'),
  },
  child_support_affidavit: {
    en: tryLoadPdf('child-support-affidavit-en.pdf'),
    es: tryLoadPdf('child-support-affidavit-es.pdf'),
  },
  no_child_support_affidavit: {
    en: tryLoadPdf('no-child-support-affidavit-en.pdf'),
    es: tryLoadPdf('no-child-support-affidavit-es.pdf'),
  },
  pet_addendum: {
    en: tryLoadPdf('pet-addendum-en.pdf'),
    es: tryLoadPdf('pet-addendum-es.pdf'),
  },
  vehicle_addendum: {
    en: tryLoadPdf('vehicle-addendum-en.pdf'),
    es: tryLoadPdf('vehicle-addendum-es.pdf'),
  },
  self_employment_worksheet: {
    en: tryLoadPdf('self-employment-worksheet-en.pdf'),
    es: tryLoadPdf('self-employment-worksheet-es.pdf'),
  },
  briefing_cert: {
    en: tryLoadPdf('briefing-cert-en.pdf'),
    es: tryLoadPdf('briefing-cert-es.pdf'),
  },
  debts_owed_phas: {
    en: tryLoadPdf('debts-owed-phas-en.pdf'),
    es: tryLoadPdf('debts-owed-phas-es.pdf'),
  },
  criminal_background_release: {
    en: tryLoadPdf('criminal-background-release-en.pdf'),
    es: tryLoadPdf('criminal-background-release-es.pdf'),
  },
  eiv_guide_receipt: {
    en: tryLoadPdf('eiv-guide-receipt-en.pdf'),
    es: tryLoadPdf('eiv-guide-receipt-es.pdf'),
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
