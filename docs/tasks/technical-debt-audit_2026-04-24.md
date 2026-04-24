# Technical Debt Audit — Apr 24, 2026

> **Scope:** All code written during the four autonomous build sessions on Apr 24, 2026 (commits `3915e38` through `6616a80` on branch `dev`). This document catalogs every deviation from ideal engineering standards so work can be hardened deliberately.
>
> **Rule:** This document is read-only output. No code was changed to produce it.

---

## Section 1 — Executive Summary

### Total count: 47 items

### Severity breakdown

| Severity | Count | Description |
|---|---|---|
| **Critical** | 6 | Incorrect decisions, data loss risk, security breach, or unrecoverable state in production |
| **High** | 15 | User-visible bugs, broken flows, or major rework required |
| **Medium** | 17 | Friction, hardcoded config, maintenance pain, data drift risk |
| **Low** | 9 | Polish, scale concerns, nice-to-have |

### Top 5 items to address before production use

1. **C-03** — Column name mismatch (`income_limit` vs `annual_limit`) in the pipeline route silently renders income status `no_data` for every application in the dashboard. This is a live bug in already-committed code.
2. **C-01** — HUD AMI figures are unverified placeholder values. Every income qualification determination currently rests on numbers that may be wrong by thousands of dollars per year.
3. **C-02** — Income delta calculation compares documented income against the AMI limit, not against the tenant's claimed income. This breaks HUD's EIV discrepancy standard and means the `within_tolerance` flag is meaningless for its stated purpose.
4. **C-04** — `GET /api/hach/applications/[id]` has no scope check. A HACH user with any valid application UUID can read a full packet (household, income, citizenship flags) even if that application was never routed to HACH review.
5. **C-05** — Deactivated HACH users retain active sessions for up to 24 hours. Deactivation in the admin UI writes `deactivated_at` to the DB but does not invalidate the session cookie.

---

## Section 2 — Deferred Features (Explicit Stubs)

| ID | Item | File(s) | Severity | Effort to fix |
|---|---|---|---|---|
| D-01 | Tenant rejection notification — SMS deferred | `app/api/hach/documents/[id]/reject/route.ts:151-154` | High | Medium (Twilio wiring) |
| D-02 | HACH user invitation — email deferred | `app/api/hach/admin/users/route.ts:133` | High | Low (Resend wiring) |
| D-03 | Password reset — "coming soon" toast | `app/hach/admin/users/page.tsx:510` | High | Medium |
| D-04 | "Reject coming soon" label on R-key (obsolete) | `app/hach/applications/[id]/page.tsx:354` | Low | Low (cleanup) |
| D-05 | Issue Voucher action — Phase 7 not built | `app/hach/applications/[id]/page.tsx` (button absent) | High | High |
| D-06 | Admin UI for rejection templates — Phase 1 item | Not built | Medium | Low-Medium |
| D-07 | AMI limits admin UI — Phase 5 explicitly skipped | Not built | Medium | Medium |
| D-08 | Stanton audit log UI — Phase 4 partial | Not built (`/admin/pbv/audit-log`) | Low | Low |
| D-09 | Rejection-tenant-loop Phases 2, 5, 6 | Not built | High | High |
| D-10 | Pipeline dashboard Phases 3–6 | Not built | Medium | High |
| D-11 | Appointment scheduling PRD — entire system | Not built | Medium | High |
| D-12 | `hach_review_status` auto-advance to `under_hach_review` on first approve | Session notes line 194–196 | Medium | Low |

### D-01: Rejection notification deferred (Critical path)

`app/api/hach/documents/[id]/reject/route.ts` lines 151–154 log the would-be SMS to console and set `notification_deferred: true` in the response. The `tenant_notifications` table exists and has the right schema, but nothing is ever inserted into it. The rejection loop — the core purpose of the `rejection-tenant-loop` PRD — is completely non-functional. Tenants receive no notification when their document is rejected. The fix requires: Twilio environment variables, `lib/notifications.ts` send helper, and wiring the helper in the reject route. Depends on: confirmed phone number source (PRD open question unanswered).

### D-02: Invitation email deferred

`app/api/hach/admin/users/route.ts` line 133 prints `[HACH Invite URL]` to the server console. In a production environment (Vercel), console output is only visible via the Vercel dashboard or a log drain — not surfaced to HACH admins. Any HACH admin who creates an invitation cannot retrieve the URL without production log access. The fix is a single Resend API call; `RESEND_API_KEY` is already in `.env.local.example`. Requires a template design decision (plain-text vs HTML).

### D-03: Password reset missing

`app/hach/admin/users/page.tsx` line 510 calls `showToast('Password reset coming soon', 'error')`. The PRD Phase 3 specifies admin-initiated reset. No route exists. No DB column for reset tokens. A deactivated HACH reviewer's account can never be recovered without a Stanton super admin directly editing the `admin_users` row.

### D-05: Issue Voucher (Phase 7) not built

No "Issue Voucher" button is rendered in the packet view. The PRD specifies this as the terminal action that closes the HACH review cycle. Without it, `hach_review_status` can only reach `approved_by_hach` via the seed script or direct DB manipulation. Downstream — any future HAP contract, inspection scheduling, or voucher tracking system will have no trigger event to listen for.

### D-09: Rejection-tenant-loop missing phases

- **Phase 2** (notification ledger + Twilio send): No `lib/notifications.ts`. The `tenant_notifications` table schema is ready.
- **Phase 5** (Twilio webhook at `/api/webhooks/twilio`): Not built. Delivery status will never update from `queued`.
- **Phase 6** (48-hour SLA nudge): No cron/edge function. No "Tenant not responding" surfacing on Stanton dashboard.

**Dependency risk:** The pipeline dashboard's Phase 5 "tenant chase actions" explicitly reuses `tenant_notifications` and the rejection template system. If chase is built before Phase 2 of rejection-tenant-loop is wired, it will either duplicate the send logic or silently fail. Coordinate the build order.

