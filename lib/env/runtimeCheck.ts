/**
 * PRP-004 — Runtime env assertion.
 *
 * Memoized once-per-instance check that all required runtime env vars are
 * present. On the first call we either return cleanly or build a structured
 * failure object that callers (currently `/api/health`, future callers in
 * the shared request entry) turn into a 503 + log.
 *
 * The list intentionally mirrors `scripts/validate-env.ts` for now —
 * if/when we extract a shared `REQUIRED_ENV` source we can dedupe; for
 * the moment, keep both in sync manually.
 *
 * Findings: Angle-2 I3.
 */

export interface RuntimeEnvCheck {
  ok: boolean;
  missing: string[];
  invalid: string[];
}

interface VarSpec {
  name: string;
  /** Optional secondary validator (e.g. min length, prefix). Missing var
   *  always wins over a validation failure. */
  validate?: (val: string) => boolean;
}

/**
 * Required runtime env vars. Mirrors scripts/validate-env.ts intentionally;
 * the two lists must move together when we add/remove a var.
 */
export const REQUIRED_RUNTIME_ENV: VarSpec[] = [
  { name: 'NEXT_PUBLIC_SUPABASE_URL', validate: v => v.startsWith('https://') && v.includes('supabase.co') },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', validate: v => v.length > 100 },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', validate: v => v.length > 100 },
  { name: 'SESSION_SECRET', validate: v => v.length >= 32 },
  { name: 'CRON_SECRET', validate: v => v.length >= 16 },
];

let cached: RuntimeEnvCheck | null = null;

/**
 * Returns the memoized runtime env check. Fast path on subsequent calls.
 * Logs once on first failure with the names of the offending vars (no values).
 */
export function assertRuntimeEnv(env: NodeJS.ProcessEnv = process.env): RuntimeEnvCheck {
  if (cached) return cached;

  const missing: string[] = [];
  const invalid: string[] = [];

  for (const spec of REQUIRED_RUNTIME_ENV) {
    const value = env[spec.name];
    if (value === undefined || value === '') {
      missing.push(spec.name);
      continue;
    }
    if (spec.validate && !spec.validate(value)) {
      invalid.push(spec.name);
    }
  }

  const ok = missing.length === 0 && invalid.length === 0;
  cached = { ok, missing, invalid };

  if (!ok) {
    // Names only — never log values, even truncated.
    console.error(
      '[runtimeCheck] required env missing/invalid',
      JSON.stringify({ missing, invalid })
    );
  }
  return cached;
}

/** Test-only: clear the memoization. */
export function __resetRuntimeEnvCheck() {
  cached = null;
}
