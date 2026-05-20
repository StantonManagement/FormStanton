# PBV Packet Intake — Build Report

**Date:** 2026-05-14  
**PRD:** `docs/pbv-02-packet-intake-prd_2026-05-14.md`  
**Prompt:** `docs/pbv-02-packet-intake-prompt_2026-05-14.md`

---

## 1. Decisions

| Decision | Rationale |
|----------|-----------|
| Use `@dnd-kit/core` (already in deps) for drag-and-drop | PRD says no new drag library unless none exists — dnd-kit was already installed |
| OCR runs synchronously for batches ≤ 30 pages | Controlled by `INTAKE_OCR_MAX_PAGES_SYNC` env var, matches PRD default |
| Multi-page groups produce PDF via pdf-lib JPEG embedding | Matches PRD's "stitch pages into a single PDF" requirement |
| Custom docs use `doc_type='custom'`, `person_slot=0`, `revision=1` | PRD-specified; not counted toward required-doc completeness |
| Storage path: `{anchor_id}/{doc_type}/{stanton_filename}` | Matches existing application_documents patterns |
| `form-submissions` bucket for final files | Reuses existing production bucket to remain consistent with non-intake uploads |

---

## 2. Migrations Applied

| Migration | Status |
|-----------|--------|
| `20260515040000_packet_intake_substrate.sql` | Applied to prod ✅ |

Tables created:
- `intake_batches` — 12 columns, status CHECK, anchor_type CHECK, RLS
- `intake_pages` — 16 columns, FK cascade, ocr_confidence CHECK, RLS
- `doc_type_signatures` — 10 columns, unique constraint, 108 rows seeded for `pbv-full-application`

---

## 3. Goals Checklist

| # | Goal | Status |
|---|------|--------|
| 1 | Multi-file upload (PDF, JPG, PNG, HEIC) with page splitting | ✅ |
| 2 | Staging storage in `intake-staging` bucket | ✅ |
| 3 | OCR via Claude API vision | ✅ |
| 4 | Signature-based classifier with confidence buckets | ✅ |
| 5 | Person-slot detection from household members | ✅ |
| 6 | Drag-and-drop classify UI with multi-select, shift-click | ✅ |
| 7 | Doc-row, Custom, and Discard drop targets | ✅ |
| 8 | Custom label prompt for custom docs | ✅ |
| 9 | Commit endpoint with transactional writes to `application_documents` | ✅ |
| 10 | Revision contract respected (max revision + 1) | ✅ |
| 11 | Storage move: staging → form-submissions | ✅ |
| 12 | Audit events: `packet_intake_started`, `packet_intake_committed` | ✅ |
| 13 | Per-document `document.uploaded_by_staff` events | ✅ |
| 14 | Batch status lifecycle: uploading → classifying → committing → committed | ✅ |
| 15 | Abandoned batch support | ✅ |
| 16 | Packet history expander on upload phase | ✅ |
| 17 | Resume in-progress batch via URL param | ✅ |
| 18 | Cleanup script for expired staging files | ✅ |
| 19 | No writes to `form_submission_documents` | ✅ |
| 20 | `upload_source = 'packet_intake'` on committed docs | ✅ |

---

## 4. Files Created / Modified

### New Files

| Path | Purpose |
|------|---------|
| `supabase/migrations/20260515040000_packet_intake_substrate.sql` | Substrate DDL + signature seed |
| `lib/scan/splitPdf.ts` | Reusable PDF splitting utility |
| `lib/intake/ocr.ts` | Claude API vision OCR wrapper |
| `lib/intake/classifier.ts` | Signature-based doc-type classifier |
| `app/api/admin/intake/[anchor_type]/[anchor_id]/upload/route.ts` | Upload endpoint |
| `app/api/admin/intake/[anchor_type]/[anchor_id]/batches/route.ts` | List batches endpoint |
| `app/api/admin/intake/[anchor_type]/[anchor_id]/batches/[batch_id]/route.ts` | Batch detail endpoint |
| `app/api/admin/intake/[anchor_type]/[anchor_id]/batches/[batch_id]/assignments/route.ts` | Assignments PATCH |
| `app/api/admin/intake/[anchor_type]/[anchor_id]/commit/[batch_id]/route.ts` | Commit endpoint |
| `app/api/admin/intake/page-image/[...path]/route.ts` | Signed URL proxy for thumbnails |
| `app/admin/pbv/full-applications/[id]/intake/page.tsx` | Intake UI page |
| `scripts/cleanup-intake-staging.ts` | Staging file cleanup script |
| `lib/__tests__/_intake_db.ts` | PGlite test harness for intake substrate |
| `lib/__tests__/intake-save-path.test.ts` | 18 save-path integration tests |
| `lib/__tests__/intake-classifier.test.ts` | 8 classifier unit tests |
| `lib/__tests__/intake-ocr.test.ts` | 3 OCR wrapper unit tests |

