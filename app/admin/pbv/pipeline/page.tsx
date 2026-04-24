'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

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
}

interface StaffUser {
  id: string;
  display_name: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FONT      = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif";
const FONT_MONO = "'IBM Plex Mono', 'Courier New', monospace";

const C = {
  bg:           '#fafaf9',
  panel:        '#ffffff',
  border:       '#e7e5e4',
  borderStrong: '#d6d3d1',
  text:         '#1c1917',
  textMuted:    '#78716c',
  textSubtle:   '#a8a29e',
  accent:       '#0f4c5c',
  accentLight:  '#e6f0f3',
  approve:      '#15803d',
  approveBg:    '#dcfce7',
  reject:       '#b91c1c',
  rejectBg:     '#fee2e2',
  warn:         '#a16207',
  warnBg:       '#fef3c7',
  amber:        '#d97706',
  red:          '#dc2626',
};

const STAGE_LABELS: Record<string, string> = {
  pre_app:           'Pre-App',
  intake:            'Intake',
  stanton_review:    'Stanton Review',
  submitted_to_hach: 'Submitted to HACH',
  hach_review:       'HACH Review',
  approved:          'Approved',
  denied:            'Denied',
  withdrawn:         'Withdrawn',
};

const BLOCKED_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  tenant:  { label: 'Tenant',  bg: '#dbeafe', color: '#1e40af' },
  stanton: { label: 'Stanton', bg: '#fed7aa', color: '#c2410c' },
  hach:    { label: 'HACH',    bg: '#ede9fe', color: '#6d28d9' },
  nobody:  { label: '\u2014',  bg: '#f3f4f6', color: '#6b7280' },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Pill({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 3, fontSize: 11,
      fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' as const,
      backgroundColor: bg, color, whiteSpace: 'nowrap' as const,
    }}>
      {label}
    </span>
  );
}