### D-10: Pipeline dashboard missing phases

- **Phase 3** (`application_events` table + timeline): Table not created. No write helpers wired from any action endpoints. Any detail page with an activity timeline will render empty.
- **Phase 4** (HACH correspondence log): `hach_correspondence_log` table not created. "Log HACH email/call" buttons not built.
- **Phase 5** (tenant chase actions): Depends on `tenant_notifications` and Twilio from D-09.
- **Phase 6** (portfolio rollup cards): Not built.

---

## Section 3 — Placeholder Data

| ID | Item | File(s) | Severity | Effort to fix |
|---|---|---|---|---|
| P-01 | HUD AMI limits for Hartford MSA are unverified placeholders | `supabase/migrations/20260424162000_income_eligibility_schema.sql:60-93` | **Critical** | Low (data entry) |
| P-02 | `DEFAULT_MSA = '25540'` hardcoded in income engine | `lib/pbv/income-eligibility.ts:110` | Medium | Low |
| P-03 | `DEFAULT_AMI_PCT = 50` hardcoded in income engine | `lib/pbv/income-eligibility.ts:111` | Medium | Low |
| P-04 | `TOLERANCE_PCT = 10` hardcoded in income engine | `lib/pbv/income-eligibility.ts:112` | Medium | Low |
| P-05 | `HACH_STALE_DAYS = 10` hardcoded in pipeline route | `app/api/admin/pbv/pipeline/route.ts:142` | Medium | Low |
| P-06 | Session maxAge `60 * 60 * 24` (24h) hardcoded | `lib/auth.ts:51` | Medium | Low |
| P-07 | Invitation expiry `7 * 24 * 60 * 60 * 1000` (7 days) hardcoded | `app/api/hach/admin/users/route.ts:113` | Low | Low |
| P-08 | 4-week scheduling horizon from appointment-scheduling PRD (not built yet) | `docs/appointment-scheduling_prd_2026-04-24.md:46` | Low | N/A (future) |
| P-09 | ES/PT rejection templates — staff-authored translations, unverified | `supabase/migrations/20260424170000_rejection_reason_templates.sql:25-63` | Medium | Low (review) |

### P-01: HUD AMI figures

The migration file is explicit: `-- TODO: confirm with Dan — HUD AMI figures for Hartford MSA 25540 are PLACEHOLDER.` The 50% AMI values seeded are (household size 1–4): $38,450 / $43,950 / $49,450 / $54,900. If these are wrong by even 5%, the `qualifies` boolean returned by the income engine will be wrong — leading HACH reviewers to approve households that shouldn't qualify, or flag households that should. This is a federal program. The blast radius is every income eligibility determination until the correct values are loaded and `annual_amount` is recomputed on all existing `pbv_income_sources` rows.

**What the correct implementation looks like:** Load the official HUD FY2025 Income Limits for Hartford-West Hartford-East Hartford CT HUD Metro FMR Area (MSA 25540) directly from HUD's published table at `huduser.gov`. Have Dan or Alex confirm each row. Then update the seed values in the migration and run a recompute pass on all `pbv_income_sources.annual_amount`.

### P-02–P-04: Income engine hardcoded constants

`DEFAULT_MSA`, `DEFAULT_AMI_PCT`, and `TOLERANCE_PCT` are module-level constants with no path for configuration. If a second MSA is ever added (even Hartford County vs. Hartford City), or if a specific application needs an 80% band rather than 50%, the engine has no mechanism to accommodate it without a code change. These belong in the database (a config table or on the application/program row itself). Short term: `DEFAULT_MSA` and `DEFAULT_AMI_PCT` should come from `pbv_full_applications.msa_code` and `pbv_full_applications.ami_band` if those columns exist, or from a program config table.

### P-09: Multilingual rejection templates — quality

The Portuguese (PT) template for `illegible` reads: `"está muy borrado para ler"`. The phrase "muy borrado" is Spanish; the correct Portuguese would be "está muito embaçado para ler" or "está borrado demais para ler." This is the message that goes directly to tenants. Have a fluent Portuguese speaker review all 7 PT templates before go-live.

---

## Section 4 — Assumption Log

| ID | Ambiguity | Choice Made | Alternative Rejected | Depends on This Being Right |
|---|---|---|---|---|
| A-01 | Delta calculation: vs AMI limit or vs claimed income? | Compared to AMI limit | HUD EIV standard: compare to claimed_annual | `within_tolerance` flag, income discrepancy surfacing |
| A-02 | Stage backfill: `submitted_to_hach` vs `hach_review` boundary | Presence of `document_review_actions` = `hach_review` | No actions but `hach_review_status` set = `submitted_to_hach` | All pipeline stage metrics for existing apps |
| A-03 | `last_activity_at` backfill: `GREATEST(created_at, last_action_at, last_doc_revision_at)` | Used GREATEST with fallback to created_at | Simpler: just use created_at | Staleness clock accuracy |
| A-04 | `pbv_household_members` vs `pbv_application_members` | Used `pbv_household_members` (from DB inspection) | PRD used a different name | Income engine, packet view |
| A-05 | Employment income frequency default | `bi_weekly` for all employment in syncIncomeSourcesFromIntake | `weekly`, `semi_monthly` based on actual form fields | Accuracy of income sync for salaried/hourly workers |
| A-06 | Queue "Needs First Review" logic | No `document_review_actions` rows = needs first review | Time-based (created recently) | Queue grouping correctness |
| A-07 | "Approved This Week" queue group | All `hach_review_status = 'approved_by_hach'` (all-time) | Rolling 7-day window as PRD specifies | Queue semantics match reviewer expectation |
| A-08 | `form_submission_document_revisions` table existence | Assumed to exist from prior migration | Hard-fail if missing | Build 0 fix, view tracking, version nav |
| A-09 | `pbv_full_applications.preferred_language` column existence | Assumed from reject route usage | May not be a column; may live in `tenant_profiles` | Reject template language selection |
| A-10 | `form_submission_documents.status` accepts 'rejected' | Accepted silently by DB (no error on write) | Column has no CHECK — any string accepted | Status-based filtering in packet view |
| A-11 | HACH user `role` column value on account creation | Set to `'staff'` (legacy column) | `'hach_reviewer'` / `'hach_admin'` | Any code that still reads legacy `role` column |
| A-12 | MSA code is always Hartford '25540' | Single hardcoded constant | Per-application MSA from building/program config | Multi-MSA support, any non-Hartford applications |
| A-13 | `stage_changed_at` backfill = `created_at` | No historical transition timestamps → use created_at | Better: infer from first review action timestamps | Days-in-stage accuracy for all pre-existing applications |
| A-14 | `hach.users.manage` permission mapped to `action = 'admin'` | Used `admin` to fit existing CHECK constraint | Created new action value | HACH user management permission gating |

