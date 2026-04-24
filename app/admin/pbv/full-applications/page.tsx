'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

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
}

interface NewInviteForm {
  building_address: string;
  unit_number: string;
  head_of_household_name: string;
  bedroom_count: string;
  language: string;
  preapp_id: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(s: string | null | undefined) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function deriveStatus(row: FullAppRow): string {
  if (!row.intake_submitted_at) return 'Invited';
  if (row.stanton_review_status === 'approved') return 'Approved';
  if (row.stanton_review_status === 'denied') return 'Denied';
  if (row.stanton_review_status === 'under_review') return 'Under Review';
  if (row.stanton_review_status === 'needs_info') return 'Needs Info';
  return 'Intake Submitted';
}

function statusColor(status: string) {
  if (status === 'Approved') return 'bg-green-100 text-green-800 border-green-200';
  if (status === 'Denied') return 'bg-red-100 text-red-800 border-red-200';
  if (status === 'Under Review') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (status === 'Intake Submitted') return 'bg-indigo-100 text-indigo-800 border-indigo-200';
  if (status === 'Needs Info') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PbvFullApplicationsPage() {
  const [rows, setRows] = useState<FullAppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterIntakeOnly, setFilterIntakeOnly] = useState(false);
  const [filterBuilding, setFilterBuilding] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Invite modal
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState<NewInviteForm>({
    building_address: '',
    unit_number: '',
    head_of_household_name: '',
    bedroom_count: '',
    language: 'en',
    preapp_id: '',
  });
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteResult, setInviteResult] = useState<{ magic_link: string; tenant_access_token: string } | null>(null);

