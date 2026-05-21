# PRD-63 — Fail-Closed Generation Defaults

**Date:** 2026-05-21
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-launch-hardening` (created in PRD-62 off `feat/pbv-full-finalization` or `main`)
**Status:** Draft — ready for build
**Severity:** Data-integrity — silent over-generation stamps wrong data on a form that should never have applied. This is the inverse of the silent-skip bug PRD-55 killed.
**Source:** `docs/audits/pbv-full-app-code-and-workflow-audit_2026-05-21.md` — findings **#7** and **#14**.
**Depends on:** PRD-62 (creates `feat/pbv-launch-hardening`; also extends the same completeness guard test — see coordination note).
**Scope:** code-default changes only. No schema/migration. Does **not** touch signing, documents, or intake.

---

## Problem Statement

Two generation paths fail **open** — when they hit an input they don't recognize, they produce a form anyway rather than declining:

- **#7 — `shouldGenerateForm` fails open on an unknown `conditional_rule`.** The `default:` case of the switch returns `true` and emits a `console.warn`. A typo in `pbv_form_templates.conditional_rule`, or a new rule string added to the DB without a matching code branch, causes the gated form to **always generate** — silently. The warn goes to server logs no one watches.
- **#14 — `resolveFieldData` falls through to `resolveSingleSignature` for an unknown `form_id`.** An unrecognized template row gets stamped with a generic name+date resolver that doesn't know the form's real fields. Combined with #7, a typo'd/new template row generates unconditionally **and** is stamped as a half-mapped PDF nobody validated.

PRD-55 went after silently-skipped forms (a missing legal document). Silent over-generation is the same failure shape inverted: a form that's gated on an unknown rule is more dangerous when generated than when skipped, because it can stamp wrong data on a form that should never have applied (e.g. a `child_support_affidavit` for a household with no child support). The safer default for both paths is **fail-closed**: don't generate, log an error, surface a reason.

---

## Root cause / findings (confirmed in code 2026-05-21)

### #7 — `shouldGenerateForm` default returns `true`

`lib/pbv/conditional-rules.ts:115-118`:

```ts
default:
  console.warn(`[conditional-rules] Unknown conditional_rule: "${conditionalRule}" — defaulting to true`);
  return true;
```

The file header docstring (`lib/pbv/conditional-rules.ts:11`) even states the intent: *"Unknown rules → true (fail open, generate the form)."* All eight known rules are handled (`q8_dv_yes`, `q10_reasonable_accommodation_yes`, `section_iii_zero_income_any_adult`, `household_has_child_support`, `household_no_child_support`, `household_has_self_employment`, `intake_has_pets`, `intake_has_vehicle`). Only the `default:` is wrong.

The caller (`app/api/t/[token]/pbv-full-app/generate-forms/route.ts:94-103`) already converts a `false` return into a skip with `reason: 'conditional_skipped'`. There is no distinct reason for "the rule string was unknown" — that case currently can't reach the skip path because it returns `true`.

### #14 — `resolveFieldData` default returns a generic resolver

`lib/pbv/form-generation/field-mapping.ts:384-385`:

```ts
default:
  return resolveSingleSignature(members, signerSlot, new Date().toLocaleDateString());
