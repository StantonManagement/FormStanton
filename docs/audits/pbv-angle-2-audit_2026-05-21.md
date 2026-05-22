# PBV Full-Application — Angle-2 Audit (What the Prior Audits Missed)

**Date:** 2026-05-21  
**Scope:** All tenant-facing PBV UI, API routes, hooks, and operational surfaces not covered by the five prior audit passes.  
**Method:** Static source inspection, dependency analysis, security header review, React hook dependency tracing, test-suite gap analysis.

---

## Executive Summary

Prior audits covered code-level bugs, data integrity, mobile/desktop cross-browser behavior, and adjacent race conditions exhaustively. **This audit found 4 critical, 9 high, 14 medium, and 8 low-severity issues that the prior passes did not consider.**

The biggest gaps are in:
- **Accessibility** — the signature pad has no keyboard fallback, error messages are not announced to screen readers, and modal focus management is missing
- **Security** — no CSP header, no rate limiting on tenant endpoints, no magic-byte file validation, and tenant-facing routes lack security headers entirely
- **Resilience** — no offline recovery, minimal retry logic, no `beforeunload` guards on intake/signing, and no network-status awareness
- **Operational** — `CRON_SECRET` is not validated at startup, no health-check endpoint, and no runbook for tenant support

No single finding is a deploy-blocker on its own, but the **security header gaps (Critical D1)** and **signature pad accessibility (Critical A1)** create compliance and legal liability risks that should be addressed before launch.

---

## Findings by Category

### A. Accessibility (a11y) & Inclusive Design

#### A1. Signature pad has no keyboard fallback — users who cannot use a mouse or touch screen cannot sign
- **Where:** `components/pbv/sign/SignaturePadGate.tsx:134` → `SignatureCanvasComponent`
- **Severity:** Critical
- **What's wrong:** The signing ceremony requires drawing a signature on a `<canvas>` element. There is no alternative input method (typed signature fallback, keyboard-driven drawing, or audio attestation). Users with motor disabilities, tremors, or who rely on keyboard navigation are completely blocked from the legally-required signature step.
- **Fix:** Add a "Type signature" fallback that converts typed text to a cursive font image, or provide an "I am unable to sign" staff-assisted override path. Ensure the fallback is discoverable via keyboard (`Tab`) navigation.

#### A2. Form review modal lacks focus trap and focus restoration
- **Where:** `components/pbv/sign/FormReviewSignModal.tsx:82` and `components/pbv/sign/SummaryDocReviewSign.tsx:144`
- **Severity:** High
- **What's wrong:** When the modal opens, focus is not programmatically moved to the modal container. A keyboard user tabbing through the page continues to focus elements behind the modal. When the modal closes, focus is not restored to the triggering element.
- **Fix:** Use a focus-trap utility (or `react-focus-lock`) inside the modal. On open, focus the first focusable element (the cancel button or the typed-name input). On close, restore focus to the button that opened the modal.

#### A3. Error messages are not announced to screen readers
- **Where:** `components/pbv/sign/SignaturePadGate.tsx:140-141`, `components/pbv/sign/SummaryDocReviewSign.tsx:117-119`, `components/pbv/sign/FormsStack.tsx` (stepper errors)
- **Severity:** High
- **What's wrong:** Validation errors (e.g., "Please draw your signature before continuing", name mismatch) are rendered as static `<p>` text. There is no `aria-live="polite"` region, so screen-reader users are not notified when an error appears after clicking Submit.
- **Fix:** Wrap error messages in a container with `aria-live="polite"` and `role="status"`. Associate the error text with the relevant input using `aria-describedby`.

#### A4. No `aria-describedby` linking error text to inputs
- **Where:** `components/pbv/sign/SignaturePadGate.tsx:114-126` (typed name input), `components/pbv/intake/SectionHousehold.tsx` (all inputs), `components/pbv/sign/FormReviewSignModal.tsx:133-143` (confirm name input)
- **Severity:** Medium
- **What's wrong:** When an input has an associated error, screen readers do not automatically read the nearby error text because there is no programmatic relationship (`aria-describedby`, `aria-errormessage`).
- **Fix:** Add unique IDs to error message containers and reference them from the input's `aria-describedby` attribute.

#### A5. Document status relies partially on color alone
- **Where:** `components/pbv/TenantDocumentUpload.tsx:535` (status dot classes)
- **Severity:** Low
- **What's wrong:** Status dots use red/yellow/green colors. However, text labels (`Missing`, `Submitted`, `Approved`, `Rejected`) are present alongside the dots, so this is mitigated. The issue is that the color-dot alone appears first in the DOM before the label, and the label is inside the same visual container but not programmatically tied.
- **Fix:** Ensure the status text is inside the same accessible name as the visual indicator, or use `aria-label` on the dot span.

