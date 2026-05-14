'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { BottleneckStage } from '@/lib/work/queries';

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

interface BottlenecksProps {
  refreshTrigger?: number;
  range: 'week' | 'month' | 'custom';
}

export default function Bottlenecks({ refreshTrigger, range }: BottlenecksProps) {
  const [loading, setLoading] = useState(true);
  const [stages, setStages] = useState<BottleneckStage[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/pbv/rollup/bottlenecks?range=${range}`);
      const json = await res.json();
      if (json.success) {
        setStages(json.data.stages ?? []);
      }
    } catch (error) {
      console.error('Failed to fetch bottlenecks:', error);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  const decisionCopy = "Where is the workflow backing up?";

  return (
    <div className="bg-white border border-[var(--border)]">
      <div className="px-5 py-3 border-b border-[var(--divider)] bg-[var(--bg-section)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-[var(--ink)]">Bottlenecks</h3>
          <span
            className="text-[var(--muted)] text-sm cursor-help"
            title={decisionCopy}
          >
            ⓘ
          </span>
        </div>
        <div className="text-sm text-[var(--muted)]">
          {stages.filter((s) => s.above_threshold).length} above threshold
        </div>
      </div>

      <div className="divide-y divide-[var(--divider)]">
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Loading...</div>
        ) : stages.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            Nothing in this view right now
          </div>
        ) : (
          stages.map((stage) => (
            <Link
              key={stage.stage}
              href={`/admin/pbv/pipeline?stage=${stage.stage}`}
              className="flex items-center justify-between p-4 hover:bg-[var(--bg-section)] border border-transparent hover:border-[var(--border)] transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--ink)]">
                    {STAGE_LABELS[stage.stage] ?? stage.stage}
                  </span>
                  {stage.above_threshold && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
                      Above threshold ({stage.threshold_days}d)
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {stage.application_count} application{stage.application_count !== 1 ? 's' : ''} • Avg{' '}
                  {stage.avg_days_in_stage}d • Max {stage.max_days_in_stage}d
                </p>
              </div>
              <div className="text-right">
                <span
                  className={`text-lg font-semibold ${
                    stage.above_threshold ? 'text-red-600' : 'text-[var(--ink)]'
                  }`}
                >
                  {stage.avg_days_in_stage}d
                </span>
                <p className="text-xs text-[var(--muted)]">avg</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
