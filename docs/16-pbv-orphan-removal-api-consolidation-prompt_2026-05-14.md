# Cursor Prompt — PRD-16: Orphan Removal & API Tree Consolidation

**PRD:** `docs/16-pbv-orphan-removal-api-consolidation_prd_2026-05-14.md` (read end-to-end)
**Build report:** `docs/build-reports/16-orphan-removal-build-report_2026-05-14.md`
**Depends on:** None. Parallel-safe with PRD-14 and PRD-15.

---

## Context

Three parallel tenant API trees and one orphan signing UI surface exist. Consolidate to `/api/t/[token]/pbv-full-app/*` as the only tenant tree. Delete the orphan `/signing` subpage and its backing routes. Audit the magic-link URL.

---

## Required reading

1. `docs/16-pbv-orphan-removal-api-consolidation_prd_2026-05-14.md` — entire document.
2. `docs/verification-methodology_2026-05-13.md` — test standards.
3. `components/pbv/TenantDocumentUpload.tsx` — current fetch URLs.
4. `app/api/pbv-full-app/[token]/documents/route.ts` and `[doc_row_id]/upload/route.ts` — files being migrated.
5. `app/pbv-full-app/[token]/signing/page.tsx`, `components/tenant-signing/TenantSigningView.tsx`, `components/signing/UploadSignedDialog.tsx` — files being deleted.
6. The admin SMS / notification code that mints tenant links — find it via grep on `pbv-full-app/` URL fragments.

---

## Closed decisions

1. `/api/t/[token]/pbv-full-app/*` is canonical. The other two trees are migrated or deleted.
2. Orphan signing files are deleted, not refactored.
3. Old API paths get a 301 redirect to the canonical path during a one-release-cycle deprecation window — NOT a hard 404 — unless Alex says otherwise.
4. Magic-link audit is in scope. If the template points to `/signing`, fix it.

---

## Open decisions

1. **`UploadSignedDialog` consumers.** Grep before deleting. If any non-orphan consumer exists, keep the file and document.
2. **301 redirect vs 410 Gone.** Default to 301. If the build report finds no outstanding outbound links that would hit the old path, switch to delete-with-410. Post finding in chat.
3. **Magic-link template location.** Find via grep on `pbv-full-app` URL fragments in `app/api/admin/pbv/...`. Post the path in chat.

---

## Build this pass

### Commit 1 — Create canonical routes

Copy the two existing routes to the canonical tree. No behavior change.

- `app/api/pbv-full-app/[token]/documents/route.ts` → `app/api/t/[token]/pbv-full-app/documents/route.ts`
- `app/api/pbv-full-app/[token]/documents/[doc_row_id]/upload/route.ts` → `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts`

**Done when:** Curl both old and new paths — identical response bodies and status codes.

### Commit 2 — Update tenant client callers

Update `components/pbv/TenantDocumentUpload.tsx` (line 122 fetch, plus the upload POST) to the canonical paths. Grep the rest of the repo for any other consumer of `/api/pbv-full-app/[token]/documents` — update each.

**Done when:** DevTools network tab on the tenant flow shows only `/api/t/...` calls.

### Commit 3 — 301 redirects on old paths

Replace the bodies of the old `/api/pbv-full-app/[token]/documents/*` routes with a 301 redirect handler:

```ts
export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return NextResponse.redirect(`/api/t/${token}/pbv-full-app/documents`, 301);
}
```

Or, if open decision 2 returns "hard delete": replace with 410 Gone.

**Done when:** Curl old path → 301 to canonical (or 410).

### Commit 4 — Orphan deletion

Grep audit first:
- `grep -r "TenantSigningView" app components lib`
- `grep -r "UploadSignedDialog" app components lib`
- `grep -r "/api/tenant/pbv/.*/signing" app components lib`

If any non-orphan consumer surfaces, STOP and post in chat.

Then delete:
- `app/pbv-full-app/[token]/signing/page.tsx`
- `components/tenant-signing/TenantSigningView.tsx`
- `components/signing/UploadSignedDialog.tsx` (only if grep clean)
- `app/api/tenant/pbv/[token]/signing/route.ts`
- `app/api/tenant/pbv/[token]/signing/[signatureId]/upload/route.ts`

**Done when:** `npm run build` clean. Direct navigation to `/pbv-full-app/<token>/signing` returns Next.js 404.

### Commit 5 — Magic-link audit

Find the tenant magic-link template. Confirm URL ends at `/pbv-full-app/<token>` with no suffix. Patch if wrong.

**Done when:** Build report cites the file location and confirms the URL. If a patch was applied, a test SMS payload shows the corrected URL.

---

## Verification

1. Full tenant flow walkthrough — DevTools shows only `/api/t/...` calls.
2. Direct nav to deleted orphan returns 404.
3. Grep for deleted basenames anywhere in repo returns zero hits outside git history.
4. Curl deprecated paths → 301 (or 410 per decision).
5. `npm run build` and `npm run lint` clean.

---

## Anti-patterns — do NOT

- Do not change request/response shapes of the migrated routes. Behavior parity, only the path changes.
- Do not touch admin routes (`/api/admin/pbv/*`) — that's a different consolidation conversation.
- Do not delete `UploadSignedDialog` if grep finds any non-orphan consumer.
- Do not silently 404 the old paths if open decision 2 hasn't been answered.
- Do not invent a "modernize the signing UI" task while touching these files. Out of scope.

---

## Build report

Cover: open decisions and findings, grep audit results, before/after DevTools network capture, build/lint/test status, magic-link audit result.

When done, post PR + build report + any open items in chat. Don't merge without sign-off.
