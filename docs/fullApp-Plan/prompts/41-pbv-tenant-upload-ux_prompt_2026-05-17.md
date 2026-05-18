# Prompt — PRD-41: Tenant Upload UX

**Date:** 2026-05-17
**Pairs with:** `docs/fullApp-Plan/41-pbv-tenant-upload-ux_prd_2026-05-17.md`
**Target branch:** `feat/pbv-tenant-upload-ux-41`

---

## DO NOT START YET

PRD-41 is captured for future build. Prerequisites:
1. **PRD-40 polish defects shipped** — fix the seven smaller defects from `tasks/OVERNIGHT_WALKTHROUGH_2026-05-17.md`.
2. **Defects #12 and #13 fixed** — the two server-side 500s (generate-forms and tenant upload). Both surfaced during PRD-39 re-verification. PRD-41 is moot if uploads themselves don't work.

When both prerequisites are done, read this prompt and start.

---

## Read first

1. The PRD: `docs/fullApp-Plan/41-pbv-tenant-upload-ux_prd_2026-05-17.md`
2. The PRD-39 build report for context on what's already wired: `docs/build-reports/39-pbv-accept-apps-blockers-build-report_2026-05-17.md`
3. The existing tenant upload component: `components/pbv/TenantDocumentUpload.tsx`
4. The upload route: `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts`
5. Test fixtures already generated for verification: list them with `ls tests/fixtures/`

Do NOT pre-read the API routes for hash/bulk-apply — they don't exist yet, you're creating them.

---

## What you're building

Four features that improve tenant document upload UX:

1. **F1** — Hash-based dedup detection + "apply to similar slots" dialog
2. **F2** — Drag-drop multi-file upload zone with per-file slot assignment
3. **F3** — Per-doc plain-language help (collapsible)
4. **F4** — Visual progress bar on dashboard

Total target: 3-4 days if no surprises.

---

## Order of operations

**Build in this order: F4 → F3 → F1 → F2.**

Rationale:
- F4 is cosmetic, low-risk, lets you see progress feedback while building the rest.
- F3 is content-heavy but low-risk (no new endpoints, just a JSON file and an expander).
- F1 introduces the schema migration + hash plumbing — biggest single piece, highest test value.
- F2 builds on F1 (dedup detection should already work when F2 ships, so multi-file uploads can trigger it naturally).

---

## Step 1 — F4 — Progress bar

**File:** `components/pbv/sign/TenantDashboard.tsx`

Replace the existing "0 of 22 uploaded." text with a visual progress bar:
- Renders inside the "Upload required documents" task card.
- Reads `data.documents.uploaded_required_count / data.documents.total_required_count` (or whatever the bootstrap surfaces — check `useDashboardState` for the exact field names).
- Color tiers: neutral grey at 0%, amber 1-99%, green 100%.
- Text label: "12 of 22 required documents uploaded".
- If `optional_uploaded_count > 0`, append small secondary text: "+3 optional uploaded".

Pure UI change. No backend touches. Translate label string in en/es/pt.

**Verify:** Take screenshot of dashboard at 0/22, ~half-uploaded, and 22/22 states.

---

## Step 2 — F3 — Per-doc help content

**Files:**
- New: `lib/pbv/docTypeHelp.ts`
- Modify: `components/pbv/TenantDocumentUpload.tsx` (add expander UI)

**docTypeHelp.ts shape:**
```ts
export type DocHelpText = { en: string; es: string; pt: string };
export const DOC_TYPE_HELP: Record<string, DocHelpText> = {
  paystubs: {
    en: "Your most recent pay statements showing earnings, deductions, and YTD totals...",
    es: "...",
    pt: "...",
  },
  // ... all 31 doc types
};
```

**Source the doc_type list** from the seeded `form_document_templates` (the bridge in `intake/complete/route.ts` reads `form_document_templates` where `form_id = 'pbv-full-application'`). Cover every doc_type in that list. Don't ship with any missing.

**Translations:** if you can't author Spanish/Portuguese yourself, ship en strings as placeholders with a TODO comment and a console.warn in dev mode when es/pt is requested but only en exists. Note the TODOs in the build report.

**Expander UI:** Small "?" icon next to the doc title. Click expands a paragraph below. Closes by clicking again or clicking outside. Match existing Stanton styling.

