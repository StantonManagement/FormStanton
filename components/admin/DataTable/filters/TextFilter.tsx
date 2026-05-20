'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Search, X } from 'lucide-react';

type TextFilterProps = {
  columnId: string;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
};

export function TextFilter({ value, onChange, onClose, triggerRef }: TextFilterProps) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
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

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      onChange(draft);
      onClose();
      triggerRef.current?.focus();
    }
  }

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Text filter"
      className="absolute top-full left-0 mt-1 z-50 bg-white border border-[var(--border)] shadow-md p-2 min-w-[200px]"
    >
      <div className="flex items-center gap-1 border border-[var(--border)] px-2">
        <Search className="w-3.5 h-3.5 text-[var(--muted)] flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Filter…"
          className="py-1.5 text-sm bg-transparent outline-none w-full text-[var(--ink)] placeholder:text-[var(--muted)]"
        />
        {draft && (
          <button
            onClick={() => { setDraft(''); onChange(''); }}
            className="text-[var(--muted)] hover:text-[var(--ink)] flex-shrink-0"
            aria-label="Clear filter"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="flex gap-1.5 mt-2">
        <button
          onClick={() => { onChange(draft); onClose(); triggerRef.current?.focus(); }}
          className="flex-1 px-3 py-1 bg-[var(--primary)] text-white text-xs rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out"
        >
          Apply
        </button>
        <button
          onClick={() => { setDraft(''); onChange(''); onClose(); triggerRef.current?.focus(); }}
          className="flex-1 px-3 py-1 border border-[var(--border)] text-xs rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
