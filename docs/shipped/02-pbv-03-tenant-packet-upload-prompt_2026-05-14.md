# Windsurf Prompt — PBV Tenant-Facing Packet Upload

**PRD:** `docs/02-pbv-03-tenant-packet-upload-prd_2026-05-14.md` (read the Amendment block at the top first — Open Questions are pre-answered)
**Build report (you create this):** `docs/build-reports/pbv-03-tenant-packet-upload-build-report_2026-05-14.md`
**Depends on:** `shipped/pbv-01-documents-decoupling-prd_2026-05-14.md` merged. `shipped/pbv-1.5-revisions-decoupling-prd_2026-05-14.md` merged. `stanton-workspace-document-lifecycle` merged. If `application_documents` does not exist or `application_document_revisions` does not exist, **STOP and report** — do not attempt to build this against `form_submission_documents`.
**Coordinates with:** PRD-02 — operationally independent. PRD-03 does not use `intake_batches` / `intake_pages` / OCR substrate. They coexist.

---

## Amendment 2026-05-14 — read first

The four Open Questions in the PRD have been **answered** during a cross-PRD audit. Do not re-investigate them. Specifically:

1. `uploaded_by_role` already accepts `'tenant'` — `supabase/migrations/20260514120000_application_documents.sql:91-92`. **Phase 1 migration does NOT modify this column.**
2. Token resolution: reuse pattern at `app/api/t/[token]/pbv-full-app/route.ts:26-31` (`tenant_access_token` lookup against `pbv_full_applications`).
3. Revision creation is **inlined per-route**, no centralized helper. Mirror the inlined pattern at `app/api/admin/applications/[anchor_type]/[anchor_id]/documents/upload/route.ts:143-158`. Do **not** refactor to a shared helper.
4. Legacy `/t/[token]` portal exists and writes to `form_submission_documents`. **Scope = Option B with TokenRouter redirect:** new endpoints under `/api/pbv-full-app/[token]/...`, `docs_portal_btn` link updated, `TokenRouter` adds a PBV redirect, `SubmissionStatusPortal` and `/api/t/[token]/documents/[documentId]` are **not modified** (they serve non-PBV).
5. Storage bucket is `form-submissions` (not `pbv-documents`). Path: `{application_id}/{doc_type}/{document_id}.{ext}` for first upload, `{application_id}/{doc_type}/{document_id}-r{revision}.{ext}` for revisions. **`storage_path` written to the DB row must exactly match where the file lands** — this was a real bug in PRD-02's commit route; do not repeat.

---

## Context

PBV applications require 15–25 supporting documents per household. Today the only working tenant-side path is walk-in to the office, which staff has to digitize manually. This build adds a mobile-first tenant document upload surface to the existing magic-link portal at `/pbv-full-app/[token]`. Tenants see their required document rows, upload one file per row, see status. No OCR, no page-splitting, no classification UI on the tenant side — those are staff tools (PRD-02).

The PRD is the source of truth. This prompt directs implementation.

**Architecture rule (binding):** Anchor is `(anchor_type='pbv_full_application', anchor_id=<pbv_full_applications.id>)`. Document writes go to `application_documents`. Replacements write revisions to `application_document_revisions` via the PRD-1.5 path. All event writes via `writePbvApplicationEvent`. No direct calls to `writeApplicationEvent`. No direct inserts into `application_events`. No writes to `form_submission_documents` from any code path in this build.

---

## Required reading before you start

1. **`docs/02-pbv-03-tenant-packet-upload-prd_2026-05-14.md`** — entire document.
2. **`docs/shipped/pbv-01-documents-decoupling-prd_2026-05-14.md`** + build report — `application_documents` shape, anchor pattern, write paths.
3. **`docs/shipped/pbv-1.5-revisions-decoupling-prd_2026-05-14.md`** + build report — `application_document_revisions` shape, revision write path entry point.
4. **`docs/shipped/stanton-workspace-document-lifecycle_prd_2026-05-13.md`** — `uploaded_by_role` enum, `upload_source` enum, lifecycle status semantics.
5. **`docs/verification-methodology_2026-05-13.md`** — test standards. Mandatory.
6. **`lib/events/application-events.ts`** — wrapper pattern. Add new event type here.
7. **`app/pbv-full-app/[token]/page.tsx`** — existing tenant portal (1500+ lines). The upload surface attaches here. Confirm the `t.docs_portal_btn` CTA target.
8. **`app/api/admin/pbv/full-applications/[id]/token/route.ts`** — magic-link token resolution. Reuse; do not re-implement.
9. **`lib/auth.ts`**, **`lib/audit.ts`**, **`lib/supabase.ts`** — session, audit, admin-client patterns.
10. **`lib/__tests__/schema-contract.test.ts`** + **`lib/__tests__/save-path-integration.test.ts`** — extend per Phase 1 + Phase 5.
11. **A staff upload route** (e.g., `app/api/admin/applications/[anchor_type]/[anchor_id]/...`) — copy the upload pattern for parity. Confirm filepath via grep.

