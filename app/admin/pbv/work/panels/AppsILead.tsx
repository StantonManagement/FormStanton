'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { AppLeadSummary } from '@/lib/work/queries';

const STAGE_LABELS: Record<string, string> = {
  pre_app: 'Pre-App',
  intake: 'Intake',
  stanton_review: 'Stanton Review',
  submitted_to_hach: 'Submitted to HACH',
  hach_review: 'HACH Review',
  approved: 'Approved',
  denied: 'Denied',
  withdrawn: 'Withdrawn',
};

interface AppsILeadProps {
  refreshTrigger?: number;
}

export default function AppsILead({ refreshTrigger }: AppsILeadProps) {
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<AppLeadSummary[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/me/work/apps-i-lead');
      const json = await res.json();
      if (json.success) {
        setApplications(json.data.applications ?? []);
      }
    } catch (error) {
      console.error('Failed to fetch apps I lead:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  // Sort by ready-to-send first, then by tier-2 pending count
  const sortedApps = [...applications].sort((a, b) => {
    if (a.ready_to_send && !b.ready_to_send) return -1;
    if (!a.ready_to_send && b.ready_to_send) return 1;
    return b.tier2_pending_count - a.tier2_pending_count;
  });

  const decisionCopy = "Which of my packets are ready to push to HACH, and which still need work?";

  return (
    <div className="bg-white border border-[var(--border)]">
      <div className="px-5 py-3 border-b border-[var(--divider)] bg-[var(--bg-section)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-[var(--ink)]">Apps I Lead</h3>
          <span
            className="text-[var(--muted)] text-sm cursor-help"
            title={decisionCopy}
          >
            ⓘ
          </span>
        </div>
        <div className="text-sm text-[var(--muted)]">
          {applications.filter((a) => a.ready_to_send).length} ready
        </div>
      </div>

      <div className="divide-y divide-[var(--divider)]">
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Loading...</div>
        ) : sortedApps.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            Nothing in this view right now
          </div>
        ) : (
          sortedApps.map((app) => (
            <Link
              key={app.application_id}
              href={`/admin/pbv/full-applications/${app.application_id}`}
              className="flex items-center justify-between p-4 hover:bg-[var(--bg-section)] border border-transparent hover:border-[var(--border)] transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--ink)]">{app.head_of_household_name}</span>
                  {app.ready_to_send && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                      Ready to send
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {app.building_address} Unit {app.unit_number}
                </p>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Stage: {STAGE_LABELS[app.stage] ?? app.stage}
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm">
                  <span className="font-medium">{app.tier1_pending_count}</span>
                  <span className="text-[var(--muted)]"> tier-1 pending</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium">{app.tier2_pending_count}</span>
                  <span className="text-[var(--muted)]"> tier-2 pending</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
