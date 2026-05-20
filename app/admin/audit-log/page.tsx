'use client';

import React from 'react';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DataTable,
  type ColumnDef,
  DateCell,
  BadgeCell,
} from '@/components/admin/DataTable';

interface AuditEntry {
  id: string;
  user_id: string | null;
  username: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, any>;
  ip_address: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Login',
  'auth.login_legacy': 'Login (Legacy)',
  'auth.logout': 'Logout',
  'submission.update': 'Submission Updated',
  'submission.bulk_action': 'Bulk Action',
  'submission.edit': 'Submission Edited',
  'submission.merge': 'Submissions Merged',
  'interaction.create': 'Interaction Created',
  'interaction.delete': 'Interaction Deleted',
  'exemption.review': 'Exemption Reviewed',
  'scan.review': 'Scan Reviewed',
  'vehicle.phone_entry': 'Vehicle Phone Entry',
  'vehicle.approve_additional': 'Additional Vehicle Approved',
  'vehicle.deny_additional': 'Additional Vehicle Denied',
  'permit.issue': 'Permit Issued',
  'permit.pickup': 'Permit Picked Up',
  'receipt.pet_addendum': 'Pet Addendum Received',
  'receipt.vehicle_addendum': 'Vehicle Addendum Received',
  'export.vehicles': 'Vehicles Exported',
  'export.toggle': 'Export Status Toggled',
  'appfolio.document_upload': 'Document Uploaded to AppFolio',
  'appfolio.fee_added': 'Fee Added in AppFolio',
  'tenant.add': 'Tenant Added',
};

const ACTION_COLORS: Record<string, string> = {
  'auth': 'bg-blue-50 text-blue-700 border-blue-200',
  'submission': 'bg-amber-50 text-amber-700 border-amber-200',
  'interaction': 'bg-purple-50 text-purple-700 border-purple-200',
  'exemption': 'bg-rose-50 text-rose-700 border-rose-200',
  'scan': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'vehicle': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'permit': 'bg-green-50 text-green-700 border-green-200',
  'receipt': 'bg-teal-50 text-teal-700 border-teal-200',
  'export': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'appfolio': 'bg-orange-50 text-orange-700 border-orange-200',
  'tenant': 'bg-violet-50 text-violet-700 border-violet-200',
};

