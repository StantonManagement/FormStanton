# PBV Application Layer — Implementation Status Audit

**Date:** May 14, 2026  
**Original Audit:** April 23, 2026 (Phase 1 Reconnaissance)  
**Status:** Updated to reflect current implementation state

---

## Executive Summary

| Phase | Status | Key Deliverables |
|-------|--------|------------------|
| Phase 0 — Close Phase 1 Gaps | ✅ **COMPLETE** | Summary PDF API, Thresholds admin API |
| Phase 1 — Reconnaissance | ✅ **COMPLETE** | Original audit documented patterns |
| Phase 2 — Data Layer | ✅ **COMPLETE** | Tables created, encryption implemented |
| Phase 3 — Intake Form | ✅ **COMPLETE** | Tenant-facing form with 7 sections |
| Phase 4 — Multi-Signer | ✅ **COMPLETE** | One-device handoff, per-form signatures |
| Phase 5 — Document Collection | ✅ **COMPLETE** | Tenant upload integrated with foundation |
| Phase 6 — Admin Panel | 🔄 **MOSTLY COMPLETE** | Qualification, HHA gen, HACH export done |
| Phase 7 — Access Controls | ✅ **COMPLETE** | Role-gated SSN reads, audit log viewer |

---

## Phase 0 — Close Phase 1 Gaps ✅

### Summary PDF Generation
**File:** `app/api/admin/pbv/preapps/[id]/summary-pdf/route.ts`

### Thresholds Admin
**File:** `app/api/admin/pbv/thresholds/route.ts`

---

## Phase 1 — Reconnaissance ✅

Original patterns documented in `tasks/pbv-app-audit.md` (April 23, 2026 version).

---

## Phase 2 — Data Layer ✅

### Tables Created (confirmed in DB)

- `pbv_full_applications` — Main application record
- `pbv_household_members` — Household composition with encrypted SSN
- `pbv_access_log` — Audit trail for sensitive data access
- `pbv_income_sources` — Detailed income tracking
- `pbv_document_label_translations` — Trilingual labels
- `pbv_preapplications` — Phase 1 pre-applications
- `pbv_income_thresholds` — Qualification thresholds

### SSN Handling

- Column-level encryption via `ssn_encrypted` (AES-GCM in `lib/ssnEncryption.ts`)
- `ssn_last_four` plaintext for display/search
- Every full SSN read logged to `pbv_access_log`

---

## Phase 3 — Intake Form ✅

**File:** `app/pbv-full-app/[token]/page.tsx` (1630 lines)

7-section tabbed form:
1. Household Composition
2. Income (per-member sources)
3. Assets & Banking
4. Expenses & Deductions
5. Background (criminal history)
6. Special Circumstances (DV, homeless, RA)
7. Review & Certify

**Features:**
- Language confirmation flow
- Phone validation
- Trilingual (EN/ES/PT)

---

## Phase 4 — Multi-Signer ✅

**Embedded in:** `app/pbv-full-app/[token]/page.tsx`
**Also:** `app/pbv-full-app/[token]/signing/page.tsx`

- One-device handoff UI
- Self-attested identity confirmation
- Per-form signature capture
- Progress tracking
- All-adults-complete detection

---

## Phase 5 — Document Collection ✅

**Component:** `TenantDocumentUpload`

- Conditional document list based on intake data
- Drag-drop upload
- Status tracking
- Rejected document resubmission

---

## Phase 6 — Admin Panel ✅ COMPLETE

### ✅ All Deliverables Complete

**Admin Detail Page:** `app/admin/pbv/full-applications/[id]/page.tsx`

| Feature | Status |
|---------|--------|
| Qualification math panel | ✅ Claimed vs. documented income, 10% delta |
| Document review | ✅ `StantonReviewSurface` integrated |
| Stanton review status | ✅ Full workflow with notes |
| HHA generation | ✅ DocxTemplater, auto-disabled until ready |
| HACH export | ✅ ZIP package with all documents |
| Send to HACH | ✅ With permission checks, packet locking |
| Packet lock/reopen | ✅ Full workflow |
| Admin list page | ✅ `/admin/pbv/full-applications` exists |

