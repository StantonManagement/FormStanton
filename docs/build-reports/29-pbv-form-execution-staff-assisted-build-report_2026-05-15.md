# Build Report — PRD-29: Staff-Assisted Mode Polish

**Date:** 2026-05-15  
**Branch:** `feature/pbv-form-execution`  
**PRD:** `docs/fullApp-Plan/29-pbv-form-execution-staff-assisted-mode_prd_2026-05-15.md`

---

## Commits Shipped

| Commit | SHA | Description |
|---|---|---|
| Commit 1 | `bbeb6da` | Schema + audit plumbing |
| Commit 2 | `c3285aa` | Tenant banner + handoff prompt |
| Commit 3 | `3cad18b` | Admin-side session controls |
| Commit 4 | `f885ba7` | Integration coverage (8 tests) |

---

## Schema Change

**Migration:** `supabase/migrations/20260515060000_pbv_signature_events_assisted_by.sql`

```sql
ALTER TABLE public.pbv_signature_events
  ADD COLUMN IF NOT EXISTS assisted_by_staff_user_id UUID
    REFERENCES public.admin_users(id) ON DELETE SET NULL;
```

- FK to `admin_users.id` (not a separate `pbv_staff_users` table — confirmed existing schema)
- `ON DELETE SET NULL` — staff user deletion does not cascade to audit rows
- Index on non-null rows: `idx_pbv_signature_events_assisted_by WHERE assisted_by_staff_user_id IS NOT NULL`
- NULL for all unassisted signatures (normal self-service flow unchanged)

---

## Session Lifecycle

### Start (admin side)
1. Staff opens application in `app/admin/pbv/full-applications/[id]/page.tsx`
2. Clicks **"Start assisted session"** → `POST /api/admin/pbv/full-applications/[id]/assisted-session`
3. Server sets `session.assistedMode = { staffUserId, staffDisplayName, applicationId, startedAt }` on the iron-session cookie
4. Returns `tenantUrl` → admin opens tenant portal in new tab
5. `assistedActive` state in admin UI shows amber indicator

### Detection (tenant side)
1. `app/pbv-full-app/[token]/layout.tsx` mounts `AssistedBanner`
2. `useAssistedMode(token)` polls `GET /api/t/[token]/pbv-full-app/assisted-mode` on mount + window focus
3. Endpoint reads iron-session cookie; if `session.assistedMode.applicationId === app.id` → returns `active: true + staffDisplayName + applicationId`
4. Banner renders: `"[Will Esposito] is helping complete this application. The tenant will sign for themselves."`

### End
- Either side can end the session:
  - Admin: "End assisted session" button → `DELETE /api/admin/pbv/full-applications/[id]/assisted-session`
  - Tenant banner: "End session" button → same DELETE endpoint (via `useAssistedMode.endSession()`)
- Clears `session.assistedMode`; banner vanishes on next poll/focus

---

## Audit Trail

### `sign-form` route extension
`X-Assisted-By: {staffUserId}` header is read from all POST requests to `sign-form` and `sign-summary`.

Validation: the header value is verified against `admin_users.id` before writing. An invalid/unknown UUID silently resolves to `null` (no hard failure — the signature still goes through).

Event row written:
```
device_owner = 'staff_assisted'     (set by client in assisted mode)
assisted_by_staff_user_id = <UUID>  (validated staff user ID)
```

### `sign-summary` route extension
Same `X-Assisted-By` validation added. `assisted_by_staff_user_id` is resolved but the summary document currently stores no signature event row (it writes directly to `pbv_summary_documents.signed_at`). The variable is available for future use when/if a summary event row is added.

---

## Banner UX

