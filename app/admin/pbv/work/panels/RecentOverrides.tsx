'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { RecentOverride } from '@/lib/work/queries';

interface RecentOverridesProps {
  refreshTrigger?: number;
}

export default function RecentOverrides({ refreshTrigger }: RecentOverridesProps) {
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState<RecentOverride[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/pbv/rollup/overrides');
      const json = await res.json();
      if (json.success) {
        setOverrides(json.data.overrides ?? []);
      }
    } catch (error) {
      console.error('Failed to fetch recent overrides:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  const decisionCopy = "Should I review whether this packet should have gone out?";

  return (
    <div className="bg-white border border-[var(--border)]">
      <div className="px-5 py-3 border-b border-[var(--divider)] bg-[var(--bg-section)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-[var(--ink)]">Recent Overrides</h3>
          <span
            className="text-[var(--muted)] text-sm cursor-help"
            title={decisionCopy}
          >
            ⓘ
          </span>
        </div>
        <div className="text-sm text-[var(--muted)]">{overrides.length} in last 30 days</div>
      </div>

      <div className="divide-y divide-[var(--divider)]">
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Loading...</div>
        ) : overrides.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            Nothing in this view right now
          </div>
        ) : (
          overrides.map((override) => (
            <Link
              key={override.application_id}
              href={`/admin/pbv/full-applications/${override.application_id}`}
              className="flex items-start justify-between p-4 hover:bg-[var(--bg-section)] border border-transparent hover:border-[var(--border)] transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--ink)]">{override.head_of_household_name}</span>
                  <span className="text-xs text-[var(--muted)]">
                    {override.building_address} Unit {override.unit_number}
                  </span>
                </div>
                <p className="text-sm text-red-600 mt-1">
                  Override reason: {override.override_reason}
                </p>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Failed checks: {override.failed_checks.join(', ')}
                </p>
              </div>
              <div className="text-right text-xs text-[var(--muted)]">
                <div>By {override.submitted_by}</div>
                <div>{new Date(override.submitted_at).toLocaleDateString()}</div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
