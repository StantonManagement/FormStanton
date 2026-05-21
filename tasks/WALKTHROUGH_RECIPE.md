# Browser-Driven Walkthrough Recipe

A reusable approach for clicking through a web app end-to-end, catching defects that code review and unit tests miss. Drop this into any project's `tasks/` folder and hand it to a Claude session to run.

The premise: most defects this catches are not in the code that was changed — they're in the interaction surfaces (buttons, redirects, status fields, dialogs) that were never runtime-tested after the change shipped. Code-side PRDs ship clean; the UI silently bounces, the upload button does nothing, the status badge reads the wrong field. None of that shows up without a browser driving the flow.

---

## Prerequisites — collect before starting

Get these from the project owner. Don't start without them.

1. **Dev URL** (e.g. `http://localhost:3000`). Confirm the server is running and the build is current.
2. **Test account creds** for every role in the flow (e.g. admin + tenant, or buyer + seller + ops). Magic-link tokens, OAuth dummies, whichever.
3. **Test data identifier** — the specific tenant ID, order number, application token you'll walk through. Note it at the top of the report so re-runs are reproducible.
4. **PRDs / changes in scope.** Which recent code changes is this walkthrough meant to verify? Without this, the report has no shape.
5. **Known deferred items.** Things the owner already knows are broken or skipped (e.g. "HACH portal needs separate creds"). Don't waste cycles re-finding these.

If any of these are missing, ask once and wait. Walking through without them produces vague reports.

---

## Tools

