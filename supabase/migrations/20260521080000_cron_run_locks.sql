-- PRD-74 Phase 3 — connection-independent claim primitive for cron runs.
--
-- Vercel can invoke a cron from more than one region simultaneously. Session-
-- level `pg_advisory_lock` is unreliable through PostgREST's connection pool
-- because the connection that acquires the lock may not be reused to release
-- it. A small claim table with an atomic conditional UPSERT is portable.
--
-- Status: COMMIT-ONLY. Do NOT apply in this batch. Listed in OPEN-DECISIONS
-- as MIGRATION-TO-APPLY (PRD-74). Until applied, `claim_cron_run` is not
-- available and `claimCronRun()` fails open (logs `cron_claim_error` and
-- proceeds with the run) so the deploy-blocker fix (#1) is independent of
-- this Phase-3 hardening.

CREATE TABLE IF NOT EXISTS public.cron_run_locks (
  job_name     TEXT PRIMARY KEY,
  locked_until TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cron_run_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role full access on cron_run_locks" ON public.cron_run_locks;
CREATE POLICY "service_role full access on cron_run_locks"
  ON public.cron_run_locks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Atomic claim: returns TRUE if this caller now holds the lease, FALSE if
-- another run already holds an unexpired lease for the same job. A single
-- statement (the conditional UPSERT) makes it safe under concurrent
-- connections regardless of pooling.
CREATE OR REPLACE FUNCTION public.claim_cron_run(
  p_job_name TEXT,
  p_lease_seconds INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_returned_job TEXT;
BEGIN
  INSERT INTO public.cron_run_locks (job_name, locked_until, updated_at)
  VALUES (
    p_job_name,
    now() + make_interval(secs => p_lease_seconds),
    now()
  )
  ON CONFLICT (job_name) DO UPDATE
    SET locked_until = excluded.locked_until,
        updated_at   = now()
    WHERE public.cron_run_locks.locked_until < now()
  RETURNING job_name INTO v_returned_job;

  RETURN v_returned_job IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_cron_run(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_cron_run(TEXT, INTEGER) TO service_role;

COMMENT ON TABLE public.cron_run_locks IS
  'PRD-74: lease-based concurrency guard for cron jobs. One row per job; lease auto-expires.';
COMMENT ON FUNCTION public.claim_cron_run(TEXT, INTEGER) IS
  'PRD-74: atomic conditional claim. Returns TRUE if caller holds the new lease, FALSE if another holder is active.';
