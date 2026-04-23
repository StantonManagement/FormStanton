# Windsurf Prompt — PBV Application Layer

**Use with:** `pbv-application-layer_prd_2026-04-23.md`
**Mode:** Cascade
**Depends on:** Foundation Review Layer PRD — Phase 2 minimum must be approved before your Phase 2 starts

---

## Context

You are working on FormStanton, a standalone Next.js + Supabase project at `form-stanton.vercel.app`. This PRD builds the PBV Full Application on top of the Foundation Review Layer that another Windsurf instance is building in parallel.

Read the PRD at `tasks/pbv-application-layer_prd_2026-04-23.md` before doing anything else. Also read the foundation PRD at `tasks/foundation-review_prd_2026-04-23.md` for context on what you are consuming.

The PBV pre-application was shipped as Phase 1 of an earlier PRD. That code is your starting reference for patterns (trilingual i18n, signature canvas, form section layout). Do not rebuild it.

## Prime Directive

**Zero trust. Zero slop.**

- Do not invent files, paths, routes, tables, or components. Cite file and line number when referencing existing code.
- Do not generalize or pad.
- Do not write placeholder/TODO code.
- No marketing language. "Comprehensive," "robust," "seamlessly," "cutting-edge," "leverages" are banned.
- `[ASSUMPTION]` flags inline when you assume. Never silently assume.
- No JSONB-hacking around schema. Request amendment instead.

## Sensitive Data Rules (non-negotiable)

This PRD handles SSNs, income, criminal history, and citizenship status. Hard rules:

- No full SSN in logs, error messages, stack traces, or any PDF except where legally required
- No full SSN in git commits, test fixtures, or seed data — use `XXX-XX-1234` format
- Every read of a full (decrypted) SSN logs to `pbv_access_log`
- Tests use fake SSNs; never use real data in test fixtures
- Rejected applications still follow all sensitive data rules during the retention window

If you find yourself about to log or display a full SSN, stop and rethink.

## Execution Model

Phased with mandatory checkpoints. Stop at end of each phase.

- **Phase 0** — Close Phase 1 gaps (summary PDF + thresholds admin)
- **Phase 1** — Reconnaissance (audit existing pre-app + foundation API)
- **Phase 2** — Data layer + form templates + SSN encryption
- **Phase 3** — Tenant intake form
- **Phase 4** — Multi-signer signature flow
- **Phase 5** — Document collection (consumes foundation)
- **Phase 6** — Admin qualification panel + HHA generation
- **Phase 7** — Access controls + audit log

## Dependency On Foundation PRD

This is critical:

- Phase 0 and Phase 1 of this PRD can run immediately in parallel with the foundation work (they touch pre-app code and audit only, no foundation dependencies)
- Phase 2 can start once the foundation PRD has approved its own Phase 1 schema decision — you need to know the foundation table shape before you write `form_document_templates` seeds
- Phase 3 can start once foundation Phase 2 (API layer) is done
- Phase 4 onward requires foundation Phase 2 fully complete and stable

If you reach a phase boundary and the foundation dependency isn't ready, **stop and wait**. Do not fork or reinvent foundation pieces. Alex will coordinate when to advance.

## Phase Kickoff Ritual

Before writing any code in a phase:

