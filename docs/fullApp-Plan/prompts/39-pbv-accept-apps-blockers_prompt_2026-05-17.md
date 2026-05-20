# Prompt — PRD-39: Accept-Applications Blockers

**Date:** 2026-05-17
**Pairs with:** `docs/fullApp-Plan/39-pbv-accept-apps-blockers_prd_2026-05-17.md`
**Target branch:** `feat/pbv-accept-apps-blockers-39`

---

## Read first

1. The PRD: `docs/fullApp-Plan/39-pbv-accept-apps-blockers_prd_2026-05-17.md`
2. The audit doc with full defect evidence: `tasks/OVERNIGHT_WALKTHROUGH_2026-05-17.md`
3. The specific files called out by each F-section below — don't read other files unless investigation requires it

---

## What you're building

Four fixes to unblock end-to-end accept-applications:

1. **F1** — One-line fix in `/sign/summary` redirect guard (wrong field name)
2. **F4** — Income annual computation in the intake-complete bridge
3. **F3** — Add desktop PDF upload path to tenant document UI
4. **F2** — Fix admin Upload buttons that do nothing on click

Total target: 1 day if F2 investigation goes smoothly.

---

## Order of operations — IMPORTANT

Do them in this order: **F1 → F4 → F3 → F2**

Rationale: F1 is the cheapest unblock (one line) and lets you actually drive the rest of the signing flow during testing. F4 is the next safest (read-side computation, no UI). F3 builds new tenant UI but doesn't depend on anything. F2 is the most likely to surface unknowns — do it last so the rest of the PRD is locked in if F2 needs to split.

---

## Step 1 — F1 — /sign/summary redirect

**File:** `app/pbv-full-app/[token]/sign/summary/page.tsx:53-57`

**Replace this block:**
```ts
// If intake not complete (no signing_status), can't generate yet
if (!data.signing_status || data.signing_status === 'not_started') {
  router.push(`/pbv-full-app/${token}/dashboard`);
  return;
}
```

**With:**
```ts
// If intake not complete, can't generate forms yet
if (data.intake_status !== 'complete') {
  router.push(`/pbv-full-app/${token}/dashboard`);
  return;
}
```

**Verification:** Use a tenant with `intake_status = 'complete'` (e.g., Maria Test Tenant at token `110-martin-unit-1-f39817020e324160b5dae3b5f4c48633`). Navigate to `/pbv-full-app/<token>/sign/summary`. Expect the SummaryDocReviewSign component to render (may briefly show "Preparing your application summary..." while generate-forms runs).

**Edge cases to mentally check:**
- What if `data.intake_status` is null/undefined? Treat as "not complete" → redirect. The `!==` comparison handles this naturally.
- What if a user lands here with `intake_status = 'in_progress'`? Redirect to dashboard, where the Start button will guide them through intake first.

---

## Step 2 — F4 — Income annual computation in bridge

**Files:**
- `app/api/t/[token]/pbv-full-app/intake/complete/route.ts` — primary fix
- Wherever `buildSummary` computes annual — secondary, for the Review page
- `app/pbv-full-app/[token]/print/page.tsx` — tertiary, for print view

**Step 2a — Bridge fix:**

Inside `bridgeIntakeToDatabase` in `intake/complete/route.ts`, change the member row construction. Currently it reads `annual_income: memberIncome?.annual_income ?? 0` which is always 0 because the intake form doesn't populate that field.

Compute from monthly amounts on income sources. The income_sources structure (from the intake form) looks like:
```ts
{ type: 'employment', has_income: true, monthly_amount: 10000 }
```

Replace the `annual_income` assignment with:
```ts
const annualIncome = (memberIncome?.income_sources ?? [])
  .filter(src => src.has_income && typeof src.monthly_amount === 'number')
  .reduce((sum, src) => sum + (src.monthly_amount * 12), 0);
```

Then `annual_income: annualIncome` in the member row insert.

**The existing `total_annual_income` computation at ~line 214** already sums member rows, so it'll automatically pick up the corrected values — no separate change needed there.

