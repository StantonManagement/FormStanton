'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { AtRiskApp } from '@/lib/work/queries';

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

interface AtRiskProps {
  refreshTrigger?: number;
}

export default function AtRisk({ refreshTrigger }: AtRiskProps) {
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<AtRiskApp[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/pbv/rollup/at-risk');
      const json = await res.json();
      if (json.success) {
        setApplications(json.data.applications ?? []);
      }
    } catch (error) {
      console.error('Failed to fetch at-risk apps:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  const decisionCopy = "What is at risk of slipping a move-in commitment?";

  return (
    <div className="bg-white border border-[var(--border)]">
      <div className="px-5 py-3 border-b border-[var(--divider)] bg-[var(--bg-section)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-[var(--ink)]">At-Risk Applications</h3>
          <span
            className="text-[var(--muted)] text-sm cursor-help"
            title={decisionCopy}
          >
            ⓘ
          </span>
        </div>
        <div className="text-sm text-[var(--muted)]">
          {applications.filter((a) => a.risk_source === 'target_date').length} with move-in date
        </div>
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
                  Stage: {STAGE_LABELS[app.stage] ?? app.stage} • {app.days_in_stage}d in stage
                </p>
                {app.risk_source === 'target_date' && app.target_move_in_date && (
                  <p className="text-xs text-red-600 mt-1">
                    Move-in: {new Date(app.target_move_in_date).toLocaleDateString()}
                    {app.days_until_move_in !== null && ` (${app.days_until_move_in} days)`}
                  </p>
                )}
                {app.risk_source === 'stage_age' && (
                  <p className="text-xs text-amber-600 mt-1">
                    Based on stage age ({app.days_in_stage} days in {STAGE_LABELS[app.stage] || app.stage})
                  </p>
                )}
              </div>
              <div className="text-right">
                {app.days_until_move_in !== null ? (
                  <>
                    <span
                      className={`text-lg font-semibold ${
                        app.days_until_move_in <= 7 ? 'text-red-600' : 'text-amber-600'
                      }`}
                    >
                      {app.days_until_move_in}d
                    </span>
                    <p className="text-xs text-[var(--muted)]">until move-in</p>
                  </>
                ) : (
                  <>
                    <span className="text-lg font-semibold text-amber-600">{app.days_in_stage}d</span>
                    <p className="text-xs text-[var(--muted)]">in stage</p>
                  </>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
