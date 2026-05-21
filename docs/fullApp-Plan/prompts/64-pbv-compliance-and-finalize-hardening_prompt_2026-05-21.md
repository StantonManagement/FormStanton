# Windsurf Build Prompt — PRD-64: Compliance & Finalize Hardening

**Batch run:** read `docs/fullApp-Plan/BATCH-RUN-PROTOCOL.md` first — it governs decision-handling (default-and-log, never stop to ask), prod-migration safety, and static-vs-deferred gates.

Build from `docs/fullApp-Plan/64-pbv-compliance-and-finalize-hardening_prd_2026-05-21.md`. Read it next.

Two audit-integrity fixes from `docs/audits/pbv-full-app-code-and-workflow-audit_2026-05-21.md` (findings #4 and #10), both HACH-facing compliance signals:
- **#4** — `sign-form` trusts `X-Assisted-By` with an existence-only `admin_users` lookup, so any client can forge "staff X assisted" into the signature audit log.
- **#10** — `finalize` sets `submitted_at` then writes the `application.submitted` event in a swallowing `try/catch`, so a submitted app can have no submission event (broken audit timeline).

**Scope guard:** security + atomicity only. Do **not** touch the sign-form unification / hash-verification refactor (audit #1/#2/#3/#5/#6/#8 — that's **PRD-62**).

---

## Branch / commit

- Work on `feat/pbv-launch-hardening`.
- **One commit** when done: `PRD-64: compliance & finalize hardening`. **Push after commit.**

## Shell + DB

- Type-check with `node ./node_modules/typescript/bin/tsc --noEmit`, never `npx tsc` (hangs on Windows). See `docs/SHELL-PROTOCOL.md`.
- This PRD adds a SQL function migration. **Write + commit it; do NOT apply it to the prod Supabase project (`lieeeqqvshobnqofcdac`).** Add it to the "Prod migrations to apply" section of `docs/fullApp-Plan/OPEN-DECISIONS.md`.
- `.git/config` is fine — do not "fix" it.

---

## Step-by-step

### Step 1 — #4: verify `X-Assisted-By` against the active staff session
In [app/api/t/[token]/pbv-full-app/sign-form/route.ts:67-78](app/api/t/[token]/pbv-full-app/sign-form/route.ts#L67), replace the existence-only block. A real staff session exists — the `assisted-mode` GET route already verifies it ([app/api/t/[token]/pbv-full-app/assisted-mode/route.ts:42-55](app/api/t/[token]/pbv-full-app/assisted-mode/route.ts#L42)). Mirror that pattern:

1. Read `X-Assisted-By`. **Absent** → `assistedByStaffUserId = null`, proceed (the self path, unchanged).
2. **Present** → `getSession()` (from `@/lib/auth`), read `session.assistedMode`.
3. Verify **all**: `assistedMode` exists **and** `assistedMode.staffUserId === assistedByHeader` **and** `assistedMode.applicationId === app.id`.
4. Verified → `assistedByStaffUserId = assistedMode.staffUserId`.
5. **Not** verified → return **401** `{ success: false, code: 'assisted_session_unverified' }` and `console.warn` a structured line (`event: 'assisted_by_unverified'`, `header_value`, `app_id`, `has_session`). Do **not** fall back to a self-signed event.

Remove the misleading "Validate that this staff user exists in admin_users" comment; replace with an audit-integrity (HACH-facing) comment.

**If `getSession()` cannot read the `admin_session` cookie from this tenant route** (the `assisted-mode` GET route reading it is strong evidence it can — confirm), take the **stopgap**: reject any present `X-Assisted-By` with 401 + structured warning, and log a **BLOCKER** in OPEN-DECISIONS that proper staff-session/HMAC verification is still needed. **Do NOT leave the existence-only check in place silently.**

### Step 2 — #10: atomic submit + event (preferred: SQL function)
Add `supabase/migrations/<ts>_finalize_pbv_application_fn.sql` — a `SECURITY DEFINER` plpgsql function `finalize_pbv_application(p_app_id uuid, p_submitted_at timestamptz, p_actor_display_name text)` that, in one transaction:
- `UPDATE pbv_full_applications SET submitted_at = p_submitted_at WHERE id = p_app_id AND submitted_at IS NULL`;
- `INSERT INTO application_events (anchor_type, anchor_id, event_type, actor_user_id, actor_display_name, payload) VALUES ('pbv_full_application', p_app_id, 'application.submitted', NULL, p_actor_display_name, jsonb_build_object('submitted_at', p_submitted_at))`;
- `RAISE` on any error to roll back. `GRANT EXECUTE ... TO service_role`.

Mirror the style of `supabase/migrations/20260513000001_hap_execution_function.sql`. Confirm the `application_events` column set against `20260513160000_document_lifecycle_phase1.sql` + the polymorphic anchor in `20260513200000_application_events_generalize.sql`.

In [app/api/t/[token]/pbv-full-app/finalize/route.ts:49-69](app/api/t/[token]/pbv-full-app/finalize/route.ts#L49), replace the separate update + best-effort event with a single `supabaseAdmin.rpc('finalize_pbv_application', { p_app_id: app.id, p_submitted_at: submittedAt, p_actor_display_name: 'Tenant' })`. On RPC error → return **500**, app stays unsubmitted.

**Fallback if the SQL function can't be validated in-session** (no DB to compile against, or you decide `application.submitted` must keep firing the in-process subscriber): keep `writePbvApplicationEvent` but make it **event-first** — write the event before `submitted_at`, return 500 if it throws (app stays unsubmitted), then set `submitted_at`. Default-and-log which path you took.

**Subscriber note:** the SQL path bypasses `_notifySubscribers` ([lib/events/application-events.ts:459](lib/events/application-events.ts#L459)). `application.submitted` has no subscriber today (neutral), but log this divergence in OPEN-DECISIONS so a future submit-notification isn't silently dropped.

### Step 3 — Static gates + build report + commit
`node ./node_modules/typescript/bin/tsc --noEmit` then `npm run build`, both clean; new tests green. Build report at `docs/build-reports/64-pbv-compliance-and-finalize-hardening_build-report_2026-05-21.md`. Commit `PRD-64: compliance & finalize hardening`, push. Then **proceed to the PRD-65 prompt.**

---

## Files to modify

| File | Change |
|---|---|
| `app/api/t/[token]/pbv-full-app/sign-form/route.ts` | replace existence-only `X-Assisted-By` block with `getSession().assistedMode` verification; 401 + structured warn on unverified |
| `supabase/migrations/<ts>_finalize_pbv_application_fn.sql` | new `finalize_pbv_application(...)` function — **commit only, list in OPEN-DECISIONS, do not apply** |
| `app/api/t/[token]/pbv-full-app/finalize/route.ts` | call `rpc('finalize_pbv_application', …)` (or event-first fallback); 500 on failure |
| new test(s) | Gates 1–4 below |

## Files NOT to touch

- `lib/pbv/signing/completeForm.ts`, the member-token signer route, `typed_name` plumbing, document-hash verification (PRD-62).
- `app/api/admin/pbv/full-applications/[id]/assisted-session/route.ts` (assisted-session start/stop unchanged).
- `lib/tenantFetch.ts` (header emission is fine; the fix is server-side verification).

---

## Verification gates (per PRD-64)

**Static (must pass in-session before commit):**
- **Gate 1 (#4 rejected):** `X-Assisted-By` present with no matching / mismatched `session.assistedMode` → 401 `assisted_session_unverified`, no `assisted_by_staff_user_id` written.
- **Gate 2 (#4 ignored when absent):** no header → signs as before, `assisted_by_staff_user_id=null`.
- **Gate 3 (#4 accepted when valid):** header === `assistedMode.staffUserId` and `assistedMode.applicationId === app.id` → staff id recorded.
- **Gate 4 (#10 atomic / event-first):** event-write failure → `submitted_at` not set, route 500; success → both land.
- **Gate 5:** `tsc --noEmit` + `npm run build` clean.

**Deferred to the post-run verification pass (list in build report, do NOT block):**
- **Gate R1:** apply migration on preview/staging DB; confirm `finalize_pbv_application` runs + rolls back on forced event failure.
- **Gate R2:** live staff-assisted ceremony walk — assisted session set → `assisted_by_staff_user_id` recorded; replay header without a session → 401.

---

## What "done" looks like

1. `PRD-64: compliance & finalize hardening` commit on `feat/pbv-launch-hardening`, pushed; migration committed + listed in OPEN-DECISIONS (not applied).
2. Static gates 1–5 green.
3. `X-Assisted-By` is session-verified (or 401-stopgap + BLOCKER logged); no forged staff attribution path remains.
4. Submit + event are atomic (SQL function) or event-first; a submitted app always has its `application.submitted` event.
5. Build report written; deferred runtime gates + the subscriber-divergence note listed. Proceed to the PRD-65 prompt.

## What NOT to do

- **Do not stop to ask** — default-and-log per the batch protocol.
- Do not leave the existence-only `X-Assisted-By` check in place silently. If session-verification isn't achievable, stopgap-401 + BLOCKER.
- Do not fall back to a self-signed event when `X-Assisted-By` is present-but-unverifiable — fail closed (401).
- Do not apply the migration to prod. Do not run destructive SQL.
- Do not use `npx tsc`. Do not "fix" `.git/config`. Do not touch PRD-62's sign-form refactor.
- Do not block on deploy-only gates — defer them to the build report.

## Reporting back (in the build report)

- Commit SHA; migration file path (listed in OPEN-DECISIONS).
- #4 mechanism chosen (session-verify vs 401-stopgap) + why.
- #10 mechanism chosen (SQL function vs event-first) + the subscriber-divergence note.
- Static gates pass/fail; deferred runtime gates (R1, R2) for the post-run pass.
- Decisions / any BLOCKER logged to OPEN-DECISIONS.
