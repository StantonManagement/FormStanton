# debts-owed-phas — ES

**Source:** packet pp 30+32, extracted to `debts-owed-phas-es.pdf` (2 pages)
**Complexity:** Low — 3 fields, page 2 only
**Scope:** HOH only

## Anomaly — OMB expiration discrepancy
EN form shows OMB exp 06/30/2026; ES form shows exp 31/08/2016 (Spanish date format).
The ES version (Formulario HUD-52675 "Spanish") appears to be an older revision. Both are in
the active HACH packet as of 5-28-2025. Flagged for HACH review — the ES form may need to be
updated to the current revision. Field maps proceed against both forms as-is.

## Coordinate Differences vs EN
- `signature_date` x: 491.6 (ES) vs 469.3 (EN) — slight right shift
- All y-coords match EN

## Verification
Stamped and rendered — all 3 fields render correctly. Visual check passed.
