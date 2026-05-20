/**
 * URL helpers for outbound tenant communications.
 *
 * SMS clients only auto-link strings that start with http:// or https://.
 * If we silently fall back to an empty base, the rendered SMS contains a
 * bare path (e.g. "/t/<token>") which is NOT tappable on iOS or Android.
 * These helpers fail loudly so a misconfigured environment is caught at
 * send time rather than after-the-fact via a confused tenant.
 */

/**
 * Returns the configured public app URL (no trailing slash), guaranteed to
 * start with http:// or https://. Throws if NEXT_PUBLIC_APP_URL is missing
 * or malformed so we never send a non-tappable magic link.
 */
export function getPortalBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) {
    throw new Error(
      'NEXT_PUBLIC_APP_URL is not set. Set it in .env.local (e.g. https://your-host) so SMS magic links are tappable.'
    );
  }
  if (!/^https?:\/\//i.test(raw)) {
    throw new Error(
      `NEXT_PUBLIC_APP_URL must start with http:// or https:// (got: "${raw}"). SMS magic links require a scheme to be tappable.`
    );
  }
  return raw.replace(/\/+$/, '');
}

/**
 * Build a tenant portal URL of the form `${base}/t/${token}`.
 */
export function buildTenantPortalUrl(token: string): string {
  return `${getPortalBaseUrl()}/t/${token}`;
}
