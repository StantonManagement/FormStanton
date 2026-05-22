# Tenant Support Playbook — PBV Full-App Flow

**Audience:** Stanton staff handling phone/email tenant support during the
PBV full-application flow.
**Last updated:** 2026-05-21 (PRP-021 I4).

This document covers the top scenarios. For each: the **tenant symptom**,
the **most likely cause**, the **admin tool** to use, and the **resolution
steps**. If something doesn't match a scenario here, page #pbv-support.

---

## 1. "My link expired"

**Symptom:** the tenant clicked their magic link and saw "This link has
expired" (or "Unable to verify link").

**Cause:** `magic_link_expires_at` is in the past, OR the IP has been
locked out from too many invalid-token attempts (PRP-002).

**Resolution:**
1. Look up the application in Admin → PBV → Full Applications by
   tenant name or building/unit.
2. For the HOH: click **Regenerate tenant link** on the application
   detail page. Confirm with the tenant by phone the new link works.
3. For a household member (magic-link signer): click **Re-send signing
   link** on the Additional Signers panel. The previous link is
   invalidated and a fresh `magic_link_expires_at` is set.
4. If the failure is repeated and you see `signer-bootstrap-fail` log
   lines from the same IP, the tenant may be on a corporate VPN or
   shared network. The lockout window auto-expires after 10 minutes —
   ask them to retry after that window or use a different network.

---

## 2. "My packet is locked / under review"

**Symptom:** tenant sees "This packet is currently under review.
Please contact the Stanton office." (HTTP 409 `packet_locked`).

**Cause:** staff sent the packet to HACH review; `packet_locked = true`
on the application.

**Resolution:**
1. Open the application detail page.
2. If the lock is intentional (review is in progress), explain that the
   tenant cannot upload / edit / sign while review is active. ETA is
   typically 3–5 business days.
3. If the lock is wrong (e.g. accidentally clicked), use the **Reopen
   application** action to set `packet_locked = false`.
4. Audit-event row should appear in the timeline as
   `packet_unlocked_by_staff` for traceability.

---

## 3. "My document was rejected and I don't know why"

**Symptom:** tenant sees a red rejected-document card on the documents
page and doesn't know what to fix.

**Cause:** staff reviewed the doc and set `status='rejected'` with a
`rejection_reason` string. If the tenant doesn't see the reason in the
card, the reason field may be empty (data-entry slip).

**Resolution:**
1. Look up the application; open the **Documents** tab.
2. Find the rejected document; verify `rejection_reason` is populated.
   If empty, fill it now — the tenant card refreshes on next page load
   and shows the reason text.
3. Walk the tenant through re-uploading the corrected document. The
   upload route accepts JPEG/PNG/PDF/WebP/HEIC; magic-bytes validation
   means renamed files (e.g. screenshots saved as `.pdf`) will be
   rejected with 415.

---

## 4. "I can't see the Submit button"

**Symptom:** tenant on iPhone says the Submit / Sign button is missing
or off-screen.

**Cause:** iOS Safari toolbar collapsing changed the visible viewport
height. Post-PRP-014 / PRP-017 the affected pages use `dvh` (dynamic
viewport height); if the tenant is on an old session that hadn't
hot-reloaded, ask them to hard-refresh.

**Resolution:**
1. Ask them to fully scroll within the modal — the iframe traps
   touch-scroll on iOS; the outer panel scrolls separately, and the
   "Scroll down to continue ↓" cue under the iframe points to this.
2. If still no Submit button, ask them to close and re-open the link
   (hot-reload picks up the dvh fix).
3. If still broken, file a bug with their device + iOS version + a
   screenshot.

---

## 5. "Generate Forms is taking forever"

**Symptom:** tenant lands on the summary signing page and the
"Preparing your application summary..." spinner spins for >60 s.

**Cause:** large household (10+ members) + many conditional forms.
Stamping is sequential; PRP-017 added per-form `stampMs` logs.

**Resolution:**
1. Check the Vercel logs for `[generate-forms] stamp form_id=… ms=…`
   entries. If any single form is > 10 s, it's a source-PDF issue
   (oversized template, complex pages).
2. If the total exceeds the 120 s function limit and the response 504s,
   tell the tenant to retry once — the SECOND call collapses to the
   already-generated row via the affected-row guard.
3. If retries also 504, escalate: the chunking/queue follow-up (PRP-017
   B4) needs to land.

---

## 6. "I signed but the form still shows as not signed"

**Symptom:** tenant signed in the modal but the row in `Sign Forms`
still shows the "Sign" button.

**Cause:** the form is `each_adult` and another household member has
not yet signed. `allSigned` only fires when EVERY required adult signs.

