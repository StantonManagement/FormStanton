# Handoff — Tenant-Perspective Verification
**Date:** 2026-05-17
**For:** the next chat picking this up
**From:** Claude (this session)

---

## TL;DR — what to do first

**The new chat exists to do one thing: actually click through the tenant flow as if you were Maria Test Tenant hoping to get approved for housing, using chrome-devtools-mcp.** Not write PRDs. Not audit code. Click buttons, fill forms, hit submit, and report what an actual applicant experiences.

The first action: get a fresh `not_started` test token from Alex (or repair Maria's existing row), navigate to the magic-link URL in chrome-devtools, and walk it like a real applicant would.

The verification lens isn't "did the code work" — it's "would Maria finish this without calling Stanton for help, and does she feel like the app respects her time?"

---

## The lens — important

Don't verify like a QA engineer. Verify like a UX researcher watching Maria:

- **Tenant view is source of truth, admin view is diagnostic.** If something looks wrong in admin but right in the tenant view, the tenant view wins for pass/fail.
- **Friction counts as a defect, not just bugs.** Confusing copy, silent redirects, missing acknowledgment after submit, opaque doc names like "HUD-9886-A Authorization" — all logged as defects.
- **Score per step:** "Would Maria continue here?" and "Would Maria understand what's being asked?" Per-page rubric, not just per-route.
- **Emotional reassurance is functional.** PRD-36's ApplicationStatusBanner being missing isn't a polish issue — it's the difference between "I'm in the system, they got it" and "did anything even happen?"

---

## Current state

### PRDs shipped (mostly)

| PRD | What | Status |
|---|---|---|
| 33 | Intake flow fixes | Shipped + verified |
| 34 | Snapshot pattern | Shipped + verified |
| 35 | Multi-bucket DocumentViewer | Shipped (DocumentViewer click-through not yet verified — blocked by uploads not working end-to-end) |
| 36 | Application status banner | Shipped per code review BUT banner doesn't render on dashboard (Defect #3) |
| 37 | Tenant print view | Shipped + verified |
| 38 | Followups + docs cleanup | Shipped + verified |
| 39 | Accept-applications blockers | Shipped — F1/F3 UI/F4 code verified. F2 verified (my original Defect #8 was a false positive). F3 backend blocked by Defect #13. F4 admin column blocked by Maria's stale DB row. |

### PRDs queued

| PRD | What | Notes |
|---|---|---|
| 40 | Polish defects (#3, #5, #6, #7, #10, #11) + HACH portal data gap | Not written yet. Wait until #12 #13 resolved. |
| 41 | Tenant upload UX (hash dedup, drop-zone, help text, progress bar) | **Drafted, not for build yet.** See `docs/fullApp-Plan/41-pbv-tenant-upload-ux_prd_2026-05-17.md`. Has DO-NOT-START block until #12/#13 fixed. |

### Open defects (13 total)

**Tenant-flow blockers — fix before next walkthrough is meaningful:**
- **#12** `POST /api/t/.../generate-forms` returns 500 with empty body. Triggers when /sign/summary loads. Server-side stack trace needed.
- **#13** `POST /api/t/.../documents/.../upload` returns 500 `{"code":"upload_failed"}`. Outer catch at `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts:240`. Server-side stack trace needed.

**Data integrity (tenant-visible if you look at numbers):**
- **#2** Income annual = $0 in admin Claimed column for any application bridged before PRD-39 shipped. **Fix in code shipped; Maria's existing row needs SQL repair** (`UPDATE pbv_household_members SET annual_income = monthly_amount * 12 ...` or provision fresh test token).

**Tenant-trust defects (matter through tenant lens):**
- **#3** PRD-36 ApplicationStatusBanner doesn't render on `/dashboard` despite migration shipped. Maria has no "we got your submission" reassurance.
- **#4** Admin list (`/admin/pbv/full-applications`) shows "Invited" for Maria not "Intake Submitted." Staff visibility issue.
- **#5** Zero Income Declaration section appears in intake + Review for wage earners (should be hidden by visibility logic). Looks like a broken page mid-flow.
- **#6** Dashboard says "0 of 22 uploaded", documents page says "0 of 31 uploaded." Tenant thinks system is unreliable.
- **#7** Two "Submit my answers" buttons on Review page (one enabled, one disabled). Tenant unsure which to click.
- **#10** Print view shows "Uploaded: <today>" for missing docs. Tenant copy of their application lies.
- **#11** Silent redirects from `/sign/forms` and `/sign/additional-signers` when gated. Should explain why, not bounce.

**Code-review defects (resolved, included for completeness):**
- **#1** /sign/summary redirect — fixed in PRD-39 F1. Verified working.
- **#8** Admin Upload silent click — **false positive**, my measurement artifact. Dialog actually opens; chrome-devtools click + immediate snapshot was racing React re-render. Windsurf was right; do not relitigate.
- **#9** Tenant PDF upload missing — fixed in PRD-39 F3. UI verified, backend blocked by #13.

---

## Setup the new chat needs

### Dev server
Last known: `http://localhost:3000`. Confirm with Alex it's still up.

### Stanton admin creds
Email: `aks@stantoncap.com`
Password: ask Alex to paste it in chat — DO NOT put it in any file.

### Test application
- Tenant: Maria Test Tenant
- Token: `110-martin-unit-1-f39817020e324160b5dae3b5f4c48633`
- App ID: `6a43b66a-cc33-45b6-b18f-ca0276707736`
- Building: 110 Martin
- Unit: 1
- Current state: intake_status = complete, intake_data = {} (cleared), intake_snapshot populated. Annual income in DB is 0 (stale; pre-PRD-39 bridge).

**For the next walkthrough, prefer a fresh `not_started` token** — Maria's existing row has stale annual_income and is already post-submit. A fresh tenant tests the actual journey, not a half-baked replay.

### MCP — chrome-devtools-mcp configured
In `%APPDATA%\Claude\claude_desktop_config.json`. autoApprove list covers: take_snapshot, click, fill, fill_form, navigate_page, new_page, wait_for, press_key, list_console_messages, list_network_requests, list_pages, select_page, evaluate_script, take_screenshot, upload_file, get_network_request, get_console_message, handle_dialog, hover, type_text, close_page, emulate, resize_page. Plus `--isolated` arg to avoid orphan-Chrome lock conflicts.

If Cowork was restarted, you may need to load the schemas via ToolSearch in the new chat. Tools are listed in the system reminder as deferred.

### Test fixtures
Generated at `C:\CursorProjects\FormStanton\tests\fixtures\`. Includes:
- Three PDFs with **identical SHA-256** for dedup testing: `paystub-week1.pdf`, `paystub-week1-COPY.pdf`, `income-verification.pdf`
- Different-content variations: `paystub-week2.pdf`, `paystub-4weeks.pdf` (multi-page)
- Bank statements (checking, savings), SSI/TANF award letters
- ID images (JPG, PNG)
- Edge cases: `oversized-30mb.pdf` (tests size limit), `unsupported-document.txt` (tests MIME rejection), `empty.pdf` (minimal valid PDF)

Full list in PRD-41 (`docs/fullApp-Plan/41-pbv-tenant-upload-ux_prd_2026-05-17.md`).

---

## chrome-devtools-mcp gotchas — learned this session

1. **Click + immediate snapshot races React re-renders.** A `click` action followed immediately by `take_snapshot` may show pre-click DOM. The dialog (or other state-change effect) is happening but not captured. Solution: use `wait_for` with a text that should appear post-click, OR use `evaluate_script` to call `.click()` programmatically + `setTimeout` + query DOM. The element IS there — your snapshot just took it too early.
   - This caused me to falsely report Defect #8 (admin Upload silent click) in the original walkthrough.

2. **`upload_file` attaches the file to the hidden input but may not fire React's `onChange` handler.** The file shows in the dialog as "selected" but the upload button click later may not have the file in React state. If your upload doesn't fire the network request, that's why. Workaround: `evaluate_script` to manually `dispatchEvent(new Event('change', { bubbles: true }))` on the input after attaching.

3. **`--isolated` mode resets browser state between MCP launches.** Admin logins don't persist across Cowork restarts. Re-login each session.

4. **Orphan Chrome lock conflict:** if the previous chrome-devtools-mcp Chrome window is still alive when the new MCP server starts, you get "browser is already running for chrome-profile" error. Kill the orphan Chrome process in Task Manager. The `--isolated` flag in autoApprove config avoids this going forward, but if it recurs, that's the fix.

5. **Empty 500 response bodies hide the real error.** Both #12 and #13 returned 500 with `<empty>` or generic JSON. The actual stack trace is in the dev server terminal output. ASK ALEX to paste the dev-server log when this happens — don't try to infer from code alone.

---

## What to do — step by step for the new chat

1. **Confirm dev server up.** `http://localhost:3000` or whatever Alex tells you.
2. **Get a fresh `not_started` test token.** Ask Alex to provision one OR repair Maria's row via SQL.
3. **Load chrome-devtools-mcp tools** via ToolSearch if they're deferred (they usually are after a fresh Cowork start).
4. **Navigate** to the magic link `/pbv-full-app/<token>` and walk it as Maria:
   - Step through every intake section. Score each: would Maria continue? would she understand? does anything look broken or confusing?
   - Submit intake. Watch the dashboard transition.
   - Click "Review and sign your summary → Start." Verify Defect #12 is resolved (or note if 500 is still firing).
   - Click "Upload required documents → Start." Upload `paystub-week1.pdf` via "Upload file" button. Verify Defect #13 is resolved.
   - Once docs are uploadable: try the rest of the signing flow. Test additional-signers path.
   - Reach final submission.
5. **Capture per-step observations** in a tenant-perspective audit at `tasks/TENANT_JOURNEY_2026-05-XX.md` (date when you actually run it). Per step: screenshot, what Maria sees, what she'd think, what's broken or confusing.
6. **Final verdict:** "Would Maria reach final submission without calling Stanton?" Yes/no with evidence.

---

## What NOT to do in the new chat

- **Don't write PRDs without prompting.** PRD-40 (polish) and PRD-41 (upload UX) are already drafted. The next chat is for runtime testing, not paper.
- **Don't relitigate Defect #8.** Admin Upload buttons work. The "silent click" was my measurement artifact.
- **Don't ask Alex to do things he could see you doing.** If the dev server is up and chrome-devtools-mcp is loaded, just click — don't ask "should I navigate to X?" Click X.
- **Don't bail on the tenant lens** to inspect admin pages unless tenant-side surfaces an issue that needs admin context to diagnose.
- **Don't trust code review alone.** "It looks right in the code" doesn't beat "the click doesn't work in the browser." Same lesson from the false-positive Defect #8.

---

## Key file pointers

- This handoff: `tasks/HANDOFF_2026-05-17_tenant-verification.md`
- Original audit (with 11 defects + re-verification): `tasks/OVERNIGHT_WALKTHROUGH_2026-05-17.md`
- PRD-39 (just shipped, partial verification): `docs/fullApp-Plan/39-pbv-accept-apps-blockers_prd_2026-05-17.md`
- PRD-41 (tenant UX, drafted not for build): `docs/fullApp-Plan/41-pbv-tenant-upload-ux_prd_2026-05-17.md`
- PRD-39 build report: `docs/build-reports/39-pbv-accept-apps-blockers-build-report_2026-05-17.md`
- Test fixtures: `tests/fixtures/` (16 files, see PRD-41 for full inventory)
- Tenant intake page entry: `app/pbv-full-app/[token]/page.tsx`
- Tenant dashboard component: `components/pbv/sign/TenantDashboard.tsx`
- Tenant docs upload: `components/pbv/TenantDocumentUpload.tsx`
- Bridge (intake → DB): `app/api/t/[token]/pbv-full-app/intake/complete/route.ts`
- Generate-forms route (where Defect #12 fires): `app/api/t/[token]/pbv-full-app/generate-forms/route.ts`
- Tenant upload route (where Defect #13 fires): `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts`

---

## What I'm uncertain about for the new chat

- Whether Alex will repair Maria's annual_income or provision a fresh token. Either works. The new chat should ask first thing if it isn't already done.
- Whether Defects #12 and #13 have been investigated/fixed between sessions. If they haven't, the tenant walkthrough hits the same wall I did. Ask Alex for status.
- Whether HACH portal creds will be provided. They weren't in this session — the HACH side stays unverified.
- Whether the new chat will have chrome-devtools-mcp auto-approval working. Confirm by attempting a `take_snapshot` early; if a prompt fires, the autoApprove config didn't take and you need to address that before serious testing.

---

## Working style notes (carried forward from previous handoff)

- **Alex pushes back hard on shallow analysis.** "Just verifying the code looks right" is not enough. Click the button.
- **Don't punt runtime work back to Alex.** They have other repos. If you found the iceberg, you confirm it isn't there too.
- **Scope creep gets called out.** When Alex says "go," go. When they want to think, they'll say so.
- **Conversational tone in chat.** Tight responses. No big bullet lists unless explicitly asked.
- **.md unless explicitly requested otherwise.**
- **Acknowledge corrections fast and adjust.** When I was wrong about Defect #8, Alex was right. Don't dig in.
