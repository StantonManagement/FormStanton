'use client';

import { useState } from 'react';
import type { DynamicColumn } from '@/types/compliance';

interface ProjectMatrixCellProps {
  status: string;
  column: DynamicColumn;
  completedAt: string | null;
  completedBy: string | null;
  onStaffComplete?: () => Promise<void>;
  onStaffUncomplete?: () => Promise<void>;
  docUrl?: string | null;
}

export default function ProjectMatrixCell({
  status,
  column,
  completedAt,
  completedBy,
  onStaffComplete,
  onStaffUncomplete,
  docUrl,
}: ProjectMatrixCellProps) {
  const [completing, setCompleting] = useState(false);

  // Waived
  if (status === 'waived') {
    return (
      <td className="px-2 py-1.5 text-center text-xs text-[var(--muted)] border border-[var(--divider)]">
        —
      </td>
    );
  }

  // Complete
  if (status === 'complete') {
    const auditText = [
      completedBy && `by ${completedBy}`,
      completedAt && new Date(completedAt).toLocaleDateString(),
    ].filter(Boolean).join(' · ');

    return (
      <td className="px-2 py-1.5 text-center border border-[var(--divider)] group relative" title={auditText}>
        <span className="text-[var(--success)] text-xs font-medium">✓</span>
        {column.assignee === 'staff' && onStaffUncomplete && (
          <button
            type="button"
            onClick={async () => {
              setCompleting(true);
              try { await onStaffUncomplete(); } finally { setCompleting(false); }
            }}
            disabled={completing}
            className="absolute top-0 right-0 px-1 py-0.5 text-[9px] text-[var(--error)] opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out hover:bg-[var(--error)]/10 disabled:opacity-50"
            title="Undo completion"
          >
            ↩
          </button>
        )}
        {auditText && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-[var(--ink)] text-white text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out pointer-events-none z-10">
            {auditText}
          </div>
        )}
      </td>
    );
  }

  // Pending — staff task (clickable)
  if (column.assignee === 'staff' && onStaffComplete) {
    return (
      <td className="px-2 py-1.5 text-center border border-[var(--divider)]">
        <div className="flex items-center justify-center gap-1">
          {docUrl && (
            <a
              href={docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-1 py-0.5 text-[10px] text-[var(--primary)] hover:text-[var(--primary-light)] transition-colors"
              title="View document"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </a>
          )}
          <button
            type="button"
            onClick={async () => {
              setCompleting(true);
              try {
                await onStaffComplete();
              } finally {
                setCompleting(false);
              }
            }}
            disabled={completing}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/35 hover:bg-[var(--warning)]/20 transition-colors duration-200 ease-out cursor-pointer disabled:opacity-50"
            title="Click to mark complete"
          >
            {completing ? (
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              'Staff'
            )}
          </button>
        </div>
      </td>
    );
  }

  // Pending — tenant task
  return (
    <td className="px-2 py-1.5 text-center border border-[var(--divider)] bg-[var(--error)]/5">
      <span className="text-[var(--error)] text-xs">✗</span>
    </td>
  );
}
