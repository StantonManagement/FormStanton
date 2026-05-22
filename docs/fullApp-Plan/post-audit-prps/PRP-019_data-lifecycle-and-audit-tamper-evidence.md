# PRP-019 — Data Lifecycle & Audit Tamper-Evidence

**Assigned batch (per BATCH_PLAN.md):** 05
**Source:** `docs/audits/pbv-angle-2-audit_2026-05-21.md` — **G3** (Medium), **G4** (Medium), **G5** (Medium).
**Depends on:** None — operates on current `main`.
**Inputs (read before editing):** the existing admin RBAC/permission helper (mirror it), `lib/events/*` (event-write path), the `pbv_signature_events` / `application_events` schema, the application + `pbv_household_members` PII columns (SSN-last-four, DOB, names, contact), Supabase Storage buckets holding signed PDFs/signature images.
**Outputs (write — the ONLY files this PRP may modify/create):** new `app/api/admin/pbv/full-applications/[id]/data/route.ts`, new `docs/data-retention-policy.md`, (only iff G4 implemented) `lib/events/*` + an `event_hash` migration (commit-only), new test(s).
**Acceptance criteria:**
- An admin-only, RBAC-gated endpoint anonymizes an application + household-member PII while preserving audit-event metadata.
- A `docs/data-retention-policy.md` states retention period + deletion approach.
- G4 (audit hash chain) is either implemented (with a finalize-time verifier) or documented as a known v1.1 gap with a concrete design (see scope call).

## ⚠️ Scope call (resolve before/at build, record in BATCH_PLAN)
A full tamper-evident hash chain (`event_hash = sha256(prev_hash || canonical_payload)` + a finalize chain verifier) touches the event-write path and is "a hard problem" per the audit. Decide: implement now, or **document G4 as a known v1.1 gap with a design** and ship G3 + G5 this PRP. **Default: document the design, ship G3 + G5** — unless Alex wants the chain in this pass. Do not half-build a chain.

## Context (self-contained)
There is no path for a tenant's personal data to be deleted (GDPR/CCPA right-to-delete); SSN-last-four, DOB, names, signatures are retained indefinitely. Audit-event tables are `service_role`-writable with no tamper-evidence. Signed PDFs/signature images in Storage have no retention policy. These are program/legal-posture gaps, not launch blockers.

## Problem
- **G3:** no data-deletion mechanism. **G4:** audit logs not tamper-evident. **G5:** no retention policy.

## Goals
1. **G3:** an admin-only endpoint that **anonymizes** the application + household-member PII (scrub names/DOB/SSN-last-four/contact; tombstone signature images) while **preserving** audit-event metadata. RBAC via the existing permission helper; irreversible with explicit confirmation; returns a summary of what was scrubbed.
2. **G4 (per scope call):** hash chain (`event_hash` column + compute-on-insert + finalize verify), migration commit-only — **or** a documented design + known-gap entry.
3. **G5:** `docs/data-retention-policy.md` — scope, retention period (confirm with program; state "TBD — confirm with HACH/program" rather than invent), deletion approach, Storage lifecycle approach (or a cron-job follow-up).

## Non-goals
- No tenant-facing self-serve deletion UI. No retroactive `event_hash` backfill unless trivial (document the gap). No destructive deletion job built here (G5 is policy + design). Do not edit files outside the Outputs list.

## Implementation
1. G3 anonymization endpoint (RBAC, scrub PII, preserve events, tombstone images).
2. `docs/data-retention-policy.md`.
3. G4 per the scope call (implement chain + migration, or document design).

## Verification (per-PRP gates, before commit)
- `node ./node_modules/typescript/bin/tsc --noEmit` clean.
- `node ./node_modules/.bin/vitest run` — G3 endpoint requires admin RBAC (403 without), scrubs named fields, preserves event metadata; (if G4 implemented) `event_hash` chains and a tampered payload fails verification.
- **No full build per PRP** unless a new typed table/route trips bundling.
- **Deferred runtime gates:** on a preview, anonymize a test application → PII gone, events intact, RBAC enforced; (G4) tamper an event → finalize chain-verify flags it.

**Defaults:** scrub all named PII + tombstone signature images (keep audit references valid); retention period stated as "TBD — confirm with HACH/program," not invented.