**Step 2b — Summary builder fix:**

Find the file that builds the Review summary's income section. Likely `lib/pbv/buildSummary.ts` or similar. The Review page currently shows "Annual total $0/yr" — fix the same monthly*12 calculation there. The structure read from `intake_data.income.by_member` is the same as the bridge sees.

**Step 2c — Print view fix:**

`app/pbv-full-app/[token]/print/page.tsx` displays "Annual total $0/yr" too. Apply the same fix — read from `intake_snapshot.income.by_member`, compute monthly*12, render.

**Verification:** After all three places fixed, the test tenant Maria (already in DB with $10,000/mo wages) should show:
- Review summary at `/pbv-full-app/<token>/intake/review`: "Annual total $120,000/yr"
- Print view at `/pbv-full-app/<token>/print`: "Annual total $120,000/yr"
- Admin detail at `/admin/pbv/full-applications/<id>`: "Claimed $120,000"

**Note:** Maria's existing DB row has `annual_income = 0` from her earlier submission (pre-fix). The bridge only runs on `/intake/complete`, which is one-shot due to PRD-32 F2 behavior. Two options to repair her row:
1. SQL update to recompute her annual_income directly
2. Create a fresh test tenant with a fresh token

Pick whichever's faster. Note in the build report which path you chose.

---

## Step 3 — F3 — Desktop PDF upload path

**File:** `components/pbv/TenantDocumentUpload.tsx`

**Current state:** Renders `DocumentScanner` (camera flow only) when the user clicks Upload. The only file input on the page has `accept="image/*,.heic,.heif" capture="environment"`.

**Change:**

1. Add a second hidden file input next to the scanner's, with `accept="application/pdf,image/*,.heic,.heif"` and NO `capture` attribute. Reference it via a ref.

2. Replace the single "Upload" button with two buttons (or one split-button pattern that matches the existing Stanton UI style):
   - "Scan with camera" — triggers the existing DocumentScanner flow (mobile-friendly)
   - "Upload file" — triggers `fileInputRef.current.click()` on the new input

3. The new file input's `onChange` handler: take the selected file, POST it to the same upload endpoint the scanner uses. Look at the scanner's existing upload code in `DocumentScanner.tsx` to find the endpoint and request shape — reuse it directly.

4. Translations: en/es/pt strings for both button labels. Match the existing translation pattern in the file.

5. On both desktop and mobile, both buttons remain visible. The "Upload file" button on mobile opens the OS file picker (photo library / files app) instead of the camera, which is what we want for users who already have a scan saved.

**Test file:** Use `tests/fixtures/sample-paystub.pdf` (already exists in the repo).

