# PBV Adjacent Errors — Comprehensive Deep Check

**Date:** 2026-05-21  
**Scope:** All PBV tenant-facing routes, signer routes, admin routes, cron routes, shared utilities  
**Method:** Pattern-matched the 11 findings from the stress-test report across the entire PBV lane to find clones, near-misses, and ripple-effects.

---

## CRITICAL — Fix Before Launch (New Findings)

### A1. `sign-summary` uses weaker X-Assisted-By verification than `sign-form`
- **Where:** `app/api/t/[token]/pbv-full-app/sign-summary/route.ts:55-61`
- **What's wrong:** The `sign-summary` route checks `X-Assisted-By` by merely verifying the UUID exists in `admin_users`. It does **not** call `getSession()` to verify the header matches the active assisted staff session (unlike `sign-form` which was hardened in PRD-64).
- **Attack:** Any client that knows a valid `admin_users.id` can spoof the `X-Assisted-By` header and attribute a summary signature to a staff member who did not actually assist.
- **Fix:** Replace the existence-only check with the same `getSession()` assisted-mode verification used in `sign-form`.

### A2. `signatures` POST route has a storage-upload-first race condition
- **Where:** `app/api/t/[token]/pbv-full-app/signatures/route.ts:164-168`
- **What's wrong:** Signature image is uploaded to storage with `upsert: false` **before** the DB UPDATE on `application_documents`. If two concurrent requests sign the same document, the second storage upload fails with 409, but the route throws without rolling back. The DB is never updated, leaving the document in `missing` status despite the tenant believing the signature was captured.
- **Fix:** Either swap the order (UPDATE first with status guard, then storage upload), or handle the 409 as a benign duplicate and proceed to update DB.

### A3. `t/[token]/documents/[documentId]` route has the same upload race as the PBV doc upload
- **Where:** `app/api/t/[token]/documents/[documentId]/route.ts:124-151`
- **What's wrong:** This is the legacy tenant document upload endpoint (non-PBV path but still active). It uploads to storage with `upsert: false`, then updates DB without checking affected-row count. Same race: two concurrent uploads = one 409, orphan file, inconsistent state.
- **Fix:** Check affected-row count on the UPDATE, or add `.eq('status', 'missing')` guard with count validation.

---

## HIGH — Fix in First Post-Launch Patch (New Findings)

### A4. Member-token signer routes do not check `packet_locked`
- **Where:** `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts:67` and `app/api/pbv-full-app/signer/[member_token]/route.ts`
- **What's wrong:** The member-token routes check `submitted_at` but **never check `packet_locked`**. If staff locks the packet while a non-HOH adult is on their magic link, they can still view forms and sign. This is the same gap as in `withTenantContext` but extends to the magic-link lane.
- **Fix:** Add `packet_locked` to the member lookup query and return 409 `packet_locked` when true.

### A5. `sign-summary` missing input validation
- **Where:** `app/api/t/[token]/pbv-full-app/sign-summary/route.ts:43-50`
- **What's wrong:** No validation that `ceremony_id` is a valid UUID. No validation that `language` is one of `['en','es','pt']`. No validation that `template_version` matches expected format. Invalid values propagate to DB.
- **Fix:** Add zod or regex validation for UUIDs and enum checks.

### A6. `signature/capture` missing UUID validation
- **Where:** `app/api/t/[token]/pbv-full-app/signature/capture/route.ts:33-43`
- **What's wrong:** `signer_member_id` and `ceremony_id` are not validated as UUIDs. A malformed `signer_member_id` propagates to the storage path and DB.
- **Fix:** Add UUID regex validation for both fields.

### A7. `withIdempotency` uses server-local `new Date()` for expiry comparison
- **Where:** `lib/idempotency.ts:31`
- **What's wrong:** Same timezone/clock-drift issue as the magic-link expiry. `new Date(existing.expires_at) > new Date()` compares server-local times.
- **Fix:** Use `Date.now()` and compare against `new Date(existing.expires_at).getTime()`.

---

## MEDIUM — Known Risks, Monitor (New Findings)

