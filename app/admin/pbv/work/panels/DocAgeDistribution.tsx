'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DocAgeBucket } from '@/lib/work/queries';

interface DocAgeDistributionProps {
  refreshTrigger?: number;
}

export default function DocAgeDistribution({ refreshTrigger }: DocAgeDistributionProps) {
  const [loading, setLoading] = useState(true);
  const [buckets, setBuckets] = useState<DocAgeBucket[]>([]);
  const [filterRole, setFilterRole] = useState<'all' | 'tenant' | 'staff' | 'hach'>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const url =
        filterRole === 'all'
          ? '/api/admin/pbv/rollup/doc-age'
          : `/api/admin/pbv/rollup/doc-age?uploader_role=${filterRole}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setBuckets(json.data.buckets ?? []);
      }
    } catch (error) {
      console.error('Failed to fetch doc age distribution:', error);
    } finally {
      setLoading(false);
    }
  }, [filterRole]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  const decisionCopy = "Are we keeping up with intake volume?";

  return (
    <div className="bg-white border border-[var(--border)]">
      <div className="px-5 py-3 border-b border-[var(--divider)] bg-[var(--bg-section)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-[var(--ink)]">Document Age Distribution</h3>
          <span
            className="text-[var(--muted)] text-sm cursor-help"
            title={decisionCopy}
          >
            ⓘ
          </span>
        </div>
        <div className="text-sm text-[var(--muted)]">{total} submitted docs</div>
      </div>

      <div className="p-4 border-b border-[var(--divider)]">
        <div className="flex gap-2">
          {(['all', 'tenant', 'staff', 'hach'] as const).map((role) => (
            <button
              key={role}
              onClick={() => setFilterRole(role)}
              className={`px-3 py-1.5 text-sm border transition-colors ${
                filterRole === role
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                  : 'border-[var(--border)] text-[var(--ink)] hover:bg-[var(--bg-section)]'
              }`}
            >
              {role === 'all' ? 'All' : role.charAt(0).toUpperCase() + role.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Loading...</div>
        ) : total === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            Nothing in this view right now
          </div>
        ) : (
          <div className="space-y-3">
            {buckets.map((bucket) => {
              const percentage = total > 0 ? (bucket.count / total) * 100 : 0;
              const barWidth = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;

              return (
                <div key={bucket.bucket_label} className="flex items-center gap-3">
                  <div className="w-20 text-sm text-[var(--muted)]">{bucket.bucket_label}</div>
                  <div className="flex-1 h-6 bg-[var(--bg-section)] relative">
                    <div
                      className="absolute top-0 left-0 h-full bg-[var(--primary)] transition-all"
                      style={{ width: `${barWidth}%` }}
                    />
                    <span className="absolute inset-0 flex items-center px-2 text-xs text-[var(--ink)]">
                      {bucket.count} ({Math.round(percentage * 10) / 10}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