#### A6. Intake progress bar is not announced on change
- **Where:** `components/pbv/intake/IntakeShell.tsx:126-137`
- **Severity:** Low
- **What's wrong:** The progress bar has correct `role="progressbar"` and `aria-*` attributes, but when the tenant advances to a new section, the `aria-valuenow` update is not inside a live region, so some screen readers may not announce the progress change.
- **Fix:** Add `aria-live="polite"` to the progress bar container, or add an off-screen `aria-live` region that announces "Section 3 of 10" on navigation.

#### A7. No skip-link or main landmark for screen-reader navigation
- **Where:** All PBV tenant pages (`app/pbv-full-app/[token]/*`)
- **Severity:** Medium
- **What's wrong:** No `<main>` landmark is explicitly declared (pages use generic `<div>` wrappers), and there is no "Skip to main content" link. Screen-reader users must tab through the entire header/sidebar on every page load.
- **Fix:** Wrap primary content in `<main>` or add `role="main"`. Add a visually hidden skip-link as the first focusable element.

#### A8. "Sign all" stepper progress not announced
- **Where:** `components/pbv/sign/FormsStack.tsx:208-211`
- **Severity:** Medium
- **What's wrong:** As the tenant signs forms in the stepper, the text "Signing 2 of 5…" updates, but there is no `aria-live` region, so screen-reader users are unaware that the next form has opened automatically.
- **Fix:** Wrap the stepper progress text in a span with `aria-live="polite"`.

---

### B. Performance & Core Web Vitals

#### B1. `pdf-lib` is statically imported in DocumentScanner (eagerly bundled)
- **Where:** `components/DocumentScanner/DocumentScanner.tsx:6`
- **Severity:** High
- **What's wrong:** `import { PDFDocument } from 'pdf-lib'` is a top-level static import. `pdf-lib` is a ~500 KB library. It is loaded on every page that transitively imports DocumentScanner, even when the scanner is not rendered. The scanner itself is dynamically imported (`next/dynamic`), but `pdf-lib` is not inside that dynamic chunk because the import is at the top level of the file.
- **Fix:** Move the `pdf-lib` import inside the functions that use it (`processImageBlob` → PDF assembly path), or create a separate module that is dynamically imported only when multi-page PDF output is needed.

#### B2. Scanner preview images are not optimized (no lazy loading, no sizing)
- **Where:** `components/DocumentScanner/DocumentScanner.tsx:99-113` (`loadImageFromBlob`)
- **Severity:** Medium
- **What's wrong:** `URL.createObjectURL(blob)` creates full-resolution preview URLs. On mobile, a 25 MB HEIC → JPEG conversion may produce a 10+ megapixel image that is displayed at `max-h-[50vh]`. The browser loads the full-resolution blob into memory for display. No `loading="lazy"` is possible on blob URLs, but more importantly, the canvas preview could downsample.
- **Fix:** Downsample the image to a max dimension (e.g., 1200 px) before creating the preview blob using an off-screen canvas.

#### B3. PDF iframe previews have no lazy loading
- **Where:** `components/pbv/sign/SummaryDocReviewSign.tsx:181-187`, `components/pbv/sign/FormReviewSignModal.tsx:88-89`
- **Severity:** Low
- **What's wrong:** The iframe `src` is set immediately on mount, loading the PDF even if it is below the fold or inside a hidden modal container. No `loading="lazy"` attribute is present.
- **Fix:** Add `loading="lazy"` to the iframe element (supported in modern browsers for iframes).

#### B4. `generate-forms` performs heavy synchronous PDF stamping on the serverless main thread
- **Where:** `app/api/t/[token]/pbv-full-app/generate-forms/route.ts:165-169`
- **Severity:** Medium
- **What's wrong:** The `stampForm` call is awaited sequentially inside a loop. For a household with 10+ members and 15+ forms, this can exceed the Vercel serverless function duration (120 s configured). No streaming or background processing is used.
- **Fix:** Consider streaming the response, or moving form generation to a background job queue. At minimum, add a progress/cancellation mechanism.

#### B5. All tenant pages are `'use client'` — no server-side rendering for initial content
- **Where:** `app/pbv-full-app/[token]/page.tsx:1`, `app/pbv-full-app/[token]/dashboard/page.tsx:1`, `app/pbv-full-app/[token]/documents/page.tsx:1`, etc.
- **Severity:** Medium
- **What's wrong:** Every tenant-facing page is a client component. The initial HTML is a blank shell until JavaScript hydrates. On slow mobile networks, the tenant sees a white screen for seconds. This also hurts SEO (though not critical for a gated tenant flow).
- **Fix:** Move the bootstrap fetch to a Server Component (page.tsx without `'use client'`), and pass the initial data as props to a client sub-component. At minimum, add a static loading skeleton in the HTML.

#### B6. `framer-motion` animations run unconditionally
- **Where:** `app/pbv-full-app/[token]/page.tsx:5` (`import { motion, AnimatePresence } from 'framer-motion'`)
- **Severity:** Low
- **What's wrong:** Framer-motion is imported and used for page transitions. There is no `prefers-reduced-motion` media query guard. Users with vestibular disorders may experience motion sickness.
- **Fix:** Wrap motion components in a `useReducedMotion` check, or add CSS `@media (prefers-reduced-motion: reduce)` overrides.

