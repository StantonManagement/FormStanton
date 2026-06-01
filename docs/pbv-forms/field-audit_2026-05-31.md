# PBV Forms — Full Field Audit

**Date:** 2026-05-31 · **Status:** evidence-gathering complete; **no code/data changed.**
**Applicants audited:** Mia Lozada (`2b451d4e…`, single adult, employed) and Santha Degross
(`00d613e5…`, 2 members incl. a 16-yo). **Language:** EN (ES uses the same resolvers + data, so
ES inherits every EN defect).

> Bottom line: the forms are not "almost right." Three layers — the **intake schema**
> (`lib/pbv/intake-schema.ts`), the **form resolvers** (`lib/pbv/form-generation/field-mapping.ts`),
> and the **field maps** (`scripts/field-maps/*.json`) — were each built to a *different* idea of
> the data, and never reconciled. The earlier "all 24 maps pass" was a geometry check; it never
> verified a single value lands. Most fields are blank because of code/wiring bugs, **not** because
> we lack the data. A smaller, real set of fields was genuinely never collected.

---

## The data actually exists in 3 places (most "blank" fields are recoverable)
1. **`pbv_household_members` table** (per member): name, dob, age, relationship, ssn_last_four,
   `annual_income`, `income_sources`, `employed`, `has_ssi/ss/pension/tanf/child_support/self_employment/other`,
   `disability`, `student`, `citizenship_status`. — *Verified populated for Mia & Santha.*
2. **`pbv_full_applications.intake_snapshot`** (JSONB): `contact{email,phone_cell,phone_home,…}`,
   `household{race,ethnicity,marital_status}`, `income.by_member[].income_sources[].amount_monthly`,
   `assets.has_*`, `medical`, `childcare_disability`, `dv_homeless_ra`, `criminal_history`.
3. **`pbv_full_applications` row**: `building_address`, `unit_number`, `phone`.

---

## Failure taxonomy (every blank traces to one of these)
- **(A) Resolver reads a non-existent intake shape.** `field-mapping.ts` declares its **own**
  `IntakeData` (l.55–67: `applicant.*`, `household.member_list`, `income.rows`, `assets.rows`)
  that does **not** match the real `intake-schema.ts` (`contact`, `income.by_member`, `assets.has_*`).
  The generate-forms route casts the real snapshot to this fake type (`route.ts:59`), so
  `intakeData.applicant`, `income.rows`, etc. are all `undefined` → blank. `as any` casts hid it from `tsc`.
- **(B) Map field-name ↔ resolver output-key mismatch.** The map places a value under a key the
  resolver never emits. E.g. hach map wants `applicant_name`/`applicant_address`; resolver emits
  `printed_name`/`address`. Affidavit maps want `affiant_name`; resolver emits `printed_name`.
  hud_9886a map wants `hoh_ssn`; resolver emits `ssn`. → silently blank.
- **(C) Map is missing placements** for fields the paper form has. E.g. main-application adults
  table maps only 7 of 10 columns (no Disabled/Student/Citizen); no placements for Race/Ethnicity/
  Marital, the Yes/No checkboxes, or the Household-Expenses table. hud_9886a map has **no name placement** at all.
- **(D) Genuinely never collected** by intake. Income **Source/employer**; criminal **previous
  address**; **per-asset** member/institution/market-value; **itemized** household expenses.
- **(E) Whole forms get only a signature resolver.** `debts_owed_phas`, `no_child_support_affidavit`,
  `child_support_affidavit` route to `resolveSimpleAffidavit` (name+date+signature only).

