# Correction: `/review` page crash (React #310) — PRD-67 tenant review surface

**Date:** 2026-05-21
**Surface:** `app/pbv-full-app/[token]/review/page.tsx` (PRD-67 Step 2, tenant review-of-application)
**Severity:** Hard crash — the review surface is unusable for tenants and staff on this token.
**Type:** Single-file correction. Cowork diagnosis; hand to Windsurf to build.

---

## TL;DR

The crash is a **Rules-of-Hooks violation in `review/page.tsx`**, not a data problem. `useSectionVisibility(...)` (which calls `useMemo`) is invoked *after* two conditional early returns. The hook set on the `ready` render differs from the `loading` render, so React aborts with the hooks-count invariant (minified #310). The correction is to move that one hook **above** the early returns and feed it a guarded `intake_data`, mirroring the sibling intake page that already does this correctly.

This is **independent of the building/unit reuse** — see "On the building/unit theory" below for the evidence.

---

## Symptom (observed in a live walk, 2026-05-21)

Opening `/pbv-full-app/<token>/review` renders the app's error boundary:

> "Something went wrong loading this page."
> `Minified React error #310 …`
> stack terminates at `Object.oo [as useMemo]` inside the `review/page` chunk.

## Root cause (verified by reading the code)

`app/pbv-full-app/[token]/review/page.tsx`:

- Lines 90–92 call three hooks unconditionally: `use(params)`, `useRouter()`, `useIntakeBootstrap(token)`.
- Lines 94–117 contain two **conditional early returns** — one for `state.status === 'loading'`, one for `state.status === 'error'`.
- Line 128 then calls `const visibleSlugs = useSectionVisibility(data.intake_data);` — **a hook, placed after the early returns.**

`useSectionVisibility` (`lib/pbv/hooks/useSectionVisibility.ts:57`) is a `useMemo`. `useIntakeBootstrap` (`lib/pbv/hooks/useIntakeBootstrap.ts:39`) initializes to `{ status: 'loading' }` and only flips to `ready` after its `useEffect` fetch resolves. So the first client render is always `loading`:

- **Render 1 (`loading`):** runs the 3 top hooks, then early-returns at line 95 — the `useMemo` at line 128 is never reached.
- **Render 2 (`ready`):** the `loading`/`error` guards are now false, execution falls through to line 128, and the `useMemo` runs.

The hook sequence executed differs between the two commits. That violates the Rules of Hooks, and React aborts at the diverging hook — the `useMemo`, exactly where the stack trace ends. React #310 is the hooks-count/order invariant.

[Verified] from source: `review/page.tsx` lines 90–128; `useIntakeBootstrap.ts` line 39; `useSectionVisibility.ts` line 57.

## Scope — this is a lone offender, not a pattern

The three sibling pages that use the same hooks call `useSectionVisibility` (and all other hooks) **before** their early returns:

- `app/pbv-full-app/[token]/intake/[section]/page.tsx` — hook at line 76; early returns at 133/141. Correct.
- `app/pbv-full-app/[token]/documents/page.tsx` — all hooks (incl. `useMemo` line 183) before returns at 244/252. Correct.
- `app/pbv-full-app/[token]/intake/page.tsx` — hooks before returns at 177/185. Correct.

Only `review/page.tsx` places the hook after the guards. No other instance of this pattern was found among the `useSectionVisibility` / `useIntakeBootstrap` consumers.

## On the building/unit theory

The hypothesis was that this token reusing the same building + unit as a prior applicant caused the crash. The code does not support that as the cause of this crash:

- The bootstrap endpoint `app/api/t/[token]/pbv-full-app/route.ts` resolves the application by `tenant_access_token` (line 21, `.maybeSingle()`), which is unique per application.
- Every downstream query keys on the unique `app.id` (`full_application_id` / `anchor_id`). Household members, documents, and signatures are all scoped to that id — not to building/unit.
- Building + unit appear in this route only as (a) returned display fields and (b) a `tenant_lookup` phone-hint fallback (lines 64–70). Neither can crash the React render.

[Inference, labeled] The one place building/unit reuse could produce a *different* (non-crash) symptom is that phone-hint fallback: if two `tenant_lookup` rows share building + unit and both are `is_current = true`, `.maybeSingle()` could surface the wrong tenant's phone. That is a separate, lower-severity concern worth a follow-up, but it is not the `/review` crash.

The crash reproduces for any token whose bootstrap goes `loading → ready` — i.e., effectively every load — because the trigger is render sequencing, not row data.

## The correction

Mirror the proven pattern in `intake/[section]/page.tsx` (lines 67–76): resolve a guarded `intake_data` and call `useSectionVisibility` **before** the early returns. Keep the rest of the component as-is.

In `app/pbv-full-app/[token]/review/page.tsx`, move the `visibleSlugs` computation up so all hooks run unconditionally:

```tsx
export default function ReviewApplicationPage({ params }: Props) {
  const { token } = use(params);
  const router = useRouter();
  const { state } = useIntakeBootstrap(token);

  // Compute visible sections BEFORE any early return so the hook set is
  // identical on the loading, error, and ready renders. Guard intake_data
  // the same way intake/[section]/page.tsx does (lines 67–69).
  const intakeData: IntakeData =
    state.status === 'ready' ? state.data.intake_data : EMPTY_INTAKE_DATA;
  const visibleSlugs = useSectionVisibility(intakeData);

  if (state.status === 'loading') {
    // …unchanged…
  }
  if (state.status === 'error') {
    // …unchanged…
  }

  const data = state.data;
  // …unchanged below; delete the old line-128 useSectionVisibility call…
}
```

Add a module-level stable empty constant so the `useMemo` dependency reference does not change on non-ready renders:

```tsx
const EMPTY_INTAKE_DATA = {} as IntakeData;
```

`useSectionVisibility` already tolerates an empty object — `deriveMembers` reads `intakeData.household?.members ?? []` (`useSectionVisibility.ts:34`), so the guarded value is safe.

**Constraints:** single file (`review/page.tsx`). Do not change `useSectionVisibility`, `useIntakeBootstrap`, or the sibling pages. Do not alter the read-only scope of the review surface (PRD-67).

## Verification gate

Static (per `docs/SHELL-PROTOCOL.md`):

- `node ./node_modules/typescript/bin/tsc --noEmit` — clean.
- `npm run build` — succeeds.

Runtime (manual Chrome walk — no Playwright/e2e gate):

- Load `/pbv-full-app/<token>/dashboard` → click **Review my application**.
- Confirm the review surface renders the building/unit card and the visible intake sections, with no error boundary and no `#310` in the console.
- Hard-reload `/review` directly (cold `loading → ready`) and confirm it still renders.

A green build alone is not the bar — this defect compiled cleanly and still crashed at runtime. The runtime walk is required.

## Related but separate (not in this correction)

While verifying the summary signing step, the **"Sign"** action is gated on the typed name matching `head_of_household_name` for the token; a non-matching name yields "The name you entered does not match our records." That is expected validation, tracked separately from this crash. The summary signing page itself rendered and captured the signature correctly.
