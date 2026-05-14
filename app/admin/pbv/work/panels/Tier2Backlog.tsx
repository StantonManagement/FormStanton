'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { Tier2BacklogApp } from '@/lib/work/queries';

interface Tier2BacklogProps {
  refreshTrigger?: number;
}

export default function Tier2Backlog({ refreshTrigger }: Tier2BacklogProps) {
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<Tier2BacklogApp[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/pbv/rollup/tier2-backlog');
      const json = await res.json();
      if (json.success) {
        setApplications(json.data.applications ?? []);
      }
    } catch (error) {
      console.error('Failed to fetch tier-2 backlog:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  const decisionCopy = "Which Leads are overloaded, and which apps are stuck waiting on confirmation?";

  return (
    <div className="bg-white border border-[var(--border)]">
      <div className="px-5 py-3 border-b border-[var(--divider)] bg-[var(--bg-section)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-[var(--ink)]">Tier-2 Confirmation Backlog</h3>
          <span
            className="text-[var(--muted)] text-sm cursor-help"
            title={decisionCopy}
          >
            ⓘ
          </span>
        </div>
        <div className="text-sm text-[var(--muted)]">{applications.length} apps</div>
      </div>

      <div className="divide-y divide-[var(--divider)]">
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Loading...</div>
        ) : applications.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            Nothing in this view right now
          </div>
        ) : (
          applications.map((app) => (
            <Link
              key={app.application_id}
              href={`/admin/pbv/full-applications/${app.application_id}`}
              className="flex items-center justify-between p-4 hover:bg-[var(--bg-section)] border border-transparent hover:border-[var(--border)] transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--ink)]">{app.head_of_household_name}</span>
                  <span className="text-xs text-[var(--muted)]">
                    {app.building_address} Unit {app.unit_number}
                  </span>
                </div>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Tier-1: {app.tier1_completed_count}/{app.tier1_total_count} complete • Lead:{' '}
                  {app.lead_display_name ?? 'Unassigned'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-lg font-semibold text-amber-600">{app.tier2_pending_count}</span>
                <p className="text-xs text-[var(--muted)]">awaiting confirmation</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
