# Cursor Prompt — PRD-19: Tenant Resilience

**PRD:** `docs/19-pbv-tenant-resilience_prd_2026-05-14.md`
**Build report:** `docs/build-reports/19-tenant-resilience-build-report_2026-05-14.md`
**Depends on:** PRD-15 (finalize endpoint), PRD-16 (API consolidation).

---

## Context

Bare `fetch()` calls with no timeout, no retry, no idempotency, no error UI. On real mobile networks this means silent failures and confusing double-submissions. Build the `tenantFetch` wrapper, the `tenant_idempotency_keys` table, the `withIdempotency` server helper, and retrofit every tenant endpoint and client fetch site.

---

## Required reading

1. `docs/19-pbv-tenant-resilience_prd_2026-05-14.md`
2. `docs/verification-methodology_2026-05-13.md`
3. Every file in `app/api/t/[token]/pbv-full-app/` post-PRD-16 consolidation.
4. `app/pbv-full-app/[token]/page.tsx` — every `fetch(` call site.
5. `components/pbv/TenantDocumentUpload.tsx` — every fetch call.

---

## Closed decisions

1. `tenantFetch` is the only fetch path in tenant code post-PRD.
2. Timeouts: 15s read, 60s upload. One retry on network error only.
3. Idempotency: UUIDv4 per logical action, sent as `Idempotency-Key` header.
4. Server-side: `(key, endpoint)` is the unique key.
5. 24-hour key expiration.
6. No localStorage persistence of keys.
7. No idempotency on GETs.
8. No idempotency on admin endpoints.

---

## Open decisions

1. **60s upload timeout.** Confirm Next.js body parsing accommodates this without rejecting. Adjust if needed.
2. **Cleanup mechanism.** Cron job vs manual SQL vs scheduled task. Pick one, document.

---

## Build this pass

### Commit 1 — Migration

Create `supabase/migrations/20260514230000_tenant_idempotency_keys.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.tenant_idempotency_keys (
  key TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  application_id UUID NOT NULL REFERENCES public.pbv_full_applications(id) ON DELETE CASCADE,
  response_body JSONB NOT NULL,
  response_status INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + interval '24 hours',
  PRIMARY KEY (key, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_tenant_idempotency_keys_expires
  ON public.tenant_idempotency_keys (expires_at);
CREATE INDEX IF NOT EXISTS idx_tenant_idempotency_keys_app
  ON public.tenant_idempotency_keys (application_id);
```

**Done when:** Table exists, indexes present, idempotent re-apply.

### Commit 2 — Server-side `withIdempotency` helper

Create `lib/idempotency.ts`:

```ts
export async function withIdempotency<T>(
  request: NextRequest,
  applicationId: string,
  endpoint: string,
  handler: () => Promise<{ body: T; status: number }>
): Promise<NextResponse> {
  const key = request.headers.get('Idempotency-Key');
  if (!key) {
    // No key — run handler without storing
    const { body, status } = await handler();
    return NextResponse.json(body, { status });
  }

  // Check for existing entry
  const { data: existing } = await supabaseAdmin
    .from('tenant_idempotency_keys')
    .select('response_body, response_status, expires_at')
    .eq('key', key)
    .eq('endpoint', endpoint)
    .maybeSingle();

  if (existing && new Date(existing.expires_at) > new Date()) {
    return NextResponse.json(existing.response_body, { status: existing.response_status });
  }

  // Run handler and store result
  const { body, status } = await handler();
  await supabaseAdmin.from('tenant_idempotency_keys').upsert({
    key,
    endpoint,
    application_id: applicationId,
    response_body: body,
    response_status: status,
  });

  return NextResponse.json(body, { status });
}
```

Add unit tests for: no-key passthrough, first-write storage, replay returns stored response, expired key triggers fresh processing.

**Done when:** Tests pass.

### Commit 3 — Client `tenantFetch` library

Create `lib/tenantFetch.ts`:

