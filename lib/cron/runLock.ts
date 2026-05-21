import { supabaseAdmin } from '@/lib/supabase';

/**
 * Connection-independent claim primitive for cron runs.
 *
 * A regional Vercel cron may invoke the same job twice in parallel. To avoid
 * double-sending (deferred reminders, scheduled notification dispatch), each
 * handler tries to claim a lease in the `cron_run_locks` table; the claim is
 * an atomic conditional INSERT/UPDATE — only the run whose statement returns
 * a row holds the lease.
 *
 * Releases are not required (and not implemented) — the lease expires after
 * `leaseSeconds`. Pick a lease comfortably longer than the worst-case run.
 */
export async function claimCronRun(
  jobName: string,
  leaseSeconds: number
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('claim_cron_run', {
    p_job_name: jobName,
    p_lease_seconds: leaseSeconds,
  });

  if (error) {
    console.error(
      JSON.stringify({
        event: 'cron_claim_error',
        job: jobName,
        error: error.message,
      })
    );
    // Fail-safe: when the claim RPC errors (e.g. migration not yet applied),
    // proceed with the run rather than silently dropping work. The structured
    // log makes the misconfiguration visible.
    return true;
  }

  return data === true;
}
