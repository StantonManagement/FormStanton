# Rejection Notifications + Twilio + Intake Language — Build Plan
**Date:** 2026-05-01  
**Status:** Awaiting confirmation

---

## Pre-build findings (code audit)

### What already exists
- `twilio` v5.13.0 in `package.json` ✓
- `lib/phoneParser.ts` with `parsePhoneToE164()` ✓
- `FormPhoneInput` component at `@/components/form` ✓
- `lib/rejection-templates.ts` with `renderTemplate()` and `interpolateTemplate()` ✓
- `LanguageLanding` component at `@/components/form` ✓
- Twilio send pattern in `lib/sendPortalLink.ts` ✓
- `rejection_reason_templates` table (TEXT PK `code`, not UUID) ✓
- `tenant_notifications` table — **EXISTS but schema is wrong** (see deviations)
- `preferred_language` on `pbv_full_applications` — **uncertainty** (A-09 in debt audit: may or may not be a column; code references it, no migration records it). Will `ADD COLUMN IF NOT EXISTS`.

### Deviations from spec — flagged before build

| # | Spec says | Reality | Plan |
|---|---|---|---|
| D1 | Verify `tenant_notifications` | Table exists but has wrong column names: `message` not `message_body`, `recipient` not `recipient_phone`, `provider_message_id` not `twilio_message_sid`, `error_detail` not `delivery_error`, `triggered_by`+`channel` not `notification_type`. FK is ON DELETE CASCADE not RESTRICT. | DROP + recreate. Zero rows ever written (all notifications deferred). |
| D2 | Diff vs `tenant_profiles` | `tenant_profiles` does not exist. The AppFolio sync table is `tenant_lookup` (has `phone`, `preferred_language`, `is_current`). | `appfolio_update_queue` view joins `pbv_full_applications` → `tenant_lookup` on `(building_address, unit_number)` WHERE `is_current = true`. |
| D3 | Phase 3.2: update middleware to allow `/api/webhooks/twilio` | Middleware matcher is `/admin/:path*`, `/api/admin/:path*`, `/hach/:path*`, `/api/hach/:path*`. The webhook path is none of these — it's already unguarded. | No middleware change needed. |
| D4 | `template_id UUID` in `tenant_notifications` | `rejection_reason_templates.code` is TEXT PK. A UUID FK would be invalid. | Column will be `template_code TEXT REFERENCES rejection_reason_templates(code)` instead. |
| D5 | Pre-fill phone from `tenant_profiles` | No `tenant_profiles`. Will look up from `tenant_lookup` on `(building_address, unit_number, is_current=true)` and return as `phone_hint` in the GET response. | GET `/api/t/[token]/pbv-full-app` extended to return `phone_hint`. Form pre-fills from it. |

---

## Files to create

| File | Phase |
|---|---|
| `supabase/migrations/20260501000000_pbv_application_contact_fields.sql` | 1 |
| `lib/notifications.ts` | 2.1 |
| `app/api/webhooks/twilio/route.ts` | 3.1 |
| `app/api/admin/pbv/appfolio-queue/route.ts` | 5.3 |
| `app/admin/pbv/appfolio-queue/page.tsx` | 5.3 |
| `lib/__tests__/notifications.test.ts` | Tests |

## Files to modify

| File | Phase | Change |
|---|---|---|
| `app/api/hach/documents/[id]/reject/route.ts` | 2.2 | Wire `sendRejectionNotification`, remove console stub |
| `app/api/t/[token]/pbv-full-app/route.ts` | 4.2 | GET: add `phone_hint`; POST: write phone/language/language_confirmed_at |
| `app/pbv-full-app/[token]/page.tsx` | 4.1 | Add phone field + language confirmation to section 1 |
| `lib/pbvFullAppTranslations.ts` | 4.1 | Add phone + language confirmation string keys |
| `app/api/admin/pbv/pipeline/route.ts` | 5.1 | Select `phone`, `language_confirmed_at` |
| `app/admin/pbv/pipeline/page.tsx` | 5.1/5.2 | "Needs contact info" badge + bulk SMS pre-filter warning |
| `.env.local.example` | 6 | Add Twilio + app URL vars |

---

## Phase 1 — Schema

### Migration: `20260501000000_pbv_application_contact_fields.sql`

