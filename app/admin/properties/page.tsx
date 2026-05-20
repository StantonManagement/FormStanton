/**
 * Properties Admin Page
 * 
 * Lists all properties with their configuration status.
 * Allows adding/editing properties for signing packet configuration.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Edit, Building, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import FormButton from '@/components/form/FormButton';
import {
  DataTable,
  type ColumnDef,
  BadgeCell,
  DateCell,
  MonoCell,
} from '@/components/admin/DataTable';

interface Property {
  id: string;
  address: string;
  year_built?: number | null;
  required_addenda: Array<{
    slug: string;
    label: string;
    signing_party: string;
    required: boolean;
    plain_language_description?: string;
  }>;
  created_at: string;
  updated_at: string;
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      const response = await fetch('/api/admin/properties');
      if (!response.ok) {
        throw new Error('Failed to fetch properties');
      }
      const data = await response.json();
      setProperties(data.properties || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const hasConfigGaps = (property: Property) => {
    return property.year_built === null || property.year_built === undefined;
  };

  type PropertyRow = Property & {
    config_status: 'config_gaps' | 'complete';
    addenda_count: number;
  };

  const tableRows = useMemo<PropertyRow[]>(
    () =>
      properties.map((property) => ({
        ...property,
        config_status: hasConfigGaps(property) ? 'config_gaps' : 'complete',
        addenda_count: property.required_addenda?.length ?? 0,
      })),
    [properties]
  );

  const columns = useMemo<ColumnDef<PropertyRow>[]>(
    () => [
      {
        id: 'address',
        accessorKey: 'address',
        header: 'Building Address',
        enableSorting: true,
        enableFiltering: true,
        meta: {
          filter: { type: 'text' },
          csvValue: (row) => row.address,
        },
        cell: ({ value }) => (
          <span className="text-sm font-medium text-[var(--ink)]">{value as string}</span>
        ),
      },
      {
        id: 'year_built',
        accessorKey: 'year_built',
        header: 'Year Built',
        enableSorting: true,
        meta: {
          csvValue: (row) => (row.year_built ? String(row.year_built) : ''),
        },
        cell: ({ value }) =>
          value ? (
            <MonoCell value={String(value)} />
          ) : (
            <span className="text-sm italic text-[var(--muted)]">Not set</span>
          ),
      },
      {
        id: 'addenda_count',
        accessorKey: 'addenda_count',
        header: 'Required Addenda',
        enableSorting: true,
        meta: {
          csvValue: (row) => String(row.addenda_count),
        },
        cell: ({ row }) => (
          <span className="text-sm text-[var(--ink)]">{row.addenda_count} addenda</span>
        ),
      },
      {
        id: 'config_status',
        accessorKey: 'config_status',
        header: 'Status',
        enableFiltering: true,
        meta: {
          filter: {
            type: 'select',
            options: [
              { value: 'complete', label: 'Complete' },
              { value: 'config_gaps', label: 'Config gaps' },
            ],
          },
          csvValue: (row) => (row.config_status === 'config_gaps' ? 'Config gaps' : 'Complete'),
        },
        cell: ({ row }) =>
          row.config_status === 'config_gaps' ? (
            <BadgeCell value="config_gaps" variant="yellow" label="Config gaps" />
          ) : (
            <BadgeCell value="complete" variant="green" label="Complete" />
          ),
      },
      {
        id: 'updated_at',
        accessorKey: 'updated_at',
        header: 'Updated',
        enableSorting: true,
        meta: {
          csvValue: (row) => row.updated_at,
        },
        cell: ({ value }) => <DateCell value={value as string} />,
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        enableHiding: false,
        meta: {
          align: 'right',
          className: 'whitespace-nowrap',
          csvValue: () => '',
        },
        cell: ({ row }) => (
          <Link
            href={`/admin/properties/${row.id}/edit`}
            className="inline-flex items-center gap-2 text-sm text-[var(--accent)] hover:text-[var(--primary)] transition-colors"
          >
            <Edit className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wide">Edit</span>
          </Link>
        ),
      },
    ],
    []
  );

  const hasAnyConfigGaps = useMemo(
    () => tableRows.some((property) => property.config_status === 'config_gaps'),
    [tableRows]
  );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-serif text-[var(--primary)]">Properties</h1>
          <p className="text-sm text-[var(--muted)]">
            Configure building metadata for signing packet templates.
          </p>
        </div>
        <Link href="/admin/properties/new">
          <FormButton>
            <Plus className="h-4 w-4 mr-2" />
            Add Property
          </FormButton>
        </Link>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white border border-[var(--border)]">
        <DataTable<PropertyRow>
          data={tableRows}
          columns={columns}
          urlNamespace="properties"
          getRowId={(row) => row.id}
          loading={loading}
          enableGlobalSearch={true}
          enableColumnFilters={true}
          enableColumnVisibility={true}
          enableCsvExport={true}
          emptyState={
            <div className="py-16 flex flex-col items-center gap-4 text-center">
              <Building className="h-12 w-12 text-[var(--muted)]" />
              <div className="space-y-1">
                <h3 className="text-base font-medium text-[var(--ink)]">No properties configured</h3>
                <p className="text-sm text-[var(--muted)]">Add your first property to configure signing packet templates.</p>
              </div>
              <Link href="/admin/properties/new">
                <FormButton>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Property
                </FormButton>
              </Link>
            </div>
          }
        />
      </div>

      {hasAnyConfigGaps && (
        <div className="bg-amber-50 border border-amber-200 px-4 py-4 flex gap-3 items-start">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-amber-900">Configuration gaps detected</h3>
            <p className="text-sm text-amber-800">
              Some properties are missing required information (e.g., year built). This may affect conditional logic in signing packet templates.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
