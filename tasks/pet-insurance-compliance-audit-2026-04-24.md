# Pet + Insurance Compliance Audit (Implementation Report)

Date: 2026-04-24  
Scope: Lobby Intake, permit issuance gates, compliance verification surfaces, AppFolio queue projections, and insurance policy persistence/sync.

## Executive Summary

This audit found **1 P0 bypass**, **4 P1 blocker/consistency risks**, and **3 P2 operational risks** in pet + insurance flows.

Most critical issue:
- Insurance can be marked verified through APIs/UI paths that do not enforce the same preconditions as the lobby gate logic, allowing permit issuance workflows to proceed based on potentially invalid insurance state.

---

## Findings

### P0 — Insurance verification bypass via unrestricted verify endpoints

**Impact**
- Staff can mark `insurance_verified = true` without renters-policy validation (document/type checks), which can unlock permit issuance gates.
- This is a direct compliance bypass risk.

**Evidence**
- `app/api/admin/compliance/verify-insurance/route.ts:26` updates `insurance_verified` directly with no precondition checks.
- `app/api/admin/compliance/building-summary/route.ts:135` allows insurance verification toggle with no insurance-type/doc guards.
- `components/compliance/TenantSidePanel.tsx:285` calls `/api/admin/compliance/verify-insurance` directly from a “Mark Verified” button.
- Expected gating logic exists only in lobby page helper: `app/admin/lobby/page.tsx:987` (`getInsuranceVerifiedStatus`) blocks verify for no file / no type / `car` / `other`.

**Why this is dangerous**
- Verification rules are enforced in one UI path but not in shared backend verification endpoints.
- Any surface calling these endpoints can bypass renters-insurance requirements.

**Recommended fix**
1. Move insurance verification preconditions into a shared server validator used by both verification endpoints.
2. Reject verify attempts when type/doc constraints fail, return actionable reason.
3. Keep UI checks, but treat them as UX hints only (server remains source of truth).

---

### P1 — Canonical-sync conflict returned after policy write (partial success reported as failure)

**Impact**
- Insurance policy can be inserted successfully, then API returns 409 due to canonical ambiguity during submission sync.
- UI interprets as save failure, staff may retry, creating duplicate policy history and confusion.

**Evidence**
- Policy insert occurs before canonical sync check: `app/api/admin/tenant-insurance/route.ts:169`.
- Canonical conflict check/409 occurs after insert: `app/api/admin/tenant-insurance/route.ts:203` and `:205`.

**Why this is risky**
- Operation is not atomic from user perspective.
- “Failed save” message can hide a successful DB write and produce duplicate operational actions.

**Recommended fix**
1. Resolve canonical submission before insert, or
2. Wrap insert + sync in transaction semantics (or rollback strategy), or
3. Return explicit partial-success response with clear UI handling (not generic failure).

---

### P1 — Low-coverage pet flow message contradicts actual API behavior

**Impact**
- Frontend path says it can save with compliance flag for pet households under `$300k`, but backend hard-blocks that save.
- Staff gets mixed signals and may not understand why save fails after warning flow.

**Evidence**
- Frontend logs flag and proceeds: `components/LobbyIntakePanel.tsx:909` and `:923`.
- Frontend success branch for low-coverage save exists: `components/LobbyIntakePanel.tsx:995`.
- Backend hard-blocks under `$300k` for pet households: `app/api/admin/tenant-insurance/route.ts:154`.

**Why this is risky**
- Contradictory UX increases retry loops and escalations.
- Internal comments/alerts imply behavior that cannot occur with current API.

**Recommended fix**
1. Align frontend copy and control flow with hard-block behavior.
2. If “flag but allow” is desired policy, backend rules must be changed (with explicit policy approval).

---

### P1 — Pet verification logic may mis-handle non-dog/cat pets

**Impact**
- For `has_pets=true` but no dog/cat entries, current logic falls into “no pets form required” branch.
- This can produce incorrect blocker messaging and verification handling.

**Evidence**
- Dog/cat-only filter: `app/admin/lobby/page.tsx:959`.
- Branch for no dog/cat returns no-pets-form requirement: `app/admin/lobby/page.tsx:978` through `:983`.

**Why this is risky**
- Valid pet cases (e.g., non-dog/cat) can be treated as “no pets,” which is policy confusion and potential false block.

