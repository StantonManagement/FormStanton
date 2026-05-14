'use client';

import { useState, useEffect, useCallback } from 'react';
import type { WorkloadReviewer } from '@/lib/work/queries';

interface WorkloadByReviewerProps {
  refreshTrigger?: number;
  range: 'week' | 'month' | 'custom';
}

export default function WorkloadByReviewer({ refreshTrigger, range }: WorkloadByReviewerProps) {
  const [loading, setLoading] = useState(true);
  const [reviewers, setReviewers] = useState<WorkloadReviewer[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/pbv/rollup/workload?range=${range}`);
      const json = await res.json();
      if (json.success) {
        setReviewers(json.data.reviewers ?? []);
      }
    } catch (error) {
      console.error('Failed to fetch workload:', error);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  const decisionCopy = "Who needs help / who has capacity?";

  return (
    <div className="bg-white border border-[var(--border)]">
      <div className="px-5 py-3 border-b border-[var(--divider)] bg-[var(--bg-section)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-[var(--ink)]">Workload by Reviewer</h3>
          <span
            className="text-[var(--muted)] text-sm cursor-help"
            title={decisionCopy}
          >
            ⓘ
          </span>
        </div>
        <div className="text-sm text-[var(--muted)]">{reviewers.length} reviewers</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-section)] border-b border-[var(--divider)]">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-[var(--muted)]">Reviewer</th>
              <th className="px-4 py-2 text-right font-medium text-[var(--muted)]">Assigned</th>
              <th className="px-4 py-2 text-right font-medium text-[var(--muted)]">Awaiting Review</th>
              <th className="px-4 py-2 text-right font-medium text-[var(--muted)]">Avg Age</th>
              <th className="px-4 py-2 text-right font-medium text-[var(--muted)]">Reviewed (7d)</th>
              <th className="px-4 py-2 text-left font-medium text-[var(--muted)]">Last Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--divider)]">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-[var(--muted)]">
                  Loading...
                </td>
              </tr>
            ) : reviewers.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-[var(--muted)]">
                  Nothing in this view right now
                </td>
              </tr>
            ) : (
              reviewers.map((r) => (
                <tr key={r.user_id} className="hover:bg-[var(--bg-section)]">
                  <td className="px-4 py-3 font-medium text-[var(--ink)]">{r.display_name}</td>
                  <td className="px-4 py-3 text-right">{r.assigned_count}</td>
                  <td className="px-4 py-3 text-right">
                    {r.awaiting_review_count > 0 ? (
                      <span className="text-amber-600 font-medium">{r.awaiting_review_count}</span>
                    ) : (
                      <span className="text-[var(--muted)]">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.avg_age_days > 3 ? (
                      <span className="text-amber-600">{r.avg_age_days}d</span>
                    ) : (
                      <span className="text-[var(--muted)]">{r.avg_age_days}d</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{r.reviewed_last_7_days}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {r.last_activity_at
                      ? new Date(r.last_activity_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