Use `chrome-devtools-mcp` (or `Claude_in_Chrome` if devtools isn't available) for browser control. Key calls:

- `navigate_page` to load a URL
- `take_snapshot` to capture the DOM tree with element UIDs you can click
- `click` / `fill` / `fill_form` using those UIDs
- `list_console_messages` and `list_network_requests` for every page where something looks wrong
- `evaluate_script` for DOM queries the snapshot doesn't surface (e.g. `document.querySelectorAll('[role="dialog"]').length`)

**Always pair a click with a network/console check before deciding the click "did nothing."** A click that opens a modal via React state can race the next snapshot — the dialog mounts after your snapshot was captured. If a click looks silent: wait, snapshot again, AND check the network panel for the request that should have fired. Don't log a defect on a single snapshot.

---

## Methodology

### 1. Walk the happy path first

Pick the most common user journey end-to-end. Log into the test account, go through every page in the order a real user would. Don't skip ahead, don't deep-link past steps — the bugs are often in the transitions.

For each page:
- Snapshot the rendered state.
- Confirm what the PRD said this page should now show / do.
- Try the primary action (submit, upload, sign, pay). Watch the network tab — did the right request fire? What's the response code and body?
- If the page redirects somewhere, confirm the destination matches what's expected.

### 2. Capture defects inline as they happen

Don't wait until the end. Open the report file, paste the defect format below, fill it in. The cost of writing it now is 30 seconds; the cost of reconstructing it later is 10 minutes and you'll lose details.

### 3. Categorize as you go

Tag each defect:
- **BLOCKER** — stops the flow. User cannot complete the journey.
- **Data integrity** — flow completes but downstream calculation/display is wrong (e.g. annual income = 0).
- **Polish** — confusing UX, cosmetic, double buttons, stale labels.

If you find three blockers, stop walking after each one and try to find a workaround so you can continue exercising the rest of the flow. Note exactly what you skipped past.

### 4. Capture what you couldn't test

"Not tested" items are part of the report, not omissions. Each one needs a row with: what wasn't tested, why (which defect blocked it), and what would unblock it.

### 5. Re-verify after fixes

When the owner ships fixes, do a new walkthrough section in the same file (don't overwrite the original — the history matters). New defects often appear that were hiding behind the original blockers — once you can reach `/sign/summary`, you discover `/api/.../generate-forms` is also broken. Expect this. It's the pattern.

---

## Defect template

```markdown
### Defect #N — [BLOCKER/Data integrity/Polish]: short title

**Impact:** One sentence on what this breaks for the user.

**File:line:** path/to/file.tsx:lineN  (or "unknown — needs investigation")

**Code:**
```js
// the offending lines, copied exactly
```

**The bug:** What's actually wrong. The comment says X but the code checks Y. The route expects monthly but the form sends annual. Etc.

**Likely fix:** One concrete suggestion. Mark it `[inference]` if you didn't trace through to confirm.

**Why I didn't self-fix:** Logic change vs typo, side-effects unclear, etc. (Skip this line if you did self-fix.)

**Evidence:** Where you saw it (snapshot UID, console error, network response body). Include the exact error message if any.
```

Rules:
- **Self-fix only safe things.** Typos, obvious string mismatches, missing `await`. Anything that's a logic decision goes to the owner with a recommended fix, not a committed change.
- **Quote real code.** Open the file, copy the lines, paste them. No paraphrasing.
- **Label uncertainty.** If you're guessing at root cause, write `[inference]` or `[Speculation]`. Don't present hypotheses as facts.

---

## Report structure

Write the report as you go into a file like `tasks/WALKTHROUGH_<date>.md`. Use this skeleton:

```markdown
# Walkthrough — <date>

**Tester:** Claude (cowork session)
**Environment:** <URL>
**Test account / data:** <ids>
**Scope:** <PRDs or changes being verified>

## Verdict — <READY / NOT READY / specific blockers>

One paragraph. Lead with the bottom line. The owner reads this first and decides whether to keep reading.

## Verified working
Table: feature | how verified | evidence

## Defects surfaced
One section per defect using the template above.

## Not testable without additional setup
Table: what | why | what would unblock

## Open questions for <owner>
Numbered list. Each one is something you need a decision on before continuing.

## Files referenced
Paths to every file you cited in defects.
```

When fixes ship and you re-verify, append a new section:

```markdown
## Re-verification <date> (post <PRD/fix-id>)

### Verified working
### Still broken / new defects
### What this means
### Recommended next move
```

---

## Patterns to watch for

These showed up repeatedly in past walkthroughs. Check for them proactively on any new app:

1. **Silent redirects from gated pages.** A page checks a precondition, fails it, and `router.push('/home')` without showing why. Confirm every gated route renders a "you're here because X" message instead of bouncing.
2. **Status field mismatches.** Admin list shows status based on field A; detail page reads field B; intake bridge writes field C. Pick one and trace it from write → read across every surface.
3. **Buttons that "do nothing."** Usually one of: missing click handler, modal portal not mounted, React state race with your snapshot. Check console + network before deciding it's broken.
4. **Field name drift between form and API.** Form captures `monthly_amount`, route stores `annual_income`, derives 0. Spot-check that the value displayed downstream matches what you typed.
5. **Accept-attribute lies.** UI copy claims "PDF, JPEG, PNG" but the actual `<input accept="...">` excludes some of them. Inspect the input element on every upload surface.
6. **Storage buckets / external resources that don't exist.** If the dev DB was hand-set-up or a migration was missed, calls to S3 / Supabase Storage / external APIs 500 with "bucket not found" or similar. Check dev-server logs for the actual stack trace, not just the client-side error code.
7. **First-render abort errors.** React strict-mode double-renders cancel inflight `fetch` calls. If submit works on retry but not first click, this is probably it. Flag it; don't dismiss it.
8. **Backfill migrations that didn't run.** PRD adds a column with a backfill UPDATE; the column exists but every row's value is null because the UPDATE was scoped wrong. Query the table directly to confirm.
9. **Counts and labels diverge across surfaces.** Dashboard says "0 of 22"; documents page says "0 of 31". One counts required, the other counts all. Tiny but corrosive to user trust.
10. **i18n placeholder leakage.** Build report claims trilingual support; ES/PT keys exist but values are still English (or `[MISSING]`). Switch the locale and check.

---

## Escalation rules

Stop and ask the owner when:

- You found a logic change candidate that looks one-line but the original logic may have been intentional. (E.g. the `signing_status` guard from PRD-39 — looked wrong, but worth 60 seconds of owner review before merging.)
- The fix requires touching auth, payments, or anything with real-world side effects.
- You've found more than one blocker on the same surface and they may share a root cause — the owner should triage before you keep digging.
- The PRD itself looks underspecified for what you're testing. Don't invent acceptance criteria.

Don't stop for:

- Polish defects. Log them and keep walking.
- "Not testable" items unless they're the only thing left to verify.
- Console warnings that aren't tied to a user-visible symptom.

---

## Anti-patterns to avoid

- **Don't walk silently for 30 minutes then write one big report.** Write as you go. The owner can read the in-progress file too.
- **Don't claim a defect on a single snapshot.** Always pair clicks with network/console checks.
- **Don't fix things outside the scope of "obvious typo" without asking.** A walkthrough that turns into a refactor stops being verifiable.
- **Don't trust the build report.** PRDs ship marked "all four features implemented" while one of them silently doesn't render. That's literally what this walkthrough exists to catch.
- **Don't skip the "not tested" section.** It's the most important part for the owner planning the next round.

---

## PBV Finalization Acceptance (PRD-61 closeout)

Use this section to run the **deferred runtime gate** for the PBV full-app finalization batch (PRDs 55–61) after the batch is deployed.

### What this proves

The roadmap's "Definition of Done (the lane)":

> A real applicant can go from the SMS link to a complete, correct, submitted, signed packet — on their own phone, in their own language — without calling Stanton, and without hitting a tenant-safety defect.

Decomposes into seven criteria. Each row resolves to **fixed** (✅ in the cell), **OUT-OF-LANE** (logged separately), or **deferred** (re-run after the noted external dependency lands).

| # | Criterion | Owning PRD | Static proof (in tests) | Runtime proof (this section) |
|---|---|---|---|---|
| DoD-1 | Intake completable without confusing/unsafe defaults, EN/ES/PT | 57 | `tests/e2e/pbv-finalization-acceptance.spec.ts` step 1 (every profile reaches `generate-forms` from a seeded intake) | Walk intake on the deploy, each of EN/ES/PT, all three profiles — observe save/resume, defaults, no unsafe carry-forward |
| DoD-2 | Documents step asks only what answers imply, plain language | 58 | profile-driven `expected_forms` set per profile | Walk documents page in EN/ES/PT — required-doc set matches the intake answers |
| DoD-3 | Every required form generates, data stamped, no silent skips | 55 + 55b | acceptance spec step 1: generated set == fixture.expected_forms.generated; completeness guard 7/7 | Open a stamped form on the deploy (e.g. `criminal_background_release` or `main_application`), confirm fields populated; `skipped[]` contains only the four currently-disabled rows (pet/vehicle/self-emp/insurance/cd_trust — Alex deferred) |
| DoD-4 | One signature applies to every form the signer owns; additional adults sign | 56 | acceptance spec steps 2–3: ceremony grouping, `device_owner` correct, `collected ⊇ required` per form | Multi-adult walk on prod (Profile B/C analogue): HOH sign-all → spouse signs on same device |
| DoD-5 | Submit → locked → tenant downloads copy | 56 | acceptance spec step 4: `signing_status='complete'`, re-finalize returns 409 | Tap submit on the deploy, confirm packet download + lock holds |
| DoD-6 | All of the above works EN/ES/PT | 59 | — (content depends on deploy) | **DEFERRED — this section's matrix below** |
| DoD-7 | Scanner captures on real phones + tells tenant why when it can't | 60 | — (device matrix) | **DEFERRED — see PRD-60 build report** |

### Runtime walkthrough matrix (run on deploy of merged batch)

For each profile × language cell: do a Chrome DevTools observation pass on the deploy. Read the `/api/t/<token>/pbv-full-app/generate-forms` response body, check `generated[]` and `skipped[]`, then walk the UI through to submit.

|              | EN | ES | PT |
|---|---|---|---|
| Profile A — single adult, employment | ☐ | ☐ | ☐ |
| Profile B — 2 adults, additional signer | ☐ | ☐ | ☐ |
| Profile C — pet + vehicle + self-emp + child support | ☐ | ☐ | ☐ |

For each cell, capture:
- exact `generated[]` form_ids returned by `generate-forms`
- exact `skipped[]` entries with their skip reason strings
- any i18n placeholder leakage on intake / documents / summary / sign screens
- packet contents on download (file names + visual sanity check of one stamped form)

### Test tokens

- **Prod (read-only — do NOT submit destructively):**
  - `222-224-maple-ave-unit-2n-fa62844782fa4266b5cc1697bfbf734c` — 11/11 docs, clean happy path. Use for observing generate-forms + UI behavior, stop before submit.
  - `110-martin-unit-1-f39817020e324160b5dae3b5f4c48633` — 1/13 docs, partial state. Use for asserting intake gating + the documents step's "what's still needed" surface.
- **Preview (submit allowed):** spin up a fresh non-prod application via the staff approve-and-send flow, run the matrix end-to-end including submit. This is the only safe place to submit, per PRD-61 O2 default.

### Residual-defect log (PRD-61 closeout)

Each defect found in the matrix above logs here. **Fixed** = patched in this batch. **OUT-OF-LANE** = will not be fixed in this batch (out of scope or externally blocked). **Deferred** = will be fixed after a specific external dependency.

| # | Defect | Severity | Status | Notes / link |
|---|---|---|---|---|
| 1 | `pet_addendum` / `vehicle_addendum` / `self_employment_worksheet` generation disabled (no source PDFs) | Data integrity | **Deferred** | Alex confirmed 2026-05-21: keep deferred. Source PDFs from HACH → re-enable in a follow-up PRD. Conditional rules still fire (Profile C verifies inputs). |
| 2 | `insurance_settlement` / `cd_trust_bond` template rows possibly vestigial | Polish / data integrity | **Deferred** | Disabled in PRD-55b migration. Confirm with Alex whether to delete rows or source PDFs. |
| 3 | EN/ES/PT summary + consent prose may need translator polish | Polish | **OUT-OF-LANE** | Alex resolution 2026-05-21: ship best-effort, native review post-launch. |
| 4 | Scanner low-contrast hint threshold (3.5s) unverified on real devices | Polish | **Deferred** | PRD-60 D3; verify in the device-matrix walk. |
| 5 | Source-pending forms VAWA / Reasonable Accommodation / Zero-Income Statement | Data integrity | **OUT-OF-LANE** | Externally blocked per roadmap §Source-pending. Track separately. |
| 6 | `tenant_lookup` retroactive migration | Data integrity | **OUT-OF-LANE** | Staff/HACH side; outside the tenant lane. |
| 7 | Scanic detector swap (PRD-52) | Polish | **OUT-OF-LANE** | Engine-swap candidate; PRD-60 D5 — Scanic stays IN for v1. |
| 8 | _add row per defect found in the matrix above_ | | | |

### Acceptance signoff

The lane ships when:
1. The matrix above has no ☐ left (or every remaining ☐ has a logged residual defect with **OUT-OF-LANE** / **Deferred** + an owner).
2. No residual defect in the table above is severity **BLOCKER** with status **Open**.
3. The automated acceptance + integrity specs (`tests/e2e/pbv-finalization-acceptance*.spec.ts`) pass against the deployed preview build, or the gaps are tracked in the table above.