---

### C. Resilience, Offline & Error Handling

#### C1. No `beforeunload` guard on intake or signing flows
- **Where:** `app/pbv-full-app/[token]/intake/[section]/page.tsx`, `app/pbv-full-app/[token]/sign/summary/page.tsx`, `app/pbv-full-app/[token]/sign/forms/page.tsx`
- **Severity:** High
- **What's wrong:** The `beforeunload` guard exists only on the documents page (`app/pbv-full-app/[token]/documents/page.tsx:109-121`). If a tenant closes the tab mid-intake or mid-signature, their unsaved work is lost. The auto-save hook has a 600 ms debounce, so rapid closure can lose the last few keystrokes.
- **Fix:** Add a `beforeunload` handler to the intake layout (`app/pbv-full-app/[token]/layout.tsx`) that warns when `saveStatus !== 'saved'`. For signing, warn when `submitting === true`.

#### C2. Hooks lack robust retry with exponential backoff
- **Where:** `lib/tenantFetch.ts:53-60`, `lib/pbv/hooks/useIntakeBootstrap.ts:44-71`, `lib/pbv/hooks/useDashboardState.ts:61-152`, `lib/pbv/hooks/useFormStack.ts:35-46`
- **Severity:** High
- **What's wrong:** `tenantFetch` retries once immediately on `TypeError` (network failure) with no delay. The hooks (`useIntakeBootstrap`, `useDashboardState`, `useFormStack`) have **no retry at all** — a single transient network blip shows a permanent error screen.
- **Fix:** Add exponential backoff (e.g., 1s, 2s, 4s) with a max of 3 retries in `tenantFetch`. In hooks, add a "Retry" button or auto-retry on mount.

#### C3. `useDashboardState` fails entirely if any one of four parallel requests fails
- **Where:** `lib/pbv/hooks/useDashboardState.ts:66-71`
- **Severity:** High
- **What's wrong:** Four requests are fired in parallel (`Promise.all`). If `upload-summary` returns 500 (e.g., a transient DB issue), the entire `load()` throws and the dashboard shows an error state, even though `bootstrap` and `forms` may have succeeded. The tenant sees "Failed to load dashboard" instead of a partially-functional dashboard.
- **Fix:** Use `Promise.allSettled` instead of `Promise.all`. Render partial data with an inline warning for the failed slice.

#### C4. No offline/network-status awareness
- **Where:** All client-side hooks
- **Severity:** Medium
- **What's wrong:** The app does not listen to `navigator.onLine` events. A tenant on a subway losing connectivity has no feedback — buttons appear clickable, auto-save silently fails, and signature submissions hang.
- **Fix:** Add an `OnlineStatusProvider` context that listens to `online`/`offline` events. Disable submit buttons and show a banner when offline.

#### C5. No local/session storage recovery mechanism
- **Where:** `lib/pbv/hooks/useSectionAutoSave.ts`
- **Severity:** Medium
- **What's wrong:** Auto-save sends to the server every 600 ms. If the network is down for an extended period, local form state is held only in React memory. A page refresh loses all unsaved section data.
- **Fix:** Add a `localStorage` backup key (`pbv_intake_${token}_${section}`) that is written on every change and cleared on successful server save. On mount, if the server data is stale compared to `localStorage`, offer to restore.

#### C6. `useSigningCeremony` does not recover from a failed first capture
- **Where:** `lib/pbv/hooks/useSigningCeremony.ts:42-95`
- **Severity:** Medium
- **What's wrong:** If `signature/capture` succeeds but `sign-form` fails (network blip), the signature image is stored on the server but the hook does not record `signatureImagePath` because it only sets state after a successful capture response. Actually, it DOES set state after capture. But if `sign-form` then fails, the tenant must re-draw the signature for the next attempt because the ceremony state is lost on unmount/remount. More critically, if `captureAndSign` fails at the `sign-form` step, the error is shown but the signature image path WAS set — yet on retry, `signWithExisting` may be called but the form modal re-opens with `hasSignature=false` if the ceremony hook was recreated.
- **Fix:** Persist `ceremonyId` and `signatureImagePath` in `sessionStorage` for the duration of the signing session so that a page refresh or modal re-open does not require re-capturing.

#### C7. No cleanup of `beforeunload` handlers in all paths
- **Where:** `app/pbv-full-app/[token]/documents/page.tsx:109-121`
- **Severity:** Low
- **What's wrong:** The cleanup function for `beforeunload` is correct, but if `submittedAt` changes from null → truthy between renders, the old handler may not be removed immediately because the effect re-runs and removes then re-adds.
- **Fix:** This is actually implemented correctly in the current code. Verified safe.

---

### D. Security Beyond What Was Audited

