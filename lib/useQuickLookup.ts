'use client';

import { useState, useEffect, useCallback } from 'react';
import type { TenantSubmission } from '@/types/compliance';

export function useQuickLookup(allSubmissions: TenantSubmission[]) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TenantSubmission[]>([]);

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return; }
    const timer = setTimeout(() => {
      const q = query.toLowerCase();
      const matches = allSubmissions.filter(sub =>
        sub.full_name?.toLowerCase().includes(q) ||
        sub.building_address?.toLowerCase().includes(q) ||
        sub.unit_number?.toLowerCase().includes(q) ||
        sub.phone?.includes(q) ||
        sub.email?.toLowerCase().includes(q)
      );
      setResults(matches.slice(0, 10));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, allSubmissions]);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
  }, []);

  return { query, setQuery, results, clear };
}