**Verification:**
- On a desktop browser, click "Upload file" next to any document on `/pbv-full-app/<token>/documents`, pick the sample paystub PDF. The doc row's status flips to indicate uploaded.
- The existing camera-scan flow still works (don't break it).
- The page header copy "Accepted: JPEG, PNG, PDF, HEIC" is now backed by reality.

---

## Step 4 — F2 — Admin Upload buttons

**Investigation first.** Don't write a fix until you understand why the buttons are silent.

**Files to read:**
- `app/admin/pbv/full-applications/[id]/page.tsx` — find where Upload buttons are rendered
- `components/review/UploadDialog.tsx` — exists in the codebase, may be the intended modal that's never opened
- Whatever component wraps the doc-row list (search the admin detail page for "Upload" or `<button>` mapping over docs)

**Symptoms recap from the audit:**
- Click registers (snapshot shows the click event)
- Zero file inputs appear in the DOM after click (`document.querySelectorAll('input[type="file"]')` returns empty)
- Zero modals/dialogs appear (`[role="dialog"]`, `dialog`, `.modal` all empty)
- Zero console errors

**Likely diagnoses, in order of probability:**

1. **Missing onClick handler.** The Upload button is rendered but the handler that opens UploadDialog is missing or never wired. Search for the button's JSX and check whether it has an `onClick` that sets state.

2. **Modal state never toggles.** Handler exists but the state it sets (e.g., `setUploadOpen(true)`) doesn't trigger UploadDialog to render. Check the state-to-render path.

3. **UploadDialog renders in a portal that's mounted outside the page.** Check how UploadDialog is rendered — if it uses `createPortal`, verify the target exists.

4. **UploadDialog component itself is broken.** Render it independently with mock props to confirm.

**Fix:** Whatever the cause, the result should be: clicking Upload opens a working file picker (modal or inline) that accepts at minimum `application/pdf,image/*,.heic,.heif`. Selecting a file uploads it via the existing admin upload route (`app/api/admin/applications/.../documents/upload/...` or similar — find by grep).

**Verification:** Click Upload on any doc row in `/admin/pbv/full-applications/<id>`, pick the sample paystub PDF, confirm the row's "Missing" status changes. Then refresh the tenant `/print` view and confirm the doc no longer shows "Uploaded: <today>" for that row (this incidentally tests Defect #10's existence too, but Defect #10 is out of scope for PRD-39).

---

## Step 5 — End-to-end re-verification

After F1-F4 land, walk the flow:

1. Pick a test tenant. If Maria was used, repair her annual_income via SQL (see Step 2 note) OR provision a fresh token.
2. From tenant side: complete intake → reach dashboard → click "Review and sign your summary → Start" → confirm /sign/summary now renders → sign the summary → confirm transition to forms signing
3. Go to /documents → click "Upload file" on any doc → upload sample-paystub.pdf → confirm status change
4. Log into Stanton admin → open the application → click Upload on any doc → upload sample-paystub.pdf → confirm status change
5. From admin, click View on one of the uploaded docs → confirm PRD-35's DocumentViewer fix works (this was untestable before PRD-39 because nothing was uploaded)
6. Verify income annual shows correctly in three places: Review summary, /print view, admin claimed column

Add a "Re-verification 2026-05-17 (PRD-39)" section to `tasks/OVERNIGHT_WALKTHROUGH_2026-05-17.md` capturing what's now resolved and what surfaces if anything unexpected.

---

## What to deliver

- Branch `feat/pbv-accept-apps-blockers-39` with the four fixes
- Build report at `docs/build-reports/39-pbv-accept-apps-blockers-build-report_2026-05-17.md` with the standard shape
- Status header update on PRD-39 itself from "Draft" to "Shipped 2026-05-17"
- Re-verification section appended to the OVERNIGHT_WALKTHROUGH audit doc
- If F2 surfaced unknowns that warranted splitting into its own PRD, file a PRD-40 stub for F2 and ship PRD-39 without it (better to ship the unblocked subset than block the whole PRD on F2)

---

## Gotchas

- **F4 has the highest risk of side effects.** Changing how annual_income is computed in the bridge will retroactively affect any logic that reads annual_income (admin income review delta calculations, anything that compares claimed vs documented). Search for `annual_income` references before merging to make sure nothing breaks.
- **F2 may surface a bigger issue.** If the admin upload component was never finished, scope it as a separate PRD — don't force a fix into PRD-39.
- **Don't fix anything from the "Out of scope" list.** Defects #3, #4, #5, #6, #7, #10, #11 and HACH stay queued for PRD-40. Resist the urge to "just fix this while I'm in the file."
- **Test fixture exists:** `tests/fixtures/sample-paystub.pdf` — use it for all upload verification.

---

## When something is ambiguous

Stop and ask. Specifically:
- If F1's one-line change breaks any existing behavior you can identify, escalate before committing.
- If F4's bridge change causes existing applications' annual_income to look wrong, capture the migration question (do we backfill existing rows or leave them?) and ask before deciding.
- If F2's investigation reveals more than one missing piece, list them all and ask whether to fix in PRD-39 or split.
- If the test fixture's paystub PDF doesn't match what the upload validators expect (e.g., MIME type mismatch), say so rather than picking a different fixture silently.
