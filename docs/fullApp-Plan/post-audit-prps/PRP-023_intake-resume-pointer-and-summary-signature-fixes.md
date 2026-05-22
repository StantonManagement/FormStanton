# PRP-023 — Intake Resume-Pointer Advance & Summary-Signature NOT NULL Fix

**Assigned batch:** Standalone hotfix (not in the original BATCH_PLAN; run independently). Two production-blocking defects on the PBV full-application tenant path, both verified live on 2026-05-22.
**Source:** Live runtime walk (2026-05-22). Two hard blockers on `feat/pbv-post-audit-remediation`:
- **B1 (intake navigation):** tenant cannot advance past Section 1; every "Next" bounces back to `/intake/household`. Regression from PRP-015's deep-link guard composed with the PRD-32/34 `resume_section` write semantics.
- **B2 (summary signing):** `POST .../sign-summary` returns 500 on every fresh signature — `pbv_signature_events.form_document_id` is `NOT NULL` but summary signatures insert `NULL`. Has been broken since the table was created (`20260515020000`); no migration ever relaxed it.

**Depends on:** none. Layer on top of PRP-010 (`beforeunload` guard) and PRP-015 (deep-link guard) — **do not remove** either; this PRP keeps the guard and fixes the pointer the guard reads.

**Inputs (read before editing):**
- `app/api/t/[token]/pbv-full-app/intake/[section]/route.ts` — section autosave; writes `resume_section`.
- `app/pbv-full-app/[token]/intake/[section]/page.tsx` — `navigateTo` (~158) + the F2 guard (~102–113).
- `app/api/t/[token]/pbv-full-app/sign-summary/route.ts` — inserts `pbv_signature_events` with `form_document_id: null`.
- `lib/pbv/intake-schema.ts` — `SECTION_SLUGS` (canonical order, includes `review`).
- `lib/pbv/tenantEndpoint.ts` — `withTenantContext` (gates + idempotency).
- `supabase/migrations/20260515020000_pbv_signature_events.sql` — original `form_document_id UUID NOT NULL`.

**Outputs (the ONLY files this PRP may modify/create):**
- `app/api/t/[token]/pbv-full-app/intake/[section]/route.ts`
- `app/api/t/[token]/pbv-full-app/intake/progress/route.ts` *(new)*
- `app/pbv-full-app/[token]/intake/[section]/page.tsx`
- `app/api/t/[token]/pbv-full-app/sign-summary/route.ts`
- `supabase/migrations/20260522120000_pbv_signature_events_nullable_form_document_id.sql` *(new)*
- new/updated test(s)

> **Note on current tree state:** these edits and the migration file are already applied in the working tree (verified live for B1 through Submit). Treat every change below as desired end-state and **idempotent** — if a change is already present, no-op. The not-yet-done step is **applying the migration to the database** + running the gates.

**Acceptance criteria:**
- A tenant can advance household → contact → … → review → Submit; no bounce-back. Backward nav to completed sections still works; deep-linking ahead of the furthest-reached section still redirects (PRP-015 intact).
- `resume_section` is a monotonic high-water mark: autosave never lowers it; forward "Next" advances it before routing.
- `POST .../sign-summary` returns 200 and persists the summary signature; `signing_status` → `summary_signed`.
- `pbv_signature_events.form_document_id` is nullable in the live DB; form signatures still set a non-null value.
- Static gates green; PRP-015 deeplink source-grep test still passes.

---

## Context (self-contained)

**B1.** `resume_section` (a real column, PRD-34) is set by the section-autosave POST to *the section currently being saved* (`resume_section: section`). PRP-015 added a guard in `intake/[section]/page.tsx` that redirects any requested section **ahead of** `resume_section` back to it. `navigateTo` calls `saveNow()` (→ autosave → `resume_section = current`) and then `router.push(next)`. So on every forward Next, the target is exactly one index past `resume_section` → the guard bounces it back. Forward navigation is structurally impossible. The two semantics ("last section saved" vs "furthest reached") are incompatible; the fix makes `resume_section` mean **furthest reached**, advanced on forward navigation and never lowered by autosave.

**B2.** The summary signature is not tied to a federal form, so `sign-summary` inserts `pbv_signature_events.form_document_id = NULL` (by design; see the route comment). The column was declared `NOT NULL` at table creation and never relaxed → Postgres `23502` on every insert → opaque 500 (the route had no try/catch, so the body was empty, which is why it hid). Form signatures are unaffected (they set a real `form_document_id`); summary rows with `NULL` are exempt from the `(form_document_id, signer_member_id)` unique constraint under default NULLS-DISTINCT semantics (one summary per application is enforced at the `pbv_summary_documents` layer).

## Problem
- **B1:** `resume_section` write semantics ("current section") collide with PRP-015's guard ("furthest reached") → forward nav bounces.
- **B2:** `pbv_signature_events.form_document_id NOT NULL` blocks every summary signature; no migration relaxes it.

## Goals
1. **B1a** — Autosave must not lower `resume_section`: set it to the further of (existing, section) by `SECTION_SLUGS` index.
2. **B1b** — Add `POST .../intake/progress` that advances `resume_section` to a target section, monotonic (forward-only), behind `withTenantContext` (same gates/idempotency).
3. **B1c** — `navigateTo` calls `progress` for forward moves **before** `router.push`, so the target page's guard reads the advanced pointer. Backward moves skip it. Keep the existing `saveNow()` and scroll-to-top.
4. **B2a** — Migration: `ALTER TABLE public.pbv_signature_events ALTER COLUMN form_document_id DROP NOT NULL;` + column comment + rollback note.
5. **B2b** — Wrap the `sign-summary` handler in try/catch: log the full error server-side, return a generic `{ success:false, code:'server_error' }` 500 (no opaque empty body, no DB-internal leak).

