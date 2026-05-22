# PRP-012 — Auto-Save & Signing-Ceremony Recovery

**Assigned batch (per BATCH_PLAN.md):** 03
**Source:** `docs/audits/pbv-angle-2-audit_2026-05-21.md` — **C5** (Medium), **C6** (Medium), **E5** (Low), **E2** (Medium).
**Depends on:** **PRP-011** — its `tenantFetch` change adds support for a caller-supplied `idempotencyKey`; this PRP passes the composed signing key through that support. PRP-011 is earlier in the same batch (03). If PRP-011 has not landed, the key passthrough harmlessly no-ops (record it).
**Inputs (read before editing):** `lib/pbv/hooks/useSectionAutoSave.ts` (~85–98 the `JSON.stringify` dep), `lib/pbv/hooks/useSigningCeremony.ts` (~42–95 capture/sign, ~100–133 `signWithExisting` + the discarded composed key), and what intake state holds (to avoid persisting anything sensitive not already client-side).
**Outputs (write — the ONLY files this PRP may modify/create):** `lib/pbv/hooks/useSectionAutoSave.ts`, `lib/pbv/hooks/useSigningCeremony.ts`, new test(s).
**Acceptance criteria:**
- Intake section data is backed up to `localStorage` on change and cleared on a confirmed server save; on mount a newer backup is restored (or offered).
- `ceremonyId` + `signatureImagePath` persist in `sessionStorage` so a refresh/modal re-open reuses the captured signature; cleared on completion.
- No `JSON.stringify` in a dependency array (dirty-flag ref instead).
- The composed idempotency key is passed to `tenantFetch` (not discarded).

## Context (self-contained)
`useSectionAutoSave` posts every ~600ms but holds state only in React memory, so a refresh loses unsaved section data; its effect dep uses `JSON.stringify(data)`, serializing large intake objects every render. `useSigningCeremony` doesn't persist the captured signature, so a refresh/modal re-open forces a redraw, and it computes a composed `${ceremonyId}-${formDocumentId}` idempotency key but discards it (`void idempotencyKey`). The `tenantFetch` support for honoring that key is added by PRP-011 (same batch, earlier).

## Problem
- **C5:** no local backup of in-progress intake. **C6:** ceremony state lost on remount/refresh. **E5:** `JSON.stringify` in a dep. **E2:** callback churn + discarded composed key.

## Goals
1. **C5:** debounced `localStorage` backup (`pbv_intake_${token}_${section}`) on change; clear on confirmed save; on mount compare backup vs server and auto-restore with a visible "we restored your unsaved changes" notice (or offer on genuine conflict). Private-mode safe (fail silent).
2. **E5:** replace the `JSON.stringify` dep with a dirty-flag ref (or deep-equality hook); identical debounce behavior.
3. **C6/E2:** persist `ceremonyId`/`signatureImagePath` in `sessionStorage`; rehydrate on mount; clear on completion; pass the composed key into `tenantFetch` (via PRP-011's support); stabilize callback deps.

## Non-goals
- No offline write queue. No change to the signature component or modals. **Do not persist anything not already in client memory** (no new sensitive data at rest — confirm intake fields first). Do not edit files outside the Outputs list.

## Implementation
1. localStorage backup + restore in `useSectionAutoSave`; dirty-flag dep.
2. sessionStorage ceremony persistence + key passthrough + stable deps in `useSigningCeremony`.

## Verification (per-PRP gates, before commit)
- `node ./node_modules/typescript/bin/tsc --noEmit` clean.
- `node ./node_modules/.bin/vitest run lib/pbv/hooks/__tests__/useSectionAutoSave* lib/pbv/hooks/__tests__/useSigningCeremony*` — backup written on change + cleared on save; restore on newer backup; no `JSON.stringify` per render; ceremony key passed to `tenantFetch`; `signatureImagePath` rehydrates from `sessionStorage`.
- **No full build per PRP** (batch boundary runs it).
- **Deferred runtime gates:** type intake → refresh → restored; capture a signature → refresh signing page → no redraw; localStorage cleared after a successful save.
