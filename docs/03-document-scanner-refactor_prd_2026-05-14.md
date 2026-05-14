# Document Scanner — Substrate-Agnostic Refactor

**Date:** 2026-05-14
**Status:** Draft — ready for build
**Supersedes:** `z - Archive/document-scanner_prd_2026-04-23.md` (specified initial build; that build shipped against `task_completions` and is live in the compliance portal — see "Current state" below).
**Depends on:** None. Refactor of existing component. PBV-side integration happens via PRD-03's tenant upload UI.
**Blocks:** PRD-03 Phase 5 enhancement (replacing the raw `<input type="file">` with the refactored scanner).

---

## Problem Statement

`components/DocumentScanner/DocumentScanner.tsx` ships in production for the compliance portal but its API hard-codes the multi-project compliance substrate:

```tsx
<DocumentScanner
  taskId={string}                 // task_completions reference
  projectUnitId={string}          // project_units reference
  onComplete={(evidenceUrl, metadata) => void}  // already uploaded to Supabase
/>
```

It uploads internally to Supabase storage and writes to `task_completions`. PBV uploads go to a different bucket, a different table (`application_documents`), and a different anchor (`pbv_full_application`). PRD-03's tenant upload UI cannot reuse the scanner without a fork or a rewrite.

The scanner's actual capabilities — camera capture via `capture="environment"`, jscanify edge detection, blur/resolution/darkness quality gate with override, HEIC→JPEG via heic2any, multi-page PDF combining via pdf-lib, trilingual UI — are all useful **regardless of substrate**. The compliance binding is the only thing blocking reuse.

PRD-04 (refactor): strip the substrate coupling. Scanner becomes a presentation-layer component that produces a `File` + metadata. Caller decides what to do with it.

---

## Current state (confirmed via grep 2026-05-14)

| Surface | Lines | Notes |
|---|---|---|
| `components/DocumentScanner/DocumentScanner.tsx` | 586 | Full implementation. Uses `supabase` client to upload directly. |
| `components/DocumentScanner/quality.ts` | (existing) | Quality gate logic — reused, unchanged. |
| `components/DocumentScanner/translations.ts` | (existing) | EN/ES/PT strings — reused, unchanged. |
| `components/portal/FileUploadTask.tsx` | (existing) | Compliance-portal caller. Will be updated to match new API. |
| `components/SubmissionStatusPortal.tsx` | (existing) | Imports `evaluateImageQuality` only, not the full component. No API change needed for this caller. |
| `package.json` | — | `jscanify`, `heic2any`, `pdf-lib` already present. No new deps. |

---

## Goals

1. **API substrate-agnostic.** Drop `taskId`, `projectUnitId`. Scanner produces `(file: File, metadata: ScannerMetadata)`. Caller owns upload + DB write.
2. **No regression in compliance portal.** `FileUploadTask.tsx` continues to work — updated to handle upload + DB write itself using the new callback contract.
3. **Reusable from PBV.** PRD-03's tenant upload UI calls the refactored component and uploads to `/api/pbv-full-app/[token]/documents/[doc_row_id]/upload`.
4. **No new component.** Refactor the existing one in place. Do not fork or duplicate.
5. **Every code claim in the build report is backed by a grep command + raw output.**

## Non-Goals

- **No new scanner capabilities.** Quality thresholds, languages, page handling, HEIC conversion all stay as they are.
- **No new tables, no new columns.** This is a refactor, not a schema change.
- **No changes to PRD-03's PRD.** PRD-03 ships with raw `<input type="file">` per its current spec. After this refactor merges, PRD-03's caller can be upgraded to use the scanner — but that upgrade is a separate small change documented at the end of this PRD.
- **No commercial SDK swap.** jscanify stays.
- **No server-side quality re-validation.** Client-side only, as today.

---

## Users & Roles

