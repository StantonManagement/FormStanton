/**
 * lib/log/redact.ts — PRP-018 / G2.
 *
 * Strips secrets + PII from values bound for the server logs.
 *
 * What we redact:
 *   - Known sensitive query-params on URL strings:
 *       tenant_access_token, member_token, magic_link_token, token
 *   - Known sensitive object keys:
 *       tenant_access_token, magic_link_token, member_token, token,
 *       password, authorization, cookie, set-cookie,
 *       ssn, dob, date_of_birth, email, phone, address,
 *       signature_image_data_url
 *
 * Behavior: returns a deep-cloned value with redacted leaves replaced by
 * the sentinel string '[REDACTED]'. URLs keep their structure; only the
 * sensitive query-param values are masked. Non-string leaves untouched.
 *
 * Intentionally NOT a full PII scrubber — there is no NLP / format
 * detection on free-text fields. The aim is to make a casual log inspect
 * (or an accidentally-tail-the-log incident) not leak the keys we know
 * about. Additional sites should be wrapped by hand, not picked up by
 * pattern alone.
 */

const SENSITIVE_QUERY_PARAMS = new Set([
  'tenant_access_token',
  'member_token',
  'magic_link_token',
  'token',
]);

const SENSITIVE_KEYS = new Set([
  'tenant_access_token',
  'magic_link_token',
  'member_token',
  'token',
  'password',
  'authorization',
  'cookie',
  'set-cookie',
  'ssn',
  'dob',
  'date_of_birth',
  'email',
  'phone',
  'address',
  'signature_image_data_url',
]);

const REDACT_SENTINEL = '[REDACTED]';

export function redactUrlString(value: string): string {
  // Only URL-like strings get the query-param scrub. Heuristic: starts
  // with http/https OR contains a '?...=' pattern with one of our keys.
  if (!value) return value;
  const hasQuery = value.includes('?');
  const looksLikeUrl = /^https?:\/\//i.test(value) || hasQuery;
  if (!looksLikeUrl) return value;
  try {
    // Try full URL parse first.
    const url = new URL(value, 'http://_local_/');
    let changed = false;
    for (const key of Array.from(url.searchParams.keys())) {
      if (SENSITIVE_QUERY_PARAMS.has(key.toLowerCase())) {
        url.searchParams.set(key, REDACT_SENTINEL);
        changed = true;
      }
    }
    if (!changed) return value;
    // Preserve relative form if input was relative.
    if (!/^https?:\/\//i.test(value)) {
      return url.pathname + url.search + url.hash;
    }
    return url.toString();
  } catch {
    // Fallback: regex over the raw string.
    let out = value;
    for (const key of SENSITIVE_QUERY_PARAMS) {
      const re = new RegExp(`(${key}=)[^&\\s]+`, 'gi');
      out = out.replace(re, `$1${REDACT_SENTINEL}`);
    }
    return out;
  }
}

export function redact<T>(input: T, depth = 0): T {
  if (depth > 8) return input; // guard against pathological nesting
  if (input == null) return input;
  if (typeof input === 'string') {
    return redactUrlString(input) as unknown as T;
  }
  if (Array.isArray(input)) {
    return input.map((item) => redact(item, depth + 1)) as unknown as T;
  }
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = REDACT_SENTINEL;
      } else {
        out[k] = redact(v, depth + 1);
      }
    }
    return out as unknown as T;
  }
  return input;
}

/**
 * IP-derivation helper. Production behind Vercel sets x-vercel-forwarded-for;
 * x-forwarded-for is appended as the client traverses proxies. The leftmost
 * non-private value is the closest-to-client IP; private ranges
 * (10/8, 172.16/12, 192.168/16, 127/8, ::1, fc00::/7) are skipped.
 */
function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === '::1' || ip.startsWith('::ffff:127.') || ip.startsWith('127.')) return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  if (/^fc[0-9a-f]{2}:/i.test(ip) || /^fd[0-9a-f]{2}:/i.test(ip)) return true;
  return false;
}

export function clientIpFromHeaders(h: { get(name: string): string | null }): string | null {
  const vercel = h.get('x-vercel-forwarded-for');
  if (vercel) {
    const first = vercel.split(',')[0]?.trim();
    if (first) return first;
  }
  const xff = h.get('x-forwarded-for');
  if (xff) {
    const candidates = xff.split(',').map(s => s.trim()).filter(Boolean);
    for (const c of candidates) {
      if (!isPrivateIp(c)) return c;
    }
    // Fall back to first if everything looks private.
    return candidates[0] ?? null;
  }
  return h.get('x-real-ip');
}
