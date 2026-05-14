'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { AssignedDoc } from '@/lib/work/queries';

interface AppGroup {
  application_id: string;
  head_of_household_name: string;
  building_address: string;
  unit_number: string;
  documents: AssignedDoc[];
}

const STATUS_LABELS: Record<string, string> = {
  missing: 'Missing',
  submitted: 'Awaiting review',
  approved: 'Approved',
  rejected: 'Rejected',
  waived: 'Waived',
  flagged_for_rereview: 'Flagged',
};

const STATUS_COLORS: Record<string, string> = {
  missing: 'bg-gray-100 text-gray-600',
  submitted: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  waived: 'bg-indigo-100 text-indigo-700',
  flagged_for_rereview: 'bg-orange-100 text-orange-700',
};

function formatDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDaysOld(s: string): number {
  const assigned = new Date(s);
  const now = new Date();
  return Math.floor((now.getTime() - assigned.getTime()) / (1000 * 60 * 60 * 24));
}

interface MyQueueProps {
  refreshTrigger?: number;
}

export default function MyQueue({ refreshTrigger }: MyQueueProps) {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<AssignedDoc[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterAging, setFilterAging] = useState(false);
  const [filterFlagged, setFilterFlagged] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterAging) params.set('min_age_days', '3');
      if (filterFlagged) params.set('flagged_for_rereview', 'true');

      const res = await fetch(`/api/admin/me/work/my-queue?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setDocuments(json.data.documents ?? []);
      }
    } catch (error) {
      console.error('Failed to fetch my queue:', error);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterAging, filterFlagged]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  // Group by application
  const groupedByApp = documents.reduce((acc: Record<string, AppGroup>, doc: AssignedDoc) => {
    if (!acc[doc.application_id]) {
      acc[doc.application_id] = {
        application_id: doc.application_id,
        head_of_household_name: doc.head_of_household_name,
        building_address: doc.building_address,
        unit_number: doc.unit_number,
        documents: [],
      };
    }
    acc[doc.application_id].documents.push(doc);
    return acc;
  }, {});

  const appGroups = Object.values(groupedByApp).sort((a, b) => {
    const aOldest = Math.min(...a.documents.map((d) => getDaysOld(d.assigned_at)));
    const bOldest = Math.min(...b.documents.map((d) => getDaysOld(d.assigned_at)));
    return bOldest - aOldest;
  });

  const decisionCopy = "What should I review next?";

  return (
    <div className="bg-white border border-[var(--border)]">
      <div className="px-5 py-3 border-b border-[var(--divider)] bg-[var(--bg-section)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-[var(--ink)]">My Queue</h3>
          <span
            className="text-[var(--muted)] text-sm cursor-help"
            title={decisionCopy}
          >
            ⓘ
          </span>
        </div>
        <div className="text-sm text-[var(--muted)]">{documents.length} docs</div>
      </div>

      <div className="p-4 border-b border-[var(--divider)]">
        <div className="flex flex-wrap gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 border border-[var(--border)] rounded-none text-sm bg-white"
          >
            <option value="">All statuses</option>
            <option value="submitted">Awaiting review</option>
            <option value="flagged_for_rereview">Resubmitted</option>
            <option value="approved,rejected,waived">Reviewed</option>
          </select>
          <button
            type="button"
            onClick={() => setFilterAging(!filterAging)}
            className={`px-3 py-1.5 text-sm border transition-colors ${
              filterAging
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'border-[var(--border)] text-[var(--ink)] hover:bg-[var(--bg-section)]'
            }`}
          >
            Aging (&gt;3 days)
          </button>
          <button
            type="button"
            onClick={() => setFilterFlagged(!filterFlagged)}
            className={`px-3 py-1.5 text-sm border transition-colors ${
              filterFlagged
                ? 'bg-orange-50 border-orange-300 text-orange-700'
                : 'border-[var(--border)] text-[var(--ink)] hover:bg-[var(--bg-section)]'
            }`}
          >
            Flagged for re-review
          </button>
        </div>
      </div>

      <div className="divide-y divide-[var(--divider)]">
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Loading...</div>
        ) : appGroups.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            Nothing in this view right now
          </div>
        ) : (
          appGroups.map((group) => (
            <div key={group.application_id} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <Link
                    href={`/admin/pbv/full-applications/${group.application_id}`}
                    className="font-semibold text-[var(--ink)] hover:underline"
                  >
                    {group.head_of_household_name}
                  </Link>
                  <p className="text-xs text-[var(--muted)]">
                    {group.building_address} Unit {group.unit_number}
                  </p>
                </div>
                <Link
                  href={`/admin/pbv/full-applications/${group.application_id}`}
                  className="text-xs text-[var(--primary)] underline"
                >
                  Open →
                </Link>
              </div>
              <div className="space-y-2">
                {group.documents.map((doc) => {
                  const daysOld = getDaysOld(doc.assigned_at);
                  return (
                    <Link
                      key={doc.document_id}
                      href={`/admin/pbv/full-applications/${group.application_id}?doc=${doc.document_id}`}
                      className="flex items-center justify-between p-2 hover:bg-[var(--bg-section)] border border-transparent hover:border-[var(--border)] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[doc.status]}`}
                        >
                          {STATUS_LABELS[doc.status]}
                        </span>
                        <span className="text-sm text-[var(--ink)]">{doc.label}</span>
                        {daysOld >= 3 && (
                          <span className="text-xs text-amber-600 font-medium">{daysOld}d</span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        Assigned {formatDate(doc.assigned_at)}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
