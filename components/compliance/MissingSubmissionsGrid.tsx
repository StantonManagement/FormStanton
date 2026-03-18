'use client';

import type { MatrixRow } from '@/types/compliance';

interface MissingSubmissionsGridProps {
  rows: MatrixRow[];
}

export default function MissingSubmissionsGrid({ rows }: MissingSubmissionsGridProps) {
  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-[var(--success)] bg-white border border-[var(--border)]">
        All occupied units have submissions.
      </div>
    );
  }

  return (
    <div className="bg-white border border-[var(--border)]">
      <div className="px-4 py-3 bg-[var(--error)]/10 border-b border-[var(--error)]/35">
        <div className="text-sm font-semibold text-[var(--error)]">
          {rows.length} occupied unit{rows.length !== 1 ? 's' : ''} without submissions
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-4">
        {rows.map((row) => (
          <div key={row.unit_number} className="p-3 border border-[var(--error)]/25 bg-white">
            <div className="flex items-center justify-between mb-1">
              <div className="font-semibold text-sm text-[var(--error)]">Unit {row.unit_number}</div>
              <span className="text-[10px] px-1.5 py-0.5 bg-[var(--error)]/10 text-[var(--error)] border border-[var(--error)]/20">Missing</span>
            </div>
            <div className="text-sm text-[var(--ink)]">{row.tenant_lookup_name || '\u2014'}</div>
            {row.email && <div className="text-xs text-[var(--muted)] mt-0.5 truncate">{row.email}</div>}
            {row.phone && <div className="text-xs text-[var(--muted)]">{row.phone}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
