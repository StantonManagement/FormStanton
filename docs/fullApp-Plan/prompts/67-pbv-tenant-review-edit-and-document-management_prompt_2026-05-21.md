# Windsurf Build Prompt — PRD-67: Tenant Review/Edit, Document Management & Usability

**Batch run:** read `docs/fullApp-Plan/BATCH-RUN-PROTOCOL.md` first — it governs branch, decision-handling (default-and-log, never stop to ask), prod-migration safety (write-not-apply + list in OPEN-DECISIONS), and static-vs-deferred gates for this whole batch.

Build from `docs/fullApp-Plan/67-pbv-tenant-review-edit-and-document-management_prd_2026-05-21.md`. Read it next.

After using the deployed app, four gaps surfaced: (1) no screen to see all uploaded documents, (2) no way to review/edit intake answers after intake (except building/unit, which are Stanton-fixed and stay read-only), (3) the back button is broken on the documents page (it uses `window.location.href` + internal view-state), (4) the "Download my application copy" link is offered for incomplete apps that 403. This PRD adds the view-all-documents screen, the review/edit surface, fixes navigation/back, gates the download link, and folds in a usability inventory — built on PRD-66's regenerate-lock and PRD-62's hash-mismatch enforcement so an edit can never silently desync the signed packet from the data.

---

## Branch / commit (per batch protocol)

- Work on `feat/pbv-launch-hardening` (the post-finalization batch branch, created by PRD-62 off `feat/pbv-full-finalization` or `main`). Do **not** create a per-PRD branch.
- One commit when done: `PRD-67: tenant review/edit + document management + usability`.
- **Push after commit.**

## Shell + DB