**Resolution:**
1. Open the application's **Forms** tab. For the form in question,
   compare `required_signer_member_ids` (in Admin) vs
   `collected_signer_member_ids`. Missing members are the ones still
   to sign.
2. Trigger / re-send magic links to those members from the **Additional
   Signers** panel.
3. Once all listed members have signed, the form will auto-flip to
   `signed` and the signed PDF will materialize.

---

## 7. "Camera won't open on the document scanner"

**Symptom:** tenant taps "Take a photo" and nothing happens, or the
camera opens but is blank/wrong-facing.

**Cause:**
- Permission denied → `permission_denied` from `usePermissionPrompt`.
- No back camera + the pre-PRP-016 hard `facingMode: 'environment'`
  was rejected. PRP-016 moved this to `{ ideal: 'environment' }`;
  Samsung tablets and some Galaxy devices now work.
- Browser blocks getUserMedia outside HTTPS.

**Resolution:**
1. Confirm the URL is `https://` (the tenant link is, but a shared screenshot might not be).
2. Ask the tenant to **Choose a file** instead — the file-input path
   accepts photos taken with the device's native camera app and HEIC.
3. If permission was denied at the OS level, the tenant must go to
   Settings → Safari → Camera → Allow for `forms.stantonmgmt.com`.

---

## 8. "HEIC photo I uploaded didn't save"

**Symptom:** tenant uploaded a `.HEIC` from iPhone; the upload spinner
ran a long time and then errored.

**Cause:** `heic2any` decode failed (corrupt EXIF, very large file).
The server-side `sharp` fallback also runs; magic-bytes detect HEIC and
route through sharp. PRP-016 added the "Converting photo…" stage so the
tenant sees what's happening.

**Resolution:**
1. Ask the tenant to retry. The conversion is not deterministic on
   broken EXIF; a re-upload often succeeds.
2. If repeated failures, ask them to take the photo with their iPhone
   camera set to "Most Compatible" (Settings → Camera → Formats), which
   produces JPEG directly.

---

## 9. "I keep getting 'too many requests'"

**Symptom:** tenant sees 429 / "Too many requests" / `rate_limited`.

**Cause:** PRP-002 throttle. Per-token+route + per-IP backstop.

**Resolution:**
1. Check the timestamp + `Retry-After` header value. Tell the tenant
   to wait that long and retry (typically < 60 s).
2. If recurring without obvious cause, look at `[rateLimit] using
   in-memory adapter` log lines — Upstash provisioning is still
   pending and the in-memory limiter only catches single-instance
   bursts. (PRP-002 BLOCKER in OPEN-DECISIONS.md.)

---

## 10. "I started over and lost my work"

**Symptom:** tenant says they were filling out the intake, closed the
tab, came back, and lost everything.

**Cause:**
- The PRP-010 `beforeunload` guard prompts before tab-close once the
  user has typed but the debounced save hasn't landed; some tenants
  click "Leave anyway" and lose the in-flight buffer.
- Per-section data IS saved after the 600 ms debounce; older sections
  are intact.
- PRP-012 added `localStorage` backup; if the page hasn't been hot-
  reloaded yet, the backup may not be present.

**Resolution:**
1. Reassure: most sections are saved. Walk them to **resume** their
   intake — the system routes them to the resume section (PRP-015 F2).
2. If a specific section appears empty, they likely closed before the
   debounce; ask them to re-enter that section's data.
3. After PRP-012's `restoredFromBackup` UI lands (Phase 2 follow-up),
   the system will offer a "We restored your last edits" banner on
   re-entry.

---

## Quick reference — common admin actions

| Action | Where | When |
|---|---|---|
| Regenerate tenant link | Application detail → "Regenerate link" | Expired HOH magic link |
| Re-send magic link to member | Additional Signers panel → "Re-send link" | Member can't log in |
| Reopen application | Application detail → "Reopen application" | `packet_locked` set in error |
| Anonymize PII (PRP-019) | API only — `DELETE /api/admin/pbv/full-applications/[id]/data` with body `{"confirm":"ANONYMIZE"}` | Right-to-delete request |
| Inspect signing trail | Application detail → "Timeline" tab | Audit/dispute |
| View `_csrf` warn log | Vercel logs → search `[csrf]` | CSRF Phase-1 telemetry |

## Related
- `docs/data-retention-policy.md` — when and how to anonymize.
- `docs/audits/pbv-angle-2-audit_2026-05-21.md` — the original audit
  this playbook closes.
- `docs/fullApp-Plan/OPEN-DECISIONS.md` — outstanding decisions (e.g.
  Upstash for the rate limiter).
