'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

type GlobalSearchProps = {
  value: string;
  onChange: (value: string) => void;
};

function useDebounce(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function GlobalSearch({ value, onChange }: GlobalSearchProps) {
  const [draft, setDraft] = useState(value);
  const debounced = useDebounce(draft, 200);
  const prevDebouncedRef = useRef(debounced);

  useEffect(() => {
    if (debounced !== prevDebouncedRef.current) {
      prevDebouncedRef.current = debounced;
      onChange(debounced);
    }
  }, [debounced, onChange]);

  useEffect(() => {
    if (value !== draft) {
      setDraft(value);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative flex items-center border border-[var(--border)] bg-white">
      <Search className="absolute left-2.5 w-3.5 h-3.5 text-[var(--muted)]" aria-hidden="true" />
      <input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Search…"
        aria-label="Search table"
        className="pl-8 pr-7 py-1.5 text-sm bg-transparent outline-none w-48 text-[var(--ink)] placeholder:text-[var(--muted)]"
      />
      {draft && (
        <button
          onClick={() => { setDraft(''); onChange(''); }}
          className="absolute right-2 text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
