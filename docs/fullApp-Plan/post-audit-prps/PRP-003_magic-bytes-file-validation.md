# PRP-003 — Magic-Bytes File Validation

**Assigned batch (per BATCH_PLAN.md):** 01
**Source:** `docs/audits/pbv-angle-2-audit_2026-05-21.md` — finding **D4** (High).
**Depends on:** None — operates on current `main`. (Assumes current `main` already has, in the upload route, an affected-row race guard with orphan cleanup. **Preserve it** — add validation *before* the storage upload.)
**Inputs (read before editing):** `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts` (esp. the `file.type` allow-list ~86–91 and the storage-upload path), and confirm whether HEIC reaches the server or is converted to JPEG client-side first (`components/DocumentScanner/DocumentScanner.tsx` heic2any path).
**Outputs (write — the ONLY files this PRP may modify/create):** `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts`; new `lib/upload/magicBytes.ts`; new magic-bytes test(s).
**Acceptance criteria:**
- The upload route validates the actual file header (magic bytes) before storage; a mismatch returns **415** and `storage.upload` is **not** called.
- Allowed true types: JPEG, PNG, PDF (+ HEIC/HEIF iff HEIC reaches the server).
- Zero-byte/unreadable buffers are rejected (415/400).
- The existing race guard + orphan cleanup is preserved.

## Context (self-contained)
The upload route checks the browser-supplied `file.type` against an allow-list. `file.type` is derived from the extension and is trivially spoofed — a renamed `evil.exe`→`id.jpg` reports `image/jpeg`. The fix is a server-side magic-bytes check on the actual buffer (the route already reads the file bytes to upload them). **Adversarial framing:** a hostile tenant uploads a renamed executable; today it passes and is stored. After this PRP the true bytes are inspected and a non-allowed type is rejected pre-storage. Secondary benefit: catches truncated/corrupt uploads.

## Problem
- **D4:** MIME allow-list trusts spoofable `file.type`; bytes are never inspected.

## Goals
1. `lib/upload/magicBytes.ts`: `detectMagicType(buffer) → 'jpeg'|'png'|'pdf'|'heic'|null` (leading-byte signatures: JPEG `FF D8 FF`, PNG `89 50 4E 47`, PDF `25 50 44 46`, HEIC/HEIF `ftyp` box) + `isAllowedUpload(buffer, claimedMime)`. Dependency-light, unit-testable.
2. In the upload route, after reading the buffer and **before** `storage.upload`, reject mismatches with 415 `unsupported_media_type`. Preserve the existing affected-row/orphan-cleanup ordering. Reject zero-byte buffers.

## Non-goals
- No deep content scan/AV.
- No change to client-side HEIC conversion or the scanner.
- No heavyweight dependency unless `file-type` is already present (then reuse it); otherwise hand-roll the small signature set.
- Do not edit files outside the Outputs list.

## Implementation
1. `lib/upload/magicBytes.ts` with the signature checks above.
2. Wire into the upload route: validate buffer → 415 on mismatch (before storage), preserving the race guard. Confirm the real allowed set + whether HEIC arrives server-side before adding HEIC signatures.

## Verification (per-PRP gates, before commit)
- `node ./node_modules/typescript/bin/tsc --noEmit` clean.
- `node ./node_modules/.bin/vitest run lib/upload/__tests__/magicBytes*` — real JPEG/PNG/PDF prefixes allowed; an `image/jpeg`-claimed buffer with `MZ` (exe) bytes rejected; zero-byte rejected; (HEIC `ftyp` allowed iff in scope). If the route is unit-testable with a mocked Supabase: spoofed file → 415 and `storage.upload` not called; valid → proceeds; race guard still fires.
- **No full build per PRP** (batch boundary runs it).
- **Deferred runtime gate:** on a preview, upload a renamed `.exe`→`.jpg` → 415; a real photo + a real PDF → accepted and viewable.

**Default for ambiguity:** reject anything whose true bytes are not an allowed type; do NOT reject solely on a claimed-vs-detected mismatch among allowed types (a browser mislabeling PNG as JPEG should not block a valid image). Log the choice.