---

## Closed decisions (do not relitigate)

Per PRD section "Closed Decisions" (as updated by the Amendment block):

1. Per-document file upload. One file → one document row. No OCR, no page-splitting, no classifier UI on tenant side.
2. Anchor: `pbv_full_application` only at the route boundary. Other values → 400.
3. All event writes via `writePbvApplicationEvent`.
4. New event type: `DOCUMENT_UPLOADED_BY_TENANT: 'document.uploaded_by_tenant'`. Add to `ApplicationEventType` in `lib/events/application-events.ts`.
5. Replace flow writes a new revision; **inline the insert** (no centralized helper). Mirror pattern at `app/api/admin/applications/[anchor_type]/[anchor_id]/documents/upload/route.ts:143-158`.
6. Single endpoint, single tx per upload: `POST /api/pbv-full-app/[token]/documents/[doc_row_id]/upload`.
7. File constraints: ≤25 MB. PDF, JPG, PNG, HEIC. HEIC → JPG via `sharp`.
8. Auth: magic-link token. Reuse `tenant_access_token` lookup at `app/api/t/[token]/pbv-full-app/route.ts:26-31`.
9. Storage: bucket `form-submissions`. Path `{application_id}/{doc_type}/{document_id}.{ext}` (first upload) or `{application_id}/{doc_type}/{document_id}-r{revision}.{ext}` (revision). `storage_path` in DB must exactly match where the file lands.
10. Scope = Option B with TokenRouter redirect. `SubmissionStatusPortal` and `/api/t/[token]/documents/[documentId]` are NOT modified.
11. Evidence standard: every code-claim backed by grep command + raw output.

---

## Open Questions — answered, do not re-investigate

See the Amendment block at the top. All four questions have grep evidence in the PRD. Re-asking is wasted work.

---

## Build this pass

Five phases per PRD section "Implementation Phases." Do not skip, merge, or reorder.

### Phase 1 — Schema + event type

- Migration `supabase/migrations/<ts>_tenant_packet_upload.sql`:
  - `IF NOT EXISTS` add `'tenant'` to `uploaded_by_role` if missing.
  - Create `pbv_document_label_translations` table (PK `(doc_type, language)`).
  - Seed translations for every PBV `doc_type` in EN/ES/PT (read from `form_document_templates WHERE form_id='pbv-full-application'`).
- Add `DOCUMENT_UPLOADED_BY_TENANT` to `ApplicationEventType`. Add payload type per PRD §Data Model.
- Extend `lib/__tests__/schema-contract.test.ts` for new table + new event type. Passes.

**Done when:**
- Migration applies clean. `\d application_documents` + `\d pbv_document_label_translations` posted in build report.
- `grep -n "DOCUMENT_UPLOADED_BY_TENANT" lib/events/application-events.ts` returns the definition. Raw output in build report.
- `grep -rn "DOCUMENT_UPLOADED_BY_TENANT" lib app` returns definition + zero call sites (call sites in Phase 3).
- Schema-contract test green.

### Phase 2 — Read endpoint

- `GET /api/pbv-full-app/[token]/documents/route.ts`:
  - Resolve token via existing guard (Open Question 2).
  - Read `application_documents` for the anchor pair, filter by status/required.
  - Join `pbv_document_label_translations` for the language param (default `'en'`).
  - Return shape per PRD §Core Features 4.

**Done when:**
- 200 + correct shape for valid token. Raw curl output.
- 404 for unknown token. 403 for expired. 400 for missing language.
- `grep -rn "pbv_document_label_translations" app/api/pbv-full-app` returns exactly one filepath (the new route).

### Phase 3 — Upload endpoint (no replace yet)

- `POST /api/pbv-full-app/[token]/documents/[doc_row_id]/upload/route.ts`:
  - Validate token, file presence, MIME, size, doc_row ownership, application not locked (`packet_locked === false`).
  - HEIC → JPG via `sharp` if applicable.
  - Single tx: write file fields into the target `application_documents` row (only when current `status='missing'`).
  - Storage upload inside the tx try/catch — failure rolls back.
  - Emit `packet_intake_started`, `document.uploaded_by_tenant`, `packet_intake_committed` via `writePbvApplicationEvent`. On error, emit `packet_intake_abandoned` outside tx.
  - `actor_user_id=null`, payload `{ actor_role: 'tenant', actor_anonymous: true }` on the started/abandoned events. Tenant identity is implicit in token.

**Done when:**
- Happy: PDF upload to missing row → `status='submitted'`, three events written. Raw curl + SQL.
- Locked-packet (`packet_locked=true`) → 409. Raw evidence.
- 26 MB → 413. Raw evidence.
- `.exe` → 415. Raw evidence.
- Wrong doc_row → 404. Raw evidence.
- `grep -rn "writePbvApplicationEvent" app/api/pbv-full-app` returns expected call sites (3 happy + 1 abandoned in upload route). Raw output.
- `grep -rn "writeApplicationEvent\b" app/api/pbv-full-app` returns 0.
- `grep -rn "INSERT INTO application_events" app/api/pbv-full-app` returns 0.

