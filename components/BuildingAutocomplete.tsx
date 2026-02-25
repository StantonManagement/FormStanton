'use client';

import { useState, useRef, useEffect, useMemo } from 'react';

interface BuildingAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  buildings: string[];
  placeholder?: string;
  required?: boolean;
}

export default function BuildingAutocomplete({ value, onChange, buildings, placeholder = '-- Search your building --', required }: BuildingAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return buildings;
    const q = query.toLowerCase();
    return buildings.filter(b => b.toLowerCase().includes(q));
  }, [query, buildings]);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        // If the current query doesn't match a valid building, reset
        if (!buildings.includes(query)) {
          setQuery(value);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [query, value, buildings]);

  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement;
      if (item) item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  const selectBuilding = (building: string) => {
    setQuery(building);
    onChange(building);
    setIsOpen(false);
    setHighlightIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex(prev => (prev < filtered.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex(prev => (prev > 0 ? prev - 1 : filtered.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIndex >= 0 && filtered[highlightIndex]) {
          selectBuilding(filtered[highlightIndex]);
        } else if (filtered.length === 1) {
          selectBuilding(filtered[0]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightIndex(-1);
        break;
    }
  };

  return (
    <div ref={wrapperRef} className="relative mt-1">
      <input
        type="text"
        value={query}
        required={required}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
          setHighlightIndex(-1);
          // Clear selection if user edits
          if (value && e.target.value !== value) {
            onChange('');
          }
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        className="block w-full rounded-none border border-[var(--border)] bg-[var(--bg-input)] text-[var(--ink)] px-4 py-3 pr-10 text-base focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200"
        autoComplete="off"
      />
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
        <svg className="h-5 w-5 text-[var(--muted)]" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </div>

      {isOpen && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-sm border border-[var(--border)] bg-white shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-[var(--muted)]">No buildings found</li>
          ) : (
            filtered.map((building, idx) => (
              <li
                key={building}
                onMouseDown={() => selectBuilding(building)}
                onMouseEnter={() => setHighlightIndex(idx)}
                className={`cursor-pointer px-4 py-2.5 text-sm transition-colors ${
                  building === value
                    ? 'bg-[var(--primary)] text-white'
                    : idx === highlightIndex
                    ? 'bg-blue-50 text-[var(--ink)]'
                    : 'text-[var(--ink)] hover:bg-gray-50'
                }`}
              >
                {building}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
