# Post-Approval Execution — PRD

**Status:** Draft — ready for build (rewritten 2026-05-13 around the config-gap philosophy)
**Date:** 2026-05-13
**Depends on:** `stanton-workspace-document-lifecycle` (events feed)
**Coordinates with:** `in-app-signature-capture` (PRD V) — this PRD ships with placeholder "Sign in-app" buttons that PRD V activates when it lands
**Blocks:** none — this is the terminal stage of the application lifecycle initiative

---

## Problem Statement

The Stanton workflow does not end at "approved." A HACH approval is necessary but not sufficient — what actually puts a tenant in a unit and money flowing to Stanton is signed paperwork between three parties: tenant, Stanton (landlord), and HACH. Today, that paperwork lives in email threads, paper folders, and Outlook reminders. Risks: lost signed PDFs, stalled HAP execution because nobody knows who's the holdup, compliance gaps surfacing at audit time, and no terminal "we're done — tenant moved in, HAP in force" event in the system.

This PRD adds an in-system **signing packet** model that tracks every required signature, stores executed PDFs with provenance, and emits a `hap_executed` event as the terminal state of the application lifecycle. v1 is wet-sign + upload — every signature row supports uploading a signed PDF. In-app electronic signing is handled by a sibling PRD (V); this PRD ships with placeholder buttons that PRD V activates later.

**Design philosophy for this PRD:** ship the lifecycle/tracking layer with sensible defaults. Where Stanton-specific configuration is missing at launch (property metadata, signature template customizations), the UI shows the gap explicitly — yellow banners, "Configure →" links — rather than gating the build. 75% functional with visible failure points is the goal, not 0% waiting for perfect inputs.

---

## Goals

1. When HACH approves an application, a signing packet auto-generates from a configurable template. The default template covers the HUD standard set (lease, tenancy addendum, lead paint conditional, VAWA, HAP contract, move-in inspection).
2. Each required signature is independently tracked — party, status, executed PDF, attribution, audit trail.
3. Both HAP initiation directions are supported in the UI: Stanton-signs-first and HACH-sends-first.
4. The HAP contract execution is the terminal event — when both Stanton and HACH have signed, the application moves to stage `executed` and `application_events` emits `hap_executed`.
5. Property metadata is configurable per building (`year_built`, `required_addenda`). When missing, the system uses safe defaults and surfaces the gap in the UI.
6. The signing surface lives at `/admin/pbv/full-applications/[id]/signing` and reuses the workspace primitives.
7. The tenant magic-link gains a "Forms to sign" tab after HACH approval, where tenants upload their own signed PDFs.
8. Every signature row carries placeholder "Sign in-app" buttons (disabled in v1) that PRD V will activate.

---

## Users & Roles

| Role | View signing packet | Mark sent / received | Upload signed PDF | Mark HAP executed | Configure property / template |
|---|---|---|---|---|---|
| Stanton admin (any) | Yes | Yes | Yes | — | Yes |
| Stanton with `pbv-full-applications:execute_hap` permission (Tess, management) | Yes | Yes | Yes | Yes | Yes |
| HACH | Visibility into the HAP contract signing line only | — (HACH tracks own internal signing) | — | — | — |
| Tenant | Limited view via magic link — sees which docs they still need to sign | — (status updates flow from staff) | Yes (for tenant-signed copies only) | — | — |

---

## Core Features

### 1. Packet generation

When `hach_review_status` flips to `approved_by_hach`, a hook creates a `signing_packets` row and `packet_signatures` rows from the active template (default template key `default_pbv`). Generation reads:

- **Template** — from `signing_packet_templates` (seeded with HUD standard set, customizable later)
- **Property metadata** — from `properties.year_built` (drives lead-paint inclusion) and `properties.required_addenda` (per-building extras)

When property metadata is missing, the generator uses safe defaults:
- Lead paint disclosure: **required** (safer to over-include than miss it)
- Property-specific addenda: **none**

This is intentional — Stanton can configure properties later without breaking applications that have already generated packets.

### 2. Signing surface

A new page at `/admin/pbv/full-applications/[id]/signing` (linked from the main application page once HACH approves).

Top-to-bottom:
- **Header** — applicant, unit, HACH approval date, packet status, execution date if executed
- **Config-gap banners** — see §3 below
- **Signature checklist** — one row per `packet_signatures` row
- **HAP contract row** — distinguished, has its own confirmation modal for Mark Executed
- **Stored documents** — every uploaded signed PDF accessible by click; prior versions preserved
- **Notes** — free text per-signature notes
- **Workspace messages** — same shared / Stanton-private channels from the document review workspace, anchored to this application

