'use client';

import { useState } from 'react';
import type { DynamicColumn } from '@/types/compliance';

interface ProjectMatrixCellProps {
  status: string;
  column: DynamicColumn;
  completedAt: string | null;
  completedBy: string | null;
  onStaffComplete?: () => Promise<void>;
}

export default function ProjectMatrixCell({
  status,
  column,
  completedAt,
  completedBy,
  onStaffComplete,
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
