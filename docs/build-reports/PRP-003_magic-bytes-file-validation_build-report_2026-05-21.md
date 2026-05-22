# PRP-003 — Magic-Bytes File Validation — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-post-audit-remediation`
**Commit:** `e55b8b0a093efd590f29309d1aff76934d2bfd94`
**Findings closed:** Angle-2 audit — **D4**

## Files changed
- `lib/upload/magicBytes.ts` *(new)* — `detectMagicType` + `detectedToMime` + `isAllowedUpload` + `DEFAULT_ALLOWED_UPLOAD_TYPES`.
- `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts` — buffer is read and validated by magic bytes **before** `storage.upload`. Detected-as-HEIC branch is the only path into sharp's HEIC conversion. Legacy MIME allow-list kept as belt-and-suspenders.
- `lib/upload/__tests__/magicBytes.test.ts` *(new)* — 18 tests.

## Path taken
- **Ambiguity default applied:** mismatch *among* allowed types does **not** block (browser mislabel PNG as `image/jpeg` should still succeed). Mismatch is logged via the route's `[pbv-upload] rejected` warning when applicable.
- **HEIC branch now keys off detected type, not `file.type`.** Previously the route entered sharp's HEIC path whenever `file.type === 'image/heic'`, which would have crashed sharp on an actually-PDF buffer claimed as `image/heic`. Now the branch only fires when the bytes match an HEIF brand (`heic`, `heix`, `heim`, `heis`, `hevc`, `hevx`, `mif1`, `msf1`, `heif`).
- **Status mapping:** zero-byte → 400 (`{ message: 'Empty file. ...' }`), spoofed/unknown → 415 (`{ message: 'Invalid file type. ...' }`).
- **Race-guard preserved:** the existing affected-row-count guard for the `missing → submitted` transition is untouched; magic-bytes validation happens earlier in the function, before any DB update.

## Deferred runtime gates
- On a preview:
  - Upload a renamed `.exe → .jpg` (with `MZ` header) → 415, row stays `missing`, storage object absent.
  - Upload a 0-byte file → 400.
  - Upload a real JPEG, PNG, PDF, WebP, and HEIC (from an iPhone) → each succeeds and is viewable in staff dashboard.
  - Verify race-guard 409 (`upload_superseded`) still fires when two tabs upload the same `missing` slot.

## Per-PRP gates
- `node ./node_modules/typescript/bin/tsc --noEmit` — **clean.**
- `node node_modules/vitest/dist/cli.js run lib/upload/__tests__/magicBytes.test.ts` — **18 pass / 0 fail / 1.14 s.**

## Notes
- `file-type` npm package not added — the small accepted set + Buffer scan is enough and avoids a new dep. If we later want richer formats or container-introspection, `file-type` (or `magic-bytes` from sindresorhus) is a drop-in replacement.
- HEIC validation is correct iff HEIC actually reaches the server. Some clients pre-convert via heic2any; either way the magic-bytes branch is safe (HEIC bytes detected → sharp conversion; JPEG bytes → no conversion).