  // Token regeneration
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

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
      setRows(json.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterBuilding]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const handleCopyLink = async (row: FullAppRow) => {
    const link = `${window.location.origin}/pbv-full-app/${row.tenant_access_token}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(row.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRegenerateToken = async (row: FullAppRow) => {
    if (!confirm(`Regenerate the magic link for ${row.head_of_household_name}? The old link will stop working.`)) return;
    setRegeneratingId(row.id);
    try {
      const res = await fetch(`/api/admin/pbv/full-applications/${row.id}/token`, { method: 'PATCH' });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      await fetchRows();
    } catch (err: any) {
      alert(err.message || 'Failed to regenerate token');
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
    } catch (err: any) {
      setInviteError(err.message || 'Failed to create invitation');
    } finally {
      setInviting(false);
    }
  };

  const filteredRows = rows.filter((r) => {
    const matchBuilding = !filterBuilding || r.building_address.toLowerCase().includes(filterBuilding.toLowerCase());
    const matchStatus = !filterStatus || r.stanton_review_status === filterStatus;
    const matchIntake = !filterIntakeOnly || !!r.intake_submitted_at;
    return matchBuilding && matchStatus && matchIntake;
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-serif text-[var(--primary)]">PBV Full Applications</h1>
          <Link href="/admin/pbv/pipeline" className="text-sm text-[var(--primary)] underline">Pipeline view →</Link>
        </div>
        <button
          type="button"
          onClick={() => { setShowInvite(true); setInviteResult(null); setInviteError(''); }}
          className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium transition-opacity hover:opacity-90"
        >
          + New Invitation
        </button>
      </div>

      {/* Filters */}
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
          <option value="">All Review Statuses</option>
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

      {/* Table */}
      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading...</p>
      ) : error ? (
        <p className="text-sm text-[var(--error)]">{error}</p>
      ) : filteredRows.length === 0 ? (
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
              {filteredRows.map((row) => (
                <tr
                  key={row.id}
                  className={`hover:bg-[var(--bg-section)] transition-colors cursor-pointer ${selectedId === row.id ? 'bg-[var(--bg-section)]' : 'bg-white'}`}
                  onClick={() => setSelectedId(selectedId === row.id ? null : row.id)}
                >
                  <td className="px-4 py-3 font-medium text-[var(--ink)]">{row.head_of_household_name}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{row.building_address}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{row.unit_number}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-xs border font-medium ${statusColor(deriveStatus(row))}`}>
                      {deriveStatus(row)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{formatDate(row.created_at)}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{formatDate(row.intake_submitted_at)}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyLink(row)}
                        className="text-xs text-[var(--muted)] hover:text-[var(--ink)] underline transition-colors"
                      >
                        {copiedId === row.id ? 'Copied!' : 'Copy Link'}
                      </button>
                      {!row.intake_submitted_at && (
                        <button
                          type="button"
                          onClick={() => handleRegenerateToken(row)}
                          disabled={regeneratingId === row.id}
                          className="text-xs text-[var(--muted)] hover:text-[var(--ink)] underline transition-colors disabled:opacity-50"
                        >
                          {regeneratingId === row.id ? '...' : 'New Link'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Expanded detail row */}
      {selectedId && <DetailDrawer id={selectedId} onClose={() => setSelectedId(null)} />}

      {/* Invite modal */}
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
                  onClick={() => { navigator.clipboard.writeText(inviteResult.magic_link); }}
                  className="w-full py-2 px-4 bg-[var(--primary)] text-white text-sm font-medium transition-opacity hover:opacity-90"
                >
                  Copy Magic Link
                </button>
                <button type="button" onClick={() => { setShowInvite(false); setInviteResult(null); setInviteForm({ building_address: '', unit_number: '', head_of_household_name: '', bedroom_count: '', language: 'en', preapp_id: '' }); }} className="w-full py-2 text-sm text-[var(--muted)] underline">
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
                    <label className="block text-xs font-medium text-[var(--ink)] mb-1">Unit Number <span className="text-red-500">*</span></label>
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
                {inviteError && <p className="text-xs text-[var(--error)]">{inviteError}</p>}
                <button type="button" onClick={handleInviteSubmit} disabled={inviting}
                  className="w-full py-3 px-4 bg-[var(--primary)] text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50">
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

// ── Detail Drawer ─────────────────────────────────────────────────────────────

interface DetailDrawerProps {
  id: string;
  onClose: () => void;
}

interface AppDetail {
  id: string;
  head_of_household_name: string;
  building_address: string;
  unit_number: string;
  bedroom_count: number | null;
  household_size: number;
  status: string;
  intake_submitted_at: string | null;
  tenant_access_token: string;
  magic_link: string;
  members: Array<{
    slot: number;
    name: string;
    age: number | null;
    relationship: string;
    citizenship_status: string;
    annual_income: number;
    signature_required: boolean;
    signature_date: string | null;
    signed_forms: string[];
  }>;
  documents: Array<{
    id: string;
    doc_type: string;
    label: string;
    person_slot: number;
    status: string;
    required: boolean;
  }>;
}

function DetailDrawer({ id, onClose }: DetailDrawerProps) {
  const [detail, setDetail] = useState<AppDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`/api/admin/pbv/full-applications/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) throw new Error(json.message);
        setDetail(json.data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCopy = async () => {
    if (!detail) return;
    await navigator.clipboard.writeText(detail.magic_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const docStatusColor = (s: string) => {
    if (s === 'approved') return 'text-green-700';
    if (s === 'rejected') return 'text-red-600';
    if (s === 'submitted') return 'text-blue-700';
    if (s === 'waived') return 'text-gray-500';
    return 'text-[var(--muted)]';
  };

  return (
    <div className="border border-[var(--border)] bg-white shadow-sm p-5 space-y-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-bold font-serif text-[var(--primary)]">Application Detail</h3>
          <Link
            href={`/admin/pbv/full-applications/${id}`}
            className="text-xs text-[var(--muted)] hover:text-[var(--ink)] underline"
          >
            View Full Detail →
          </Link>
        </div>
        <button type="button" onClick={onClose} className="text-[var(--muted)] hover:text-[var(--ink)] text-xl leading-none">&times;</button>
      </div>

      {loading && <p className="text-sm text-[var(--muted)]">Loading...</p>}
      {error && <p className="text-sm text-[var(--error)]">{error}</p>}
      {detail && (
        <div className="space-y-5">
          {/* Magic link */}
          <div className="flex items-center gap-2 bg-[var(--bg-section)] border border-[var(--divider)] px-3 py-2">
            <span className="text-xs font-mono text-[var(--muted)] truncate flex-1">{detail.magic_link}</span>
            <button type="button" onClick={handleCopy} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] underline whitespace-nowrap">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Members */}
          {detail.members.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">Household Members</h4>
              <div className="border border-[var(--border)] divide-y divide-[var(--divider)]">
                {detail.members.map((m) => (
                  <div key={m.slot} className="px-3 py-2 flex items-center gap-4 text-sm">
                    <span className="font-medium text-[var(--ink)] w-36 shrink-0">{m.name}</span>
                    <span className="text-[var(--muted)] text-xs">{m.relationship} · {m.age ?? '?'} yr</span>
                    <span className="text-[var(--muted)] text-xs">${(m.annual_income ?? 0).toLocaleString()}/yr</span>
                    <span className="ml-auto text-xs">
                      {m.signature_required ? (
                        m.signed_forms.length > 0
                          ? <span className="text-green-700">Signed {m.signed_forms.length} form{m.signed_forms.length !== 1 ? 's' : ''}</span>
                          : <span className="text-amber-600">Sig. required</span>
                      ) : (
                        <span className="text-[var(--muted)]">No sig. needed</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents */}
          {detail.documents.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">Documents</h4>
              <div className="border border-[var(--border)] divide-y divide-[var(--divider)]">
                {detail.documents.map((d) => (
                  <div key={d.id} className="px-3 py-2 flex items-center text-sm">
                    <span className="text-[var(--ink)] flex-1">{d.label}</span>
                    {d.person_slot > 0 && (
                      <span className="text-[var(--muted)] text-xs mr-3">P{d.person_slot}</span>
                    )}
                    <span className={`text-xs font-medium capitalize ${docStatusColor(d.status)}`}>{d.status}</span>
                    {!d.required && <span className="text-[var(--muted)] text-xs ml-2">(opt)</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