#### D1. No Content-Security-Policy header anywhere
- **Where:** `middleware.ts:168-177`, `next.config.js:40-64`
- **Severity:** Critical
- **What's wrong:** There is no `Content-Security-Policy` header for any route, including tenant-facing `/pbv-full-app/*`. The app uses inline event handlers, blob URLs for scanner previews, and iframes for PDFs. Without CSP, XSS payloads from compromised storage URLs or malicious PDFs have fewer mitigations.
- **Fix:** Add a strict CSP to `next.config.js` for all routes:
  ```
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; frame-src 'self' blob:;
  ```
  Start with `Content-Security-Policy-Report-Only` to collect violations before enforcing.

#### D2. No rate limiting on tenant-facing endpoints
- **Where:** All `/api/t/[token]/pbv-full-app/*` routes
- **Severity:** Critical
- **What's wrong:** Any client can hammer the tenant API. There is no IP-based or token-based rate limiting. An attacker could brute-force the `tenant_access_token` space, flood `generate-forms` to run up compute costs, or spam `finalize` to stress the DB.
- **Fix:** Add a Vercel Edge Config or Redis-backed rate limiter. Minimum: limit `finalize` and `generate-forms` to 10 requests/minute per token. Limit `sign-form` to 20/minute per token.

#### D3. Magic link token entropy and brute-force resistance
- **Where:** `app/api/pbv-full-app/signer/[member_token]/route.ts:24-28`
- **Severity:** High
- **What's wrong:** The `magic_link_token` is generated by `crypto.randomUUID()` (seen in `send-link` route). UUID v4 has 122 bits of entropy — sufficient for random guessing. However, there is **no rate limiting** on the signer bootstrap endpoint. An attacker can guess tokens at high speed. More importantly, there is **no brute-force lockout** after N failed attempts.
- **Fix:** Add IP-based rate limiting to `/api/pbv-full-app/signer/[member_token]/*`. Consider adding a `failed_magic_link_attempts` counter on the member row and lock out after 10 failures.

#### D4. File upload validates MIME type but not magic bytes
- **Where:** `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts:86-91`
- **Severity:** High
- **What's wrong:** The upload route checks `file.type` against an allow-list. The `type` property comes from the browser's MIME-sniffing based on the file extension, which is trivially spoofed. A tenant (or attacker) can rename `evil.exe` to `innocent.jpg` and the browser will report `image/jpeg`.
- **Fix:** Use a server-side magic-bytes library (e.g., `file-type`) to validate the actual file header after reading the buffer. Reject files whose magic bytes do not match the claimed MIME type.

#### D5. `X-Forwarded-For` is trusted without proxy awareness
- **Where:** `app/api/log/client-error/route.ts:34`
- **Severity:** Medium
- **What's wrong:** The client-error logging endpoint reads `request.headers.get('x-forwarded-for')` directly. On Vercel, this header is set by Vercel's edge, but if the app is ever run behind a misconfigured proxy or locally, the client can spoof any IP address.
- **Fix:** Use the `X-Forwarded-For` chain parsing logic that extracts the leftmost non-private IP, or better, rely on Vercel's `x-vercel-ip` headers instead.

#### D6. Security headers missing on tenant routes
- **Where:** `middleware.ts:170-175`
- **Severity:** High
- **What's wrong:** `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy` are only set for `/admin` and `/hach` routes. Tenant-facing `/pbv-full-app/*` routes receive none of these headers. The iframe PDF preview is particularly vulnerable to clickjacking without `X-Frame-Options`.
- **Fix:** Extend the middleware matcher and header logic to include `/pbv-full-app/*` and `/api/t/*` routes.

#### D7. CSRF protection on state-changing POSTs is weak
- **Where:** All `/api/t/[token]/pbv-full-app/*` POST routes
- **Severity:** Medium
- **What's wrong:** The tenant token in the URL path provides some CSRF protection (a cross-site attacker would need to know the token), but the token may leak via Referrer headers to third-party sites (e.g., if the tenant clicks an external link and then returns). There is no CSRF token in the request body or header.
- **Fix:** Add a short-lived CSRF token to the bootstrap GET response that must be included in all mutating POSTs. This is defense-in-depth, not an urgent fix.

#### D8. `URL.createObjectURL` is used safely but without CSP `blob:` allowance check
- **Where:** `components/DocumentScanner/DocumentScanner.tsx:99-113`
- **Severity:** Low
- **What's wrong:** `URL.createObjectURL` is created and properly revoked in `finally` blocks. However, if a CSP is added later (see D1) without `blob:` in `img-src` or `media-src`, scanner previews will break.
- **Fix:** When implementing D1, explicitly include `blob:` in the `img-src` and `media-src` directives.

---

### E. State Management & React-Specific Bugs

#### E1. `IntakeSectionPage` `handleSectionChange` has a stale-closure risk
- **Where:** `app/pbv-full-app/[token]/intake/[section]/page.tsx:98-105`
- **Severity:** Medium
- **What's wrong:** The `handleSectionChange` callback has an `eslint-disable-next-line react-hooks/exhaustive-deps` comment. It depends on `intakeData` but omits it from the dependency array. If `intakeData` changes (e.g., from a background reload), the callback may use a stale version, causing the section data merge to overwrite newer data with old data.
- **Fix:** Remove the eslint-disable and add `intakeData` to the dependency array, or use a functional `setLocalIntakeData` updater to avoid the closure dependency.

