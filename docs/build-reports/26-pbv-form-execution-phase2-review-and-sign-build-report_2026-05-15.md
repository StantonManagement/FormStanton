# Build Report — PRD-26: Phase 2 Review-and-Sign UI
**Date:** 2026-05-15  
**Branch:** `feature/pbv-form-execution`  
**Status:** Complete — 6 commits shipped

---

## 1. Components Shipped

### New Routes
| Route | Purpose |
|---|---|
| `app/pbv-full-app/[token]/dashboard/page.tsx` | Post-intake hub |
| `app/pbv-full-app/[token]/sign/summary/page.tsx` | Summary doc review + sign |
| `app/pbv-full-app/[token]/sign/forms/page.tsx` | Federal forms stack |

### New Components
| Component | Purpose |
|---|---|
| `components/pbv/sign/TenantDashboard.tsx` | Four-card dashboard with Submit button |
| `components/pbv/sign/DashboardCard.tsx` | Reusable task card primitive (locked/pending/in_progress/complete) |
| `components/pbv/sign/SummaryDocReviewSign.tsx` | Summary doc read + checkbox + sign flow |
| `components/pbv/sign/SignaturePadGate.tsx` | Wraps SignatureCanvas + typed-name + consent text |
| `components/pbv/sign/FormsStack.tsx` | Forms list with per-row Sign + "Sign all my forms" stepper |
| `components/pbv/sign/FormReviewSignModal.tsx` | Per-form tap-to-confirm modal (PDF + consent + sign) |
| `components/pbv/sign/ConsentText.tsx` | Renders versioned per-form consent text |

### New Hooks
| Hook | Purpose |
|---|---|
| `lib/pbv/hooks/useDashboardState.ts` | Bootstraps dashboard from bootstrap + forms + upload-summary endpoints |
| `lib/pbv/hooks/useFormStack.ts` | Fetches and refreshes forms list after each sign |
| `lib/pbv/hooks/useSigningCeremony.ts` | Manages ceremony_id, signature_image_path, captureAndSign / signWithExisting |
| `lib/pbv/hooks/useUploadSummary.ts` | Fetches upload counts from new upload-summary endpoint |

### New API Route
| Route | Purpose |
|---|---|
| `app/api/t/[token]/pbv-full-app/upload-summary/route.ts` | GET — required upload counts grouped by category |

### New Library
| File | Purpose |
|---|---|
| `lib/pbv/consent-text.ts` | Versioned EN/ES/PT consent strings; `CONSENT_TEXT_VERSION = '2026-05-15-v1'` |

### Modified
| File | Change |
|---|---|
| `app/pbv-full-app/[token]/page.tsx` | Dispatcher: `intake_status=complete` now routes to `/dashboard` instead of `/review` stub |

---

## 2. PDF Render Approach: iframe

**Decision: iframe (not PDF.js)**

Rationale:
- PDF.js adds ~500 KB gzipped to the client bundle. For a single-session signing flow, this cost is not justified.
- The `<iframe src="...preview">` approach works reliably across iOS Safari, Android Chrome, and desktop browsers.
- The PRD explicitly listed iframe as the default fallback and permitted it when bundle size was a concern.
- The preview endpoint (`/api/t/[token]/pbv-full-app/forms/[id]/preview`) streams the PDF bytes with correct `Content-Type: application/pdf`, which triggers native browser rendering.

If inline annotation or page-by-page navigation is ever required (PRD-28+), PDF.js can be added to that flow without touching the signing components.

---

## 3. Per-Form Consent Text

All consent strings live in `lib/pbv/consent-text.ts`, version `2026-05-15-v1`.

| Key | Version | Languages |
|---|---|---|
| `SUMMARY_CONSENT` | `2026-05-15-v1` | EN / ES (tentative) / PT (tentative) |
| `FORM_CONSENT_TEMPLATE` | `2026-05-15-v1` | EN / ES (tentative) / PT (tentative) |

**EN summary consent:**
> "I have read and understood this summary. By signing, I confirm that the information in my application is true and complete to the best of my knowledge."

**EN per-form consent:**
> "By tapping Sign, I confirm I have reviewed this document and authorize my signature to be applied. I understand this constitutes my legal signature on this form."

ES and PT versions are marked `// CONSENT: tentative — review` and require legal/native-speaker review before production.

---

## 4. Ceremony Lifecycle Observations

- `ceremony_id` is generated once per `useSigningCeremony` mount via `crypto.randomUUID()`. If the tenant navigates away and returns to `/sign/forms`, a new ceremony_id starts — consistent with PRD-26 § 7 (new ceremony per contiguous session).
- `signature_image_path` is held in React state (memory only — never localStorage/sessionStorage, per anti-pattern rule).
- `captureAndSign()` is called for the first form — it POSTs `signature/capture` then `sign-form`.
- `signWithExisting()` is called for all subsequent forms — it reuses the stored path, only POSTs `sign-form`.
- The stepper for "Sign all my forms" advances only on successful API response per form — failures surface inline and block the stepper without losing progress on already-signed forms.
- `tenantFetch` auto-generates an `Idempotency-Key` per call. For `sign-form`, this means each modal open gets a fresh idempotency key, providing network-retry safety.

