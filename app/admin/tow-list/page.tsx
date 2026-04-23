'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface TowRow {
  submission_id: string;
  full_name: string | null;
  unit_number: string;
  building_address: string;
  vehicle_plate: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: string | number | null;
  vehicle_color: string | null;
  permit_revoked_reason: string | null;
  permit_revoked_notes: string | null;
  permit_revoked_at: string | null;
  permit_revoked_by: string | null;
  tow_flagged: boolean;
  towed_at: string | null;
  current_tenant_name?: string | null;
}

interface ManualRow {
  id: string;
  vehicle_plate: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: string | null;
  vehicle_color: string | null;
  tenant_name: string | null;
  unit_number: string | null;
  building_address: string | null;
  reason: string | null;
  notes: string | null;
  source: 'manual' | 'submission_search';
  added_by: string;
  added_at: string;
}

interface QueueResponse {
  success: boolean;
  auto_flagged_moveouts: { count: number; rows: TowRow[] };
  tow_list: { count: number; rows: TowRow[] };
  message?: string;
}

interface SubmissionSearchResult {
  id: string;
  full_name: string | null;
  unit_number: string;
  building_address: string;
  vehicle_plate: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: string | null;
  vehicle_color: string | null;
}

const REVOKE_REASON_LABELS: Record<string, string> = {
  moved_out: 'Moved out',
  vehicle_sold: 'Vehicle sold',
  violation: 'Policy violation',
  other: 'Other',
};

function vehicleDesc(r: { vehicle_year?: any; vehicle_make?: any; vehicle_model?: any; vehicle_color?: any }) {
  return [r.vehicle_year, r.vehicle_make, r.vehicle_model, r.vehicle_color].filter(Boolean).join(' ') || '\u2014';
}

function formatDate(iso: string | null) {
  if (!iso) return '\u2014';
  return new Date(iso).toLocaleDateString();
}

// ── Add Modal ──────────────────────────────────────────────────────────────────

interface AddModalProps {
  onClose: () => void;
  onAdded: () => void;
}

