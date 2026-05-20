# Windsurf Prompt — Foundation Review Layer

**Use with:** `foundation-review_prd_2026-04-23.md`
**Mode:** Cascade
**Execution model:** Phased with mandatory checkpoints. Stop at end of each phase.

---

## Context

You are working on FormStanton, a standalone Next.js + Supabase project at `form-stanton.vercel.app`. It is part of the Stanton Management software suite but runs on its own Supabase project, isolated from the main property management DB. Do not touch anything outside FormStanton.

Read the PRD at `tasks/foundation-review_prd_2026-04-23.md` before doing anything else. The PRD is the source of truth. This prompt tells you how to execute against it.

## Prime Directive

**Zero trust. Zero slop.**

We are getting AI slop and poor structure from prior sessions. You will be held to a higher standard.

- Do not invent files, paths, routes, tables, or components. If you reference something as existing, cite the file and line number.
- Do not generalize or pad. If the PRD says five words, you say five words.
- Do not write placeholder/TODO code. If it isn't built, it doesn't exist.
- Do not use marketing language in code, comments, or commit messages. The words "comprehensive," "robust," "seamlessly," "cutting-edge," and "leverages" are banned.
- When you make an assumption, mark it `[ASSUMPTION]` inline in your checkpoint summary and flag it for review. Do not silently assume.
- If you find yourself wanting to JSONB-hack around a schema limitation, stop and flag for schema amendment instead.

## Execution Model

The build is phased. Each phase has a clear deliverable and a checkpoint. **At the end of each phase you stop, write a summary to `tasks/todo.md`, and wait for Alex to approve before continuing.** You do not self-advance to the next phase.

Phases:

- **Phase 0** — Reconnaissance (audit only, no code)
- **Phase 1** — Schema design (proposal + migration file, not executed)
- **Phase 2** — Schema execution + API layer + tests
- **Phase 3** — Admin UI: per-document review
- **Phase 4** — Tenant UI: per-document resubmit
- **Phase 5** — Bulk export

Full phase scope and deliverables are in the PRD. Do not re-derive them.

## Phase Kickoff Ritual

At the start of every phase, before writing any code:

1. Re-read the relevant PRD section for this phase
2. Re-read `tasks/todo.md` to see what previous phases established
3. Write a phase plan to `tasks/todo.md` with checkable items
4. Wait briefly — Alex may review the plan before you proceed. If no response in your session, proceed but keep plan visible.

## Phase Completion Ritual

At the end of every phase, before stopping:

1. Update `tasks/todo.md`:
   - Mark completed items
   - Summary of what was built (files changed, routes added, tables created, migrations run)
   - Summary of what was decided during this phase (especially any `[ASSUMPTION]` flags)
   - Summary of what was deferred and why
2. List the specific things Alex needs to verify at this checkpoint
3. Stop. Do not begin the next phase.

## Phase-Specific Guidance

### Phase 0 — Reconnaissance
Your deliverable is `tasks/foundation-review-audit.md`. It must:
- Cite exact file paths for every file referenced in the PRD integration points
- Cite line numbers for the specific pieces of logic you're going to extend (e.g., "status transitions happen in `app/api/admin/form-submissions/[id]/review/route.ts:47-92`")
- Identify every place in the codebase that assumes atomic review and would break if passed a per-document submission
- Identify the existing file-upload flow end-to-end (client → API → storage → metadata)
- Identify how trilingual labels (EN/ES/PT) are handled in existing forms and how you'll follow that pattern

No code is written in Phase 0. If you write code in Phase 0, you have failed.

### Phase 1 — Schema Design
Your deliverables are:
- `tasks/foundation-review-schema-decision.md` with three schema alternatives, tradeoff analysis, and picked approach
- A migration file in the appropriate migrations directory, **not applied to the database**

The three alternatives to evaluate (at minimum):
1. Child table model (the PRD's proposal)
2. JSONB-per-submission
3. Polymorphic reviewable_items

For each, analyze: query ergonomics (can we filter the list view efficiently?), indexing strategy, RLS complexity, bulk export implementation difficulty, future reuse for Section 8 recertification.

Recommend one. If you recommend something other than the PRD's proposal, explain why in writing and flag for Alex's explicit approval before proceeding to Phase 2.

### Phase 2 — Schema Execution + API Layer
- Run the migration
- Build the API routes listed in the PRD
- Each route gets an integration test covering: happy path, rejection cycle, resubmit cycle, waiver path, RLS boundary (tenant cannot access another tenant's documents)
- Do not build any UI

At the checkpoint, provide curl examples Alex can run against a local or staging instance to verify each route.

### Phase 3 — Admin UI
- Extend `/admin/form-submissions/[id]` detail page
- When `review_granularity = 'per_document'`, render per-document table
- Use the visual language from `pbv-document-tracker.jsx` in the project files as your reference — you are not required to match it exactly, but status badges, progress bar, and column layout should feel consistent with it
- Do not touch the atomic-review code path. If you have to refactor shared logic, leave the atomic path functionally identical.
- Regression check: load an existing atomic-review submission (e.g., a Pet Addendum) and confirm the old UI still works

### Phase 4 — Tenant UI
- Extend the tenant portal submission-status page
- Trilingual via existing i18n system (find the existing pattern in Phase 0 audit)
- Upload button per document, enabled only for `rejected` or `missing`
- Approved documents are read-only to tenant

### Phase 5 — Bulk Export
- Per-submission ZIP and per-form bulk ZIP
- Manifest.csv at ZIP root
- Files use Stanton naming from storage; do not rename at export time

## Component Extension Rules

- Before creating a new component, list the existing components you considered extending and explain why each one isn't suitable.
- Before creating a new API route, list the existing routes you considered extending and explain why each one isn't suitable.
- If you cannot justify a new component or route in writing, extend the existing one.

## Schema Amendment Rule

If during Phase 2 or later a real nuance surfaces that the approved schema cannot cleanly accommodate:

1. **Stop.** Do not patch with JSONB or string-concatenated fields.
2. Write the problem to `tasks/todo.md` under a "Schema Amendment Request" heading
3. Propose the minimal schema change
4. Wait for Alex's approval before continuing

## Parallel-Work Awareness

Alex runs multiple Windsurf instances simultaneously. Another instance may be working on the PBV Application Layer (PRD 2) which depends on this foundation. That instance is told to wait until Phase 2 is approved here before starting its own Phase 2.

If you see changes in the codebase you didn't make, it's probably the PBV instance. Do not modify their files. Stay in your lane:
- This PRD owns: `form_submissions` schema extensions, `form_submission_documents`, `form_submission_document_revisions`, `form_document_templates`, the admin list/detail pages, tenant portal submission-status page, bulk export
- This PRD does not own: PBV-specific routes, `pbv_preapplications` table, PBV forms, HHA application mapping

## Done Means Done

A phase is complete when:
- All PRD deliverables for that phase exist and work
- `tasks/todo.md` is updated
- No `[ASSUMPTION]` flags are unresolved
- No placeholder code exists
- Regression of existing atomic-review forms is verified (for phases 2+)

Then you stop and wait.