**Verify:** All 31 rows show a "?" icon. Click each (or sample 5), confirm help text appears, switches language with EN/ES/PT toggle.

---

## Step 3 — F1 — Hash-based dedup

**This is the biggest piece. Multiple sub-tasks.**

### 3a — Schema migration

**File:** `supabase/migrations/<date>_pbv_application_documents_file_hash.sql`

```sql
ALTER TABLE application_documents
  ADD COLUMN file_hash TEXT NULL;

CREATE INDEX idx_application_documents_file_hash
  ON application_documents (anchor_id, file_hash)
  WHERE file_hash IS NOT NULL;

COMMENT ON COLUMN application_documents.file_hash
  IS 'SHA-256 hex of uploaded file content. Used for dedup detection across slots on the same application.';
```

Apply migration. Confirm column exists via `\d application_documents` in psql or equivalent.

### 3b — Hash on upload

**File:** `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts`

After `fileBuffer` is constructed (or directly from the multipart File), compute SHA-256:
```ts
import { createHash } from 'crypto';
const fileHash = createHash('sha256').update(fileBuffer).digest('hex');
```

Persist to the existing `updateData` object that gets passed to the row update. The new column is `file_hash`.

Do the same in the admin upload route(s) — staff uploads should also populate the hash.

### 3c — by-hash endpoint

**File:** `app/api/t/[token]/pbv-full-app/documents/by-hash/route.ts`

`GET /api/t/[token]/pbv-full-app/documents/by-hash?hash=<sha256>&exclude_doc_id=<id>`

Returns:
```json
{
  "matches": [
    {
      "id": "<application_documents.id>",
      "doc_type": "checking_bank_statement",
      "label": "Checking Account Bank Statement",
      "category": "Banking & Assets",
      "person_slot": 1,
      "status": "missing"
    }
  ],
  "compatible_missing_slots": [
    { "id": "<id>", "doc_type": "...", "label": "...", "category": "...", "person_slot": 1 }
  ]
}
```

- `matches` = rows where `file_hash = ?` AND `anchor_id = <this app>` AND `id != <exclude>`.
- `compatible_missing_slots` = rows on the same app, status = 'missing', SAME `category` as the original upload, SAME `person_slot`.

Filter by anchor_id strictly — never leak cross-application data.

### 3d — bulk-apply endpoint

**File:** `app/api/t/[token]/pbv-full-app/documents/bulk-apply/route.ts`

`POST /api/t/[token]/pbv-full-app/documents/bulk-apply`

Body:
```json
{
  "source_doc_id": "<id of the just-uploaded doc>",
  "target_doc_ids": ["<id>", "<id>"]
}
```

Behavior:
- Load the source doc. Get its `storage_path`, `file_hash`, `file_name`, etc.
- For each target_doc_id: verify the target is on the same anchor_id, status is 'missing', category matches the source. Reject any that don't match (security).
- Update target rows: set `storage_path`, `file_hash`, `file_name`, `status = 'submitted'`, `uploaded_by_role`, `uploaded_at`, `revision = revision + 1`.
- DO NOT copy bytes — both rows reference the same storage_path. Saves storage.
- Return list of updated doc IDs.

### 3e — Dedup dialog

**File:** `components/pbv/DedupApplyDialog.tsx`

Renders after a successful upload IF the by-hash response had `compatible_missing_slots.length > 0`.

UI:
- Title: "This file fits other slots too"
- Body: "You uploaded [filename]. The same file can satisfy these other required documents:"
- Checkbox list: one per `compatible_missing_slots` entry, label = "<category> — <doc label>"
- All checkboxes default checked.
- Buttons: "No thanks" (closes) and "Apply to N selected" (calls bulk-apply, then refreshes dashboard state).

### 3f — Wire into TenantDocumentUpload + DocumentScanner

After existing upload success handler, before the dashboard refresh:
1. Fetch by-hash.
2. If matches exist, mount DedupApplyDialog.
3. On confirm, call bulk-apply.
4. Refresh.

Same in admin upload flow (UploadDialog success handler).

