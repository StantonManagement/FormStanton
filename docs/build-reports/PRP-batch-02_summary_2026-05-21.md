# Batch 02 — Accessibility Summary (PRP-006..009)

**Date:** 2026-05-21
**Branch:** `feat/pbv-post-audit-remediation`

## Per-PRP commits
| PRP | Slug | Commit | Per-PRP gates |
|-----|------|--------|---------------|
| 006 | signature-pad-keyboard-fallback-and-a11y | `ee10d14` | tsc ✅ ; vitest 7/7 ✅ |
| 007 | signing-modal-focus-and-announcements | `3fc1c0f` | tsc ✅ ; vitest 7/7 ✅ |
| 008 | formsstack-stepper-announcements | `9bd8f8b` | tsc ✅ ; vitest 5/5 ✅ |
| 009 | landmarks-skiplink-and-status-a11y | `8ca9036` | tsc ✅ ; vitest 5/5 ✅ |

## Batch-boundary gates
- **Full `npm run build`** — **clean.** (`CRON_SECRET` dummy env reused from Batch 01 to satisfy the new validate-env gate locally.)
- Pattern-sweep results below.

## Pattern sweep (touched-files & adjacent shapes)
- **Other static-error `<p>` candidates** not in this batch's scope:
  - `components/pbv/intake/IntakeShell.tsx:177` — `navError` paragraph at the footer; not wrapped in `aria-live`. Follow-up: same role=status pattern as the FormsStack stepper-error region.
  - `components/pbv/intake/SectionReview.tsx:146` — review submit error inline `<p>`; same treatment recommended.
- **Other modals lacking focus management**:
  - `components/pbv/DedupApplyDialog.tsx` — `fixed inset-0 z-50` shape suggests a modal; not edited here. Follow-up: same `useModalFocusTrap`-style hook.
  - `components/pbv/cards/DocumentCard.tsx` and `components/pbv/TenantDocumentUpload.tsx` use the modal-CSS shape too — need to confirm whether they actually behave as dialogs before deciding.

## Deferred runtime gates (need a preview + assistive tech)
- Tab through every tenant route → skip-link is always the first focusable element; jumps cleanly to the page body.
- iPhone Safari rotate test on signing modals → buttons reachable under URL bar (dvh).
- NVDA + VoiceOver: stepper "Signing 2 of 5" announced; signature-pad mismatch announced; intake "Section 3 of 5" announced.
- axe-core scan on `/pbv-full-app/[token]/intake/[section]`, `/sign/summary`, `/sign/forms`, `/dashboard`, `/documents`: zero violations on the components touched here. (PRP-022 wires the axe harness.)
- Grayscale: open the documents page → status badges still distinguishable (label text + dot SR announcement).
- iPhone Safari: open the form modal, scroll inside the PDF iframe → outer panel scrolls when the inner is exhausted; the "Scroll down to continue" cue is visible.

No PR opened — per the protocol the single PR opens at end of Batch 05.
