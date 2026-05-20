# Build Report — PRD-36: Tenant-Facing Application Status

**Date:** 2026-05-17  
**Branch:** `feat/pbv-tenant-application-status-36`  
**Status:** Shipped 2026-05-16

---

## What shipped

- **F1** — Status taxonomy: `submitted | under_review | action_required | approved | denied | archived`
- **F2** — `application_review_status` column on `pbv_full_applications`
- **F3** — Tenant dashboard banner with status, SLA, office contact
- **F4** — Banner persistence: dashboard only (clears on navigation)
- **F5** — Action-required count from `application_documents.status = 'rejected'`
- **Bootstrap** — Dashboard reads from `intake_snapshot` when `intake_data` is empty

---

## What changed from PRD

- **SLA copy** — `"Office reviews typically within 2 weeks of submission."`
- **Office contact** — V1 uses static `info@stantoncap.com` / `(860) 993-3401` for all buildings

---

## What was deferred

- **Re-apply-after-denied** — Requires product decision. Deferred as separate PRD.

---

## Verification status

| Item | Status |
|---|---|
| Status banner renders | [inference based on component inspection] |
| SLA copy displays | [inference based on component inspection] |
| Contact info shows | [inference based on component inspection] |

---

## Known issues / followups

- Re-apply-after-denied deferred pending product decision