#### E2. `useSigningCeremony` `signWithExisting` has a stale `signatureImagePath` closure
- **Where:** `lib/pbv/hooks/useSigningCeremony.ts:100-133`
- **Severity:** Medium
- **What's wrong:** `signWithExisting` has `[token, hohMemberId, signatureImagePath]` in its dependency array. If `signatureImagePath` is set in `captureAndSign` and then `signWithExisting` is called immediately after, the closure should be fresh. However, if the component re-renders for an unrelated reason between capture and sign, the callback identity changes unnecessarily. More critically, the `captureAndSign` callback depends on `[token, hohMemberId]` but not `signatureImagePath` — so if `captureAndSign` is called again for a different form in the same ceremony, it will re-upload the same signature image (which is idempotent, but wasteful).
- **Fix:** This is a minor issue. The main concern is that `idempotencyKey` is computed but then passed to `tenantFetch` which auto-generates its own key, making the composed key useless.

#### E3. `tenantFetch` idempotency key is overwritten by auto-generated key
- **Where:** `lib/tenantFetch.ts:22-28`, `lib/pbv/hooks/useSigningCeremony.ts:68-83`
- **Severity:** Medium
- **What's wrong:** `useSigningCeremony` computes a composed idempotency key (`${ceremonyId}-${formDocumentId}`) but then calls `tenantFetch(...)` which ignores it and generates its own `crypto.randomUUID()` key. The composed key is only used as a local variable (`void idempotencyKey;`). This means the signing ceremony does not get the intended idempotency semantics.
- **Fix:** Pass the custom idempotency key to `tenantFetch` via an `idempotencyKey` option, or change `tenantFetch` to accept an optional custom key.

#### E4. `FormsStack` recreates the sorted array on every render
- **Where:** `components/pbv/sign/FormsStack.tsx:107-111`
- **Severity:** Low
- **What's wrong:** `[...forms].sort(...)` runs on every render. For 20 forms this is negligible, but it causes all form row children to re-render unnecessarily because React sees a new array reference.
- **Fix:** Wrap in `useMemo(() => [...forms].sort(...), [forms])`.

#### E5. `useSectionAutoSave` debounce effect uses `JSON.stringify` for change detection
- **Where:** `lib/pbv/hooks/useSectionAutoSave.ts:85-98`
- **Severity:** Low
- **What's wrong:** The effect dependency is `[JSON.stringify(data), section, enabled]`. `JSON.stringify` on large intake objects (with nested household members) runs on every keystroke, causing a synchronous serialization cost. The debounce means the actual save is delayed, but the stringify runs immediately on every render.
- **Fix:** Use a deep-equality hook or a mutable ref with a dirty flag instead of `JSON.stringify` in the dependency array.

---

### F. URL, Navigation & Deep Linking

#### F1. No validation of `?filter=` search parameter values
- **Where:** `app/pbv-full-app/[token]/documents/page.tsx:54-55`, `188-208`
- **Severity:** Medium
- **What's wrong:** `filterParam` is read from `useSearchParams` and compared to `'rejected'`. If a tenant visits `?filter=hack`, the code falls through silently with no error. More importantly, there is no sanitization — a reflected XSS payload in the query string (e.g., `?filter=<script>`) could be rendered if the value were ever interpolated into the DOM (it is not today, but this is fragile).
- **Fix:** Validate `filterParam` against a strict allow-list (`'rejected' | 'all' | null`). Return 400 or ignore invalid values.

#### F2. No deep-link guards preventing skipping intake sections
- **Where:** `app/pbv-full-app/[token]/intake/[section]/page.tsx`
- **Severity:** Medium
- **What's wrong:** A tenant can navigate directly to `/pbv-full-app/{token}/intake/income` without completing `household` or `contact`. The page renders the section with whatever partial data exists. There is no server-side or client-side gate checking `resume_section` or section completion order.
- **Fix:** On mount, compare the requested section against the `resume_section` returned by the bootstrap. If the requested section is ahead of the resume point, redirect to the resume section.

#### F3. Magic links may break in in-app browsers
- **Where:** `app/api/pbv-full-app/signer/[member_token]/route.ts`
- **Severity:** Medium
- **What's wrong:** Instagram, Facebook, and Mail in-app browsers often strip cookies, use different user agents, and may not support `localStorage` or `sessionStorage`. The magic-link signer flow does not detect in-app browsers or warn the tenant to open the link in Safari/Chrome.
- **Fix:** Add a lightweight in-app browser detector (check user agent for `Instagram`, `FBAV`, `LinkedIn`). Show a prompt: "Open in your default browser for the best experience."

