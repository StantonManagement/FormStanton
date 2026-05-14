'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { AppWithoutLead } from '@/lib/work/queries';

const STAGE_LABELS: Record<string, string> = {
  stanton_review: 'Stanton Review',
  submitted_to_hach: 'Submitted to HACH',
  hach_review: 'HACH Review',
};

interface AppsWithoutLeadProps {
  refreshTrigger?: number;
}

export default function AppsWithoutLead({ refreshTrigger }: AppsWithoutLeadProps) {
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<AppWithoutLead[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/pbv/rollup/apps-without-lead');
      const json = await res.json();
      if (json.success) {
        setApplications(json.data.applications ?? []);
      }
    } catch (error) {
      console.error('Failed to fetch apps without lead:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  const decisionCopy = "Which packets need a Lead assigned before they advance?";

  return (
    <div className="bg-white border border-[var(--border)]">
      <div className="px-5 py-3 border-b border-[var(--divider)] bg-[var(--bg-section)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-[var(--ink)]">Apps Without a Lead</h3>
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
                <span className="font-semibold text-[var(--ink)]">{app.head_of_household_name}</span>
                <p className="text-xs text-[var(--muted)]">
                  {app.building_address} Unit {app.unit_number}
                </p>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Stage: {STAGE_LABELS[app.stage] ?? app.stage}
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`text-lg font-semibold ${
                    app.days_in_stage > 10 ? 'text-red-600' : 'text-[var(--ink)]'
                  }`}
                >
                  {app.days_in_stage}d
                </span>
                <p className="text-xs text-[var(--muted)]">in stage</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
