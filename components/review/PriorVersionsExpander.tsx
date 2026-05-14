'use client';

import { useState } from 'react';

interface Revision {
  revision: number;
  file_name: string;
  storage_path: string;
  uploaded_by: string;
  uploaded_at: string;
  status_at_review: string | null;
}

interface PriorVersionsExpanderProps {
  revisionsUrl: string;
  currentRevision: number;
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const STATUS_LABELS: Record<string, string> = {
  approved: 'Approved',
  rejected: 'Rejected',
  waived: 'Waived',
};

export default function PriorVersionsExpander({
  revisionsUrl,
  currentRevision,
}: PriorVersionsExpanderProps) {
  const [expanded, setExpanded] = useState(false);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (currentRevision <= 1) return null;

  const handleToggle = async () => {
    if (!expanded && revisions.length === 0) {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(revisionsUrl);
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || 'Failed to load revisions');
        setRevisions(json.data as Revision[]);
      } catch (err: any) {
        setError(err.message || 'Failed to load revisions');
      } finally {
        setLoading(false);
      }
    }
    setExpanded((v) => !v);
  };

  const priorCount = currentRevision - 1;

  return (
    <div className="px-5 py-1.5 bg-gray-50">
      <button
        type="button"
        onClick={handleToggle}
        className="text-xs text-[var(--primary)] hover:underline focus:outline-none"
      >
        {expanded ? 'Hide' : `Show ${priorCount} prior version${priorCount !== 1 ? 's' : ''}`}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5">
          {loading && <p className="text-xs text-[var(--muted)]">Loading…</p>}
          {error && <p className="text-xs text-[var(--error)]">{error}</p>}
          {!loading && !error && revisions.filter((r) => r.revision < currentRevision).map((rev) => (
            <div key={rev.revision} className="flex items-center gap-3 py-1 text-xs text-gray-600">
              <span className="font-mono text-gray-400 w-6 text-right">v{rev.revision}</span>
              <span className="flex-1 font-mono truncate">{rev.file_name}</span>
              {rev.status_at_review && (
                <span className={`px-1.5 py-0.5 font-medium ${
                  rev.status_at_review === 'approved' ? 'bg-green-100 text-green-700' :
                  rev.status_at_review === 'rejected' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {STATUS_LABELS[rev.status_at_review] ?? rev.status_at_review}
                </span>
              )}
              <span className="text-gray-400 whitespace-nowrap">
                {rev.uploaded_by === 'tenant' ? 'Tenant' : rev.uploaded_by.startsWith('staff:') ? 'Staff' : rev.uploaded_by}
                {' · '}{fmtDateTime(rev.uploaded_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
