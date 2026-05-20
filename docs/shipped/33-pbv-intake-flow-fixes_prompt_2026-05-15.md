# Cursor/Windsurf Prompt — PRD-33: PBV Intake Flow Bug Fixes

## Context

A live runtime audit on token `110-martin-unit-1-f39817020e324160b5dae3b5f4c48633` confirmed six visible defects in the tenant intake flow plus two inferred from code. Every prior audit missed all of them by reading components in isolation and never running the app. This PRD is the atomic-commit fix series. PRD-34 handles the deeper data-model rework.

Atomic commit per defect (F1–F8). Manual regression walk after Phase 1 and again after Phase 2.

## Required reading before you start

1. `docs/fullApp-Plan/33-pbv-intake-flow-fixes_prd_2026-05-15.md` — this PRD
2. `tasks/PBV_INTAKE_AUDIT_2026-05-15.md` — the audit with screenshots and live evidence
3. `app/api/t/[token]/pbv-full-app/route.ts:31-33, 263` — bootstrap SELECT and response (F1 target)
4. `lib/pbv/hooks/useIntakeBootstrap.ts:44-65` — the hook that always returns intake_data: {} today
5. `app/pbv-full-app/[token]/intake/[section]/page.tsx:81-86, 142` — totalSections / sectionNumber math (F2 target)
6. `components/pbv/intake/IntakeShell.tsx:80-91` — progress label render (F2 target)
7. `components/pbv/sign/TenantDashboard.tsx:191` — documents card onAction (F3 verification)
8. `app/pbv-full-app/[token]/sign/summary/page.tsx:53-56` — un-tokenized redirect (F4 target)
9. `components/pbv/intake/SectionReview.tsx:88-188` — `buildSummary` (F5 target)
10. `lib/pbv/intake-schema.ts:54-200` — what fields exist per section (drives F5)
11. `components/pbv/TenantDocumentUpload.tsx:13-26, 300-450` — Document interface and row render (F6 target)
12. `app/api/t/[token]/pbv-full-app/documents/route.ts` — GET handler that needs signed URLs (F6 target)
13. `lib/pbv/hooks/useSectionVisibility.ts:24-50` — derived members + age (F7 target)
14. `lib/pbv/hooks/useSectionAutoSave.ts` — `saveNow` already exists for F8

## Closed decisions (do not relitigate)

- F3: create new `app/pbv-full-app/[token]/documents/page.tsx`. Don't add to the 2,732-line landing page.
- F6: view-only V1, no download. Open in new tab.
- F4: redirect to `/pbv-full-app/${token}/dashboard`.
- F5: only render sections the tenant actually saw (per `useSectionVisibility`).
- F8: keep existing silent retry on save; add `await saveNow()` before navigation. Disable nav button during the await.
- No schema changes in this PRD. PRD-34 owns the snapshot column.

## Decisions resolved (Alex confirmed 2026-05-15) — do not relitigate

- **F2 progress label at review**: render `Review` (qualitative).
- **F6 image preview**: open in new tab for parity with PDFs.
- **F5 long string fields** (DV/RA descriptions): render full — no truncation, no expander.

## Build this pass (one commit per defect)

### Phase 1 — Same-day deploy

1. **F1** — `app/api/t/[token]/pbv-full-app/route.ts`: add `intake_data` to the `.select()` (line 31-33), add `intake_data: app.intake_data ?? {}` to the response object (~line 263). Manual smoke: `GET /api/t/<token>/pbv-full-app` returns intake_data populated.
   Commit: `fix(pbv-bootstrap): return intake_data from bootstrap endpoint (F1)`

2. **F2** — `app/pbv-full-app/[token]/intake/[section]/page.tsx`: pass `isReviewSection: boolean` to `IntakeShell`. `components/pbv/intake/IntakeShell.tsx`: branch the section label render on the new prop. At review, render the chosen string. Progress bar fills to 100%. Manual smoke: `/intake/review` no longer reads "Section 8 of 7".
   Commit: `fix(pbv-intake): correct progress label at review step (F2)`

