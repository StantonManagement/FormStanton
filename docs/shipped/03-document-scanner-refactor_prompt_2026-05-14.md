# Windsurf Prompt — Document Scanner Substrate-Agnostic Refactor

**PRD:** `docs/03-document-scanner-refactor_prd_2026-05-14.md` (read end-to-end before writing any code)
**Build report (you create this):** `docs/build-reports/document-scanner-refactor-build-report_2026-05-14.md`
**Depends on:** None. This is a refactor of an existing live component.
**Coordinates with:** PRD-03 — not blocking. PRD-03 ships its tenant upload with raw file input first; the refactored scanner replaces that input in a small follow-up after both this PRD and PRD-03 are merged.

---

## Context

`components/DocumentScanner/DocumentScanner.tsx` (586 lines) is built, working, and shipping in the compliance portal via `components/portal/FileUploadTask.tsx`. The component's capabilities (camera capture, jscanify edge detection, blur/resolution/darkness quality gate, HEIC→JPEG, multi-page PDF) are all useful regardless of substrate — but its current API hard-codes `taskId` + `projectUnitId` and uploads directly to Supabase + writes `task_completions`. That coupling blocks PBV reuse.

This refactor strips the substrate coupling. Scanner becomes presentation-layer only: produces a `File` + metadata, hands it to a caller via `onComplete`, doesn't touch storage or the DB. The compliance-portal caller (`FileUploadTask.tsx`) is updated in the same PR to do the upload + `task_completions` write that used to live inside the scanner. End-state of the compliance portal must be **byte-for-byte identical** to today.

The PRD is the source of truth. This prompt directs implementation.

**Architecture rule (binding):** Scanner does not import `supabase`. Scanner does not know what `taskId` or `projectUnitId` are. Scanner does not write to any DB or storage. Caller does. Compliance behavior preserved exactly — no silent improvements.

---

## Required reading before you start

1. **`docs/03-document-scanner-refactor_prd_2026-05-14.md`** — entire document.
2. **`z - Archive/document-scanner_prd_2026-04-23.md`** — original spec for context on what was built. Do NOT relitigate scope from this doc; the refactor is the current contract.
3. **`components/DocumentScanner/DocumentScanner.tsx`** — the file you're refactoring. Read end-to-end.
4. **`components/DocumentScanner/quality.ts`** + **`components/DocumentScanner/translations.ts`** — untouched but consumed.
5. **`components/portal/FileUploadTask.tsx`** — the caller you're updating.
6. **`components/SubmissionStatusPortal.tsx`** — confirm it only consumes `evaluateImageQuality` from `quality.ts`. Not modified by this PR.
7. **`lib/supabase.ts`** — confirm the existing client export pattern. The caller uses it; the scanner no longer imports it.

---

## Closed decisions (do not relitigate)

Per PRD section "Closed Decisions":

1. Refactor in place — no new component file.
2. New API: `onComplete: (file: File, metadata: ScannerMetadata) => Promise<void> | void`. Caller handles upload + DB write.
3. `Metadata` type renamed to `ScannerMetadata` (export `Metadata` as deprecated alias for one cycle).
4. `FileUploadTask.tsx` is updated as part of this PR. End-state byte-for-byte identical to today.
5. `SubmissionStatusPortal.tsx` not modified — only consumes `evaluateImageQuality` helper.
6. No new dependencies. No new tables. No new columns.
7. Evidence standard: every code-claim backed by grep command + raw output.

---

## Decisions still open — confirm before coding

Per PRD section "Open Questions for Windsurf":

1. **Existing storage path convention in `FileUploadTask.tsx`.** Grep the scanner's current upload destination. Post the bucket name + path template. Preserve exactly.
2. **`task_completions` write contract.** Grep the columns currently being set. Post them. Preserve exactly.
3. **Other callers.** Grep `components/DocumentScanner` across `app/`, `components/`, `lib/` to confirm `FileUploadTask.tsx` is the only consumer of the full component. Other files may import helpers from `quality.ts` or `translations.ts` — those are fine. Post the raw grep.

If grep shows more than one full-component caller, **STOP and report** before proceeding.

---

## Build this pass

Two phases per PRD section "Implementation Phases."

### Phase 1 — Refactor scanner + update compliance caller

Update `components/DocumentScanner/DocumentScanner.tsx`:
- Remove `import { supabase } from '@/lib/supabase'`.
- Remove `taskId` and `projectUnitId` from `DocumentScannerProps`.
- Remove the internal "uploading" stage and Supabase upload logic.
- Change `onComplete` signature from `(evidenceUrl: string, metadata: Metadata) => void` to `(file: File, metadata: ScannerMetadata) => Promise<void> | void`.
- After the user taps "Use this," call `await props.onComplete(file, metadata)` inside a try/catch. On error, surface a retry button with a translated error message.
- Rename exported `Metadata` to `ScannerMetadata`. Add `export type Metadata = ScannerMetadata` as a deprecated alias for backward import compatibility.

Update `components/portal/FileUploadTask.tsx`:
- Call `<DocumentScanner>` with the new API (no `taskId`, no `projectUnitId`).
- In the `onComplete` callback: do the Supabase upload (using the path convention confirmed via Open Question 1) and the `task_completions` write (using the columns confirmed via Open Question 2). Then call the existing parent `onComplete(evidenceUrl, metadata)` callback.
- Byte-for-byte preserve current behavior — storage path, bucket, DB columns, values, ordering.

