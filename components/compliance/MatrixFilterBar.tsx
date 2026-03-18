'use client';

import type { MatrixRow, DynamicColumn, ProjectMatrixRow } from '@/types/compliance';
import { COMPLIANCE_COLUMNS } from '@/lib/complianceColumns';

export type MatrixFilter = string;

interface MatrixFilterBarProps {
  activeFilters: Set<MatrixFilter>;
  onToggleFilter: (filter: MatrixFilter) => void;
  onClearFilters: () => void;
  rows: MatrixRow[];
  // Project mode (optional — defaults to legacy)
  mode?: 'legacy' | 'project';
  projectColumns?: DynamicColumn[];
  projectRows?: ProjectMatrixRow[];
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

export default function MatrixFilterBar({ activeFilters, onToggleFilter, onClearFilters, rows, mode = 'legacy', projectColumns, projectRows }: MatrixFilterBarProps) {
  // Project mode: generate filter defs from dynamic columns
  if (mode === 'project' && projectColumns && projectRows) {
    const projectFilterDefs = projectColumns.map(col => ({
      id: col.id,
      label: col.label,
      countFn: () => projectRows.filter(r => {
        const s = r.completions[col.id]?.status || 'pending';
        return s !== 'complete' && s !== 'waived';
      }).length,
    }));

    return (
      <div className="flex items-start gap-2 flex-wrap text-xs">
        {projectFilterDefs.map(def => {
          const count = def.countFn();
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

  // Legacy mode (unchanged)
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