3. **F3** — Create `app/pbv-full-app/[token]/documents/page.tsx`. Pattern off `dashboard/page.tsx`. Use `useDashboardState` (or fetch documents directly from the GET endpoint). Mount `TenantDocumentUpload` with token, language, initialDocuments=[], packetLocked=false. Add a "Back to dashboard" link at the top. Manual smoke: dashboard's Upload Required Documents → Start lands on the page, not 404.
   Commit: `fix(pbv-dashboard): add /documents route to fix 404 from upload card (F3)`

4. **F4** — `app/pbv-full-app/[token]/sign/summary/page.tsx:55`: change `router.push('/pbv-full-app')` → `router.push(\`/pbv-full-app/${token}/dashboard\`)`. Then grep `router\.push\(['"\`]/pbv-full-app['"\`/]` across the codebase and audit each hit. Document any other un-tokenized pushes you fixed in the commit body.
   Commit: `fix(pbv-routing): tokenized redirect from sign/summary; sweep un-tokenized pushes (F4)`

5. **Phase 1 regression walk** — on a fresh test token, navigate the full flow. Header at review must read correct label. Both dashboard "Start" buttons must land somewhere valid. Document tested-on token in build report.

### Phase 2 — User-trust fixes

6. **F5** — `components/pbv/intake/SectionReview.tsx`: replace the `summary: string` shape with `summary: ReactNode`. Build a per-section render block per audit report's defect #5. Render only sections in `useSectionVisibility(intakeData)`. Add labels to `copy[language]` for en/es/pt; mark pt strings with `// PT: tentative — review`. Decision needed: long string truncation (see open decisions). Manual smoke: load a token with full intake data; every value the tenant entered must render.
   Commit: `feat(pbv-review): full data summary on intake review page (F5)`

7. **F6** — `components/pbv/TenantDocumentUpload.tsx:13-26`: add `file_url?: string` to `Document` interface. `app/api/t/[token]/pbv-full-app/documents/route.ts` GET: for each doc with status `submitted | approved | rejected`, generate signed URL via `supabase.storage.from('form-submissions').createSignedUrl(path, 300)` (5 min TTL). Return as `file_url`. `TenantDocumentUpload` row render: add a "View" anchor next to "Replace" when `file_url` present. `target="_blank" rel="noopener"`. Add labels to translations. **Bucket name correction (2026-05-15)**: all `application_documents` are stored in the `form-submissions` bucket (verified via codebase sweep — every upload route writes there). Original draft of this prompt said `submissions` which was wrong. PRD-35 will swap this hardcode to use the resolver. Manual smoke: upload a PDF on a test token; "View" appears and opens the file.
   Commit: `feat(pbv-docs): tenant can view uploaded documents (F6)`

8. **F7** — Extract `computeAge(dob: string)` from `app/api/t/[token]/pbv-full-app/route.ts:10-21` into `lib/pbv/age.ts`. Update `lib/pbv/hooks/useSectionVisibility.ts:32` to compute `age: computeAge(m.dob) ?? 0` instead of the hardcoded constant. Update the bootstrap route to import from the new util. Add a unit test for `computeAge` covering DOB exactly today, DOB tomorrow (age 0 vs -1 edge), DOB 62 years ago today, leap-year DOBs.
   Commit: `fix(pbv-visibility): compute real age in section visibility hook (F7)`

9. **F8** — `app/pbv-full-app/[token]/intake/[section]/page.tsx`: in `handleNext`, `handleBack`, and the Edit-link-via-`navigateTo` paths, await `saveNow()` from `useSectionAutoSave` before `router.push`. Disable the relevant button during the in-flight save (track with local `navigating` state). On save error, surface a one-line error and do not navigate. Same flush in the language switcher.
   Commit: `fix(pbv-intake): flush autosave before navigation (F8)`

10. **Phase 2 regression walk** — on the same fresh test token (or a new one), repeat the full flow. Tenant should be able to upload + view a PDF and an image. Review should show every value entered. Type-then-immediately-Next should preserve the typed change.

## Build report requirements

- Tested-on token (or DB row identifier) per phase
- Open-decision resolutions documented
- Commits listed in order with their messages
- Any deviations from the PRD called out explicitly
- Screenshot of `/intake/review` post-Phase-2 showing populated data
