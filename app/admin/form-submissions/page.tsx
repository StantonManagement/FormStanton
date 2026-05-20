'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Head from 'next/head';
import FormSubmissionQuickViewModal from '@/components/FormSubmissionQuickViewModal';
import {
  DataTable,
  type ColumnDef,
  BadgeCell,
  DateCell,
} from '@/components/admin/DataTable';
import {
  FormSubmissionStatus,
  FormPriority,
  statusLabels,
  priorityLabels,
  STAFF_MEMBERS,
  getFormTypeInfo,
} from '@/lib/formTypeLabels';

interface FormSubmission {
  id: string;
  form_type: string;
  tenant_name: string | null;
  building_address: string | null;
  unit_number: string | null;
  submitted_at: string;
  status: FormSubmissionStatus;
  assigned_to: string | null;
  priority: FormPriority | null;
  form_data: any;
  review_granularity?: 'atomic' | 'per_document' | null;
}

type QuickView = 'all' | 'my_queue' | 'needs_action' | 'approved_not_sent' | 'ready_for_appfolio' | 'waiting_on_tenant';

type BadgeVariant = NonNullable<Parameters<typeof BadgeCell>[0]['variant']>;

const STATUS_BADGE_VARIANTS: Record<FormSubmissionStatus, BadgeVariant> = {
  pending_review: 'amber',
  under_review: 'blue',
  approved: 'green',
  denied: 'red',
  revision_requested: 'amber',
  sent_to_appfolio: 'indigo',
  completed: 'gray',
};

const PRIORITY_BADGE_VARIANTS: Record<FormPriority, BadgeVariant> = {
  low: 'gray',
  medium: 'blue',
  high: 'red',
};