---

## Phase 7 — Access Controls ✅ COMPLETE

### PBV Reviewer Management UI ✅

**New Page:** `app/admin/pbv/reviewers/page.tsx`

**Features:**
- View all users with SSN access
- Grant/revoke reviewer access
- Recent SSN access log
- Auto-creates `pbv_reviewer` role on first use

**API:** `app/api/admin/pbv/reviewers/route.ts`
- GET: List reviewers + access log
- POST: Grant reviewer access
- DELETE: Revoke reviewer access
- PUT: Ensure role exists

### SSN Read Endpoint ✅

**File:** `app/api/admin/pbv/full-applications/[id]/ssn/[memberId]/route.ts`

- Requires `read_ssn` permission (granted via `pbv_reviewer` role)
- Decrypts and returns full SSN
- Logs every access to `pbv_access_log`
- Returns 403 if unauthorized

### Sensitive Data Checklist ✅

- [x] SSNs encrypted at rest (AES-GCM)
- [x] Full SSN visible only to `pbv_reviewer` role
- [x] Every full SSN read logged to `pbv_access_log`
- [x] SSNs redacted in all PDF outputs (last-4 only in UI)
- [x] SSNs redacted in all log output
- [x] Document upload routes authenticated
- [x] Sensitive document access logged

---

## Files Inventory

### Core Implementation

| File | Purpose |
|------|---------|
| `lib/pbvFullAppTranslations.ts` | Trilingual strings |
| `app/pbv-full-app/[token]/page.tsx` | Main intake form + embedded signatures |
| `app/pbv-full-app/[token]/signing/page.tsx` | Dedicated signing flow |
| `app/api/t/[token]/pbv-full-app/route.ts` | GET/POST for tenant form |
| `app/admin/pbv/full-applications/[id]/page.tsx` | Admin detail |
| `app/api/admin/pbv/full-applications/[id]/route.ts` | Admin detail API |
| `app/api/admin/pbv/full-applications/[id]/hha/route.ts` | HHA generation |
| `lib/ssnEncryption.ts` | AES-GCM encryption |
| `lib/memberFilter.ts` | Per-person document filtering |
| `components/pbv/TenantDocumentUpload.tsx` | Document upload UI |

### Phase 7 (New)

| File | Purpose |
|------|---------|
| `app/admin/pbv/reviewers/page.tsx` | PBV reviewer management |
| `app/api/admin/pbv/reviewers/route.ts` | Reviewer CRUD + access log |
| `app/api/admin/pbv/full-applications/[id]/ssn/[memberId]/route.ts` | SSN read endpoint |

---

## Navigation Updates

**File:** `lib/adminNav.ts`
- Added "PBV Reviewers" to Program Compliance section

**File:** `lib/permissions.ts`
- Added `/admin/pbv/reviewers` → `PBV_FULL_APPLICATIONS:admin`

**File:** `components/AdminSidebar.tsx`
- Added icon mapping for "PBV Reviewers"

---

## Remaining Optional Enhancements

These are nice-to-have but not required by PRD:

1. **Full-app summary PDF** (like pre-app summary)
2. **HHA template upload UI** (currently manual bucket upload)
3. **Global audit log viewer** (currently only in PBV reviewers page)

---

## PRD Compliance Summary

| PRD Requirement | Status |
|-----------------|--------|
| Summary PDF generation | ✅ Pre-app done, full-app not required |
| Thresholds admin | ✅ Complete |
| PBV intake form | ✅ Complete |
| Multi-signer flow | ✅ Complete |
| Document collection | ✅ Complete |
| HHA auto-fill | ✅ Complete |
| SSN access controls | ✅ Complete |
| Access logging | ✅ Complete |

**All mandatory PRD deliverables are complete.**
