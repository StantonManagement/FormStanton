-- Review Workspace Schema — Multi-party PBV review workspace
-- Creates the physical wall between Stanton and HACH via three separate message tables.
-- Idempotent: IF NOT EXISTS throughout.
--
-- Rollback:
--   DROP TABLE IF EXISTS public.workspace_read_receipts CASCADE;
--   DROP TABLE IF EXISTS public.shared_workspace_messages CASCADE;
--   DROP TABLE IF EXISTS public.hach_workspace_messages CASCADE;
--   DROP TABLE IF EXISTS public.stanton_workspace_messages CASCADE;
--   DROP TABLE IF EXISTS public.workspace_parties CASCADE;
--   DROP TABLE IF EXISTS public.review_workspaces CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. review_workspaces
-- One row per application that has been routed for multi-party review.
-- Generic enough to host future refi workflow with different parties.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.review_workspaces (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_type  TEXT        NOT NULL CHECK (workspace_type IN ('pbv', 'refi')),
  -- Polymorphic anchor — for PBV this points to pbv_full_applications.id.
  -- For refi (future), points to refi_applications.id.
  anchor_id       UUID        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID        REFERENCES public.admin_users(id) ON DELETE SET NULL,
  UNIQUE (workspace_type, anchor_id)
);

CREATE INDEX IF NOT EXISTS idx_review_workspaces_anchor
  ON public.review_workspaces (workspace_type, anchor_id);

ALTER TABLE public.review_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "service_role full access on review_workspaces"
  ON public.review_workspaces
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

COMMENT ON TABLE public.review_workspaces IS
  'Anchor table for multi-party review workspaces. One row per PBV application under review. '
  'The physical wall between Stanton and HACH lives in the three separate message tables, not here.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. workspace_parties
-- The participants in a workspace. For PBV: 'stanton' and 'hach'.
-- For future refi: could be 'lender', 'borrower', 'title', 'escrow'.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workspace_parties (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID        NOT NULL REFERENCES public.review_workspaces(id) ON DELETE CASCADE,
  party_role    TEXT        NOT NULL,    -- 'stanton' | 'hach' | 'lender' | 'borrower' | 'title' | 'escrow'
  party_org     TEXT        NOT NULL,    -- 'stanton' | 'hach' | 'lender' | 'borrower' | 'title'
  display_label TEXT        NOT NULL,    -- 'Stanton Management' | 'Hartford Housing Authority'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, party_role)
);

CREATE INDEX IF NOT EXISTS idx_workspace_parties_workspace
  ON public.workspace_parties (workspace_id);

ALTER TABLE public.workspace_parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "service_role full access on workspace_parties"
  ON public.workspace_parties
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

COMMENT ON TABLE public.workspace_parties IS
  'Participants in a workspace. party_org is the wall discriminator — Stanton routes only see parties '
  'where party_org = ''stanton'', HACH routes only see party_org = ''hach''.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. stanton_workspace_messages
-- Stanton internal deliberation. HACH never reads or writes here.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stanton_workspace_messages (
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

CREATE INDEX IF NOT EXISTS idx_stanton_msg_workspace
  ON public.stanton_workspace_messages (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stanton_msg_document
  ON public.stanton_workspace_messages (document_id, created_at DESC)
  WHERE document_id IS NOT NULL;

ALTER TABLE public.stanton_workspace_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "service_role full access on stanton_workspace_messages"
  ON public.stanton_workspace_messages
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

COMMENT ON TABLE public.stanton_workspace_messages IS
  'Stanton-only deliberation channel. DB constraint ensures author_party_org = ''stanton''. '
  'HACH routes never query this table. This is the physical wall in action.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. hach_workspace_messages
-- HACH internal deliberation. Stanton never reads or writes here.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hach_workspace_messages (
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

CREATE INDEX IF NOT EXISTS idx_hach_msg_workspace
  ON public.hach_workspace_messages (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_hach_msg_document
  ON public.hach_workspace_messages (document_id, created_at DESC)
  WHERE document_id IS NOT NULL;

ALTER TABLE public.hach_workspace_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "service_role full access on hach_workspace_messages"
  ON public.hach_workspace_messages
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

COMMENT ON TABLE public.hach_workspace_messages IS
  'HACH-only deliberation channel. DB constraint ensures author_party_org = ''hach''. '
  'Stanton routes never query this table. This is the physical wall in action.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. shared_workspace_messages
-- Cross-party correspondence. Both Stanton and HACH read/write.
-- The institutional record between the organizations. Append-only after grace.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shared_workspace_messages (
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

CREATE INDEX IF NOT EXISTS idx_shared_msg_workspace
  ON public.shared_workspace_messages (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shared_msg_document
  ON public.shared_workspace_messages (document_id, created_at DESC)
  WHERE document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shared_msg_party
  ON public.shared_workspace_messages (workspace_id, author_party_org, created_at DESC);

ALTER TABLE public.shared_workspace_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "service_role full access on shared_workspace_messages"
  ON public.shared_workspace_messages
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

COMMENT ON TABLE public.shared_workspace_messages IS
  'Cross-party correspondence channel. Both Stanton and HACH routes query this table. '
  'author_party_org records which side wrote the message (snapshot at write time). '
  'This is the institutional record between the two organizations.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. workspace_read_receipts
-- Tracks last-read timestamp per (user, channel) for unread counts.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workspace_read_receipts (
  user_id        UUID        NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  workspace_id   UUID        NOT NULL REFERENCES public.review_workspaces(id) ON DELETE CASCADE,
  channel        TEXT        NOT NULL CHECK (channel IN ('stanton', 'hach', 'shared')),
  last_read_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, workspace_id, channel)
);

ALTER TABLE public.workspace_read_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "service_role full access on workspace_read_receipts"
  ON public.workspace_read_receipts
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

COMMENT ON TABLE public.workspace_read_receipts IS
  'Tracks per-user read state for each channel in a workspace. Used for unread count calculations.';
