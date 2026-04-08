# Codebase Audit Report — FormsStanton

**Date:** April 8, 2026  
**Scope:** Full codebase review for architectural integrity, data flow issues, and operational problems  
**Auditor:** Cascade AI

---

## Executive Summary

This audit identified **8 critical architectural issues** and **5 data flow concerns** that impact document visibility, compliance accuracy, and system maintainability. The most pressing issues affect the Review Panel's ability to confirm unit completion when tenants give insurance authorization.

---

## Critical Issues (Immediate Attention Required)

### 1. **DOCUMENT VISIBILITY FAILURE** — HIGH PRIORITY

**Issue:** Will cannot see documents in the review panel because evidence files are stored across **three different storage buckets**, but the file viewer only checks one.

**Evidence Location:**
| Bucket | Purpose | Access Route |
|--------|---------|--------------|
| `submissions` | Tenant onboarding forms (`insurance/`, `signatures/`, `documents/`) | `/api/admin/file?path=` |
| `form-photos` | Individual form submissions (pet exemption, etc.) | Direct Supabase URL |
| `project-evidence` | Project mode task completions | Stored in `task_completions.evidence_url` as public URL |

**Root Cause:**
- `app/api/admin/file/route.ts:27-32` only accesses the `submissions` bucket
- `EvidenceViewer.tsx:42` constructs proxy URL only for `submissions` bucket
- Project evidence URLs go directly to Supabase public URLs, bypassing the proxy

**Impact:** Staff cannot view tenant-uploaded documents in Review Mode, blocking the ability to confirm task completion.

**Files Affected:**
- `app/api/admin/file/route.ts`
- `components/compliance/EvidenceViewer.tsx`

---

### 2. **INSURANCE AUTHORIZATION NOT VISIBLE IN REVIEW PANEL** — HIGH PRIORITY

**Issue:** When a tenant gives permission to charge them for renters insurance (`add_insurance_to_rent: true`), the review panel cannot confirm the unit is complete because this field is not surfaced in the task completion flow.

**Data Flow Problem:**
1. Tenant checks "Add insurance to my rent" on form → stored in `submissions.add_insurance_to_rent`
2. `app/api/admin/tenant-insurance/route.ts:216-219` syncs this to `submissions` table when insurance policy saved
3. `project_units` route only enriches with: `insurance_file`, `insurance_verified`, `insurance_type` (line 119-123)
4. **Missing:** `add_insurance_to_rent` is NOT included in `submission_data` enrichment

**Impact:** Staff see "No document uploaded" for insurance tasks even when tenant has authorized insurance charges — they cannot pass/fail the task meaningfully.

**Files Affected:**
- `app/api/admin/projects/[id]/units/route.ts:119-123`

---

### 3. **STALE AF_ TABLE REFERENCES IN SCRIPTS** — MEDIUM PRIORITY

**Issue:** Two migration scripts contain hardcoded references to production-only AF_ tables:

| Script | AF_ Table Reference | Line |
|--------|---------------------|------|
| `scripts/import-rentroll-occupancy.ts` | `AF_UnitDirectory`, `AF_UnitVacancyDetail` | 81-94 |
| `scripts/migrate-tenant-data.ts` | `af_unit_id` | 137 |

**Risk:** Scripts will fail if run against environments without these staging tables. The import script also contains hardcoded property name mappings (lines 31-72) that require manual updates when properties are added.

**Recommendation:** 
- Add environment guards to fail gracefully when AF_ tables are absent
- Move property mappings to configuration table

---

### 4. **DUAL SUBMISSION TABLE ARCHITECTURE** — ARCHITECTURAL DEBT

**Issue:** The system maintains two separate submission tables with overlapping purposes:

| Table | Purpose | Evidence Storage |
|-------|---------|------------------|
| `submissions` | Main tenant onboarding (pets, vehicles, insurance) | Files in `submissions/` bucket |
| `form_submissions` | Individual forms (pet exemption, billing dispute, etc.) | Files in `form-photos/` bucket |

