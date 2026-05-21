# Prompt — Correct the double `withIdempotency` wrap that breaks tenant signing

**Date:** 2026-05-21
**Severity:** Launch blocker. Summary signing AND forms signing fail for every tenant on production right now.
**For:** the build agent (Windsurf). Make the code change, verify, commit, push, redeploy.
**Shell protocol:** `docs/SHELL-PROTOCOL.md`. Type-check with `node ./node_modules/typescript/bin/tsc --noEmit`, not `npx tsc`.

---

## Evidence (observed live on prod, test app `110-martin-unit-3`, 2026-05-21)

Walking the tenant flow on `https://form-stanton.vercel.app`:
- Intake, document upload (incl. the PRD-65 Photo ID), the hub progress bar, and the leave-with-missing-docs guard all work.
- At the **summary signature** step, the page crashes with: `Cannot destructure property 'signature_image_path' of 'i.data' as it is undefined.`
- Network: `POST /api/t/[token]/pbv-full-app/signature/capture` returned **HTTP 200 with body `{}`**. The signature image *was* uploaded; only the JSON response is empty.

## Root cause (confirmed in code)

`signature/capture` is wrapped in idempotency **twice**:

```ts
// app/api/t/[token]/pbv-full-app/signature/capture/route.ts  (line ~31)
return withIdempotency(request, '', 'signature-capture', async () =>
  withTenantContext(request, token, 'signature-capture', async (app) => {
    ...
    return { body: { success: true, data: { signature_image_path, ... } }, status: 200 };
  })
);
```

But `withTenantContext` (`lib/pbv/tenantEndpoint.ts`) **already** calls `withIdempotency` internally and returns a finished `NextResponse`:

```ts
return withIdempotency(request, app.id, effectiveKey, () => handler(app)); // -> NextResponse
```

So the **outer** `withIdempotency` receives a `NextResponse` from its handler, then does:

```ts
const { body, status } = await handler();      // body = the NextResponse body STREAM, not the JSON
return NextResponse.json(body, { status });     // JSON.stringify(stream) -> "{}"
```

That is exactly the empty `{}` with status 200. Two independent defects compound it:
1. **Double wrap** flattens the real `{ success, data }` body to `{}`.
2. The outer wrapper passes `applicationId = ''`, which also defeats the per-application idempotency scoping that `withTenantContext` is designed to provide.

## Scope — two routes double-wrap, two clients crash on it

**Routes that double-wrap** (call `withIdempotency` *around* `withTenantContext`):
- `app/api/t/[token]/pbv-full-app/signature/capture/route.ts` — **user-visible crash** (clients read the body).
- `app/api/t/[token]/pbv-full-app/intake/[section]/route.ts` — **latent**: returns `{}` too, but the intake client only checks `res.ok`, so it *appears* to work. Its idempotency dedup is silently non-functional. Correct it as well.

(These are the only two routes in `app/` that call `withIdempotency` directly — confirmed by grep. `withTenantContext` is the right single layer.)

**Clients that read `.data` from the capture response:**
- `components/pbv/sign/SummaryDocReviewSign.tsx:99` → `const { signature_image_path } = (captureJson as any).data;` — **unguarded**, crashes. (summary signing)
- `lib/pbv/hooks/useSigningCeremony.ts:64` → `const imagePath = (captureJson as any).data.signature_image_path;` — **unguarded**. This hook drives **forms signing** (step 2) and hits the same capture route, so forms signing is broken too.
- `components/pbv/sign/MagicLinkSigningFlow.tsx:108` → already uses `captureJson.data?.signature_image_path` (guarded) — leave as-is, but it still depends on the route correction to actually receive a path.

---

## The change

### 1. Remove the redundant outer wrap (PRIMARY — this alone restores signing)

In **`signature/capture/route.ts`** and **`intake/[section]/route.ts`**, drop the outer `withIdempotency(request, '', ...)` and call `withTenantContext` directly. `withTenantContext` already applies idempotency with the correct `app.id`.