| Role | What changes |
|---|---|
| Tenant (compliance portal) | Nothing. Scanner UX identical to today. |
| Tenant (PBV portal — after PRD-03's caller upgrade) | Gains the scanner UX in place of raw file input. |
| Staff | Nothing. Scanner is tenant-side only. |

---

## Closed Decisions

1. **Refactor in place.** No new component file. Same path, same name.
2. **API shape:** scanner emits `(file: File, metadata: ScannerMetadata)`. Caller handles upload, storage path, DB write. No `supabase` client import inside the scanner anymore.
3. **Metadata shape unchanged.** Existing `Metadata` type stays as-is — `capture_method`, `page_count`, `quality_flags`, `quality_scores`, `format`, `heic_converted`. Caller decides where to persist it (JSONB column, audit log, application_events payload — caller's choice).
4. **`FileUploadTask.tsx` is updated as part of this PRD.** Cannot ship a breaking API change without updating known callers. The new caller code uploads to the same Supabase path it does today and writes `task_completions` with `evidence_url + metadata` — identical end-state, just hoisted out of the scanner.
5. **`SubmissionStatusPortal.tsx` is not modified.** It only imports `evaluateImageQuality` from the scanner's `quality.ts`. That helper is unchanged.
6. **Language prop stays the same.** No change to `ScannerLanguage` type or translations.
7. **Evidence standard:** every code-claim backed by grep command + raw output.

---

## Open Questions for Windsurf

Confirm before coding. Post answer in build report.

1. **Existing storage path convention in `FileUploadTask.tsx`.** The scanner currently uploads to `/uploads/{project_unit_id}/{task_id}/...`. After the refactor, `FileUploadTask.tsx` does that upload. Confirm the exact path convention and bucket name being used today via grep. Post the result. Do not "fix" the convention — preserve it exactly.
2. **`task_completions` write contract.** The scanner currently writes the `task_completions` row on completion. After refactor, `FileUploadTask.tsx` does that write. Confirm the exact columns being set today (`evidence_url`, `evidence_metadata`, `status`, `completed_at`, `completed_by`?). Post the grep. Preserve byte-for-byte.
3. **Other callers.** Grep `components/DocumentScanner` across `app/`, `components/`, `lib/` to confirm `FileUploadTask.tsx` is the only consumer of the full component (not just helper imports from `quality.ts`). Post results.

---

## Core Features

### 1. New scanner API

```tsx
export interface ScannerMetadata {
  capture_method: 'scanner' | 'file_upload';
  page_count: number;
  quality_flags: string[];
  quality_scores: { blur: number; brightness: number; resolution: number };
  format: 'pdf' | 'jpeg';
  heic_converted: boolean;
}

interface DocumentScannerProps {
  instructions: string;
  multiPage?: boolean;       // default true
  maxPages?: number;         // default 10
  acceptedFormats?: ('pdf' | 'jpeg')[];  // default ['pdf', 'jpeg']
  language: ScannerLanguage;
  onComplete: (file: File, metadata: ScannerMetadata) => Promise<void> | void;
  onCancel: () => void;
}
```

**Changes from current API:**
- Removed: `taskId`, `projectUnitId`.
- Removed: internal Supabase upload. The scanner produces a `File` object and hands it to the caller via `onComplete`.
- Changed: `onComplete` signature: was `(evidenceUrl: string, metadata: Metadata) => void`; now `(file: File, metadata: ScannerMetadata) => Promise<void> | void`. The async variant lets callers show upload progress and reject if upload fails.

### 2. Internal changes inside `DocumentScanner.tsx`

- Remove `import { supabase } from '@/lib/supabase'`.
- Remove the upload stage logic (currently triggered when the tenant taps "Use this"). Replace with: call `props.onComplete(file, metadata)`. If `onComplete` returns a promise and it throws, surface the error to the user with a retry button.
- Keep all capture / processing / preview / quality-gate logic identical.
- Keep `Metadata` type — rename export to `ScannerMetadata` for clarity (`Metadata` is too generic). Re-export `Metadata` as a deprecated alias for one release cycle for backward import compatibility.

### 3. Caller update: `FileUploadTask.tsx`

After the refactor, the compliance-portal caller looks like:

```tsx
<DocumentScanner
  instructions={...}
  language={language}
  onComplete={async (file, metadata) => {
    // Upload to Supabase (formerly done inside scanner)
    const evidenceUrl = await uploadToCompliancePath(file, taskId, projectUnitId);
    // Write task_completions row (formerly done inside scanner)
    await writeTaskCompletion({ taskId, evidenceUrl, metadata });
    onComplete(evidenceUrl, metadata);  // existing callback up to parent
  }}
  onCancel={onCancel}
/>
```

Compliance portal user experience must be **byte-for-byte identical** to today. Storage path identical. `task_completions` row identical.

### 4. PBV integration (informational — not part of this PRD's build)

After this PRD merges, PRD-03's tenant upload UI can replace its raw `<input type="file">` with:

```tsx
<DocumentScanner
  instructions={t('upload_doc_instructions', { docLabel })}
  language={language}
  onComplete={async (file, metadata) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata));
    await fetch(`/api/pbv-full-app/${token}/documents/${docRowId}/upload`, {
      method: 'POST',
      body: formData,
    });
  }}
  onCancel={onCancel}
/>
```

**This integration is NOT part of this PRD's build.** It happens in a follow-up after PRD-03 has shipped its Phase 5 (basic upload UI). PRD-03 itself stays as currently specified.

---

## Data Model

No schema changes. No migrations.

---

## Integration Points

- `components/DocumentScanner/DocumentScanner.tsx`: refactor.
- `components/DocumentScanner/quality.ts`: untouched.
- `components/DocumentScanner/translations.ts`: untouched.
- `components/portal/FileUploadTask.tsx`: updated caller. New body does upload + DB write previously done by the scanner.
- `components/SubmissionStatusPortal.tsx`: not modified. Only consumes `evaluateImageQuality` helper.

---

## Implementation Phases

Two phases.

### Phase 1 — Refactor scanner + update compliance caller

**Build:**
- Update `DocumentScanner.tsx`:
  - New props per §Core Features 1. Remove `taskId`, `projectUnitId`.
  - Remove `supabase` import.
  - Replace upload stage with `await props.onComplete(file, metadata)` inside try/catch with error UX.
  - Rename exported `Metadata` to `ScannerMetadata`; export `Metadata` as deprecated alias.
- Update `FileUploadTask.tsx`:
  - Call scanner with new API.
  - Implement `onComplete` callback that does the Supabase upload + `task_completions` write previously done inside the scanner.
  - Same storage path, same DB columns, same values.

**Done when:**
- `grep -n "supabase" components/DocumentScanner/DocumentScanner.tsx` returns 0 hits.
- `grep -rn "taskId\|projectUnitId" components/DocumentScanner` returns 0 hits.
- `grep -rn "DocumentScanner" components/portal app components --include="*.tsx" --include="*.ts"` returns the same call sites as before (no new consumers introduced; no consumers dropped).
- Manual smoke test on compliance portal: upload a PDF + a JPG + a HEIC. All three produce `task_completions` rows with the same shape as pre-refactor (paste row before/after as evidence).
- `npm run build` zero errors. Strict TS — no new `any`.
- `npm test` zero failures (existing tests must continue to pass; no new tests required, but if `FileUploadTask.tsx` has any test coverage it must still pass).

### Phase 2 — Verification

**Build:** None — purely verification.

**Done when:**
- `npm run build` + `npm test` clean.
- Grep audit re-posted with raw output:
  - No `supabase` import in scanner.
  - No `taskId` or `projectUnitId` references in scanner.
  - All callers updated.
- Build report includes a before/after diff of `task_completions` row produced by the compliance flow on identical input. Must be byte-for-byte identical.

---

## Architecture Rules (binding)

- **Scanner is presentation only.** No DB writes. No storage writes. No knowledge of substrate-specific paths.
- **Existing compliance behavior is preserved exactly.** No silent improvements to the compliance upload path. If you see something you'd "fix," note it in "Pre-existing issues observed" and leave it alone.
- **No new dependencies.** Everything needed is already in `package.json`.
- **No fork.** One `DocumentScanner.tsx` file. One `quality.ts`. One `translations.ts`.

---

## Verification Gates

1. `npm run build` zero errors.
2. `npm test` zero failures.
3. Grep audit: scanner has no `supabase` import, no `taskId`/`projectUnitId` references. Raw output.
4. Compliance smoke test: PDF + JPG + HEIC each produce identical `task_completions` rows compared to a pre-refactor capture (paste before/after). If row shape changes in any column, **stop and report**.
5. No new callers of `DocumentScanner` outside the existing two (`FileUploadTask.tsx`, `SubmissionStatusPortal.tsx`). Grep proves it.
6. Build report fully populated, including Open Question answers.

If any of 1–6 fails: **stop. Report. Do not declare complete.**

---

## Out of Scope (later)

- PRD-03 integration of the refactored scanner. Happens after PRD-03 ships its Phase 5; a small follow-up PR swaps the raw input for `<DocumentScanner>`.
- Telemetry on quality-gate trigger rate / override rate.
- Example image overlay ("what a good photo looks like").
- Page reordering UX improvements.
- Enhancement filters (auto contrast, B&W).
- Commercial SDK evaluation.
- Server-side quality re-validation.
- Lobby intake integration.