```

Every real form_id is handled explicitly (`main_application`, `hud_9886a`, `hach_release`, `hud_92006`, `citizenship_declaration`, `obligations_of_family`, the simple-affidavit group, `briefing_cert`, `criminal_background_release`, `eiv_guide_receipt`). The `default:` is a silent catch-all: an unknown id returns name+date fields (`resolveSingleSignature`, `field-mapping.ts:159`) and stamps onward. The caller (`generate-forms/route.ts:125`) invokes `resolveFieldData` *before* loading the field map and never expects it to throw.

### The skip-reason enum

`app/api/t/[token]/pbv-full-app/generate-forms/route.ts:86-90`:

```ts
const skipped: Array<{
  form_id: string;
  language?: string;
  reason: 'source_pdf_missing' | 'field_map_missing' | 'conditional_skipped';
}> = [];
```

PRD-55 added this enum (observability for skips). PRD-63 extends it with two new reasons: `unknown_conditional_rule` (#7) and `resolver_missing` (#14).

---

## Current state

| Item | Where | Notes |
|---|---|---|
| Fail-open conditional default | `lib/pbv/conditional-rules.ts:115-118` | `default:` warns + `return true` |
| Stale fail-open docstring | `lib/pbv/conditional-rules.ts:11` | "Unknown rules → true (fail open …)" — update to match new behavior |
| Fail-open resolver default | `lib/pbv/form-generation/field-mapping.ts:384-385` | `default:` → `resolveSingleSignature` |
| Skip-reason enum | `app/api/t/[token]/pbv-full-app/generate-forms/route.ts:86-90` | add `unknown_conditional_rule`, `resolver_missing` |
| `resolveFieldData` call site | `app/api/t/[token]/pbv-full-app/generate-forms/route.ts:125` | runs before field-map load; today never throws |
| Completeness guard test | `lib/pbv/form-generation/__tests__/form-generation-completeness.test.ts` | PRD-55 guard; extend (merge with PRD-62 additions — see coordination note) |
| Known conditional rules | `lib/pbv/conditional-rules.ts:98-114` | eight cases; switch is otherwise complete |

---

## Goals

1. `shouldGenerateForm` fails **closed**: an unknown `conditional_rule` returns `false`, logs an **error** (not warn), and the gated form is not generated.
2. `generate-forms` surfaces the unknown-rule case as a distinct skip reason `unknown_conditional_rule` (so a short packet is diagnosable from the response body, consistent with PRD-55's observability).
3. `resolveFieldData` fails **closed** for an unknown `form_id`: it does not return a generic default that half-stamps an unvalidated PDF. The form skips with reason `resolver_missing` (or `resolveFieldData` throws and the caller catches it into that skip reason).
4. The completeness guard test asserts (a) every distinct `conditional_rule` value present in `pbv_form_templates` is handled by the `shouldGenerateForm` switch — no fail-open; and (b) `resolveFieldData` has no silent fall-through for an unknown `form_id`.

## Non-goals

- No change to the conditional-rule *logic* (the eight predicates are correct; only the `default:` changes).
- No change to signing, summary-doc, document-upload, or intake.
- No schema/migration. These are code-default changes. [Inference] If the coverage test needs the live set of `conditional_rule` values, query `pbv_form_templates` **read-only** — do not write.
- No new federal form sourcing or template enable/disable changes (that was PRD-55 / PRD-55b).

---

## Implementation phases

### Phase 1 — Fail-closed `shouldGenerateForm` (#7)
- In `lib/pbv/conditional-rules.ts:115-118`, change the `default:` to log an **error** with the rule string and `return false`.
- Update the file-header docstring (`conditional-rules.ts:11`) so it no longer claims "fail open" — state the new behavior: unknown rule → `false` (fail closed), logged as error.
- In `app/api/t/[token]/pbv-full-app/generate-forms/route.ts`, distinguish the unknown-rule skip from a normal conditional skip. [Inference] Since `shouldGenerateForm` returns a plain boolean today, add a small companion (e.g. a known-rules set or an `isKnownConditionalRule(rule)` helper exported from `conditional-rules.ts`) so the route can push `reason: 'unknown_conditional_rule'` for an unknown rule vs `'conditional_skipped'` for a known rule that evaluated false. Add `unknown_conditional_rule` to the skip-reason enum at `route.ts:86-90`.

### Phase 2 — Fail-closed `resolveFieldData` (#14)
- In `lib/pbv/form-generation/field-mapping.ts:384-385`, replace the `default:` so it does **not** return `resolveSingleSignature`. Throw a typed/recognizable error (e.g. `throw new Error(\`resolver_missing:${formId}\`)`) for an unknown `form_id`.
- In `generate-forms/route.ts` around the `resolveFieldData` call (`route.ts:125`), wrap it so a thrown `resolver_missing` is caught and converted into `skipped.push({ form_id, language, reason: 'resolver_missing' })` + `continue`, mirroring the existing `source_pdf_missing` / `field_map_missing` skip shape (`route.ts:118-133`). Log an **error**. Add `resolver_missing` to the skip-reason enum.
- [Inference] Throw-and-catch is preferred over silently returning a sentinel so the failure can't be missed if a future caller forgets to check; the route is the one place that decides skip-vs-fail, and it already has a skip-and-continue idiom.

