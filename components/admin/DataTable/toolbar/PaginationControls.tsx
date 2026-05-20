'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZES = [25, 50, 100] as const;

type PaginationControlsProps = {
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

export function PaginationControls({
  pageIndex,
  pageSize,
  pageCount,
  total,
  onPageChange,
  onPageSizeChange,
}: PaginationControlsProps) {
  const isAll = pageSize === -1;
  const from = isAll ? 1 : pageIndex * pageSize + 1;
  const to = isAll ? total : Math.min((pageIndex + 1) * pageSize, total);
  const totalPages = isAll ? 1 : pageCount;
  const currentPage = pageIndex + 1;

  return (
    <div className="flex items-center justify-between gap-4 px-1 py-2 text-xs text-[var(--muted)]">
      <div className="flex items-center gap-1.5">
        <span>Rows per page:</span>
        <select
          value={isAll ? 'all' : pageSize}
          onChange={(e) => onPageSizeChange(e.target.value === 'all' ? -1 : parseInt(e.target.value, 10))}
          aria-label="Rows per page"
          className="border border-[var(--border)] px-1.5 py-0.5 text-xs text-[var(--ink)] bg-white rounded-none outline-none focus:ring-1 focus:ring-[var(--primary)]/30"
        >
          {PAGE_SIZES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
          <option value="all">All</option>
        </select>
      </div>

      <span aria-live="polite" aria-atomic="true">
        {total > 0 ? `${from}–${to} of ${total}` : '0 results'}
      </span>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(pageIndex - 1)}
          disabled={pageIndex === 0}
          aria-label="Previous page"
          className="p-1 border border-[var(--border)] disabled:opacity-40 hover:bg-[var(--bg-section)] transition-colors duration-150 rounded-none"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span aria-label={`Page ${currentPage} of ${totalPages}`} className="px-1.5 text-[var(--ink)]">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(pageIndex + 1)}
          disabled={isAll || pageIndex >= totalPages - 1}
          aria-label="Next page"
          className="p-1 border border-[var(--border)] disabled:opacity-40 hover:bg-[var(--bg-section)] transition-colors duration-150 rounded-none"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
