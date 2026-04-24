'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight, X } from 'lucide-react';
import { allNavItems } from '@/lib/adminNav';

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const filtered = query.trim()
    ? allNavItems.filter((item) => {
        const q = query.toLowerCase();
        return (
          item.label.toLowerCase().includes(q) ||
          item.section.toLowerCase().includes(q) ||
          item.keywords?.some((k) => k.includes(q))
        );
      })
    : allNavItems;

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIdx(0);
  }, []);

  const go = useCallback(
    (href: string) => {
      router.push(href);
      close();
    },
    [router, close]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('openCommandPalette', handler);
    return () => window.removeEventListener('openCommandPalette', handler);
  }, []);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (filtered[activeIdx]) go(filtered[activeIdx].href);
    } else if (e.key === 'Escape') {
      close();
    }
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={close}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 w-full max-w-xl bg-white shadow-2xl border border-[var(--border)] flex flex-col"
        style={{ maxHeight: '70vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--divider)]">
          <Search className="w-4 h-4 text-[var(--muted)] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search pages and tools..."
            className="flex-1 bg-transparent text-sm text-[var(--ink)] placeholder:text-[var(--muted)] outline-none"
          />
          <button
            onClick={close}
            className="p-1 hover:bg-[var(--bg-section)] rounded-none transition-colors"
          >
            <X className="w-4 h-4 text-[var(--muted)]" />
          </button>
        </div>

        <ul ref={listRef} className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-sm text-center text-[var(--muted)]">
              No results for &ldquo;{query}&rdquo;
            </li>
          ) : (
            filtered.map((item, idx) => (
              <li key={item.href}>
                <button
                  className={`w-full text-left flex items-center justify-between px-4 py-3 transition-colors ${
                    idx === activeIdx
                      ? 'bg-[var(--bg-section)]'
                      : 'hover:bg-[var(--bg-section)]'
                  }`}
                  onClick={() => go(item.href)}
                  onMouseEnter={() => setActiveIdx(idx)}
                >
                  <div>
                    <div className="text-sm font-medium text-[var(--ink)]">{item.label}</div>
                    <div className="text-xs text-[var(--muted)]">{item.section}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--muted)] shrink-0" />
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="px-4 py-2 border-t border-[var(--divider)] flex items-center gap-4 text-[10px] text-[var(--muted)]">
          <span>
            <kbd className="font-mono bg-[var(--bg-section)] px-1">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="font-mono bg-[var(--bg-section)] px-1">↵</kbd> go
          </span>
          <span>
            <kbd className="font-mono bg-[var(--bg-section)] px-1">Esc</kbd> close
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