`signature/capture/route.ts` becomes:
```ts
return withTenantContext(request, token, 'signature-capture', async (app) => {
  // ... unchanged handler body, still returns { body: { success: true, data: {...} }, status: 200 }
});
```

`intake/[section]/route.ts` becomes:
```ts
return withTenantContext(request, token, `intake-${section}`, async (app) => {
  // ... unchanged handler body
});
```

Remove the now-unused `import { withIdempotency } from '@/lib/idempotency';` from both files. Do **not** change `withTenantContext` or `withIdempotency` themselves — they are correct; the misuse was at the call sites.

### 2. Add defensive guards in the two unguarded clients (so a malformed response shows a retry, never a crash)

`components/pbv/sign/SummaryDocReviewSign.tsx` (~line 98):
```ts
const path = (captureJson as any)?.data?.signature_image_path;
if (!captureRes.ok || !path) throw new Error((captureJson as any)?.message || 'Could not save your signature. Please try again.');
const signature_image_path = path;
```

`lib/pbv/hooks/useSigningCeremony.ts` (~line 64): same pattern — read `(captureJson as any)?.data?.signature_image_path`, and throw a friendly error if it's missing instead of destructuring blindly.

### 3. Audit (quick)

- Confirm grep `withIdempotency(` under `app/` returns only the two routes above after your change (it should now return zero, since both switch to `withTenantContext`).
- Confirm the signer capture route `app/api/pbv-full-app/signer/[member_token]/signature/capture/route.ts` returns `{ success, data: { signature_image_path } }` and is **not** double-wrapped (it uses its own member-token context, not `withTenantContext`). Leave it unless it shows the same shape problem.

---

## Verify (do not skip the runtime walk — static gates won't catch this)

1. `node ./node_modules/typescript/bin/tsc --noEmit` — clean.
2. `npm run build` — clean.
3. **Runtime, on a deployed build (preview or prod) using a TEST application token:**
   - Open the summary-sign step, check the box, draw a signature, tap Sign.
   - Confirm `POST .../signature/capture` returns `200` with a body containing `data.signature_image_path` (not `{}`), and the UI advances to the "signed" state.
   - Continue into **forms signing** (step 2) and confirm at least one form signs through (it uses the same capture route via `useSigningCeremony`).
   - Confirm the application reaches **Submit my application** and finalize succeeds.

A green type-check and build are necessary but **not** sufficient here — the bug was a runtime response-shape problem that compiled fine. The signing walk is the real gate.

---

## Commit & push (native Windows terminal — the sandbox git index is unreliable)

If `git status` errors, repair first: `del .git\index .git\index.lock` then `git read-tree HEAD`.

```powershell
git add app/api/t/[token]/pbv-full-app/signature/capture/route.ts `
        app/api/t/[token]/pbv-full-app/intake/[section]/route.ts `
        components/pbv/sign/SummaryDocReviewSign.tsx `
        lib/pbv/hooks/useSigningCeremony.ts
git commit -m "fix(pbv): remove double withIdempotency wrap that flattened signing responses to {}

signature/capture and intake/[section] wrapped withIdempotency around withTenantContext,
which already applies idempotency and returns a NextResponse; the outer wrapper re-serialized
the response body stream to {} (HTTP 200, empty body), crashing summary + forms signing
('Cannot destructure signature_image_path'). Call withTenantContext directly. Add defensive
.data guards in SummaryDocReviewSign and useSigningCeremony."
git push origin main
```

This commits to `main` so Vercel redeploys production. (If you prefer to stage on `feat/pbv-tenant-polish` and fast-forward `main` after a preview check, that's fine — Alex's call.)

---

## Done criteria

- `POST /signature/capture` returns `200` with `data.signature_image_path` present.
- Summary signing and forms signing both complete on a deployed build with a test token.
- The application reaches and completes **Submit my application**.
- No route under `app/` double-wraps idempotency; the two signing clients no longer destructure `.data` unguarded.
- Committed and redeployed.

Once this is live, tell Alex — the end-to-end signing walk needs one more pass before any applications go to real tenants.
