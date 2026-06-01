# HANDOFF — PBV field-map remediation + Mia/Santha doc regen + PRD-87 review UI

**Date:** 2026-05-31 · **Reason for handoff:** context too large; continue in a fresh session.
**Full plan (keep):** `C:\Users\Alex\.claude\plans\wobbly-stirring-gadget.md` (the "ACTIVE PLAN (2026-05-31)" section at top).
**Sequencing constraint (memory):** Mia/Santha must run **PRD-86 (fix+regen) → PRD-87 (human review) → PRD-85 Phase 4 (signing prompt)**. NEVER send the signing prompt before docs are fixed AND human-reviewed.

---

## TL;DR state (updated end of session 2 — 2026-06-01)
- The PBV process is **NOT broken**. **PR #9 is MERGED + DEPLOYED** (build fix + status-label copy fixes). Corrected maps are live in prod.
- **All 6 unsigned-v1 apps regenerated → v2** (Mia, Santha + 4 test apps). Each got 4 forms re-stamped to v2 (`main_application`, `citizenship_declaration`, `criminal_background_release`, `eiv_guide_receipt`); other 7 forms unchanged → stay v1. **No notification sent.**
- **Sign-off review (Mia/Santha v2) caught ONE new defect:** the citizenship declaration rendered DOB + status but left the **family-member NAME blank** (map used `member_key:"full_name"`, data emits `name`). **Fixed in PR #10** (also bumps citizenship `field_map_version` 2→3 so regen re-stamps). main_application + criminal_background_release v2 verified GOOD (names + columns correct). Renders in `_pbv-review/renders/`.
- Nothing sent to any applicant. Safe to pause.

## Single next action (blocks everything)
**Merge PR #10** → deploy → re-regen → finish Mia/Santha sign-off.
- **PR #10** = `Fix: family member name missing on citizenship declaration` (branch `fix/citizenship-member-name`). 2 JSON field maps only: `member_key "full_name"→"name"` (EN+ES) + `field_map_version "2"→"3"`. Harness passes 24/24; Vercel GREEN; `check-buildings` red is the SAME pre-existing `supabaseUrl is required` env noise — ignore.
- **After merge (I drive this):** (1) poll #10 merge-commit deploy for `state=success`; (2) re-run regen for the 6 apps `./node_modules/.bin/tsx scripts/regen-applicant-forms.ts <6 appIds>` (citizenship bumps to **v3**); (3) re-render + verify Mia/Santha citizenship name now appears (`_pbv-review/render_v2.py` pattern + text-layer check); (4) present for Alex sign-off → **GATE**.
- Then: **Phase B** deploy PRD-87 review UI (apply migration `20260531130000_prd87_pbv_document_review_approvals.sql`) → **Phase C** operator review→Approve→send (`PBV_PREFLIGHT_CHECKLIST`). NEVER send before docs fixed AND human-reviewed.

