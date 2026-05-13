# Review Workspace Schema — PRD

**Status:** Draft — ready for build
**Depends on:** `hach-payload-leak-plug` (lands first)
**Blocks:** `unified-review-surface` (UI depends on these tables and APIs)

---

## Problem Statement

The current PBV review process is a multi-party deal room masquerading as separate systems. Stanton staff review documents on the internal admin page. HACH reviewers review the same packets on a separate portal. Communication between the two parties happens by **email** — HACH sends "I have a few notes," Stanton hopes someone reads them, and the only record of what was actually said sits in a Gmail thread someone forgot to forward.

From the project's own postmortem (`memory.md`): *"lost documents, no proof of what was sent to HACH, tenant ghosting, stale income documents, coordination gaps across three parties on different clocks."*

The fix is to model what's actually happening: a shared workspace per application, with three logically and physically separated channels:

1. **Stanton-private channel** — Tess, Christine, Dan, Alex deliberate internally. HACH cannot read this.
2. **HACH-private channel** — HACH reviewers deliberate among themselves. Stanton cannot read this.
3. **Shared correspondence channel** — both parties post here. Both see everything. Append-only after a 5-minute edit grace period. This replaces the emails.

Same pattern reused for refinancing workflows later (lender, borrower, escrow, title — different cast, same shape). Schema is generic at the workspace/party/message layer.

---

## Goals

1. Model a workspace, its parties, and three channels of messages per application.
2. Physically segregate the three message streams across three tables, not flag-discriminated within one.
3. Enforce the wall at the API layer: HACH-session endpoints can only reach `hach_workspace_messages` and `shared_workspace_messages`; Stanton-session endpoints can only reach `stanton_workspace_messages` and `shared_workspace_messages`.
4. Make the schema generic enough that adding a `refi` workspace with `lender`/`borrower`/`title` parties later is data, not a migration.
5. Support per-document message anchoring (a message attached to a specific document) and application-level messages (general conversation about the packet).
6. **No UI in this PRD.** Schema, RLS, APIs, tests.

---

## Users & Roles

| Role | Stanton-private | HACH-private | Shared |
|---|---|---|---|
| Stanton staff (admin user) | R/W | — | R/W |
| HACH reviewer / admin | — | R/W | R/W |
| Tenant | — | — | — |

The tenant never sees any of these channels. Tenant-facing communication remains the existing rejection-reason flow.

---

## Core Model

### Workspace

One workspace per application. The workspace anchors all conversation related to that application. Generic enough that a future refi application also gets a workspace, with different parties.

### Party

A party is a participant role in a workspace. For PBV applications, parties are `stanton` and `hach`. For a future refi, parties would be `lender`, `borrower`, `title`, etc. Each user belongs to one party in a given workspace.

A party belongs to one organization (Stanton, HACH, etc.) — modeled as `party_org TEXT`. The wall isn't between *parties* (there could be multiple parties on one side); it's between *party orgs*. For PBV, `stanton` is the only Stanton party, `hach` is the only HACH party, but the model supports more granular splits.

### Channel

A channel is a scope within a workspace. Three channels per PBV workspace, modeled as **three separate tables** rather than as a `channel_type` column on one table. The physical separation is the wall.

- `stanton_workspace_messages` — only Stanton-org parties can read/write
- `hach_workspace_messages` — only HACH-org parties can read/write
- `shared_workspace_messages` — both can read/write

### Message

A message has:
- Author (user + denormalized display name + party-org snapshot for audit integrity)
- Body (text)
- Optional document anchor (`document_id` — null means application-level message)
- Timestamps (`created_at`, `edited_at`)
- Edit window enforcement (5 minutes after creation, only the author can edit; after that, immutable)

Messages are append-only. There is no DELETE endpoint. Edits within the grace window stamp `edited_at`. Editing after the grace window is rejected at the API layer.

---

## Data Model

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- review_workspaces
-- One row per application that has been routed for multi-party review.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.review_workspaces (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_type  TEXT        NOT NULL CHECK (workspace_type IN ('pbv', 'refi')),
  -- Polymorphic anchor — for PBV this points to pbv_full_applications.id.
  -- For refi (future), points to refi_applications.id.
  anchor_id       UUID        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID        REFERENCES public.admin_users(id) ON DELETE SET NULL,
  UNIQUE (workspace_type, anchor_id)
);

