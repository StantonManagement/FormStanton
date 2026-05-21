-- PRD-75 Phase 1 — RLS lockdown on pbv_document_requirements and
-- pbv_rejection_reason_templates.
--
-- Audit finding #3 (CRITICAL, stress test 2026-05-21): both tables grant the
-- anonymous `public` role ALL access with qual=true in prod. Every other PBV
-- table is service_role-only. This is migration-vs-prod drift, not a bad
-- committed migration — `20260514220000_pbv_rejection_reason_templates.sql`
-- already declares the correct policies; the drift is an additional
-- `public ALL` policy added out-of-band. `pbv_document_requirements` has no
-- committed migration at all (the table was created out-of-band).
--
-- This migration is a FORWARD, IDEMPOTENT corrective migration. It does not
-- edit `20260514220000` or create the table — it only locks down RLS.
--
-- Status: COMMIT-ONLY. Do NOT apply in this batch. Listed in OPEN-DECISIONS
-- as MIGRATION-TO-APPLY (PRD-75). Safe to re-apply.
--
-- Schema gap NOT addressed here (logged as DECISION in OPEN-DECISIONS):
--   pbv_document_requirements is still not under migration control (its
--   column definitions are not in any committed migration). Bringing the
--   table under migration control requires read-only introspection of the
--   prod schema, which is not available in-session. RLS-only lockdown is
--   sufficient to remediate #3.

BEGIN;

-- 1. Drop any policy on either table that grants the `public` role anything.
--    Policy names are not known in advance because the drift was added by
--    hand. Loop through pg_policies and target only public-role rows on the
--    two tables; do not touch the existing locked-down policies.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('pbv_document_requirements', 'pbv_rejection_reason_templates')
      AND 'public' = ANY(roles)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    RAISE NOTICE 'PRD-75: dropped public-role policy % on %', pol.policyname, pol.tablename;
  END LOOP;
END $$;

-- 2. Ensure RLS is enabled on both tables. (No-op if already enabled.)
ALTER TABLE public.pbv_rejection_reason_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pbv_document_requirements      ENABLE ROW LEVEL SECURITY;

-- 3. Reassert (idempotent) the locked-down policy set on
--    pbv_rejection_reason_templates: authenticated SELECT (admin UI reads the
--    template dropdown via the authenticated session) + service_role ALL.
--    Mirrors the original definition in 20260514220000.
DROP POLICY IF EXISTS "Allow service role full access" ON public.pbv_rejection_reason_templates;
CREATE POLICY "Allow service role full access"
  ON public.pbv_rejection_reason_templates
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read access" ON public.pbv_rejection_reason_templates;
CREATE POLICY "Allow authenticated read access"
  ON public.pbv_rejection_reason_templates
  FOR SELECT TO authenticated
  USING (true);

-- 4. Lock down pbv_document_requirements to service_role only. The only known
--    reader in the codebase is `generate-forms/route.ts` via supabaseAdmin
--    (service_role), so no authenticated-role read is needed.
DROP POLICY IF EXISTS "service_role full access on pbv_document_requirements"
  ON public.pbv_document_requirements;
CREATE POLICY "service_role full access on pbv_document_requirements"
  ON public.pbv_document_requirements
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMIT;

-- Post-apply verification (run by hand, not part of the migration):
--   SELECT tablename, policyname, roles, cmd
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('pbv_document_requirements', 'pbv_rejection_reason_templates')
--   ORDER BY tablename, policyname;
--   -- Expect: no policy with `public` in roles.
