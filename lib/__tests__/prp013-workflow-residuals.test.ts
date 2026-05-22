/**
 * PRP-013 — Workflow-audit residual regression tests (#9, #10, #13).
 *
 * All three items are already remediated on this branch (PRD-64 for #10,
 * PRD-66 for #9 + #13). This file pins the invariants so a future regression
 * is caught. Source-grep where exercising the real code path would require
 * standing up the supabase client / RPC.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();

// ── #9: idempotency lookup scoped by application_id ────────────────────────
describe('PRP-013 #9 — withIdempotency scopes lookup by application_id', () => {
  const src = readFileSync(join(root, 'lib', 'idempotency.ts'), 'utf8');

  it('the lookup WHERE chain includes .eq("application_id", applicationId)', () => {
    expect(src).toMatch(/\.eq\(\s*['"]application_id['"]\s*,\s*applicationId\s*\)/);
  });

  it('the lookup WHERE chain also includes (key, endpoint) — pre-existing scoping is preserved', () => {
    expect(src).toMatch(/\.eq\(\s*['"]key['"]\s*,\s*key\s*\)/);
    expect(src).toMatch(/\.eq\(\s*['"]endpoint['"]\s*,\s*endpoint\s*\)/);
  });

  it('the upsert payload writes application_id', () => {
    expect(src).toMatch(/application_id:\s*applicationId/);
  });
});

// ── #10: finalize atomic via SQL RPC ───────────────────────────────────────
describe('PRP-013 #10 — finalize uses finalize_pbv_application RPC (atomic)', () => {
  const src = readFileSync(
    join(root, 'app', 'api', 't', '[token]', 'pbv-full-app', 'finalize', 'route.ts'),
    'utf8'
  );

  it('calls supabaseAdmin.rpc("finalize_pbv_application", ...) for the atomic submit', () => {
    expect(src).toMatch(/supabaseAdmin\.rpc\(\s*['"]finalize_pbv_application['"]/);
  });

  it('returns 500 on rpcError (does NOT swallow the failure)', () => {
    // Match the route's rpc-error branch shape.
    expect(src).toMatch(/if\s*\(\s*rpcError\s*\)/);
    expect(src).toMatch(/status:\s*500/);
    expect(src).toMatch(/finalize_atomic_failed/);
  });

  it('does NOT write submitted_at directly via an update — the RPC owns that write', () => {
    // The route should not contain a `.update({ submitted_at:` bypass.
    expect(src).not.toMatch(/\.update\(\s*\{\s*submitted_at/);
  });
});

// ── #13: tryLoadPdf logs non-ENOENT errors ─────────────────────────────────
describe('PRP-013 #13 — tryLoadPdf distinguishes ENOENT from real failures', () => {
  const src = readFileSync(
    join(root, 'lib', 'pbv', 'form-generation', 'source-pdfs.ts'),
    'utf8'
  );

  it('branches on code === "ENOENT" or the not-found message', () => {
    expect(src).toMatch(/code === 'ENOENT'/);
    expect(src).toMatch(/Source PDF not found/);
  });

  it('logs at console.error when !isNotFound (real operational failure surfaces in monitoring)', () => {
    expect(src).toMatch(/!isNotFound[\s\S]{0,200}console\.error\(/);
  });

  it('still returns null in both branches (callers expect Buffer | null contract)', () => {
    // The function signature claims Buffer | null; there must be a
    // `return null` somewhere in tryLoadPdf's catch.
    const fnMatch = src.match(/function\s+tryLoadPdf[\s\S]+?\n\}/m);
    expect(fnMatch).not.toBeNull();
    expect(fnMatch![0]).toMatch(/return\s+null;/);
  });
});