CREATE INDEX idx_review_workspaces_anchor
  ON public.review_workspaces (workspace_type, anchor_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- workspace_parties
-- The participants in a workspace. For PBV: 'stanton' and 'hach'.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.workspace_parties (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID        NOT NULL REFERENCES public.review_workspaces(id) ON DELETE CASCADE,
  party_role    TEXT        NOT NULL,    -- 'stanton' | 'hach' | 'lender' | 'borrower' | 'title' | 'escrow'
  party_org     TEXT        NOT NULL,    -- 'stanton' | 'hach' | 'lender' | 'borrower' | 'title'
  display_label TEXT        NOT NULL,    -- 'Stanton Management' | 'Hartford Housing Authority'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, party_role)
);

CREATE INDEX idx_workspace_parties_workspace
  ON public.workspace_parties (workspace_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- stanton_workspace_messages
-- Stanton internal deliberation. HACH never reads or writes here.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.stanton_workspace_messages (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID        NOT NULL REFERENCES public.review_workspaces(id) ON DELETE CASCADE,
  document_id         UUID        REFERENCES public.form_submission_documents(id) ON DELETE CASCADE,
  author_user_id      UUID        REFERENCES public.admin_users(id) ON DELETE SET NULL,
  author_display_name TEXT        NOT NULL,
  author_party_org    TEXT        NOT NULL CHECK (author_party_org = 'stanton'),
  body                TEXT        NOT NULL CHECK (length(trim(body)) > 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at           TIMESTAMPTZ
);

CREATE INDEX idx_stanton_msg_workspace
  ON public.stanton_workspace_messages (workspace_id, created_at DESC);

CREATE INDEX idx_stanton_msg_document
  ON public.stanton_workspace_messages (document_id, created_at DESC)
  WHERE document_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- hach_workspace_messages
-- HACH internal deliberation. Stanton never reads or writes here.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.hach_workspace_messages (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID        NOT NULL REFERENCES public.review_workspaces(id) ON DELETE CASCADE,
  document_id         UUID        REFERENCES public.form_submission_documents(id) ON DELETE CASCADE,
  author_user_id      UUID        REFERENCES public.admin_users(id) ON DELETE SET NULL,
  author_display_name TEXT        NOT NULL,
  author_party_org    TEXT        NOT NULL CHECK (author_party_org = 'hach'),
  body                TEXT        NOT NULL CHECK (length(trim(body)) > 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at           TIMESTAMPTZ
);

CREATE INDEX idx_hach_msg_workspace
  ON public.hach_workspace_messages (workspace_id, created_at DESC);

CREATE INDEX idx_hach_msg_document
  ON public.hach_workspace_messages (document_id, created_at DESC)
  WHERE document_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- shared_workspace_messages
-- Cross-party correspondence. Both Stanton and HACH read/write.
-- The institutional record between the organizations. Append-only after grace.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.shared_workspace_messages (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID        NOT NULL REFERENCES public.review_workspaces(id) ON DELETE CASCADE,
  document_id         UUID        REFERENCES public.form_submission_documents(id) ON DELETE CASCADE,
  author_user_id      UUID        REFERENCES public.admin_users(id) ON DELETE SET NULL,
  author_display_name TEXT        NOT NULL,
  author_party_org    TEXT        NOT NULL CHECK (author_party_org IN ('stanton', 'hach')),
  body                TEXT        NOT NULL CHECK (length(trim(body)) > 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at           TIMESTAMPTZ
);

CREATE INDEX idx_shared_msg_workspace
  ON public.shared_workspace_messages (workspace_id, created_at DESC);

CREATE INDEX idx_shared_msg_document
  ON public.shared_workspace_messages (document_id, created_at DESC)
  WHERE document_id IS NOT NULL;

CREATE INDEX idx_shared_msg_party
  ON public.shared_workspace_messages (workspace_id, author_party_org, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- workspace_read_receipts
-- Tracks last-read timestamp per (user, channel) for unread counts.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.workspace_read_receipts (
  user_id        UUID        NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  workspace_id   UUID        NOT NULL REFERENCES public.review_workspaces(id) ON DELETE CASCADE,
  channel        TEXT        NOT NULL CHECK (channel IN ('stanton', 'hach', 'shared')),
  last_read_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, workspace_id, channel)
);
```

All four message tables and `workspace_read_receipts` have RLS enabled. Only `service_role` is granted access; application enforcement happens in the API layer via session checks (the same pattern used by existing tables).

---

## API Routes

The route layout itself enforces the wall. Stanton routes live under `/api/admin/workspaces/...` and call only the Stanton-accessible tables. HACH routes live under `/api/hach/workspaces/...` and call only the HACH-accessible tables. Neither code path imports a helper that touches the wrong table.

### Stanton routes (auth: `isAuthenticated`)

| Route | Method | Purpose |
|---|---|---|
| `/api/admin/workspaces/[workspaceId]` | GET | Returns workspace metadata, parties, and unread counts for `stanton` and `shared` channels for the current user. |
| `/api/admin/workspaces/[workspaceId]/channel/stanton/messages` | GET | List Stanton-private messages. Optional `document_id` query param to filter to a doc. |
| `/api/admin/workspaces/[workspaceId]/channel/stanton/messages` | POST | Body: `{ body: string, document_id?: uuid }`. Inserts into `stanton_workspace_messages`. |
| `/api/admin/workspaces/[workspaceId]/channel/stanton/messages/[messageId]` | PATCH | Edit a message — only if author and within 5 min. |
| `/api/admin/workspaces/[workspaceId]/channel/shared/messages` | GET | List shared messages. Optional `document_id` filter. |
| `/api/admin/workspaces/[workspaceId]/channel/shared/messages` | POST | Insert into `shared_workspace_messages` with `author_party_org = 'stanton'`. |
| `/api/admin/workspaces/[workspaceId]/channel/shared/messages/[messageId]` | PATCH | Edit — author + 5-min window. |
| `/api/admin/workspaces/[workspaceId]/channel/[channel]/read` | POST | Mark channel read at NOW for current user. `channel` ∈ `{stanton, shared}`. |

### HACH routes (auth: `requireHachUser`)

| Route | Method | Purpose |
|---|---|---|
| `/api/hach/workspaces/[workspaceId]` | GET | Workspace metadata + parties + unread counts for `hach` and `shared`. Uses `safeHachJson` (from leak-plug PRD). |
| `/api/hach/workspaces/[workspaceId]/channel/hach/messages` | GET | List HACH-private messages. |
| `/api/hach/workspaces/[workspaceId]/channel/hach/messages` | POST | Insert into `hach_workspace_messages`. |
| `/api/hach/workspaces/[workspaceId]/channel/hach/messages/[messageId]` | PATCH | Edit. |
| `/api/hach/workspaces/[workspaceId]/channel/shared/messages` | GET | List shared messages. |
| `/api/hach/workspaces/[workspaceId]/channel/shared/messages` | POST | Insert into `shared_workspace_messages` with `author_party_org = 'hach'`. |
| `/api/hach/workspaces/[workspaceId]/channel/shared/messages/[messageId]` | PATCH | Edit. |
| `/api/hach/workspaces/[workspaceId]/channel/[channel]/read` | POST | Mark read. `channel` ∈ `{hach, shared}`. |

### Scope enforcement

Every route validates that the workspace's `anchor_id` resolves to an application the session role is allowed to see:
- Stanton: any application the user has permission to view (existing RBAC).
- HACH: only applications with non-null `hach_review_status`.

Wrong-side access attempts return 403, not 404 — Stanton trying to GET `/api/hach/workspaces/...` returns 403 because of `requireHachUser`; HACH trying to GET `/api/admin/workspaces/...` returns 403 from `isAuthenticated`+role check.

### Edit window

`PATCH /messages/[messageId]`:
- If `created_at + 5 minutes < NOW()`, return 409 "Edit window expired."
- If `author_user_id != session user`, return 403.
- On success: update `body`, set `edited_at = NOW()`. Do not change `created_at` or author fields.

### Workspace creation

Workspaces are created on demand. When a Stanton or HACH endpoint receives a request for `workspace?anchor=<app_id>` and no workspace exists yet, create one with the two default parties (`stanton`, `hach`) and return it. This avoids needing to backfill workspaces for existing applications via a migration script — they appear when first accessed.

For PBV: party seed values:
- `stanton`: `party_org='stanton'`, `display_label='Stanton Management'`
- `hach`: `party_org='hach'`, `display_label='Hartford Housing Authority'`

---

## Unread Counts

Both `GET /workspaces/[id]` endpoints return:

```json
{
  "workspace": { ... },
  "parties": [ ... ],
  "unread_counts": {
    "stanton": 3,  // null if user has no access
    "shared":  1
  }
}
```

Computed as: count of messages in that channel where `created_at > workspace_read_receipts.last_read_at` for `(user, workspace, channel)`. If no receipt row exists, count all messages. Messages authored by the current user are excluded from their own unread count.

---

## Verification (must be automated + auditable)

### Test Suite — `__tests__/workspace-wall.test.ts`

This is the load-bearing test. It must cover:

1. **Stanton cannot read HACH-private** — seed a workspace, post a `hach_workspace_messages` row, switch to Stanton session, try every Stanton route, assert no route returns or references the HACH message.
2. **HACH cannot read Stanton-private** — symmetric.
3. **Stanton cannot POST to `hach_workspace_messages`** — there is no Stanton route for this, but verify the database constraint `author_party_org = 'hach'` would reject the insert even if it tried.
4. **HACH cannot POST to `stanton_workspace_messages`** — symmetric.
5. **Both can read shared** — Stanton and HACH both retrieve the same shared messages.
6. **Shared messages tag authorship correctly** — a Stanton-authored shared message has `author_party_org = 'stanton'`; HACH-authored has `'hach'`.
7. **Edit window enforced** — post a message, edit within 1 minute (success), edit at 6 minutes (409).
8. **Author check on edit** — user A posts, user B tries to edit, returns 403.
9. **Cross-anchor isolation** — workspace A and workspace B; messages in A's `hach_workspace_messages` never appear in B's response.
10. **HACH payload allowlist (from leak-plug PRD)** — HACH workspace responses don't contain Stanton-internal banned keys.

### Manual verification

1. Apply the migration locally. Verify with `\d` queries that all four tables exist with correct constraints.
2. Hit each new endpoint with curl or REST Client, observing wall behavior.

---

## Files Touched (Inferred — Cascade Confirms)

- `supabase/migrations/20260512XXXXXX_review_workspace_schema.sql` — NEW
- `lib/workspaces/types.ts` — NEW (shared TypeScript types)
- `lib/workspaces/scope.ts` — NEW (workspace resolution + access check helpers; two functions: `resolveStantonWorkspace`, `resolveHachWorkspace`)
- `lib/workspaces/edit-window.ts` — NEW (helper for the 5-minute rule)
- `app/api/admin/workspaces/[workspaceId]/route.ts` — NEW
- `app/api/admin/workspaces/[workspaceId]/channel/stanton/messages/route.ts` — NEW
- `app/api/admin/workspaces/[workspaceId]/channel/stanton/messages/[messageId]/route.ts` — NEW
- `app/api/admin/workspaces/[workspaceId]/channel/shared/messages/route.ts` — NEW
- `app/api/admin/workspaces/[workspaceId]/channel/shared/messages/[messageId]/route.ts` — NEW
- `app/api/admin/workspaces/[workspaceId]/channel/[channel]/read/route.ts` — NEW
- `app/api/hach/workspaces/[workspaceId]/route.ts` — NEW
- `app/api/hach/workspaces/[workspaceId]/channel/hach/messages/route.ts` — NEW
- `app/api/hach/workspaces/[workspaceId]/channel/hach/messages/[messageId]/route.ts` — NEW
- `app/api/hach/workspaces/[workspaceId]/channel/shared/messages/route.ts` — NEW
- `app/api/hach/workspaces/[workspaceId]/channel/shared/messages/[messageId]/route.ts` — NEW
- `app/api/hach/workspaces/[workspaceId]/channel/[channel]/read/route.ts` — NEW
- `__tests__/workspace-wall.test.ts` — NEW

The Stanton and HACH route files are intentionally separate (no shared resolver, no shared handler). They may import the same TypeScript types, but the queries are typed to their own tables.

---

## Integration Points

| System | Direction | Purpose |
|---|---|---|
| `pbv_full_applications` | Read | Anchor lookup for PBV workspaces |
| `form_submission_documents` | Read | Document anchor validation on message POST |
| `admin_users` | Read | Author identity, display name, user_type for party_org derivation |
| `lib/auth` | Read | `isAuthenticated`, `requireHachUser`, `getSessionUser` |
| `lib/hach/payload-filter` (from leak-plug PRD) | Use | Wrap HACH responses with `safeHachJson` |
| `lib/audit` | Write | Audit-log every message POST and PATCH |

---

## Out of Scope

- UI for posting/reading messages — `unified-review-surface_prd_2026-05-12.md`
- @-mentions, notifications, SMS/email alerts on new messages — Phase 2
- File attachments on messages — Phase 2 (single text body only in v1)
- Refi workspace type beyond schema support — no refi route handlers yet
- Soft delete of messages — append-only, no delete
- Moderation tools — out of scope
- Pinning / starring / threading — out of scope (linear message stream per channel per scope)

---

## Risks and Edge Cases

| Risk | Mitigation |
|---|---|
| Stanton route accidentally queries `hach_workspace_messages` | Separate route files, no shared handler, automated test |
| Workspace auto-create races (two concurrent first-access requests) | UNIQUE constraint on `(workspace_type, anchor_id)`; INSERT … ON CONFLICT DO NOTHING + re-select |
| Refi anchor table doesn't exist yet | Schema uses bare UUID for `anchor_id`, no FK to a specific anchor table — that's intentional. Validation lives in the API layer. |
| `author_party_org` snapshot drifts if a user's org changes | Snapshot at write time. Org changes never rewrite history. By design. |
| 5-minute edit window is too short / too long | Configurable as `EDIT_WINDOW_MINUTES` constant in `lib/workspaces/edit-window.ts`, default 5. Alex can adjust if it bites. |
| Message body needs rich text / markdown | v1 is plain text only. Renderer can interpret line breaks. Defer rich text to Phase 2. |
| Author display name drift (Tess gets married, last name changes) | Snapshot at write. Old messages show old name. Acceptable. |

---

## Open Questions

| Question | Owner | Default for v1 |
|---|---|---|
| 1. Should the shared channel allow attachments (e.g., HACH attaches a corrected pay-stub example)? | Alex | No — text only in v1. |
| 2. Should there be a typing indicator / presence ("Christine is reading this packet")? | Alex | No — defer. |
| 3. When does a workspace get archived (after voucher issued?) | Alex | Workspace persists. No archive in v1. |
| 4. Should messages anchored to a document show in the application-level view too? | Alex | Default: no. Doc-anchored messages live on the doc; app-level view shows app-level messages only. Toggle could be added in UI. |
| 5. Read receipts: do users want to *see* who's read what, or is it just an unread-count gimmick? | Alex | v1: just unread counts, not per-message read receipts visible to others. |

---

## Acceptance Criteria

- [ ] Migration applies cleanly, creating five new tables with constraints, indexes, and RLS enabled.
- [ ] Workspace auto-creation on first access works (no manual seed needed).
- [ ] PBV workspace gets exactly two parties: `stanton` and `hach`.
- [ ] Stanton routes succeed for Stanton sessions, return 403 for HACH sessions.
- [ ] HACH routes succeed for HACH sessions, return 403 for Stanton sessions.
- [ ] POST to a Stanton-private channel from a HACH session is impossible (no route + DB constraint).
- [ ] POST to shared channel from Stanton → row has `author_party_org='stanton'`; from HACH → `author_party_org='hach'`.
- [ ] Edit within 5 minutes succeeds, sets `edited_at`. Edit at 6 minutes returns 409.
- [ ] Non-author edit attempt returns 403.
- [ ] Unread counts compute correctly per channel per user.
- [ ] HACH workspace responses pass the `safeHachJson` allowlist check.
- [ ] `__tests__/workspace-wall.test.ts` passes with all 10 wall tests.
- [ ] No UI files are touched by this PRD's build.