```ts
export async function tenantFetch(url: string, opts: {
  method?: string;
  body?: any;
  timeout?: number; // ms; default 15000
  idempotent?: boolean; // default true for non-GET
  signal?: AbortSignal;
} = {}): Promise<Response> {
  const method = opts.method ?? 'GET';
  const timeout = opts.timeout ?? (isUpload(opts) ? 60000 : 15000);
  const useIdempotency = opts.idempotent ?? (method !== 'GET');
  const idempotencyKey = useIdempotency ? crypto.randomUUID() : null;

  const headers: Record<string, string> = {};
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  if (opts.body && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const attempt = async (): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(url, {
        method,
        headers,
        body: opts.body instanceof FormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined,
        signal: opts.signal ?? controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  try {
    return await attempt();
  } catch (err) {
    // Retry once on network error (not HTTP error)
    if (err instanceof TypeError || (err as any).name === 'AbortError') {
      return await attempt();
    }
    throw err;
  }
}
```

Add unit tests. Decide on the `isUpload(opts)` heuristic (FormData with file? Specific opt flag? Document the choice.).

**Done when:** Tests pass.

### Commit 4 — Wire `withIdempotency` into endpoints

Wrap each of: intake POST, finalize POST, signatures POST, document upload POST. Pattern:

```ts
return withIdempotency(request, app.id, 'intake', async () => {
  // existing handler logic, returning { body, status }
});
```

**Done when:** Replay test against each endpoint passes. Existing tests continue to pass.

### Commit 5 — Client retrofit

Replace every `fetch(` call in `app/pbv-full-app/[token]/page.tsx` and `components/pbv/TenantDocumentUpload.tsx` with `tenantFetch(`. Add error states with retry buttons at every call site. Localize new error strings.

Grep audit afterward: `grep -n "fetch(" app/pbv-full-app components/pbv` returns only `tenantFetch` usages.

**Done when:** Grep clean. Manual chaos test: kill backend mid-action, see error UI + retry button, retry succeeds when backend returns.

### Commit 6 — Cleanup mechanism

Per open decision 2, implement either:
- `app/api/cron/cleanup-idempotency-keys/route.ts` that deletes expired rows
- A Supabase scheduled function
- A documented manual SQL DELETE

**Done when:** Mechanism exists or is documented in the build report with rationale.

---

## Build verification (Windows/PowerShell) — read this before running `npm run build`

PRD-16 lost time to PowerShell behavior. Don't repeat the same trap:

- **Do NOT pipe `npm run build` through `Select-Object -First N` or `-Last N`.** It truncates output before "Compiled successfully" appears, making clean builds look broken or hung. Run `npm run build` directly. If you need to capture output, use `Tee-Object`: `npm run build 2>&1 | Tee-Object build.log`.
- **Do NOT trust PowerShell's implicit exit code for npm commands.** Next.js writes the middleware-to-proxy deprecation warning to stderr, which PowerShell sometimes surfaces as exit code 1 even on a fully successful build. Use `$LASTEXITCODE` for the real node exit code, or inspect output directly.
- **A successful build looks like:** `✓ Compiled successfully in Xs` → `Running TypeScript ...` → `Collecting page data ...` → `Generating static pages ...` → route table prints. Any of the last three steps failing is a real problem. The middleware deprecation warning is NOT.
- If you delete a route file, **clear `.next/` before re-building** (`Remove-Item -Recurse -Force .next`). The cached type validator references the deleted file and causes spurious failures.

---

## Verification

1. Replay test against every wrapped endpoint.
2. Network failure chaos test against every fetch site in the client.
3. Timeout test: simulate slow backend, confirm 15s/60s aborts trigger error UI.
4. Grep audit confirms no bare `fetch(` calls in tenant code.
5. Build / lint / type-check clean.
6. Existing E2E tests (if any) still pass.

---

## Anti-patterns — do NOT

- Do not add idempotency to GET endpoints.
- Do not persist idempotency keys to localStorage.
- Do not retry on 4xx responses. Those are deterministic errors.
- Do not raise timeouts past 60s for uploads or 30s for reads without re-thinking the UX.
- Do not skip the error UI. Silent failures are the exact bug we're fixing.
- Do not touch admin endpoints.

---

## Build report

Cover: open decisions and resolutions, chaos test screenshots/logs, grep audit results, cleanup mechanism choice.

Post PR + build report + open items. Don't merge without sign-off.