### Phase 3 — Extend the completeness guard test
- Extend `lib/pbv/form-generation/__tests__/form-generation-completeness.test.ts`:
  - **Coverage of conditional rules:** assert every distinct `conditional_rule` value used by enabled templates is handled by `shouldGenerateForm` (an unknown rule must now resolve to `false`, not `true`). [Inference] If a read-only query of `pbv_form_templates` is wired into the test, derive the set of rule strings from it; otherwise assert against the known-rules set exported in Phase 1 and the `ALL_REQUIRED_FORMS` list, and add a regression case that an obviously-bogus rule string returns `false`.
  - **No resolver fall-through:** assert `resolveFieldData('__unknown_form__', …)` **throws** (today the default makes it pass too easily). Keep the existing "handles all required form_ids" assertion green.
- **Coordination (PRD-62):** PRD-62 also extends this same test file (finalize-hash assertions). **Merge** the PRD-63 additions into whatever PRD-62 left — do not overwrite the file. If PRD-62's additions are absent (run order skipped it), add only the PRD-63 cases and note it in the build report.

---

## Verification / test plan

Static gates only — these are code-default changes; no deploy needed.

- **Gate 1 (#7 fail-closed):** `shouldGenerateForm('totally_made_up_rule', {}, [])` returns `false` and logs an error. The eight known rules still evaluate as before (no behavior change for valid rules).
- **Gate 2 (#7 observability):** in `generate-forms`, a template carrying an unknown `conditional_rule` produces a `skipped[]` entry with `reason: 'unknown_conditional_rule'`, not a generated form. [Verified statically — runtime walk deferred.]
- **Gate 3 (#14 fail-closed):** `resolveFieldData('__unknown_form__', mockIntake, mockMembers, 'en', 1)` throws; the route converts it to `skipped[]` with `reason: 'resolver_missing'`.
- **Gate 4 (coverage test):** the extended completeness guard is green and fails when a bogus rule string is expected to return `true`, or when `resolveFieldData` is expected not to throw on an unknown id (prove the guard bites).
- **Gate 5:** `node ./node_modules/typescript/bin/tsc --noEmit` and `npm run build` both clean.

---

## Open questions

- **O1:** [Unverified] Should the unknown-rule / resolver-missing skip be a hard 500 for an *enabled* template instead of a soft skip? Default taken in this PRD: soft skip with an error log + a reason in the response, matching PRD-55's skip-and-surface idiom (a single bad template shouldn't break generation of the rest of the packet). Reversible — escalate to 500 later if the operator wants generation to refuse to complete on any unknown template.

## Decisions

- **D1:** Both paths fail **closed**. A form gated on an unknown rule, or lacking a resolver, is not generated; the failure is logged as an error and surfaced as a skip reason. (Inverse of the PRD-55 silent-skip fix.)
- **D2:** No schema change. The set of valid `conditional_rule` strings lives in code (`conditional-rules.ts`); the test asserts code/DB agreement, it does not migrate the DB.

---

## Files expected to change

| File | Phase | Change |
|---|---|---|
| `lib/pbv/conditional-rules.ts` | 1 | `default:` → error + `return false`; update header docstring; export a known-rules check |
| `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` | 1, 2 | extend skip-reason enum (`unknown_conditional_rule`, `resolver_missing`); surface both reasons; catch `resolver_missing` from `resolveFieldData` |
| `lib/pbv/form-generation/field-mapping.ts` | 2 | `default:` → throw `resolver_missing:<formId>` instead of `resolveSingleSignature` |
| `lib/pbv/form-generation/__tests__/form-generation-completeness.test.ts` | 3 | add rule-coverage + no-resolver-fall-through assertions; **merge** with PRD-62's additions |

If anything outside this list needs changing, stop and report rather than expanding scope.
