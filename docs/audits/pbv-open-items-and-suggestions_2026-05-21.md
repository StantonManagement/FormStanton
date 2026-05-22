# PBV Open Items & Suggestions — Consolidated

**Date:** 2026-05-21  
**Audits reviewed:** `pbv-prds-22-30-error-audit`, `tenant-link-form-fill-audit`, `49-pbv-launch-readiness-audit`, `pbv-stress-test-report`, `pbv-full-app-code-and-workflow-audit`, `pbv-adjacent-errors-deep-check`  
**Scope:** Items not yet closed. Suggestions are ordered by risk (deploy blockers first).  

---

## Pass 1 — Deploy Blockers (Migrations Committed but Unapplied)

| # | Item | Risk | Suggestion | Owner |
|---|------|------|------------|-------|
| 1 | `20260521010000_prd62_unsigned_pdf_hash.sql` not applied | High — finalize Check 5 silently skips for all legacy rows; hash mismatch detection is disabled | Apply migration. It is additive/nullable; safe to run before or after code deploy. Backfill is optional (null rows skip the check gracefully). | Alex |
| 2 | `20260521080000_cron_run_locks.sql` not applied | Medium — cron deduplication across Vercel regions is not enforced. Auth is enforced (PRD-74), but parallel regional runs can still duplicate work | Apply migration. The `claim_cron_run` RPC is a SECURITY DEFINER function. Test: fire two near-simultaneous cron invocations; expect one `skipped: true` | Alex |
| 3 | `20260521090000_pbv_rls_lockdown.sql` not applied | **Critical** — `pbv_document_requirements` and `pbv_rejection_reason_templates` still have `public` role policies. Any anonymous Supabase client can read/write | Apply migration. Verify with: `SELECT tablename, policyname, roles FROM pg_policies WHERE schemaname='public' AND tablename IN ('pbv_document_requirements','pbv_rejection_reason_templates')` — confirm no `public` in `roles` array | Alex |
| 4 | `20260521100000_pbv_signature_events_hash_index.sql` not applied | Low at current scale — finalize Check 5 queries `document_hash` by `form_document_id` without a covering index. Will degrade as signature event volume grows | Apply migration. Verify with `EXPLAIN (ANALYZE) SELECT document_hash, signer_member_id FROM pbv_signature_events WHERE form_document_id = '<id>'` — expect `idx_pbv_signature_events_form_hash` Index Only Scan | Alex |

---

## Pass 2 — Code Items Requiring Verification (Fixes May Be Incomplete)

| # | Item | Source Finding | Why It Needs Checking | Suggestion | Owner |
|---|------|---------------|----------------------|------------|-------|
| 5 | Multi-signer stamping only uses last signer's image | H1, H2, D2 | `completeForm.ts` emits row-pattern markers, but the `imageResolver` may still bind a single `sigImageBytes` buffer to every signature slot. If true, `citizenship_declaration`, `obligations_of_family`, `debts_owed_phas`, and all `each_adult` forms would have the LAST signer's image repeated in every adult row | Walk the `completeForm.ts` `allSigned` branch. Confirm the `data` dictionary passed to `stampForm` contains per-signer image buffers keyed by `signer_member_id` (or row index), not a single shared buffer. If incomplete, the resolver needs to map `__row_pattern:${data_key}:signature` markers to `eventsByMemberId[signer_member_id]` bytes | Cascade |
| 6 | `generate-forms` upsert collapses `each_adult` into one row | D3 | The loop over adult slots upserts `pbv_form_documents` with `onConflict: 'full_application_id,form_id,language'`. Each iteration overwrites `required_signer_member_ids` with a single-element array. After generation, only one adult is listed as required, so `allSigned` trips after the first signature | Verify `@/app/api/t/[token]/pbv-full-app/generate-forms/route.ts`. The fix is to build the union of all adult `member.id`s once, upsert ONE row per `(form_id, language)` with `required_signer_member_ids` = `[...allAdultIds]`, and skip per-slot upserts for `each_adult`/`individual` templates | Cascade |
| 7 | Intake review redirects to "coming soon" stub | D1 | `SectionReview.tsx` may still `router.push('/review')` instead of `/dashboard`. The `/review` stub page tells the tenant "coming soon" with no CTA | Verify `@/components/pbv/intake/SectionReview.tsx` line ~204. If it still pushes `/review`, change to `/dashboard`. The dashboard is fully built and the root dispatcher already routes `intake_status='complete'` there | Cascade |
| 8 | `sign-form` stamps even when `fieldMap` is missing | M3 | If `fieldMap` is null (missing JSON file), the code may still set `status = 'signed'` without producing a signed PDF | Verify `@/lib/pbv/signing/completeForm.ts` or the HOH route. If `fieldMap` null → `status` should NOT advance to `signed`. Return 422 `field_map_missing` instead | Cascade |
| 9 | `row_patterns` plural key consistency across field maps | L5 | Some field maps may use `row_pattern` (singular) while `stamper.ts` accepts both singular and plural. Mismatch = table not stamped | Grep all 22 `.json` field maps for `"row_pattern"` vs `"row_patterns"`. Confirm every map that needs the plural array uses the plural key. If any singular key exists for a multi-table form, rename | Cascade |
| 10 | `canGoNext` does not gate on section validity | L2 | `IntakeShell` Next button is always enabled. Tenant can advance past incomplete sections | Wire `isSectionComplete(sectionSlug, intakeData)` from `@/lib/pbv/intake-schema.ts` into the Next button `disabled` prop. This is a UX friction item, not a data-loss risk (intake/complete validates at the end) | Future sprint |
| 11 | `AssistedHandoffPrompt` resets on every signature pad mount | M4 | Staff-assisted tenants must confirm handoff for every single form | Persist `handoffConfirmed` in ceremony-level state (e.g. `useSigningCeremony`) so it only shows once per contiguous signing session | Future sprint |