### A-01: Delta calculation error (Critical)

The PRD specification at `docs/income-eligibility-engine_prd_2026-04-24.md:78-79` defines:

```
delta = documented_annual - claimed_annual
within_tolerance = abs(delta) < 2400 AND abs(delta / claimed_annual) < 0.10
```

This is HUD's EIV discrepancy standard: is the documented income within $2,400 OR 10% of what the *tenant claimed*? The purpose is to catch cases where a tenant under-reported or over-reported their income.

The actual implementation in `lib/pbv/income-eligibility.ts:270-276` calculates:

```typescript
delta = documented_annual - amiLimit          // compares to AMI limit, not claimed income
deltaPct = delta / amiLimit                   // percentage of AMI limit
withinTolerance = deltaPct <= TOLERANCE_PCT   // single condition, not two-part HUD standard
```

This computes whether the household *qualifies* (income vs limit), which is a separate question from whether the documentation *matches the claim*. The `claimed_annual` field from the intake form is never loaded or used. The `within_tolerance` flag returned by the API is therefore meaningless for its intended purpose — identifying households where the document income diverges from the self-report. Reviewers relying on this flag to catch discrepancies will miss them.

### A-05: Employment income frequency default

`lib/pbv/income-sources.ts:137` maps all employment sources to `bi_weekly` by default in the frequency map. If a tenant is paid weekly, this underestimates annual income by 50% (`×26` instead of `×52`). If paid semi-monthly, it overestimates (`×26` instead of `×24`). The form may capture pay frequency, but `syncIncomeSourcesFromIntake` doesn't extract it — it reads the source type string only, not a `pay_frequency` field. Correct implementation: extract an explicit `pay_frequency` field from form_data per income source, or require staff to enter frequency manually.

### A-07: "Approved This Week" is all-time approved

The HACH queue in `app/api/hach/applications/route.ts:156-159` filters `hach_review_status === 'approved_by_hach'` with no date window. The PRD specifies "rolling 7-day view." Once there are many approved applications, this section will show the entire history, defeating the purpose of the "recent completions" panel and making the queue harder to scan.

---

## Section 5 — Error Handling & Edge Cases

| ID | Area | Gap | Severity | Effort |
|---|---|---|---|---|
| E-01 | Income engine: `claimed_annual = 0` | Division by zero in delta_pct | High | Low |
| E-02 | Income engine: no AMI limit row found | Returns null — engine continues silently | High | Low |
| E-03 | Reject route: `renderTemplate` failure is swallowed | Non-fatal catch at line 147 — logs but continues | Medium | Low |
| E-04 | Approve/reject: concurrent actions on same document | Last write wins; no optimistic lock | Medium | Medium |
| E-05 | Accept-invite POST: race condition between exists-check and insert | Gap between check and insert allows duplicate accounts | High | Low |
| E-06 | logAudit failure: primary action still succeeds | Audit trail silently drops entries on DB error | High | Low |
| E-07 | View tracking: fire-and-forget | Failed inserts into `application_view_events` are silent | Low | Low |
| E-08 | Pipeline route: `app.last_activity_at` can be null | Falls back to `created_at` — documented but could mislead | Low | Low |
| E-09 | Packet GET: `currentUser` is non-null asserted via `!` at line 96 in queue route | If session resolves null after requireHachUser passes, runtime crash | High | Low |
| E-10 | Approve route: `last_activity_at` update is in try/catch that swallows all errors | Silently continues even if column exists — no diagnostic | Low | Low |
| E-11 | Income engine: `household_size` clamped to 1-8 silently | A household_size of 0 or null becomes 1; 10 becomes 8 — no warning | Medium | Low |
| E-12 | Pipeline: division by zero in `income_status` delta_pct | `amiBySize[size]` can be 0 if seeded incorrectly | Low | Low |
| E-13 | Audit log route: `distinctActions` query fetches ALL HACH audit rows | No LIMIT — unbounded query grows with usage | Medium | Low |

### E-01: Division by zero in income engine

`lib/pbv/income-eligibility.ts:271-273`:

```typescript
deltaPct = amiLimit > 0
  ? Math.round((delta / amiLimit) * 10000) / 100
  : null;
```

The engine already guards `amiLimit > 0` here, but if `claimed_annual` is ever introduced into the calculation (as A-01 requires it to be), the expression `delta / claimed_annual` will divide by zero for declared-zero-income households. The PRD open question "How do we handle a household where income is $0 (declared zero income)?" is unanswered. Guard needed before this calculation is corrected.

### E-05: Race condition in accept-invite account creation

`app/api/hach/accept-invite/route.ts:112-123` checks for an existing account by email, then creates one if none exists. There's no transaction or DB-level unique constraint preventing two simultaneous POSTs with the same token from creating two accounts. The invite token itself has a `UNIQUE` constraint, but the token is consumed *after* the account is created (line 146-149), and the account creation is not transactional. Fix: use `ON CONFLICT DO NOTHING` with a post-check, or use a database transaction.

