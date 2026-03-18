'use client';

import type { MatrixRow } from '@/types/compliance';

export type MatrixFilter =
  | 'vehicle_doc_incomplete'
  | 'pet_doc_incomplete'
  | 'insurance_incomplete'
  | 'pet_fee_not_loaded'
  | 'permit_fee_not_loaded'
  | 'permit_not_issued'
  | 'missing_submission';

interface MatrixFilterBarProps {
  activeFilters: Set<MatrixFilter>;
  onToggleFilter: (filter: MatrixFilter) => void;
  onClearFilters: () => void;
  rows: MatrixRow[];
}

const FILTER_DEFS: Array<{ id: MatrixFilter; label: string; countFn: (rows: MatrixRow[]) => number }> = [
  {
    id: 'vehicle_doc_incomplete',
    label: 'Vehicle Doc',
    countFn: (rows) => rows.filter(r => r.has_vehicle && !r.vehicle_addendum_uploaded_to_appfolio && !r.missing).length,
  },
  {
    id: 'pet_doc_incomplete',
    label: 'Pet Doc',
    countFn: (rows) => rows.filter(r => r.has_pets && !r.pet_addendum_uploaded_to_appfolio && !r.missing).length,
  },
  {
    id: 'insurance_incomplete',
    label: 'Insurance',
    countFn: (rows) => rows.filter(r => r.has_insurance && !r.insurance_uploaded_to_appfolio && !r.missing).length,
  },
  {
    id: 'pet_fee_not_loaded',
    label: 'Pet Fee',
    countFn: (rows) => rows.filter(r => r.has_pets && !r.pet_fee_added_to_appfolio && !r.missing).length,
  },
  {
    id: 'permit_fee_not_loaded',
    label: 'Permit Fee',
    countFn: (rows) => rows.filter(r => r.has_vehicle && !r.permit_fee_added_to_appfolio && !r.missing).length,
  },
  {
    id: 'permit_not_issued',
    label: 'Permit',
    countFn: (rows) => rows.filter(r => r.has_vehicle && !r.permit_issued && !r.missing).length,
  },
  {
    id: 'missing_submission',
    label: 'Missing',
    countFn: (rows) => rows.filter(r => r.missing).length,
  },
];

/** Apply active filters to rows (OR logic — show row if any active filter matches) */
export function applyMatrixFilters(rows: MatrixRow[], activeFilters: Set<MatrixFilter>): MatrixRow[] {
  if (activeFilters.size === 0) return rows;

  return rows.filter(row => {
    for (const f of activeFilters) {
      switch (f) {
        case 'vehicle_doc_incomplete':
          if (row.has_vehicle && !row.vehicle_addendum_uploaded_to_appfolio && !row.missing) return true;
          break;
        case 'pet_doc_incomplete':
          if (row.has_pets && !row.pet_addendum_uploaded_to_appfolio && !row.missing) return true;
          break;
        case 'insurance_incomplete':
          if (row.has_insurance && !row.insurance_uploaded_to_appfolio && !row.missing) return true;
          break;
        case 'pet_fee_not_loaded':
          if (row.has_pets && !row.pet_fee_added_to_appfolio && !row.missing) return true;
          break;
        case 'permit_fee_not_loaded':
          if (row.has_vehicle && !row.permit_fee_added_to_appfolio && !row.missing) return true;
          break;
        case 'permit_not_issued':
          if (row.has_vehicle && !row.permit_issued && !row.missing) return true;
          break;
        case 'missing_submission':
          if (row.missing) return true;
          break;
      }
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