**Verify with fixtures:**
- Upload `paystub-week1.pdf` to Paystubs. No matches expected (first upload).
- Upload `paystub-week1-COPY.pdf` to Insurance Settlement. Different category → no dedup suggestion (compatible_missing_slots filtered).
- Upload `income-verification.pdf` (same hash as week1) to another Income Verification slot if one exists, or to Paystubs again → dedup suggestion appears.

---

## Step 4 — F2 — Drag-drop multi-file zone

**Files:**
- New: `components/pbv/MultiFileDropZone.tsx`
- Modify: `app/pbv-full-app/[token]/documents/page.tsx` (mount at top)

**Component shape:**
- Drop zone (HTML5 drag-drop + click-to-select fallback)
- Pending files panel below: one row per file
  - Filename + size + thumbnail (for images) or PDF icon
  - Dropdown: assign to slot. Options = all currently MISSING slots, grouped by category.
  - If two pending files target the same slot, second one shows error icon + tooltip.
  - Remove button per row.
- Bottom: "Upload all (N)" button. Disabled until every pending file has a slot.

**Upload orchestration:**
- On confirm: fire N upload requests in parallel (cap at 4 concurrent to avoid overwhelming the dev server).
- Each upload triggers F1's dedup check independently.
- If multiple uploads have the same hash, batch dedup detection: one dialog at the end showing all hash matches.
- Show per-file progress (uploading / done / error) in the pending panel.

**Slot auto-suggestion (best-effort, not blocking):**
- For each dropped file, match filename against slot label fragments. If filename contains "paystub", default the dropdown to a Paystubs slot. Optional polish — fine to skip if it complicates the build.

**Verify with fixtures:**
- Drop `paystub-week1.pdf`, `bank-statement-checking.pdf`, `ssi-award-letter.pdf` at once. Three pending rows appear. Assign each to a slot. Confirm. All three land. Dedup dialog may fire if any matches existing uploads.
- Drop `oversized-30mb.pdf` (>25MB) — should be rejected client-side with a clear error before upload.
- Drop `unsupported-document.txt` — should be rejected client-side (MIME type not allowed).

---

## Step 5 — End-to-end verification

Use chrome-devtools-mcp:

1. Tenant logs into /documents.
2. Drag-drop 5 mixed files including a same-hash duplicate.
3. Assign slots, confirm upload.
4. Verify all land.
5. Verify dedup dialog fires for the duplicate.
6. Verify progress bar reflects upload state.
7. Click "?" icon on three different doc types, confirm help text appears in en, es, pt.
8. Take screenshots of each major state.

Append "F4 progress bar / F3 help / F1 dedup / F2 drop zone — verified" to the PRD-41 build report with screenshot references.

---

## What to deliver

- Branch `feat/pbv-tenant-upload-ux-41`
- Migration applied
- All four features implemented
- All 31 doc types have help text (translations or TODO markers)
- Build report at `docs/build-reports/41-pbv-tenant-upload-ux-build-report_2026-05-17.md`
- PRD-41 status updated from "Draft" to "Shipped"

---

## Gotchas

- **Don't trigger dedup on file replace.** When a tenant replaces an existing doc, the new hash replaces the old. Don't suggest "apply to other slots" if the upload is a replacement, only on first upload.
- **Don't leak cross-application data.** by-hash endpoint MUST scope to `anchor_id`. If the same paystub hash exists on another tenant's app, do NOT suggest it.
- **Storage path sharing.** When bulk-apply links multiple rows to the same storage_path, deletion semantics matter. Document the behavior: if any row is deleted/replaced, the storage object stays as long as any other row references it. Reference-count if needed.
- **Hash on the server, not the client.** Client-side hash is a nice-to-have for UX (predict dedup before upload), but the AUTHORITATIVE hash is server-side. Client-computed hashes can lie.
- **Test fixture availability:** fixtures already exist at `tests/fixtures/`. Don't recreate.

---

## When something is ambiguous

Stop and ask. Specifically:
- If the form_document_templates list of doc_types differs from what the PRD assumes (31), reconcile and update the PRD.
- If `category` isn't a column on application_documents and lives in the template, adjust the compatibility query.
- If the existing TenantDocumentUpload component is too tangled to add expanders cleanly, factor it before adding F3 — but flag the refactor in the build report.
- If the migration fails (column already exists in some form), inspect schema and report.
