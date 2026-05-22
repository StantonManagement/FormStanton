# PRP-001 — Security Headers & Content-Security-Policy

**Assigned batch (per BATCH_PLAN.md):** 01
**Source:** `docs/audits/pbv-angle-2-audit_2026-05-21.md` — findings **D1** (Critical), **D6** (High), **D8** (Low).
**Depends on:** None — operates on current `main`.
**Inputs (read before editing):** `next.config.js` (esp. the `headers()`/header region ~lines 40–64), `middleware.ts` (esp. the security-header branch ~lines 160–180), `components/DocumentScanner/DocumentScanner.tsx` (~99–113, blob preview usage), `components/pbv/sign/SummaryDocReviewSign.tsx` + `components/pbv/sign/FormReviewSignModal.tsx` (PDF blob/iframe usage).
**Outputs (write — the ONLY files this PRP may modify/create):** `next.config.js`, `middleware.ts`, and (iff a header-assertion test harness already exists) one test file.
**Acceptance criteria:**
- A `Content-Security-Policy-Report-Only` header is present on all responses, with `blob:` in `img-src`/`media-src` and `frame-src 'self' blob:`.
- `/pbv-full-app/*` and `/api/t/*` responses carry `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
- Existing `/admin` and `/hach` headers are unchanged.
- `tsc --noEmit` clean; `npm run build` clean (this PRP touches build surface).

## Context (self-contained)
Today the app sets `X-Content-Type-Options`/`X-Frame-Options`/`Referrer-Policy` only for `/admin` and `/hach` (in `middleware.ts`), and there is **no** Content-Security-Policy anywhere. Tenant-facing routes (`/pbv-full-app/*`, `/api/t/*`) get none of these. The tenant flow uses inline handlers, `blob:` URLs for document-scanner previews, and `<iframe>` for PDF previews, so any CSP must permit `blob:` and framing of same-origin blobs.

**Adversarial framing (why this matters):** without `X-Frame-Options`/`frame-ancestors`, the signing pages can be clickjacked via an attacker iframe; without `nosniff`, served content can be MIME-sniffed into executable types; without a `Referrer-Policy`, the `tenant_access_token` in the URL can leak to third-party sites; without CSP, injected scripts have more latitude.

## Problem
- **D1:** No CSP on any route.
- **D6:** Security headers limited to `/admin` + `/hach`; tenant routes unprotected (the PDF iframe is clickjacking-exposed).
- **D8:** Once CSP exists it must allow `blob:` (scanner/PDF previews) or those break.

## Goals
1. Add a global **`Content-Security-Policy-Report-Only`** header (start in report-only; a later, separate effort flips to enforcing after violations are reviewed). Baseline directive set — confirm against real inline/asset/worker usage before finalizing:
   ```
   default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
   img-src 'self' blob: data:; media-src 'self' blob:; frame-src 'self' blob:;
   frame-ancestors 'none'; connect-src 'self' https://*.supabase.co; base-uri 'self'; form-action 'self';
   ```
2. Extend `nosniff` / `X-Frame-Options: DENY` / `Referrer-Policy` to `/pbv-full-app/*` and `/api/t/*` by mirroring the existing admin/hach mechanism in `middleware.ts`.
3. Ensure `blob:` is in `img-src`/`media-src` and `frame-src` so scanner + PDF previews survive the eventual enforce flip.

## Non-goals
- Do **not** set CSP to enforcing mode (report-only only).
- No nonce-based `script-src` rework (dropping `'unsafe-inline'`) now — note it as future hardening.
- Do not edit any file other than `next.config.js` and `middleware.ts`.

## Implementation
1. **CSP (next.config.js):** read the existing `async headers()` (if any); add a `Content-Security-Policy-Report-Only` header on `source: '/:path*'` with the directive set above. Omit `report-uri` unless a collector endpoint already exists (note that adding one is a follow-up).
2. **Headers (middleware.ts):** extend the matcher + the header-setting branch so `/pbv-full-app/*` and `/api/t/*` get the three headers, mirroring the admin/hach branch (same response object, same mechanism). Do not remove/weaken admin/hach.
3. **Verify directive set:** grep for inline `<script>`, inline handlers, `dangerouslySetInnerHTML`, and scanner `wasm`/worker usage (OpenCV/jscanify/Scanic). If found, add the minimal directive (`worker-src 'self' blob:`, `'wasm-unsafe-eval'`) so the eventual enforce flip won't break the scanner. Comment each directive's reason.

## Verification (per-PRP gates, before commit)
- `node ./node_modules/typescript/bin/tsc --noEmit` clean.
- `npm run build` clean (build-surface PRP).
- If a header-assertion harness exists, add a test that a `/pbv-full-app/...` and `/api/t/...` response carries the three headers + the report-only CSP. If no harness exists, document a `curl -I` manual check as a deferred runtime gate (do not invent a framework).
- **Deferred runtime gates (record in commit notes):** on a preview, `curl -I` a tenant page + `/api/t/...` for the headers; load the scanner and a PDF preview and confirm zero CSP violations in devtools (proves the directive set is correct for a future enforce flip); admin/hach unchanged.