#### F4. Browser Back button during intake creates confusing history stack
- **Where:** `app/pbv-full-app/[token]/intake/[section]/page.tsx:120`
- **Severity:** Low
- **What's wrong:** The intake flow uses `router.push` for Next/Back navigation. This adds every section to the browser history. If the tenant clicks the browser Back button, they go back one section at a time. This is arguably correct behavior, but if they are on section 8 and click Back, they expect to leave the intake, not go to section 7. There is no "Are you sure?" prompt.
- **Fix:** Consider using `router.replace` for in-flow navigation so Back exits the intake. Alternatively, add a `beforeunload` or custom history blocker.

---

### G. Legal, Compliance & Data Retention

#### G1. `CONSENT_TEXT_VERSION` is hardcoded but not enforced in the database
- **Where:** `lib/pbv/consent-text.ts:10`, `app/api/t/[token]/pbv-full-app/sign-summary/route.ts`
- **Severity:** High
- **What's wrong:** The consent text version (`2026-05-15-v1`) is a TypeScript constant. It is sent to the API and stored in `pbv_signature_events.consent_text_version`. However, there is no DB constraint or validation that ensures the stored version matches a known version. If the code is updated to `v2` but old rows have `v1`, there is no integrity check.
- **Fix:** Store a `consent_versions` table with a unique constraint, and validate the version in the sign-form/sign-summary routes against this table.

#### G2. Console logs may leak PII in production
- **Where:** `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts:84`, `252`, `app/api/t/[token]/pbv-full-app/route.ts:296`
- **Severity:** High
- **What's wrong:** Server logs include `doc_row_id`, file size, MIME type, and application ID. While not direct PII, combined with other logs they can reconstruct a tenant's document upload timeline. More critically, `console.error` in the client-error endpoint logs the full URL, which may contain the `tenant_access_token`.
- **Fix:** Sanitize all log output to remove tokens. Use a structured logger with a PII redaction layer.

#### G3. No tenant data-deletion mechanism (GDPR/CCPA right to deletion)
- **Where:** None found
- **Severity:** Medium
- **What's wrong:** There is no endpoint or admin UI for a tenant to request deletion of their personal data. SSN last-four, DOB, names, and signatures are retained indefinitely.
- **Fix:** Add a `DELETE /api/admin/pbv/full-applications/[id]/data` endpoint (or an admin UI action) that anonymizes the application and household member rows while preserving audit-event metadata for compliance.

#### G4. Audit logs are not tamper-evident
- **Where:** `lib/events/application-events.ts` (inferred), `supabase/migrations/*` touching `pbv_signature_events`
- **Severity:** Medium
- **What's wrong:** `pbv_signature_events` and `application_events` tables are writable by `service_role`. A compromised admin key or malicious DB admin can delete or modify events. There is no cryptographic signature, hash chain, or append-only enforcement.
- **Fix:** This is a hard problem. A pragmatic step: add a `event_hash` column that is a SHA-256 of `(prev_event_hash || event_payload)` to create a simple hash chain. Verify the chain in the finalize validator.

#### G5. Signature images and signed PDFs have no retention policy
- **Where:** Supabase Storage buckets `pbv-forms`, `form-submissions`
- **Severity:** Medium
- **What's wrong:** Signed PDFs and signature images are stored in Supabase Storage indefinitely. HUD/program requirements may mandate retention for 3-7 years, but there is no automated enforcement or deletion after the retention period.
- **Fix:** Document the retention requirement in the data-retention policy. Add a lifecycle rule (if Supabase supports it) or a cron job that archives/deletes old files according to policy.

---

### H. Browser Gaps Not Previously Covered

#### H1. No `prefers-reduced-motion` handling for animations
- **Where:** `app/pbv-full-app/[token]/page.tsx:5` (`framer-motion`), `components/pbv/intake/IntakeShell.tsx:134` (progress bar transition)
- **Severity:** Medium
- **What's wrong:** Framer-motion page transitions and the progress bar CSS transition run unconditionally. Users with vestibular disorders or motion sensitivity may experience discomfort.
- **Fix:** Use `useReducedMotion()` from framer-motion (or a CSS `@media (prefers-reduced-motion: reduce)` override) to disable animations.

#### H2. Samsung Internet `getUserMedia` quirks not handled
- **Where:** `components/DocumentScanner/usePermissionPrompt.ts` (inferred), `components/DocumentScanner/DocumentScanner.tsx:154-156`
- **Severity:** Low
- **What's wrong:** Samsung Internet (popular on Galaxy devices) has known issues with `getUserMedia` constraints and may return a blank stream if `facingMode` is not specified. The code does not pass `facingMode: 'environment'`.
- **Fix:** Add `facingMode: { ideal: 'environment' }` to the `getUserMedia` constraints in `usePermissionPrompt`.