Legend: ✅ FILLED · 🟠 DROPPED (data exists, code/map bug — fixable) · 🔴 NOT COLLECTED (needs Alex's ruling) · ⚪ N/A (signature/staff field, or empty-for-this-applicant)

---

## Summary table

| Form | Map cov. | Headline | 🟠 Dropped | 🔴 Not collected |
|---|---|---|---|---|
| main_application | partial | name+household row only; **all contact, income, race/ethnicity/marital, checkboxes blank** | many (A+C) | income source, expenses, per-asset detail |
| criminal_background_release | good map | name/dob/ssn ok; **current address blank**, previous blank | current addr (A) | previous address |
| hach_release | mismatch | **entirely blank** (B: applicant_name/address keys) | name, address (B) | — |
| hud_92006 | partial | name ok; **mailing address, telephone, alt-contact blank** | address, phone, alt-contact (A+B) | — |
| hud_9886a | broken | **entirely blank** (C: no name placement; B: hoh_ssn) | name, ssn, address (B+C) | — |
| obligations_of_family | mismatch | **name/phone/address blank** (A + key) | name, phone, address (A) | — |
| citizenship_declaration | ✅ good | **CORRECT** (fixed v3) — names, dob, status render | — | — |
| briefing_cert | ok | name renders; signature pending | — | — |
| debts_owed_phas | ok | name renders; signature pending | — | — |
| eiv_guide_receipt | sig-only | signature/date only (form needs only that) | — | — |
| no_child_support_affidavit | mismatch | **blank** (B: affiant_name; E) | name, address, children (B/E) | — |
| child_support_affidavit* | mismatch | (conditional; not generated for Mia/Santha) | name, address, children (B/E) | support amounts |

\*child_support_affidavit is conditional (only when paying support); neither applicant has it.

---

## Per-form detail

### 1. main_application  (map v2, 27 flat fields + 5 row_patterns; source = 5pp legal)
Resolver `resolveMainApplication` (l.96).
| Field | Status | Evidence / cause |
|---|---|---|
| Name | ✅ | falls back to member name |
| Email | 🟠 | data `mialozada94@gmail.com` in snapshot.contact; resolver reads `app.email` (A) |
| Phone Home/Work/Cell | 🟠 | cell `8608347644` in snapshot.contact + app.phone; resolver reads `app.phone` (A) |
| Address / City,ST,Zip | 🟠 | `31-33 Park St` on app row; resolver reads `app.address_*` which doesn't exist (A) |
| Alternate contact | ⚪ | collected field, empty for Mia |
| Adults row: Last/First/MI/DOB/SSN/Age | ✅ | from `members[]` |
| Adults: Relationship (HOH) | ⚪ | "SELF" pre-printed on template (intentionally blank) |
| Adults: Disabled / Student / U.S. Citizen | 🟠 | data in members (`disability/student/citizenship_status`); **map has no column** (C) |
| Race / Ethnicity / Marital status | 🟠 | data in snapshot.household; **neither resolver nor map** handle them (A+C) |
| Income table (Employed: member, amount) | 🟠 | Mia employed `$2,700/mo` in members/snapshot; resolver emits `income_rows:[]` (reads `income.rows`) (A). Map columns correct. |
| Income table: **Source** (employer) | 🔴 | never collected (D) |
| Assets table | ⚪/🔴 | Mia has none → N/A; but the table wants per-asset member/source/value = never collected (D) |
| Medical-expense table | ⚪ | only for elderly/disabled HoH; Mia is neither |
| Yes/No questions (school F/T, outside help, pending benefits, sold assets, DV, criminal) | 🟠 | mostly unmapped checkboxes; some data exists (dv_homeless_ra, criminal_history) (C) |
| Household Expenses table (p4) | 🔴/⚪ | "complete only if no income"; Mia has income → N/A. Where it applies, intake collects only 5 coarse buckets vs ~16 lines + "who pays" (D) |
| Signatures | ⚪ | captured at signing |

> Santha differs only in having a 2nd (minor) row + her income type `other`; same defects.
> Visual proof: `_pbv-review/rescan/main_p1..p5.png`.

### 2. criminal_background_release  (map v2, 19 fields — map is complete)
Resolver `resolveCriminalBackgroundRelease` (l.297).
| Field | Status | Cause |
|---|---|---|
| First / Middle / Last / DOB / SSN | ✅ | from `members[]` |
| Current Address (street/apt/city/state/zip) | 🟠 | resolver reads `app.address_*` (A); real address on app row, never read |
| Previous Address | 🔴 | never collected (D) — resolver comment admits "leave blank for in-person fill" |
| Signature / Witness / Dates | ⚪ | at signing |

### 3. hach_release  (map 10 fields)  — **entirely blank**
Resolver `resolveHachRelease` (l.206) emits `printed_name`, `address`. Map expects `applicant_name`,
`applicant_address`. **(B) key mismatch** → nothing lands. Address also (A)/(D). Signatures ⚪.
- `applicant_name` 🟠 (member name exists; key mismatch) · `applicant_address` 🟠/🔴.

### 4. hud_92006  (map 16 fields — "Supplement: optional contact")
Resolver `resolveHud92006` (l.223) emits `applicant_name`, `address`, dates.
- `applicant_name` ✅ (key matches) · `mailing_address` 🟠 (resolver `address` vs map `mailing_address` (B) + (A)) ·
  `telephone` 🟠 (not emitted; data exists) · additional-contact name/addr/phone/email/relationship 🟠/⚪
  (this is the optional emergency contact — partly uncollected) · contact-reason + opt-out checkboxes ⚪/🟠 · signature ⚪.

### 5. hud_9886a  (map 15 fields)  — **entirely blank**
Resolver `resolveHud9886a` (l.179) emits `hoh_name`, `address`, `ssn`, `dob`, `signature_rows[]`.
Map has **no `hoh_name` placement** (C) and expects `hoh_ssn` not `ssn` (B). → blank.
- name 🟠 (C) · ssn 🟠 (B) · address 🟠 (A) · signatures ⚪.

### 6. obligations_of_family  (map 5 fields)
Resolver `resolveObligationsOfFamily` (l.258) emits `hoh_printed_name`, `address`, `phone`. Map expects
`hoh_name`, `hoh_address`, `hoh_phone` → **(B) mismatch**; address also (A).
- hoh_name 🟠 · hoh_phone 🟠 (data exists) · hoh_address 🟠 · signature ⚪.

### 7. citizenship_declaration  — ✅ **CORRECT**
Resolver `resolveCitizenshipDeclaration` (l.239) + v3 map. Names, DOB, citizenship status render for
all members (fixed earlier). Proof: `_pbv-review/renders/{mia,san}_citizenship_v3_p1.png`. Signature ⚪.

### 8. briefing_cert  (map 3) — name ✅
`resolveBriefingCert` emits `hoh_printed_name` = map key. Name renders; signature ⚪. Form needs only that.

### 9. debts_owed_phas  (map 3) — name ✅
Routes to `resolveSimpleAffidavit` → emits `printed_name` = map key. Name renders; signature ⚪. Form is a
notice + signature, so this is essentially complete.

### 10. eiv_guide_receipt  (map 2) — signature only ⚪
`resolveEivGuideReceipt` emits signature/date; map places only those. Form is an acknowledgement — OK.

### 11. no_child_support_affidavit  (map 6)  — **blank**
Routes to `resolveSimpleAffidavit` (emits `printed_name`); map expects `affiant_name`, `affiant_address`,
`affiant_zip`, `children_names` → **(B) mismatch + (E)**.
- affiant_name 🟠 (member name; mismatch) · affiant_address/zip 🟠/🔴 · children_names 🟠 (Santha) / ⚪ (Mia) · signature ⚪.

### 12. child_support_affidavit  (map 8) — conditional, not generated for these two
Same resolver/key-mismatch pattern as #11, plus `amount_weekly`/`amount_monthly` 🔴 not collected.

---

## Consolidated 🔴 NOT-COLLECTED list (needs Alex's ruling — next phase)
1. **Income Source / employer name** — main_application income table "Source" column.
2. **Criminal previous address** — criminal_background_release.
3. **Per-asset detail** — asset table wants Family Member + Source (institution) + Market Value per asset;
   intake collects only yes/no per type + one total.
4. **Itemized household expenses** — form has ~16 lines + "who pays"; intake collects 5 coarse buckets,
   and only for zero-income households.
5. **Child-support amounts** (weekly/monthly) — child_support_affidavit (conditional).
6. **Emergency/additional contact** (hud_92006) — partially uncollected (alt contact name/phone exist; address/email/relationship don't).

Everything else flagged 🟠 is **recoverable from data we already hold** — it needs code/map fixes, not re-collection.

---

## Fix surface (preview for the next phase — NOT done here)
- **(A)** Replace the fake `IntakeData` in `field-mapping.ts` with the real `intake-schema.ts` types; read
  `contact`, `income.by_member`, `household.race/…`, and pull address from the application row.
- **(B)** Reconcile every map field-name with resolver output keys (one source of truth for keys).
- **(C)** Add the missing placements (adults checkboxes, race/ethnicity/marital, Yes/No boxes, hud_9886a name).
- **(D)** Alex rules per gap: add to intake & re-collect / staff-fill at review / accept blank.
- **Guardrail:** add a data-coverage assertion to generation so a required field resolving blank **fails**
  instead of silently shipping. (This is the check that was missing and let all of this through.)

---

## STATUS UPDATE — (A)+(B) fixed & verified (2026-05-31)
Code fixes landed in `lib/pbv/form-generation/field-mapping.ts` + `generate-forms/route.ts`,
verified by `lib/pbv/__tests__/field-mapping.test.ts` (12 tests, real data shape) **and** an
end-to-end local stamp of Mia's real data through the actual stamper + maps + source PDFs
(`_pbv-review/rescan/fixed_*.pdf`, rendered & eyeballed).

**Now filling correctly (were blank):**
- main_application: Email, Cell, Address (contact block) ✅
- hach_release: Name + Address ✅ (was 100% blank)
- obligations_of_family: Name + Phone + Address ✅ (was blank)
- hud_92006: Name + Mailing address + Telephone ✅
- hud_9886a: HOH SSN ✅ (was blank)
- criminal_background_release: current address (street+apt) ✅
- no_child_support_affidavit: Affiant name + children list ✅ (was blank)

**Still REQUIRES (C) — new map placements (coordinate authoring), NOT done yet:**
1. **Income table** (main_application) — must place each income TYPE on its specific labeled row
   (Employed/SSI/SS/…). Resolver intentionally emits `income_rows: []` until per-type row
   coordinates exist (sequential fill would mislabel income type — worse than blank). **Top priority.**
2. **Adults table** Disabled / Student / U.S. Citizen columns (map has only 7 of 10 cols).
3. **Race / Ethnicity / Marital status** checkboxes (no placements; data in snapshot.household).
4. **Yes/No checkboxes** throughout (assets, criminal, DV, school full-time).
5. ~~**hud_9886a name** placement~~ — **CORRECTED (Phase 1):** the HUD-9886A form has
   **no printed-name field**. The filled HUD reference (`hud-9886a-en-filled.pdf`) is
   completed with HOH SSN + dates + signatures only; each signature line has a printed
   caption ("Head of Household", "Spouse", …) and the signer signs on the line. The
   "(C) name placement" was an audit assumption ground truth contradicts. The (B) SSN
   fix already makes this form complete (verified: Mia `XXX-XX-7407` on the SSN line).
   The resolver still emits `hoh_name` (harmless/unused).
6. **Address City/State/Zip** — needs a data source (not stored separately) AND the value.

**Still REQUIRES (D) — Alex's ruling** (the 6 NOT-COLLECTED gaps listed above).

## Verification of this audit
- Every 🟠 cites the value present in members/snapshot/row but absent in the rendered text layer.
- Mechanism confirmed by reading all 11 resolvers (`field-mapping.ts`), all 12 EN maps
  (`scripts/field-maps/*.json` incl. `row_patterns`), the generate-forms route seam (`route.ts:59,66-73`),
  and rendering Mia's stored PDFs (`_pbv-review/rescan/`, `_pbv-review/renders/`).
- No file under `lib/`, `app/`, `scripts/`, `supabase/` was modified.