Each signature row shows two side-by-side action buttons:
- **Upload signed PDF** — wet-sign tracking, works in v1
- **Sign in-app** — disabled, tooltip "Coming soon — in-app signing capability"

When PRD V ships, the "Sign in-app" button activates and writes to the same `signed_pdf_path`. No code change to this PRD's surface.

### 3. Config-gap UI

Wherever defaults are applied or configuration is missing, the surface shows a yellow banner with a concrete action.

**Property metadata missing** (no `properties` row for this `building_address`):
```
⚠ Property metadata not configured for [building_address].
   Defaults applied: lead paint required, no property-specific addenda.
   [Configure property →]
```
The "Configure property →" link points to `/admin/properties/[id]/edit` (a simple admin form — see §9).

**Template defaulted** (using `default_pbv`):
Footer text on the signing surface:
```
Using HUD standard signature set. [Customize template →]
```
Link to `/admin/signing-templates` (simple admin form, v2 if not in v1).

**Year-built unknown but lead paint required**:
Lead paint signature row gets an inline note: "Default — lead paint required when year built is unknown."

These banners are static — no nag-style modal, no email reminder. They surface gaps where a PM can see and act.

### 4. HAP contract — bidirectional initiation

The HAP signing row has two action sets visible from day one:

**Stanton-signs-first path:**
- "Send HAP to HACH" → marks the row `sent`, prompts upload of Stanton-signed PDF
- Then "Upload HACH counter-signed copy" when it comes back
- Then "Mark HAP Executed"

**HACH-sends-first path:**
- "Mark received from HACH" → prompts upload of HACH-signed PDF
- Then "Upload Stanton counter-signed copy" → marks the row `signed`
- Then "Mark HAP Executed"

Either path lands at the same terminal state. The UI shows both initiation buttons until one is clicked, then it follows that path. The choice is recorded in `packet_signatures.notes` as `hap_initiation_direction: stanton_first | hach_first`.

### 5. Execute HAP

Mark HAP Executed requires:
- User has `pbv-full-applications:execute_hap` permission
- Both a Stanton-signed and a HACH-signed PDF have been uploaded (or one combined PDF if signed together)
- Confirmation modal with the date of execution

On execute, atomically:
- `signing_packets.executed_at = NOW()`, `executed_by = user`
- HAP signature row `status = 'executed'`
- `pbv_full_applications.stage = 'executed'`
- `application_events`: `hap_executed`, with HAP file reference and direction
- Shared workspace message: "Stanton recorded HAP contract execution on [date]. Application is now in force."

After `hap_executed`, the signing surface goes read-only.

### 6. Tenant view

The tenant's magic link gains a "Forms to sign" tab visible only after HACH approval. It shows:

- Each tenant-required signature with status
- Plain-language description per signature (from `signing_packet_templates.signatures[].plain_language_description`, or a sensible default)
- Two affordances per row:
  - **Upload signed copy** — file picker / camera (mobile-friendly)
  - **Sign in-app** — disabled, tooltip "Coming soon"
- A "What's this?" expansion per row with plain-language context

Tenant uploads write events with `actor_role = 'tenant'` and attribute correctly on the staff side.

### 7. Property and template configuration

**Properties admin** — a small page at `/admin/properties` listing all buildings with config status (configured vs. defaulted), and an edit form at `/admin/properties/[id]/edit`:
- `building_address` (display, not editable after first save)
- `year_built` (integer, nullable)
- `required_addenda` — list editor for adding/removing addenda entries: each entry has `slug`, `label`, `signing_party`, `required` boolean

**Template admin** — `/admin/signing-templates` (v2 if not in v1 — defer if scope tight): list templates, edit signature list per template.

If template admin doesn't ship in v1, customization is via DB script. The signing surface still reads from the table; it just doesn't have a UI to edit it.

### 8. Events emitted

- `signing_packet_created` — on HACH approval / explicit generation. Metadata: `template_key`, `signature_count`.
- `signature_marked_sent` — staff marked a signature as sent to a party.
- `signature_received` — signed PDF uploaded (by anyone). Metadata: `uploader_role`, `signature_method` (`'wet_upload'` in v1; PRD V adds `'in_app'`).
- `signature_waived` — with reason in metadata.
- `hap_received_from_hach` — when HACH-sends-first path is initiated.
- `hap_executed` — terminal event. Metadata: `direction` (`stanton_first` | `hach_first`).
- `property_configured` — when the properties admin saves changes.

