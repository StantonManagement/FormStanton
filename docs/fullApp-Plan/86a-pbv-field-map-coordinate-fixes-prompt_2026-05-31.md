# Build prompt — PBV field-map + resolver fixes (PRD-86 Phase A)

**Run with:** Claude Code / coding agent, from the FormStanton repo root.
**Read first:** `docs/SHELL-PROTOCOL.md`. Use `node ./node_modules/typescript/bin/tsc --noEmit` for typechecks — never `npx tsc` (hangs on Windows).
**Do NOT** notify any applicant. No SMS, no `pbv_preflight_checklist`. This task ends at "documents regenerated + visually verified." Re-notification is PRD-85 Phase 4, operator-triggered, after PRD-87 review.

---

## Context

Mia (`2b451d4e-6578-43e6-9689-450cadcc62fe`) and Santha (`00d613e5-1573-4a7b-ab98-73a46ca4d681`) completed intake; their unsigned PDFs exist in storage bucket **`pbv-forms`** at `pbv/<appId>/forms/<form_id>-en-v1.pdf`. Three forms render with placement defects. Production generation path: `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` → `resolveFieldData` (`lib/pbv/form-generation/field-mapping.ts`) → `stampForm` (`lib/pbv/form-generation/stamper.ts`, pdf-lib, **bottom-left origin**, `y` = text baseline) using maps in `scripts/field-maps/*.json` and source PDFs in `assets/pbv-source-pdfs/`.

## Fixes already applied (uncommitted) — your job: verify → typecheck/test → version-bump → deploy → regenerate → eyeball

All edits below were calibrated against a grid overlay on the real source PDFs and confirmed by rendering with sample data through the **production resolver** (not the harness fixture — see the trap in step 1). Confirmed clean after fix.

### 1. Resolver — duplicate HOH relationship (`lib/pbv/form-generation/field-mapping.ts`)
`resolveMainApplication` set slot-1 relationship to `'SELF'`/`'YO'`. But the source form **pre-prints** "SELF" (en) / "YO" (es) in the first adults-table relationship cell, so this stamped a duplicate. Changed to emit `''` for slot 1; non-HOH adults still stamp their real relationship.

### 2. main-application-en.json / main-application-es.json (legal 612×1008)
- **Column key mismatch (was silently blanking names).** Adults+minors row-pattern columns used `field_prefix` `last_name`/`first_name`/`middle_initial`, but the resolver emits `last`/`first`/`mi`. In production the Last/First/MI columns came out **blank** (dob/ssn/relationship/age matched and showed). Renamed those three `field_prefix` values to `last`/`first`/`mi` in both adults and minors patterns. **NOTE the trap:** the field-map harness preview did NOT expose this because it stamps a fixture keyed to the map, not the resolver output — so a clean harness preview is *not* sufficient proof. Verify with the production resolver (the included render approach, or a real regen).
- Flat label fields shifted right off their printed labels: `applicant_full_name` x18→60, `phone_home` x105→148, `applicant_email` x370→432, `address_city_state_zip` x390→472.
- Table rows raised so row 0 lands on the first data row (the pre-printed SELF/YO line) instead of one row low: adults `row_start_y` 566→**580**, minors 322→**336**.

### 3. criminal-background-release-en.json (letter 612×792)
- `last_name` x415→**458** (off "Last Name -" label), `ssn` x200→**250** (off "Social Security Number (SSN):" label).

### 4. criminal-background-release-es.json
- `last_name` x390→**435**, `ssn` x200→**255**.

### 5. citizenship-declaration-en.json (letter 612×790)
- members `row_start_y` 347→**332** (row 1 drops below the Date/Status header).

### 6. citizenship-declaration-es.json
- members `row_start_y` 352→**337**.

Untouched / verified clean (do not edit): briefing-cert, obligations-of-family, hach-release, child-support-affidavit, no-child-support-affidavit, debts-owed-phas, eiv-guide-receipt, hud-9886a, hud-92006.

---

## Steps

1. **Re-verify visually using the PRODUCTION resolver**, not just the harness fixture. Stamp each edited form with realistic member data (≥2 adults incl. HOH + 1 minor) via `resolveFieldData`→`stampForm`, rasterize page 1 (`pdftoppm -png -r 130 …`), and confirm: names populate Last/First/MI; no text overprints a printed label or gridline; HOH row coincides with the pre-printed SELF/YO with no duplicate; minor rows sit inside cells. **The ES coordinates are the least certain** — look at ES specifically and nudge x by ±5–10 / row_start_y by ±5 if anything grazes.
2. `node ./node_modules/typescript/bin/tsc --noEmit` and run `lib/pbv/form-generation/__tests__/`. If a test asserted the old slot-1 `'SELF'`/`'YO'` relationship value, update it to `''` and note why.
3. **Version-bump** so regen emits new artifacts (`-v2`) instead of reusing cached `-v1`. Follow the existing `generation_version` / `field_map_version` convention in the generate-forms route and storage path.
4. **Deploy** the corrected maps + resolver. `scripts/regen-applicant-forms.ts` hits the deployed build — regen before deploy re-stamps the OLD maps.
5. **Regenerate, no notification:** `npx tsx scripts/regen-applicant-forms.ts --mia-santha`.
6. **Download the regenerated v2 PDFs** for both applicants and eyeball the three previously-defective forms with their real intake data. Hand to Alex for sign-off.
7. **Commit** the 6 maps + the resolver change, message referencing PRD-86 Phase A. Do NOT commit `.field-map-authoring-out/`, `/tmp`, or `scripts/_render_check.ts` (a scratch file from the Cowork session — delete it).

## Guardrails
- Unsigned regeneration only. Never edit signed PDFs / `signed_pdf_path` (HUD/HACH compliance).
- Don't touch `stamper.ts` — the bug was data/coords, not the stamper.
- No notifications. Stop after regen + verify + commit.
- Only the 6 maps + the one resolver line (+ version-bump plumbing) should change. Leave the 9 clean forms alone.
- Pre-existing unrelated diff: `eiv-guide-receipt-en/es.json` show as modified from before this work — review separately, don't fold into this commit blindly.