**1.1 Extend `pbv_full_applications`:**
```sql
ALTER TABLE public.pbv_full_applications
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS preferred_language TEXT,
  ADD COLUMN IF NOT EXISTS language_confirmed_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE public.pbv_full_applications
    ADD CONSTRAINT pbv_preferred_language_check
      CHECK (preferred_language IN ('en', 'es', 'pt'));
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS idx_pbv_preferred_language
  ON public.pbv_full_applications (preferred_language);
```

**1.2 Rebuild `tenant_notifications`:**
```sql
-- Drop existing notification_id FK in document_review_actions first
ALTER TABLE public.document_review_actions
  DROP COLUMN IF EXISTS notification_id;

-- Drop and recreate with correct schema (no production data exists)
DROP TABLE IF EXISTS public.tenant_notifications;

CREATE TABLE public.tenant_notifications (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id      UUID        NOT NULL REFERENCES public.pbv_full_applications(id) ON DELETE RESTRICT,
  document_id         UUID        REFERENCES public.form_submission_documents(id) ON DELETE SET NULL,
  notification_type   TEXT        NOT NULL,  -- e.g. 'document_rejected'
  language            TEXT        NOT NULL CHECK (language IN ('en', 'es', 'pt')),
  recipient_phone     TEXT        NOT NULL,
  message_body        TEXT        NOT NULL,
  template_code       TEXT        REFERENCES public.rejection_reason_templates(code),
  twilio_message_sid  TEXT,
  delivery_status     TEXT        NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN (
      'pending', 'queued', 'sent', 'delivered', 'failed',
      'blocked_missing_data', 'blocked_invalid_phone'
    )),
  delivery_error      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at             TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ
);

ALTER TABLE public.tenant_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on tenant_notifications"
  ON public.tenant_notifications FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS tn_app_created_idx
  ON public.tenant_notifications (application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tn_status_idx
  ON public.tenant_notifications (delivery_status);
CREATE INDEX IF NOT EXISTS tn_sid_idx
  ON public.tenant_notifications (twilio_message_sid)
  WHERE twilio_message_sid IS NOT NULL;

-- Restore FK in document_review_actions
ALTER TABLE public.document_review_actions
  ADD COLUMN IF NOT EXISTS notification_id UUID REFERENCES public.tenant_notifications(id);
```

**1.3 `appfolio_update_queue` view:**
```sql
CREATE OR REPLACE VIEW public.appfolio_update_queue AS
SELECT
  pfa.id           AS application_id,
  pfa.head_of_household_name AS tenant_name,
  pfa.building_address AS building,
  pfa.unit_number  AS unit,
  'phone'          AS field_name,
  tl.phone         AS appfolio_value,
  pfa.phone        AS pbv_value,
  pfa.language_confirmed_at AS confirmed_at
FROM public.pbv_full_applications pfa
JOIN public.tenant_lookup tl
  ON tl.building_address = pfa.building_address
  AND tl.unit_number = pfa.unit_number
  AND tl.is_current = true
WHERE pfa.phone IS NOT NULL
  AND (tl.phone IS NULL OR tl.phone <> pfa.phone)

UNION ALL

SELECT
  pfa.id,
  pfa.head_of_household_name,
  pfa.building_address,
  pfa.unit_number,
  'preferred_language',
  tl.preferred_language,
  pfa.preferred_language,
  pfa.language_confirmed_at
FROM public.pbv_full_applications pfa
JOIN public.tenant_lookup tl
  ON tl.building_address = pfa.building_address
  AND tl.unit_number = pfa.unit_number
  AND tl.is_current = true
WHERE pfa.preferred_language IS NOT NULL
  AND pfa.language_confirmed_at IS NOT NULL
  AND (tl.preferred_language IS NULL OR tl.preferred_language <> pfa.preferred_language);
```

---

## Phase 2 — Notifications library

### `lib/notifications.ts`

```typescript
type SendRejectionParams = {
  documentId: string;
  reasonCode: string;
  customNote?: string;
  reviewerId: string;
};

type SendRejectionResult =
  | { status: 'sent'; notificationId: string; twilioSid: string }
  | { status: 'blocked'; notificationId: string; reason: 'missing_phone' | 'missing_language' | 'invalid_phone' }
  | { status: 'failed'; notificationId: string; error: string };
```