### E-06: Audit log failure does not block primary action

In every HACH route, `logAudit()` is called with `await` but its failure (if the `audit_log` insert fails) will throw an uncaught exception that propagates to the route's outer `catch`, returning a 500 to the reviewer. The primary action (approve/reject) has already been committed. This means:
- On `audit_log` failure: the document is approved/rejected, but the 500 response causes the optimistic UI to *revert* the action — leaving the DB in approved state while the UI shows pending.
- If `logAudit()` is not awaited (it could be made fire-and-forget to avoid this), then audit entries silently drop on error.

Neither outcome is acceptable for a federal compliance audit trail. The correct pattern: make the primary DB write atomic with the audit log insert via a Postgres function or separate the two with clear user-facing messaging ("Action saved — audit log temporarily unavailable").

### E-09: Non-null assertion on `currentUser`

`app/api/hach/applications/route.ts:96`:
```typescript
const currentUserId = currentUser!.userId;
```

`getSessionUser()` is called at line 95 after `requireHachUser()` already passed (line 12). Because `requireHachUser()` calls `getSessionUser()` internally and returns a 401/403 if null, `currentUser` should never be null here in practice. However, the non-null assertion bypasses TypeScript's guard — if the session resolves to null in a second `getSessionUser()` call (e.g., due to a session write race), this crashes with an uncaught TypeError. The pattern of calling `requireHachUser()` + `getSessionUser()` twice is a structural issue; the guard should return the user so it's not re-fetched.

---

## Section 6 — Authorization & Scoping Gaps

| ID | Gap | File(s) | Severity | Effort |
|---|---|---|---|---|
| C-04 | GET `/api/hach/applications/[id]` — no HACH scope check | `app/api/hach/applications/[id]/route.ts:21-38` | **Critical** | Low |
| C-05 | Deactivated users retain session for 24h | `lib/auth.ts:129-130`, `middleware.ts:80-114` | **Critical** | Low |
| C-06 | No CSRF protection on any state-changing route | All POST/PATCH/DELETE routes | **Critical** | Medium |
| S-01 | All HACH API routes use service_role bypassing RLS | All routes via `supabaseAdmin` | Medium | Medium |
| S-02 | `/api/hach/admin/*` — gated at route handler, not middleware | `app/api/hach/admin/users/route.ts:6-17` | Medium | Low |
| S-03 | Stanton super admin can impersonate a deactivated user via session cookie | `lib/auth.ts:152-158` | Low | Low |
| S-04 | `accept-invite` route is fully public — no rate limiting | `app/api/hach/accept-invite/route.ts` | Medium | Low |
| S-05 | Middleware HACH block at `/api/admin/auth` exception may be broader than intended | `middleware.ts:36` | Low | Low |

### C-04: Missing scope check on application GET (Critical)

`app/api/hach/applications/[id]/route.ts` calls `requireHachUser()` (authentication check), then fetches the application directly with `.eq('id', id)` and no additional filter. The PRD requirement at `docs/hach-auth_prd_2026-04-24.md:43-45` states: "Every query executed under a HACH user session is scoped to PBV applications only. Attempting to access any non-PBV table or record via the HACH portal returns 403."

The application fetch should include `.not('hach_review_status', 'is', null)` (matching the pattern used correctly in `app/api/hach/documents/[id]/approve/route.ts:47-48`). Without this, a HACH reviewer who learns an application UUID for any application — including non-PBV, pre-submission, or Stanton-only records — can read its full household composition, income data, and citizenship status.

**The approve and reject routes do this correctly.** Only the main packet GET is missing the check. This is almost certainly a copy-paste omission.

### C-05: Deactivated users retain sessions

`lib/auth.ts:129-130` in `loadSessionUserFromDb()` checks `is_active`:
```typescript
if (!row || !row.is_active) return null;
```

But `loadSessionUserFromDb()` is only called during impersonation. The main `getSessionUser()` at line 145-173 reads directly from the session cookie — it never checks whether the user's `is_active` or `deactivated_at` has changed since login. The deactivate endpoint at `app/api/hach/admin/users/[id]/deactivate/route.ts` writes to the DB, but the deactivated user's session cookie remains valid for 24 hours.

**Fix:** In `getSessionUser()`, after reading the session, call `supabaseAdmin.from('admin_users').select('is_active, deactivated_at').eq('id', session.userId).single()` and return null if `!row.is_active`. This adds one DB read per request for authenticated users — acceptable given the security requirement, or cache the result in the session with a short TTL.

### C-06: No CSRF protection

No route uses `SameSite` cookie attribute explicitly (left to iron-session default), no custom header validation (e.g., `X-Requested-With`), and no CSRF token in any form or mutation. The admin session cookie being `httpOnly: true` and `secure: true` in production limits the attack surface for XSS-based CSRF, but does not protect against cross-origin form-based CSRF. State-changing routes (approve, reject, assign, deactivate, invite, bulk-assign) should at minimum verify that `Origin` or `Referer` matches the expected host in production. Iron-session's `SameSite` defaults to `'lax'` in recent versions — confirm this is the case and document it explicitly.

### S-01: Service-role for all queries

Every HACH route uses `supabaseAdmin` (service_role key) which bypasses all RLS policies. RLS is correctly enabled on all new tables, but it only protects against direct Supabase client access (anon key, authenticated JWT), not server-side service_role. This means:
- RLS on `document_review_actions` does not prevent a buggy server-side query from reading another HACH user's review actions.
- The defense-in-depth layer that RLS provides is absent for all server-side logic.
- If a route accidentally omits the `full_application_id` filter, it will return all rows.

Correct pattern: create a Supabase client per-request using the user's JWT (not service_role) for queries that should be user-scoped. Use service_role only for operations that genuinely need to bypass RLS (admin user creation, cross-user queries with explicit authorization checks).

---