---

## Pass 3 — Deferred / Out-of-Scope / Operational

| # | Item | Source Finding | Status / Reason | Suggestion | Owner |
|---|------|---------------|-----------------|------------|-------|
| 12 | Magic-link SMS never sent | D5 | `send-link` endpoint only stores the token. No SMS provider integration | Two options: (a) hook `send-link` to existing Twilio/SMS provider used by pre-app flow, or (b) change UI button to "Copy link to clipboard" and surface the magic-link URL for HOH to relay manually. Option (b) is cheaper and unblocks launch | Product decision |
| 13 | `KNOWN_PACKAGE_HASH` placeholder | L1 | `tests/e2e/pbv-form-execution-happy-path.spec.ts:35` has `'UPDATE_ME'` | Run the E2E happy-path spec once. After a passing run, copy the emitted `package-hash.txt` value into the constant. Document this step in `docs/TESTING.md` | Alex + E2E runner |
| 14 | `tenant_lookup` table has no CREATE TABLE migration | 49-launch-readiness §5 | Referenced in migrations `20260408210000` and `20260501000000` but table was likely created manually in early dev. New environments (staging, prod clones) may fail | Write a migration: `CREATE TABLE IF NOT EXISTS tenant_lookup (...)` with the inferred columns. Or confirm the table exists in prod and snapshot its schema into a migration for reproducibility | Alex / DBA |
| 15 | dev-HACH China Wall review | 49-launch-readiness §6 | Commit `c09d237` on `dev-HACH` touches print rendering across all forms. May affect HACH handoff document generation | Before merging `dev-HACH` to `main`, review `c09d237` for form-template changes that could alter HACH-bound output. If any form template used by HACH is modified, gate the merge until the China Wall posture is confirmed | Alex |
| 16 | PRD-81 A2 deploy-gate decision | PRD-81 build report | The audit's Launch Decision Matrix demotes A2 (`signatures` POST race) to "v1.1", but the findings section tags it CRITICAL. PRD-81 built the fix regardless | Decide: since the fix is already on branch, it can ship with the batch. The question is whether to hold the deploy until the branch merges. Suggestion: do not gate deploy on A2 (the fix is committed), but fast-track the branch merge so the fix reaches prod without delay | Alex |
| 17 | Pre-existing test-suite baseline failures | PRD-62 build report | ~55 tests fail in non-PBV code (mostly `components/review/__tests__/useReviewKeyboardShortcuts.test.ts`). These mask real regressions in CI | Stabilize or skip the failing review-suite tests. Add a CI job that runs only PBV tests (`vitest run lib/pbv/__tests__`) so the PBV lane has a clean signal independent of the pre-existing noise | CI owner |
| 18 | PT translations marked tentative | D9, 49-launch-readiness | Portuguese copy has `// PT: tentative` markers across intake landing, dashboard, and form signing | Alex's 2026-05-21 resolution was "ship best-effort, native review post-launch." Keep this posture. Create a follow-up ticket for native PT speaker review of all `pt` copy objects | Future sprint |
| 19 | PRD-77 tenant sign-form route still uses string-matching for not_found | PRD-82 build report O3 | PRD-82 added `errorCode` to `CompleteFormResult` for the member-token route. The HOH route at `@/app/api/t/[token]/pbv-full-app/sign-form/route.ts:145` still does `.toLowerCase().includes('not found')` | Non-blocking — the string match still works because `completeForm.ts` preserves the `error` string verbatim. For consistency, migrate the HOH route to `result.errorCode === 'not_found'` in a future polish PR. One-line change | Future polish |
| 20 | PRD-62 legacy null `unsigned_pdf_hash` rows skip Check 5 | PRD-62 build report O1 | Existing rows (pre-migration) have `unsigned_pdf_hash = null`. Finalize Check 5 skips them | Acceptable for launch — these rows were generated before the hash-tracking era. A backfill migration can compute and populate `unsigned_pdf_hash` for existing `pbv_form_documents` rows if needed later. Not a launch blocker | Optional |

---

## Suggested Priority Order

1. **Apply the 4 unapplied migrations** (#1–#4) — these are the only remaining deploy blockers.
2. **Verify items #5, #6, #7** — multi-signer stamping, generate-forms adult collapse, and intake routing. These are the largest functional risks.
3. **Run the E2E happy-path spec** (#13) — populates the hash constant and confirms end-to-end flow.
4. **Decide on #12** (magic-link SMS) — product call on whether to ship with clipboard relay or block on SMS integration.
5. **Everything else** (#8–#11, #14–#20) — post-launch or async follow-up.

---

## Verification Checklist

- [ ] Migration `20260521010000_prd62_unsigned_pdf_hash.sql` applied to `lieeeqqvshobnqofcdac`
- [ ] Migration `20260521080000_cron_run_locks.sql` applied
- [ ] Migration `20260521090000_pbv_rls_lockdown.sql` applied
- [ ] Migration `20260521100000_pbv_signature_events_hash_index.sql` applied
- [ ] Multi-signer stamping verified (citizenship_declaration with 2+ adults)
- [ ] `generate-forms` produces correct `required_signer_member_ids` for `each_adult` forms
- [ ] Intake review CTA routes to `/dashboard`, not `/review`
- [ ] E2E spec passes and `KNOWN_PACKAGE_HASH` updated
- [ ] `tenant_lookup` migration written and applied (or confirmed in prod)
- [ ] dev-HACH `c09d237` reviewed for China Wall impact

---

*Generated from 6 audit files, 3 deduplication passes. No duplicate items across passes.*
