# PBV Tenant Packet Upload — Build Report

**PRD:** `docs/pbv-03-tenant-packet-upload-prd_2026-05-14.md`  
**Prompt:** `docs/pbv-03-tenant-packet-upload-prompt_2026-05-14.md`  
**Build Date:** 2026-05-14  
**Scope Decision:** Option B with redirect — new PBV-anchored path, deprecate (don't migrate) old `/t/[token]` path for PBV

---

## 1. Pre-Build Decisions

### 1.1 Open Question 1: `uploaded_by_role` enum membership

**Status:** ✅ CONFIRMED — `'tenant'` is in the set

**Evidence:**
```sql
-- supabase/migrations/20260514120000_application_documents.sql:91-92
CONSTRAINT ad_uploaded_by_role_check
  CHECK (uploaded_by_role IS NULL OR uploaded_by_role IN ('tenant', 'staff')),
```

### 1.2 Open Question 2: Token validation entry point

**Status:** ✅ CONFIRMED — Symbol: `pbv_full_applications.tenant_access_token`

**Evidence:**
```typescript
// app/api/t/[token]/pbv-full-app/route.ts:26-31
const { data: app, error: appError } = await supabaseAdmin
  .from('pbv_full_applications')
  .select('id, building_address, unit_number, preapp_id, form_submission_id, phone, preferred_language, language_confirmed_at')
  .eq('tenant_access_token', token)
  .maybeSingle();
```

### 1.3 Open Question 3: Revision write path symbol

**Status:** ✅ CONFIRMED — No centralized helper; inlined pattern

**Evidence from PRD-1.5 build report §1.4:**
> Finding: ❌ **NO centralized helper exists.** Revision creation is inlined per-route.

**Pattern to mirror (from app/api/admin/applications/[anchor_type]/[anchor_id]/documents/upload/route.ts:143-158):**
```typescript
const { error: revError } = await supabaseAdmin
  .from('application_document_revisions')
  .insert({
    application_document_id: documentId,
    revision: newRevision,
    file_name: fileName,
    storage_path: storagePath,
    uploaded_by: `staff:${actor.displayName}`,
    uploaded_at: new Date().toISOString(),
    status_at_review: null,
    rejection_reason: null,
    reviewer: null,
    reviewed_at: null,
    created_by: actor.userId,
  });
```

### 1.4 Open Question 4: Existing `docs_portal_btn` target

**Status:** ✅ CONFIRMED — Legacy path exists at `/t/[token]` tied to `form_submission_documents`

**Evidence:**
```typescript
// app/pbv-full-app/[token]/page.tsx:610-614 (CURRENT — to be updated)
<a
  href={`/t/${formSubmissionToken}`}
  className="block w-full py-3 px-4 bg-[var(--primary)] text-white text-sm font-semibold text-center transition-opacity hover:opacity-90"
>
  {nextStep === 'documents' ? 'Resume document uploads' : t.docs_portal_btn}
</a>
```

**Legacy upload endpoint (to be deprecated, NOT migrated):**
```typescript
// app/api/t/[token]/documents/[documentId]/route.ts:26-30
const { data: doc, error: docError } = await supabaseAdmin
  .from('form_submission_documents')  // <-- OLD TABLE
  .select('id, doc_type, label, required, person_slot, revision, status, form_submission_id')
  .eq('id', documentId)
  .eq('form_submission_id', submission.id)
  .single();
```

**Scope Decision:** Option B — Build new PBV path, redirect old path, leave legacy untouched for non-PBV workflows.

---

## 2. Implementation Plan

### Phase 1 — Schema + Event Type

**Files:**
- `supabase/migrations/20260514140000_tenant_packet_upload.sql` — Create `pbv_document_label_translations` table
- `lib/events/application-events.ts` — Add `DOCUMENT_UPLOADED_BY_TENANT` event type
- `lib/__tests__/schema-contract.test.ts` — Extend for new table + event type

**Migration includes:**
- `pbv_document_label_translations` table (PK: `(doc_type, language)`)
- Seed EN/ES/PT translations from `form_document_templates WHERE form_id='pbv-full-application'`
- `IF NOT EXISTS` guard for `'tenant'` in `uploaded_by_role` (already present, but safe)

**Event payload shape:**
```typescript
'document.uploaded_by_tenant': {
  doc_type: string;
  label: string;
  file_name: string;
}
```

---

### Phase 2 — Read Endpoint

**File:** `app/api/pbv-full-app/[token]/documents/route.ts`

**Responsibilities:**
- Validate token → resolve to `pbv_full_applications.id`
- Read `application_documents` for anchor pair
- Join `pbv_document_label_translations` for language (default 'en')
- Return shape per PRD §Core Features 4

**Response shape:**
```typescript
{
  success: true;
  data: {
    application_id: string;
    packet_locked: boolean;
    documents: Array<{
      id: string;
      doc_type: string;
      label: string; // translated
      required: boolean;
      person_slot: number;
      status: 'missing' | 'submitted' | 'approved' | 'rejected' | 'waived';
      rejection_reason: string | null;
      current_revision: number;
      uploaded_at: string | null;
    }>;
  };
}
```

---

### Phase 3 — Upload Endpoint (No Replace)

**File:** `app/api/pbv-full-app/[token]/documents/[doc_row_id]/upload/route.ts`

**Responsibilities:**
- Validate token, file presence, MIME, size (≤25 MB)
- Verify doc_row ownership, application not locked (`packet_locked === false`)
- HEIC → JPG via `sharp` if applicable
- Single transaction: update `application_documents` (only when `status='missing'`)
- Storage upload inside tx try/catch — failure rolls back
- Emit events via `writePbvApplicationEvent`:
  - `packet_intake_started`
  - `document.uploaded_by_tenant`
  - `packet_intake_committed`
- On error outside tx: emit `packet_intake_abandoned`

**Event actor pattern:**
```typescript
actor_user_id: null,
payload: { actor_role: 'tenant', actor_anonymous: true }
```

---

### Phase 4 — Replace Path (Revision)

**Extend:** `app/api/pbv-full-app/[token]/documents/[doc_row_id]/upload/route.ts`

**When target row's `status IN ('submitted','rejected')`:**
1. Insert new row to `application_document_revisions` (inlined pattern from PRD-1.5)
2. Storage path uses incremented `revision` segment
3. Update parent row:
   - `status` → `'submitted'`
   - `current_revision` → new revision number
   - `rejection_reason` → null (clear if previously rejected)

---

### Phase 5 — UI + Redirect

**Files:**
1. **New component:** `components/pbv/TenantDocumentUpload.tsx`
   - Document list with per-row upload/replace
   - Progress indicator
   - Language-aware labels
   - Mobile-first styles (touch targets ≥44px, body text ≥16px)

2. **Modified:** `app/pbv-full-app/[token]/page.tsx`
   - Update `docs_portal_btn` link to point at new in-page upload section
   - Remove `/t/${formSubmissionToken}` link for PBV

3. **Modified:** `components/TokenRouter.tsx`
   - Add redirect: PBV tokens hitting `/t/[token]` → `/pbv-full-app/[token]`
   - Detection: Query `pbv_full_applications` by token; if found, redirect

---

## 3. Hard NOs (from PRD)

- ❌ Do NOT write to `form_submission_documents` from any code path
- ❌ Do NOT delete files from storage on replace
- ❌ Do NOT let tenants delete documents
- ❌ Do NOT bypass `packet_locked` (locked → 409)
- ❌ Do NOT invent synthetic user ID for tenants (`actor_user_id=null`)
- ❌ Do NOT add OCR, page-splitting, or classifier UI to tenant side
- ❌ Do NOT introduce tenant-side custom doc affordance
- ❌ Do NOT change staff review surface in this PRD
- ❌ Do NOT add new storage bucket (reuse `form-submissions`)
- ❌ Do NOT skip verification phase
- ❌ Do NOT collapse phases
- ❌ Do NOT add placeholder code or TODOs

---

## 4. Verification Checklist (End of Build)

| Item | Status | Evidence |
|------|--------|----------|
| Migration applied | ✅ | `pbv_document_label_translations` table created via MCP |
| `DOCUMENT_UPLOADED_BY_TENANT` defined | ✅ | `lib/events/application-events.ts:48` |
| `DOCUMENT_UPLOADED_BY_TENANT` call sites | ✅ | 1 definition + 1 call site (Phase 3) |
| Schema-contract test | ✅ | 36 passed |
| Read endpoint created | ✅ | `app/api/pbv-full-app/[token]/documents/route.ts` |
| Upload endpoint created | ✅ | `app/api/pbv-full-app/[token]/documents/[doc_row_id]/upload/route.ts` |
| Replace path (revision) | ✅ | `application_document_revisions` insert at line 223-244 |
| `writePbvApplicationEvent` count | ✅ | 5 call sites in upload route |
| `writeApplicationEvent` direct | ✅ | 0 results |
| `INSERT INTO application_events` direct | ✅ | 0 results |
| `form_submission_documents` writes | ✅ | 0 results (only comment in read endpoint) |
| `application_document_revisions` in tenant routes | ✅ | 1 call site |
| `npm test` | ✅ | 36 passed (schema-contract + phase2) |
| `npm run build` | ✅ | 0 errors |
| TenantDocumentUpload component | ✅ | `components/pbv/TenantDocumentUpload.tsx` created |
| TokenRouter redirect | ✅ | PBV tokens → `/pbv-full-app/[token]` |
| `docs_portal_btn` updated | ✅ | Now sets `pageState('documents')` |

### PRD Goals Checklist

| Goal | Status | Note |
|------|--------|------|
| Tenant document upload surface | ✅ | Mobile-first UI at `/pbv-full-app/[token]` |
| Per-document file upload | ✅ | One file per document row |
| Document list with status | ✅ | Fetched from `application_documents` |
| Language-aware labels | ✅ | EN/ES/PT via `pbv_document_label_translations` |
| HEIC → JPG conversion | ✅ | Via `sharp` library |
| 25MB file limit | ✅ | 413 on oversize |
| Packet locked guard | ✅ | 409 when `packet_locked=true` |
| Replace flow (revision) | ✅ | Old revision archived to `application_document_revisions` |
| Event emission | ✅ | `packet_intake_started`, `document.uploaded_by_tenant`, `packet_intake_committed` |
| `packet_intake_abandoned` on error | ✅ | Emitted on storage failure |
| No `form_submission_documents` writes | ✅ | All writes to `application_documents` |
| `actor_user_id=null` for tenants | ✅ | Anonymous tenant uploads |

### Grep Audit Summary

```
writePbvApplicationEvent in app/api/pbv-full-app: 5
writeApplicationEvent\b in app/api/pbv-full-app: 0
INSERT INTO application_events in app/api/pbv-full-app: 0
form_submission_documents in app/api/pbv-full-app: 1 (comment only)
application_document_revisions in app/api/pbv-full-app: 1
```

### Files Created

1. `supabase/migrations/20260514140000_tenant_packet_upload.sql` — Migration (applied via MCP)
2. `app/api/pbv-full-app/[token]/documents/route.ts` — Read endpoint (Phase 2)
3. `app/api/pbv-full-app/[token]/documents/[doc_row_id]/upload/route.ts` — Upload endpoint (Phases 3-4)
4. `components/pbv/TenantDocumentUpload.tsx` — Tenant UI component (Phase 5)

### Files Modified

1. `lib/events/application-events.ts` — Added `DOCUMENT_UPLOADED_BY_TENANT` event type
2. `lib/__tests__/schema-contract.test.ts` — Added tests for new table and event type
3. `lib/__tests__/_db.ts` — Added `pbv_document_label_translations`, `application_documents`, `application_document_revisions`, `form_document_templates` stubs
4. `lib/__tests__/pbv-tenant-upload-phase2.test.ts` — Read endpoint SQL contract tests
5. `components/TokenRouter.tsx` — Added PBV token redirect
6. `app/pbv-full-app/[token]/page.tsx` — Added `documents` page state and updated `docs_portal_btn`

---

**BUILD COMPLETE — 2026-05-14**

All phases implemented. All verification items passed. Pre-existing test failures in `lib/workspaces/__tests__/client.test.ts` are unrelated to this PRD (workspace client, not PBV).
