-- =============================================================================
-- Document Lifecycle Phase 2 — Handoff
-- Adds:
--   1. Handoff columns on pbv_full_applications
--      (packet_locked, submitted_to_hach_at, submitted_to_hach_by,
--       hach_packet_revision)
--   2. send_to_hach permission seed in permissions table
-- =============================================================================


-- ─── 1. Handoff columns ──────────────────────────────────────────────────────

ALTER TABLE pbv_full_applications
  ADD COLUMN IF NOT EXISTS packet_locked          BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS submitted_to_hach_at   TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS submitted_to_hach_by   UUID        NULL,
  ADD COLUMN IF NOT EXISTS hach_packet_revision   INTEGER     NOT NULL DEFAULT 0;


-- ─── 2. Permission seed ──────────────────────────────────────────────────────

INSERT INTO permissions (resource, action)
VALUES ('pbv-full-applications', 'send_to_hach')
ON CONFLICT (resource, action) DO NOTHING;
