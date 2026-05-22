-- PRP-018 / G1: consent-version integrity table.
--
-- Stores every consent_text_version the app may emit, with an `active`
-- flag (a version can be retired but kept for audit-trail reads) and an
-- `effective_from` timestamp. Sign-summary validates the submitted
-- version against this table and rejects unknown values — pre-PRP-018
-- the version was a free-form TypeScript string.
--
-- Commit-only per PRP. Alex applies on the prod Supabase project via the
-- dashboard or CLI after review.

CREATE TABLE IF NOT EXISTS consent_versions (
  version          text PRIMARY KEY,
  active           boolean NOT NULL DEFAULT true,
  effective_from   timestamptz NOT NULL DEFAULT now(),
  retired_at       timestamptz,
  notes            text
);

-- Seed the version currently shipped by lib/pbv/consent-text.ts.
-- New versions are added in this table BEFORE the TS constant is bumped.
INSERT INTO consent_versions (version, active, effective_from, notes)
VALUES ('2026-05-15-v1', true, '2026-05-15 00:00:00+00', 'Initial PBV full-app consent version (HACH-bound).')
ON CONFLICT (version) DO NOTHING;

-- Belt-and-suspenders: an audit-trail row that references an unknown
-- consent_text_version must be visible to operators. RLS is unchanged
-- (read-only via service role from app code); this table is small.
COMMENT ON TABLE consent_versions IS
  'PRP-018 / G1: registry of every consent_text_version sign-summary will accept. Add new rows here before bumping the TS constant.';
