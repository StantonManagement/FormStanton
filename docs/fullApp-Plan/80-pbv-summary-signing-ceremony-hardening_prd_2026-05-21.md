# PRD-80 — PBV Summary-Signing Ceremony Hardening

**Date:** 2026-05-21
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-adjacent-errors-hardening` (follow-on batch off the stress-test work — see batch-run prompt)
**Status:** Draft — ready for build
**Severity:** **A1 is before-deploy** (a client that knows any valid `admin_users.id` can attribute a summary signature to a staff member who did not assist — an audit-integrity break). A5 and A6 are P1 input-validation hardening that ride along because they live in the same two files.
**Source:** `docs/audits/pbv-adjacent-errors-deep-check_2026-05-21.md` — findings **A1** (CRITICAL), **A5** (HIGH), **A6** (HIGH). Grouped because all three live in the summary-signing ceremony lane: `sign-summary/route.ts` (A1, A5) and `signature/capture/route.ts` (A6). One PRD owns these files end-to-end.
**Scope guard:** `app/api/t/[token]/pbv-full-app/sign-summary/route.ts` and `app/api/t/[token]/pbv-full-app/signature/capture/route.ts` only (plus the member-token signature/capture route iff it shares the gap — see A6). Do **not** touch `lib/pbv/tenantEndpoint.ts`, `withIdempotency`, the member-token `sign-form`/`route`/`forms` files (PRD-82), or the storage-race routes (PRD-81).

**Dependency:** Runs **after the double-wrap idempotency fix** (`prompts/signing-capture-idempotency-doublewrap_prompt_2026-05-21.md`), which removes the outer `withIdempotency` wrap on `signature/capture/route.ts` and has it call `withTenantContext` directly. This PRD adds validation **inside** that corrected handler. If the double-wrap fix has not landed, land it first (it is a live launch blocker) — do not re-introduce the outer wrap.

---

## Problem Statement

**A1 — `sign-summary` uses weaker `X-Assisted-By` verification than `sign-form` (CRITICAL).** Per the audit ([sign-summary/route.ts:55-61](app/api/t/[token]/pbv-full-app/sign-summary/route.ts#L55)), the `sign-summary` route validates the `X-Assisted-By` header by merely confirming the UUID exists in `admin_users`. It does **not** call `getSession()` to confirm the header matches the active assisted-staff session — unlike `sign-form`, which was hardened for this in PRD-64. So any client that knows a valid `admin_users.id` can spoof the header and attribute a summary signature to a staff member who never assisted. [Inference] this defeats the assisted-mode attribution that the audit log relies on; confirm the current `getSession()` shape against the `sign-form` implementation before mirroring it.

**A5 — `sign-summary` missing input validation (HIGH).** Per the audit ([sign-summary/route.ts:43-50](app/api/t/[token]/pbv-full-app/sign-summary/route.ts#L43)): no validation that `ceremony_id` is a valid UUID, no check that `language` is one of `['en','es','pt']`, no check that `template_version` matches the expected format. Invalid values propagate to the DB and surface as opaque errors instead of a clean 400.

**A6 — `signature/capture` missing UUID validation (HIGH).** Per the audit ([signature/capture/route.ts:33-43](app/api/t/[token]/pbv-full-app/signature/capture/route.ts#L33)): `signer_member_id` and `ceremony_id` are not validated as UUIDs. A malformed `signer_member_id` propagates into the storage path and the DB.

---

## Root cause / findings (audit-reported; confirm in code before editing)

- **A1**: the two ceremony routes diverged. `sign-form` got the PRD-64 `getSession()` assisted-mode check; `sign-summary` kept the older existence-only `admin_users` lookup. The remediation is to mirror the `sign-form` pattern exactly so both routes attribute assisted signatures the same way. [Unverified] the exact field names on `session.assistedMode` — read `sign-form/route.ts` and copy its verified shape rather than the snippet below verbatim.
- **A5 / A6**: presence-only checks let malformed UUIDs and out-of-enum values reach Supabase. PRD-77 introduced `lib/pbv/signing/validateSignFormBody.ts` with a UUID regex and enum helpers; **reuse those primitives** here rather than hand-rolling a second regex. If PRD-77 has not landed, the regex/enum helper in that PRD's spec is the source of truth — create or import it, do not duplicate a divergent copy.

---

## Current state

| Item | Where | Notes |
|---|---|---|
| Existence-only assisted-by check | `sign-summary/route.ts:55-61` | UUID-in-`admin_users` only; no `getSession()` |
| Hardened reference | `sign-form/route.ts` (PRD-64) | `getSession()` + `assistedMode.staffUserId === header` + `applicationId === app.id` |
| No UUID/enum validation | `sign-summary/route.ts:43-50` | `ceremony_id`, `language`, `template_version` unchecked |
| No UUID validation | `signature/capture/route.ts:33-43` | `signer_member_id`, `ceremony_id` unchecked |
| Shared validation primitives | `lib/pbv/signing/validateSignFormBody.ts` (PRD-77) | UUID regex + enum checks to reuse |
| `signature/capture` wrap | corrected by the double-wrap fix | calls `withTenantContext` directly (no outer `withIdempotency`) |

---

## Goals

1. **A1:** `sign-summary` verifies `X-Assisted-By` with the **same** `getSession()` assisted-mode check as `sign-form`: the header must match `assistedMode.staffUserId` **and** `assistedMode.applicationId` must match the resolved `app.id`. An unverifiable header returns **401** `assisted_session_unverified` and the summary signature is not attributed to a staff member who did not assist.
2. **A1:** No `X-Assisted-By` header → unchanged self-signed behavior (no assisted attribution), exactly as today for the non-assisted path.
3. **A5:** `sign-summary` rejects malformed input with a clean **400** before any DB work: `ceremony_id` must be a valid UUID; `language` must be in `['en','es','pt']`; `template_version` (when supplied) must match the expected format (confirm the format in code — do not invent one; if it is free-form, validate non-empty string only and log that).
4. **A6:** `signature/capture` validates `signer_member_id` (required) and `ceremony_id` (when supplied) as UUIDs, returning **400** before touching storage or the DB.
5. No behavior change for valid, correctly-attributed requests.

## Non-goals

- No change to `withTenantContext`, `withIdempotency`, or the double-wrap fix (it lands first; this builds on it).
- No change to what the summary signature *captures* or to the audit-log write shape — only how the assisting staff member is verified.
- No new validation dependency; reuse PRD-77's `validateSignFormBody.ts` primitives (or its regex/enum helper) rather than adding `zod` unless it is already a project dependency.
- No edits to the member-token `sign-form`/`route`/`forms` files (PRD-82) or the storage-race routes (PRD-81).
- Do **not** apply any migration to prod (none expected — these are code-only).

---

## Implementation phases

### Phase 1 — A1: mirror the `sign-form` assisted-by verification in `sign-summary`
First **read `app/api/t/[token]/pbv-full-app/sign-form/route.ts`** and copy its verified `getSession()` assisted-mode block. Replace the existence-only `admin_users` lookup at `sign-summary/route.ts:55-61` with the same pattern. The audit's suggested shape (adapt to the real field names found in `sign-form`):

```ts
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
    return { body: { success: false, code: 'assisted_session_unverified', message: 'Assisted session could not be verified.' }, status: 401 };
  }
  assistedByStaffUserId = assistedMode!.staffUserId;
}
```

Use `assistedByStaffUserId` exactly where the route previously used the existence-checked id when writing attribution. Keep the no-header path unchanged.

### Phase 2 — A5: input validation on `sign-summary`
Before any processing at `sign-summary/route.ts:43-50`, validate using PRD-77's primitives (import the UUID test / enum check from `lib/pbv/signing/validateSignFormBody.ts`, or a small shared helper if those aren't exported individually):

```ts
if (!isUuid(ceremony_id)) {
  return { body: { success: false, message: 'Invalid ceremony_id' }, status: 400 };
}
if (!['en', 'es', 'pt'].includes(language)) {
  return { body: { success: false, message: 'Invalid language' }, status: 400 };
}
// template_version: confirm the real format in code. If structured, regex-validate; if free-form, require a non-empty string and log the decision.
```

### Phase 3 — A6: UUID validation on `signature/capture`
In the corrected (single-wrap) `signature/capture/route.ts` handler, before storage/DB work at `:33-43`:

```ts
if (!isUuid(signer_member_id)) {
  return { body: { success: false, message: 'Invalid signer_member_id' }, status: 400 };
}
if (ceremony_id && !isUuid(ceremony_id)) {
  return { body: { success: false, message: 'Invalid ceremony_id' }, status: 400 };
}
```

Then **check the member-token signature/capture route** (`app/api/pbv-full-app/signer/[member_token]/signature/capture/route.ts`) for the same missing UUID validation. It is **not owned by another PRD**, so if it shares the gap, apply the equivalent guard here and note it in the build report. If it already validates or derives the member from the token (so `signer_member_id` is not body-supplied), leave it and log that.

---

## Verification / test plan

**Static gates (in-session, before commit):**
- **Gate 1 (A1 spoof):** unit test — `X-Assisted-By` set to a real-but-non-session `admin_users.id` (no matching `getSession().assistedMode`) → 401 `assisted_session_unverified`; no attribution write.
- **Gate 2 (A1 valid assisted):** unit test — header matches `assistedMode.staffUserId` and `assistedMode.applicationId === app.id` → proceeds and attributes to that staff id.
- **Gate 3 (A1 no header):** unit test — no `X-Assisted-By` → self-signed path unchanged.
- **Gate 4 (A5):** unit test — non-UUID `ceremony_id` → 400; `language='fr'` → 400; valid trio → accepted.
- **Gate 5 (A6):** unit test — non-UUID `signer_member_id` → 400 and storage/DB not called; valid → proceeds.
- **Gate 6:** `node ./node_modules/typescript/bin/tsc --noEmit` + `npm run build` clean; new tests green (`npx vitest run` on the touched paths). **No Playwright/e2e.**

**Deferred to the post-run verification pass (list in build report, do NOT block):**
- **Gate R1:** on a deployed build with a test token, complete an assisted summary signature with a valid staff session → attributed correctly; replay with a forged `X-Assisted-By` → 401.
- **Gate R2:** confirm the corrected (single-wrap) `signature/capture` still returns `data.signature_image_path` and the summary + forms signing walk completes (regression check against the double-wrap fix).

---

## Open questions

- **O1 (A1):** Exact `session.assistedMode` field names — resolve by reading `sign-form/route.ts`; do not assume the snippet's names.
- **O2 (A5):** Is `template_version` structured (e.g. `v3`, a semver, a date) or free-form? Default: validate non-empty string and log if the real format can't be confirmed in-session.
- **O3 (A6):** Does the member-token signature/capture route share the gap? Default: apply the equivalent guard here if so; otherwise leave + log.

## Decisions

- **D1 (A1):** Mirror `sign-form`'s `getSession()` assisted-mode verification exactly; unverifiable header → 401, never silently attributed.
- **D2 (A5/A6):** Reuse PRD-77's validation primitives; clean 400 before DB; no new dependency.

---

## Files expected to change

| File | Finding | Change |
|---|---|---|
| `app/api/t/[token]/pbv-full-app/sign-summary/route.ts` | A1, A5 | mirror `getSession()` assisted-by check; UUID/enum input validation → 400 |
| `app/api/t/[token]/pbv-full-app/signature/capture/route.ts` | A6 | UUID validation on `signer_member_id`/`ceremony_id` → 400 |
| `app/api/pbv-full-app/signer/[member_token]/signature/capture/route.ts` | A6 | equivalent UUID guard **iff** it shares the gap (confirm + log) |
| new test(s) | A1, A5, A6 | Gates 1–5 |

If anything outside this list needs changing, default-and-log per `BATCH-RUN-PROTOCOL.md`. Do **not** edit `withTenantContext`, the double-wrap-fixed wrapping, or files owned by PRD-81/82.