## Non-goals
- No change to the PRP-015 guard condition (`currentIndex > resumeIndex`), the `beforeunload` guard, or the autosave hook's debounce/backup logic.
- No new `canGoNext`/completion gating. Do not edit files outside Outputs.

## Implementation

**1. `intake/[section]/route.ts` (B1a).** Add `resume_section` to the existing `.select(...)`, then replace `resume_section: section` in the update payload with a monotonic value:
```ts
const existingResume = (current?.resume_section as string | null) ?? null;
const order = SECTION_SLUGS as readonly string[];
const nextResume =
  order.indexOf(section) > order.indexOf(existingResume ?? '')
    ? section
    : existingResume ?? section;
// updatePayload.resume_section = nextResume;
```

**2. `intake/progress/route.ts` (B1b) — new file:**
```ts
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withTenantContext } from '@/lib/pbv/tenantEndpoint';
import { SECTION_SLUGS } from '@/lib/pbv/intake-schema';

const ALLOWED_SECTIONS = new Set<string>(SECTION_SLUGS);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  return withTenantContext(request, token, 'intake-progress', async (app) => {
    try {
      const body = await request.json().catch(() => null);
      const target = body?.section;
      if (typeof target !== 'string' || !ALLOWED_SECTIONS.has(target)) {
        return { body: { success: false, message: `Unknown section: ${target}` }, status: 400 };
      }
      const currentResume = (app.resume_section as string | null) ?? null;
      const order = SECTION_SLUGS as readonly string[];
      const shouldAdvance = order.indexOf(target) > order.indexOf(currentResume ?? '');
      const nextResume = shouldAdvance ? target : currentResume ?? target;
      if (shouldAdvance) {
        const { error } = await supabaseAdmin
          .from('pbv_full_applications')
          .update({ resume_section: nextResume, updated_at: new Date().toISOString() })
          .eq('id', app.id);
        if (error) throw error;
      }
      return { body: { success: true, data: { resume_section: nextResume } }, status: 200 };
    } catch (error: any) {
      console.error('[intake/progress] error:', error);
      return { body: { success: false, message: 'Internal server error', code: 'server_error' }, status: 500 };
    }
  }, 'id, submitted_at, resume_section');
}
```

**3. `intake/[section]/page.tsx` (B1c).** Import `tenantFetch`; in `navigateTo`, compute `targetIndex = visibleSections.indexOf(slug)` and `movingForward = targetIndex > currentIndex`. Run the save/advance block when `sectionData || movingForward`: `await saveNow()` if dirty, then if `movingForward` `await tenantFetch('.../intake/progress', { method:'POST', body:{ section: slug } })` and throw on `!res.ok` (reuse the existing nav-error handling). Keep `router.push` + `window.scrollTo`. **Do not** alter the F2 guard, `handleSectionChange`, or the `router.push(...) … scrollTo` ordering (PRP-015 source-grep test depends on them).

**4. `sign-summary/route.ts` (B2b).** Wrap the handler body in `try { … } catch (error:any) { console.error('[sign-summary] error:', {message,code,details,hint}); return { body:{ success:false, message:'Internal server error', code:'server_error' }, status:500 }; }`.

**5. Migration (B2a) — `supabase/migrations/20260522120000_pbv_signature_events_nullable_form_document_id.sql`:**
```sql
ALTER TABLE public.pbv_signature_events
  ALTER COLUMN form_document_id DROP NOT NULL;
```
(plus column COMMENT + rollback note — file already written.) **Apply it:** `supabase db push` (picks up the new migration), or run the `ALTER` against the `lieeeqqvshobnqofcdac` project. Safe: relaxes a constraint only, no data rewrite, instant.

## Verification (gates, before commit) — per `docs/SHELL-PROTOCOL.md`
- `node ./node_modules/typescript/bin/tsc --noEmit` — clean. (Never `npx tsc`.)
- `node ./node_modules/.bin/vitest run` — existing `components/pbv/__tests__/intake-nav-deeplink.test.ts` still green; add a unit test asserting the section-save sets `resume_section` to the monotonic-furthest (never lowers), and that `progress` only raises.
- `npm run build` — green over the merged branch state.
- **No Playwright / e2e gates** (static only).
- **DB:** confirm `form_document_id` is nullable post-apply (`information_schema.columns` → `is_nullable = 'YES'`).
- **Deferred runtime gate (manual Chrome walk on a FRESH invite):**
  1. Admin → PBV Full Applications → **+ New Invitation** → open the magic link on `localhost:3000`.
  2. Walk household → contact → income → assets → childcare → criminal_history → dv_homeless_ra → **review** → **Submit** — no bounce; submit reaches the dashboard with the doc checklist seeded.
  3. Dashboard → "Review and sign your summary" → check the box → Sign → **typed signature** → confirm it completes and `signing_status` becomes `summary_signed` (no 500).
  4. Spot checks: double-tap the sign POST (L7 idempotency) returns cleanly; a locked/submitted packet still reads (L1).