function getActionColor(action: string): string {
  const prefix = action.split('.')[0];
  return ACTION_COLORS[prefix] || 'bg-gray-50 text-gray-700 border-gray-200';
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [filterAction, setFilterAction] = useState('');
  const [filterUsername, setFilterUsername] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [tableState, setTableState] = useState({
    sorting: [] as { id: string; desc: boolean }[],
    pagination: { pageIndex: 0, pageSize: 50 },
  });

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(tableState.pagination.pageIndex + 1),
        limit: String(tableState.pagination.pageSize),
      });
      if (filterAction) params.set('action', filterAction);
      if (filterUsername) params.set('username', filterUsername);
      if (tableState.sorting.length > 0) {
        const sort = tableState.sorting[0];
        params.set('sort', `${sort.id}:${sort.desc ? 'desc' : 'asc'}`);
      }

      const res = await fetch(`/api/admin/audit-log?${params}`);
      const data = await res.json();

      if (data.success) {
        setEntries(data.data);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      }
    } catch (err) {
      console.error('Failed to fetch audit log:', err);
    } finally {
      setLoading(false);
    }
  }, [filterAction, filterUsername, tableState]);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  const handleFilter = () => {
    setTableState((prev) => ({ ...prev, pagination: { ...prev.pagination, pageIndex: 0 } }));
    fetchLog();
  };

  const columns = useMemo<ColumnDef<AuditEntry>[]>(
    () => [
      {
        id: 'created_at',
        accessorKey: 'created_at',
        header: 'Time',
        enableSorting: true,
        meta: {
          csvValue: (row) => row.created_at,
        },
        cell: ({ value }) => <DateCell value={value as string} format="datetime" />, 
      },
      {
        id: 'username',
        accessorKey: 'username',
        header: 'User',
        enableSorting: true,
        enableFiltering: true,
        meta: {
          filter: { type: 'text' },
          csvValue: (row) => row.username,
        },
      },
      {
        id: 'action',
        accessorKey: 'action',
        header: 'Action',
        enableSorting: true,
        enableFiltering: true,
        meta: {
          filter: { type: 'text' },
          csvValue: (row) => ACTION_LABELS[row.action] || row.action,
        },
        cell: ({ value }) => (
          <BadgeCell
            value={value as string}
            label={ACTION_LABELS[value as string] || (value as string)}
            variant="blue"
          />
        ),
      },
      {
        id: 'entity',
        header: 'Entity',
        enableSorting: false,
        meta: {
          csvValue: (row) => `${row.entity_type ?? ''}${row.entity_id ? `#${row.entity_id}` : ''}`,
        },
        cell: ({ row }) => (
          row.entity_type ? (
            <span className="text-xs text-[var(--muted)] font-mono">
              {row.entity_type}
              {row.entity_id && <span className="ml-1 opacity-60">#{row.entity_id.slice(0, 8)}</span>}
            </span>
          ) : null
        ),
      },
      {
        id: 'ip_address',
        accessorKey: 'ip_address',
        header: 'IP',
        enableSorting: false,
        meta: {
          csvValue: (row) => row.ip_address ?? '',
          className: 'font-mono text-xs text-[var(--muted)]',
        },
        cell: ({ value }) => <span>{(value as string) ?? '—'}</span>,
      },
    ],
    []
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif text-[var(--primary)]">Audit Log</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {total} total entries
          </p>
        </div>
        <button
          onClick={fetchLog}
          className="px-4 py-2 border border-[var(--border)] text-[var(--primary)] rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out text-sm"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[var(--border)] p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-[var(--muted)] mb-1">Action</label>
          <input
            type="text"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            placeholder="e.g. auth.login"
            className="px-3 py-1.5 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/30 w-48"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--muted)] mb-1">User</label>
          <input
            type="text"
            value={filterUsername}
            onChange={(e) => setFilterUsername(e.target.value)}
            placeholder="e.g. Alex"
            className="px-3 py-1.5 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/30 w-48"
          />
        </div>
        <button
          onClick={handleFilter}
          className="px-4 py-1.5 bg-[var(--primary)] text-white border border-[var(--primary)] rounded-none text-sm hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out"
        >
          Filter
        </button>
        {(filterAction || filterUsername) && (
          <button
            onClick={() => { setFilterAction(''); setFilterUsername(''); setPage(1); }}
            className="px-4 py-1.5 border border-[var(--border)] text-[var(--muted)] rounded-none text-sm hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out"
          >
            Clear
          </button>
        )}
      </div>

      <div className="bg-white border border-[var(--border)] overflow-hidden">
        <DataTable<AuditEntry>
          data={entries}
          columns={columns}
          urlNamespace="audit-log"
          getRowId={(row) => row.id}
          loading={loading}
          enableGlobalSearch={true}
          enableColumnFilters={true}
          enableColumnVisibility={true}
          enableCsvExport={true}
          manualPagination
          manualSorting
          pageCount={totalPages}
          onStateChange={(state) => {
            setTableState((prev) => ({
              sorting: state.sorting ?? prev.sorting,
              pagination: state.pagination ?? prev.pagination,
            }));
          }}
          expandedRowRenderer={(row) => (
            <div className="text-xs font-mono text-[var(--ink)] bg-white border border-[var(--divider)] p-3 space-y-2">
              <pre className="whitespace-pre-wrap">{JSON.stringify(row.details, null, 2)}</pre>
              <div className="flex flex-wrap gap-4 text-[var(--muted)]">
                <span>ID: {row.id}</span>
                {row.user_id && <span>User ID: {row.user_id}</span>}
                <span>Full timestamp: {new Date(row.created_at).toISOString()}</span>
                <span>IP: {row.ip_address ?? '—'}</span>
              </div>
            </div>
          )}
          emptyState={<div className="p-12 text-center text-[var(--muted)]">No audit entries found.</div>}
        />
      </div>
    </div>
  );
}
