'use client';

import { useState, useRef, useEffect } from 'react';
import { Check, X } from 'lucide-react';

type SelectOption = { label: string; value: string };

type SelectFilterProps = {
  columnId: string;
  options: SelectOption[];
  multi?: boolean;
  value: string | string[];
  onChange: (value: string | string[]) => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
};

export function SelectFilter({ options, multi = false, value, onChange, onClose, triggerRef }: SelectFilterProps) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const [draft, setDraft] = useState<string[]>(selected);
  const popoverRef = useRef<HTMLDivElement>(null);

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

  function toggle(v: string) {
    if (multi) {
      setDraft((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);
    } else {
      const next = draft.includes(v) ? [] : [v];
      setDraft(next);
      onChange(next.length === 0 ? '' : next[0]);
      onClose();
      triggerRef.current?.focus();
    }
  }

  function apply() {
    onChange(multi ? draft : draft[0] ?? '');
    onClose();
    triggerRef.current?.focus();
  }

  function clear() {
    setDraft([]);
    onChange(multi ? [] : '');
    onClose();
    triggerRef.current?.focus();
  }

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Select filter"
      className="absolute top-full left-0 mt-1 z-50 bg-white border border-[var(--border)] shadow-md min-w-[180px] max-h-60 overflow-y-auto"
    >
      <div className="border-b border-[var(--divider)]">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => toggle(opt.value)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-[var(--bg-section)] transition-colors duration-150 text-left"
          >
            <span className="text-[var(--ink)]">{opt.label}</span>
            {draft.includes(opt.value) && <Check className="w-3.5 h-3.5 text-[var(--primary)] flex-shrink-0" />}
          </button>
        ))}
      </div>
      {multi && (
        <div className="flex gap-1.5 p-2">
          <button
            onClick={apply}
            className="flex-1 px-3 py-1 bg-[var(--primary)] text-white text-xs rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out"
          >
            Apply
          </button>
          <button
            onClick={clear}
            className="px-2 py-1 border border-[var(--border)] text-xs rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out"
            aria-label="Clear filter"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
