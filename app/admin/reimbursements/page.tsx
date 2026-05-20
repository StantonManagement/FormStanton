'use client';

import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { Trash2 } from 'lucide-react';
import { ReimbursementSubmission } from '@/lib/types';
import {
  DataTable,
  type ColumnDef,
  DateCell,
  MoneyCell,
  BadgeCell,
  MonoCell,
} from '@/components/admin/DataTable';

export default function ReimbursementsPage() {
  const [reimbursements, setReimbursements] = useState<ReimbursementSubmission[]>([]);
  const [buildings, setBuildings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    void fetchReimbursements();
    void fetchBuildings();
  }, []);

  const fetchReimbursements = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/reimbursements');
      const data = await response.json();
      if (data.success) setReimbursements(data.data);
    } catch (error) {
      console.error('Failed to fetch reimbursements:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBuildings = async () => {
    try {
      const response = await fetch('/api/admin/buildings');
      const data = await response.json();
      if (data.success) setBuildings(data.data);
    } catch (error) {
      console.error('Failed to fetch buildings:', error);
    }
  };

  const handleDeleteReimbursement = async (id: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch('/api/admin/reimbursements', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const data = await res.json();
      if (data.success) {
        setReimbursements(prev => prev.filter(r => r.id !== id));
      }
    } catch (e) { console.error('Delete failed:', e); }
    setIsDeleting(false);
    setDeleteConfirm(null);
  };

  const buildingFilterOptions = useMemo(() => {
    const fromState = buildings.length > 0 ? buildings : reimbursements.map((r) => r.building_address);
    return Array.from(new Set(fromState.filter(Boolean))).map((value) => ({ value, label: value }));
  }, [buildings, reimbursements]);

  const columns = useMemo<ColumnDef<ReimbursementSubmission>[]>(
    () => [
      {
        id: 'created_at',
        accessorKey: 'created_at',
        header: 'Date',
        enableSorting: true,
        enableFiltering: true,
        meta: {
          filter: { type: 'dateRange' },
          csvValue: (row) => row.created_at,
        },
        cell: ({ value }) => <DateCell value={value as string} />, 
      },
      {
        id: 'tenant_name',
        accessorKey: 'tenant_name',
        header: 'Tenant',
        enableSorting: true,
        enableFiltering: true,
        meta: {
          filter: { type: 'text' },
          csvValue: (row) => row.tenant_name,
        },
      },
      {
        id: 'phone',
        accessorKey: 'phone',
        header: 'Phone',
        enableFiltering: true,
        meta: {
          filter: { type: 'text' },
          csvValue: (row) => row.phone,
          className: 'whitespace-nowrap',
        },
        cell: ({ value }) => <MonoCell value={value as string} />, 
      },
      {
        id: 'email',
        accessorKey: 'email',
        header: 'Email',
        enableFiltering: true,
        meta: {
          filter: { type: 'text' },
          csvValue: (row) => row.email,
        },
      },
      {
        id: 'building_address',
        accessorKey: 'building_address',
        header: 'Building',
        enableSorting: true,
        enableFiltering: buildingFilterOptions.length > 0,
        meta: {
          filter: buildingFilterOptions.length > 0 ? { type: 'select', options: buildingFilterOptions } : undefined,
          csvValue: (row) => row.building_address,
        },
      },
      {
        id: 'unit_number',
        accessorKey: 'unit_number',
        header: 'Unit',
        enableSorting: true,
        enableFiltering: true,
        meta: {
          filter: { type: 'text' },
          csvValue: (row) => row.unit_number,
        },
        cell: ({ value }) => <MonoCell value={value as string} />, 
      },
      {
        id: 'total_amount',
        accessorKey: 'total_amount',
        header: 'Amount',
        enableSorting: true,
        meta: {
          align: 'right',
          csvValue: (row) => row.total_amount.toFixed(2),
        },
        cell: ({ value }) => <MoneyCell value={Number(value)} />, 
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        enableFiltering: true,
        meta: {
          filter: {
            type: 'select',
            options: [
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'denied', label: 'Denied' },
            ],
          },
          csvValue: (row) => row.status,
        },
        cell: ({ value }) => {
          const status = value as ReimbursementSubmission['status'];
          const variant = status === 'approved' ? 'green' : status === 'denied' ? 'red' : 'amber';
          const label = status.charAt(0).toUpperCase() + status.slice(1);
          return <BadgeCell value={status} variant={variant} label={label} />;
        },
      },
      {
        id: 'urgency',
        accessorKey: 'urgency',
        header: 'Urgency',
        enableFiltering: true,
        meta: {
          filter: {
            type: 'select',
            options: [
              { value: 'normal', label: 'Normal' },
              { value: 'urgent', label: 'Urgent' },
            ],
          },
          csvValue: (row) => row.urgency,
        },
        cell: ({ value }) => {
          const urgency = value as string;
          const variant = urgency === 'urgent' ? 'red' : 'gray';
          const label = urgency === 'urgent' ? 'Urgent' : 'Normal';
          return <BadgeCell value={urgency} variant={variant} label={label} />;
        },
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        meta: {
          align: 'center',
          className: 'w-16',
          csvValue: () => '',
        },
        cell: ({ row }) => (
          <button
            onClick={(event) => {
              event.stopPropagation();
              setDeleteConfirm({ id: row.id, name: row.tenant_name });
            }}
            className="inline-flex items-center justify-center text-[var(--muted)] hover:text-[var(--error)] transition-colors"
            title="Delete reimbursement"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ),
      },
    ],
    [buildingFilterOptions]
  );

  return (
    <>
      <Head>
        <title>Reimbursement Requests - Stanton Management</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-serif text-[var(--primary)]">Reimbursement Requests</h1>
          <p className="text-sm text-[var(--muted)]">
            Track tenant reimbursement submissions. Use column filters or global search to narrow the list.
          </p>
          <span className="text-xs text-[var(--muted)]">
            {reimbursements.length === 1 ? '1 request loaded' : `${reimbursements.length} requests loaded`}
          </span>
        </header>

        <div className="bg-white border border-[var(--border)]">
          <DataTable<ReimbursementSubmission>
            data={reimbursements}
            columns={columns}
            urlNamespace="reimbursements"
            getRowId={(row) => row.id}
            loading={loading}
            enableGlobalSearch={true}
            enableColumnFilters={true}
            enableColumnVisibility={true}
            enableCsvExport={true}
            emptyState={<div className="py-12 text-center text-sm text-[var(--muted)]">No reimbursement requests found.</div>}
          />
        </div>

        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white border border-[var(--border)] w-full max-w-md p-6">
              <h3 className="text-lg font-serif text-[var(--primary)] mb-2">Delete reimbursement?</h3>
              <p className="text-sm text-[var(--muted)] mb-4">
                This will remove the reimbursement request submitted by <strong>{deleteConfirm.name}</strong>. This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 border border-[var(--border)] text-sm text-[var(--ink)] rounded-none hover:bg-[var(--bg-section)] transition-colors disabled:opacity-50"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteReimbursement(deleteConfirm.id)}
                  className="px-4 py-2 bg-red-700 text-white text-sm font-medium rounded-none hover:bg-red-800 transition-colors disabled:opacity-50"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
