# Cursor Prompt — PRD-18: Multi-Signer Correctness

**PRD:** `docs/18-pbv-multi-signer-correctness_prd_2026-05-14.md`
**Build report:** `docs/build-reports/18-multi-signer-build-report_2026-05-14.md`
**Depends on:** PRD-15 merged (finalize endpoint and canvas refs fix must be in place).

---

## Context

Multi-adult households flow through the signing surface with a `signerStep` machine (`handoff → signing → done`). Build per-signer event logging, update the finalize validation to attribute missing items to specific signers, add a signature-review preview screen, and implement per-doc re-sign.

---

## Required reading

1. `docs/18-pbv-multi-signer-correctness_prd_2026-05-14.md`
2. `docs/15-pbv-submission-finalization_prd_2026-05-14.md` — finalize endpoint contract.
3. `docs/verification-methodology_2026-05-13.md`
4. `app/pbv-full-app/[token]/page.tsx` — `signerStep` machine, `handleAdvanceSigner`, signing render blocks (lines ~1355-1515).
5. `app/api/t/[token]/pbv-full-app/signatures/route.ts` — current signature save endpoint and data model.
6. `lib/pbv/finalizeValidation.ts` (from PRD-15) — validation helper to extend.
7. The signature storage layer — confirm whether sigs are stored as canvas dataURLs or as separate file blobs.

---

## Closed decisions

1. Per-signer event logging via `tenant_signer_completed` event.
2. Signature review is its own `pageState`, not a modal.
3. Per-doc re-sign, not per-signer.
4. No decline-to-sign flow, no quality detection, no multi-device handoff.

---

## Open decisions

1. **Server-inferred vs client-driven event log.** Decide and document. Server-inferred is cleaner but more work in the signatures POST.
2. **Signature storage model.** Read the existing data path. The review screen's thumbnail rendering depends on this.

---

## Build this pass

### Commit 1 — Per-signer event log

Implement per open decision 1. Event type `tenant_signer_completed`, payload `{ signer_id, slot, name, completed_at }`.

**Done when:** Each signer's `done` transition produces a row. No duplicate rows on replay.

### Commit 2 — Validation helper extension

Update `lib/pbv/finalizeValidation.ts` (from PRD-15) to walk per-adult required signatures. Return shape:

```ts
{
  ready: boolean;
  missing: {
    documents: Array<{ doc_id: string; doc_label: string; person_slot: number }>;
    signatures: Array<{ signer_name: string; doc_label: string; doc_id: string }>;
  };
}
```

Update finalize endpoint response and client error render to use the new shape.

**Done when:** 2-adult app with one missing sig produces a clear, signer-attributed error.

### Commit 3 — Signature review screen

- Add `'signature_review'` to the `PageState` type.
- Wire transition: last-signer-done → `signature_review` (not directly to finalize POST).
- Build the render: list every signature with thumbnail + doc label + signer name + per-doc re-sign button.
- "Confirm and Submit" button triggers finalize. On success: `confirmed`. On 422: error UI with missing list (per Commit 2 shape). On 5xx: retry.

**Done when:** Last signer finishes → lands on review screen → can re-sign individual docs → confirm submits and locks.

### Commit 4 — Per-doc re-sign

Clicking "re-sign" on a doc:
- Sets a per-doc resign state (e.g., `resigningDocId`).
- Renders a single-doc canvas surface (reuse the existing canvas markup from `signerStep === 'signing'`, scoped to one doc).
- Save replaces the stored signature for that doc; returns to `signature_review`.

**Done when:** Re-sign one doc → canvas shows blank → sign → save → back to review with updated signature. No other signatures affected.

### Commit 5 — Translations

Add `sig_review_*` keys to `lib/pbvFullAppTranslations.ts` for en/es/pt. Verify Spanish/Portuguese against existing conventions.

**Done when:** Review screen renders correctly in all three languages.

---

## Build verification (Windows/PowerShell) — read this before running `npm run build`

PRD-16 lost time to PowerShell behavior. Don't repeat the same trap:

- **Do NOT pipe `npm run build` through `Select-Object -First N` or `-Last N`.** It truncates output before "Compiled successfully" appears, making clean builds look broken or hung. Run `npm run build` directly. If you need to capture output, use `Tee-Object`: `npm run build 2>&1 | Tee-Object build.log`.
- **Do NOT trust PowerShell's implicit exit code for npm commands.** Next.js writes the middleware-to-proxy deprecation warning to stderr, which PowerShell sometimes surfaces as exit code 1 even on a fully successful build. Use `$LASTEXITCODE` for the real node exit code, or inspect output directly.
- **A successful build looks like:** `✓ Compiled successfully in Xs` → `Running TypeScript ...` → `Collecting page data ...` → `Generating static pages ...` → route table prints. Any of the last three steps failing is a real problem. The middleware deprecation warning is NOT.
- If you delete a route file, **clear `.next/` before re-building** (`Remove-Item -Recurse -Force .next`). The cached type validator references the deleted file and causes spurious failures.

---

## Verification

1. 2-adult E2E manual: full flow including re-sign of one doc.
2. DB inspection: per-signer event rows present.
3. Validation 422 test: clear signer-attributed missing list.
4. Replay: re-finalizing after success returns existing `submitted_at` (PRD-15 invariant preserved).
5. Mobile layout: review screen usable on a narrow viewport.
6. Build / lint / type-check clean.

---

## Anti-patterns — do NOT

- Do not bypass the review screen. Finalize is always preceded by the review confirmation.
- Do not re-sign entire signers' flows when only one doc needs correction.
- Do not write multiple event rows per signer.
- Do not implement decline-to-sign or alternate-designation flows.
- Do not widen scope into signature quality detection (blank canvas, illegible, etc.).

---

## Build report

Cover: open decisions and rationale, signature storage model finding, screenshots of the review screen in en/es/pt, 2-adult E2E walkthrough notes.

Post PR + build report + open items. Don't merge without sign-off.