1. Re-read the PRD section for this phase
2. Re-read `tasks/todo.md` for what previous phases established
3. Verify the foundation dependency for this phase is satisfied (check the foundation's `tasks/todo.md`)
4. Write a phase plan to `tasks/todo.md` with checkable items

## Phase Completion Ritual

At the end of every phase:

1. Update `tasks/todo.md`:
   - Mark completed items
   - Summary of what was built
   - Summary of decisions made (especially `[ASSUMPTION]` flags)
   - Summary of what was deferred
2. List what Alex needs to verify
3. Stop. Do not begin the next phase.

## Phase-Specific Guidance

### Phase 0 — Close Phase 1 Gaps
These are small and self-contained. Handle them first so Phase 1 pre-app is feature-complete.

**Summary PDF:**
- New API route at `/api/admin/pbv/preapps/[id]/summary-pdf`
- New button in existing admin detail drawer
- docxtemplater template with Stanton header, tenant/household section, qualification math, reviewer decision
- Stored to Supabase storage; path saved to `pbv_preapplications.summary_pdf_file`
- SSN last-4 only in PDF

**Thresholds admin:**
- `/api/admin/pbv/thresholds` GET returns current table
- POST updates (only for admin role)
- Simple admin UI page — a table with editable rows
- Log every change to a simple audit log (can use existing admin audit log or a new one)

### Phase 1 — Reconnaissance
Your deliverable is `tasks/pbv-app-audit.md`. Must include:
- File paths and line numbers for every reusable piece of pre-app code
- Trilingual i18n pattern as used in `PbvPreappForm.tsx`
- Signature canvas integration pattern
- Where qualification logic for pre-app lives (you're going to build a different but related qualification panel for full app)
- Foundation API endpoints you'll consume (from foundation's Phase 2 output)
- Foundation document template shape (from foundation's Phase 1 schema decision)

No code in Phase 1.

### Phase 2 — Data Layer
- Migrations for `pbv_full_applications`, `pbv_household_members`, `pbv_access_log`
- SSN encryption using Supabase pgsodium OR application-level AES-GCM — pick one, justify in writing in `tasks/pbv-app-encryption-decision.md`
- Tests for encrypt/decrypt round trip
- Tests for role-gated SSN access
- Seed `form_document_templates` with full PBV document list from the PRD
- Do not skip conditional rules in the seeds — `conditional_on` column must be populated where applicable

### Phase 3 — Intake Form
- Extend pre-app form patterns, don't fork them
- Repeating group for household members
- Income section per adult with all source types
- Assets, expenses, criminal history sections
- Save as draft between sessions (tenant may not finish in one sitting)
- All trilingual

### Phase 4 — Multi-Signer
- One-device handoff UI
- Each adult's required forms list rendered from their household member row
- Signature canvas per form (reuse)
- Creates `form_submission_documents` rows for signed forms with status `submitted`
- Attestation checkbox visible per adult before they sign

### Phase 5 — Documents
- Consumes foundation per-document upload endpoints
- Renders document list from `form_document_templates` filtered by conditional rules applied against Phase 3 answers
- Tenant sees foundation's per-document status UI (handled by foundation Phase 4; you reuse it)

### Phase 6 — Admin
- New admin detail page for `pbv_full_applications` (separate from pre-app drawer)
- Qualification math panel (claimed vs. documented income per member)
- HHA generation button — disabled until all required docs `approved` or `waived`
- HACH handoff package generation (wraps foundation bulk export)

### Phase 7 — Access Controls
- Role check on all SSN reads
- Audit log writes on every sensitive read
- Admin audit log viewer page

## Component Extension Rules

- Before creating a new component, list what existed and why you couldn't extend it
- Before creating a new API route, list existing routes and why extension isn't viable
- Before creating a new form pattern, show which pre-app pattern you considered reusing

## Parallel-Work Awareness

Alex runs multiple Windsurf instances. The foundation PRD runs in parallel.

Stay in your lane:
- **You own:** `pbv_full_applications`, `pbv_household_members`, `pbv_access_log`, PBV intake form, PBV signature flow, PBV admin pages, HHA template, summary PDF template
- **You do not own:** `form_submissions` schema, `form_submission_documents`, foundation API routes, foundation admin detail page, foundation tenant portal, foundation bulk export

If you need a change to foundation code, stop and flag in `tasks/todo.md` under "Foundation Change Request." Do not edit foundation files.

## Schema Amendment Rule

If during any phase a nuance surfaces that the approved schema cannot accommodate:

1. Stop.
2. Write to `tasks/todo.md` under "Schema Amendment Request"
3. Propose the minimal change
4. Wait for Alex's approval

## Done Means Done

A phase is complete when:
- All PRD deliverables for that phase exist and work
- `tasks/todo.md` is updated
- No `[ASSUMPTION]` flags unresolved
- No placeholder code
- Sensitive data checklist items for this phase are satisfied
- Tests pass
- Pre-app functionality (already shipped) is not regressed

Then stop.
