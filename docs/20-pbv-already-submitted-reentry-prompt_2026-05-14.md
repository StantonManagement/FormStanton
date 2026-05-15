# Cursor Prompt — PRD-20: Already-Submitted Re-Entry

**PRD:** `docs/20-pbv-already-submitted-reentry_prd_2026-05-14.md`
**Build report:** `docs/build-reports/20-already-submitted-build-report_2026-05-14.md`
**Depends on:** PRD-15 merged.

---

## Context

After PRD-15, a returning tenant is routed to `pageState === 'already_submitted'`. The existing render at `app/pbv-full-app/[token]/page.tsx:690-707` is a placeholder. Replace it with a real read-only confirmation: submission timestamp, document list with statuses, signature list with signer names, contact-office card, and a print button.

---

## Required reading

1. `docs/20-pbv-already-submitted-reentry_prd_2026-05-14.md`
2. `docs/15-pbv-submission-finalization_prd_2026-05-14.md` — for the page-state routing and server guards
3. `app/pbv-full-app/[token]/page.tsx:690-707` — placeholder to replace
4. `app/api/t/[token]/pbv-full-app/route.ts` GET — confirm data availability
5. `lib/pbvFullAppTranslations.ts` — translation conventions

---

## Closed decisions

1. Read-only. No mutation affordances. No "request changes" button.
2. Show submitted_at, HoH name, unit, full doc list with statuses, full signature list with signer names, contact-office card.
3. Localized in en/es/pt.
4. Mobile-first. Print stylesheet via `@media print`.
5. Use browser native print, no server PDF in this PR.

---

## Open decisions

1. **GET response shape.** Confirm it includes everything needed. If signature list is missing, add it to the response in this PR.
2. **Category grouping.** If PRD-14 has shipped, use categories. If not, render flat sorted by `(display_order, person_slot)`.
3. **Office contact info source.** Env vars vs hardcoded vs DB. Find the existing location and use it.

---

## Build this pass

### Commit 1 — Translations

Add to `lib/pbvFullAppTranslations.ts` for en/es/pt:

- `already_submitted_title` — e.g., "Application Submitted"
- `already_submitted_subtitle` — e.g., "Your PBV application is in review. The office will contact you."
- `already_submitted_timestamp_label` — e.g., "Submitted on"
- `already_submitted_docs_heading` — e.g., "Documents you submitted"
- `already_submitted_signatures_heading` — e.g., "Signatures captured"
- `already_submitted_contact_heading` — e.g., "Need to make a change?"
- `already_submitted_contact_body` — e.g., "Contact the office at {phone}."
- `already_submitted_print_btn` — e.g., "Print this page"

Verify es/pt against existing conventions before committing.

**Done when:** Type-check passes; all six languages-keys-combinations render the expected strings.

### Commit 2 — Data availability

Per open decision 1: read the current GET response. If `submitted_at`, doc list (with statuses, labels, person_slot, category if PRD-14 shipped), and signature list (with signer names) are not all present, add them. Keep the change additive.

**Done when:** A GET call against a finalized app returns everything the render needs in one fetch.

### Commit 3 — Render block

Replace lines 690-707 of `app/pbv-full-app/[token]/page.tsx`:

