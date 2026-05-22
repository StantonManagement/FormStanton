# PRP-001 — Security Headers & CSP — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-post-audit-remediation`
**Commit:** `cca98f84c20468b4f84def4d4b66a5ca3e24c94c`
**Findings closed:** Angle-2 audit — **D1** (no CSP), **D6** (admin/hach-only headers), **D8** (blob preview safety)

## Files changed
- `next.config.js` — added global `Content-Security-Policy-Report-Only` header (allows `blob:`, `data:`, `'wasm-unsafe-eval'`, supabase REST + websocket).
- `middleware.ts` — added early-exit branch for `/pbv-full-app/*` and `/api/t/*` that sets `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`; matcher extended to those paths.

## Path taken
- CSP is **report-only**. No `report-uri` (collector endpoint not yet provisioned — noted as follow-up).
- `'unsafe-inline'` kept on `script-src` / `style-src`. Removing it requires a nonce/hash rework — explicit PRP non-goal.
- Tenant-route header logic placed at the top of `middleware()` *before* iron-session decoding, so adding `/pbv-full-app/*` + `/api/t/*` to the matcher does not add session-decode latency to every tenant request.
- `connect-src` includes `https://*.supabase.co` **and** `wss://*.supabase.co` (Realtime); not in the PRP baseline but discovered by inspection — required so the eventual enforce flip won't break Realtime subscriptions.

## Defaults logged (none required, but noted)
- `report-uri` omitted. To wire it later, add `report-uri /api/csp-report` (or external collector) and stand up the collector route.

## Per-PRP gates
- `node ./node_modules/typescript/bin/tsc --noEmit` — **clean.**
- `npm run build` — **clean.** Only warnings: `RESEND_API_KEY has invalid format`, `ANTHROPIC_API_KEY is not set` — unrelated env warnings.

## Deferred runtime gates
- On a Vercel preview, `curl -I https://<preview>/pbv-full-app/<token>` and `curl -I https://<preview>/api/t/<token>/...` and confirm all three headers + the report-only CSP are present.
- In devtools, load the scanner camera flow and a PDF preview in the signing modal; confirm **zero CSP-Report-Only violations** in console (proves the directive set is correct for a future enforce flip).
- Confirm `/admin/*` + `/hach/*` headers unchanged on preview.
- Decide on a CSP report collector route before flipping to enforcing mode (separate effort).

## Notes
- `script-src` `'wasm-unsafe-eval'` covers OpenCV.js / Scanic / jscanify wasm execution paths surfaced by `components/DocumentScanner/*`.
- `frame-src 'self' blob:` and `media-src 'self' blob:` are required for the in-modal PDF iframe and scanner blob previews respectively.
- Browsers that don't understand `Content-Security-Policy-Report-Only` simply ignore it; no functional regression risk.
