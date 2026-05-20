'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';

type DateRange = { from?: string; to?: string };

type DateRangeFilterProps = {
  columnId: string;
  value: DateRange;
  onChange: (value: DateRange) => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
};

export function DateRangeFilter({ value, onChange, onClose, triggerRef }: DateRangeFilterProps) {
  const [draft, setDraft] = useState<DateRange>(value);
  const popoverRef = useRef<HTMLDivElement>(null);
  const fromRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fromRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, triggerRef]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current !== e.target
      ) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose, triggerRef]);

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      onChange(draft);
      onClose();
      triggerRef.current?.focus();
    }
  }

  const inputClass =
    'w-full px-2 py-1.5 border border-[var(--border)] rounded-none text-sm text-[var(--ink)] outline-none focus:ring-1 focus:ring-[var(--primary)]/30';

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Date range filter"
      className="absolute top-full left-0 mt-1 z-50 bg-white border border-[var(--border)] shadow-md p-3 min-w-[230px]"
      onKeyDown={handleKeyDown}
    >
      <div className="space-y-2">
        <div>
          <label className="block text-[10px] font-medium text-[var(--muted)] uppercase tracking-wide mb-0.5">From</label>
          <input
            ref={fromRef}
            type="date"
            value={draft.from ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[var(--muted)] uppercase tracking-wide mb-0.5">To</label>
          <input
            type="date"
            value={draft.to ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
            className={inputClass}
          />
        </div>
      </div>
      <div className="flex gap-1.5 mt-2">
        <button
          onClick={() => { onChange(draft); onClose(); triggerRef.current?.focus(); }}
          className="flex-1 px-3 py-1 bg-[var(--primary)] text-white text-xs rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out"
        >
          Apply
        </button>
        <button
          onClick={() => { setDraft({}); onChange({}); onClose(); triggerRef.current?.focus(); }}
          className="flex-1 px-3 py-1 border border-[var(--border)] text-xs rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