### Phase 4 — Replace path (revision)

- Extend upload endpoint: when target row's `status IN ('submitted','rejected')`, route to PRD-1.5 revision write path (symbol per Open Question 3).
- Storage path uses incremented `revision` segment.
- Parent row's `status` → `'submitted'`; `rejection_reason` clears if previously rejected.

**Done when:**
- Replace to submitted row → new row in `application_document_revisions`, parent `current_revision` increments, parent `status='submitted'`. Raw SQL.
- Replace to rejected row → `rejection_reason` cleared. Raw evidence.
- Old revision file remains in storage. `ls` confirmation.
- `grep -rn "application_document_revisions" app/api/pbv-full-app` returns the new call site only.

### Phase 5 — UI + verification

- New section/component on `/pbv-full-app/[token]` showing the document list, per-row upload/replace, progress indicator, language-aware labels, mobile-first styles.
- Touch targets ≥44px. Body text ≥16px. Language toggle visible without scrolling at 375px.
- Save-path integration tests for: happy upload, locked 409, oversize 413, wrong-MIME 415, wrong-token 403, abandoned-error.

**Done when:**
- All save-path cases green.
- `npm test` zero failures.
- `npm run build` zero errors. Strict TS — no new `any`.
- Mobile screenshot at 375px posted.
- All grep audits from Phases 1–4 re-run in verification section. Same raw output.
- Manual walkthrough on a test application: upload one PDF, verify count, replace, verify revision via SQL, verify PriorVersionsExpander on the admin surface.

---

## Tech constraints

- Next.js App Router
- Supabase admin client via `lib/supabase.ts`
- `sharp` for HEIC conversion (already in bundle — confirm via package.json grep)
- TypeScript strict — no new `any`
- Vitest
- Migrations idempotent (`IF NOT EXISTS`)
- No new libraries

---

## Hard NOs

- **Do NOT write to `form_submission_documents` from any code path in this build.** Anchor is `application_documents` only. If a write path still targets the old table, flag it as a PRD-01 bug, do not work around.
- **Do NOT delete files from storage on replace.** Old revisions preserved.
- **Do NOT let tenants delete documents.** No delete endpoint, no UI affordance.
- **Do NOT bypass `packet_locked`.** Locked applications reject all tenant uploads with 409.
- **Do NOT invent a synthetic user ID for tenants.** `actor_user_id=null`.
- **Do NOT add OCR, page-splitting, or classifier UI to the tenant side.** Those are staff tools (PRD-02).
- **Do NOT introduce a tenant-side custom doc affordance.** Custom doc creation is PRD-02 staff-only.
- **Do NOT change the staff review surface in this PRD.** Staff sees tenant uploads through existing surfaces unchanged.
- **Do NOT add a new storage bucket.** Reuse the existing PBV documents bucket.
- **Do NOT skip the verification phase.**
- **Do NOT collapse phases.**
- **Do NOT add placeholder code or TODOs.**

---

## Verification phase (mandatory)

End-to-end checks. Skipping any of these means the task is not complete.

1. **Migrations apply clean.** `\d application_documents` + `\d pbv_document_label_translations` posted. Translation row count = doc_type count × 3.
2. **Schema-contract test green.**
3. **`npm run build` zero errors.**
4. **TypeScript strict — no new `any`.**
5. **`npm test` zero failures.** Every new test green.
6. **End-to-end happy upload.** Tenant token → 200 → row in `application_documents` with `uploaded_by_role='tenant'` → three events. Raw curl + SQL.
7. **Replace test.** Submitted-row replace → revision appended → parent updated. Raw SQL.
8. **Locked-packet 409.** Raw curl.
9. **Bad token 403.** Raw curl.
10. **Abandoned path.** Forced storage failure → tx rolls back → `packet_intake_abandoned` written. Raw evidence.
11. **Grep audits:**
    - `writePbvApplicationEvent` in `app/api/pbv-full-app` = expected count.
    - `writeApplicationEvent` direct = 0.
    - `INSERT INTO application_events` outside `lib/events/application-events.ts` = 0.
    - `application_document_revisions` in tenant routes = 1.
12. **Mobile screenshot at 375px.** Touch-target measurement note.
13. **No leakage.** Tenant routes do not query `form_submission_documents`. Grep = 0.

If any of 1–13 fails, **do not declare done.** Stop, report, await instruction.

---

## Build report requirements

Create `docs/build-reports/pbv-03-tenant-packet-upload-build-report_2026-05-14.md`:

1. **Pre-build decisions.** Answers to all four Open Questions with grep evidence.
2. **Migrations.** File path, applied Y/N, `\d` output for new table + modified columns, seed row count by language.
3. **PRD goals checklist.** Every Goal with `[x]` 