export default function FormSubmissionsPage() {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [buildings, setBuildings] = useState<string[]>([]);
  const [formTypes, setFormTypes] = useState<string[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBulkActionProcessing, setIsBulkActionProcessing] = useState(false);

  const [selectedRows, setSelectedRows] = useState<FormSubmission[]>([]);
  const [tableKey, setTableKey] = useState(0);

  const [activeQuickView, setActiveQuickView] = useState<QuickView>('all');
  const [filters, setFilters] = useState({
    status: 'all',
    formType: 'all',
    building: 'all',
    startDate: '',
    endDate: '',
    assignedTo: 'all',
    priority: 'all',
    language: 'all',
  });

  const [statusCounts, setStatusCounts] = useState({
    pending_review: 0,
    under_review: 0,
    approved: 0,
    denied: 0,
    revision_requested: 0,
    sent_to_appfolio: 0,
    completed: 0,
  });

  useEffect(() => {
    fetchBuildings();
  }, []);

  useEffect(() => {
    fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, activeQuickView]);

  const fetchSubmissions = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();

      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.formType !== 'all') params.append('formType', filters.formType);
      if (filters.building !== 'all') params.append('building', filters.building);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.assignedTo !== 'all') params.append('assignedTo', filters.assignedTo);
      if (filters.priority !== 'all') params.append('priority', filters.priority);
      if (filters.language !== 'all') params.append('language', filters.language);
      if (activeQuickView !== 'all') params.append('view', activeQuickView);

      const response = await fetch(`/api/admin/form-submissions?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setSubmissions(data.data || []);
        if (data.meta) {
          setStatusCounts(data.meta.statusCounts || {});
          setFormTypes(data.meta.formTypes || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
    } finally {
      setIsLoading(false);
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

  const resetSelection = useCallback(() => {
    setSelectedRows([]);
    setTableKey((k) => k + 1);
  }, []);

  const handleBulkAssign = async (assignee: string) => {
    if (selectedRows.length === 0) return;

    setIsBulkActionProcessing(true);
    try {
      const response = await fetch('/api/admin/form-submissions/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          submissionIds: selectedRows.map((r) => r.id),
          value: assignee,
        }),
      });

      const data = await response.json();
      if (data.success) {
        resetSelection();
        fetchSubmissions();
      }
    } catch (error) {
      console.error('Bulk assign failed:', error);
    } finally {
      setIsBulkActionProcessing(false);
    }
  };

  const handleBulkMarkSentToAppfolio = async () => {
    if (selectedRows.length === 0) return;

    setIsBulkActionProcessing(true);
    try {
      const response = await fetch('/api/admin/form-submissions/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_sent_to_appfolio',
          submissionIds: selectedRows.map((r) => r.id),
        }),
      });

      const data = await response.json();
      if (data.success) {
        resetSelection();
        fetchSubmissions();
      }
    } catch (error) {
      console.error('Bulk mark sent failed:', error);
    } finally {
      setIsBulkActionProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRows.length === 0) return;
    if (!confirm(`Permanently delete ${selectedRows.length} submission(s)? This cannot be undone.`)) return;

    setIsBulkActionProcessing(true);
    try {
      const response = await fetch('/api/admin/form-submissions/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          submissionIds: selectedRows.map((r) => r.id),
        }),
      });

      const data = await response.json();
      if (data.success) {
        resetSelection();
        fetchSubmissions();
      }
    } catch (error) {
      console.error('Bulk delete failed:', error);
    } finally {
      setIsBulkActionProcessing(false);
    }
  };

  const handleBulkExport = async () => {
    const exportIds = selectedRows
      .filter((r) => r.review_granularity === 'per_document')
      .map((r) => r.id);
    if (exportIds.length === 0) return;

    setIsBulkActionProcessing(true);
    try {
      const response = await fetch('/api/admin/submissions/bulk-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionIds: exportIds }),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error((json as any).message || `Export failed (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = response.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? 'bulk_export.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Export failed: ${e.message}`);
    } finally {
      setIsBulkActionProcessing(false);
    }
  };

  const hasPerDocSelection = selectedRows.some(
    (r) => r.review_granularity === 'per_document'
  );

  const columns = useMemo<ColumnDef<FormSubmission>[]>(
    () => [
      {
        id: 'submitted_at',
        accessorKey: 'submitted_at',
        header: 'Date',
        enableSorting: true,
        meta: {
          csvValue: (row) => row.submitted_at,
        },
        cell: ({ row }) => <DateCell value={row.submitted_at} />,
      },
      {
        id: 'form_type',
        accessorKey: 'form_type',
        header: 'Form Type',
        enableSorting: true,
        meta: {
          csvValue: (row) => getFormTypeInfo(row.form_type).label,
        },
        cell: ({ row }) => {
          const info = getFormTypeInfo(row.form_type);
          return (
            <span className={`inline-block rounded-none px-2 py-1 text-xs font-medium ${info.color}`}>
              {info.label}
            </span>
          );
        },
      },
      {
        id: 'tenant_name',
        accessorKey: 'tenant_name',
        header: 'Tenant',
        enableSorting: true,
        meta: {
          csvValue: (row) => row.tenant_name ?? '',
        },
        cell: ({ row }) => (
          <span className="text-sm font-medium text-[var(--ink)]">
            {row.tenant_name || 'Unknown'}
          </span>
        ),
      },
      {
        id: 'building_address',
        accessorKey: 'building_address',
        header: 'Building',
        enableSorting: true,
        meta: {
          csvValue: (row) => row.building_address ?? '',
        },
        cell: ({ row }) => (
          <span className="text-sm text-[var(--muted)]">
            {row.building_address || '\u2014'}
          </span>
        ),
      },
      {
        id: 'unit_number',
        accessorKey: 'unit_number',
        header: 'Unit',
        enableSorting: true,
        meta: {
          csvValue: (row) => row.unit_number ?? '',
        },
        cell: ({ row }) => (
          <span className="text-sm text-[var(--muted)]">
            {row.unit_number || '\u2014'}
          </span>
        ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        enableSorting: true,
        meta: {
          csvValue: (row) => statusLabels[row.status] ?? row.status,
        },
        cell: ({ row }) => (
          <BadgeCell
            value={row.status}
            variant={STATUS_BADGE_VARIANTS[row.status] ?? 'gray'}
            label={statusLabels[row.status] ?? row.status}
          />
        ),
      },
      {
        id: 'assigned_to',
        accessorKey: 'assigned_to',
        header: 'Assigned',
        enableSorting: true,
        meta: {
          csvValue: (row) => row.assigned_to ?? 'Unassigned',
        },
        cell: ({ row }) => (
          <span className="text-sm text-[var(--muted)]">
            {row.assigned_to || 'Unassigned'}
          </span>
        ),
      },
      {
        id: 'priority',
        accessorKey: 'priority',
        header: 'Priority',
        enableSorting: true,
        meta: {
          csvValue: (row) => (row.priority ? priorityLabels[row.priority] : ''),
        },
        cell: ({ row }) =>
          row.priority ? (
            <BadgeCell
              value={row.priority}
              variant={PRIORITY_BADGE_VARIANTS[row.priority]}
              label={priorityLabels[row.priority]}
            />
          ) : null,
      },
    ],
    []
  );

  const quickViews: { id: QuickView; label: string; count?: number }[] = [
    { id: 'all', label: 'All Submissions' },
    { id: 'needs_action', label: 'Needs Action', count: statusCounts.pending_review + statusCounts.revision_requested },
    { id: 'approved_not_sent', label: 'Approved (Not Sent)', count: statusCounts.approved },
    { id: 'ready_for_appfolio', label: 'Ready for Appfolio', count: statusCounts.approved },
    { id: 'waiting_on_tenant', label: 'Waiting on Tenant', count: statusCounts.revision_requested },
  ];

  return (
    <>
      <Head>
        <title>Form Submissions - Stanton Management</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="w-full px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-serif text-[var(--primary)]">Form Submissions</h1>
          <p className="text-sm text-[var(--muted)]">Manage all tenant form submissions with workflow tracking</p>
        </div>

        <div className="mb-6 border-b border-[var(--border)]">
          <nav className="flex space-x-1 overflow-x-auto">
            {quickViews.map((view) => (
              <button
                key={view.id}
                onClick={() => setActiveQuickView(view.id)}
                className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeQuickView === view.id
                    ? 'border-[var(--primary)] text-[var(--primary)]'
                    : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--border)]'
                }`}
              >
                {view.label}
                {view.count !== undefined && (
                  <span
                    className={`ml-2 rounded-none px-2 py-0.5 text-xs ${
                      activeQuickView === view.id
                        ? 'bg-[var(--primary)]/10 text-[var(--primary)]'
                        : 'bg-[var(--bg-section)] text-[var(--muted)]'
                    }`}
                  >
                    {view.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="mb-6 border border-[var(--border)] bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-[var(--ink)]">Filters</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ink)]">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full rounded-none border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/40"
              >
                <option value="all">All Statuses</option>
                <option value="pending_review">Pending Review</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="denied">Denied</option>
                <option value="revision_requested">Revision Requested</option>
                <option value="sent_to_appfolio">Sent to Appfolio</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ink)]">Form Type</label>
              <select
                value={filters.formType}
                onChange={(e) => setFilters({ ...filters, formType: e.target.value })}
                className="w-full rounded-none border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/40"
              >
                <option value="all">All Types</option>
                {formTypes.map((type) => {
                  const typeInfo = getFormTypeInfo(type);
                  return (
                    <option key={type} value={type}>
                      {typeInfo.label}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ink)]">Building</label>
              <select
                value={filters.building}
                onChange={(e) => setFilters({ ...filters, building: e.target.value })}
                className="w-full rounded-none border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/40"
              >
                <option value="all">All Buildings</option>
                {buildings.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ink)]">Assigned To</label>
              <select
                value={filters.assignedTo}
                onChange={(e) => setFilters({ ...filters, assignedTo: e.target.value })}
                className="w-full rounded-none border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/40"
              >
                <option value="all">All</option>
                <option value="unassigned">Unassigned</option>
                {STAFF_MEMBERS.map((member) => (
                  <option key={member} value={member}>
                    {member}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ink)]">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full rounded-none border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/40"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ink)]">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full rounded-none border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/40"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ink)]">Priority</label>
              <select
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                className="w-full rounded-none border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/40"
              >
                <option value="all">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ink)]">Language</label>
              <select
                value={filters.language}
                onChange={(e) => setFilters({ ...filters, language: e.target.value })}
                className="w-full rounded-none border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/40"
              >
                <option value="all">All Languages</option>
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="pt">Portuguese</option>
              </select>
            </div>
          </div>

          <div className="mt-4 text-xs text-[var(--muted)]">
            Showing {submissions.length} submissions
          </div>
        </div>

        {selectedRows.length > 0 && (
          <div className="sticky top-0 z-20 mb-4 flex flex-wrap items-center gap-3 border border-[var(--primary)] bg-[var(--primary)]/10 px-4 py-3 text-sm font-medium text-[var(--primary)]">
            <span>{selectedRows.length} selected</span>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkAssign(e.target.value);
                  e.target.value = '';
                }
              }}
              disabled={isBulkActionProcessing}
              className="rounded-none border border-[var(--border)] bg-white px-3 py-1.5 text-sm text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/40 disabled:opacity-60"
            >
              <option value="">Assign to\u2026</option>
              {STAFF_MEMBERS.map((member) => (
                <option key={member} value={member}>
                  {member}
                </option>
              ))}
            </select>
            <button
              onClick={handleBulkMarkSentToAppfolio}
              disabled={isBulkActionProcessing}
              className="rounded-none bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              Mark Sent to Appfolio
            </button>
            {hasPerDocSelection && (
              <button
                onClick={handleBulkExport}
                disabled={isBulkActionProcessing}
                className="rounded-none border border-[var(--ink)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition hover:bg-[var(--bg-section)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Export ZIP
              </button>
            )}
            <button
              onClick={handleBulkDelete}
              disabled={isBulkActionProcessing}
              className="rounded-none bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete Selected
            </button>
            <button
              onClick={resetSelection}
              className="rounded-none border border-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary)]/10"
            >
              Cancel
            </button>
          </div>
        )}

        <div className="border border-[var(--border)] bg-white">
          <DataTable<FormSubmission>
            key={tableKey}
            data={submissions}
            columns={columns}
            urlNamespace="form-submissions"
            getRowId={(row) => row.id}
            loading={isLoading}
            enableGlobalSearch
            enableColumnFilters={false}
            enableColumnOrdering={false}
            enableColumnVisibility
            enableRowSelection
            enableCsvExport
            enablePagination={{ pageSize: 25 }}
            onRowClick={(row) => setSelectedSubmission(row)}
            onSelectionChange={(rows) => setSelectedRows(rows)}
            emptyState={
              <div className="p-12 text-center text-sm text-[var(--muted)]">
                No submissions found matching the current filters.
              </div>
            }
          />
        </div>

        <FormSubmissionQuickViewModal
          submission={selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
          onUpdate={(updated) => {
            setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
            setSelectedSubmission(updated);
          }}
          onDelete={(id) => {
            setSubmissions((prev) => prev.filter((s) => s.id !== id));
            setSelectedSubmission(null);
          }}
          currentUser="Admin"
        />
      </div>
    </>
  );
}