## Section 7 — Data Integrity & Migration Concerns

| ID | Item | File(s) | Severity | Effort |
|---|---|---|---|---|
| C-03 | Column name mismatch: pipeline queries `income_limit`, column is `annual_limit` | `app/api/admin/pbv/pipeline/route.ts:130`, migration `20260424162000` | **Critical** | Trivial |
| C-01 | HUD AMI figures are unverified placeholders | `supabase/migrations/20260424162000_income_eligibility_schema.sql:60-93` | **Critical** | Data entry |
| M-01 | Stage backfill not recorded in migration file | `supabase/migrations/20260424171000_pbv_pipeline_stage_columns.sql:25-28` | High | Low |
| M-02 | `document_review_actions` cascade delete destroys audit trail | `supabase/migrations/20260424163000_hach_reviewer_portal_schema.sql:36` | Medium | Low |
| M-03 | Append-only not enforced at DB level | `document_review_actions`, `audit_log` tables | Medium | Low |
| M-04 | `form_submission_documents.status` has no CHECK constraint (assumed) | Session notes line 272 | High | Low |
| M-05 | `pbv_income_sources.source_type` has no CHECK constraint | `supabase/migrations/20260424162000_income_eligibility_schema.sql:105` | Medium | Low |
| M-06 | `tenant_notifications.delivery_status` has no CHECK constraint | `supabase/migrations/20260424170000_rejection_reason_templates.sql:79` | Low | Low |
| M-07 | `stage_changed_at = created_at` backfill makes all days-in-stage metrics inaccurate | `supabase/migrations/20260424171000_pbv_pipeline_stage_columns.sql:26` | Medium | Medium |
| M-08 | `form_submission_document_revisions` existence assumed — not in today's migrations | Session notes line 186-188, queue route line 117-130 | High | Verify |
| M-09 | `application_view_events` grows unboundedly | `supabase/migrations/20260424163000_hach_reviewer_portal_schema.sql:72-89` | Low | Low |
| M-10 | Real Supabase credentials in `.env.local.example` | `.env.local.example:2-3` | High | Low |
| M-11 | `hach_user_invitations` has no index on unexpired tokens for validation performance | `supabase/migrations/20260424160000_hach_auth_schema.sql:70-75` | Low | Low |

### C-03: Column name mismatch — pipeline income status is broken

`app/api/admin/pbv/pipeline/route.ts:130-138` selects `income_limit` from `hud_ami_limits`:
```typescript
const { data: amiRows } = await supabaseAdmin
  .from('hud_ami_limits')
  .select('household_size, income_limit, ami_pct')
```

The column created in `supabase/migrations/20260424162000_income_eligibility_schema.sql:27` is `annual_limit`. Supabase returns `null` for a non-existent column in a `select()` without throwing an error. This means `amiBySize` will be an empty object, and every row in the pipeline will have `income_status = 'no_data'` regardless of actual income. The income qualification column — one of the primary value propositions of the dashboard — is completely non-functional. **This is a live bug in committed code. One-character rename fixes it.**

### M-01: Stage backfill missing from migration

`supabase/migrations/20260424171000_pbv_pipeline_stage_columns.sql:25-28` contains only:
```sql
-- Backfill: see MCP migration for logic details.
-- stage_changed_at = created_at (no historical transition timestamps available)
-- last_activity_at = greatest(created_at, last doc revision, last review action)
```

The actual backfill SQL was applied live via MCP and is not recorded in the migration file. A fresh deployment would result in `stage = NULL` for all existing applications, which would:
- Break the pipeline filter (`.eq('stage', filterStage)` would find nothing)
- Break the blocked-on computation (defaults to `'intake'`)
- Make the entire pipeline table useless for existing data

**Fix:** Add the actual backfill CTE from the MCP session into the migration file and verify it's idempotent.

### M-02: Audit trail destruction via cascade

`document_review_actions` has `ON DELETE CASCADE` on its `document_id` FK to `form_submission_documents`. The table comment says "append-only" and "Do not update or delete rows." But if a document row is ever deleted (even by accident), all review actions for that document are silently destroyed. For a federal program audit trail, this is a compliance risk. The FK behavior should be `ON DELETE SET NULL` or `ON DELETE RESTRICT` to prevent document deletion from silently destroying review history.

### M-03: Append-only convention not enforced

Both `document_review_actions` and `audit_log` are described as append-only in their table comments. Neither has DB-level enforcement. Any service_role query (including all server-side routes) can `UPDATE` or `DELETE` rows without restriction. For a federal audit trail, append-only should be enforced with:
- A BEFORE UPDATE trigger that raises an exception
- A BEFORE DELETE trigger that raises an exception
- Or at minimum, RLS policies that deny UPDATE and DELETE even to authenticated users (keeping service_role access only for reads + inserts)

### M-04: `form_submission_documents.status` unconstrained

Session notes (line 272): "assumed consistent with existing check constraint... `rejected` write was silently accepted by DB, confirming it's valid or unconstrained." If the column has no CHECK constraint, any status string can be written. Query logic in multiple routes filters on specific status values (`'missing'`, `'pending'`, `'approved'`, `'rejected'`). A typo in any write path silently creates a row that's invisible to all filters. Verify and add a CHECK constraint.

### M-10: Real credentials in example env file

`.env.local.example:2-3` contains the actual production Supabase URL and anon key (not placeholders). The anon key is a JWT-encoded public key and is designed to be public-facing — but embedding the production project URL in a file that's intended as a template is a documentation smell and trains contributors to include real values in examples. The service role key on line 3 is also the real production service role key, which grants full DB access bypassing RLS. This file should be committed with placeholder strings.

---

## Section 8 — Performance Concerns