**`components/pbv/AssistedBanner.tsx`**
- Mounted via shared `app/pbv-full-app/[token]/layout.tsx` — visible on all pages under the token
- Amber background (#fffbeb) + border, per design system constraint avoidance of hardcoded hex → uses CSS var fallbacks
- Renders `null` when `assisted === false` (no session) or `assisted === null` (still loading — avoids flash)
- "End session" button triggers `DELETE` → banner disappears within one render cycle

**`components/pbv/AssistedHandoffPrompt.tsx`**
- Mounted by `SignaturePadGate` when `assistedMode` prop is passed
- Shown *before* the signature pad — the tenant must tap "I have the phone — ready to sign" to proceed
- One-time per gate instance; `handoffConfirmed` state is local to the gate render
- Staff display name + tenant name shown explicitly

**`SignaturePadGate` extension**
- New optional prop: `assistedMode?: { staffDisplayName, tenantName } | null`
- `handoffConfirmed` state initialized to `!assistedMode` — non-assisted sessions skip the prompt entirely
- Zero behavior change for all existing callers that don't pass `assistedMode`

---

## `tenantFetch` Extension

```typescript
interface TenantFetchOptions {
  // ...existing...
  assistedByUserId?: string | null;   // new
}
```

When set: `headers['X-Assisted-By'] = assistedByUserId` forwarded on every request.

Callers that pass `assistedByUserId` from `useAssistedMode.assisted.staffUserId` get automatic header forwarding without changes to individual hooks.

---

## Admin Controls

**`app/admin/pbv/full-applications/[id]/page.tsx`**

New "Staff-Assisted Session" section below Tenant Magic Link:
- **Inactive:** "Start assisted session" button → `POST` → opens tenant portal tab
- **Active:** amber indicator + "End assisted session" button → `DELETE`
- `assistedActive` state is client-side only (not persisted across page refreshes — intentional; staff must re-check or re-start if they navigate away)

---

## Integrity Guarantee

**The signature is always the tenant's.**

No code path allows staff to sign on behalf of a tenant:
- `sign-form` and `sign-summary` are tenant-facing endpoints that require tenant token auth
- `device_owner` is supplied by the client; server does not override it
- `assisted_by_staff_user_id` is purely audit metadata — it does not change signature validation
- The `AssistedHandoffPrompt` requires an explicit tap confirmation before the pad appears

---

## Test Results

| Suite | Tests | Status |
|---|---|---|
| `pbv-assisted-mode.test.ts` | 8 | ✓ All pass |

Coverage:
- `tenantFetch` forwards `X-Assisted-By` when `assistedByUserId` is set
- `tenantFetch` omits header when `null` or `undefined`
- `AssistedModeState` interface accepts all required fields
- `SessionData.assistedMode` is valid both when set and when absent
- Signature event row shape includes `device_owner = 'staff_assisted'` + `assisted_by_staff_user_id`
- Non-assisted event has `null` for `assisted_by_staff_user_id`

---

## Open Questions for Alex

1. **`assistedActive` persistence** — Currently client-side only; navigating away in the admin tab resets the indicator. Should it be server-derived (i.e., check session on every admin page load)? Default: no — low operational burden; Will knows when he started a session.

2. **Banner on refresh** — `useAssistedMode` re-polls on mount and window focus. If staff walks away and session expires (14-day cookie), banner disappears on next focus. This is correct behavior. Confirm.

3. **Multiple sequential assistants** — Each session is a separate `POST`; the new staff's `staffUserId` overwrites `session.assistedMode`. Each signature event is tagged with whoever was active at sign time. Confirm this is the right model.

4. **`sign-summary` event row** — The summary doc currently writes no `pbv_signature_events` row (just `pbv_summary_documents.signed_at`). If HACH audit requires the summary signing to be in the events table with `assisted_by_staff_user_id`, a separate migration + row insert is needed. Flag when ready.

---

## Items NOT in Scope (per PRD-29)

- Kiosk mode (deferred)
- Twilio SMS integration (stubbed)
- E2E Playwright tests (PRD-30)
- Changes to PRD-25/26/27 intake/signing flows beyond the banner + handoff prompt