function AddModal({ onClose, onAdded }: AddModalProps) {
  const [tab, setTab] = useState<'search' | 'manual'>('search');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SubmissionSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selected, setSelected] = useState<SubmissionSearchResult | null>(null);
  const [searchReason, setSearchReason] = useState('');
  const [searchNotes, setSearchNotes] = useState('');
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [plate, setPlate] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [unit, setUnit] = useState('');
  const [building, setBuilding] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [manualNotes, setManualNotes] = useState('');

  useEffect(() => {
    if (query.length < 2) { setSearchResults([]); return; }
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/admin/compliance/submission-search?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        setSearchResults(json.rows || []);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, [query]);

  const handleSearchSubmit = async () => {
    if (!selected) { setError('Select a submission first'); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/admin/compliance/tow-manual-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'submission_search',
          linked_submission_id: selected.id,
          reason: searchReason || null,
          notes: searchNotes || null,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed');
      onAdded();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!plate.trim()) { setError('Plate is required for a manual entry'); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/admin/compliance/tow-manual-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'manual',
          vehicle_plate: plate.trim().toUpperCase(),
          vehicle_make: make || null,
          vehicle_model: model || null,
          vehicle_year: year || null,
          vehicle_color: color || null,
          tenant_name: tenantName || null,
          unit_number: unit || null,
          building_address: building || null,
          reason: manualReason || null,
          notes: manualNotes || null,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed');
      onAdded();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-lg border border-[var(--border)] shadow-lg">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--divider)]">
          <h2 className="font-serif text-base text-[var(--primary)]">Add to Tow List</h2>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--primary)] text-lg leading-none">&times;</button>
        </div>

        <div className="flex border-b border-[var(--divider)]">
          {(['search', 'manual'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null); }}
              className={`px-5 py-2 text-sm border-b-2 transition-colors duration-200 ease-out ${
                tab === t
                  ? 'border-[var(--primary)] text-[var(--primary)] font-medium'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--primary)]'
              }`}
            >
              {t === 'search' ? 'Search Submission' : 'Manual Entry'}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-3">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2">
              {error}
            </div>
          )}

          {tab === 'search' && (
            <>
              <p className="text-xs text-[var(--muted)]">
                Search for an existing tenant submission by name, plate, or unit. Vehicle details will be copied from the submission.
              </p>
              <div>
                <input
                  type="text"
                  placeholder="Name, plate, unit, or building..."
                  value={query}
                  onChange={e => { setQuery(e.target.value); setSelected(null); }}
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-none focus:outline-none focus:border-[var(--primary)]"
                />
                {searchLoading && <p className="text-xs text-[var(--muted)] mt-1">Searching...</p>}
                {!searchLoading && query.length >= 2 && searchResults.length === 0 && (
                  <p className="text-xs text-[var(--muted)] mt-1">No matching submissions found.</p>
                )}
                {searchResults.length > 0 && !selected && (
                  <ul className="border border-[var(--border)] mt-1 max-h-48 overflow-y-auto divide-y divide-[var(--divider)]">
                    {searchResults.map(r => (
                      <li key={r.id}>
                        <button
                          onClick={() => setSelected(r)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-section)] transition-colors duration-150"
                        >
                          <span className="font-medium">{r.full_name || '\u2014'}</span>
                          <span className="text-[var(--muted)] ml-2">Unit {r.unit_number} &middot; {r.building_address}</span>
                          {r.vehicle_plate && (
                            <span className="ml-2 font-mono text-[var(--primary)]">{r.vehicle_plate}</span>
                          )}
                          <span className="text-[var(--muted)] ml-2">{vehicleDesc(r)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {selected && (
                  <div className="mt-2 px-3 py-2 bg-[var(--bg-section)] border border-[var(--border)] text-xs flex items-center justify-between">
                    <span>
                      <span className="font-medium">{selected.full_name || '\u2014'}</span>
                      <span className="text-[var(--muted)] ml-2">Unit {selected.unit_number} &middot; {selected.building_address}</span>
                      {selected.vehicle_plate && (
                        <span className="ml-2 font-mono">{selected.vehicle_plate}</span>
                      )}
                    </span>
                    <button onClick={() => { setSelected(null); setQuery(''); }} className="text-[var(--muted)] hover:text-red-600 ml-3">&times;</button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">Reason for adding</label>
                <input
                  type="text"
                  value={searchReason}
                  onChange={e => setSearchReason(e.target.value)}
                  placeholder="e.g. Moved out, plate confirmed on site"
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-none focus:outline-none focus:border-[var(--primary)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">Notes (optional)</label>
                <textarea
                  value={searchNotes}
                  onChange={e => setSearchNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-none focus:outline-none focus:border-[var(--primary)] resize-none"
                />
              </div>
            </>
          )}

          {tab === 'manual' && (
            <>
              <p className="text-xs text-[var(--muted)]">
                Add a vehicle that does not have a submission on file. All fields except plate are optional.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs text-[var(--muted)] mb-1">License plate *</label>
                  <input type="text" value={plate} onChange={e => setPlate(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-none focus:outline-none focus:border-[var(--primary)] font-mono uppercase" placeholder="ABC 1234" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--muted)] mb-1">Year</label>
                  <input type="text" value={year} onChange={e => setYear(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-none focus:outline-none focus:border-[var(--primary)]" placeholder="2019" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--muted)] mb-1">Color</label>
                  <input type="text" value={color} onChange={e => setColor(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-none focus:outline-none focus:border-[var(--primary)]" placeholder="Silver" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--muted)] mb-1">Make</label>
                  <input type="text" value={make} onChange={e => setMake(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-none focus:outline-none focus:border-[var(--primary)]" placeholder="Honda" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--muted)] mb-1">Model</label>
                  <input type="text" value={model} onChange={e => setModel(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-none focus:outline-none focus:border-[var(--primary)]" placeholder="Civic" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-[var(--muted)] mb-1">Tenant name</label>
                  <input type="text" value={tenantName} onChange={e => setTenantName(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-none focus:outline-none focus:border-[var(--primary)]" placeholder="Jane Smith" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--muted)] mb-1">Unit</label>
                  <input type="text" value={unit} onChange={e => setUnit(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-none focus:outline-none focus:border-[var(--primary)]" placeholder="2A" />
                </div>
                <div>
                  <label className="block text-xs text-[var(--muted)] mb-1">Building</label>
                  <input type="text" value={building} onChange={e => setBuilding(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-none focus:outline-none focus:border-[var(--primary)]" placeholder="123 Main St" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-[var(--muted)] mb-1">Reason for adding</label>
                  <input type="text" value={manualReason} onChange={e => setManualReason(e.target.value)} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-none focus:outline-none focus:border-[var(--primary)]" placeholder="e.g. Unauthorized vehicle, no permit on file" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-[var(--muted)] mb-1">Notes (optional)</label>
                  <textarea value={manualNotes} onChange={e => setManualNotes(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-none focus:outline-none focus:border-[var(--primary)] resize-none" />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--divider)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-[var(--border)] rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out"
          >
            Cancel
          </button>
          <button
            onClick={tab === 'search' ? handleSearchSubmit : handleManualSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm bg-[var(--primary)] text-white rounded-none hover:opacity-90 transition-opacity duration-200 ease-out disabled:opacity-50"
          >
            {saving ? 'Adding...' : 'Add to Tow List'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function TowListPage() {
  const [data, setData] = useState<QueueResponse | null>(null);
  const [manualRows, setManualRows] = useState<ManualRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [queueRes, manualRes] = await Promise.all([
        fetch('/api/admin/compliance/appfolio-queue'),
        fetch('/api/admin/compliance/tow-manual-entries'),
      ]);
      const [queueJson, manualJson] = await Promise.all([queueRes.json(), manualRes.json()]);
      if (!queueJson.success) {
        setError(queueJson.message || 'Failed to load tow list');
      } else {
        setError(null);
        setData(queueJson);
      }
      if (manualJson.success) setManualRows(manualJson.rows || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load tow list');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markTowed = async (submissionId: string) => {
    if (!confirm('Mark this vehicle as towed?')) return;
    const res = await fetch('/api/admin/compliance/mark-towed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId }),
    });
    const json = await res.json();
    if (!json.success) alert(json.message || 'Failed');
    load();
  };

  const clearFromList = async (submissionId: string) => {
    if (!confirm('Remove from tow list without towing?')) return;
    const res = await fetch('/api/admin/compliance/mark-towed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId, undo: true }),
    });
    const json = await res.json();
    if (!json.success) alert(json.message || 'Failed');
    load();
  };

  const revokeMoveOut = async (submissionId: string) => {
    if (!confirm('Revoke this permit (reason: moved out)? If a plate is on file it will appear on the tow list.')) return;
    const res = await fetch('/api/admin/compliance/revoke-permit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId, reason: 'moved_out' }),
    });
    const json = await res.json();
    if (!json.success) alert(json.message || 'Failed');
    load();
  };

  const manualAction = async (id: string, action: 'mark_towed' | 'clear') => {
    const label = action === 'mark_towed' ? 'Mark this vehicle as towed?' : 'Remove from tow list without towing?';
    if (!confirm(label)) return;
    const res = await fetch(`/api/admin/compliance/tow-manual-entries/${id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const json = await res.json();
    if (!json.success) alert(json.message || 'Failed');
    load();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {showAddModal && (
        <AddModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => { setShowAddModal(false); load(); }}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-serif text-[var(--primary)]">Tow List</h1>
            <span className="text-[10px] font-medium px-1.5 py-px bg-amber-100 text-amber-700 leading-none">BETA</span>
          </div>
          <p className="text-sm text-[var(--muted)] mt-1">
            Vehicles flagged for towing and auto-detected move-outs pending review.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 text-sm bg-[var(--primary)] text-white rounded-none hover:opacity-90 transition-opacity duration-200 ease-out"
          >
            + Add to Tow List
          </button>
          <a
            href="/api/admin/compliance/tow-list?format=csv"
            className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out"
          >
            Export CSV
          </a>
          <button
            onClick={load}
            disabled={loading}
            className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Section 1: Auto-flagged move-outs */}
      {data && (
        <section className="mb-8">
          <div className="mb-2">
            <h2 className="text-lg font-serif text-[var(--primary)]">
              Auto-flagged move-outs{' '}
              <span className="text-[var(--muted)] text-sm font-sans font-normal">({data.auto_flagged_moveouts.count})</span>
            </h2>
            <p className="text-xs text-[var(--muted)]">
              These appear because the unit now shows a <strong>different current tenant</strong> in the directory, but this permit is still active.
              Revoking the permit will promote the vehicle to the tow list if a plate is on file.
            </p>
          </div>
          <div className="overflow-x-auto border border-[var(--border)]">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[var(--bg-section)]">
                  <th className="px-2 py-2 text-left text-xs font-semibold text-[var(--muted)] uppercase border border-[var(--divider)]">Former Tenant</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-[var(--muted)] uppercase border border-[var(--divider)]">Unit / Building</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-[var(--muted)] uppercase border border-[var(--divider)]">Current Tenant</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-[var(--muted)] uppercase border border-[var(--divider)]">Plate</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-[var(--muted)] uppercase border border-[var(--divider)]">Vehicle</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-[var(--muted)] uppercase border border-[var(--divider)]">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.auto_flagged_moveouts.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-[var(--muted)] border border-[var(--divider)]">
                      No move-outs detected.
                    </td>
                  </tr>
                ) : (
                  data.auto_flagged_moveouts.rows.map(r => (
                    <tr key={r.submission_id} className="bg-white hover:bg-[var(--bg-section)]">
                      <td className="px-2 py-1.5 text-xs border border-[var(--divider)]">{r.full_name || '\u2014'}</td>
                      <td className="px-2 py-1.5 text-xs border border-[var(--divider)]">
                        {r.unit_number} &middot; <span className="text-[var(--muted)]">{r.building_address}</span>
                      </td>
                      <td className="px-2 py-1.5 text-xs border border-[var(--divider)]">
                        {r.current_tenant_name
                          ? <span className="text-[var(--primary)] font-medium">{r.current_tenant_name}</span>
                          : <span className="text-[var(--muted)] italic">No tenant on file</span>
                        }
                      </td>
                      <td className="px-2 py-1.5 text-xs border border-[var(--divider)] font-mono">
                        {r.vehicle_plate || <span className="text-[var(--muted)]">\u2014</span>}
                      </td>
                      <td className="px-2 py-1.5 text-xs border border-[var(--divider)]">{vehicleDesc(r)}</td>
                      <td className="px-2 py-1.5 text-xs text-right border border-[var(--divider)]">
                        <button
                          onClick={() => revokeMoveOut(r.submission_id)}
                          className="px-2 py-1 text-xs bg-red-700 text-white rounded-none hover:bg-red-800 transition-colors duration-200 ease-out"
                        >
                          Revoke &amp; add to tow list
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Section 2: Permit tow list */}
      {data && (
        <section className="mb-8">
          <div className="mb-2">
            <h2 className="text-lg font-serif text-[var(--primary)]">
              Permit tow list{' '}
              <span className="text-[var(--muted)] text-sm font-sans font-normal">({data.tow_list.count})</span>
            </h2>
            <p className="text-xs text-[var(--muted)]">
              These appear because a permit was <strong>revoked</strong> and a license plate was on file at the time &mdash;
              the vehicle was automatically promoted here. Mark as towed once action is taken, or clear if it is a false alarm.
            </p>
          </div>
          <div className="overflow-x-auto border border-[var(--border)]">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[var(--bg-section)]">
                  <th className="px-2 py-2 text-left text-xs font-semibold text-[var(--muted)] uppercase border border-[var(--divider)]">Plate</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-[var(--muted)] uppercase border border-[var(--divider)]">Vehicle</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-[var(--muted)] uppercase border border-[var(--divider)]">Unit / Building</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-[var(--muted)] uppercase border border-[var(--divider)]">Former Tenant</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold text-[var(--muted)] uppercase border border-[var(--divider)]">Why flagged</th>
                  <th className="px-2 py-2 text-right text-xs font-semibold text-[var(--muted)] uppercase border border-[var(--divider)]">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.tow_list.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-[var(--muted)] border border-[var(--divider)]">
                      Tow list is empty.
                    </td>
                  </tr>
                ) : (
                  data.tow_list.rows.map(r => (
                    <tr key={r.submission_id} className="bg-white hover:bg-[var(--bg-section)]">
                      <td className="px-2 py-1.5 text-xs border border-[var(--divider)] font-mono font-medium">
                        {r.vehicle_plate || '\u2014'}
                      </td>
                      <td className="px-2 py-1.5 text-xs border border-[var(--divider)]">{vehicleDesc(r)}</td>
                      <td className="px-2 py-1.5 text-xs border border-[var(--divider)]">
                        {r.unit_number} &middot; <span className="text-[var(--muted)]">{r.building_address}</span>
                      </td>
                      <td className="px-2 py-1.5 text-xs border border-[var(--divider)]">{r.full_name || '\u2014'}</td>
                      <td className="px-2 py-1.5 text-xs border border-[var(--divider)]">
                        <div className="font-medium text-[var(--primary)]">
                          {REVOKE_REASON_LABELS[r.permit_revoked_reason || ''] || r.permit_revoked_reason || '\u2014'}
                        </div>
                        <div className="text-[10px] text-[var(--muted)] mt-0.5">
                          Permit revoked on {formatDate(r.permit_revoked_at)}
                          {r.permit_revoked_by && ` by ${r.permit_revoked_by}`}
                          {' \u2014 plate was on file, promoted here automatically.'}
                        </div>
                        {r.permit_revoked_notes && (
                          <div className="text-[10px] text-[var(--muted)] italic mt-0.5">&ldquo;{r.permit_revoked_notes}&rdquo;</div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-right border border-[var(--divider)]">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => markTowed(r.submission_id)}
                            className="px-2 py-1 text-xs bg-red-700 text-white rounded-none hover:bg-red-800 transition-colors duration-200 ease-out"
                          >
                            Mark towed
                          </button>
                          <button
                            onClick={() => clearFromList(r.submission_id)}
                            className="px-2 py-1 text-xs border border-[var(--border)] rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out"
                          >
                            Clear
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Section 3: Manually added */}
      <section>
        <div className="mb-2">
          <h2 className="text-lg font-serif text-[var(--primary)]">
            Manually added{' '}
            <span className="text-[var(--muted)] text-sm font-sans font-normal">({manualRows.length})</span>
          </h2>
          <p className="text-xs text-[var(--muted)]">
            Vehicles added by staff &mdash; either linked to an existing submission or entered without one.
          </p>
        </div>
        <div className="overflow-x-auto border border-[var(--border)]">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-[var(--bg-section)]">
                <th className="px-2 py-2 text-left text-xs font-semibold text-[var(--muted)] uppercase border border-[var(--divider)]">Plate</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-[var(--muted)] uppercase border border-[var(--divider)]">Vehicle</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-[var(--muted)] uppercase border border-[var(--divider)]">Unit / Building</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-[var(--muted)] uppercase border border-[var(--divider)]">Tenant</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-[var(--muted)] uppercase border border-[var(--divider)]">Reason / Source</th>
                <th className="px-2 py-2 text-left text-xs font-semibold text-[var(--muted)] uppercase border border-[var(--divider)]">Added</th>
                <th className="px-2 py-2 text-right text-xs font-semibold text-[var(--muted)] uppercase border border-[var(--divider)]">Action</th>
              </tr>
            </thead>
            <tbody>
              {manualRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-[var(--muted)] border border-[var(--divider)]">
                    No manually added entries.
                  </td>
                </tr>
              ) : (
                manualRows.map(r => (
                  <tr key={r.id} className="bg-white hover:bg-[var(--bg-section)]">
                    <td className="px-2 py-1.5 text-xs border border-[var(--divider)] font-mono font-medium">
                      {r.vehicle_plate || '\u2014'}
                    </td>
                    <td className="px-2 py-1.5 text-xs border border-[var(--divider)]">{vehicleDesc(r)}</td>
                    <td className="px-2 py-1.5 text-xs border border-[var(--divider)]">
                      {r.unit_number ? `${r.unit_number}` : ''}
                      {r.unit_number && r.building_address ? ' \u00b7 ' : ''}
                      {r.building_address ? <span className="text-[var(--muted)]">{r.building_address}</span> : null}
                      {!r.unit_number && !r.building_address ? '\u2014' : null}
                    </td>
                    <td className="px-2 py-1.5 text-xs border border-[var(--divider)]">{r.tenant_name || '\u2014'}</td>
                    <td className="px-2 py-1.5 text-xs border border-[var(--divider)]">
                      <div>{r.reason || '\u2014'}</div>
                      <div className="mt-0.5">
                        <span className={`text-[10px] px-1 py-px leading-none ${
                          r.source === 'submission_search' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-[var(--muted)]'
                        }`}>
                          {r.source === 'submission_search' ? 'From submission' : 'Manual'}
                        </span>
                      </div>
                      {r.notes && <div className="text-[10px] text-[var(--muted)] italic mt-0.5">&ldquo;{r.notes}&rdquo;</div>}
                    </td>
                    <td className="px-2 py-1.5 text-xs border border-[var(--divider)] text-[var(--muted)]">
                      {formatDate(r.added_at)}
                      <div className="text-[10px]">by {r.added_by}</div>
                    </td>
                    <td className="px-2 py-1.5 text-xs text-right border border-[var(--divider)]">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => manualAction(r.id, 'mark_towed')}
                          className="px-2 py-1 text-xs bg-red-700 text-white rounded-none hover:bg-red-800 transition-colors duration-200 ease-out"
                        >
                          Mark towed
                        </button>
                        <button
                          onClick={() => manualAction(r.id, 'clear')}
                          className="px-2 py-1 text-xs border border-[var(--border)] rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out"
                        >
                          Clear
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