### A8. `events` route fire-and-forget without client feedback
- **Where:** `app/api/t/[token]/pbv-full-app/events/route.ts:151-157`
- **What's wrong:** Event writes are fire-and-forget (`Promise.allSettled` without `await`). The client receives 200 with counts but has no way to know if events actually persisted. Analytics data loss is silent.
- **Fix:** Either await the writes (adds ~50-100ms) or return a `persistence_status` field indicating whether the async write was initiated.

### A9. `signature-thumbnails` storage path manipulation bug
- **Where:** `app/api/t/[token]/pbv-full-app/signature-thumbnails/route.ts:41`
- **What's wrong:** Uses `.replace('pbv-applications/', '')` to strip the bucket prefix before calling `createSignedUrl`. If the path doesn't start with exactly `pbv-applications/`, the replace silently fails and the signed URL call uses the full path, which may not exist in the bucket.
- **Fix:** Use a prefix guard (already partially done with `safePaths`) but also use `.startsWith()` before stripping, or use `path.slice(prefix.length)`.

### A10. `additional-signers/send-link` magic-link generation has a subtle race
- **Where:** `app/api/t/[token]/pbv-full-app/additional-signers/[member_id]/send-link/route.ts:88-100`
- **What's wrong:** Two concurrent calls could both pass the expiry check (line 71-75), both generate a new token, and the second UPDATE overwrites the first. Both callers get different tokens; only the last one is valid.
- **Fix:** Add `.eq('magic_link_token', member.magic_link_token)` to the UPDATE for an optimistic-lock guard, or use a DB-generated default.

### A11. `generate-forms` summary upload uses `upsert: true` without version guard
- **Where:** `app/api/t/[token]/pbv-full-app/generate-forms/route.ts:315-320`
- **What's wrong:** The summary PDF upload path is `pbv/${fullApp.id}/summary-${summaryLang}-unsigned.pdf` with `upsert: true`. If two concurrent generate-forms calls run, the second silently overwrites the first's summary PDF. Less critical than the form-document race because the summary doesn't have signer hashes, but still an inconsistency.
- **Fix:** Add a generation version suffix to the summary path, or use `upsert: false` and handle 409 as benign.

### A12. `sign-form` (member-token) returns wrong status for "not found" errors
- **Where:** `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts:93-98`
- **What's wrong:** The error status determination uses `result.error?.includes('not found')` for 404 vs 422, but `completeFormSigning` returns the string `'Form document not found'` (capital F). The `.includes()` is case-sensitive and may fail if the error message format changes.
- **Fix:** Use a typed error code instead of string matching.

---

## SUGGESTED FIXES (New Findings Only — Original 11 from Stress-Test Report Not Duplicated)

### Fix A1: Harden `sign-summary` X-Assisted-By verification

Replace the existence-only admin_users lookup at `sign-summary/route.ts:55-61` with the same `getSession()` pattern used in `sign-form`:

```typescript
const assistedByHeader = request.headers.get('X-Assisted-By');
let assistedByStaffUserId: string | null = null;
if (assistedByHeader) {
  let assistedMode: { staffUserId: string; applicationId: string } | undefined;
  try {
    const session = await getSession();
    assistedMode = session.assistedMode;
  } catch {
    assistedMode = undefined;
  }

  const verified =
    !!assistedMode &&
    assistedMode.staffUserId === assistedByHeader &&
    assistedMode.applicationId === app.id;

  if (!verified) {
    return { body: { success: false, code: 'assisted_session_unverified', message: '...' }, status: 401 };
  }
  assistedByStaffUserId = assistedMode!.staffUserId;
}
```

### Fix A2: Swap order in `signatures` POST — DB guard first, storage upload second

At `app/api/t/[token]/pbv-full-app/signatures/route.ts:127-182`, restructure the loop:

1. **UPDATE first** with `.eq('status', 'missing')` (or appropriate guard) and check affected-row count.
2. **If 0 rows affected**, skip this signature (another request won the race).
3. **If UPDATE succeeds**, upload to storage with `upsert: true` (idempotent for same bytes).
4. **If storage upload fails**, rollback the DB UPDATE (set status back to `missing`).