| ID | Item | File(s) | Severity | Effort |
|---|---|---|---|---|
| Perf-01 | No pagination on pipeline route — fetches all applications | `app/api/admin/pbv/pipeline/route.ts:37-51` | Medium | Medium |
| Perf-02 | No pagination on HACH queue route | `app/api/hach/applications/route.ts:17-41` | Medium | Medium |
| Perf-03 | `distinctActions` query in audit log route fetches all rows | `app/api/hach/admin/audit-log/route.ts:82-86` | Medium | Low |
| Perf-04 | `application_view_events` unbounded growth | `supabase/migrations/20260424163000:72-89` | Low | Low |
| Perf-05 | Signed URL generation per render in document viewer | `app/api/hach/documents/[id]/signed-url/route.ts` | Low | Medium |
| Perf-06 | Income engine fires `Promise.allSettled` update per source row | `lib/pbv/income-eligibility.ts:246-259` | Low | Low |
| Perf-07 | Audit log route resolves all HACH user IDs on every request | `app/api/hach/admin/audit-log/route.ts:30-39` | Low | Low |

### Perf-01: No pagination on pipeline

`app/api/admin/pbv/pipeline/route.ts` fetches all `pbv_full_applications` rows matching the filter with no `LIMIT`. The route then fetches documents, review actions, assignee names, income sources, and AMI limits in 5 additional batch queries. At the current scale (dozens of applications), this is fine. At 100+ applications, the document and review action fetches (which use `.in('form_submission_id', submissionIds)` and `.in('full_application_id', appIds)`) will become slow. The route does not return a pagination cursor — the client cannot request a subset.

### Perf-03: `distinctActions` unbounded fetch

`app/api/hach/admin/audit-log/route.ts:82-86` fetches every audit log row for all HACH users in order to build a dropdown of distinct action types:
```typescript
const { data: distinctActions } = await supabaseAdmin
  .from('audit_log')
  .select('action')
  .in('user_id', hachUserIds);
```

As the audit log grows (thousands of entries), this query will transfer the full `action` column for every row. Should be replaced with a `SELECT DISTINCT action` SQL query or a separate materialized view.

---

## Section 9 — UI Polish Deferred

| ID | Item | File(s) | Severity | Effort |
|---|---|---|---|---|
| UI-01 | "Approved This Week" queue group shows all-time approved | `app/api/hach/applications/route.ts:156-159`, `app/hach/page.tsx` | Medium | Low |
| UI-02 | No empty state for HACH queue when all groups empty | `app/hach/page.tsx` | Low | Low |
| UI-03 | No empty state for pipeline table | `app/admin/pbv/pipeline/page.tsx` | Low | Low |
| UI-04 | Accessibility: keyboard shortcuts not announced to screen readers | `app/hach/applications/[id]/page.tsx` | Low | Medium |
| UI-05 | IBM Plex Sans loaded from Google Fonts (external dependency, no subset) | `app/hach/layout.tsx` | Low | Low |
| UI-06 | All HACH components use inline styles, not design system tokens | All `components/hach/*.tsx` | Low | High |
| UI-07 | No loading skeleton on HACH queue — full re-render on filter | `app/hach/page.tsx` | Low | Low |
| UI-08 | Error state in pipeline: API failure silently shows empty table | `app/admin/pbv/pipeline/page.tsx` | Low | Low |
| UI-09 | `ShortcutsBar` labels don't reflect disabled state of Reject until Phase 4 wiring | `app/hach/applications/[id]/page.tsx` | Low | Low |
| UI-10 | HACH portal not validated for mobile responsiveness | All `app/hach/*` pages | Low | Medium |

### UI-01: "Approved This Week" scope

The PRD defines this as a "rolling 7-day view." The implementation shows all-time approved applications. In the short term (fresh system), this is cosmetically equivalent. After weeks of use, this panel will become a growing list that defeats the "recent completions" intent. Fix: add `.gte('updated_at', sevenDaysAgo)` to the approved filter in the queue route, or filter on the timestamp of the last `document_review_actions` row.

### UI-06: HACH components not in design system

Every component in `components/hach/` uses inline styles rather than CSS custom properties from the design system. This was the correct call for velocity during these sessions, but it means:
- Colors (`#0f4c5c`, `#1b6b7e`, etc.) are hardcoded strings repeated across files
- Any design change requires a grep-and-replace across all HACH components
- The institutional design standards documented in the project rules are not applied

The HACH portal is a significant user-facing surface. This debt should be resolved before the system goes to real HACH users.

---

## Section 10 — Test Coverage Gaps

| ID | Item | Coverage status | Severity | Effort |
|---|---|---|---|---|
| T-01 | Income engine `annualize()` and `computeHouseholdIncome()` | ✅ Vitest suite exists | — | — |
| T-02 | HACH auth routes (login, accept-invite, deactivate) | ❌ No tests | High | Medium |
| T-03 | Document approve/reject routes | ❌ No tests | High | Medium |
| T-04 | User invitation flow end-to-end | ❌ No tests | High | Medium |
| T-05 | Pipeline route — filtering, blocked-on logic, income_status | ❌ No tests | High | Medium |
| T-06 | `syncIncomeSourcesFromIntake()` — form_data parsing | ❌ No tests | High | Medium |
| T-07 | Income delta calculation (blocked by A-01 — calculation needs to be fixed first) | ❌ No tests for correct behavior | High | Medium |
| T-08 | `seed-hach-test-data.ts` — not idempotent | ❌ No guard against re-run | Medium | Low |
| T-09 | Middleware HACH/Stanton routing decisions | ❌ No tests | Medium | Medium |
| T-10 | Rejection template `interpolateTemplate()` | ❌ No tests | Low | Low |
| T-11 | Audit log viewer filtering and pagination | ❌ No tests | Low | Low |

### T-08: Seed script not idempotent

`scripts/seed-hach-test-data.ts` inserts three test applications via `form_submissions` insert with no upsert/deduplication guard. Re-running the script creates a second set of three applications. The packet view in the queue will show duplicates ("Maria Santos ×2"). Add an existence check by `tenant_name + building_address + unit_number`, or use `ON CONFLICT DO NOTHING` with a deterministic seed ID.