**Done when:**
- `grep -n "supabase" components/DocumentScanner/DocumentScanner.tsx` returns 0 hits. Raw output in build report.
- `grep -rn "taskId\|projectUnitId" components/DocumentScanner/` returns 0 hits. Raw output.
- `grep -rn "import.*DocumentScanner" components/ app/` returns the same caller set as pre-refactor (only `FileUploadTask.tsx` for the full component). Raw output.
- Compliance portal smoke test: upload PDF + JPG + HEIC. For each, paste the `task_completions` row written. Compared to a pre-refactor snapshot of the same flow with the same inputs, every column value identical.
- `npm run build` zero errors. Strict TS, no new `any`.
- `npm test` zero failures.

### Phase 2 — Verification

No code. Re-run grep audit and the smoke test. Paste all raw outputs in the build report.

**Done when:**
- All Phase 1 grep audits re-run, same output.
- `task_completions` byte-for-byte diff posted (pre vs post refactor for identical inputs).
- Build report sections fully populated, including answers to all three Open Questions.

---

## Tech constraints

- Next.js App Router
- TypeScript strict — no new `any`
- React 18
- No new dependencies (jscanify, heic2any, pdf-lib already in bundle)
- Migrations: none
- Vitest if you add tests, but tests are not required for this PR

---

## Hard NOs

- **Do NOT add or modify capabilities.** No new quality thresholds, no new languages, no UX polish, no telemetry. Refactor only.
- **Do NOT fork the component.** One file at `components/DocumentScanner/DocumentScanner.tsx`. No `DocumentScannerV2`.
- **Do NOT modify `quality.ts` or `translations.ts`.** They are reused unchanged.
- **Do NOT modify `SubmissionStatusPortal.tsx`.** It only imports a helper from `quality.ts`. No changes required.
- **Do NOT silently "improve" the compliance flow.** Same storage path, same DB columns, same values. If you see something broken, note it in "Pre-existing issues observed" and leave it.
- **Do NOT add a new bucket.** Whatever bucket the scanner uploads to today is what the caller will continue using.
- **Do NOT introduce a new Supabase client pattern.** Caller uses the existing `@/lib/supabase` export.
- **Do NOT integrate with PBV in this PR.** PBV integration is a separate follow-up after PRD-03 ships.
- **Do NOT remove the `Metadata` type alias.** It stays as a deprecated alias for one release cycle. Other code may still import it by that name.
- **Do NOT skip the verification phase.**

---

## Verification phase (mandatory)

End-to-end checks. Skipping any of these means the task is not complete.

1. **`npm run build` zero errors.** Raw output snippet.
2. **`npm test` zero failures.** Raw Vitest output.
3. **TypeScript strict.** Confirmed by clean build.
4. **Scanner has no substrate coupling.** Grep audit:
   - `grep -n "supabase\|taskId\|projectUnitId" components/DocumentScanner/DocumentScanner.tsx` = 0 hits.
   - Raw output in build report.
5. **Caller updated.** Grep `FileUploadTask.tsx` for `supabase` upload + `task_completions` write — both present and call the new API correctly. Raw output.
6. **No new full-component callers.** Grep confirms only `FileUploadTask.tsx` consumes the full component.
7. **Byte-for-byte compliance preservation.** Upload PDF, JPG, HEIC via the compliance portal. For each, post the `task_completions` row written. Compared to pre-refactor (capture rows from prod or a clean checkout before this PR), every column identical.
8. **No deprecated-alias removal.** `export type Metadata = ScannerMetadata` is present.
9. **No new dependencies.** `git diff package.json` shows zero changes (or only `package.json` is untouched).

If any of 1–9 fails, **do not declare done.** Stop, report, await instruction.

---

## Build report requirements

Create `docs/build-reports/document-scanner-refactor-build-report_2026-05-14.md`:

1. **Pre-build decisions.** Answers to all three Open Questions with grep evidence + line references.
2. **Files modified.** Summary per file. Especially `DocumentScanner.tsx` and `FileUploadTask.tsx`.
3. **API diff.** Before/after of `DocumentScannerProps` and the `Metadata`/`ScannerMetadata` exports.
4. **Compliance preservation diff.** For each of PDF / JPG / HEIC inputs, paste the `task_completions` row written, pre vs post. Every column identical or build fails.
5. **Test results.** Vitest output. Build output.
6. **Grep audit results.** All raw commands + outputs from verification §4–§6.
7. **Deviations from PRD.** Reasoning. Empty if none.
8. **Pre-existing issues observed.** Anything broken/risky out of scope. Do not fix.
9. **Verification phase results.** Items 1–9 with pass/fail + evidence.

---

## When you finish

Reply in chat with:
- Build report length + section count, confirmation every section is populated.
- Verification items 1–9 pass/fail status.
- `task_completions` byte-for-byte diff result.
- Grep audit summary (raw counts).
- Anything that blocked you.

If any test fails, any verification item fails, or any check returns the wrong status, do not declare complete. Leave the task in progress and stop.
