# Vercel Deployment Protection — keep OFF for Production

## TL;DR

**Production deployment protection on `form-stanton` (and any custom tenant
domain) MUST remain disabled.** If it is enabled, every tenant who taps the
SMS magic link is intercepted by Vercel's SSO page and never reaches
`/t/[token]`. Internal staff won't notice because their browsers already carry
the Vercel auth cookie.

## Symptom

> "The magic link works on my desktop but not on my phone."

That sentence almost always means Production protection is on. Desktop browsers
of Vercel team members are silently authenticated by cookie; phones (and every
real tenant device) are not.

## Setting

Vercel Dashboard → `form-stanton` project → **Settings → Deployment Protection**.

- **Production**: must be **Disabled** (or have a Protection Bypass that
  whitelists `/t/*`, `/pbv-full-app/*`, and `/api/t/*`).
- **Preview**: leave protected if you want — only Production needs to be public
  for tenants.

## After flipping the toggle

1. Re-deploy (Production). The gate is sometimes cached.
2. Test from a phone on **cellular**, not the office Wi-Fi (to avoid carrying
   over a Vercel cookie that masks the problem).
3. Confirm the URL bar on the phone stops at `form-stanton.vercel.app/t/...`
   instead of redirecting to `vercel.com/sso-api/...`.

## Why this isn't enforced in `vercel.json`

Vercel reads Deployment Protection from the dashboard, not from `vercel.json`.
There is no repo-level lock against it being re-enabled. Hence this note —
**don't turn it on for Production without first adding a path bypass for the
tenant routes.**

## Related code

- Tenant magic-link page: `@/app/t/[token]/page.tsx`
- Tenant API surface: `@/app/api/t/[token]/...`
- SMS portal-URL helper that ensures a real public host:
  `@/lib/urls.ts::getPortalBaseUrl`