### T-07: Income delta tests test the wrong thing

`lib/pbv/__tests__/income-eligibility.test.ts:243-260` tests that an application with $4,000/month employment is flagged as `within_tolerance: false` when income exceeds the AMI limit. This test validates the *current (wrong)* implementation, not the HUD EIV standard. Once A-01 is fixed (delta vs claimed_annual), this test will need to be rewritten to mock `claimed_annual` and test the two-condition EIV threshold.

---

## Section 11 — Deployment & Operations

| ID | Item | File(s) | Severity | Effort |
|---|---|---|---|---|
| Ops-01 | Real Supabase credentials in `.env.local.example` | `.env.local.example:2-3` | High | Trivial |
| Ops-02 | Missing env vars: `TWILIO_*`, `NEXT_PUBLIC_APP_URL` | `.env.local.example` | High | Low |
| Ops-03 | Stage backfill SQL not in migration — fresh deploy leaves stage=NULL | `supabase/migrations/20260424171000` | High | Low |
| Ops-04 | `seed-hach-test-data.ts` targets production if `.env.local` has prod keys | `scripts/seed-hach-test-data.ts:18-21` | Medium | Low |
| Ops-05 | No rate limiting on public endpoints | `app/api/hach/accept-invite/route.ts`, `/api/t/[token]/*` | Medium | Low |
| Ops-06 | All logging via `console.log`/`console.error` — no structured log format | All HACH routes | Low | Medium |
| Ops-07 | Session inactivity timeout (30 min per PRD) not implemented | `lib/auth.ts:44-52` | High | Medium |
| Ops-08 | No migration for `hach_correspondence_log` or `application_events` tables | PRD data model | Medium | Low (create when building phases) |
| Ops-09 | No feature flags for staged HACH rollout | — | Low | Medium |

### Ops-02: Missing environment variables

`.env.local.example` is missing:
- `TWILIO_ACCOUNT_SID` — required by rejection-tenant-loop Phase 2
- `TWILIO_AUTH_TOKEN` — required
- `TWILIO_FROM_NUMBER` — required (open question: Stanton vs dedicated PBV number)
- `NEXT_PUBLIC_APP_URL` — referenced in invite URL generation (`app/api/hach/admin/users/route.ts:131`); falls back to `http://localhost:3000` in production if unset, generating invalid invite URLs

The `.env.local.example` serves as the definitive list of required environment variables. It should be kept complete even for features not yet built.

### Ops-05: No rate limiting on accept-invite

`/api/hach/accept-invite` (both GET and POST) is a fully public route with no authentication and no rate limiting. An attacker can enumerate invitation tokens by brute-forcing the endpoint (tokens are `crypto.randomUUID()` — UUID v4 with ~122 bits of entropy, so brute force is not practical). However, the GET endpoint leaks whether a given token has expired or been used (`410 Already used` vs `410 Expired` vs `404 Unknown`) — information that should be consolidated into a single error to prevent oracle attacks. More practically: there's no limit on the number of POST attempts with an invalid token, enabling credential stuffing against the password validation logic on the server. Add Vercel's edge rate limiting or a `upstash/ratelimit` wrapper.

### Ops-07: Session inactivity timeout

The PRD `docs/hach-auth_prd_2026-04-24.md:75` specifies "Session timeout: 30 min of inactivity." The session is configured with `maxAge: 60 * 60 * 24` (24 hours absolute, `lib/auth.ts:51`). Iron-session does not support idle/inactivity timeout natively — it only supports absolute expiry. Implementing 30-minute inactivity requires either:
- Storing a `last_active_at` timestamp in the session and checking it on every request in middleware
- Or using a shorter absolute maxAge (30 min) and extending it on each authenticated request

For a federal program with PII (SSN last-4, citizenship status, income), the 24-hour window is a significant deviation from the stated requirement.

---

## Section 12 — PRD Scope Not Yet Built

### hach-auth PRD

| Phase | Status | Notes |
|---|---|---|
| Phase 1 — Schema & backfill | ✅ Complete | |
| Phase 2 — Route guards | ✅ Complete | |
| Phase 3 — HACH user management UI | ✅ Complete | Missing: password reset (D-03) |
| Phase 4 — Audit logging | ✅ Complete | Missing: Stanton-side audit log view at `/admin/pbv/audit-log`; `logAudit()` does not set `user_type` column |
| Out of scope: session inactivity | ❌ Not built | PRD explicitly specifies 30-min timeout (Ops-07) |

**Dependency note:** The `logAudit()` helper in `lib/audit.ts` does not write the `user_type` column added by `20260424160000_hach_auth_schema.sql`. The audit log viewer works around this by filtering on `user_id IN (hach_user_ids)` rather than `user_type`. If a Stanton user is later assigned a HACH-facing action, their `user_type` distinction would be invisible in the log. Fix: extend `logAudit()` to accept and write `user_type` from the `SessionUser`.

---

### hach-reviewer-portal PRD

| Phase | Status | Notes |
|---|---|---|
| Phase 1 — Read-only packet view | ✅ Complete | Scope check missing on GET [id] (C-04) |
| Phase 2 — Approve action | ✅ Complete | `hach_review_status` not auto-advanced on first approve |
| Phase 3 — Document viewer | ✅ Complete | |
| Phase 4 — Reject action (stub) | ✅ Complete | Notification deferred (D-01) |
| Phase 5 — Keyboard shortcuts | ✅ Complete | |
| Phase 6 — View tracking + new badges | ✅ Complete | |
| Phase 7 — Issue Voucher | ❌ Not built | Terminal action for HACH approval cycle |

**Dependency note:** Phase 7 (Issue Voucher) is the event that triggers downstream work — HAP contract, inspection scheduling, notifications to HACH and Stanton. Nothing downstream can be built until this emits a defined event or status change. If appointment scheduling or HAP tracking is built before Phase 7, it will have no trigger to listen for.

