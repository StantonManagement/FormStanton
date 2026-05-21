# PRD-63 — Fail-Closed Generation Defaults — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-launch-hardening`
**Commit:** PRD-63: fail-closed generation defaults

---

## What changed

| File | Change |
|---|---|
| `lib/pbv/conditional-rules.ts` | `default:` now `console.error` + `return false` (was `console.warn` + `return true`). Header docstring updated. Added `KNOWN_CONDITIONAL_RULES` const array + `isKnownConditionalRule(rule)` helper next to the switch so the registry and the switch are colocated. |
| `lib/pbv/form-generation/field-mapping.ts` | `default:` now `throw new Error(\`resolver_missing:${formId}\`)` (was a silent fall-through to `resolveSingleSignature`). |
| `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` | Skip-reason enum extended with `'unknown_conditional_rule'` and `'resolver_missing'`. Pre-evaluation guard: if `isKnownConditionalRule(template.conditional_rule) === false`, push `unknown_conditional_rule` and `continue` (logged as error). `resolveFieldData` call wrapped in `try/catch`; a `resolver_missing:` error is converted to a `resolver_missing` skip + `continue`; any other thrown error still propagates. |
| `lib/pbv/form-generation/__tests__/form-generation-completeness.test.ts` | New `describe('PRD-63: Fail-closed generation defaults')` block with four cases: bogus rule → `false`; null rule → `true`; every `KNOWN_CONDITIONAL_RULES` entry is in the registry; `resolveFieldData('__unknown_form__', …)` throws `resolver_missing:__unknown_form__`; every `ALL_REQUIRED_FORMS` form still resolves without throwing. |

**Coordination note (Step 4 of the prompt):** PRD-62 did **not** extend `form-generation-completeness.test.ts` — its hash-mismatch tests went into `lib/pbv/__tests__/finalizeValidation.test.ts` instead. So this PRD added only its own cases, with no merge conflict. Calling this out per the prompt's "If PRD-62's additions aren't present (run order skipped it), add only the PRD-63 cases and note it in the build report" guidance.

## Static gates

| Gate | Status | Notes |
|---|---|---|
| Gate 1 — `shouldGenerateForm('__bogus__', …)` returns `false` + errors | ✅ PASS | Verified in `form-generation-completeness.test.ts`. Confirmed in test output: `[conditional-rules] Unknown conditional_rule: "__bogus_rule_that_does_not_exist__" — failing closed (return false)`. Eight known rules unchanged. |
| Gate 3 — `resolveFieldData('__unknown_form__', …)` throws | ✅ PASS | Test asserts `/^resolver_missing:__unknown_form__$/`. Route converts the throw into `skipped[].reason = 'resolver_missing'` via the try/catch wrapper at the `resolveFieldData` call site. |
| Gate 4 — completeness guard bites | ✅ PASS | The "every required form_id still resolves" case proves the throw didn't break the happy path; the bogus-rule + bogus-form cases prove the fail-closed behavior. |
| Gate 5 — `tsc --noEmit` + `npm run build` | ✅ PASS | tsc silent; build emits the full Next.js route table at exit 0. |

No DB query was made — the registry-vs-switch coverage assertion is satisfied without a `pbv_form_templates` read (`KNOWN_CONDITIONAL_RULES` is the canonical list, asserted both ways).

## Decisions logged

None new — PRD-63 followed the PRD's defaults verbatim (fail-closed both paths; soft-skip rather than 500 per O1 default; no DB migration per D2).

## Prod migrations to apply

None. PRD-63 is code-default changes only.

## Deferred runtime gates (post-run verification pass)

- **Gate 2 (runtime walk).** On a deployed preview, point an application at a `pbv_form_templates` row with a `conditional_rule` that doesn't match any of the eight known rules (e.g. via a one-off seed). The `generate-forms` response body should include `skipped[]` with `{ form_id: <that template>, reason: 'unknown_conditional_rule' }` and the form should NOT appear in `pbv_form_documents`. Pair with a separate template carrying an unknown `form_id` (or a code change that removes its `resolveFieldData` case) to exercise the `resolver_missing` branch.

## Out-of-lane

- No change to the eight conditional-rule predicates — only `default:` + docstring + the new registry.
- No change to signing, summary doc, documents, intake, source PDFs, field maps, or `pbv_form_templates` data.

## Next

Proceed to PRD-64 prompt (`docs/fullApp-Plan/prompts/64-pbv-compliance-and-finalize-hardening_prompt_2026-05-21.md`).