```tsx
if (pageState === 'already_submitted') {
  return (
    <>
      <Header language={language} onLanguageChange={setLanguage} />
      <main className="min-h-screen bg-[var(--paper)] py-6 px-4 print:py-0 print:px-0">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Sticky header */}
          <div className="bg-white border border-[var(--border)] p-5 print:border-none">
            <h1 className="text-2xl font-bold font-serif text-[var(--primary)]">{t.already_submitted_title}</h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              {t.already_submitted_timestamp_label}: {formatDate(detail.submitted_at, language)}
            </p>
            <p className="text-sm text-[var(--ink)] mt-2">
              {detail.head_of_household_name} • {detail.building_address} {detail.unit_number}
            </p>
            <p className="text-sm text-[var(--muted)] mt-3">{t.already_submitted_subtitle}</p>
          </div>

          {/* Document list — grouped by category if PRD-14 shipped */}
          <section className="bg-white border border-[var(--border)] p-5">
            <h2 className="text-lg font-semibold mb-3">{t.already_submitted_docs_heading}</h2>
            {/* grouped or flat per open decision 2 */}
          </section>

          {/* Signature list */}
          <section className="bg-white border border-[var(--border)] p-5">
            <h2 className="text-lg font-semibold mb-3">{t.already_submitted_signatures_heading}</h2>
            {/* list every saved signature, grouped by signer */}
          </section>

          {/* Contact-office card */}
          <section className="bg-blue-50 border border-blue-200 p-5">
            <h2 className="text-lg font-semibold mb-2">{t.already_submitted_contact_heading}</h2>
            <p className="text-sm">{t.already_submitted_contact_body.replace('{phone}', OFFICE_PHONE)}</p>
          </section>

          {/* Print button — hidden when printing */}
          <button
            type="button"
            onClick={() => window.print()}
            className="w-full py-3 px-4 bg-[var(--primary)] text-white text-sm font-semibold print:hidden"
          >
            {t.already_submitted_print_btn}
          </button>
        </div>
      </main>
      <Footer />
    </>
  );
}
```

Implementation notes:
- `formatDate` should use the existing date helper if one exists; otherwise `new Date(submitted_at).toLocaleDateString(language)`.
- Office phone should come from wherever office config currently lives (per open decision 3).
- If PRD-14's categorization hasn't shipped: render docs flat sorted by `(display_order, person_slot)`. Document the choice in the build report.

**Done when:**
- Finalize a test app, reload, see the new render.
- All data fields populated.
- Browser print preview is clean.
- No console errors.

### Commit 4 — Print stylesheet

Add `@media print` rules. Hide nav/footer/buttons. Light-on-dark or dark-on-light depending on existing convention. No shadows or background colors that print poorly. Section spacing tight enough to fit on one page if possible.

Add via Tailwind `print:` utilities inline (preferred — already used in Commit 3 above) OR add a print CSS block in `app/mobile-styles.css` if there's a precedent.

**Done when:** Browser print preview at desktop and mobile both render cleanly. No nav chrome. All content visible.

---

## Build verification (Windows/PowerShell) — read this before running `npm run build`

PRD-16 lost time to PowerShell behavior. Don't repeat the same trap:

- **Do NOT pipe `npm run build` through `Select-Object -First N` or `-Last N`.** It truncates output before "Compiled successfully" appears, making clean builds look broken or hung. Run `npm run build` directly. If you need to capture output, use `Tee-Object`: `npm run build 2>&1 | Tee-Object build.log`.
- **Do NOT trust PowerShell's implicit exit code for npm commands.** Next.js writes the middleware-to-proxy deprecation warning to stderr, which PowerShell sometimes surfaces as exit code 1 even on a fully successful build. Use `$LASTEXITCODE` for the real node exit code, or inspect output directly.
- **A successful build looks like:** `✓ Compiled successfully in Xs` → `Running TypeScript ...` → `Collecting page data ...` → `Generating static pages ...` → route table prints. Any of the last three steps failing is a real problem. The middleware deprecation warning is NOT.
- If you delete a route file, **clear `.next/` before re-building** (`Remove-Item -Recurse -Force .next`). The cached type validator references the deleted file and causes spurious failures.

---

## Verification

1. Finalize a test app → reload → see real screen, not placeholder.
2. All three languages render correctly.
3. Mobile layout (375px wide) — no horizontal scroll, readable.
4. Print preview — clean, no chrome, all content visible.
5. DevTools network: no extra fetches; everything comes from the existing GET.
6. Manual attack: try to use browser inspector to trigger mutations. Server returns 409 (PRD-15 guard verifies the contract).
7. Build / lint / type-check clean.

---

## Anti-patterns — do NOT

- Do not add any edit, replace, or "request changes" affordances.
- Do not add a server PDF generator. Browser print is enough.
- Do not extend GET to include data the screen doesn't use. Keep additions minimal.
- Do not touch the page-state routing logic — that's PRD-15.
- Do not touch the server-side mutation guards — those are PRD-15.

---

## Build report

Cover: open decisions and resolutions, screenshots in en/es/pt + print preview, mobile screenshot, office-contact source location.

Post PR + build report. Don't merge without sign-off.
