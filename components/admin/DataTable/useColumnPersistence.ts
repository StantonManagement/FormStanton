'use client';

import { useEffect } from 'react';

export function loadPersistedColumns(ns: string): { cols: string[] | null; pageSize: number | null } {
  if (typeof window === 'undefined') return { cols: null, pageSize: null };
  try {
    const colsRaw = localStorage.getItem(`datatable.${ns}.cols`);
    const pageSizeRaw = localStorage.getItem(`datatable.${ns}.pageSize`);
    const cols = colsRaw ? (JSON.parse(colsRaw) as string[]) : null;
    const pageSize = pageSizeRaw ? parseInt(pageSizeRaw, 10) : null;
    return { cols, pageSize: pageSize && !isNaN(pageSize) ? pageSize : null };
  } catch {
    return { cols: null, pageSize: null };
  }
}

export function useColumnPersistence(
  ns: string,
  columnOrder: string[],
  columnVisibility: Record<string, boolean>,
  pageSize: number,
  urlHasCols: boolean
): void {
  useEffect(() => {
    if (urlHasCols) return;
    try {
      const visible = columnOrder.filter((id) => columnVisibility[id] !== false);
      localStorage.setItem(`datatable.${ns}.cols`, JSON.stringify(visible));
    } catch {
    }
  }, [ns, columnOrder, columnVisibility, urlHasCols]);

  useEffect(() => {
    try {
      localStorage.setItem(`datatable.${ns}.pageSize`, String(pageSize));
    } catch {
    }
  }, [ns, pageSize]);
}