Logic order:
1. Look up document → get `form_submission_id`
2. Look up `pbv_full_applications` by `form_submission_id` → get `id`, `phone`, `preferred_language`, `language_confirmed_at`, `head_of_household_name`
3. Validate phone (present + E.164 via `parsePhoneToE164`). If not → insert blocked row, return `blocked`
4. Validate `preferred_language IS NOT NULL AND language_confirmed_at IS NOT NULL`. If not → insert blocked row, return `blocked`
5. Look up rejection template via `renderTemplate(reasonCode, lang, vars)`
6. Insert `tenant_notifications` row with `delivery_status = 'pending'`
7. Call Twilio: `twilio.messages.create({ from: PBV_TWILIO_PHONE_NUMBER, to: phone, body: message, statusCallback: ... })`
8. On success → update to `delivery_status = 'queued'`, store `twilio_message_sid`
9. On Twilio failure → update to `delivery_status = 'failed'`, store `error`
10. Return result. All in try/catch — never throws.

### `app/api/hach/documents/[id]/reject/route.ts` changes:
- Import `sendRejectionNotification` from `@/lib/notifications`
- Remove lines 151–154 (console.log stub)
- After step 3 (insert `document_review_actions`), call `sendRejectionNotification({ documentId, reasonCode: reason_code, customNote: reason_text, reviewerId: user.userId })`
- Include `notification: result` in response data
- Change audit log: `notification_deferred: true` → `notification_status: result.status`
- Remove `notification_deferred: true` from return JSON

---

## Phase 3 — Twilio webhook

### `app/api/webhooks/twilio/route.ts`

- Parse form-encoded POST body
- Verify `X-Twilio-Signature` using `twilio.validateRequest(TWILIO_AUTH_TOKEN, url, params, sig)`
- Return 403 on signature mismatch
- Look up `tenant_notifications` by `twilio_message_sid = MessageSid`
- If not found → return 200 (Twilio retries non-200)
- Map Twilio `MessageStatus`:
  - `delivered` → `delivery_status = 'delivered'`, set `delivered_at = NOW()`
  - `failed` / `undelivered` → `delivery_status = 'failed'`, store `ErrorCode`+`ErrorMessage` in `delivery_error`
  - `queued` / `sent` → no downgrade if already `delivered`
- Return 200 always

Note: No middleware changes needed. `/api/webhooks/twilio` is not in the middleware matcher and is already public.

---

## Phase 4 — Intake form language requirement

### `lib/pbvFullAppTranslations.ts`

Add to `PbvFullAppStrings` interface and all three language objects:
- `phone_label: string` — "Phone Number" / "Número de Teléfono" / "Número de Telefone"
- `phone_helper: string` — "We'll use this number to send you important updates" / ...
- `phone_prefill_prompt: string` — "Is this your current number?" / ...
- `err_phone_required: string`
- `err_phone_invalid: string`
- `lang_confirm_label: string` — "We'll send you messages in **{lang}**. Is that correct?" / ...
- `lang_confirm_btn: string` — "Yes, that's correct" / "Sí, es correcto" / "Sim, está correto"
- `lang_change_label: string` — "Change language" / ...
- `err_lang_not_confirmed: string` — "Please confirm your preferred language before continuing"

### `app/api/t/[token]/pbv-full-app/route.ts` GET changes:

After the preapp language hint lookup, add:
```typescript
// Phone hint from tenant_lookup
let phone_hint: string | null = null;
const { data: tlRow } = await supabaseAdmin
  .from('tenant_lookup')
  .select('phone')
  .eq('building_address', app.building_address)
  .eq('unit_number', app.unit_number)
  .eq('is_current', true)
  .maybeSingle();
if (tlRow?.phone) phone_hint = parsePhoneToE164(tlRow.phone);
```

Return `phone_hint` in the response data.

Also: if `pbv_full_applications.preferred_language` is already set (tenant previously submitted), use that as the language hint instead of the preapp language.

### `app/pbv-full-app/[token]/page.tsx` changes:

**State additions:**
```typescript
const [phone, setPhone] = useState('');
const [phoneHint, setPhoneHint] = useState<string | null>(null);
const [langConfirmed, setLangConfirmed] = useState(false);
```

**On GET response:** set `phoneHint` from `data.phone_hint`. Pre-fill `phone` from phoneHint if present.

**Section 1 additions** (after HOH DOB field, before member cards):

1. Phone field using `FormPhoneInput` component. If `phoneHint`, show "Is this your current number?" prompt with edit capability. Required.

2. Language confirmation block: 
   - Show "We'll send you messages in **[language]**. Is that correct?"
   - "Yes, that's correct" button → sets `langConfirmed = true`
   - "Change language" link → drops back to language selector
   - If `langConfirmed`, show a green checkmark with the confirmed language
   - Form CANNOT advance past section 1 if `!langConfirmed` or phone is empty/invalid