**Recommended fix**
1. Separate “pet species policy applicability” from “no pets acknowledgment required.”
2. Update blocker reason to reflect actual policy domain (dogs/cats vs all pets).

---

### P1 — Completion state can hide unresolved insurance exceptions after override

**Impact**
- For vehicle tenants, `isComplete` only requires permit issued + picked up; it does not require insurance/pet verification.
- A manager override can produce a “complete” outcome despite unresolved compliance verification.

**Evidence**
- Completion logic for vehicle branch: `app/admin/lobby/page.tsx:1062`.
- Permit route supports manager override despite missing verification: `app/api/admin/compliance/permit/route.ts:60` and `:71`.

**Why this is risky**
- Operational dashboards may represent units as complete while still relying on exception-based permit issuance.

**Recommended fix**
1. Decide whether completion should reflect strict compliance completion vs operational completion.
2. If strict, include insurance/pet verification in vehicle completion condition.
3. If operational, add an explicit “completed_with_override” marker.

---

### P2 — `has_pets` source divergence between insurance policy and submission gates

**Impact**
- Insurance policy writes use `has_pets` from intake insurance form; permit/lobby gates use `submissions.has_pets`.
- If they diverge, staff sees inconsistent blockers across screens.

**Evidence**
- Policy save writes `has_pets` in policy row: `app/api/admin/tenant-insurance/route.ts:186`.
- Permit/lobby gate relies on submission field: `app/admin/lobby/page.tsx:1042`, `app/api/admin/compliance/permit/route.ts:52`.

**Recommended fix**
- Define canonical owner for pet household flag and synchronize on save (or compute from one source).

---

### P2 — Permit API allows issuance path without explicit `has_vehicle` guard

**Impact**
- UI gate checks vehicle context before permit flow, but permit API does not explicitly enforce `has_vehicle`.
- Non-vehicle rows could be issued permits via direct API misuse.

**Evidence**
- UI guard: `app/admin/lobby/page.tsx:1034`.
- Permit API has no `has_vehicle` check before issuing: `app/api/admin/compliance/permit/route.ts:44` onward.

**Recommended fix**
- Add server-side `has_vehicle` (or explicit policy equivalent) guard in permit issuance endpoint.

---

### P2 — Multiple verification entry points create policy drift risk

**Impact**
- Different views use different endpoints and assumptions for toggles.
- Future logic changes can drift and re-open bypasses.

**Evidence**
- Lobby toggles via `/api/admin/compliance/building-summary`: `app/admin/lobby/page.tsx:595`.
- Side panel toggles via `/api/admin/compliance/verify-insurance`: `components/compliance/TenantSidePanel.tsx:285`.

**Recommended fix**
- Consolidate verification to one server endpoint + shared validator for all surfaces.

---

## Confirmed Intended Behaviors (Working As Designed)

- Pet household minimum liability hard enforcement in insurance save API: `app/api/admin/tenant-insurance/route.ts:154`.
- Permit issuance blocks on missing verification and supports audited manager override with reason: `app/api/admin/compliance/permit/route.ts:60` and `:87`.
- AppFolio permit fee queue correctly uses pickup-based billing gate (not merely issued): `app/api/admin/compliance/appfolio-queue/route.ts:126`.

---

## Recommended Remediation Order

1. **P0:** Centralize and enforce insurance verification preconditions server-side across all verification endpoints.
2. **P1:** Fix canonical-sync ordering in insurance save flow to remove partial-success-as-failure behavior.
3. **P1:** Align lobby insurance low-coverage UX with backend policy (or update policy intentionally).
4. **P1:** Correct pet-species verification branching to avoid no-pets misclassification.
5. **P1/P2:** Clarify completion semantics and override visibility in lobby/compliance status.
6. **P2:** Add permit API `has_vehicle` guard.
7. **P2:** Consolidate duplicate verification pathways and validators.

---

## Decision Log Items Requiring Policy Confirmation

- Should low-coverage pet policies be hard-blocked or saved with exception flag + follow-up?
- Is “Complete” intended to mean operationally finished or strictly compliant?
- Are non-dog/cat pets subject to the same verification/addendum requirements as dogs/cats?
- Should permit issuance ever be valid for non-vehicle contexts in this workflow?
