# Windsurf Prompt — Document Scanner Component (Phase 1 MVP)

**Reference PRD:** `tasks/document-scanner_prd_2026-04-23.md`

---

## Task

Build a reusable `<DocumentScanner>` React component for the Stanton Management tenant portal (`form-stanton.vercel.app`). It replaces the raw file input currently used for `file_upload` task types in the multi-project compliance system.

## Stack Context

- Next.js App Router
- Supabase (DB + Storage) — existing instance, existing `task_completions` table
- Vercel deployment
- TypeScript
- Tenant portal lives at `/t/[token]`, language auto-loaded from `project_units.preferred_language`

## Phase 1 Scope (build this, nothing more)

### Component file
Create `components/DocumentScanner/DocumentScanner.tsx` as a self-contained component.

### Props
```ts
interface DocumentScannerProps {
  taskId: string;
  projectUnitId: string;
  instructions: string;
  multiPage?: boolean;           // default true
  maxPages?: number;             // default 10
  language: 'en' | 'es' | 'pt';
  onComplete: (evidenceUrl: string, metadata: Metadata) => void;
  onCancel: () => void;
}

interface Metadata {
  capture_method: 'scanner' | 'file_upload';
  page_count: number;
  quality_flags: string[];       // e.g. ['blurry']
  quality_scores: {
    blur: number;
    brightness: number;
    resolution: number;
  };
  format: 'pdf' | 'jpeg';
  heic_converted: boolean;
}
```

### Capture flow

1. **Entry screen:** Show `instructions` text, a large "Take Photo" button, and a smaller "Choose File" fallback link.
2. **Camera mode:**
   - Use `<input type="file" accept="image/*" capture="environment">` for mobile (forces rear camera).
   - On desktop, use standard file picker.
   - After file selected → process through jscanify.
3. **jscanify integration:**
   - Lazy-load jscanify + OpenCV.js (only when scanner is opened — do NOT bundle in main portal build).
   - Run edge detection, perspective correction, auto-crop.
   - If detection fails, use the original image.
4. **HEIC handling:**
   - If file is `.heic` / `.heif`, convert to JPEG via `heic2any` before jscanify.
5. **Quality gate:**
   - Run blur (variance of Laplacian), brightness (mean pixel value), resolution (long-edge px) checks.
   - Thresholds: blur < 100, brightness < 50/255, resolution < 1000px long edge.
   - If any fail → show warning screen with the specific issue in the user's language + "Retake" (primary) and "Use anyway" (secondary).
   - Record `quality_flags` and `quality_scores` regardless of whether gate was overridden.
6. **Preview:**
   - Show cropped result full-width.
   - Buttons: "Retake" and "Use this page" (if multi-page) or "Use this" (if single).
   - If multi-page: "Add another page" → loops back to camera mode. Show thumbnail strip of pages captured so far, each with a delete X.
7. **Finalize:**
   - Single page → upload as JPEG.
   - Multi-page → combine pages with `pdf-lib` into a single PDF client-side, upload as PDF.
   - Upload path: `/uploads/{projectUnitId}/{taskId}/{timestamp}_combined.{ext}`
   - Also upload individual page images to same folder (for debugging, 30-day lifecycle — don't implement lifecycle now, just upload).
8. **DB write:**
   - Update `task_completions` row matching `(project_unit_id, task_id)`:
     - `status = 'complete'`
     - `evidence_url = <signed URL or storage path>`
     - `completed_by = 'tenant'`
     - `completed_at = now()`
     - `evidence_metadata = <Metadata JSON>`
   - Call `onComplete(evidenceUrl, metadata)`.

### Schema migration (include in this build)

Add column to `task_completions`:
```sql
ALTER TABLE task_completions
ADD COLUMN IF NOT EXISTS evidence_metadata JSONB;
```

Write as a new Supabase migration file in `supabase/migrations/`.

### Translations

Externalize all UI strings into `components/DocumentScanner/translations.ts`:

```ts
export const translations = {
  en: {
    takePhoto: 'Take Photo',
    chooseFile: 'Choose File Instead',
    retake: 'Retake',
    useThis: 'Use This',
    useThisPage: 'Use This Page',
    addPage: 'Add Another Page',
    submit: 'Submit',
    cancel: 'Cancel',
    blurryWarning: 'This photo looks blurry. Documents may be hard to read.',
    darkWarning: 'This photo is too dark. Try better lighting.',
    lowResWarning: 'This image is too small. Move closer to the document.',
    useAnyway: 'Use anyway',
    processing: 'Processing...',
    uploading: 'Uploading...',
    pageCount: (n: number) => `Page ${n}`,
  },
  es: { /* Spanish translations — match keys */ },
  pt: { /* Portuguese translations — match keys */ },
};
```

Follow existing translation patterns in the tenant form spec (`TENANT_FORM_SPECIFICATION.md`) for tone and terminology.

### Dependencies to install

```bash
npm install jscanify heic2any pdf-lib
```

### Mobile-first styling

- Full-screen camera + preview on mobile viewport
- Large tap targets (min 48px)
- Match existing tenant portal design tokens (don't introduce a new design system)
- Touch-friendly everywhere

## Explicit Non-Goals (do not build)

- Example image overlay
- Page reordering (drag/long-press)
- Enhancement filters (B&W, contrast boost)
- Server-side quality re-validation
- Staff review UI showing quality flags — that's Phase 2
- Any commercial SDK (Scanbot, etc.)
- Lobby intake integration
- Telemetry / analytics tracking

## Acceptance Criteria

- [ ] Component renders in the tenant portal when `task.evidence_type === 'file_upload'`
- [ ] Rear camera opens directly on iOS Safari and Android Chrome
- [ ] Edge detection produces a cropped, perspective-corrected result on a clear photo
- [ ] Blurry photo triggers warning, tenant can override
- [ ] HEIC file from iPhone converts and processes successfully
- [ ] Multi-page flow combines into single PDF
- [ ] Upload writes to correct Supabase Storage path
- [ ] `task_completions.evidence_metadata` populated with quality scores
- [ ] All UI strings render correctly in EN/ES/PT
- [ ] jscanify bundle does NOT load on portal initial page load (verify via network tab)

## File Naming Reminder

Component file: `components/DocumentScanner/DocumentScanner.tsx`
Translations: `components/DocumentScanner/translations.ts`
Quality utilities: `components/DocumentScanner/quality.ts` (blur/brightness/resolution checks)
Migration: `supabase/migrations/{timestamp}_add_evidence_metadata.sql`

Build it. Flag any ambiguity before implementing.
