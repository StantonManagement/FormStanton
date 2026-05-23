'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { copyToClipboard } from '@/lib/copyToClipboard';
import {
  DataTable,
  type ColumnDef,
  DateCell,
  BadgeCell,
} from '@/components/admin/DataTable';

interface FullAppRow {
  id: string;
  created_at: string;
  head_of_household_name: string;
  building_address: string;
  unit_number: string;
  bedroom_count: number | null;
  household_size: number;
  intake_status: string;
  intake_completed_at: string | null;
  stanton_review_status: string;
  tenant_access_token: string;
  form_submission_id: string | null;
  preapp_id: string | null;
  workspace_unread_counts?: {
    stanton: number;
    shared: number;
  };
  assignees?: {
    user_id: string;
    display_name: string;
    count: number;
  }[];
  total_assignees?: number;
}

interface InviteForm {
  building_address: string;
  unit_number: string;
  head_of_household_name: string;
  bedroom_count: string;
  language: string;
  preapp_id: string;
}

function formatDate(s: string | null | undefined) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function deriveDisplayStatus(row: FullAppRow): string {
  if (row.intake_status !== 'complete') return 'Invited';
  if (row.stanton_review_status === 'approved') return 'Approved';
  if (row.stanton_review_status === 'denied') return 'Denied';
  if (row.stanton_review_status === 'under_review') return 'Under Review';
  if (row.stanton_review_status === 'needs_info') return 'Needs Info';
  return 'Intake Submitted';
}

