# Windsurf Prompt — Post-Approval Execution

**PRD:** `docs/post-approval-execution_prd_2026-05-13.md` (rewritten 2026-05-13 — read end-to-end)
**Build report:** `docs/build-reports/post-approval-execution_build-report_2026-05-13.md`
**Depends on:** `stanton-workspace-document-lifecycle` (events feed)
**Coordinates with:** `in-app-signature-capture` (PRD V) — this PRD ships placeholder "Sign in-app" buttons that PRD V will activate later. They MUST be present and disabled with the right tooltip.
**Blocks:** none

---

## Execution mode

**Use the goal skill.** Two phases (staff signing surface, then tenant magic-link signing). Execute end-to-end without asking Alex to confirm between phases. **Stop only if:** a verification gate fails, a Hard NO is hit, a Required-reading file is missing, or you encounter ambiguity the PRD doesn't resolve.

**No gating on "open questions" this time.** This PRD was rewritten around the "75% functional with visible config gaps > 0% waiting for perfect inputs" philosophy. Where Stanton-specific configuration is missing at launch, you build the system with sensible defaults and surface the gaps as yellow banners in the UI. Detailed in the PRD's "Configuration State at Launch" section.

---

## Schema verification — use Supabase MCP

Before writing the migration, and again after applying it, **use the Supabase MCP tools to verify schema state directly from the live DB** rather than grepping migration files.

**Before:**
- `mcp__supabase__list_tables` — confirm whether `properties`, `signing_packets`, `packet_signatures`, `signing_packet_templates` already exist. (Per the PRD, none should; confirm.)
- `mcp__supabase__execute_sql` — sanity-check the existing `pbv_full_applications.stage` column / CHECK constraint so you know exactly what to alter to add `'executed'`.

**After applying migration:**
- `mcp__supabase__list_tables` again — confirm four new tables present.
- `mcp__supabase__execute_sql` — for each new table, run `\d` equivalent (`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = '<table>'`). Paste output into the build report.
- Confirm `signing_packet_templates` has one row with `template_key = 'default_pbv'`.
- Confirm `permissions` has the new `pbv-full-applications:execute_hap` row.

If Supabase MCP tools are unavailable in the session, fall back to migration-file inspection but document this in the build report ("MCP unavailable — verified via migration file only").

---

## Context

You are adding the terminal stage of the application lifecycle: signing the lease, executing the HUD-required addenda, and finalizing the HAP contract between Stanton and HACH. Today none of this is in-system. v1 is **wet-sign + upload** — staff and tenants upload signed PDFs through the workflow. In-app electronic signing is a sibling PRD (V); the buttons for it are present here but disabled.

The terminal state is `hap_executed` — at that point money flows from HACH to Stanton, the tenant is in the unit, and the application is operationally complete.

---

## Required reading before you start

1. **`docs/post-approval-execution_prd_2026-05-13.md`** — every section. Pay close attention to the "Configuration State at Launch" section and the "Config-gap UI" feature.
2. **`docs/stanton-workspace-document-lifecycle_prd_2026-05-13.md`** — the events feed and lock semantics.
3. **`docs/in-app-signature-capture_prd_2026-05-13.md`** — read enough to understand WHERE the placeholder "Sign in-app" buttons will eventually wire in. Do NOT build any of PRD V here.
4. **`lib/events/application-events.ts`** — extend with new event types.
5. **`app/admin/pbv/full-applications/[id]/page.tsx`** — current Actions section; the link to the signing surface goes here once HACH approves.
6. **`app/api/hach/applications/[id]/route.ts`** — the HACH approval flow; add the packet auto-create hook here.
7. **`supabase/migrations/20260424163000_hach_reviewer_portal_schema.sql`** — `hach_review_status` definition.
8. **`app/pbv-full-app/[token]/...`** — tenant portal pages; add the "Forms to sign" tab.
9. **`lib/hach/payload-filter.ts`** — wall protections.
10. **`lib/auth.ts`** — permission walk.
11. **`supabase/migrations/20260423000000_add_pbv_preapp_tables.sql`** — note the existing `unit_bedroom_map` table. Do NOT seed `properties` from it. The `properties` table starts empty per the PRD.

---

## Build

### Phase 1 — Staff signing surface

**Step 1 — Schema verification (pre-migration)**

Run the Supabase MCP checks listed in "Schema verification" above. Record findings in the build report under a "Pre-migration schema state" section.

**Step 2 — Migration**

