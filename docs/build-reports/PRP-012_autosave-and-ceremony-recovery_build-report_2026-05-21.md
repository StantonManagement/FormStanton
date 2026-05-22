# PRP-012 — Auto-Save & Ceremony Recovery — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-post-audit-remediation`
**Commit:** `2f9265a6a3e764bfba051810749f796e25b7d6fd`
**Findings closed:** Angle-2 **C5**, **C6**, **E2**, **E5**.

## Files changed
- `lib/pbv/hooks/useSectionAutoSave.ts` — localStorage backup write/clear/restore, dirty-flag dep.
- `lib/pbv/hooks/useSigningCeremony.ts` — sessionStorage ceremonyId + signatureImagePath persistence, composed `idempotencyKey` passthrough to tenantFetch, `completeCeremony()` reset.
- `lib/pbv/hooks/__tests__/useSectionAutoSave-backup.test.ts` *(new)* — 5 tests.
- `lib/pbv/hooks/__tests__/useSigningCeremony-recovery.test.ts` *(new)* — 6 tests.

## Path taken (defaults logged)
- **Surface vs auto-apply restore:** the backup is *surfaced* via `restoredFromBackup`, not auto-applied to caller state. The caller (intake section page) is responsible for confirming + merging — this avoids silently overwriting a fresh server-side value if the user had typed on a different device between sessions. Wiring the merge into the section page is a follow-up.
- **Persist the signature PATH, not the image bytes.** Aligns with "no new sensitive data at rest" — the path is a storage reference, not the PII image; the actual bytes still live only in Supabase Storage.
- **Composed key passthrough depends on PRP-011.** With PRP-011 landed (earlier in this batch), `tenantFetch` honors `idempotencyKey` verbatim. Without it the key would have been silently ignored. Verified via `useSigningCeremony-recovery.test.ts` — the test asserts the option reaches `tenantFetch`, which is exactly what PRP-011 forwards as the `Idempotency-Key` header.
- **Dirty-flag dep:** simplest correct shape — keep `data` in the deps (so React handles invalidation), but body short-circuits via a serialized snapshot in a ref. Avoids the per-render stringify the original had as the dep argument.

## Per-PRP gates
- `node ./node_modules/typescript/bin/tsc --noEmit` — **clean.**
- `node node_modules/vitest/dist/cli.js run lib/pbv/hooks/__tests__/useSectionAutoSave-backup.test.ts lib/pbv/hooks/__tests__/useSigningCeremony-recovery.test.ts` — **11 pass / 0 fail.**

## Deferred runtime gates
- Type intake → refresh → restored-from-backup notice appears + content is preserved.
- Capture a signature → refresh the signing page → no redraw required, `hasSignature === true` on mount.
- localStorage entry is cleared after the next successful debounced save (DevTools Application panel).
- Trigger a network blip mid-`sign-form` → PRP-011 backoff retries with the SAME `Idempotency-Key` → server collapses the duplicate (`pbv_signature_events` row count = 1).

## Follow-ups
- Wire the restore notice in `IntakeShell` / section page: read `restoredFromBackup`, show a banner with "Use my saved version" / "Discard", call `acknowledgeRestore()` on dismiss.
- Call `completeCeremony()` from the FormsStack "all signed" terminal state so the next start mints a fresh ceremony.
