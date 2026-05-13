'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface FullAppRow {
  id: string;
  created_at: string;
  head_of_household_name: string;
  building_address: string;
  unit_number: string;
  bedroom_count: number | null;
  household_size: number;
  intake_submitted_at: string | null;
  stanton_review_status: string;
  tenant_access_token: string;
  form_submission_id: string | null;
  preapp_id: string | null;
  workspace_unread_counts?: {
    stanton: number;
    shared: number;
  };
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
  if (!row.intake_submitted_at) return 'Invited';
  if (row.stanton_review_status === 'approved') return 'Approved';
  if (row.stanton_review_status === 'denied') return 'Denied';
  if (row.stanton_review_status === 'under_review') return 'Under Review';
  if (row.stanton_review_status === 'needs_info') return 'Needs Info';
  return 'Intake Submitted';
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    Approved: 'bg-green-100 text-green-800 border-green-200',
    Denied: 'bg-red-100 text-red-800 border-red-200',
    'Under Review': 'bg-blue-100 text-blue-800 border-blue-200',
    'Intake Submitted': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'Needs Info': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    Invited: 'bg-gray-100 text-gray-700 border-gray-200',
  };
  return map[status] ?? 'bg-gray-100 text-gray-700 border-gray-200';
}

export default function PbvFullApplicationsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<FullAppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBuilding, setFilterBuilding] = useState('');
  const [filterIntakeOnly, setFilterIntakeOnly] = useState(false);
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
      const res = await fetch(`/api/admin/pbv/full-applications?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed to load');
      setRows(json.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterBuilding]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const handleCopyLink = async (row: FullAppRow) => {
    const link = `${window.location.origin}/pbv-full-app/${row.tenant_access_token}`;
    await navigator.clipboard.writeText(link);
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

  const filtered = rows.filter((r) => {
    if (filterBuilding && !r.building_address.toLowerCase().includes(filterBuilding.toLowerCase())) return false;
    if (filterStatus && r.stanton_review_status !== filterStatus) return false;
    if (filterIntakeOnly && !r.intake_submitted_at) return false;
    return true;
  });

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
      </div>

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No applications found.</p>
      ) : (
        <div className="overflow-x-auto border border-[var(--border)]">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[var(--bg-section)] border-b border-[var(--divider)]">
                <th className="text-left px-4 py-3 font-semibold text-[var(--ink)]">Head of Household</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--ink)]">Building</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--ink)]">Unit</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--ink)]">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--ink)]">Invited</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--ink)]">Intake</th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--ink)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--divider)]">
              {filtered.map((row) => {
                const displayStatus = deriveDisplayStatus(row);
                return (
                  <tr
                    key={row.id}
                    className="hover:bg-[var(--bg-section)] transition-colors bg-white cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
                    tabIndex={0}
                    role="button"
                    onClick={() => router.push(`/admin/pbv/full-applications/${row.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        router.push(`/admin/pbv/full-applications/${row.id}`);
                      }
                    }}
                  >
                    <td className="px-4 py-3 font-medium text-[var(--ink)]">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/pbv/full-applications/${row.id}`} className="hover:underline">
                          {row.head_of_household_name}
                        </Link>
                        {row.workspace_unread_counts && (row.workspace_unread_counts.stanton > 0 || row.workspace_unread_counts.shared > 0) && (
                          <span className="px-2 py-0.5 text-xs font-semibold bg-red-500 text-white rounded-full">
                            {row.workspace_unread_counts.stanton + row.workspace_unread_counts.shared}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{row.building_address}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{row.unit_number}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-xs border font-medium ${statusBadge(displayStatus)}`}>
                        {displayStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{formatDate(row.created_at)}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{formatDate(row.intake_submitted_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(row)}
                          className="text-xs text-[var(--muted)] hover:text-[var(--ink)] underline"
                        >
                          {copiedId === row.id ? 'Copied!' : 'Copy Link'}
                        </button>
                        {!row.intake_submitted_at && (
                          <button
                            type="button"
                            onClick={() => handleRegenerateToken(row)}
                            disabled={regeneratingId === row.id}
                            className="text-xs text-[var(--muted)] hover:text-[var(--ink)] underline disabled:opacity-50"
                          >
                            {regeneratingId === row.id ? '...' : 'New Link'}
                          </button>
                        )}
                        <Link
                          href={`/admin/pbv/full-applications/${row.id}`}
                          className="text-xs text-[var(--muted)] hover:text-[var(--ink)] underline"
                        >
                          Detail →
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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
                  onClick={() => navigator.clipboard.writeText(inviteResult.magic_link)}
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
