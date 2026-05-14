'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { AwaitingConfirmationDoc } from '@/lib/work/queries';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  flagged: 'Flagged',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  flagged: 'bg-orange-100 text-orange-700',
};

function formatDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface AwaitingMyConfirmationProps {
  refreshTrigger?: number;
}

export default function AwaitingMyConfirmation({ refreshTrigger }: AwaitingMyConfirmationProps) {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<AwaitingConfirmationDoc[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/me/work/awaiting-confirmation?status=pending');
      const json = await res.json();
      if (json.success) {
        setDocuments(json.data.documents ?? []);
      }
    } catch (error) {
      console.error('Failed to fetch awaiting confirmation:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  // Group by application
  const groupedByApp = documents.reduce(
    (acc: Record<string, AwaitingConfirmationDoc[]>, doc: AwaitingConfirmationDoc) => {
      if (!acc[doc.application_id]) {
        acc[doc.application_id] = [];
      }
      acc[doc.application_id].push(doc);
      return acc;
    },
    {}
  );

  const decisionCopy = "What tier-1 reviews am I responsible for signing off on?";

  return (
    <div className="bg-white border border-[var(--border)]">
      <div className="px-5 py-3 border-b border-[var(--divider)] bg-[var(--bg-section)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-[var(--ink)]">Awaiting My Confirmation</h3>
          <span
            className="text-[var(--muted)] text-sm cursor-help"
            title={decisionCopy}
          >
            ⓘ
          </span>
        </div>
        <div className="text-sm text-[var(--muted)]">{documents.length} docs</div>
      </div>

      <div className="divide-y divide-[var(--divider)]">
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Loading...</div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            Nothing in this view right now
          </div>
        ) : (
          Object.entries(groupedByApp).map(([appId, docs]) => (
            <div key={appId} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <Link
                    href={`/admin/pbv/full-applications/${appId}`}
                    className="font-semibold text-[var(--ink)] hover:underline"
                  >
                    {docs[0].head_of_household_name}
                  </Link>
                  <p className="text-xs text-[var(--muted)]">
                    {docs[0].building_address} Unit {docs[0].unit_number}
                  </p>
                </div>
                <Link
                  href={`/admin/pbv/full-applications/${appId}`}
                  className="text-xs text-[var(--primary)] underline"
                >
                  Open →
                </Link>
              </div>
              <div className="space-y-2">
                {docs.map((doc) => (
                  <Link
                    key={doc.document_id}
                    href={`/admin/pbv/full-applications/${appId}?doc=${doc.document_id}`}
                    className="flex items-center justify-between p-2 hover:bg-[var(--bg-section)] border border-transparent hover:border-[var(--border)] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[doc.owner_review_status]}`}
                      >
                        {STATUS_LABELS[doc.owner_review_status]}
                      </span>
                      <span className="text-sm text-[var(--ink)]">{doc.label}</span>
                      {doc.owner_flag_reason && (
                        <span className="text-xs text-orange-600">Flag: {doc.owner_flag_reason}</span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {doc.reviewer && <span>Reviewed by {doc.reviewer} • </span>}
                      {formatDate(doc.reviewed_at)}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
