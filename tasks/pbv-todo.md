# PBV — Where You Are

_Last updated: 2026-05-14 (later that day)_
_Owner: Alex_
_Deeper context: `docs/handoffs/pbv-decoupling-handoff_2026-05-14.md`_

---

## Snapshot

Four PRDs drafted. PRD-02 is **in gap-closing build** (Windsurf discovered substrate already exists in prod without a migration file; storage path mismatch in commit route; missing save-path test). PRD-03 and PRD-04 amended with cross-PRD audit findings — all Open Questions resolved upfront.

---

## Build queue (in order)

### 1. PRD-02 — PBV Packet Intake (staff walk-in, OCR-assisted)
- [x] Handed to Windsurf.
- [ ] **In progress — gap-closing build.** Findings: substrate tables (`intake_batches`, `intake_pages`, `doc_type_signatures` + 108 seeded signatures) exist in live DB with no migration file; commit route has 3-way storage-path mismatch (wrong bucket + wrong filename + no multi-page handling); no save-path integration test.
- [ ] Work order: (1) write migration to reconstruct substrate from live schema, idempotent, no-op against prod, (2) write save-path test, (3) write build report, (4) fix storage path bug after multi-page decision = **Option C (concatenate to single PDF at commit via pdf-lib)**.
- [ ] Receive build report at `docs/build-reports/pbv-02-packet-intake-build-report_2026-05-14.md`
- [ ] Verify against PRD §Verification Gates before merge.

### 2. PRD-03 — Tenant-Facing Packet Upload
- [ ] **Hand to Windsurf.** Independent of PRD-02 — can ship in parallel.
  - PRD: `docs/02-pbv-03-tenant-packet-upload-prd_2026-05-14.md` (read **Amendment block at top** first — Open Questions pre-answered)
  - Prompt: `docs/02-pbv-03-tenant-packet-upload-prompt_2026-05-14.md` (amended to match)
- [x] All four Open Questions resolved in Amendment block (uploaded_by_role already accepts 'tenant'; token resolver at `app/api/t/[token]/pbv-f