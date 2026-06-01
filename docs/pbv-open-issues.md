# PBV — Running Open Issues / TODO

The running list of UX gaps, bugs, and deferred work surfaced while operating the PBV flow.
Newest issues at the top of "Open." When something is fixed, move it to "Resolved" with the commit.

Owner shorthand: **A** = Alex, **C** = Claude/agent.

---

## Open

### UX / discoverability
- **[#1] Two separate admin detail pages for one application is confusing.** `/admin/pbv/full-applications/[id]` (upload/sign tracker) and `/admin/pbv/pipeline/[id]` (pipeline detail) are different screens for the same applicant. Decide which is canonical and consolidate, or cross-link clearly. — *C, needs design call from A*
- **[#2] "MISSING" labels on the full-applications page are misleading.** That page reads `application_documents` (the upload/sign-back tracker), not `pbv_form_documents` (the generated PDFs). Generated-but-unsigned forms read "MISSING / Not yet uploaded," which looks broken. Needs a UX rethink so generated docs and to-be-signed docs aren't conflated. — *parked spawn-task; needs A's call*
- **[#3] Audit log widget appears broken.** The bottom bar (`…pbv_assisted.start — 1h ago` with a ▲) is cut off / its expand control isn't usable; a button under the audit log isn't visible/clickable. Needs repro + fix. — *C to investigate*

### Review flow (PRD-87) polish
- **[#4] Validation flags not yet populated in the review screen.** The review API returns `validation: null` for every doc (slot reserved, PRD-86 validator output not wired in). The "⚠ flagged" UI never shows. Wire the PRD-86 verifier output into the review payload. — *C*

---

## Resolved
- **[R1] Could not view generated PDFs before sending.** Long-standing request. Delivered via the PRD-87 review screen `/admin/pbv/pipeline/[id]/review` — lists every generated form, renders each inline (signed URL → iframe), with Approve/Hold. (commit: PRD-87 slice, `244f8af`)
- **[R2] Review screen was an orphan (no link to it).** Added a "Review documents" button to the full-applications header. (commit: pending)
- **[R3] Citizenship declaration family-member name rendered blank.** Map key `full_name`→`name`; regenerated 6 apps to v3; Mia/Santha verified. (PR #10, `b415f0b`)
