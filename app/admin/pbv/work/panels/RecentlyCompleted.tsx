'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { RecentlyCompletedDoc } from '@/lib/work/queries';

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  waived: { label: 'Waived', color: 'bg-indigo-100 text-indigo-700' },
};

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface RecentlyCompletedProps {
  refreshTrigger?: number;
}

export default function RecentlyCompleted({ refreshTrigger }: RecentlyCompletedProps) {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<RecentlyCompletedDoc[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/me/work/recently-completed?limit=10');
      const json = await res.json();
      if (json.success) {
        setDocuments(json.data.documents ?? []);
      }
    } catch (error) {
      console.error('Failed to fetch recently completed:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  const decisionCopy = "What did I do yesterday?";

  return (
    <div className="bg-white border border-[var(--border)]">
      <div className="px-5 py-3 border-b border-[var(--divider)] bg-[var(--bg-section)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-[var(--ink)]">Recently Completed</h3>
          <span
            className="text-[var(--muted)] text-sm cursor-help"
            title={decisionCopy}
          >
            ⓘ
          </span>
        </div>
        <div className="text-sm text-[var(--muted)]">Last 10</div>
      </div>

      <div className="divide-y divide-[var(--divider)]">
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Loading...</div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            Nothing in this view right now
          </div>
        ) : (
          documents.map((doc) => {
            const action = ACTION_LABELS[doc.action] ?? { label: doc.action, color: 'bg-gray-100' };
            return (
              <Link
                key={doc.document_id}
                href={`/admin/pbv/full-applications/${doc.application_id}?doc=${doc.document_id}`}
                className="flex items-center justify-between p-4 hover:bg-[var(--bg-section)] border border-transparent hover:border-[var(--border)] transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs font-medium ${action.color}`}>
                      {action.label}
                    </span>
                    <span className="text-sm text-[var(--ink)]">{doc.label}</span>
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    {doc.head_of_household_name} • {doc.building_address} Unit {doc.unit_number}
                  </p>
                </div>
                <div className="text-xs text-[var(--muted)]">{formatDate(doc.acted_at)}</div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
