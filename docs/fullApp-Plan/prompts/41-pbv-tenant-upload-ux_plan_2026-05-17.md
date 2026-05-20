# PRD-41 Implementation Plan — Tenant Upload UX

**Date:** 2026-05-17
**Status:** Awaiting user confirmation
**Target Branch:** `feat/pbv-tenant-upload-ux-41`
**Estimated Duration:** 3-4 days

---

## Prerequisites Verified

| Item | Status | Notes |
|------|--------|-------|
| Upload endpoint functional | ✅ User confirmed PDF uploads work | Defect #13 appears resolved |
| Test fixtures available | ✅ Found at `tests/fixtures/` | paystub-week1.pdf, paystub-week1-COPY.pdf, etc. |
| Dashboard data structure | ✅ `upload_total` and `upload_complete` exist | In `useDashboardState.ts` |
| Document categories | ✅ 6 categories in TenantDocumentUpload | income, assets, medical_childcare, immigration, signed_forms, custom |

**Risk:** `pbv_document_requirements` table is empty — may affect generate-forms if upload triggers it. We'll monitor during F1 testing.

---

## Build Order (F4 → F3 → F1 → F2)

### Phase 1: F4 — Progress Bar on Dashboard
**Files:**
- `components/pbv/sign/TenantDashboard.tsx` — modify card3 subtitle area
- `components/pbv/sign/DocumentProgressBar.tsx` — new component

**Changes:**
1. Create visual progress bar component:
   - Input: `uploaded`, `total`, `optionalUploaded` (optional)
   - Color tiers: neutral (0%), amber (1-99%), green (100%)
   - Label: "{uploaded} of {total} required documents uploaded"
   - Secondary label: "+{optionalUploaded} optional uploaded" (if > 0)

2. Integrate into `TenantDashboard` card3:
   - Replace text subtitle with progress bar
   - Keep existing `card3_sub_pending` copy as fallback

3. Add translations:
   - `card3_progress_label: (done, total) => `${done} of ${total} required documents uploaded``
   - `card3_progress_optional: (n) => `+${n} optional uploaded``

**Verification:** Screenshots at 0/22, 11/22, 22/22 states.

---

### Phase 2: F3 — Per-Document Help Content
**Files:**
- `lib/pbv/docTypeHelp.ts` — new content file
- `components/pbv/TenantDocumentUpload.tsx` — add expander UI

**Step 1: Document the 31 doc types**
First, query `form_document_templates` where `form_id = 'pbv-full-application'` to get the definitive list of `doc_type` values.

**Step 2: Create help content file**
```ts
export type DocHelpText = { en: string; es: string; pt: string };
export const DOC_TYPE_HELP: Record<string, DocHelpText> = {
  paystubs: {
    en: "Your most recent pay statements showing earnings, deductions, and YTD totals. Ask your employer for the last 4 weekly stubs or 2 bi-weekly stubs. Most employers can email these or print from your employee portal.",
    es: "...",
    pt: "...",
  },
  // ... all 31 doc types
};

export function getDocHelp(docType: string, lang: 'en'|'es'|'pt'): string {
  const help = DOC_TYPE_HELP[docType];
  if (!help) {
    console.warn(`[docTypeHelp] Missing help for doc_type: ${docType}`);
    return '';
  }
  // Fallback chain: requested lang → en → empty
  return help[lang] || help.en || '';
}
```

**Step 3: Add expander UI to TenantDocumentUpload**
- Add "?" icon next to doc title in each row
- Click toggles expand/collapse of help text
- Help text renders below title, before status badge
- Language switches with the page language

**Translation coverage:**
- If es/pt translations unavailable, use en as placeholder
- Add TODO comments for missing translations
- Console.warn in dev mode when fallback occurs

**Verification:** All 31 doc types show "?" icon; sample 5 docs confirm expander works in all 3 languages.

---

### Phase 3: F1 — Hash-Based Deduplication
**Files:**
- `supabase/migrations/<date>_pbv_application_documents_file_hash.sql` — schema
- `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts` — add hash
- `app/api/t/[token]/pbv-full-app/documents/by-hash/route.ts` — new endpoint
- `app/api/t/[token]/pbv-full-app/documents/bulk-apply/route.ts` — new endpoint
- `lib/pbv/computeFileHash.ts` — client-side hash util
- `components/pbv/DedupApplyDialog.tsx` — new dialog component
- `components/pbv/TenantDocumentUpload.tsx` — integrate dedup flow
- `app/api/admin/.../documents/upload/route.ts` — also add hash (admin path)

**Step 1: Schema migration**
```sql
ALTER TABLE application_documents
  ADD COLUMN file_hash TEXT NULL;

CREATE INDEX idx_application_documents_file_hash
  ON application_documents (anchor_id, file_hash)
  WHERE file_hash IS NOT NULL;

COMMENT ON COLUMN application_documents.file_hash
  IS 'SHA-256 hex of uploaded file content. Used for dedup detection across slots on the same application.';
```

**Step 2: Server-side hash on upload**
In `upload/route.ts`:
```ts
import { createHash } from 'crypto';
// After fileBuffer is constructed:
const fileHash = createHash('sha256').update(fileBuffer).digest('hex');
// Add to updateData: file_hash: fileHash
```