**`validateSection(1)` changes:** add checks for phone (10 digits) and `langConfirmed`.

### `app/api/t/[token]/pbv-full-app/route.ts` POST changes:

Accept `phone` and `preferred_language` in body. In the `pbv_full_applications` update:
```typescript
phone: phone ?? null,
preferred_language: preferred_language ?? null,
language_confirmed_at: preferred_language ? new Date().toISOString() : null,
```

---

## Phase 5 — Matrix visibility

### `app/api/admin/pbv/pipeline/route.ts`

Add `phone`, `language_confirmed_at` to the select clause (already selects `preferred_language`).

### `app/admin/pbv/pipeline/page.tsx`

**`PipelineRow` type additions:**
```typescript
phone: string | null;
language_confirmed_at: string | null;
```

**Helper:**
```typescript
function needsContactInfo(row: PipelineRow): boolean {
  return !row.phone || !row.preferred_language || !row.language_confirmed_at;
}
```

**Badge** (in Tenant cell): if `needsContactInfo(row)`, render amber "Needs contact info" pill alongside the tenant name.

**Bulk bar**: 
- Compute `smsEligible` = selected rows where `!needsContactInfo(row)`
- Compute `smsBlocked` = selected rows where `needsContactInfo(row)`
- When `smsBlocked.size > 0`, show: "⚠ {N} of {selected.size} selected cannot receive SMS (missing contact info)"
  
Note: The pipeline page currently only has bulk assign — no SMS send action yet. The warning will be added as a pre-emptive UI element for when SMS send is wired in a future phase.

### `app/api/admin/pbv/appfolio-queue/route.ts` (new)

Simple GET: query `appfolio_update_queue` view, sort by `confirmed_at DESC`, return rows.

### `app/admin/pbv/appfolio-queue/page.tsx` (new)

Read-only table:
- Header note: "These tenants provided updated contact info via PBV. Push these values to AppFolio at end of project."
- Columns: Tenant | Building | Unit | Field | AppFolio Value | PBV Value | Confirmed At
- Sort by confirmed_at DESC
- Link from pipeline page header nav

---

## Phase 6 — Environment variables

`.env.local.example` additions:
```
# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=        # existing Stanton number (used for portal link SMS)
PBV_TWILIO_PHONE_NUMBER=    # NEW dedicated PBV number — required for rejection notifications

# App URL (used in Twilio webhook callback construction)
NEXT_PUBLIC_APP_URL=        # e.g. https://form-stanton.vercel.app
```

---

## Tests (`lib/__tests__/notifications.test.ts`)

Vitest suite — `lib/__tests__/notifications.test.ts` (matches include pattern `lib/**/__tests__/**/*.test.ts`).

Mock: Supabase client (`@/lib/supabase`), Twilio client, `renderTemplate`.

Test cases:
1. Successful send → returns `{ status: 'sent' }`, notification row updated to `queued`
2. Missing phone → returns `{ status: 'blocked', reason: 'missing_phone' }`, blocked row inserted
3. Invalid phone (non-E.164) → returns `{ status: 'blocked', reason: 'invalid_phone' }`, blocked row inserted
4. Missing language → returns `{ status: 'blocked', reason: 'missing_language' }`, blocked row inserted
5. Language present but `language_confirmed_at` null → same as missing language
6. Twilio API error → returns `{ status: 'failed' }`, `delivery_error` stored
7. Template not found (`renderTemplate` throws) → returns `{ status: 'failed', error: '...' }`
8. Webhook: valid signature + `delivered` status → notification updated to `delivered`
9. Webhook: invalid signature → 403
10. Webhook: `failed` Twilio status → `delivery_error` stored
11. Intake form POST with phone + language → all three columns written

---

## Execution order

1. Migration (run via MCP `apply_migration`)
2. `lib/notifications.ts`
3. `app/api/webhooks/twilio/route.ts`
4. Reject route update
5. `lib/pbvFullAppTranslations.ts` — add string keys
6. GET + POST route for intake (`app/api/t/[token]/pbv-full-app/route.ts`)
7. Intake form page (`app/pbv-full-app/[token]/page.tsx`)
8. Pipeline route + page updates
9. AppFolio queue API + page
10. `.env.local.example`
11. Tests

---

## Open questions (need your input)

None that would block starting. All deviations are documented above with a clear resolution path. The `tenant_profiles` issue (D2) is the most significant architectural divergence from the spec — using `tenant_lookup` is the correct substitute given the actual codebase, but confirm you agree before I build the view.