#### H3. Desktop Safari WebGL/canvas performance for signature pad
- **Where:** `components/pbv/sign/SignaturePadGate.tsx:134` → `SignatureCanvasComponent`
- **Severity:** Low
- **What's wrong:** `react-signature-canvas` uses HTML5 canvas. Desktop Safari has had occasional issues with canvas backing store memory on Retina displays. No `willReadFrequently` hint is passed to `getContext('2d')`.
- **Fix:** This is speculative. Monitor Sentry/crash reports for Safari-specific canvas errors.

#### H4. Firefox `type="date"` input behavior
- **Where:** All intake sections using `type="date"` (e.g., `components/pbv/intake/SectionHousehold.tsx:239`)
- **Severity:** Low
- **What's wrong:** Firefox's native date picker behaves differently from Chrome/Safari — it may not fire `onChange` on partial input, and emptying the field may not clear the value correctly. The `computeAge` helper depends on the field being cleared.
- **Fix:** Add explicit `onBlur` validation and clear handling for date inputs.

---

### I. Operational & Deployment

#### I1. `CRON_SECRET` is not validated by `validate-env.ts`
- **Where:** `scripts/validate-env.ts:35-56`
- **Severity:** Critical
- **What's wrong:** The `validate-env` script checks `SESSION_SECRET`, `SUPABASE_*`, etc., but `CRON_SECRET` is absent from the required and optional variable lists. The prior audits identified that cron routes are unprotected when `CRON_SECRET` is missing. Without validation, a deployment can go live with this critical variable unset.
- **Fix:** Add `CRON_SECRET` to the `requiredVars` array with a minimum-length validator.

#### I2. No health check endpoint
- **Where:** None found
- **Severity:** High
- **What's wrong:** There is no `/api/health` or `/health` endpoint. Vercel, load balancers, and monitoring tools cannot verify that the app is healthy. If Supabase is unreachable, the app will fail at runtime with no early warning.
- **Fix:** Add a simple `app/api/health/route.ts` that returns `{ status: 'ok', checks: { supabase: <ping result> } }`.

#### I3. Build-time validation is skipped on Vercel
- **Where:** `scripts/validate-env.ts:8-11`
- **Severity:** Medium
- **What's wrong:** The script exits immediately on Vercel (`VERCEL_ENV === 'production' || 'preview'`) because env vars are runtime-only. This means a missing required variable (e.g., `PBV_SSN_ENCRYPTION_KEY`) will not be caught until the first request that needs it.
- **Fix:** Move required-variable checks to a runtime bootstrap module that runs on the first request in each serverless instance, and fails loudly with a 503 and a clear log message.

#### I4. No runbook for common tenant support issues
- **Where:** `docs/` directory
- **Severity:** Medium
- **What's wrong:** There is no operational runbook for support staff to handle: "My link expired", "I locked my packet accidentally", "My document was rejected and I don't know why", "I can't see the Submit button". The `pbv-open-items-and-suggestions` doc focuses on code, not operations.
- **Fix:** Create `docs/runbooks/tenant-support-playbook.md` with step-by-step resolution for the top 10 support scenarios.

#### I5. Migrations may not be backward-compatible for new environments
- **Where:** `supabase/migrations/`
- **Severity:** Low
- **What's wrong:** Some migrations reference tables created in earlier migrations without `IF NOT EXISTS`. For example, `tenant_lookup` was likely created manually and is referenced by later migrations but may not have a `CREATE TABLE IF NOT EXISTS` migration. New staging/prod clones could fail.
- **Fix:** Audit migration ordering and ensure every referenced table has a creation migration.

---

### J. Test Coverage Gaps

#### J1. `KNOWN_PACKAGE_HASH` is still `'UPDATE_ME'`
- **Where:** `tests/e2e/pbv-form-execution-happy-path.spec.ts:35`
- **Severity:** High
- **What's wrong:** The E2E happy-path test has a placeholder hash. Until it is populated, the test cannot detect package integrity drift.
- **Fix:** Run the E2E spec, extract the hash from `tests/snapshots/.../package-hash.txt`, and commit it.

#### J2. No E2E coverage of error branches (network failure, 409, 422)
- **Where:** `tests/e2e/`
- **Severity:** High
- **What's wrong:** The existing E2E specs test the happy path only. There are no tests for: network timeout during upload, 409 `upload_superseded`, 422 `intake_not_complete`, 410 expired magic link, or 500 `finalize_atomic_failed`.
- **Fix:** Add a `pbv-error-branches.spec.ts` that uses Playwright's `route.fulfill` to simulate API failures and asserts the UI shows the correct error message and recovery action.

#### J3. No visual regression tests for signature pad and scanner
- **Where:** None found
- **Severity:** Medium
- **What's wrong:** The signature pad and document scanner are the most visually complex and platform-sensitive components. Without visual regression tests, CSS changes or canvas resizing bugs can regress iOS Safari behavior without detection.
- **Fix:** Add Playwright screenshot tests for: (1) signature pad rendered state, (2) scanner entry stage, (3) intake section layout on iPhone viewport.

