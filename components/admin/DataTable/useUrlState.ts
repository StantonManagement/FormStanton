'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { DataTableState, SortState, FilterState } from './types';

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

function serializeSort(sorting: SortState): string {
  return sorting.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`).join(',');
}

function parseSort(raw: string): SortState {
  if (!raw) return [];
  return raw.split(',').map((part) => {
    const [id, dir] = part.split(':');
    return { id, desc: dir === 'desc' };
  });
}

function serializeFilters(filters: FilterState, ns: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) out[`${ns}.filter.${key}`] = value.join(',');
    } else if (
      typeof value === 'object' &&
      'from' in (value as Record<string, unknown>) &&
      'to' in (value as Record<string, unknown>)
    ) {
      const v = value as { from?: string; to?: string };
      if (v.from || v.to) out[`${ns}.filter.${key}`] = `${v.from ?? ''}:${v.to ?? ''}`;
    } else {
      out[`${ns}.filter.${key}`] = String(value);
    }
  }
  return out;
}

function parseFilterValue(raw: string): unknown {
  if (raw.includes(':') && !raw.startsWith('http')) {
    const [from, to] = raw.split(':');
    return { from, to };
  }
  if (raw.includes(',')) {
    return raw.split(',');
  }
  return raw;
}

export type UrlStateOptions = {
  urlNamespace: string;
  enabled: boolean;
};

export function useUrlState(
  options: UrlStateOptions,
  state: DataTableState,
  setState: (s: Partial<DataTableState>) => void
): void {
  const { urlNamespace: ns, enabled } = options;
  const router = useRouter();
  const searchParams = useSearchParams();
  const mountedRef = useRef(false);
  const prevStateRef = useRef<string>('');

  useEffect(() => {
    if (!enabled) return;
    if (mountedRef.current) return;
    mountedRef.current = true;

    const params = new URLSearchParams(searchParams.toString());
    const update: Partial<DataTableState> = {};

    const search = params.get(`${ns}.search`);
    if (search !== null) update.globalSearch = search;

    const sort = params.get(`${ns}.sort`);
    if (sort !== null) update.sorting = parseSort(sort);

    const page = params.get(`${ns}.page`);
    if (page !== null) {
      const pageIndex = Math.max(0, parseInt(page, 10) - 1);
      update.pagination = { ...state.pagination, pageIndex };
    }

    const pageSize = params.get(`${ns}.pageSize`);
    if (pageSize !== null) {
      const ps = parseInt(pageSize, 10);
      update.pagination = { ...(update.pagination ?? state.pagination), pageSize: isNaN(ps) ? state.pagination.pageSize : ps };
    }

    const cols = params.get(`${ns}.cols`);
    if (cols !== null) {
      const visible = cols.split(',').filter(Boolean);
      update.columnOrder = visible;
      const visibility: Record<string, boolean> = {};
      visible.forEach((c) => { visibility[c] = true; });
      update.columnVisibility = visibility;
    }

    const filters: FilterState = {};
    params.forEach((value, key) => {
      if (key.startsWith(`${ns}.filter.`)) {
        const colId = key.slice(`${ns}.filter.`.length);
        filters[colId] = parseFilterValue(value);
      }
    });
    if (Object.keys(filters).length > 0) update.columnFilters = filters;

    if (Object.keys(update).length > 0) setState(update);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const writeToUrl = useCallback(
    debounce((s: DataTableState) => {
      if (!enabled) return;
      const current = new URLSearchParams(window.location.search);

      const nsKeys: string[] = [];
      current.forEach((_, key) => {
        if (key.startsWith(`${ns}.`)) nsKeys.push(key);
      });
      nsKeys.forEach((k) => current.delete(k));

      if (s.globalSearch) current.set(`${ns}.search`, s.globalSearch);
      if (s.sorting.length > 0) current.set(`${ns}.sort`, serializeSort(s.sorting));

      const filterEntries = serializeFilters(s.columnFilters, ns);
      Object.entries(filterEntries).forEach(([k, v]) => current.set(k, v));

      if (s.pagination.pageIndex > 0) current.set(`${ns}.page`, String(s.pagination.pageIndex + 1));
      if (s.pagination.pageSize !== 50) current.set(`${ns}.pageSize`, String(s.pagination.pageSize));

      if (s.columnOrder.length > 0) {
        const visible = s.columnOrder.filter((id) => s.columnVisibility[id] !== false);
        if (visible.length > 0) current.set(`${ns}.cols`, visible.join(','));
      }

      const newSearch = current.toString();
      const currentSearch = window.location.search.replace(/^\?/, '');
      if (newSearch !== currentSearch) {
        router.replace(`${window.location.pathname}?${newSearch}`, { scroll: false });
      }
    }, 150),
    [ns, enabled, router]
  );

  useEffect(() => {
    if (!enabled || !mountedRef.current) return;
    const key = JSON.stringify(state);
    if (key === prevStateRef.current) return;
    prevStateRef.current = key;
    writeToUrl(state);
  }, [state, writeToUrl, enabled]);
}