Create `supabase/migrations/20260513XXXXXX_post_approval_execution.sql` per the PRD's data model section. Specifically includes:
- `signing_packet_templates` with `default_pbv` seed (HUD standard set per the PRD's JSONB shape).
- `properties` (empty, no seed).
- `signing_packets`, `packet_signatures` with the constraints per the PRD.
- Stage enum addition: `'executed'` added to `pbv_full_applications.stage` allowed values. If the column has a CHECK constraint, drop and recreate with the new value. Document the exact approach.
- Permission seed: `pbv-full-applications:execute_hap`.

Apply the migration via `mcp__supabase__apply_migration`. Verify with the post-migration checks. Save the SQL to a file in `supabase/migrations/` — this is non-negotiable (it must be in version control, not just applied to the live DB).

**Step 3 — Template generator**

Create `lib/signing/packet-template.ts`:
- `loadTemplate(template_key)` → reads from `signing_packet_templates`. Defaults to `default_pbv`.
- `generatePacketSignatures(application, property)` → returns the signature row specs:
  - Walks the template's `signatures` JSONB.
  - Applies `conditional_on` rules — e.g., `{property_field: 'year_built', operator: '<', value: 1978, default_when_null: 'required'}`. If the property field is null and `default_when_null` is `'required'`, include the row.
  - Appends property-specific addenda from `property.required_addenda` (if any).
- Returns `{ signatures: [...], used_default_template: bool, used_default_property: bool }` — the booleans drive the config-gap banners.

**Step 4 — Packet creation API**

Create `app/api/admin/pbv/full-applications/[id]/signing/route.ts`:
- GET. Returns packet + signatures + config-gap state.
- Auto-creates the packet (one `signing_packets` row + N `packet_signatures` rows) on first GET if `hach_review_status='approved_by_hach'` and no packet exists.
- Idempotent: `INSERT … ON CONFLICT (application_id) DO NOTHING`, then re-select.
- Writes `signing_packet_created` event with `template_key` and `signature_count`.
- Response includes `config_gaps: { property_not_configured: bool, template_defaulted: bool, year_built_unknown: bool }` so the UI can render banners without an extra round-trip.

Modify `app/api/hach/applications/[id]/route.ts` (the approve path that flips `hach_review_status` to `approved_by_hach`):
- After the status flip, call the packet-creation helper to pre-create the packet immediately. Avoids the lazy-create race for Stanton staff navigating right after.

**Step 5 — Per-signature actions**

Build these endpoints per the PRD's API Routes section:
- `…/signing/[signatureId]/sent/route.ts`
- `…/signing/[signatureId]/received-from-hach/route.ts` (HAP-sends-first path entry)
- `…/signing/[signatureId]/upload/route.ts` (multipart, preserves prior versions in versioned blob paths)
- `…/signing/[signatureId]/waive/route.ts` (requires reason)

Each writes its corresponding event (`signature_marked_sent`, `hap_received_from_hach`, `signature_received`, `signature_waived`).

For `upload`: `signature_method='wet_upload'`, `signed_pdf_uploaded_by_role='stanton'` (use `'tenant'` only on the tenant-portal upload endpoint), prior signed PDFs preserved at versioned paths.

**Step 6 — Execute HAP**

Create `…/signing/execute-hap/route.ts`:
- POST. Auth: `isAuthenticated` + `pbv-full-applications:execute_hap`.
- Preconditions: HAP signature row exists, `signed_pdf_path` is non-null, `status='signed'`.
- Atomically: flip `signing_packets.executed_at`, HAP row `status='executed'`, `pbv_full_applications.stage='executed'`, write `hap_executed` event with `direction` metadata, post system-authored shared workspace message.
- After execute, the surface is read-only.

**Step 7 — Properties admin**

Build the simple properties admin:
- Page at `/admin/properties/page.tsx` — list view, columns: building_address, year_built, addenda_count, "configured" badge.
- Page at `/admin/properties/[id]/edit/page.tsx` — form for `year_built` and addenda list editor.
- `components/admin/properties/PropertyForm.tsx` — the form.
- API endpoints `/api/admin/properties` (list + create) and `/api/admin/properties/[id]` (get + patch).

Saving emits `property_configured` event for that building.

**Step 8 — Signing surface UI**

Create `app/admin/pbv/full-applications/[id]/signing/page.tsx`:
- Header (applicant, unit, HACH approval date, packet status, exec date if executed).
- **Config-gap banners** (yellow, with "Configure →" links per the PRD's pattern):
  - Property not configured banner — shows when `config_gaps.property_not_configured`
  - Template defaulted footer note — shows when `config_gaps.template_defaulted`
  - Per-row inline notes for default applications (e.g., "Default — lead paint required when year built unknown")
- Signing checklist via `components/signing/SigningChecklist.tsx`.
- Signature rows via `components/signing/SignatureRow.tsx` — **each row renders both action buttons side by side: "Upload signed PDF" (functional) and "Sign in-app" (disabled, tooltip "Coming soon")**.
- HAP row uses `components/signing/HapDirectionPicker.tsx` until a direction is chosen.
- Modals: `UploadSignedDialog`, `WaiveSignatureDialog`, `ExecuteHapDialog`.
- Workspace messages anchored to this application (reuse from review workspace).

Modify `app/admin/pbv/full-applications/[id]/page.tsx`: after HACH approval, render a prominent link/button to the signing surface in the Actions section with a status badge ("Signing in progress" / "Awaiting HAP execution" / "Executed").

**Step 9 — Add HAP execution backlog panel to workforce dashboard**

Modify `app/admin/pbv/work/TeamRollup.tsx` and add a new panel `HapExecutionBacklog.tsx`: applications HACH-approved more than 7 days ago but not yet `executed`. Wire to a new endpoint `/api/admin/pbv/rollup/hap-backlog`.

**Step 10 — Phase 1 tests**

Create `__tests__/signing-packet-phase1.test.ts`:
1. HACH approve triggers packet creation; idempotent.
2. GET endpoint auto-creates on first access if approved and missing.
3. Template generator handles: pre-1978 property (lead paint included), post-1978 (lead paint not included unless template forces), unknown year_built (lead paint included), property with `required_addenda` (addenda rows appended).
4. Mark Sent / Mark Received-from-HACH / Upload PDF / Waive each transition state correctly and write the right event.
5. Both HAP initiation paths work end-to-end.
6. Execute HAP requires permission; requires signed PDF; flips stage to `executed`; writes event; posts workspace message.
7. After execute, all signature mutations return 423 Locked.
8. **Config-gap UI test:** when `properties` has NO row for the application's building, the GET response includes `config_gaps.property_not_configured: true` and the UI renders the banner.
9. **Placeholder button test:** "Sign in-app" buttons are rendered as disabled on every signature row with the right tooltip.
10. **HACH wall test:** HAP signing line is HACH-visible; other signature rows are NOT in the HACH payload.
11. Properties admin: create + update reflect in subsequent signing-surface load.

**Step 11 — Phase 1 verification gates**

- `npm run build` — zero errors.
- `npm test` — green.
- Schema verification via MCP captured in build report.
- Manual end-to-end: seed an application through HACH approval. Open signing surface. **Verify yellow banner appears** because `properties` table is empty. Click "Configure property →" — admin form opens. Save year_built and one addendum. Return to signing surface — banner is gone, new addendum row appears. Continue with the rest of the walkthrough from the PRD's acceptance criteria. Capture screenshots.

If gates pass, **auto-proceed to Phase 2.**

---

### Phase 2 — Tenant magic-link signing

**Step 12 — Tenant API**

Create `app/api/tenant/pbv/[token]/signing/route.ts`:
- GET. Validates magic-link token. Visible only when application's `hach_review_status='approved_by_hach'`.
- Returns tenant-visible signature rows (`signing_party='tenant'` or contains 'tenant').
- Each row includes the plain-language description (from the template).

Create `app/api/tenant/pbv/[token]/signing/[signatureId]/upload/route.ts`:
- POST. Multipart. Validates signature row is tenant-party and belongs to this token's application.
- Stores file with `signed_pdf_uploaded_by_role='tenant'`, `signature_method='wet_upload'`.
- Writes `signature_received` event with `actor_role='tenant'`.

**Step 13 — Tenant UI**

Modify `app/pbv-full-app/[token]/...` to add a "Forms to sign" tab visible after HACH approval. Build supporting components under `components/tenant-signing/`. Mobile-friendly upload affordance (file input with `accept` and `capture` hint). **"Sign in-app" placeholder button visible on each row, disabled, tooltip "Coming soon"** — symmetric with the staff side.

**Step 14 — Phase 2 tests**

Create `__tests__/signing-packet-phase2.test.ts`:
1. Tenant magic link with `approved_by_hach` shows "Forms to sign" tab; without approval, tab is hidden.
2. Tenant can upload only on tenant-required signature rows; other rows return 403.
3. Tenant upload writes event with `actor_role='tenant'`, `signed_pdf_uploaded_by_role='tenant'`.
4. Staff signing surface displays tenant-uploaded PDFs with "Uploaded by tenant" attribution.
5. "Sign in-app" placeholder is rendered on tenant side too.

**Step 15 — Phase 2 verification gates**

- `npm run build` — zero.
- `npm test` — green.
- Manual end-to-end: tenant magic link in a separate browser session for a HACH-approved app; tab appears; upload a signed PDF; staff side reflects.

If gates pass, build complete.

---

## Tech constraints

- Next.js App Router, React 18+, TS strict, Vitest, no new deps.
- Wet-sign only — **do NOT integrate any e-sign provider**. PRD V handles that.
- Signed PDFs go to a dedicated storage bucket `signing-packets` (create if missing). Path: `{application_id}/{signature_id}/{revision}_{original_filename}`.
- Mobile-friendly upload on tenant side.

---

## Hard NOs

- **Do NOT seed the `properties` table.** It MUST be empty at launch. The point is that the UI surfaces config gaps. If you seed, you defeat the test.
- **Do NOT activate the "Sign in-app" buttons.** They MUST render disabled with the right tooltip. PRD V activates them.
- **Do NOT skip MCP schema verification.** Both pre and post-migration. Document findings in the build report.
- **Do NOT integrate any e-sign provider.** PRD V.
- **Do NOT auto-generate the lease document.** Stanton uploads externally-prepared PDFs.
- **Do NOT auto-execute HAP based on uploaded signatures.** Always an explicit click by a permissioned user.
- **Do NOT delete previously-uploaded signed PDFs** when a newer one is uploaded. Preserve history.
- **Do NOT allow signature mutations after `hap_executed`.**
- **Do NOT allow tenant uploads to non-tenant signature rows.**
- **Do NOT leak Stanton-private signing rows to HACH endpoints.** Only the HAP signing row is HACH-visible.
- **Do NOT model recertification / lease renewal / move-out.** Out of scope.
- **Do NOT add notifications, reminders, SMS prompts.** Other PRDs.
- **Do NOT skip the migration file commit.** Migration MUST be in `supabase/migrations/` as a versioned file, not just applied to the live DB.
- **Do NOT skip the build report.** Required path: `docs/build-reports/post-approval-execution_build-report_2026-05-13.md`.
- **Do NOT skip writing tests.** Test files at the paths listed in Steps 10 and 14 MUST exist and pass.
- **Do NOT add TODOs or placeholders** (other than the explicitly-required "Sign in-app" placeholder buttons).

---

## Build report requirements

Create `docs/build-reports/post-approval-execution_build-report_2026-05-13.md` with:

1. PRD reference + execution mode confirmation
2. **Pre-migration MCP schema state** — list of relevant existing tables
3. **Post-migration MCP schema verification** — paste of column inspection for each new table; confirmation seeds landed
4. Phase 1 acceptance criteria — checkboxes with notes
5. Phase 2 acceptance criteria — checkboxes with notes
6. Files created — list
7. Files modified — list
8. Files deleted — list (should be empty)
9. Storage bucket — confirmation `signing-packets` bucket exists, RLS noted
10. Template generator inputs — for the test fixtures, every signature row spec the generator emits, with the rules that triggered each
11. Save-path registry for every mutation
12. Test output — full Vitest paste
13. Manual walkthrough log — both phases with screenshots in `docs/build-reports/screenshots/post-approval-execution-2026-05-13/`
14. **Config-gap UI verification** — screenshots of the property-not-configured banner appearing and disappearing when the property is configured
15. **Placeholder button verification** — screenshot showing "Sign in-app" buttons rendered disabled on at least one staff and one tenant signature row
16. HACH wall verification — HAP signing line visible; other rows NOT
17. Terminal state verification — after `hap_executed`, mutations return 423
18. Deviations from PRD with reasoning
19. Pre-existing issues observed
20. Final pass/fail summary

---

## When you finish

Reply in chat with:
- Confirmation Phase 1 and Phase 2 completed
- Pass/fail on each verification gate (Steps 11 + 15)
- Build report path + section count
- Anything that blocked you
- Specifically: did the MCP schema verification work (or note that MCP was unavailable)?
- Specifically: did the config-gap banner appear/disappear correctly in the manual walkthrough?
- Specifically: are the "Sign in-app" placeholder buttons rendered on every signature row (staff + tenant) with the right tooltip?
- Specifically: did the HAP wall test pass — HAP row visible to HACH, other rows not?

If any verification item fails, do not declare complete.
