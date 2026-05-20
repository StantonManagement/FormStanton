'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  DataTable,
  type ColumnDef,
  BadgeCell,
  DateCell,
} from '@/components/admin/DataTable';

interface PipelineRow {
  id: string;
  head_of_household_name: string;
  building_address: string;
  unit_number: string;
  household_size: number;
  stage: string;
  stage_changed_at: string | null;
  last_activity_at: string;
  days_in_stage: number;
  days_stale: number;
  blocked_on: 'tenant' | 'stanton' | 'hach' | 'nobody';
  next_action: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  income_status: 'qualifies' | 'delta' | 'over_limit' | 'no_data';
  income_total: number | null;
  ami_limit: number | null;
  has_rejections: boolean;
  hach_review_status: string | null;
  missing_contact_info: boolean;
  hach_last_inbound_days_ago: number | null;
  hach_awaiting_response: boolean;
}

interface StaffUser {
  id: string;
  display_name: string;
}

type BadgeVariant = NonNullable<Parameters<typeof BadgeCell>[0]['variant']>;

const STAGE_LABELS: Record<string, string> = {
  pre_app: 'Pre-App',
  intake: 'Intake',
  stanton_review: 'Stanton Review',
  submitted_to_hach: 'Submitted to HACH',
  hach_review: 'HACH Review',
  approved: 'Approved',
  denied: 'Denied',
  withdrawn: 'Withdrawn',
};

const STAGE_VARIANTS: Record<string, BadgeVariant> = {
  pre_app: 'gray',
  intake: 'blue',
  stanton_review: 'amber',
  submitted_to_hach: 'indigo',
  hach_review: 'indigo',
  approved: 'green',
  denied: 'red',
  withdrawn: 'gray',
};

const BLOCKED_VARIANTS: Record<PipelineRow['blocked_on'], BadgeVariant> = {
  tenant: 'blue',
  stanton: 'amber',
  hach: 'indigo',
  nobody: 'gray',
};

const BLOCKED_LABELS: Record<PipelineRow['blocked_on'], string> = {
  tenant: 'Tenant',
  stanton: 'Stanton',
  hach: 'HACH',
  nobody: '\u2014',
};

const INCOME_LABELS: Record<PipelineRow['income_status'], string> = {
  qualifies: 'Qualifies',
  delta: 'Review',
  over_limit: 'Over limit',
  no_data: 'No data',
};

const INCOME_VARIANTS: Record<PipelineRow['income_status'], BadgeVariant> = {
  qualifies: 'green',
  delta: 'amber',
  over_limit: 'red',
  no_data: 'gray',
};

const STAGE_FILTER_OPTIONS = [
  { value: '', label: 'All stages' },
  ...Object.entries(STAGE_LABELS).map(([value, label]) => ({ value, label })),
];

const BLOCKED_FILTER_OPTIONS = [
  { value: '', label: 'All blocked-on' },
  { value: 'tenant', label: 'Tenant' },
  { value: 'stanton', label: 'Stanton' },
  { value: 'hach', label: 'HACH' },
  { value: 'nobody', label: 'Nobody' },
];

const STALE_WARNING_DAYS = 14;
const STALE_DANGER_DAYS = 30;
const TERMINAL_STAGES = new Set(['approved', 'denied', 'withdrawn']);

const formatBuildingPrefix = (address?: string | null) =>
  address ? address.split(' ')[0] : '\u2014';