---

## Data Model

### Migration: `20260513XXXXXX_post_approval_execution.sql`

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. signing_packet_templates — configurable checklist templates
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.signing_packet_templates (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key  TEXT        NOT NULL UNIQUE,
  display_label TEXT        NOT NULL,
  signatures    JSONB       NOT NULL,  -- [{ slug, label, party, required, conditional_on?, plain_language_description? }]
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed: HUD standard set as `default_pbv`
INSERT INTO public.signing_packet_templates (template_key, display_label, signatures)
VALUES (
  'default_pbv',
  'PBV — HUD Standard Set',
  '[
    {"slug":"lease","label":"Residential Lease","party":"tenant_and_stanton","required":true,"plain_language_description":"The agreement between you and Stanton for renting this unit."},
    {"slug":"tenancy_addendum","label":"HUD Tenancy Addendum (52641-A)","party":"tenant_and_stanton","required":true,"plain_language_description":"A federal addendum that protects your rights as a tenant under the housing voucher program."},
    {"slug":"lead_paint","label":"Lead-Based Paint Disclosure","party":"tenant","required":true,"conditional_on":{"property_field":"year_built","operator":"<","value":1978,"default_when_null":"required"},"plain_language_description":"Required when the building was built before 1978. Discloses any known lead-based paint in the unit."},
    {"slug":"vawa","label":"VAWA Notice (HUD 5380)","party":"tenant","required":true,"plain_language_description":"A federal notice about your rights if you have experienced domestic violence."},
    {"slug":"hap_contract","label":"HAP Contract (HUD 52530)","party":"stanton_and_hach","required":true,"plain_language_description":"The contract between Stanton and the housing authority that triggers rent payments."},
    {"slug":"move_in_inspection","label":"Move-In Inspection (HUD 52580)","party":"tenant_and_stanton","required":true,"plain_language_description":"Documents the condition of the unit on the day you move in."}
  ]'::jsonb
)
ON CONFLICT (template_key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. properties — building metadata
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.properties (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  building_address    TEXT        NOT NULL UNIQUE,
  year_built          INTEGER,
  required_addenda    JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- Each entry: { slug, label, signing_party, required, plain_language_description? }
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- NO SEED. Empty at launch. UI surfaces gaps as banners.

CREATE INDEX IF NOT EXISTS idx_properties_address ON public.properties (building_address);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. signing_packets — one per application after HACH approval
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.signing_packets (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID        NOT NULL UNIQUE
                              REFERENCES public.pbv_full_applications(id) ON DELETE CASCADE,
  template_key    TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID        REFERENCES public.admin_users(id) ON DELETE SET NULL,
  executed_at     TIMESTAMPTZ,
  executed_by     UUID        REFERENCES public.admin_users(id) ON DELETE SET NULL,
  notes           TEXT
);

CREATE INDEX idx_signing_packets_app      ON public.signing_packets (application_id);
CREATE INDEX idx_signing_packets_executed ON public.signing_packets (executed_at DESC NULLS LAST);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. packet_signatures — one row per required signature
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.packet_signatures (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id                   UUID        NOT NULL REFERENCES public.signing_packets(id) ON DELETE CASCADE,
  document_slug               TEXT        NOT NULL,
  document_label              TEXT        NOT NULL,
  signing_party               TEXT        NOT NULL CHECK (signing_party IN ('tenant', 'stanton', 'hach', 'tenant_and_stanton', 'stanton_and_hach')),
  is_required                 BOOLEAN     NOT NULL DEFAULT TRUE,
  is_template_default         BOOLEAN     NOT NULL DEFAULT TRUE,
  status                      TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'sent', 'signed', 'waived', 'executed')),
  sent_at                     TIMESTAMPTZ,
  sent_by                     UUID        REFERENCES public.admin_users(id) ON DELETE SET NULL,
  signed_at                   TIMESTAMPTZ,
  signed_pdf_path             TEXT,
  signed_pdf_uploaded_by      UUID        REFERENCES public.admin_users(id) ON DELETE SET NULL,
  signed_pdf_uploaded_by_role TEXT        CHECK (signed_pdf_uploaded_by_role IS NULL
                                             OR signed_pdf_uploaded_by_role IN ('tenant', 'stanton', 'hach')),
  signature_method            TEXT        CHECK (signature_method IS NULL
                                             OR signature_method IN ('wet_upload', 'in_app')),
  waived_reason               TEXT,
  notes                       TEXT,  -- includes hap_initiation_direction when applicable
  plain_language_description  TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_packet_signatures_packet ON public.packet_signatures (packet_id);
CREATE INDEX idx_packet_signatures_status ON public.packet_signatures (status);
CREATE INDEX idx_packet_signatures_party  ON public.packet_signatures (signing_party);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. pipeline stage enum: add 'executed'
-- ─────────────────────────────────────────────────────────────────────────────
-- pbv_full_applications.stage is the column; locate the CHECK constraint (if any)
-- and add 'executed' to the allowed values. Implementation may need DROP/RECREATE
-- of the constraint. Build report documents the exact change.

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. permission seed
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.permissions (resource, action)
VALUES ('pbv-full-applications', 'execute_hap')
ON CONFLICT DO NOTHING;
```

`packet_signatures` table is intentionally **forward-compatible with PRD V**:
- `signed_pdf_path` works for wet uploads now and in-app signatures later (same field)
- `signature_method` enum already includes both `'wet_upload'` and `'in_app'`
- `signed_pdf_uploaded_by_role` covers attribution in both cases

---

## API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/admin/pbv/full-applications/[id]/signing` | GET | `isAuthenticated` | Returns packet + signatures + config-gap state (banner data). Auto-creates packet if HACH approved and none exists. |
| `/api/admin/pbv/full-applications/[id]/signing/[signatureId]/sent` | POST | `isAuthenticated` | Marks sent. Body: optional `note`, optional `hap_initiation_direction` for the HAP row. |
| `/api/admin/pbv/full-applications/[id]/signing/[signatureId]/received-from-hach` | POST | `isAuthenticated` | HACH-sends-first path entry. Records direction, transitions HAP row. |
| `/api/admin/pbv/full-applications/[id]/signing/[signatureId]/upload` | POST | `isAuthenticated` | Multipart. Stores signed PDF; preserves prior versions. Sets `signature_method='wet_upload'`. |
| `/api/admin/pbv/full-applications/[id]/signing/[signatureId]/waive` | POST | `isAuthenticated` | Body: `{ reason }`. Waives row. |
| `/api/admin/pbv/full-applications/[id]/signing/execute-hap` | POST | `isAuthenticated` + `execute_hap` permission | Marks HAP executed. Confirmation flow. Atomically flips application stage. |
| `/api/tenant/pbv/[token]/signing` | GET | tenant token | Returns tenant-visible signing state. |
| `/api/tenant/pbv/[token]/signing/[signatureId]/upload` | POST | tenant token | Tenant uploads own signed copy. |
| `/api/admin/properties` | GET, POST | `isAuthenticated` | List properties; create. |
| `/api/admin/properties/[id]` | GET, PATCH | `isAuthenticated` | View / edit property metadata. |

The HACH approval flow (`app/api/hach/applications/[id]/route.ts` — the approve path) gains a hook call to pre-create the packet immediately, avoiding lazy-create races.

---

## Integration Points

| System | Direction | Purpose |
|---|---|---|
| `pbv_full_applications` | Read/Write | Application metadata, stage transition to `executed` |
| `signing_packet_templates` | Read | Template lookup on packet generation |
| `properties` | Read | Building metadata; missing rows trigger config-gap banner |
| `signing_packets` / `packet_signatures` | Read/Write | Core state |
| `application_events` | Write | Event timeline |
| `shared_workspace_messages` | Write | System messages on HAP execution |
| `lib/hach/payload-filter` | — | HAP signing line is HACH-visible; other signature rows are NOT |
| `lib/auth` | Read | Permission `pbv-full-applications:execute_hap` |
| Supabase storage (`signing-packets` bucket) | Read/Write | Signed PDF storage; path: `{application_id}/{signature_id}/{revision}_{filename}` |
| **PRD V — In-App Signature Capture** | Coordinates | PRD V activates the "Sign in-app" buttons in this PRD's UI without a code change here |

---

## Files Touched (Inferred — Cascade Confirms)

**NEW:**
- `supabase/migrations/20260513XXXXXX_post_approval_execution.sql`
- `app/admin/pbv/full-applications/[id]/signing/page.tsx`
- `app/admin/properties/page.tsx` (list view)
- `app/admin/properties/[id]/edit/page.tsx`
- `components/signing/SigningChecklist.tsx`
- `components/signing/SignatureRow.tsx` — includes the two side-by-side action buttons (Upload signed PDF + disabled "Sign in-app")
- `components/signing/UploadSignedDialog.tsx`
- `components/signing/WaiveSignatureDialog.tsx`
- `components/signing/ExecuteHapDialog.tsx`
- `components/signing/HapDirectionPicker.tsx`
- `components/signing/ConfigGapBanner.tsx`
- `components/admin/properties/PropertyForm.tsx`
- `app/api/admin/pbv/full-applications/[id]/signing/route.ts`
- `app/api/admin/pbv/full-applications/[id]/signing/[signatureId]/sent/route.ts`
- `app/api/admin/pbv/full-applications/[id]/signing/[signatureId]/received-from-hach/route.ts`
- `app/api/admin/pbv/full-applications/[id]/signing/[signatureId]/upload/route.ts`
- `app/api/admin/pbv/full-applications/[id]/signing/[signatureId]/waive/route.ts`
- `app/api/admin/pbv/full-applications/[id]/signing/execute-hap/route.ts`
- `app/api/tenant/pbv/[token]/signing/route.ts`
- `app/api/tenant/pbv/[token]/signing/[signatureId]/upload/route.ts`
- `app/api/admin/properties/route.ts`
- `app/api/admin/properties/[id]/route.ts`
- `lib/signing/packet-template.ts` — template lookup + signature row generator
- `lib/signing/storage.ts` — signed PDF storage helpers
- `__tests__/signing-packet.test.ts`

**MODIFIED:**
- `app/admin/pbv/full-applications/[id]/page.tsx` — link to signing surface once HACH approves
- `app/api/hach/applications/[id]/route.ts` — packet auto-create hook on approve
- `app/pbv-full-app/[token]/...` — adds "Forms to sign" tab
- `lib/events/application-events.ts` — adds new event types
- `lib/hach/payload-filter.ts` — allows HAP signing line through; blocks others
- The workforce dashboards rollup (PRD III) gains a new panel: "HAP execution backlog" — applications HACH-approved more than X days ago but not yet executed.

---

## Implementation Phases

### Phase 1 — Staff signing surface

- Migration (all four tables + templates seed + permission seed).
- Packet auto-generation on HACH approval (hook + lazy GET path).
- Signing surface (staff side) with config-gap banners.
- Per-signature: mark sent, mark received-from-HACH, upload PDF, waive.
- Both HAP initiation paths.
- Mark HAP executed flow + terminal `hap_executed` event.
- Workspace integration (system messages).
- Properties admin (list + edit).
- "Sign in-app" placeholder buttons present, disabled, with tooltip.

### Phase 2 — Tenant magic-link signing

- Tenant "Forms to sign" tab on magic link.
- Plain-language descriptions for each tenant-required signature.
- Tenant upload of signed PDFs.
- Tenant-side "Sign in-app" placeholder buttons.

---

## Configuration State at Launch

This section replaces the "Open Questions" section that gated the prior version of this PRD. It documents what is empty / defaulted / configurable at launch.

| Item | At launch | Default behavior | How to configure |
|---|---|---|---|
| Signature template | One template: `default_pbv` (HUD standard set) | Used for all PBV applications | Add rows to `signing_packet_templates` via DB script in v1; admin UI in v2 |
| Property metadata (`properties`) | **Empty** — no rows seeded | Lead paint required (safer default); no property-specific addenda | `/admin/properties/[id]/edit` form |
| HAP initiation direction | No default — UI offers both | Stanton picks per-application | Per-app choice; recorded in `packet_signatures.notes` |
| In-app signing | Placeholder buttons only, disabled | "Upload signed PDF" path works; in-app sign tooltip "Coming soon" | Awaits PRD V |
| Property-specific addenda | **Empty** for all properties | None included beyond template defaults | `properties.required_addenda` JSONB via the property admin form |
| Move-in inspection | Included in default template | Tracked as a regular signature row | Edit template if not applicable |
| Denied application handling | No packet created | Packet only auto-generates on `approved_by_hach` | Per design — denials close the application |

Future "figure out later" items from prior PRD discussions:
- Canonical signature list confirmation with Stanton operations — default template is the HUD standard set; revisit
- Adding non-HUD Stanton-specific forms — via template editing
- Property-specific lease addenda (pet, parking, smoke-free) — via `required_addenda` per building

---

## Out of Scope

- In-app electronic signature capture — handled by PRD V (`in-app-signature-capture`).
- Lease document auto-generation. Stanton uploads externally-prepared lease PDFs.
- Recertification, lease renewal, move-out.
- Automatic reminders / nudges to tenants who haven't returned signed copies — Phase 2 of notifications.
- Property-addenda admin UI beyond a simple form — bulk edit, copy-from-another-property, etc.
- Multiple-template support beyond the seeded `default_pbv` — only one active template per program in v1.
- HACH-side packet visibility beyond the HAP contract row.

---

## Risks and Edge Cases

| Risk | Mitigation |
|---|---|
| HACH-approval hook fails to create the packet | Lazy GET path creates it on first access. Idempotent via `ON CONFLICT (application_id) DO NOTHING`. |
| Property metadata is wrong and lead paint gets included for a 2010 building | Acceptable false-positive. Staff can waive the signature row with reason. Or update property metadata, regenerate signature rows for the un-acted-on portion. |
| Building doesn't have a `properties` row at all | Banner explicitly tells the PM. Defaults apply. Workflow continues. |
| Tenant uploads to the wrong signature row | Tenant-portal upload affordance only appears on tenant-required rows. UI groups by document. |
| HAP initiation direction is wrong (e.g., PM clicked Send when HACH had already sent) | Direction recorded in notes; correctable by waiving the row and re-creating, or via direct admin action. Edge case. |
| Required addenda for a property change after packets are generated | Template/property is snapshot at packet creation. Existing packets keep their original rows. Staff can manually add ad-hoc signature rows on the signing surface. |
| HACH executes the HAP independently and tells Stanton via email | "Mark received from HACH" path covers this. PM uploads the HACH-signed copy, then countersigns, then marks executed. |
| Year-built data is missing for a property | Default applies (lead paint required). Safer to over-include. Banner visible. |
| User without `execute_hap` tries to mark executed | API returns 403; button not rendered. |
| In-app signing PRD V ships before this PRD's tests pass | Each tracks independently. PRD V can't ship before PRD IV — V depends on this PRD's `packet_signatures` table. |

---

## Acceptance Criteria

**Phase 1:**
- [ ] Migration applies cleanly; four tables exist; template seeded with HUD standard set; permission seeded.
- [ ] Schema verification documented in build report via MCP (`mcp__supabase__list_tables`, column-level `mcp__supabase__execute_sql` confirmations).
- [ ] HACH approve flow triggers packet creation; GET endpoint also creates on first access (idempotent).
- [ ] Signing surface renders with correct rows for a seeded application.
- [ ] **Config-gap banners** render correctly: when `properties` row missing for an application's building, the yellow banner appears with the "Configure property →" link, and the link works.
- [ ] Both HAP initiation paths render side-by-side until one is clicked.
- [ ] Upload Signed PDF stores the file with revision preservation.
- [ ] Mark HAP Executed requires `execute_hap` permission and a HAP-row signed PDF; on success flips stage to `executed`, posts shared workspace message.
- [ ] After `hap_executed`, every signature mutation returns 423.
- [ ] "Sign in-app" placeholder buttons render across all signature rows, disabled, with the right tooltip.
- [ ] Properties admin: list page + edit form work; saving updates `properties` and reflects in banner state on next signing surface load.
- [ ] HACH allowlist test passes: HAP signing line visible; other signature rows NOT visible.
- [ ] No existing surfaces regress.

**Phase 2:**
- [ ] Tenant magic-link "Forms to sign" tab appears only after HACH approval.
- [ ] Tenant can upload signed PDFs for tenant-required rows; cannot upload to other rows.
- [ ] Tenant upload writes events with `actor_role='tenant'`.
- [ ] Tenant view shows "Sign in-app" placeholder, disabled.
- [ ] Staff side sees tenant-uploaded PDFs with "Uploaded by tenant" attribution.

**End-to-end walkthrough (manual):**
- HACH approves an application for a building with NO properties row.
- Signing surface loads; config-gap banner is visible; defaults applied (lead paint included).
- PM clicks "Configure property →"; enters year_built = 1990 and one custom addendum.
- Returns to signing surface; banner now shows the property is configured; lead paint row still present (template-default; staff can waive if desired); new addendum row appears.
- Staff sends lease to tenant; tenant uploads signed copy via magic link.
- Staff uploads Stanton-countersigned lease; row goes to `signed`.
- Staff chooses HACH-sends-first path for HAP; uploads HACH-signed copy; uploads Stanton-countersigned; marks executed.
- Application stage flips to `executed`. Workspace shared channel reflects the journey. Dashboard's HAP-execution-backlog panel removes this application.