**Problems:**
1. **Code duplication:** Form submission routes duplicate upload logic
2. **Compliance gaps:** `form_submissions` records don't appear in the compliance matrix
3. **Data inconsistency:** Pet exemption documents in `form_submissions` may not sync to `submissions` ESA tracking

**Evidence:**
- `app/api/forms/pet-fee-exemption/route.ts:102-121` attempts sync to `submissions`, but only updates `exemption_reason`, not `has_esa_doc` logic
- Compliance matrix only queries `submissions` table

---

### 5. **TYPE SAFETY VIOLATIONS IN SUPABASE QUERIES** — CODE QUALITY

**Issue:** Multiple locations use `as any` casting for Supabase joined relations, bypassing TypeScript safety:

```typescript
// app/api/admin/projects/[id]/units/[unitId]/tasks/[taskId]/complete/route.ts
const taskType = (completion as any).project_tasks?.task_types;  // Line 84
const parentTaskId = (completion as any).project_tasks?.parent_task_id;  // Line 120
```

**Locations:**
- `complete/route.ts` — lines 84, 120, 254, 288
- `app/api/admin/projects/[id]/units/route.ts` — lines 86-88 (parent evidence query)
- `app/api/t/[token]/tasks/[taskId]/complete/route.ts` — lines 36, 57

**Risk:** Schema changes won't trigger compile-time errors; runtime failures likely.

---

### 6. **DUPLICATE SUBMISSION MAP PREFERS WRONG ROW** — DATA QUALITY

**Issue:** The duplicate submission resolution logic in `units/route.ts:44-49` prefers rows with `insurance_file`, but this may select an older submission with an old insurance document over a newer submission with current data but no re-uploaded insurance file.

```typescript
// Current logic: prefers insurance_file presence over recency
if (!existing || (!existing.insurance_file && s.insurance_file)) {
  submissionMap.set(key, s);
}
```

**Impact:** Staff may see stale insurance documents when tenant has submitted a newer form without re-uploading insurance (e.g., only updating vehicle info).

---

### 7. **PROJECT EVIDENCE URL CONSTRUCTION INCONSISTENCY** — BUG RISK

**Issue:** Evidence URLs are constructed differently across the codebase:

```typescript
// In EvidenceViewer.tsx - uses proxy
const proxyUrl = evidenceUrl ? `/api/admin/file?path=${encodeURIComponent(evidenceUrl)}` : null;

// In ProjectMatrixCell.tsx - uses direct URL (docUrl passed through)
<a href={docUrl} target="_blank" ... />

// In task completion route - stores public Supabase URL
const { data: urlData } = supabaseAdmin.storage.from('project-evidence').getPublicUrl(storagePath);
evidenceUrl = urlData.publicUrl;
```

**Risk:** The `/api/admin/file` proxy is bypassed for project evidence, meaning:
1. No authentication check on document access (public URL)
2. CORS issues possible if Supabase bucket CORS changes
3. Bucket name exposed in client

---

### 8. **OVERALL STATUS COMPUTATION INCONSISTENCY** — LOGIC BUG

**Issue:** The `overall_status` computation in tenant completion route differs from staff completion route:

**Tenant route** (`t/[token]/tasks/[taskId]/complete/route.ts:210-215`):
```typescript
if (allRequiredDone) overallStatus = 'complete';
else if (anyDone) overallStatus = 'in_progress';
// Missing: 'has_failure' status
```

**Staff route** (`admin/projects/[id]/units/[taskId]/complete/route.ts:191-198`):
```typescript
if (anyRequiredFailed) overallStatus = 'has_failure';
else if (allRequiredDone) overallStatus = 'complete';
else if (anyDone) overallStatus = 'in_progress';
```

**Impact:** Units marked as failed by staff may still show as "in_progress" to tenant portal.

---

## Data Flow Issues

### Issue A: Parent Evidence Flow Direction
The bidirectional parent-child linking has a subtle issue:

- **Evidence flows DOWN** (parent → child): ✅ Implemented correctly
- **Results flow UP** (child → parent): ✅ Implemented, but uses `notes` field as side-channel

**Concern:** The parent task completion's `notes` field is overwritten with verification status, destroying any existing notes. Staff cannot add notes to parent tasks without them being replaced by child project updates.