Do the same for admin upload routes.

**Step 3: by-hash endpoint**
`GET /api/t/[token]/pbv-full-app/documents/by-hash?hash=<sha256>&exclude_doc_id=<id>`

Returns:
```json
{
  "matches": [...],
  "compatible_missing_slots": [
    { "id": "...", "doc_type": "...", "label": "...", "category": "...", "person_slot": 1 }
  ]
}
```

- `matches`: rows with same hash on same application (excluding `exclude_doc_id`)
- `compatible_missing_slots`: missing slots on same app with same `category` and `person_slot`

**Security:** Strictly scope to `anchor_id` — never leak cross-application data.

**Step 4: bulk-apply endpoint**
`POST /api/t/[token]/pbv-full-app/documents/bulk-apply`

Body: `{ "source_doc_id": "...", "target_doc_ids": ["...", "..."] }`

Behavior:
1. Load source doc, get `storage_path`, `file_hash`, `file_name`
2. For each target: verify same `anchor_id`, status='missing', same category
3. Update targets: set `storage_path`, `file_hash`, `file_name`, `status='submitted'`, `uploaded_by_role`, `uploaded_at`, `revision = revision + 1`
4. Return list of updated doc IDs

**Storage semantics:** Multiple rows reference same `storage_path` — no byte duplication.

**Step 5: DedupApplyDialog component**
Props:
```ts
interface Props {
  isOpen: boolean;
  filename: string;
  compatibleSlots: CompatibleSlot[];
  onClose: () => void;
  onApply: (selectedIds: string[]) => void;
}
```

UI:
- Title: "This file fits other slots too"
- Body: "You uploaded {filename}. The same file can satisfy these other required documents:"
- Checkbox list (all checked by default): "{category} — {label}"
- Buttons: "No thanks" (secondary), "Apply to {N} selected" (primary)

**Step 6: Integration**
In `TenantDocumentUpload` after successful upload:
1. If upload was a replacement (previous status was 'submitted' or 'rejected'), skip dedup check
2. Otherwise, call `by-hash` endpoint
3. If `compatible_missing_slots.length > 0`, mount `DedupApplyDialog`
4. On confirm, call `bulk-apply`
5. Refresh documents list

**Gotcha:** Don't trigger dedup on file replace — only on first upload to a slot.

**Verification with fixtures:**
- Upload `paystub-week1.pdf` to Paystubs → no dedup (first)
- Upload `paystub-week1-COPY.pdf` (same hash) to different Income slot → dedup suggests
- Upload same hash to different category (e.g., Banking) → no suggestion (filtered)
- Cross-application test: same hash on different app → by-hash returns empty

---

### Phase 4: F2 — Drag-Drop Multi-File Upload Zone
**Files:**
- `components/pbv/MultiFileDropZone.tsx` — new component
- `app/pbv-full-app/[token]/documents/page.tsx` — mount drop zone

**Component structure:**
```tsx
interface PendingFile {
  id: string; // client UUID
  file: File;
  fileHash: string; // computed via Web Crypto API
  assignedSlotId: string | null;
  status: 'pending' | 'uploading' | 'done' | 'error';
  errorMessage?: string;
}

interface Props {
  token: string;
  missingSlots: MissingSlot[]; // all slots with status='missing'
  onUploadsComplete: () => void; // refresh parent
}
```

**UI:**
1. **Drop zone:** Dashed border area with "Drop files here or click to select multiple"
2. **Pending panel:** Below drop zone, one row per file:
   - Thumbnail (image) or PDF icon
   - Filename, size (formatted)
   - Slot assignment dropdown (grouped by category)
   - Remove button (X)
   - Error indicator (if validation fails)
3. **Conflict handling:** If two pending files assigned to same slot, show error icon + tooltip
4. **Upload button:** "Upload all ({N})" — disabled until all files have slot assignments

**Slot auto-suggestion (best-effort):**
Match filename against slot label fragments:
- Filename contains "paystub" → suggest Paystubs slot
- Filename contains "bank" + "checking" → suggest Checking Bank Statement slot
- No match → no default (user picks)

**Upload orchestration:**
- On confirm: upload up to 4 files concurrently
- Each upload triggers F1's dedup flow independently
- Collect all dedup results; if multiple files have hash matches, batch into single dialog at end
- Per-file progress in pending panel

**Client-side validation (before upload):**
- File size > 25MB → reject with clear error
- MIME type not in allowed list → reject
- Duplicate filename in pending list → allow (user may intend different slots)

**Verification:**
- Drop 3 files at once → all appear in pending panel
- Assign each to slot → "Upload all" enables
- Click upload → all 3 land, statuses flip
- Include `paystub-week1.pdf` and `paystub-week1-COPY.pdf` → dedup dialog batches both suggestions
- Drop `oversized-30mb.pdf` → rejected client-side before upload
- Drop `unsupported-document.txt` → rejected client-side

---

## Implementation Checklist