### Done in session 2 (2026-06-01)
- **PR #9 merged+deployed** (merge commit `33c284a`, Production deploy `4884237924` = success). Build fix (tsx dep, superseded #8 — **#8 still OPEN, can close**) + PBV status-label copy fixes across 8 files EN/ES/PT (e.g. step "Complete"→Submitted/Signed/Uploaded; "Missing"→"Not uploaded"; staff "Intake Submitted"→"Ready for Review"). Display strings only, no schema change.
- **Regen done** for all 6 apps → v2 (verified in DB: gen_versions [1,2]).
- **Phase 0 source-PDF check (DONE):** all 24 `assets/pbv-source-pdfs/*.pdf` **byte-identical** to `docs/templates/` blanks (calibration valid). Federal forms current (HUD-52675 OMB exp 06/30/2026). **Still needs Alex:** confirm HACH/local form editions (hach-release, criminal-bg, citizenship/child-support affidavits, obligations-of-family, main-application, eiv-guide-receipt) — not web-verifiable. Audit: `_pbv-review/source_pdf_audit.txt`.
- **"Mia showed complete" explained:** not a bug — `intake_status='complete'` = intake *questionnaire* submitted; tracker correctly shows government_id + paystubs = `missing` (collected at preflight/send, intentionally not triggered). Labeling conflation → fixed in PR #9.
- **WIP parked:** session-1 tracked WIP in `git stash@{0}` (stale vs newer main; needs reconciliation). Untracked WIP in tree. Two older stashes (`@{1}`,`@{2}`) pre-existing, untouched. **Current branch: `fix/citizenship-member-name`.**
- **Regen scope (reference):** 6 apps with unsigned defective v1 = Mia `2b451d4e-6578-43e6-9689-450cadcc62fe`, Santha `00d613e5-1573-4a7b-ab98-73a46ca4d681`, QA Walk Tester `43c97fac-21c7-482c-b210-476d3b1d0dba`, QA Test Applicant `bf4a255e-e594-4a5d-8fdd-c1a12ad32023`, Ddbsj `156df9de-fac7-4f96-b84a-20615470a509`, Verify Test Tenant `92c27919-e26a-4686-9357-4c50b9305ded`. Only Mia/Santha → sign-off. (3 signed test apps = do-not-regen; 5 complete-but-0-forms incl. Claudia Ferreira `ffffcafe…` = out of scope.) Supabase project `lieeeqqvshobnqofcdac`.

---