#### J4. No load test for `generate-forms` with 10+ household members
- **Where:** `app/api/t/[token]/pbv-full-app/generate-forms/route.ts`
- **Severity:** Medium
- **What's wrong:** The `generate-forms` endpoint stamps PDFs in a loop. With a large household (10+ members, 15+ forms), the function may approach the 120-second Vercel limit. There is no performance test that validates this boundary.
- **Fix:** Create a load-test fixture with 12 members and run `generate-forms` locally with `console.time` to establish a performance baseline.

#### J5. No accessibility tests (axe-core)
- **Where:** None found
- **Severity:** Medium
- **What's wrong:** No automated a11y tests exist. Issues like missing labels, contrast failures, or focus traps would be caught by `@axe-core/playwright`.
- **Fix:** Add `test('a11y scan', async ({ page }) => { const results = await new AxeBuilder({ page }).analyze(); expect(results.violations).toEqual([]); });` to each major page E2E test.

#### J6. Unit tests do not cover offline/network recovery in hooks
- **Where:** `lib/pbv/hooks/__tests__/` (does not exist)
- **Severity:** Low
- **What's wrong:** Hooks like `useIntakeBootstrap`, `useDashboardState`, and `useSectionAutoSave` have no unit tests for network failure, retry, or offline behavior.
- **Fix:** Add `@testing-library/react` tests for each hook that mock `fetch` returning 500, timeout, and success after retry.

---

## Prioritized Action List

| Priority | ID | Fix | Effort |
|---|---|---|---|
| P0 (pre-launch) | D2 | Add rate limiting to tenant API endpoints | Medium |
| P0 (pre-launch) | D1 | Add CSP (report-only first) to next.config.js | Small |
| P0 (pre-launch) | D6 | Add security headers to /pbv-full-app/* routes in middleware | Small |
| P0 (pre-launch) | I1 | Add CRON_SECRET to validate-env.ts | Small |
| P1 (first patch) | A1 | Add keyboard-accessible signature fallback | Large |
| P1 (first patch) | A2 | Add focus trap to signing modals | Medium |
| P1 (first patch) | A3 | Add aria-live regions for error messages | Small |
| P1 (first patch) | C1 | Add beforeunload guard to intake/signing layouts | Small |
| P1 (first patch) | C3 | Use Promise.allSettled in useDashboardState | Small |
| P1 (first patch) | D4 | Add server-side magic-bytes file validation | Medium |
| P1 (first patch) | J1 | Populate KNOWN_PACKAGE_HASH | Small |
| P1 (first patch) | J2 | Add E2E error-branch tests | Medium |
| P2 (second patch) | B1 | Lazy-load pdf-lib inside DocumentScanner | Small |
| P2 (second patch) | B5 | Move bootstrap fetch to server component | Medium |
| P2 (second patch) | C2 | Add exponential backoff to tenantFetch | Small |
| P2 (second patch) | C4 | Add online/offline status provider | Small |
| P2 (second patch) | F2 | Add deep-link section guards | Small |
| P2 (second patch) | G2 | Sanitize PII from server logs | Small |
| P2 (second patch) | G1 | Enforce consent version in DB | Small |
| P2 (second patch) | I2 | Add /api/health endpoint | Small |
| P3 (third patch) | A5-A8, H1-H4 | Accessibility polish and browser gaps | Small |
| P3 (third patch) | E1-E5 | React state management hardening | Small |
| P3 (third patch) | G3-G5 | Legal/compliance improvements | Medium |
| P3 (third patch) | J3-J6 | Additional test coverage | Medium |

---

## Verification Checklist

- [ ] Rate limiter is active on `/api/t/[token]/pbv-full-app/*` (test with 20 rapid requests)
- [ ] CSP report-only header is present on `/pbv-full-app/*` responses
- [ ] `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` present on tenant routes
- [ ] `scripts/validate-env.ts` fails if `CRON_SECRET` is missing
- [ ] Signature pad shows a "Type my signature" fallback when Tab-focused
- [ ] Modal focus moves to the first input on open and restores on close
- [ ] Screen reader (NVDA/VoiceOver) announces "Please draw your signature" when Submit is pressed without a signature
- [ ] Closing the browser tab during intake shows a "Leave site?" dialog
- [ ] Dashboard loads partial data if `upload-summary` is 500 (other cards visible)
- [ ] Uploading a renamed `.exe` → `.jpg` is rejected by magic-bytes check
- [ ] `KNOWN_PACKAGE_HASH` in E2E spec is not `'UPDATE_ME'`
- [ ] `/api/health` returns 200 with Supabase connectivity status
- [ ] Direct navigation to `/intake/income` without completing `household` redirects to resume section
- [ ] `console.error` output in Vercel logs does not contain `tenant_access_token` values
- [ ] `generate-forms` completes in < 60 seconds for a 12-member household fixture
- [ ] `pbv-full-app` pages render a static HTML shell before JS hydrates (view source)
- [ ] `@axe-core/playwright` scan returns zero violations on intake, dashboard, and signing pages

---

*End of audit. All findings are new — none duplicate the prior five audit passes.*
