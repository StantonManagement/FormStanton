# Windsurf Build Prompt — PRD-63: Fail-Closed Generation Defaults

**Batch run:** read `docs/fullApp-Plan/BATCH-RUN-PROTOCOL.md` first — it governs branch, decision-handling (default-and-log, never stop to ask), prod-migration safety, and static-vs-deferred gates for this whole batch.

Build from `docs/fullApp-Plan/63-pbv-failclosed-generation-defaults_prd_2026-05-21.md`. Read it next.

Two generation paths fail **open**: `shouldGenerateForm`'s `default:` returns `true` for an unknown `conditional_rule` (audit #7), and `resolveFieldData`'s `default:` returns a generic single-signature resolver for an unknown `form_id` (audit #14). Together they let a typo'd or newly-added template row generate unconditionally and stamp a half-mapped PDF nobody validated. This PRD flips both to **fail-closed** and extends the PRD-55 completeness guard to catch the regression. Small, focused — do **not** touch signing, documents, or intake.

---

## Branch / commit (per batch protocol)

- Work on `feat/pbv-launch-hardening` (created in PRD-62 off `feat/pbv-full-finalization` or `main`). Do **not** create a per-PRD branch.
- One commit when done: `PRD-63: fail-closed generation defaults`. **Push after commit.**

## Shell + DB

- Type-check with `node ./node_modules/typescript/bin/tsc --noEmit`, never `npx tsc` (hangs on Windows). See `docs/SHELL-PROTOCOL.md`.
- **No migration expected** — these are code-default changes. If the rule-coverage test needs the live set of `conditional_rule` values, query `pbv_form_templates` **read-only**. Never write/migrate.

---

## What's broken (confirmed in code 2026-05-21)

1. `lib/pbv/conditional-rules.ts:115-118` — `default:` warns + `return true`. Header docstring at `:11` even states "fail open." Eight known rules are handled at `:98-114`.
2. `lib/pbv/form-generation/field-mapping.ts:384-385` — `default:` → `resolveSingleSignature(...)` for any unknown `form_id`.
3. `app/api/t/[token]/pbv-full-app/generate-forms/route.ts:86-90` — skip-reason enum is `'source_pdf_missing' | 'field_map_missing' | 'conditional_skipped'`. The route turns a `false` from `shouldGenerateForm` into `conditional_skipped` at `:94-103`; it calls `resolveFieldData` at `:125` before loading the field map and never expects it to throw.

---

## Step-by-step

### Step 1 — Fail-closed `shouldGenerateForm` (#7)
In `lib/pbv/conditional-rules.ts`, change the `default:` (`:115-118`) to log an **error** (`console.error`) with the offending rule string and `return false`. Update the header docstring (`:11`) so it states the new fail-closed behavior. Export a way for the route to tell "unknown rule" from "known rule, evaluated false" — e.g. a `KNOWN_CONDITIONAL_RULES` set or an `isKnownConditionalRule(rule: string | null): boolean` helper covering the eight cases at `:98-114`.

### Step 2 — Surface `unknown_conditional_rule` (#7)
In `generate-forms/route.ts`, add `'unknown_conditional_rule'` to the skip-reason enum (`:86-90`). At the `shouldGenerateForm` branch (`:94-103`), when the rule is non-null and not known, push `{ form_id, reason: 'unknown_conditional_rule' }` instead of `conditional_skipped`. A known rule that evaluates false stays `conditional_skipped`.

### Step 3 — Fail-closed `resolveFieldData` (#14)
In `field-mapping.ts`, replace the `default:` (`:384-385`) so it does **not** return `resolveSingleSignature`. Throw a recognizable error: `throw new Error(\`resolver_missing:${formId}\`)`. In `generate-forms/route.ts`, add `'resolver_missing'` to the enum, and wrap the `resolveFieldData` call (`:125`) so a thrown `resolver_missing` is caught → `console.error` + `skipped.push({ form_id, language, reason: 'resolver_missing' })` + `continue`, mirroring the existing `source_pdf_missing` / `field_map_missing` skip-and-continue shape at `:118-133`.

### Step 4 — Extend the completeness guard (merge, don't overwrite)
Extend `lib/pbv/form-generation/__tests__/form-generation-completeness.test.ts` with:
- **Rule coverage:** assert every distinct `conditional_rule` used by enabled templates is handled by `shouldGenerateForm` — i.e. an unknown rule resolves to `false`, not `true`. Derive the rule set from a read-only `pbv_form_templates` query if wired in, else from the Step-1 known-rules export plus `ALL_REQUIRED_FORMS`. Add a regression case: a bogus rule string (e.g. `'__bogus_rule__'`) returns `false`.
- **No resolver fall-through:** assert `resolveFieldData('__unknown_form__', mockIntake, mockMembers, 'en', 1)` **throws** (today the default makes this pass too easily). Keep the existing "handles all required form_ids" test green.

**Coordination — PRD-62 touches this same file.** PRD-62 adds finalize-hash assertions here. **Merge** your additions with whatever PRD-62 left; do **not** overwrite the file. If PRD-62's additions aren't present (run order skipped it), add only the PRD-63 cases and note it in the build report.

### Step 5 — Static gates + build report + commit + push
`node ./node_modules/typescript/bin/tsc --noEmit` then `npm run build`, both clean; the extended completeness guard green. Build report at `docs/build-reports/63-pbv-failclosed-generation-defaults_build-report_2026-05-21.md`. Commit `PRD-63: fail-closed generation defaults`, then **push**. Then proceed to the PRD-64 prompt.

---

## Files to modify

| File | Change |
|---|---|
| `lib/pbv/conditional-rules.ts` | `default:` → `console.error` + `return false`; update header docstring; export `isKnownConditionalRule` / `KNOWN_CONDITIONAL_RULES` |
| `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` | extend skip-reason enum; push `unknown_conditional_rule` for unknown rules; catch `resolver_missing` from `resolveFieldData` → skip + continue |
| `lib/pbv/form-generation/field-mapping.ts` | `default:` → `throw new Error('resolver_missing:'+formId)` instead of `resolveSingleSignature` |
| `lib/pbv/form-generation/__tests__/form-generation-completeness.test.ts` | rule-coverage + no-resolver-fall-through assertions; **merge** with PRD-62's additions |

## Files NOT to touch

- The eight conditional-rule predicates in `conditional-rules.ts` (`:18-62`) — only the `default:` + docstring change.
- Signing flow, summary doc, document upload/categorization, intake.
- Source PDFs, field-map JSON, `pbv_form_templates` rows / migrations (PRD-55 / PRD-55b territory).
- `.git/config` — it is fine, don't touch it.

---

## Verification gates (per PRD-63)

**Static (must pass in-session before commit — all of PRD-63 is static):**
- **Gate 1:** `shouldGenerateForm('__bogus_rule__', {}, [])` → `false` + error log; the eight known rules unchanged.
- **Gate 3:** `resolveFieldData('__unknown_form__', …)` throws; route converts to `skipped[]` `reason: 'resolver_missing'`.
- **Gate 4:** extended completeness guard green, and bites when the old fail-open behavior is expected.
- **Gate 5:** `tsc --noEmit` + `npm run build` clean.

**Deferred to the post-run verification pass (list in build report, do NOT block):**
- **Gate 2:** a live template with an unknown `conditional_rule` shows up as `unknown_conditional_rule` in the `generate-forms` response body (needs a deploy + a token with such a template). Verify statically; defer the runtime walk.

---

## What "done" looks like

1. `PRD-63: fail-closed generation defaults` committed on `feat/pbv-launch-hardening` and **pushed**.
2. Both `default:` cases fail closed; both new skip reasons surfaced.
3. Completeness guard extended (merged with PRD-62's additions), green, and proven to bite.
4. Static gates green; build report written with deferred Gate 2 listed. Proceed to the PRD-64 prompt.

## What NOT to do

- **Do not stop to ask** — default-and-log per the batch protocol.
- Do not change the conditional-rule predicate logic, only the `default:` + docstring.
- Do not overwrite the completeness test — merge with PRD-62's additions.
- Do not write or apply any DB migration. Read-only on `pbv_form_templates` if the coverage test needs it.
- Do not use `npx tsc`. Do not "fix" `.git/config`. Do not touch signing/documents/intake.
- Do not block on the deploy-only Gate 2 — defer it to the build report.

## Reporting back (in the build report)

- Commit SHA + push confirmation.
- The two `default:` changes (file:line) and the two new skip reasons.
- Completeness-guard additions + how they were merged with PRD-62's.
- Confirmation no migration was written; any read-only query used.
- Deferred runtime Gate 2 for the post-run pass.