---

### income-eligibility-engine PRD

| Phase | Status | Notes |
|---|---|---|
| Phase 1 — Schema + seed | ✅ Complete | AMI figures are placeholder (P-01) |
| Phase 2 — Source normalization | ✅ Complete | Employment frequency defaulted incorrectly (A-05) |
| Phase 3 — Computation function | ✅ Complete | Delta calculation wrong (A-01/C-02) |
| Phase 4 — API endpoint | ✅ Complete | |
| Phase 5 — AMI limits admin UI | ❌ Explicitly skipped | |

**Dependency note:** The pipeline dashboard's income status column (C-03) and the HACH packet view income panel both depend on this engine being correct. Until P-01 (AMI figures) and A-01 (delta calculation) are fixed, both surfaces display incorrect data.

---

### rejection-tenant-loop PRD

| Phase | Status | Notes |
|---|---|---|
| Phase 1 — Template system | ✅ Complete | Table + seed + helper built |
| Phase 2 — Notification ledger + send | ❌ Not built | Core of the loop |
| Phase 3 — Reject dialog enhancement | ✅ Partial | Preview works; send deferred |
| Phase 4 — Magic link resubmission surface | ❌ Not built | Tenant portal not updated |
| Phase 5 — Twilio webhook handler | ❌ Not built | |
| Phase 6 — 48-hour SLA | ❌ Not built | |

**Dependency note:** Phase 5 (Twilio webhook) requires a publicly accessible endpoint. If the app is behind auth middleware without an explicit exception, Twilio cannot POST to it. Plan the webhook URL and exception in middleware before wiring Twilio.

---

### stanton-pipeline-dashboard PRD

| Phase | Status | Notes |
|---|---|---|
| Phase 1 — Stage enum + pipeline table | ✅ Complete | C-03 makes income column broken; M-01 makes stage=NULL on fresh deploy |
| Phase 2 — Assignment | ✅ Complete | |
| Phase 3 — Activity event stream | ❌ Not built | `application_events` table not created |
| Phase 4 — HACH correspondence log | ❌ Not built | `hach_correspondence_log` table not created |
| Phase 5 — Tenant chase actions | ❌ Not built | Depends on rejection-tenant-loop Phase 2 |
| Phase 6 — Portfolio rollup | ❌ Not built | |

---

### appointment-scheduling PRD

| Phase | Status | Notes |
|---|---|---|
| All phases | ❌ Not built | Entire PRD not yet started |

**Dependency note:** This PRD depends on Twilio (for SMS confirmations). It should be built after rejection-tenant-loop Phase 2 establishes the Twilio integration, to avoid duplicating the send infrastructure.

---

## Recommended Remediation Order

Prioritized by **risk × effort** (highest impact, lowest effort first):

1. **C-03** (1 line) — Fix `income_limit` → `annual_limit` in pipeline route. The income status column is broken right now.
2. **C-04** (1 line) — Add `.not('hach_review_status', 'is', null)` scope check to `GET /api/hach/applications/[id]`.
3. **M-10** (trivial) — Replace real credentials in `.env.local.example` with placeholder strings.
4. **P-01** (data entry) — Confirm HUD AMI figures with Dan. Correct the seed data. Run `computeHouseholdIncome` recompute on all existing applications.
5. **A-01 / C-02** (medium) — Fix delta calculation to compare `documented_annual` vs `claimed_annual`, implement two-condition HUD EIV tolerance check. Update Vitest tests.
6. **C-05** (low) — Add `is_active` check in `getSessionUser()` to invalidate deactivated user sessions.
7. **D-02** (low) — Wire invitation email via Resend. One API call. Already have the `RESEND_API_KEY` env var.
8. **Ops-07** (medium) — Implement 30-minute inactivity timeout via session last-active tracking in middleware.
9. **M-01** (low) — Add actual backfill SQL to the pipeline migration file.
10. **D-01** (medium) — Wire Twilio for rejection notifications (requires Twilio credentials and open question resolution on phone number source).

---

## Quick Wins

Items that are **Critical or High severity but Low effort**:

| ID | Fix | Time estimate |
|---|---|---|
| C-03 | Rename `income_limit` → `annual_limit` in pipeline route | 5 minutes |
| C-04 | Add scope filter on application GET | 5 minutes |
| M-10 | Placeholder credentials in .env.example | 5 minutes |
| Ops-02 | Add missing TWILIO_* and NEXT_PUBLIC_APP_URL to .env.example | 10 minutes |
| D-02 | Wire Resend for invitations (email template + one API call) | 30 minutes |
| M-03 | Add BEFORE DELETE/UPDATE triggers on audit tables | 30 minutes |
| M-02 | Change document_review_actions FK to ON DELETE SET NULL | 15 minutes + migration |
| E-05 | Wrap accept-invite account creation in upsert pattern | 30 minutes |

---

## Blockers for Production Pilot

The minimum set that must be resolved before putting this in front of real HACH users:

1. **C-01** — HUD AMI figures confirmed and corrected. Eligibility determinations must be accurate.
2. **C-02 / A-01** — Income delta calculation fixed to match HUD EIV standard.
3. **C-03** — Pipeline income column fixed (one-line rename).
4. **C-04** — Application scope check on HACH packet GET.
5. **C-05** — Session invalidation on deactivation.
6. **C-06** — CSRF protection (at minimum: Origin header check in production, or SameSite=Strict confirmation).
7. **D-02** — Invitation email actually sent (cannot onboard HACH users otherwise).
8. **D-01** — Rejection notification sent (the entire rejection-to-resubmission loop is the core product promise).
9. **Ops-07** — Session inactivity timeout (federal program requirement).
10. **M-01** — Stage backfill in migration (otherwise pipeline is empty for all existing applications on any new deployment).
11. **M-04** — Confirm and add CHECK constraint on `form_submission_documents.status`.
