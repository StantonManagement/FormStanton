'use client';

import { useState, useRef, useEffect, useMemo } from 'react';

interface Tenant {
  full_name: string;
  phone: string;
  email: string;
  building_address: string;
  unit_number: string;
}

interface TenantAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectTenant: (tenant: Tenant) => void;
  placeholder?: string;
  required?: boolean;
}

export default function TenantAutocomplete({ 
  value, 
  onChange, 
  onSelectTenant, 
  placeholder = 'Start typing tenant name...', 
  required 
}: TenantAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement;
      if (item) item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  const searchTenants = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setTenants([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/lookup?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      if (data.success) {
        setTenants(data.results || []);
        setIsOpen(true);
      }
    } catch (error) {
      console.error('Search error:', error);
      setTenants([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputChange = (newValue: string) => {
    setQuery(newValue);
    onChange(newValue);
    setHighlightIndex(-1);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      searchTenants(newValue);
    }, 300);
  };

  const selectTenant = (tenant: Tenant) => {
    setQuery(tenant.full_name);
    onChange(tenant.full_name);
    onSelectTenant(tenant);
    setIsOpen(false);
    setHighlightIndex(-1);
    setTenants([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || tenants.length === 0) {
      if (e.key === 'ArrowDown' && tenants.length > 0) {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex(prev => (prev < tenants.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex(prev => (prev > 0 ? prev - 1 : tenants.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIndex >= 0 && tenants[highlightIndex]) {
          selectTenant(tenants[highlightIndex]);
        } else if (tenants.length === 1) {
          selectTenant(tenants[0]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightIndex(-1);
        break;
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={query}
        required={required}
        placeholder={placeholder}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => {
          if (tenants.length > 0) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        autoComplete="off"
      />
      {isSearching && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}

      {isOpen && tenants.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-300 bg-white shadow-lg"
        >
          {tenants.map((tenant, idx) => (
            <li
              key={idx}
              onMouseDown={() => selectTenant(tenant)}
              onMouseEnter={() => setHighlightIndex(idx)}
              className={`cursor-pointer px-4 py-2.5 transition-colors ${
                idx === highlightIndex
                  ? 'bg-blue-50 text-gray-900'
                  : 'text-gray-900 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium">{tenant.full_name}</div>
              <div className="text-sm text-gray-600">
                {tenant.building_address} - Unit {tenant.unit_number} • {tenant.phone}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