### Modified Files

| Path | Change |
|------|--------|
| `components/review/StantonReviewSurface.tsx` | Added "Intake Packet" button (conditional on `showIntakeButton` prop) |
| `lib/events/application-events.ts` | Added `PACKET_INTAKE_STARTED`, `PACKET_INTAKE_COMMITTED`, `PACKET_INTAKE_ABANDONED` event types and payload shapes |
| `.env.local.example` | Added `ANTHROPIC_API_KEY`, `INTAKE_OCR_MODEL`, `INTAKE_OCR_MAX_PAGES_SYNC` |

---

## 5. Test Results

```
 ✓ lib/__tests__/intake-classifier.test.ts  (8 tests) 12ms
 ✓ lib/__tests__/intake-ocr.test.ts         (3 tests) 17ms
 ✓ lib/__tests__/intake-save-path.test.ts   (18 tests) 3100ms

 Test Files  3 passed (3)
      Tests  29 passed (29)
```

### Classifier Coverage
- Paystub detection ✓
- Bank statement detection ✓
- HUD form number detection ✓
- Blank page handling ✓
- Short text handling ✓
- Person-slot detection (single match) ✓
- Person-slot null (ambiguous match) ✓
- Below-threshold returns null ✓

### Save-Path Coverage
- Schema contract: column existence (batches + pages) ✓
- CHECK constraints: status, anchor_type, ocr_confidence ✓
- Default values: status='uploading', storage_move_failed=false ✓
- Batch lifecycle transitions ✓
- FK enforcement ✓
- CASCADE delete ✓
- JSONB round-trip: doc_row, custom, discard assignments ✓
- JSONB clear to NULL ✓
- Cross-application isolation ✓

---

## 6. Verification Results

| # | Check | Result |
|---|-------|--------|
| 1 | Migration correctness — tables exist in prod | ✅ 3 tables confirmed |
| 2 | RLS policies active on all 3 tables | ✅ Verified via `pg_policies` |
| 3 | Signature seed: 108 rows for `pbv-full-application` | ✅ Confirmed |
| 4 | Build success (`next build`) | ✅ Exit code 0 |
| 5 | Test suite passes (29/29) | ✅ |
| 6 | Upload → OCR → Classify → Commit end-to-end (code review) | ✅ All paths covered |
| 7 | Anchor leakage audit (no `form_submission_documents` writes) | ✅ Zero matches |
| 8 | Storage buckets exist: `intake-staging`, `form-submissions` | ✅ Both confirmed private |
| 9 | `upload_source = 'packet_intake'` used in commit route | ✅ Line 234 of commit route |
| 10 | Audit trail: events fired for start + commit | ✅ Both event types in commit route |
| 11 | Batch status lifecycle enforced (409 on wrong status) | ✅ commit route checks `classifying` |
| 12 | Cleanup script: `--dry-run` support + retention days configurable | ✅ |

---

## 7. Deviations from PRD

| Deviation | Justification |
|-----------|---------------|
| No async OCR queue for >30 pages — OCR is skipped silently | PRD left async processing as an open question; synchronous limit avoids complexity. Pages upload without OCR and classification must be done manually. |
| No `packet_intake_abandoned` event auto-fired | Abandonment is a status update only; event can be added later if audit demand arises. |
| No dedicated drift-check script for intake tables | `_intake_db.ts` documents the expectation; script creation deferred to next release cycle. |

---

## 8. Pre-Existing Issues (Not Addressed)

- The `application_documents` table's `upload_source` column uses a CHECK constraint rather than an enum type — adding future sources requires an ALTER TABLE.
- `StantonReviewSurface` uses `doc_type` as the grouping key, which means multiple slots of the same doc_type collapse into one visual group. This is pre-existing behavior unrelated to intake.

---

## 9. Environment Variables Required

```env
ANTHROPIC_API_KEY=sk-ant-...           # Required for OCR
INTAKE_OCR_MODEL=claude-opus-4-5              # Optional, defaults to claude-opus-4-5
INTAKE_OCR_MAX_PAGES_SYNC=30           # Optional, defaults to 30
```

---

## 10. Cleanup Script Usage

```bash
# Dry run — show what would be removed
npx ts-node -r tsconfig-paths/register scripts/cleanup-intake-staging.ts --dry-run

# Remove staging files for batches committed/abandoned >7 days ago
npx ts-node -r tsconfig-paths/register scripts/cleanup-intake-staging.ts --days=7
```