**File:** `app/api/admin/projects/[id]/units/[unitId]/tasks/[taskId]/complete/route.ts:150-158`

---

### Issue B: Missing `submission_column` Sync on Undo
When staff marks a task complete, the `submission_column` side-effect updates the submissions table. On undo (DELETE), this reverts. However:

- If the submission was updated independently between complete and undo, the revert may lose data
- No optimistic locking or version check

**File:** `complete/route.ts:103-116` and `274-284`

---

### Issue C: Tenant Lookup Data Staleness
The compliance matrix relies on `tenant_lookup` for:
1. Occupied unit detection
2. Tenant contact info when submission missing
3. Building stats computation

**Concern:** `tenant_lookup` is populated by `import-rentroll-occupancy.ts` which must be run manually. If this script isn't run regularly, the compliance matrix shows incorrect occupancy.

**Mitigation:** The system has `is_current` flags, but no automated refresh mechanism.

---

### Issue D: Insurance Verification Gap
The `insurance_verified` field exists in `submissions` but:
1. No API route to mark insurance as verified in project mode
2. `TenantSidePanel.tsx` shows `insurance_verified` but it's not editable
3. Compliance matrix doesn't track insurance verification as a completion criterion

---

### Issue E: Form Submission Status Workflow
`form_submissions` table has workflow fields (`status`, `assigned_to`, `priority`) but:
1. No UI to manage form submission workflow in project context
2. Form submissions aren't linked to project tasks (orphaned data)
3. Status transitions not enforced (can jump from `pending_review` to `completed`)

---

## Recommendations

### Immediate (This Week)
1. **Fix document visibility:** Update `EvidenceViewer.tsx` to handle all three bucket types
2. **Surface insurance authorization:** Add `add_insurance_to_rent` to `submission_data` enrichment in units route
3. **Fix overall status computation:** Add `has_failure` check to tenant completion route

### Short-term (Next Sprint)
4. **Unify evidence access:** Route all document access through authenticated proxy
5. **Add type safety:** Generate Supabase types properly, remove `as any` casts
6. **Fix duplicate selection logic:** Prefer most recent submission, not just one with insurance_file

### Long-term (Next Quarter)
7. **Consolidate submission tables:** Migrate `form_submissions` into `submissions` with `form_type` discriminator
8. **Automate tenant lookup refresh:** Scheduled job or trigger-based sync from AppFolio
9. **Remove AF_ dependencies:** Create stable ETL pipeline with proper staging tables

---

## Appendix: Key Data Flows

### Document Upload Flow
```
Tenant Form → API Route → Supabase Storage
                                    ↓
                           submissions/ (onboarding)
                           form-photos/ (individual forms)
                           project-evidence/ (project tasks)
                                    ↓
                           EvidenceViewer (only checks submissions bucket)
```

### Insurance Authorization Flow
```
Tenant checks "Add to rent" → submissions.add_insurance_to_rent = true
                                      ↓
                           Lobby Intake saves policy → syncs to submissions
                                      ↓
                           Review Panel shows insurance task
                                      ↓
                           ??? add_insurance_to_rent NOT visible in task data
```

### Parent-Child Evidence Flow
```
Parent Project Task (has evidence) → evidence_url in task_completions
                ↓
         project_units.parent_evidence (via units API)
                ↓
         EvidenceViewer reads from parent_evidence[taskId]
                ↓
         If child task completed → notes written UP to parent
```

---

## Files Requiring Immediate Review

| File | Issue | Priority |
|------|-------|----------|
| `components/compliance/EvidenceViewer.tsx` | Only reads from submissions bucket | HIGH |
| `app/api/admin/projects/[id]/units/route.ts` | Missing `add_insurance_to_rent` in enrichment | HIGH |
| `app/api/t/[token]/tasks/[taskId]/complete/route.ts` | Missing `has_failure` status | MEDIUM |
| `scripts/import-rentroll-occupancy.ts` | Hardcoded AF_ tables | MEDIUM |
| `app/api/admin/file/route.ts` | Single bucket access | MEDIUM |
