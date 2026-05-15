# hud-9886a — EN

**Source:** packet pp 11+13, extracted to `hud-9886a-en.pdf` (2 pages)
**Complexity:** Medium — 15 fields, page 2 only
**Scope:** Per adult — all household members 18+

## Field Layout
Page 1: Authorization text, program list, sources list — no fillable fields.
Page 2: Signatures section (bottom half) + Privacy Advisory + Penalties (top half).

Signature grid (page 2, lower half):
- Row 1: HOH sig (x=42, y=577) | Date (x=257) | [right col: Other Member 1 (x=336, y=557) | Date (x=549)]
- Row 2: HOH SSN (x=42, y=553) | [right col empty]
- Row 3: Spouse (x=42, y=521) | Date (x=257) | [right col: Other Member 3 (x=336, y=521) | Date (x=549)]
- Rows 4-5: Other Member 2, 4, 5 in both columns

## Anomaly
Empty image fields (other_member_2–5 signatures) omitted from sample data per stamp-form.mjs EISDIR constraint. The map retains the field definitions for runtime use; sample data only fills the slots represented in the Maria household (HOH + spouse + 1 adult child).

## Verification
Stamped and rendered — HOH, SSN, Spouse, Other Member 1 all land in correct grid cells. Visual check passed.
