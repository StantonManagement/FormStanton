'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  DataTable,
  type ColumnDef,
  DateCell,
  MonoCell,
} from '@/components/admin/DataTable';

interface QueueRow {
  application_id: string;
  tenant_name: string;
  building: string;
  unit: string;
  field_name: string;
  appfolio_value: string | null;
  pbv_value: string | null;
  confirmed_at: string | null;
}

const FIELD_LABELS: Record<string, string> = {
  phone: 'Phone',
  preferred_language: 'Preferred Language',
};

function formatFieldName(value: string): string {
  if (!value) return '—';
  if (FIELD_LABELS[value]) return FIELD_LABELS[value];
  return value
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export default function AppfolioQueuePage() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const response = await fetch('/api/admin/pbv/appfolio-queue');
        const payload = await response.json();
        if (!payload.success) {
          throw new Error(payload.message || 'Failed to load queue');
        }
        if (isMounted) {
          setRows(payload.data ?? []);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load queue');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const columns = useMemo<ColumnDef<QueueRow>[]>(() => {
    const fieldOptions = Array.from(new Set(rows.map((row) => row.field_name).filter(Boolean))).map((value) => ({
      value,
      label: formatFieldName(value),
    }));

    return [
      {
        id: 'tenant_name',
        accessorKey: 'tenant_name',
        header: 'Tenant',
        enableFiltering: true,
        meta: { filter: { type: 'text' } },
      },
      {
        id: 'building',
        accessorKey: 'building',
        header: 'Building',
        enableFiltering: true,
        meta: { filter: { type: 'text' } },
      },
      {
        id: 'unit',
        accessorKey: 'unit',
        header: 'Unit',
        enableFiltering: true,
        meta: { filter: { type: 'text' } },
      },
      {
        id: 'field_name',
        header: 'Field',
        enableFiltering: true,
        meta: {
          filter: fieldOptions.length > 0
            ? { type: 'select', options: fieldOptions }
            : undefined,
          csvValue: (row: QueueRow) => formatFieldName(row.field_name),
        },
        cell: ({ row }) => (
          <span className="text-sm text-[var(--ink)]">{formatFieldName(row.field_name)}</span>
        ),
      },
      {
        id: 'appfolio_value',
        accessorKey: 'appfolio_value',
        header: 'AppFolio Value',
        cell: ({ value }) => <MonoCell value={(value as string | null) ?? '—'} />,
        meta: {
          csvValue: (row: QueueRow) => row.appfolio_value ?? '',
        },
      },
      {
        id: 'pbv_value',
        accessorKey: 'pbv_value',
        header: 'PBV Value',
        cell: ({ value }) => (
          <span className="text-sm font-medium text-[var(--accent)]">
            {(value as string | null) ?? '—'}
          </span>
        ),
        meta: {
          csvValue: (row: QueueRow) => row.pbv_value ?? '',
        },
      },
      {
        id: 'confirmed_at',
        accessorKey: 'confirmed_at',
        header: 'Confirmed',
        enableSorting: true,
        cell: ({ value }) => <DateCell value={(value as string | null) ?? undefined} />,
        meta: {
          csvValue: (row: QueueRow) => row.confirmed_at ?? '',
        },
      },
    ];
  }, [rows]);

  return (
    <div className="bg-[var(--paper)] min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-serif text-[var(--primary)]">PBV AppFolio Update Queue</h1>
            <p className="text-sm text-[var(--muted)]">
              Tenants submitted updated contact information via PBV. Confirm and sync to AppFolio at closeout.
            </p>
          </div>
          <Link
            href="/admin/pbv/pipeline"
            className="text-sm text-[var(--accent)] underline decoration-1 underline-offset-2"
          >
            ← Back to Pipeline
          </Link>
        </header>

        {error && (
          <div className="border border-red-200 bg-red-50 text-sm text-red-700 px-4 py-3">
            {error}
          </div>
        )}

        <div className="bg-white border border-[var(--border)]">
          <DataTable<QueueRow>
            data={rows}
            columns={columns}
            urlNamespace="appfolio-queue"
            getRowId={(row) => `${row.application_id}-${row.field_name}`}
            loading={loading}
            enableColumnFilters={true}
            enableGlobalSearch={true}
            enableColumnVisibility={true}
            enableCsvExport={true}
            emptyState={
              <div className="py-12 text-center text-sm text-[var(--muted)]">
                All contact information is already synchronized with AppFolio.
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}
