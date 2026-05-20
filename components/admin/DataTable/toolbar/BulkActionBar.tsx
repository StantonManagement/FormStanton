'use client';

import type { BulkAction } from '../types';

type BulkActionBarProps<TRow> = {
  selectedRows: TRow[];
  actions: BulkAction<TRow>[];
  onClearSelection: () => void;
};

export function BulkActionBar<TRow>({ selectedRows, actions, onClearSelection }: BulkActionBarProps<TRow>) {
  const count = selectedRows.length;
  if (count === 0) return null;

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      aria-live="polite"
      className="sticky top-0 z-40 flex items-center gap-3 px-4 py-2 bg-[var(--primary)] text-white border-b border-[var(--primary-light)]"
    >
      <span className="text-sm font-medium flex-shrink-0">
        {count} row{count !== 1 ? 's' : ''} selected
      </span>
      <div className="flex items-center gap-2 flex-1 flex-wrap">
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={() => action.onClick(selectedRows)}
            className={`px-3 py-1 text-xs font-medium border rounded-none transition-colors duration-200 ease-out ${
              action.variant === 'danger'
                ? 'border-red-300 bg-red-600 text-white hover:bg-red-700'
                : 'border-white/30 bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {action.label}
          </button>
        ))}
      </div>
      <button
        onClick={onClearSelection}
        className="text-xs text-white/70 hover:text-white transition-colors ml-auto flex-shrink-0"
        aria-label="Clear selection"
      >
        Clear
      </button>
    </div>
  );
}
