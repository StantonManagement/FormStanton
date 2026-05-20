# PBV Form Execution PRD Sweep — Plan

_Created: 2026-05-15_

## Goal

Draft PRD + prompt pairs 22 through 30 covering the full PBV Form Execution build (PRD-05's Phases A–I), against the architectural decisions locked 2026-05-15. Output to `docs/fullApp-Plan/`. Alex runs each in Windsurf.

## Locks driving these PRDs (2026-05-15)

- **Architecture:** Additive Variant A. `pbv_full_applications` is the single parent. Extend with `submission_language`, `intake_data jsonb`, `resume_token_expires_at`, intake/signing status columns. `tenant_access_token` already exists — use it as the resume token. New tables (`pbv_form_documents`, `pbv_signature_events`, `pbv_summary_documents`) FK to `pbv_full_applications.id`. `pbv_household_members` already exists; extend in place.
- **Form list:** 17 total. 12 fully mapped from bilingual packet + 1 mapped-pending-PDF-verification (`zero_income_statement`) + 4 source-pending (VAWA HUD-5382, Reasonable Accommodation, healthcare-provider-release, childcare-expense-verification). Source-pending forms generate-disabled via feature flag.
- **Conditional logic:** Per `docs/fullApp-Plan/pbv-field-inventory.md` § Conditional Trigger Reference. Dual-pipeline (form + upload), form-only, upload-only, hidden in-form triggers, section gating all defined there.
- **Intake schema:** PRD-05 §3.1's 11 sections; fields derived from inventory `prefill_source` column.
- **Field-to-form mapping:** Inventory `prefill_source` column is the source of truth for 12 forms. 5 pending until PDFs land.
- **Signing flow:** One signature capture + per-form tap-to-confirm. Tenant draws their signature once; for each form they're authorized to sign, they tap to confirm intent; same signature image gets stamped on each confirmed form. Each tap-confirm produces its own `pbv_signature_events` row (timestamp, IP, document hash) so audit trail is per-form.
- **HACH decisions:** Stamped-PDF accepted. PT-UI/ES-output approved. Per-form intent confirmation required (hybrid above).
- **Summary doc:** Best-effort content drafted by Alex/Cascade, reviewed/refined later. Pipeline builds against placeholder.

## Plan (PRD + prompt pairs, each saved to docs/fullApp-Plan/)

- [x] **PRD 22** — Toolchain hardening + ES briefing-cert + Citizenship Declaration pilot
- [x] **PRD 23** — Field maps for remaining 10 sourced forms × 2 languages
- [x] **PRD 24** — Data model + API (additive on pbv_full_applications)
- [x] **PRD 25** — Phase 1 sectioned intake UI
- [x] **PRD 26** — Phase 2 review-and-sign UI (hybrid signing)
- [x] **PRD 27** — Phase 3 additional-adults flow
- [x] **PRD 28** — Summary doc generation pipeline
- [x] **PRD 29** — Staff-assisted mode polish
- [x] **PRD 30** — End-to-end test

## Open items NOT blocking these PRDs

- VAWA HUD-5382 source PDF (HUD.gov, bilingual available)
- Reasonable Accommodation form (HACH Section 504 Coordinator)
- Healthcare-provider release (paired with RA)
- Childcare Expense Verification (bilingual, HACH-published, just not in current packet)
- Three HACH policy clarifications (VAWA dispute path, disability third-party verification at intake, self-employment worksheet supplement) — Dan owns
- Real summary doc content in EN/ES/PT — Alex+Dan author, translator commissioned

## Review (2026-05-15)

### Output index — `docs/fullApp-Plan/`

| PRD | Spec | Prompt |
|---|---|---|
| 22 | `22-pbv-form-execution-toolchain-and-hard-form-pilot_prd_2026-05-15.md` | `22-..._prompt_2026-05-15.md (in prompts/ subfolder)` |
| 23 | `23-pbv-form-execution-field-maps_prd_2026-05-15.md` | `23-..._prompt_2026-05-15.md (in prompts/ subfolder)` |
| 24 | `24-pbv-form-execution-data-model-and-api_prd_2026-05-15.md` | `24-..._prompt_2026-05-15.md (in prompts/ subfolder)` |
| 25 | `25-pbv-form-execution-phase1-intake-ui_prd_2026-05-15.md` | `25-..._prompt_2026-05-15.md (in prompts/ subfolder)` |
| 26 | `26-pbv-form-execution-phase2-review-and-sign-ui_prd_2026-05-15.md` | `26-..._prompt_2026-05-15.md (in prompts/ subfolder)` |
| 27 | `27-pbv-form-execution-phase3-additional-adults_prd_2026-05-15.md` | `27-..._prompt_2026-05-15.md (in prompts/ subfolder)` |
| 28 | `28-pbv-form-execution-summary-doc_prd_2026-05-15.md` | `28-..._prompt_2026-05-15.md (in prompts/ subfolder)` |
| 29 | `29-pbv-form-execution-staff-assisted-mode_prd_2026-05-15.md` | `29-..._prompt_2026-05-15.md (in prompts/ subfolder)` |
| 30 | `30-pbv-form-execution-e2e-test_prd_2026-05-15.md` | `30-..._prompt_2026-05-15.md (in prompts/ subfolder)` |

### Key trade-offs surfaced during drafting

1. **PRD-22 table-style field map pattern** left as an in-build decision (Pattern A explicit-per-row vs Pattern B templated-rows). Cascade picks during Citizenship Declaration pilot; choice propagates to PRD-23.
2. **PRD-24 templates table** — extend `pbv_full_app_document_templates` vs create `pbv_form_templates`. Left as in-build decision; either works as long as the gating flag (`generation_enabled`) contract holds.
3. **PRD-24 signature audit** — chose parallel `pbv_signature_events` instead of overloading `signature_capture_audit` (post-approval signing table). Cleaner concern boundary.
4. **PRD-25 dispatcher** — refactors existing `[token]/page.tsx` from a single-page form into a phase-routed dispatcher. The existing tenant flow's document upload phase is preserved untouched and slots into the dashboard (PRD-26) as one of four parallel tasks.
5. **PRD-26 hybrid signing** — one signature capture + per-form tap-to-confirm is materially better than either pure bulk or pure per-form: one ceremony for the tenant, one audit row per form for HACH.
6. **PRD-26 PDF render** — inline PDF.js or iframe — left as in-build decision based on bundle size budget.
7. **PRD-27 additional-signer scope** — reused PRD-26 components under a SignerScope provider rather than building parallel UI. Halves the surface area; member_token is the auth boundary.
8. **PRD-28 summary doc** — programmatic pdf-lib generation (not source-template stamping) because content is dynamic per application. Best-effort EN/ES/PT, tentative markers grep-searchable for translator handoff.
9. **PRD-29 staff-assisted** — extended existing impersonation rather than building parallel. Schema added one column to `pbv_signature_events` (`assisted_by_staff_user_id`).
10. **PRD-30 E2E** — split into Playwright (UI flow) + Vitest (package integrity). Snapshot-hash assertion catches future regressions; full snapshots gitignored to keep repo lean.

### Open items still outside this sweep (per CURRENT_STATE)

- VAWA HUD-5382, Reasonable Accommodation, healthcare-provider-release, childcare-expense-verification source PDFs
- Real summary doc content review with Dan + commissioned PT/ES translations
- 3 HACH policy clarifications (VAWA dispute path, disability third-party verification, self-employment worksheet supplement)
- Live HACH conversation confirming the 3 decisions (Dan default-confirmed; treat as ratified pending in-person confirmation)

### Order to run PRDs in Windsurf

PRDs are dependency-ordered. Run 22 → 23 → 24 → 25 → 26 → 27 → 28 → 29 → 30. Wait for each build report + sign-off before kicking off the next. PRD-28 can run in parallel with PRD-29 if you're moving fast — neither modifies the other's surface.