function IncomeIcon({
  status, income, limit,
}: { status: string; income: number | null; limit: number | null }) {
  const delta = income != null && limit != null ? income - limit : null;
  const tooltip = income != null
    ? `$${income.toLocaleString()} / $${(limit ?? 0).toLocaleString()} limit`
      + (delta != null ? ` (${delta >= 0 ? '+' : ''}$${Math.abs(delta).toLocaleString()})` : '')
    : 'No income data';
  const icon  = status === 'qualifies' ? '\u2713' : status === 'delta' ? '\u26a0' : status === 'over_limit' ? '\u2717' : '\u2013';
  const color = status === 'qualifies' ? C.approve : status === 'delta' ? C.warn : status === 'over_limit' ? C.reject : C.textSubtle;
  return (
    <span title={tooltip} style={{ fontFamily: FONT_MONO, fontWeight: 700, color, fontSize: 14, cursor: 'default' }}>
      {icon}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const [rows, setRows]             = useState<PipelineRow[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [toast, setToast]           = useState('');

  // Filters
  const [building, setBuilding]           = useState('');
  const [stage, setStage]                 = useState('');
  const [blocked, setBlocked]             = useState('');
  const [hasRejections, setHasRejections] = useState(false);
  const [assignee, setAssignee]           = useState('');

  // Selection
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [bulkTarget, setBulkTarget]   = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  // Inline assign
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }, []);

  const fetchRows = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError('');
    const p = new URLSearchParams();
    if (building)      p.set('building', building);
    if (stage)         p.set('stage', stage);
    if (blocked)       p.set('blocked', blocked);
    if (hasRejections) p.set('has_rejections', 'true');
    if (assignee)      p.set('assignee', assignee);
    try {
      const res  = await fetch(`/api/admin/pbv/pipeline?${p.toString()}`, { signal: ctrl.signal });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? 'Failed to load pipeline');
      setRows(data.data);
      setSelected(new Set());
    } catch (e: any) {
      if (e.name !== 'AbortError') setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [building, stage, blocked, hasRejections, assignee]);

  useEffect(() => {
    fetch('/api/admin/pbv/staff-users')
      .then((r) => r.json())
      .then((d) => { if (d.success) setStaffUsers(d.data); })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // ── Selection ─────────────────────────────────────────────────────────────

  const toggleRow = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = useCallback(() => {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }, [allSelected, rows]);

  // ── Bulk assign ───────────────────────────────────────────────────────────

  const handleBulkAssign = useCallback(async () => {
    if (!bulkTarget || selected.size === 0) return;
    setBulkLoading(true);
    try {
      const res  = await fetch('/api/admin/pbv/applications/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_ids: [...selected], assigned_to: bulkTarget }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? 'Bulk assign failed');
      showToast(`\u2713 Assigned ${data.data.assigned_count} applications to ${data.data.assigned_to_name}`);
      setBulkTarget('');
      setSelected(new Set());
      await fetchRows();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBulkLoading(false);
    }
  }, [bulkTarget, selected, showToast, fetchRows]);

  // ── Inline assign ─────────────────────────────────────────────────────────

  const handleInlineAssign = useCallback(async (appId: string, newAssignee: string | null) => {
    setAssigningId(appId);
    const prev = rows.find((r) => r.id === appId);
    setRows((rs) => rs.map((r) =>
      r.id === appId
        ? {
            ...r,
            assigned_to: newAssignee,
            assigned_to_name: newAssignee
              ? (staffUsers.find((u) => u.id === newAssignee)?.display_name ?? '...')
              : null,
          }
        : r
    ));
    try {
      const res  = await fetch(`/api/admin/pbv/applications/${appId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: newAssignee }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (prev) setRows((rs) => rs.map((r) => (r.id === appId ? { ...r, ...prev } : r)));
        setError(data.message ?? 'Assign failed');
      }
    } catch (e: any) {
      if (prev) setRows((rs) => rs.map((r) => (r.id === appId ? { ...r, ...prev } : r)));
      setError(e.message);
    } finally {
      setAssigningId(null);
    }
  }, [rows, staffUsers]);

  // ── Styling helpers ───────────────────────────────────────────────────────

  const staleStyle = (row: PipelineRow): React.CSSProperties => {
    const terminal = row.stage === 'approved' || row.stage === 'denied';
    if (!terminal && row.days_stale > 30) return { borderLeft: `3px solid ${C.red}` };
    if (!terminal && row.days_stale > 14) return { borderLeft: `3px solid ${C.amber}` };
    return { borderLeft: '3px solid transparent' };
  };

  const inputBase: React.CSSProperties = {
    padding: '5px 8px', fontSize: 12, fontFamily: FONT,
    border: `1px solid ${C.border}`, backgroundColor: C.panel,
    color: C.text, outline: 'none',
  };

  const hasFilters = !!(building || stage || blocked || hasRejections || assignee);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '28px 32px', fontFamily: FONT, maxWidth: 1380, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>PBV Pipeline</h1>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
            Operational view &middot;{' '}
            <Link href="/admin/pbv/full-applications" style={{ color: C.accent, textDecoration: 'none' }}>
              Classic list &rarr;
            </Link>
          </div>
        </div>
        <button
          onClick={fetchRows}
          style={{ padding: '6px 14px', fontSize: 12, fontFamily: FONT, fontWeight: 600, background: C.panel, border: `1px solid ${C.border}`, color: C.textMuted, cursor: 'pointer' }}
        >
          Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const, marginBottom: 12 }}>
        <input
          type="text" placeholder="Building&hellip;" value={building}
          onChange={(e) => setBuilding(e.target.value)}
          style={{ ...inputBase, width: 150 }}
        />
        <select value={stage} onChange={(e) => setStage(e.target.value)} style={{ ...inputBase, cursor: 'pointer', width: 160 }}>
          <option value="">All stages</option>
          {Object.entries(STAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={blocked} onChange={(e) => setBlocked(e.target.value)} style={{ ...inputBase, cursor: 'pointer', width: 130 }}>
          <option value="">All blocked-on</option>
          <option value="tenant">Tenant</option>
          <option value="stanton">Stanton</option>
          <option value="hach">HACH</option>
          <option value="nobody">Nobody</option>
        </select>
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)} style={{ ...inputBase, cursor: 'pointer', width: 160 }}>
          <option value="">All assignees</option>
          <option value="unassigned">Unassigned</option>
          {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.display_name}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', color: C.text }}>
          <input
            type="checkbox" checked={hasRejections}
            onChange={(e) => setHasRejections(e.target.checked)}
            style={{ accentColor: C.accent }}
          />
          Has rejections
        </label>
        {hasFilters && (
          <button
            onClick={() => { setBuilding(''); setStage(''); setBlocked(''); setHasRejections(false); setAssignee(''); }}
            style={{ padding: '5px 10px', fontSize: 11, fontFamily: FONT, fontWeight: 600, background: 'transparent', border: `1px solid ${C.border}`, color: C.textMuted, cursor: 'pointer' }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ padding: '10px 14px', background: C.rejectBg, color: C.reject, fontSize: 13, marginBottom: 12, border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      {/* Bulk action bar — sticky */}
      {selected.size > 0 && (
        <div style={{
          position: 'sticky' as const, top: 0, zIndex: 50, backgroundColor: C.accent, color: '#fff',
          padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8,
          fontSize: 13, fontWeight: 600,
        }}>
          <span>{selected.size} selected</span>
          <select
            value={bulkTarget}
            onChange={(e) => setBulkTarget(e.target.value)}
            disabled={bulkLoading}
            style={{ padding: '4px 8px', fontSize: 12, fontFamily: FONT, border: 'none', cursor: 'pointer', minWidth: 160 }}
          >
            <option value="">Assign to&hellip;</option>
            {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.display_name}</option>)}
          </select>
          <button
            onClick={handleBulkAssign}
            disabled={!bulkTarget || bulkLoading}
            style={{
              padding: '5px 12px', fontSize: 12, fontFamily: FONT, fontWeight: 700,
              background: '#fff', color: C.accent, border: 'none',
              cursor: bulkTarget ? 'pointer' : 'not-allowed',
              opacity: bulkTarget ? 1 : 0.6,
            }}
          >
            {bulkLoading ? 'Assigning\u2026' : 'Assign'}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            style={{ padding: '5px 12px', fontSize: 12, fontFamily: FONT, fontWeight: 600, background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Summary line */}
      {!loading && rows.length > 0 && (
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>
          {rows.length} application{rows.length !== 1 ? 's' : ''} &middot;{' '}
          {rows.filter((r) => r.blocked_on === 'tenant').length} on tenant &middot;{' '}
          {rows.filter((r) => r.blocked_on === 'stanton').length} on Stanton &middot;{' '}
          {rows.filter((r) => r.blocked_on === 'hach').length} on HACH &middot;{' '}
          {rows.filter((r) => r.days_stale > 14 && r.stage !== 'approved' && r.stage !== 'denied').length} stale &gt;14d
        </div>
      )}

      {/* Table */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, overflowX: 'auto' as const }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ backgroundColor: C.bg }}>
              <th style={{ padding: '9px 10px', borderBottom: `1px solid ${C.borderStrong}`, width: 32 }}>
                <input
                  type="checkbox" checked={allSelected}
                  onChange={toggleAll}
                  style={{ accentColor: C.accent, cursor: 'pointer' }}
                />
              </th>
              {['Unit', 'Tenant', 'Stage', 'Blocked On', 'Days in Stage', 'Next Action', 'Assigned To', 'Income'].map((h) => (
                <th key={h} style={{
                  padding: '9px 12px', textAlign: 'left' as const, fontWeight: 700,
                  fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em',
                  color: C.textMuted, borderBottom: `1px solid ${C.borderStrong}`, whiteSpace: 'nowrap' as const,
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} style={{ padding: 32, textAlign: 'center' as const, color: C.textMuted, fontSize: 13 }}>
                  Loading pipeline&hellip;
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: 32, textAlign: 'center' as const, color: C.textMuted, fontSize: 13 }}>
                  No applications match the current filters.
                </td>
              </tr>
            )}
            {!loading && rows.map((row) => {
              const blockedCfg = BLOCKED_CONFIG[row.blocked_on] ?? BLOCKED_CONFIG.nobody;
              const isSelected = selected.has(row.id);
              return (
                <tr
                  key={row.id}
                  style={{
                    borderBottom: `1px solid ${C.border}`,
                    backgroundColor: isSelected ? '#f0f9ff' : undefined,
                    ...staleStyle(row),
                  }}
                >
                  {/* Checkbox */}
                  <td style={{ padding: '10px 10px', textAlign: 'center' as const }}>
                    <input
                      type="checkbox" checked={isSelected}
                      onChange={() => toggleRow(row.id)}
                      style={{ accentColor: C.accent, cursor: 'pointer' }}
                    />
                  </td>

                  {/* Unit */}
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' as const }}>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.textMuted }}>
                      {row.building_address?.split(' ')[0]}
                    </div>
                    <div style={{ fontWeight: 600, color: C.text }}>Unit {row.unit_number}</div>
                    <div style={{ fontSize: 10, color: C.textSubtle, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                      {row.building_address}
                    </div>
                  </td>

                  {/* Tenant */}
                  <td style={{ padding: '10px 12px' }}>
                    <Link
                      href={`/admin/pbv/full-applications/${row.id}`}
                      style={{ fontWeight: 500, color: C.text, textDecoration: 'none', fontSize: 13 }}
                    >
                      {row.head_of_household_name}
                    </Link>
                    <div style={{ fontSize: 10, color: C.textSubtle }}>HH {row.household_size}</div>
                  </td>

                  {/* Stage */}
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' as const }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: C.text, padding: '2px 6px', background: C.bg, border: `1px solid ${C.border}` }}>
                      {STAGE_LABELS[row.stage] ?? row.stage}
                    </span>
                    {row.has_rejections && (
                      <div style={{ fontSize: 10, color: C.reject, marginTop: 2, fontWeight: 600 }}>
                        Has rejections
                      </div>
                    )}
                  </td>

                  {/* Blocked On */}
                  <td style={{ padding: '10px 12px' }}>
                    <Pill label={blockedCfg.label} bg={blockedCfg.bg} color={blockedCfg.color} />
                  </td>

                  {/* Days in Stage */}
                  <td style={{ padding: '10px 12px', fontFamily: FONT_MONO, fontSize: 12, color: row.days_in_stage > 14 ? C.amber : C.text }}>
                    {row.days_in_stage}d
                  </td>

                  {/* Next Action */}
                  <td style={{ padding: '10px 12px', color: C.text, maxWidth: 220 }}>
                    {row.next_action}
                  </td>

                  {/* Assigned To — inline dropdown */}
                  <td style={{ padding: '10px 12px' }}>
                    <select
                      value={row.assigned_to ?? ''}
                      disabled={assigningId === row.id}
                      onChange={(e) => handleInlineAssign(row.id, e.target.value || null)}
                      style={{
                        fontSize: 12, fontFamily: FONT, padding: '3px 6px',
                        border: row.assigned_to ? `1px solid ${C.border}` : `1px solid ${C.reject}`,
                        color: row.assigned_to ? C.text : C.reject,
                        fontWeight: row.assigned_to ? 400 : 700,
                        backgroundColor: row.assigned_to ? C.panel : C.rejectBg,
                        cursor: 'pointer', minWidth: 130, outline: 'none',
                        opacity: assigningId === row.id ? 0.5 : 1,
                      }}
                    >
                      <option value="">Unassigned</option>
                      {staffUsers.map((u) => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                    </select>
                  </td>

                  {/* Income */}
                  <td style={{ padding: '10px 12px', textAlign: 'center' as const }}>
                    <IncomeIcon status={row.income_status} income={row.income_total} limit={row.ami_limit} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: 11, color: C.textMuted }}>
        <span style={{ borderLeft: `3px solid ${C.amber}`, paddingLeft: 6 }}>Amber = stale &gt;14 days</span>
        <span style={{ borderLeft: `3px solid ${C.red}`, paddingLeft: 6 }}>Red = stale &gt;30 days</span>
        <span>Income: &#10003; qualifies &middot; &#9888; delta &middot; &#10007; over limit &middot; &ndash; no data</span>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed' as const, bottom: 24, right: 24, zIndex: 300,
          padding: '10px 18px', background: C.approve, color: '#fff',
          fontSize: 13, fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