- Type-check with `node ./node_modules/typescript/bin/tsc --noEmit`, never `npx tsc` (hangs on Windows). See `docs/SHELL-PROTOCOL.md`. Then `npm run build`. Then `vitest run`.
- This PRD writes a DB schema change **only if** O5 resolves "yes" (an `intake_edited_after_generation_at` column). If you add it: **write + commit the migration file; do NOT apply it to prod (`lieeeqqvshobnqofcdac`).** Add it to "Prod migrations to apply" in `docs/fullApp-Plan/OPEN-DECISIONS.md`. Default: no migration needed (PRD-66's `generation_version` + the `signing_status` reset already record an edit-regenerate).

---

## The sharp interaction (read this twice)

`intake/complete` (`intake/complete/route.ts:113-124`) writes the answers into the immutable **`intake_snapshot`** and sets **`intake_data = '{}'`**. `generate-forms` reads `intake_snapshot` (`generate-forms/route.ts:59`). So a post-complete edit that writes the old `intake_data` path is **invisible to the packet.** An edit after generation/signing MUST:

1. **Confirm** — show "This change means you'll need to review and sign your forms again." (confirm/cancel). No silent edit of signed data.
2. **Persist to `intake_snapshot`** (not `intake_data`); re-run `bridgeIntakeToDatabase` for member-affecting sections so `pbv_household_members` is current before regenerate.
3. **Regenerate** via the existing idempotent `generate-forms` — PRD-66 bumps `generation_version` and writes a new versioned unsigned path + `unsigned_pdf_hash` when signatures exist; it does NOT clobber bytes a signer committed to.
4. **Reset signing** — clear changed forms' `collected_signer_member_ids` (`[]`) + `status='generated'`, clear the summary signature if summary content changed, then `updateApplicationSigningStatus` (`completeForm.ts:283-308`) so `signing_status` drops back. Dashboard cards recompute automatically.
5. **Backstop** — even without the explicit reset, PRD-62 Check 5 + PRD-66's version bump block finalize with "hash mismatch — please re-sign." The reset is the UX; Check 5 is the guardrail.

Editing is **pre-submission only**: `withTenantContext` returns 409 `submitted_locked` once `submitted_at` is set (`tenantEndpoint.ts:42-47`). After submission the review surface is read-only with a "contact the office at (860) 527-3813" path. **Building & unit are never editable by the tenant** (Stanton-fixed; they live on `pbv_full_applications`, not in `components/pbv/intake/*`).

---

## Step-by-step

### Step 0 — Read the ground truth
Read `documents/page.tsx`, `TenantDashboard.tsx`, `SectionReview.tsx`, `AlmostDoneReview.tsx`, the intake `Section*` components, `intake/complete/route.ts`, `intake/[section]/route.ts`, `generate-forms/route.ts`, `completeForm.ts:283-308`, `tenantEndpoint.ts`, `print/download/route.ts`. Confirm the PRD's line refs still hold; if drifted, follow the code and note it in the build report.

### Step 1 — View-all-documents + navigation/back fix (PRD Phase 1)
- Add a `view_all` screen to the documents flow listing **every** doc from the documents GET (it already returns `file_url`, `status`, `category`, `current_revision`, `rejection_reason_display`). Group by category by **reusing/generalizing `AlmostDoneReview`'s categorization** (`AlmostDoneReview.tsx:120-203`) — do not write a parallel grouper. Before submission: View + Retake/Replace per uploaded doc (reuse `handleRetakeFromReview`/`findCardIndexById`), Upload for missing. After submission (`submitted_at` set): **View/Download only**, no Retake/Replace.
- Add "View my documents" + "Review & edit my application" entries to `TenantDashboard.tsx` → `router.push`. Available before & after submission.
- **Back fix:** replace `window.location.href` (`documents/page.tsx:118,122`) with `useRouter().push`; read a `?view=` search param with `useSearchParams` so browser back moves between sub-views and never dead-ends. If full URL-reflection is more than a targeted fix, the **minimum bar** is: explicit on-screen Back on every non-initial sub-view (the `AlmostDoneReview` header back is the pattern) AND browser-back from the documents page returns to the dashboard, not out of the app. Also honor `filter=rejected` (the dashboard banner deep-links it — `TenantDashboard.tsx:209,262` — but the page never reads it: U10). Keep `window.location.reload()` in the error fallback.

### Step 2 — Review & edit surface + regenerate-on-edit (PRD Phase 2)
- Add `app/pbv-full-app/[token]/review/page.tsx` (or a dashboard-launched view): per visible section, a read-only block + **Edit** button (mirror `SectionReview.tsx:74-93`); editing opens the **existing** `Section*` component. Building & unit render **read-only** (reuse the `intake/page.tsx:188-219` "Your Unit" card + call-the-office line).
- **Edit-save:** when `intake_status==='complete'`, write the corrected section into **`intake_snapshot`** (not `intake_data`). Use a dedicated edit path (extend `intake/[section]` with PATCH semantics or add `intake/edit`) under `withTenantContext` (so it 409s post-submission). Re-run `bridgeIntakeToDatabase` for member-affecting sections.
- **Wire the key interaction** exactly as "The sharp interaction" section above: confirm gate → persist snapshot → regenerate → clear changed forms' collected signatures + `updateApplicationSigningStatus`. **Default scope = regenerate all enabled forms + clear all collected signatures on any post-generation edit** (idempotent, correct; a per-section→forms impact map is a future optimization — log to OPEN-DECISIONS).
- The review/edit surface's data source is the canonical snapshot post-complete; if the bootstrap doesn't already expose the snapshot, extend it (default-and-log).

### Step 3 — Usability fixes + download-link gating (PRD Phase 3)
- **Download link:** change `TenantDashboard.tsx:275` condition from `intake_status==='complete'` to `submitted_at` (default — the unambiguous "copy ready" point; the endpoint 403s otherwise). When not downloadable, hide or disable the link (keep the explanatory subtext). Log the gate choice to OPEN-DECISIONS.
- **In-scope usability fixes:** U5 wire `DocumentCardStack.handleSeeFullList` (`:231-238`) to the new view-all instead of `alert(...)`; U6 fix the placeholder help phone `(203) 555-1234` (`DocumentCardStack.tsx:555`) to the real office number (`(860) 527-3813` / `getOfficeContact`); U8 submitted-state links to the view-all (read-only); U10 honor `filter=rejected` (done in Step 1).
- **Deferred (flag in build report, do NOT build):** U7 hub progress indicator, U9 PT prose (PRD-59), U11 leave-with-missing confirmation.

### Step 4 — Static gates + build report + commit + push
`node ./node_modules/typescript/bin/tsc --noEmit` then `npm run build`, both clean; new tests green. Build report at `docs/build-reports/67-pbv-tenant-review-edit-and-document-management_build-report_2026-05-21.md`. Commit `PRD-67: …`. **Push.**

---

## Files to modify

| File | Change |
|---|---|
| `app/pbv-full-app/[token]/documents/page.tsx` | `view_all` sub-view; `router.push` not `window.location.href`; `useSearchParams` (`view=`, `filter=rejected`) so back works |
| `components/pbv/cards/AlmostDoneReview.tsx` (or extract a `DocumentList`) | generalize grouping for a persistent view-all (view-only after submission) |
| `components/pbv/sign/TenantDashboard.tsx` | add "View my documents" + "Review & edit my application" entries; gate download link on `submitted_at` |
| `components/pbv/cards/DocumentCardStack.tsx` | wire `handleSeeFullList` to view-all (drop the `alert`); fix placeholder help phone |
| `app/pbv-full-app/[token]/review/page.tsx` (new) | review/edit surface reusing `Section*`; building/unit read-only |
| `app/api/t/[token]/pbv-full-app/intake/[section]/route.ts` or new `intake/edit` | post-complete edit writes `intake_snapshot`; re-bridge member-affecting sections; under `withTenantContext` |
| edit regenerate/reset (inline or `lib/pbv/regenerateAfterEdit.ts`) | call `generate-forms`; clear changed forms' collected signers + `status='generated'`; `updateApplicationSigningStatus` |
| `supabase/migrations/<ts>_prd67_intake_edited_after_generation.sql` | **only if O5 → yes:** `intake_edited_after_generation_at` — commit only, list in OPEN-DECISIONS, do not apply |
| tests (new) | per the gates below |

## Files NOT to touch

- Signing-completion internals (PRD-62 owns `completeForm.ts` structure + `unsigned_pdf_hash`) — only **call** `updateApplicationSigningStatus` and clear collected signers.
- Regenerate-versioning mechanics (PRD-66 owns `generation_version` + versioned paths) — only **invoke** `generate-forms`; rely on its version-safety.
- `generate-forms` generation logic beyond invoking it on edit.
- Building/unit editability — never expose them as editable to the tenant.
- `.git/config` — it is fine. If git genuinely errors, log a BLOCKER; do not "fix" it.

---

## Verification gates (per PRD-67)

**Static (must pass in-session before commit):**
- **Gate 1 (view-all):** renders all docs from a fixture covering every status; uploaded → View action; after submission → no Retake/Replace.
- **Gate 2 (edit reuses intake components):** the edit surface mounts the existing `Section*` components, not parallel UI.
- **Gate 3 (building/unit read-only):** building & unit render read-only; no editable input bound to them.
- **Gate 4 (regenerate-on-edit):** post-complete section edit writes `intake_snapshot` (not `intake_data`), invokes regenerate, clears changed forms' `collected_signer_member_ids`/resets `signing_status`, and the confirm gate fires first.
- **Gate 5 (back works):** documents page uses `router.push` (no nav via `window.location.href`); sub-views reachable/leavable via router; `filter=rejected` honored.
- **Gate 6 (download gating):** link absent/disabled when not downloadable, present when `submitted_at` set.
- **Gate 7:** `tsc --noEmit` + `npm run build` clean; `vitest run` green.

**Deferred to the post-run verification pass (list in build report, do NOT block):**
- **Gate R1:** preview + phone — dashboard → View my documents opens every uploaded doc; browser back returns to dashboard, not out of the app.
- **Gate R2:** complete-but-not-finalized app — edit an answer, confirm the re-sign warning, forms regenerate, signing cards reset to unsigned, finalize blocked until re-signed.
- **Gate R3:** download link hidden until finalize; after finalize returns a real merged PDF (not 403/empty).
- **Gate R4:** editing after `submitted_at` is impossible (UI read-only + endpoint 409).

---

## What "done" looks like

1. `PRD-67: …` commit on `feat/pbv-launch-hardening`, **pushed**; any migration committed + listed in OPEN-DECISIONS (not applied).
2. Static gates green.
3. View-all-documents screen reachable from the dashboard, before & after submission (read-only after).
4. Review/edit surface reuses intake components; building/unit read-only; an edit after generation confirms → regenerates → resets signing, with PRD-62 Check 5 as the backstop. No silent packet/data desync.
5. Browser back works across the tenant flow; documents flow no longer uses `window.location.href` for nav.
6. Download link gated on `submitted_at`; in-scope usability fixes (U1, U2, U3, U4, U5, U6, U8, U10) done; deferred items (U7, U9, U11) flagged.
7. Build report written, deferred runtime gates + decisions logged.

## What NOT to do

- **Do not stop to ask** — default-and-log per the batch protocol.
- Do not let an edit silently overwrite a signed packet's data — confirm + regenerate + reset, always.
- Do not make building/unit editable. Do not allow editing after `submitted_at`.
- Do not apply any DB migration to prod. Do not run destructive SQL.
- Do not use `npx tsc`. Do not "fix" `.git/config`. Do not rearchitect the router if a targeted back fix works. Do not touch PRD-62/PRD-66 internals beyond invoking them.
- Do not block on deploy/device gates — defer them to the build report.

## Reporting back (in the build report)

- Commit SHA; pushed; any migration file path (listed in OPEN-DECISIONS) or "no migration needed."
- View-all + review/edit screens summary; the edit→regenerate→re-sign wiring (which forms cleared, how `signing_status` resets).
- Usability findings: in-scope fixed (U1–U6, U8, U10) + deferred (U7, U9, U11) with recommended owner.
- Decisions/defaults logged to OPEN-DECISIONS (O1–O5).
- Deferred runtime gates (R1–R4) for the post-run pass.

---

**Run position:** this is the largest PRD in the batch and depends on 62/66; its position in the run order is set by the **batch orchestrator** (likely last). Do not assume a fixed neighbor — read the orchestrator's order.
