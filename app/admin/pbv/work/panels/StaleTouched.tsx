'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { StaleTouchedApp } from '@/lib/work/queries';

const BLOCKER_LABELS: Record<string, { label: string; color: string }> = {
  tenant: { label: 'Tenant', color: 'bg-blue-100 text-blue-700' },
  stanton: { label: 'Stanton', color: 'bg-orange-100 text-orange-700' },
  hach: { label: 'HACH', color: 'bg-purple-100 text-purple-700' },
  internal: { label: 'Internal', color: 'bg-gray-100 text-gray-700' },
};

interface StaleTouchedProps {
  refreshTrigger?: number;
}

export default function StaleTouched({ refreshTrigger }: StaleTouchedProps) {
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<StaleTouchedApp[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/me/work/stale-touched');
      const json = await res.json();
      if (json.success) {
        setApplications(json.data.applications ?? []);
      }
    } catch (error) {
      console.error('Failed to fetch stale touched:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  const decisionCopy = "What did I drop the ball on?";

  return (
    <div className="bg-white border border-[var(--border)]">
      <div className="px-5 py-3 border-b border-[var(--divider)] bg-[var(--bg-section)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-[var(--ink)]">Stale Apps I Touched</h3>
          <span
            className="text-[var(--muted)] text-sm cursor-help"
            title={decisionCopy}
          >
            ⓘ
          </span>
        </div>
        <div className="text-sm text-[var(--muted)]">7+ days stale</div>
      </div>

      <div className="divide-y divide-[var(--divider)]">
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Loading...</div>
        ) : applications.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            Nothing in this view right now
          </div>
        ) : (
          applications.map((app) => {
            const blocker = BLOCKER_LABELS[app.suspected_blocker] ?? BLOCKER_LABELS.internal;
            return (
              <Link
                key={app.application_id}
                href={`/admin/pbv/full-applications/${app.application_id}`}
                className="flex items-center justify-between p-4 hover:bg-[var(--bg-section)] border border-transparent hover:border-[var(--border)] transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--ink)]">{app.head_of_household_name}</span>
                    <span className={`px-2 py-0.5 text-xs font-medium ${blocker.color}`}>
                      {blocker.label}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    {app.building_address} Unit {app.unit_number}
                  </p>
                  <p className="text-xs text-[var(--muted)] mt-1">
                    Last: {app.last_event_type.replace(/\./g, ' ')} by {app.last_actor}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-semibold text-red-600">{app.days_stale}d</span>
                  <p className="text-xs text-[var(--muted)]">stale</p>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
