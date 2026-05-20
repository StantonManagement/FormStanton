'use client';

import { Download } from 'lucide-react';
import type { ColumnDef } from '../types';

type CsvExportButtonProps<TRow> = {
  namespace: string;
  columns: ColumnDef<TRow>[];
  rows: TRow[];
  visibleColumnIds: string[];
};

function escapeCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function getHeaderLabel<TRow>(col: ColumnDef<TRow>): string {
  if (typeof col.header === 'string') return col.header;
  return col.id;
}

function getCellValue<TRow>(col: ColumnDef<TRow>, row: TRow): string {
  if (col.meta?.csvValue) return col.meta.csvValue(row);
  const key = col.accessorKey as keyof TRow | undefined;
  if (key) {
    const val = row[key];
    return val !== null && val !== undefined ? String(val) : '';
  }
  return '';
}

export function CsvExportButton<TRow>({ namespace, columns, rows, visibleColumnIds }: CsvExportButtonProps<TRow>) {
  function handleExport() {
    const visible = columns.filter((c) => visibleColumnIds.includes(c.id));
    const headers = visible.map((c) => escapeCell(getHeaderLabel(c))).join(',');
    const dataRows = rows.map((row) =>
      visible.map((c) => escapeCell(getCellValue(c, row))).join(',')
    );
    const csv = [headers, ...dataRows].join('\n');

    const date = new Date().toISOString().slice(0, 10);
    const filename = `${namespace}-${date}.csv`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      aria-label="Export to CSV"
      className="flex items-center gap-1.5 px-2.5 py-1.5 border border-[var(--border)] text-xs text-[var(--ink)] hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out rounded-none"
    >
      <Download className="w-3.5 h-3.5" />
      Export
    </button>
  );
}