export default function PbvFullApplicationsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<FullAppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBuilding, setFilterBuilding] = useState('');
  const [filterIntakeOnly, setFilterIntakeOnly] = useState(false);
  const [filterMyDocs, setFilterMyDocs] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteForm>({
    building_address: '', unit_number: '', head_of_household_name: '',
    bedroom_count: '', language: 'en', preapp_id: '',
  });
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteResult, setInviteResult] = useState<{ magic_link: string } | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterBuilding) params.set('building', filterBuilding);
      if (filterMyDocs) params.set('assigned_to_me', 'true');
      const res = await fetch(`/api/admin/pbv/full-applications?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed to load');
      setRows(json.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterBuilding, filterMyDocs]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Get initials from display name
  const getInitials = (name: string): string => {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleCopyLink = async (row: FullAppRow) => {
    const link = `${window.location.origin}/pbv-full-app/${row.tenant_access_token}`;
    await copyToClipboard(link);
    setCopiedId(row.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRegenerateToken = async (row: FullAppRow) => {
    if (!confirm(`Regenerate magic link for ${row.head_of_household_name}? The old link will stop working.`)) return;
    setRegeneratingId(row.id);
    try {
      const res = await fetch(`/api/admin/pbv/full-applications/${row.id}/token`, { method: 'PATCH' });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      await fetchRows();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to regenerate token');
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleInviteSubmit = async () => {
    setInviteError('');
    if (!inviteForm.building_address.trim() || !inviteForm.unit_number.trim() || !inviteForm.head_of_household_name.trim()) {
      setInviteError('Building, unit, and head of household name are required.');
      return;
    }
    setInviting(true);
    try {
      const res = await fetch('/api/admin/pbv/full-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          building_address: inviteForm.building_address.trim(),
          unit_number: inviteForm.unit_number.trim(),
          head_of_household_name: inviteForm.head_of_household_name.trim(),
          bedroom_count: inviteForm.bedroom_count ? parseInt(inviteForm.bedroom_count) : undefined,
          language: inviteForm.language,
          preapp_id: inviteForm.preapp_id.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success && res.status !== 409) throw new Error(json.message);
      setInviteResult(json.data);
      await fetchRows();
    } catch (e: unknown) {
      setInviteError(e instanceof Error ? e.message : 'Failed to create invitation');
    } finally {
      setInviting(false);
    }
  };

  const statusFilterOptions = useMemo(() => {
    const statuses = new Set<string>();
    rows.forEach((row) => {
      statuses.add(row.stanton_review_status ?? '');
    });
    return Array.from(statuses)
      .filter(Boolean)
      .map((value) => ({
        value,
        label: value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      }));
  }, [rows]);

  const buildingFilterOptions = useMemo(() => {
    const buildings = new Set<string>();
    rows.forEach((row) => {
      if (row.building_address) buildings.add(row.building_address);
    });
    return Array.from(buildings).map((value) => ({ value, label: value }));
  }, [rows]);

  const tableData = useMemo(() => {
    if (!filterIntakeOnly) return rows;
    return rows.filter((row) => row.intake_status === 'complete');
  }, [rows, filterIntakeOnly]);

  const columns = useMemo<ColumnDef<FullAppRow>[]>(
    () => [
      {
        id: 'head_of_household_name',
        accessorKey: 'head_of_household_name',
        header: 'Head of Household',
        enableSorting: true,
        enableFiltering: true,
        meta: {
          filter: { type: 'text' },
          csvValue: (row) => row.head_of_household_name,
        },
        cell: ({ row }) => {
          const unreadTotal = (row.workspace_unread_counts?.stanton ?? 0) + (row.workspace_unread_counts?.shared ?? 0);
          return (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--ink)]">{row.head_of_household_name}</span>
              {unreadTotal > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-red-600 text-white">
                  {unreadTotal}
                </span>
              )}
            </div>
          );
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
      },
      {
        id: 'stanton_review_status',
        accessorKey: 'stanton_review_status',
        header: 'Status',
        enableFiltering: statusFilterOptions.length > 0,
        meta: {
          filter: statusFilterOptions.length > 0 ? { type: 'select', options: statusFilterOptions } : undefined,
          csvValue: (row) => deriveDisplayStatus(row),
        },
        cell: ({ row }) => {
          const displayStatus = deriveDisplayStatus(row);
          const variant =
            displayStatus === 'Approved'
              ? 'green'
              : displayStatus === 'Denied'
              ? 'red'
              : displayStatus === 'Needs Info'
              ? 'yellow'
              : displayStatus === 'Under Review'
              ? 'blue'
              : displayStatus === 'Intake Submitted'
              ? 'indigo'
              : 'gray';
          return (
            <BadgeCell
              value={displayStatus}
              variant={variant}
              label={displayStatus}
            />
          );
        },
      },
      {
        id: 'assignees',
        header: 'Assignees',
        enableSorting: false,
        meta: {
          csvValue: (row) => (row.assignees ?? []).map((a) => `${a.display_name} (${a.count})`).join('; '),
        },
        cell: ({ row }) => {
          if (!row.assignees || row.assignees.length === 0) {
            return <span className="text-xs text-[var(--muted)]">—</span>;
          }
          return (
            <div className="flex items-center gap-1">
              {row.assignees.slice(0, 3).map((assignee) => (
                <span
                  key={assignee.user_id}
                  className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-medium"
                  title={`${assignee.display_name} (${assignee.count} docs)`}
                >
                  {getInitials(assignee.display_name)}
                </span>
              ))}
              {row.total_assignees && row.total_assignees > 3 && (
                <span className="text-xs text-[var(--muted)]">+{row.total_assignees - 3}</span>
              )}
            </div>
          );
        },
      },
      {
        id: 'created_at',
        accessorKey: 'created_at',
        header: 'Invited',
        enableSorting: true,
        meta: {
          csvValue: (row) => row.created_at,
        },
        cell: ({ value }) => <DateCell value={value as string} />, 
      },
      {
        id: 'intake_completed_at',
        accessorKey: 'intake_completed_at',
        header: 'Intake Submitted',
        enableSorting: true,
        meta: {
          csvValue: (row) => row.intake_completed_at ?? '',
        },
        cell: ({ value }) => <DateCell value={(value as string) ?? undefined} />,
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        enableHiding: false,
        meta: {
          align: 'right',
          csvValue: () => '',
        },
        cell: ({ row }) => (
          <div className="flex gap-2 justify-end" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => handleCopyLink(row)}
              className="text-xs text-[var(--muted)] hover:text-[var(--ink)] underline"
            >
              {copiedId === row.id ? 'Copied!' : 'Copy Link'}
            </button>
            {row.intake_status !== 'complete' && (
              <button
                type="button"
                onClick={() => handleRegenerateToken(row)}
                disabled={regeneratingId === row.id}
                className="text-xs text-[var(--muted)] hover:text-[var(--ink)] underline disabled:opacity-50"
              >
                {regeneratingId === row.id ? 'New Link…' : 'New Link'}
              </button>
            )}
            <Link
              href={`/admin/pbv/full-applications/${row.id}`}
              className="text-xs text-[var(--muted)] hover:text-[var(--ink)] underline"
            >
              Detail →
            </Link>
          </div>
        ),
      },
    ],
    [buildingFilterOptions, copiedId, handleCopyLink, handleRegenerateToken, regeneratingId, statusFilterOptions]
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-serif text-[var(--primary)]">PBV Full Applications</h1>
          <Link href="/admin/pbv/pipeline" className="text-sm text-[var(--primary)] underline">Pipeline view ?</Link>
        </div>
        <button
          type="button"
          onClick={() => { setShowInvite(true); setInviteResult(null); setInviteError(''); }}
          className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + New Invitation
        </button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Filter by building..."
          value={filterBuilding}
          onChange={(e) => setFilterBuilding(e.target.value)}
          className="px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white min-w-[200px]"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="under_review">Under Review</option>
          <option value="needs_info">Needs Info</option>
          <option value="approved">Approved</option>
          <option value="denied">Denied</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-[var(--ink)] cursor-pointer">
          <input type="checkbox" checked={filterIntakeOnly} onChange={(e) => setFilterIntakeOnly(e.target.checked)} className="w-4 h-4" />
          Intake submitted only
        </label>
        <button
          type="button"
          onClick={() => setFilterMyDocs(!filterMyDocs)}
          className={`px-3 py-2 text-sm border transition-colors ${
            filterMyDocs
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'border-[var(--border)] text-[var(--ink)] hover:bg-[var(--bg-section)]'
          }`}
        >
          My docs only
        </button>
      </div>

      <div className="bg-white border border-[var(--border)]">
        <DataTable<FullAppRow>
          data={tableData}
          columns={columns}
          urlNamespace="full-apps"
          getRowId={(row) => row.id}
          loading={loading}
          enableGlobalSearch={true}
          enableColumnFilters={true}
          enableColumnVisibility={true}
          enableCsvExport={true}
          onRowClick={(row) => router.push(`/admin/pbv/full-applications/${row.id}`)}
          emptyState={
            error
              ? <div className="py-12 text-center text-sm text-red-600">{error}</div>
              : <div className="py-12 text-center text-sm text-[var(--muted)]">No applications found.</div>
          }
        />
      </div>

      {showInvite && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white border border-[var(--border)] w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-serif text-[var(--primary)]">New PBV Invitation</h2>
              <button type="button" onClick={() => { setShowInvite(false); setInviteResult(null); }} className="text-[var(--muted)] hover:text-[var(--ink)] text-xl leading-none">&times;</button>
            </div>

            {inviteResult ? (
              <div className="space-y-3">
                <p className="text-sm text-green-700 font-medium">Invitation created.</p>
                <div className="bg-[var(--bg-section)] border border-[var(--divider)] p-3 break-all text-xs font-mono text-[var(--ink)]">
                  {inviteResult.magic_link}
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(inviteResult.magic_link)}
                  className="w-full py-2 px-4 bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Copy Magic Link
                </button>
                <button
                  type="button"
                  onClick={() => { setShowInvite(false); setInviteResult(null); setInviteForm({ building_address: '', unit_number: '', head_of_household_name: '', bedroom_count: '', language: 'en', preapp_id: '' }); }}
                  className="w-full py-2 text-sm text-[var(--muted)] underline"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Building Address <span className="text-red-500">*</span></label>
                  <input type="text" value={inviteForm.building_address} onChange={(e) => setInviteForm((f) => ({ ...f, building_address: e.target.value }))}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--ink)] mb-1">Unit <span className="text-red-500">*</span></label>
                    <input type="text" value={inviteForm.unit_number} onChange={(e) => setInviteForm((f) => ({ ...f, unit_number: e.target.value }))}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--ink)] mb-1">Bedrooms</label>
                    <input type="number" min="0" max="6" value={inviteForm.bedroom_count} onChange={(e) => setInviteForm((f) => ({ ...f, bedroom_count: e.target.value }))}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--ink)] mb-1">Head of Household Name <span className="text-red-500">*</span></label>
                  <input type="text" value={inviteForm.head_of_household_name} onChange={(e) => setInviteForm((f) => ({ ...f, head_of_household_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--ink)] mb-1">Language</label>
                    <select value={inviteForm.language} onChange={(e) => setInviteForm((f) => ({ ...f, language: e.target.value }))}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white">
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="pt">Portuguese</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--ink)] mb-1">Pre-App ID (optional)</label>
                    <input type="text" value={inviteForm.preapp_id} onChange={(e) => setInviteForm((f) => ({ ...f, preapp_id: e.target.value }))}
                      placeholder="UUID"
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white font-mono text-xs" />
                  </div>
                </div>
                {inviteError && <p className="text-xs text-red-600">{inviteError}</p>}
                <button type="button" onClick={handleInviteSubmit} disabled={inviting}
                  className="w-full py-3 px-4 bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                  {inviting ? 'Creating...' : 'Create Invitation'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