### Phase 1: F4 — Progress Bar
- [ ] Create `DocumentProgressBar.tsx` component
- [ ] Add to `TenantDashboard.tsx` card3
- [ ] Add translations (en/es/pt)
- [ ] Verify screenshots at 0%, 50%, 100%

### Phase 2: F3 — Help Content
- [ ] Query `form_document_templates` for doc_type list
- [ ] Create `lib/pbv/docTypeHelp.ts` with all 31 types
- [ ] Add expander UI to `TenantDocumentUpload.tsx`
- [ ] Add translations (TODO markers for es/pt if needed)
- [ ] Verify all 31 docs have "?" icon and expander works

### Phase 3: F1 — Hash Deduplication
- [ ] Create and apply schema migration
- [ ] Add hash computation to tenant upload route
- [ ] Add hash computation to admin upload routes
- [ ] Create `by-hash` endpoint
- [ ] Create `bulk-apply` endpoint
- [ ] Create `DedupApplyDialog.tsx` component
- [ ] Create `lib/pbv/computeFileHash.ts` (client-side util)
- [ ] Integrate dedup flow into `TenantDocumentUpload.tsx`
- [ ] Verify with test fixtures (paystub-week1 + COPY)

### Phase 4: F2 — Multi-File Drop Zone
- [ ] Create `MultiFileDropZone.tsx` component
- [ ] Add to `app/pbv-full-app/[token]/documents/page.tsx`
- [ ] Implement slot auto-suggestion
- [ ] Implement parallel upload (max 4 concurrent)
- [ ] Implement batched dedup dialog
- [ ] Verify with 3-file drop test
- [ ] Verify oversized and unsupported file rejection

### Phase 5: End-to-End Verification
- [ ] Tenant logs into /documents
- [ ] Drag-drop 5 mixed files including duplicate
- [ ] Assign slots, confirm upload
- [ ] Verify all land
- [ ] Verify dedup dialog fires for duplicate
- [ ] Verify progress bar reflects upload state
- [ ] Click "?" icon on 3 different doc types
- [ ] Take screenshots of each major state
- [ ] Update build report with results

---

## File Inventory

### New Files
| Path | Purpose |
|------|---------|
| `components/pbv/DocumentProgressBar.tsx` | F4 progress bar UI |
| `lib/pbv/docTypeHelp.ts` | F3 help content for 31 doc types |
| `supabase/migrations/<date>_pbv_application_documents_file_hash.sql` | F1 schema migration |
| `app/api/t/[token]/pbv-full-app/documents/by-hash/route.ts` | F1 dedup query endpoint |
| `app/api/t/[token]/pbv-full-app/documents/bulk-apply/route.ts` | F1 bulk-apply endpoint |
| `lib/pbv/computeFileHash.ts` | F1 client-side hash utility |
| `components/pbv/DedupApplyDialog.tsx` | F1 post-upload dedup dialog |
| `components/pbv/MultiFileDropZone.tsx` | F2 drag-drop zone |

### Modified Files
| Path | Changes |
|------|---------|
| `components/pbv/sign/TenantDashboard.tsx` | F4: Integrate progress bar |
| `components/pbv/TenantDocumentUpload.tsx` | F3: Add help expander; F1: Add dedup flow |
| `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts` | F1: Add hash computation |
| `app/api/admin/.../documents/upload/route.ts` | F1: Add hash computation (find exact path) |
| `app/pbv-full-app/[token]/documents/page.tsx` | F2: Mount drop zone |

---

## Gotchas & Mitigations

| Gotcha | Mitigation |
|--------|------------|
| `pbv_document_requirements` empty → generate-forms 500 | Test generate-forms early in Phase 1; if still broken, fix as prerequisite |
| Category not on `application_documents` table | Query joins `form_document_templates` for category; verify schema before Phase 3 |
| Client-side hash doesn't match server-side | Web Crypto API vs Node crypto should both be SHA-256; test with known fixture |
| Multi-file upload overwhelms server | Cap concurrency at 4; sequential fallback if needed |
| Slot assignment conflicts | Real-time validation in UI; disable upload until resolved |
| File replace triggers dedup | Check `isReplace` flag before calling by-hash endpoint |
| Cross-application data leak | Strict `anchor_id` filter in all queries; verify in tests |

---

## Build Report Template

File to populate: `docs/build-reports/41-pbv-tenant-upload-ux-build-report_2026-05-17.md`

Sections to fill:
- F4 progress bar status + screenshots
- F3 help content coverage (31/31 doc types)
- Translation coverage (en/es/pt)
- F1 hash dedup status + migration confirmation
- F2 drop zone status + verification results
- End-to-end scenario results
- Defects surfaced (if any)

---

## Confirmation Required

This plan implements **all four features** of PRD-41 in the order F4 → F3 → F1 → F2.

**Before proceeding, confirm:**
1. ✅ Prerequisites verified (uploads functional, fixtures available)
2. ✅ Build order acceptable (F4 → F3 → F1 → F2)
3. ✅ Scope acceptable (all 4 features, no additions)
4. ✅ Timeline acceptable (3-4 days)

**Reply with "go", "proceed", or "yes" to authorize implementation.**

Or flag any concerns and I'll revise the plan.