## What's DONE (merged as PR #7, commit `cdbf244`, merge `66cb51ef`)
PRD-86 "watchful" field-map authoring/verifier + all 24 maps corrected. Built in `lib/field-map-authoring/`:
- **Verifier (rasterization-free, gates `pass=false`):** `placement.ts` (`findOverprints`, `findOffPageText`, `findValueCollisions`, `findColumnMisalignment`, `valueBoxesFromMap`, `loadStamperFont` — uses the stamper's `StandardFonts.Helvetica` metrics), `textlayer.ts` (`extractPrintedWords` + `classifyWord`, decomposes label vs fill-line runs). New finding kinds: `overprint | offpage_text | column_misaligned | value_collision`.
- **Introspection:** `introspect/{widgets,vectors,fill-targets}.ts` (AcroForm widgets via pdfjs annotations; vector cell/rule extraction via `getOperatorList` constructPath bbox + CTM tracking).
- **Resolver:** `authoring/resolve.ts` (AcroForm→anchor→geometry, provenance, mismatch guards, ambiguity guard); `authoring/vision.ts` (offline, verifier-gated, PyMuPDF rasterizer + Anthropic model, both injectable).
- **Harness/CLI:** `scripts/field-map-authoring-harness.ts --all-pbv` and `scripts/resolve-field-maps.ts [--all] [--write]`.
- **Version-bump plumbing:** `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` bumps `generation_version` (→ `-v2`, `upsert:false`) when the map's `field_map_version` differs from the stored doc, even with 0 signers. Changed maps carry `field_map_version`.
- **Result:** `./node_modules/.bin/tsx scripts/field-map-authoring-harness.ts --all-pbv` → **all 24 maps pass (0 geometric, 0 placement)**. Tests: `node ./node_modules/.bin/vitest run lib/field-map-authoring/__tests__/` (57 pass) + `lib/pbv/form-generation/__tests__/` (15 pass). Typecheck clean (`node ./node_modules/typescript/bin/tsc --noEmit`) EXCEPT unrelated uncommitted `components/pbv/intake/SectionHousehold.tsx` (parallel WIP, not ours).
- **Major real defects fixed in main-application (EN+ES):** household table columns were one+ cells left of their headers (DOB/SSN/relationship/age in wrong columns); household **names never rendered** (column `field_prefix` was `last_name/first_name/middle_initial` but the resolver emits `last/first/mi` — fixed); ES contact block was ~14pt too high; off-page widths; crim-es dob over `nacimiento:`. Visually confirmed with PyMuPDF.

## REMAINING WORK (the plan's Phases A→C)
**Shell rules (Windows):** `./node_modules/.bin/tsx …` (NOT `npx tsx` — hangs), `node ./node_modules/typescript/bin/tsc --noEmit`, `node ./node_modules/.bin/vitest run …`. See `docs/SHELL-PROTOCOL.md`. Regen `.env.local` has `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL=https://form-stanton.vercel.app`.

### Phase A — after PR #8 merged + prod deploy green
1. **Regen:** `./node_modules/.bin/tsx scripts/regen-applicant-forms.ts --mia-santha` (NO notification). Produces corrected `-v2` PDFs. (Mia `2b451d4e-6578-43e6-9689-450cadcc62fe`, Santha `00d613e5-1573-4a7b-ab98-73a46ca4d681`.)
2. **Verify deploy is live BEFORE regen** (else it re-stamps OLD maps): poll the GitHub deployment status of the PR #8 **merge commit** for `state=success` (`gh api repos/StantonManagement/FormStanton/deployments?sha=<mergeSha>` → statuses). No Vercel CLI installed; no SHA in `/api/health`.
3. **Download + eyeball `v2`:** pull `pbv/{appId}/forms/{form_id}-en-v2.pdf` (bucket `pbv-forms`) via service key, render p1 with PyMuPDF (`python -c "import fitz…"` — `pip install pymupdf` already done; `pdftoppm`/poppler NOT installed). Mia is a **single-person household** (DOB 1994-05-28, wages $2,700/mo, no spouse/minors) — household table has ONE row (unlike the 2-adult+minor sample fixture). Post for Alex sign-off.

### Phase B — deploy PRD-87 review/approve UI (clean isolated slice; user applies migration)
Uncommitted but verified self-contained (all deps committed except the two below):
- Files: `app/admin/pbv/pipeline/[id]/review/page.tsx`; `app/api/admin/pbv/applications/[id]/review/{route,approve,hold}.ts`; `lib/pbv/preSendReview.ts` (+ `lib/pbv/__tests__/preSendReview.test.ts`); **`lib/auth.ts` +28 lines** (`canApprovePreSendReview`, `requirePreSendReviewApproval` — only addition vs HEAD).
- **Migration (USER applies to prod Supabase):** `supabase/migrations/20260531130000_prd87_pbv_document_review_approvals.sql` (creates `pbv_document_review_approvals`). Sequence before/with the deploy.
- Assemble a focused PR with ONLY those files; exclude all other parallel WIP. These are the parallel team's files — confirm ownership before committing on their behalf. After deploy, verify `/admin/pbv/pipeline/{id}/review` previews Mia's `v2` PDFs.

### Phase C — operator review → Approve → send (only after sign-off)
In the review UI, Approve records the approval (bound to `package_revision`) and sends `PBV_PREFLIGHT_CHECKLIST` (the "send to sign" / PRD-85 Phase 4 step). The handoff checklist (`lib/notifications/buildPreflightDocList.ts`) prompts Mia to upload missing required docs AND sign — both in her portal.

---

## ⚠️ FOUNDATIONAL OPEN ITEM (do early next session): verify the SOURCE documents
Everything (maps, verifier, generated PDFs) is calibrated to `assets/pbv-source-pdfs/*.pdf`. Confirmed: **production AND the harness both load from `assets/pbv-source-pdfs/`** (`lib/pbv/form-generation/source-pdfs.ts:24` `SOURCE_PDF_DIR='assets/pbv-source-pdfs'`; `docs/` is `.vercelignore`d, so the maps' `source_pdf: "docs/templates/…"` field is a **stale label, not a load path**). So verification used the same files production stamps. **Still to verify (Alex's "this is foundational"):** that the PDFs in `assets/pbv-source-pdfs/` are the **correct, current, canonical HUD/HACH forms** (right edition/layout), not outdated or wrong versions — because the entire calibration assumes they are. Cross-check against `docs/templates/` (do they match? `git -c core.autocrlf=false diff --stat` / hash compare) and against the official source-of-truth forms. If any source PDF is wrong, its field map must be re-authored against the correct one.

---

## Key findings / gotchas
- **"missing" display is a conflation, not a bug:** the print/summary (`app/pbv-full-app/[token]/print/page.tsx`) and admin (`app/admin/pbv/full-applications/[id]`) pages read `application_documents` (the upload/sign tracker), NOT `pbv_form_documents` (the generated forms). Generated-but-unsigned forms read "missing." Parked as a spawn-task (UX rethink). Out of current scope.
- **Pre-send check (Mia) PASSED:** required uploads = Photo ID + Paystubs (correct for wages-only). "Training Program Letter (other income)" is `required:false` → NOT in the preflight checklist (she's not asked); its "missing" status is a cosmetic waive-derivation bug (other other-income docs are `no_longer_required`). Bank statements correctly waived (she reported no assets).
- **Roster (20 PBV apps):** 14 complete, 5 not_started, 1 in_progress. **Flow is proven end-to-end** — `Final/Verify/Prod … Walk Tester` apps have all 11 forms `signed`. Real not-started prospects: Charlene Griffith (`76cc71c4`), Bianca Sena de Oliveira (`1281d181`), + several test tenants. Some `complete` apps have 0 generated forms (Claudia Ferreira `ffffcafe`, Richie Rich, Maria Test, Alexander KS `f9b29fa8`, Bla) — generation may not have been triggered; investigate if real.
- **"Will they submit properly if I mass-send now?"** Functionally yes (flow works), BUT **do NOT mass-send until PR #8 is merged and corrected maps are deployed** — otherwise every new applicant gets the same defective `v1` forms Mia has. After deploy, new generations are correct.
- **Prod env:** `CRON_SECRET` was missing in Vercel Production (caused the FIRST failed deploy); **Alex added it**. `/api/health` was "degraded" due to that; should clear post-fix.
- **Two prior deploy failures explained:** (1) `CRON_SECRET` missing [fixed], (2) `tsx: command not found` at `prebuild→validate-env` from commit `1265c52` (switched runner to `tsx` without adding the dep) [PR #8 fixes].

## Do-not-touch / cleanup
- **Do NOT commit** unrelated parallel WIP in the working tree: `components/pbv/intake/SectionHousehold.tsx` (has type errors), `lib/pbv/ssnValidation.ts`, `lib/notifications/handoffRetry.ts`, the many untracked PRD-85/87 files/migrations, etc. Only commit the explicit slices above.
- **Scratch to ignore/clean:** `_pbv-review/` (diagnostic scripts + rendered PNGs), `scripts/_render_check.ts`, stray `_*_tmp.mjs`. `.field-map-authoring-out/` is gitignored.
- **Never** edit `signed_pdf_path` artifacts (HUD/HACH compliance). Unsigned regeneration only.

## Useful commands
```
# verify all maps (expect: 24 processed, 0 geometric, 0 placement)
./node_modules/.bin/tsx scripts/field-map-authoring-harness.ts --all-pbv
# resolver (auto-fix maps from source signals; --write persists improvements)
./node_modules/.bin/tsx scripts/resolve-field-maps.ts --all
# regen the two applicants (deploy must be live first; no notification)
./node_modules/.bin/tsx scripts/regen-applicant-forms.ts --mia-santha
# tests / typecheck
node ./node_modules/.bin/vitest run lib/field-map-authoring/__tests__/ lib/pbv/form-generation/__tests__/
node ./node_modules/typescript/bin/tsc --noEmit
# PR status
gh pr view 8 --json state,mergeable ; gh pr checks 8
```

## IDs / refs
- Mia: app `2b451d4e-6578-43e6-9689-450cadcc62fe`, token slug `31-33-park-st-unit-retail-1-lXH7DKmpU31P4Xxz`.
- Santha: app `00d613e5-1573-4a7b-ab98-73a46ca4d681`.
- PR #7 (merged): field-map system. PR #8 (open): build fix `fix/tsx-build-dep`. main HEAD before PR#8: `66cb51ef`.
- Prod: `https://form-stanton.vercel.app` · Vercel project `form-stanton` (`prj_FVMmdM95igYleWiOUT79HvAuR6VV`).