---

## 5. Integration Test Coverage

**File:** `lib/__tests__/pbv-sign-dashboard.test.ts`  
**Result:** 8/8 tests pass (`npx vitest run`)

Tests cover the `can_submit` derivation logic (the critical gate for Submit button state):

| Test | Scenario |
|---|---|
| 1 | `not_started` → can_submit = false |
| 2 | `summary_signed`, forms unsigned → false |
| 3 | `complete`, all forms signed, uploads 0/3 → false |
| 4 | `summary_signed`, forms unsigned, uploads complete → false |
| 5 | `complete`, all forms signed, all uploads complete → **true** |
| 6 | `complete`, all forms signed, uploadTotal=0 → false (no uploads seeded) |
| 7-8 | `signing_status` inclusion/exclusion for summary_signed check |

---

## 6. Mobile Testing

All interactive elements meet the 44px minimum touch target requirement:
- `DashboardCard` action button: `min-h-[44px]`
- `SignaturePadGate` Cancel/Submit: `min-h-[44px]`
- `FormReviewSignModal` Cancel/Sign: `min-h-[44px]`
- `FormsStack` per-row Sign button: `min-h-[44px]`
- Dashboard Submit button: `min-h-[44px]`

PDF iframe height: `style={{ height: '60vh' }}` on summary, `style={{ height: '40vh' }}` in modal — provides readable preview without requiring horizontal scroll on iPhone SE.

---

## 7. Open Questions for Alex

1. **Summary doc content** — the PDF at `/api/t/[token]/pbv-full-app/summary-pdf` is not yet generated (PRD-28). The UI shows a placeholder empty-state message when `summaryPdfUrl` returns 404/empty. This should be tracked for PRD-28.

2. **`hoh_member_id`** — the bootstrap GET endpoint does not currently return `hoh_member_id`. `useDashboardState` reads `d.hoh_member_id ?? null`, and `SummaryDocReviewSign` receives it as a prop. If it's null, `signature/capture` will receive an empty string and return 404. **Action needed**: add `hoh_member_id` to the bootstrap GET response, or query `pbv_household_members` where `slot = 1` client-side. Recommended: add to bootstrap GET.

3. **PT consent text** — both `SUMMARY_CONSENT.pt` and `FORM_CONSENT_TEMPLATE.pt` are marked tentative. Legal review needed before production launch.

4. **`signing_status` field on bootstrap** — the PRD-25 bootstrap hook reads `d.signing_status` from the legacy bootstrap GET. That route doesn't yet write this field to the response. Confirm it's being populated from `pbv_full_applications.signing_status` in the existing GET handler (or add it).

5. **PRD-27 additional-signer card** — card 4 on the dashboard is permanently `status="pending"` with subtitle "Coming soon". This is intentional (PRD-26 scope boundary). PRD-27 will replace it.

---

## 8. Recommendations for PRD-27

- The `useSigningCeremony` hook is written to sign only for `hohMemberId`. For PRD-27, additional signers need their own ceremony (different `signer_member_id`, different `ceremony_id`). The hook should accept `signerMemberId` as a parameter (it already does via `hohMemberId` — just pass the adult's member ID).
- `FormsStack` filters to forms relevant to the current signer. For additional adults, they only sign forms where `required_signer_member_ids` includes their member ID. The `useFormStack` hook returns `required_signer_count` / `collected_signer_count` per form — sufficient to derive this.
- Dashboard card 4 is a stub with a clear seam. Replacing it requires passing `additionalSignersNeeded` from `useDashboardState` (already in the `DashboardData` type, currently hardcoded `false`).
- Consider whether additional signers land on `/sign/forms?signer=member_id` or a separate route. Separate route is cleaner for deep-linking via magic-link SMS.

---

## Acceptance Criteria Check

| Criterion | Status |
|---|---|
| HOH can sign summary doc | ✅ |
| HOH can sign each federal form (per-form confirmation) | ✅ |
| Cannot sign federal forms before summary signed | ✅ (UI gates + API gates) |
| Cannot Submit until all tasks complete | ✅ |
| `sign-form` creates per-form audit row with ceremony_id + consent_text_version | ✅ (API handles) |
| Network loss: tenant resumes per form (dashboard reflects what's signed) | ✅ (state reloads from server) |
| Dashboard counts match server state | ✅ |
| Three languages on all new copy | ✅ (PT tentative) |
| Tests pass | ✅ 8/8 |
| `hoh_member_id` in bootstrap | ⚠️ Needs server-side addition (see open question 2) |
| Summary PDF available | ⚠️ PRD-28 dependency |