export default function PipelinePage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [buildingInput, setBuildingInput] = useState(() => searchParams.get('building') ?? '');
  const [building, setBuilding] = useState(() => searchParams.get('building') ?? '');
  const [stage, setStage] = useState(() => searchParams.get('stage') ?? '');
  const [blocked, setBlocked] = useState<'' | PipelineRow['blocked_on']>(
    () => (searchParams.get('blocked') as PipelineRow['blocked_on'] | null) ?? ''
  );
  const [hasRejections, setHasRejections] = useState(() => searchParams.get('rejections') === '1');
  const [assignee, setAssignee] = useState(() => searchParams.get('assignee') ?? '');

  const [selectedRows, setSelectedRows] = useState<PipelineRow[]>([]);
  const [tableKey, setTableKey] = useState(0);
  const [bulkTarget, setBulkTarget] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Debounce building filter — 300ms
  useEffect(() => {
    const handle = window.setTimeout(() => setBuilding(buildingInput.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [buildingInput]);

  const resetSelection = useCallback(() => {
    setSelectedRows([]);
    setTableKey((key) => key + 1);
  }, []);

  // Sync filters to URL so back-nav restores them
  useEffect(() => {
    const params = new URLSearchParams();
    if (building) params.set('building', building);
    if (stage) params.set('stage', stage);
    if (blocked) params.set('blocked', blocked);
    if (hasRejections) params.set('rejections', '1');
    if (assignee) params.set('assignee', assignee);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [building, stage, blocked, hasRejections, assignee, router, pathname]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  }, []);

  const fetchRows = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError('');

    const params = new URLSearchParams();
    if (building) params.set('building', building);
    if (stage) params.set('stage', stage);
    if (blocked) params.set('blocked', blocked);
    if (hasRejections) params.set('has_rejections', 'true');
    if (assignee) params.set('assignee', assignee);

    try {
      const response = await fetch(`/api/admin/pbv/pipeline?${params.toString()}`, {
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message ?? 'Failed to load pipeline');
      }
      setRows(data.data ?? []);
      resetSelection();
    } catch (err: unknown) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      if (!isAbort) {
        const message = err instanceof Error ? err.message : 'Failed to load pipeline';
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [assignee, blocked, building, hasRejections, resetSelection, stage]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    fetch('/api/admin/pbv/staff-users')
      .then((response) => response.json())
      .then((data) => {
        if (data?.success) setStaffUsers(data.data ?? []);
      })
      .catch(() => {});
  }, []);

  const handleBulkAssign = useCallback(async () => {
    if (!bulkTarget || selectedRows.length === 0) return;
    setBulkLoading(true);
    try {
      const response = await fetch('/api/admin/pbv/applications/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_ids: selectedRows.map((row) => row.id),
          assigned_to: bulkTarget,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message ?? 'Bulk assign failed');
      }
      showToast(`Assigned ${selectedRows.length} application${selectedRows.length === 1 ? '' : 's'}`);
      resetSelection();
      setBulkTarget('');
      await fetchRows();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bulk assign failed';
      setError(message);
    } finally {
      setBulkLoading(false);
    }
  }, [bulkTarget, fetchRows, resetSelection, selectedRows, showToast]);

  const handleInlineAssign = useCallback(
    async (applicationId: string, newAssigneeId: string | null) => {
      setAssigningId(applicationId);
      let previousRow: PipelineRow | undefined;

      setRows((current) =>
        current.map((row) => {
          if (row.id !== applicationId) return row;
          previousRow = row;
          return {
            ...row,
            assigned_to: newAssigneeId,
            assigned_to_name: newAssigneeId
              ? staffUsers.find((user) => user.id === newAssigneeId)?.display_name ?? '\u2026'
              : null,
          };
        })
      );

      try {
        const response = await fetch(`/api/admin/pbv/applications/${applicationId}/assign`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assigned_to: newAssigneeId }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message ?? 'Assign failed');
        }
        showToast('Assignment saved');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Assign failed';
        setError(message);
        if (previousRow) {
          const restore = previousRow;
          setRows((current) =>
            current.map((row) => (row.id === applicationId ? restore : row))
          );
        }
      } finally {
        setAssigningId(null);
      }
    },
    [showToast, staffUsers]
  );

  const summary = useMemo(() => {
    const tenant = rows.filter((row) => row.blocked_on === 'tenant').length;
    const stanton = rows.filter((row) => row.blocked_on === 'stanton').length;
    const hach = rows.filter((row) => row.blocked_on === 'hach').length;
    const stale = rows.filter(
      (row) => !TERMINAL_STAGES.has(row.stage) && row.days_stale > STALE_WARNING_DAYS
    ).length;
    return { tenant, stanton, hach, stale };
  }, [rows]);

  const assigneeOptions = useMemo(
    () => [
      { value: '', label: 'All assignees' },
      { value: 'unassigned', label: 'Unassigned' },
      ...staffUsers.map((user) => ({ value: user.id, label: user.display_name })),
    ],
    [staffUsers]
  );

  const columns = useMemo<ColumnDef<PipelineRow>[]>(
    () => [
      {
        id: 'unit_number',
        accessorKey: 'unit_number',
        header: 'Unit',
        enableSorting: true,
        meta: {
          csvValue: (row) => `${row.building_address} #${row.unit_number}`,
        },
        cell: ({ row }) => {
          const isTerminal = TERMINAL_STAGES.has(row.stage);
          const staleTone = !isTerminal && row.days_stale > STALE_DANGER_DAYS
            ? 'border-red-500'
            : !isTerminal && row.days_stale > STALE_WARNING_DAYS
              ? 'border-amber-500'
              : 'border-transparent';
          return (
            <div className={`flex flex-col gap-1 border-l-4 pl-3 text-sm ${staleTone}`}>
              <span className="font-mono text-xs text-[var(--muted)]">
                {formatBuildingPrefix(row.building_address)}
              </span>
              <span className="font-medium text-[var(--ink)]">Unit {row.unit_number}</span>
              <span className="max-w-[200px] truncate text-xs text-[var(--muted)]">
                {row.building_address}
              </span>
            </div>
          );
        },
      },
      {
        id: 'head_of_household_name',
        accessorKey: 'head_of_household_name',
        header: 'Tenant',
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex flex-col gap-1 text-sm">
            <Link
              href={`/admin/pbv/pipeline/${row.id}`}
              onClick={(event) => event.stopPropagation()}
              className="font-medium text-[var(--primary)] hover:underline"
            >
              {row.head_of_household_name}
            </Link>
            <span className="text-xs text-[var(--muted)]">HH {row.household_size}</span>
            <div className="flex flex-wrap gap-1">
              {row.missing_contact_info && (
                <BadgeCell value="contact" variant="red" label="Needs contact" />
              )}
              {row.hach_awaiting_response && (
                <BadgeCell value="hach" variant="indigo" label="Awaiting HACH" />
              )}
            </div>
          </div>
        ),
      },
      {
        id: 'stage',
        accessorKey: 'stage',
        header: 'Stage',
        enableSorting: true,
        meta: {
          csvValue: (row) => STAGE_LABELS[row.stage] ?? row.stage,
        },
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <BadgeCell
              value={row.stage}
              variant={STAGE_VARIANTS[row.stage] ?? 'blue'}
              label={STAGE_LABELS[row.stage] ?? row.stage}
            />
            {row.has_rejections && (
              <BadgeCell value="rejections" variant="red" label="Has rejections" />
            )}
          </div>
        ),
      },
      {
        id: 'blocked_on',
        accessorKey: 'blocked_on',
        header: 'Blocked On',
        enableSorting: true,
        meta: {
          csvValue: (row) => BLOCKED_LABELS[row.blocked_on],
        },
        cell: ({ row }) => (
          <BadgeCell
            value={row.blocked_on}
            variant={BLOCKED_VARIANTS[row.blocked_on]}
            label={BLOCKED_LABELS[row.blocked_on]}
          />
        ),
      },
      {
        id: 'days_in_stage',
        accessorKey: 'days_in_stage',
        header: 'Days in Stage',
        enableSorting: true,
        meta: {
          align: 'right',
          csvValue: (row) => String(row.days_in_stage),
        },
        cell: ({ row }) => {
          const isTerminal = TERMINAL_STAGES.has(row.stage);
          const tone = !isTerminal && row.days_stale > STALE_DANGER_DAYS
            ? 'text-red-600'
            : !isTerminal && row.days_stale > STALE_WARNING_DAYS
              ? 'text-amber-600'
              : 'text-[var(--ink)]';
          return <span className={`font-mono text-sm ${tone}`}>{row.days_in_stage}d</span>;
        },
      },
      {
        id: 'next_action',
        accessorKey: 'next_action',
        header: 'Next Action',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-md text-sm leading-snug text-[var(--ink)]">
            {row.next_action || '\u2014'}
          </span>
        ),
      },
      {
        id: 'assigned_to',
        accessorKey: 'assigned_to',
        header: 'Assigned To',
        enableSorting: true,
        meta: {
          csvValue: (row) => row.assigned_to_name ?? 'Unassigned',
        },
        cell: ({ row }) => (
          <div
            className="flex items-center gap-2"
            onClick={(event) => event.stopPropagation()}
          >
            <select
              value={row.assigned_to ?? ''}
              onChange={(event) => handleInlineAssign(row.id, event.target.value || null)}
              disabled={assigningId === row.id}
              className="w-40 rounded-none border border-[var(--border)] bg-white px-2 py-1 text-sm text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/40 disabled:opacity-60"
            >
              <option value="">Unassigned</option>
              {staffUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.display_name}
                </option>
              ))}
            </select>
            {assigningId === row.id && (
              <span className="text-xs text-[var(--muted)]">Saving\u2026</span>
            )}
          </div>
        ),
      },
      {
        id: 'income_status',
        accessorKey: 'income_status',
        header: 'Income',
        enableSorting: true,
        meta: {
          align: 'center',
          csvValue: (row) => INCOME_LABELS[row.income_status],
        },
        cell: ({ row }) => (
          <IncomeBadge
            status={row.income_status}
            income={row.income_total}
            limit={row.ami_limit}
          />
        ),
      },
      {
        id: 'last_activity_at',
        accessorKey: 'last_activity_at',
        header: 'Last Activity',
        enableSorting: true,
        meta: {
          csvValue: (row) => row.last_activity_at,
        },
        cell: ({ row }) => <DateCell value={row.last_activity_at} format="datetime" />,
      },
    ],
    [assigningId, handleInlineAssign, staffUsers]
  );

  const hasFilters = Boolean(
    buildingInput || stage || blocked || hasRejections || assignee
  );

  const handleResetFilters = () => {
    setBuildingInput('');
    setBuilding('');
    setStage('');
    setBlocked('');
    setHasRejections(false);
    setAssignee('');
  };

  return (
    <div className="mx-auto flex max-w-[1380px] flex-col gap-6 px-6 py-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-serif text-[var(--primary)]">PBV Pipeline</h1>
          <p className="text-sm text-[var(--muted)]">
            Operational view{' '}
            <span aria-hidden="true">\u00b7</span>{' '}
            <Link
              href="/admin/pbv/full-applications"
              className="text-[var(--primary)] hover:underline"
            >
              Classic list \u2192
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={fetchRows}
          className="self-start rounded-none border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--bg-section)]"
        >
          Refresh
        </button>
      </header>

      <section className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={buildingInput}
          onChange={(event) => setBuildingInput(event.target.value)}
          placeholder="Building\u2026"
          className="w-40 rounded-none border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/40"
        />
        <select
          value={stage}
          onChange={(event) => setStage(event.target.value)}
          className="w-44 rounded-none border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/40"
        >
          {STAGE_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={blocked}
          onChange={(event) =>
            setBlocked(event.target.value as '' | PipelineRow['blocked_on'])
          }
          className="w-44 rounded-none border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/40"
        >
          {BLOCKED_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={assignee}
          onChange={(event) => setAssignee(event.target.value)}
          className="w-48 rounded-none border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/40"
        >
          {assigneeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
          <input
            type="checkbox"
            checked={hasRejections}
            onChange={(event) => setHasRejections(event.target.checked)}
            className="h-4 w-4 border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
          />
          Has rejections
        </label>
        {hasFilters && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="rounded-none border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
          >
            Reset
          </button>
        )}
      </section>

      {error && (
        <div className="rounded-none border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {selectedRows.length > 0 && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border border-[var(--primary)] bg-[var(--primary)]/10 px-4 py-3 text-sm font-medium text-[var(--primary)]">
          <span>
            {selectedRows.length} selected
          </span>
          <select
            value={bulkTarget}
            onChange={(event) => setBulkTarget(event.target.value)}
            disabled={bulkLoading}
            className="w-48 rounded-none border border-[var(--border)] bg-white px-2 py-1 text-sm text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/40"
          >
            <option value="">Assign to\u2026</option>
            {staffUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.display_name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleBulkAssign}
            disabled={!bulkTarget || bulkLoading}
            className="rounded-none bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {bulkLoading ? 'Assigning\u2026' : 'Assign'}
          </button>
          <button
            type="button"
            onClick={resetSelection}
            className="rounded-none border border-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary)]/10"
          >
            Cancel
          </button>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="text-xs text-[var(--muted)]">
          {rows.length} application{rows.length !== 1 ? 's' : ''}
          {' \u00b7 '}
          {summary.tenant} on tenant
          {' \u00b7 '}
          {summary.stanton} on Stanton
          {' \u00b7 '}
          {summary.hach} on HACH
          {' \u00b7 '}
          {summary.stale} stale &gt; {STALE_WARNING_DAYS}d
        </div>
      )}

      <div className="bg-white border border-[var(--border)]">
        <DataTable<PipelineRow>
          key={tableKey}
          data={rows}
          columns={columns}
          urlNamespace="pipeline"
          getRowId={(row) => row.id}
          loading={loading}
          enableGlobalSearch={false}
          enableColumnFilters={false}
          enableColumnOrdering={false}
          enableColumnVisibility
          enableRowSelection
          enableCsvExport
          enablePagination={{ pageSize: 25 }}
          onRowClick={(row) => router.push(`/admin/pbv/pipeline/${row.id}`)}
          onSelectionChange={(rowsSelected) => setSelectedRows(rowsSelected)}
          emptyState={
            error ? (
              <div className="p-12 text-center text-sm text-red-600">{error}</div>
            ) : (
              <div className="p-12 text-center text-sm text-[var(--muted)]">
                No applications match the current filters.
              </div>
            )
          }
        />
      </div>

      <section className="flex flex-wrap gap-4 text-xs text-[var(--muted)]">
        <span>Amber border = stale &gt; {STALE_WARNING_DAYS} days</span>
        <span>Red border = stale &gt; {STALE_DANGER_DAYS} days</span>
        <span>Income: \u2713 qualifies \u00b7 \u26a0 review \u00b7 \u2717 over limit \u00b7 \u2013 no data</span>
      </section>

      {toast && (
        <div className="fixed bottom-6 right-6 z-30 rounded-none bg-[var(--primary)] px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function IncomeBadge({
  status,
  income,
  limit,
}: {
  status: PipelineRow['income_status'];
  income: number | null;
  limit: number | null;
}) {
  const tooltip = income != null
    ? `$${income.toLocaleString()} / $${(limit ?? 0).toLocaleString()} limit`
    : 'No income data';

  return (
    <span title={tooltip} className="inline-flex">
      <BadgeCell
        value={status}
        variant={INCOME_VARIANTS[status]}
        label={INCOME_LABELS[status]}
      />
    </span>
  );
}