This mirrors the fix pattern for the document-upload race (original stress-test item #2).

### Fix A3: Add affected-row guard to legacy document upload

At `app/api/t/[token]/documents/[documentId]/route.ts:134-151`, after the storage upload:

```typescript
const { data: updateResult, error: updateError } = await supabaseAdmin
  .from('application_documents')
  .update({ ... })
  .eq('id', documentId)
  .eq('status', 'missing') // race guard
  .select('id'); // or use count

if ((updateResult?.length ?? 0) === 0) {
  // Another request won — delete the orphan file we just uploaded
  await supabaseAdmin.storage.from('pbv-applications').remove([storagePath]);
  return NextResponse.json({ success: false, message: 'Document already uploaded by another request' }, { status: 409 });
}
```

### Fix A4: Add `packet_locked` check to member-token routes

At `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts:60-67`, add after the `submitted_at` check:

```typescript
if (app?.packet_locked) {
  return NextResponse.json(
    { success: false, message: 'This packet is currently under review.', code: 'packet_locked' },
    { status: 409 }
  );
}
```

Also add to `app/api/pbv-full-app/signer/[member_token]/route.ts:30-41` and `forms/route.ts:25-35`.

### Fix A5: Add input validation to `sign-summary`

At `sign-summary/route.ts:43-50`, insert before processing:

```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(ceremony_id)) {
  return { body: { success: false, message: 'Invalid ceremony_id' }, status: 400 };
}
if (!['en','es','pt'].includes(language)) {
  return { body: { success: false, message: 'Invalid language' }, status: 400 };
}
```

### Fix A6: Add UUID validation to `signature/capture`

At `signature/capture/route.ts:33-43`:

```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(signer_member_id)) {
  return { body: { success: false, message: 'Invalid signer_member_id' }, status: 400 };
}
if (ceremony_id && !UUID_RE.test(ceremony_id)) {
  return { body: { success: false, message: 'Invalid ceremony_id' }, status: 400 };
}
```

### Fix A7: Replace `new Date()` comparison in `withIdempotency`

At `lib/idempotency.ts:31`:

```typescript
if (existing && new Date(existing.expires_at).getTime() > Date.now()) {
```

### Fix A8: Return persistence status in `events` response

At `events/route.ts:159-166`, change:

```typescript
return NextResponse.json({
  success: true,
  data: {
    accepted: results.filter((r) => r.status === 'accepted').length,
    rejected: results.filter((r) => r.status === 'rejected').length,
    persistence_initiated: processedEvents.length, // A8: added
    results,
  },
});
```

### Fix A9: Guard path prefix strip in `signature-thumbnails`

At `signature-thumbnails/route.ts:35-46`:

```typescript
const safePaths = paths.filter((p) => p.startsWith(prefix));

const urlMap: Record<string, string> = {};

await Promise.all(
  safePaths.map(async (storagePath) => {
    const pathInBucket = storagePath.startsWith('pbv-applications/')
      ? storagePath.slice('pbv-applications/'.length)
      : storagePath;
    const { data, error } = await supabaseAdmin.storage
      .from('pbv-applications')
      .createSignedUrl(pathInBucket, SIGNED_URL_TTL_SECONDS);
    // ...
  })
);
```

### Fix A10: Add optimistic lock to `send-link` token generation

At `additional-signers/[member_id]/send-link/route.ts:88-100`:

```typescript
const { error: updateError } = await supabaseAdmin
  .from('pbv_household_members')
  .update({
    magic_link_token: newToken,
    magic_link_expires_at: expiresAt,
  })
  .eq('id', member.id)
  .eq('magic_link_token', member.magic_link_token ?? ''); // optimistic lock

if (updateError) {
  // Race lost — fetch fresh token and return it
  const { data: fresh } = await supabaseAdmin
    .from('pbv_household_members')
    .select('magic_link_token, magic_link_expires_at')
    .eq('id', member.id)
    .single();
  return NextResponse.json({
    success: true,
    data: { magic_link_token: fresh?.magic_link_token, magic_link_expires_at: fresh?.magic_link_expires_at, regenerated: false, race: true },
  });
}
```

### Fix A11: Version the summary PDF path

At `generate-forms/route.ts:313-320`, append a version suffix:

```typescript
const summaryStoragePath = `pbv/${fullApp.id}/summary-${summaryLang}-v${SUMMARY_TEMPLATE_VERSION}-unsigned.pdf`;
// or use a generation counter from the app row
```

Or use `upsert: false` and handle 409 as benign (same-summary-content replay).

### Fix A12: Use typed error codes in member-token `sign-form`

Modify `completeFormSigning` in `lib/pbv/signing/completeForm.ts` to return an object with `{ code: string; message: string }` instead of a plain string. Then in `sign-form/route.ts:93-98`:

```typescript
const status = result.errorCode === 'not_found' ? 404 : 422;
```

---

## POSITIVE FINDINGS — What's Hardened Well (Confirmed)

| Item | Status | Evidence |
|---|---|---|
| `send-to-hach` atomic lock | ✅ | `.eq('packet_locked', false)` guard on UPDATE |
| `reopen` atomic unlock | ✅ | `.eq('packet_locked', true)` guard on UPDATE |
| Admin RBAC checks | ✅ | `userHasPermission(sessionUser, 'pbv-full-applications', 'send_to_hach')` |
| `finalize_pbv_application` RPC race-safety | ✅ | `WHERE submitted_at IS NULL` guard |
| `completeFormSigning` deduplication | ✅ | DB unique constraint `(form_document_id, signer_member_id)` |
| Unsigned PDF versioning | ✅ | PRD-66 `generation_version` + `-vN.pdf` paths |
| Hash mismatch blocks finalize | ✅ | PRD-62 Check 5 in `finalizeValidation.ts` |

---

## Launch Decision Matrix (Updated)

| Gate | Status | Blocker? |
|---|---|---|
| CRON_SECRET protection | ❌ Missing on all cron routes | **YES** |
| RLS on `pbv_rejection_reason_templates` | ⚠️ `authenticated` read (not `public`), but wider than needed | **Fix before deploy** — tighten to `service_role` only |
| Document upload race | ❌ Orphan file risk (PBV + legacy paths) | **YES** |
| `packet_locked` tenant gate | ❌ Not enforced in `withTenantContext` or member-token routes | Fix in v1.1 |
| `generate-forms` first-gen race | ❌ Edge case, rare | Fix in v1.1 |
| `sign-summary` assisted-by spoofing | ❌ Weaker than `sign-form` | **Fix before deploy** |
| `signatures` POST race | ❌ Storage-first without rollback | Fix in v1.1 |

---

## Files Examined

- `app/api/t/[token]/pbv-full-app/sign-summary/route.ts`
- `app/api/t/[token]/pbv-full-app/signatures/route.ts`
- `app/api/t/[token]/pbv-full-app/signature/capture/route.ts`
- `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/defer/route.ts`
- `app/api/t/[token]/pbv-full-app/documents/bulk-apply/route.ts`
- `app/api/t/[token]/pbv-full-app/documents/by-hash/route.ts`
- `app/api/t/[token]/documents/[documentId]/route.ts`
- `app/api/t/[token]/pbv-full-app/events/route.ts`
- `app/api/t/[token]/pbv-full-app/signature-thumbnails/route.ts`
- `app/api/t/[token]/pbv-full-app/additional-signers/[member_id]/send-link/route.ts`
- `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts`
- `app/api/pbv-full-app/signer/[member_token]/route.ts`
- `app/api/pbv-full-app/signer/[member_token]/forms/route.ts`
- `app/api/pbv-full-app/signer/[member_token]/signature/capture/route.ts`
- `lib/idempotency.ts`
- `app/api/admin/pbv/full-applications/[id]/send-to-hach/route.ts`
- `app/api/admin/pbv/full-applications/[id]/reopen/route.ts`
- `supabase/migrations/20260514220000_pbv_rejection_reason_templates.sql`
- All `withTenantContext` consumer routes (15 files)
