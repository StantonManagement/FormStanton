'use client';

import type { MatrixRow } from '@/types/compliance';
import { COMPLIANCE_COLUMNS } from '@/lib/complianceColumns';

export type MatrixFilter = string;

interface MatrixFilterBarProps {
  activeFilters: Set<MatrixFilter>;
  onToggleFilter: (filter: MatrixFilter) => void;
  onClearFilters: () => void;
  rows: MatrixRow[];
}

const FILTER_DEFS: Array<{ id: string; label: string; countFn: (rows: MatrixRow[]) => number }> = [
  ...COMPLIANCE_COLUMNS.map(col => ({
    id: col.id,
    label: col.label,
    countFn: (rows: MatrixRow[]) => rows.filter(r => col.isApplicable(r) && !col.isComplete(r) && !r.missing).length,
  })),
  {
    id: 'missing_submission',
    label: 'Missing',
    countFn: (rows: MatrixRow[]) => rows.filter(r => r.missing).length,
  },
];

/** Apply active filters to rows (OR logic - show row if any active filter matches) */
export function applyMatrixFilters(rows: MatrixRow[], activeFilters: Set<MatrixFilter>): MatrixRow[] {
  if (activeFilters.size === 0) return rows;

  return rows.filter(row => {
    for (const fId of activeFilters) {
      if (fId === 'missing_submission') {
        if (row.missing) return true;
        continue;
      }
      const col = COMPLIANCE_COLUMNS.find(c => c.id === fId);
      if (col && col.isApplicable(row) && !col.isComplete(row) && !row.missing) return true;
    }
    return false;
  });
}

export default function MatrixFilterBar({ activeFilters, onToggleFilter, onClearFilters, rows }: MatrixFilterBarProps) {
  return (
    <div className="flex items-start gap-2 flex-wrap text-xs">
      {FILTER_DEFS.map(def => {
        const count = def.countFn(rows);
        const isActive = activeFilters.has(def.id);
        return (
          <button
            key={def.id}
            onClick={() => onToggleFilter(def.id)}
            disabled={count === 0 && !isActive}
            className={`px-2 py-1 border rounded-none transition-colors duration-200 ease-out disabled:opacity-40 disabled:cursor-not-allowed ${
              isActive
                ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--primary)]/5'
                : 'border-[var(--divider)] text-[var(--muted)] hover:border-[var(--primary)]/50 hover:text-[var(--ink)]'
            }`}
          >
            {def.label}
            {count > 0 && (
              <span className={`ml-1 ${isActive ? 'text-[var(--primary)]' : 'text-[var(--muted)]'}`}>
                ({count})
              </span>
            )}
          </button>
        );
      })}
      {activeFilters.size > 0 && (
        <button
          onClick={onClearFilters}
          className="px-2 py-1 text-[var(--error)] hover:underline transition-colors duration-200 ease-out"
        >
          Clear
        </button>
      )}
    </div>
  );
}
