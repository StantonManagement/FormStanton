'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';

const COLORS = {
  accent: '#0f4c5c',
  bg: '#fafaf9',
  panel: '#ffffff',
  border: '#e7e5e4',
  borderStrong: '#d6d3d1',
  text: '#1c1917',
  textMuted: '#78716c',
  textSubtle: '#a8a29e',
  error: '#dc2626',
  errorBg: '#fef2f2',
  infoBg: '#eff6ff',
  info: '#1d4ed8',
};
const FONT = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif";
const FONT_MONO = "'IBM Plex Mono', 'Courier New', monospace";

interface AuditEntry {
  id: string;
  user_id: string | null;
  username: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
  user_type: string | null;
  user_agent: string | null;
}

interface HachUser { id: string; name: string }

interface ApiData {
  entries: AuditEntry[];
  total: number;
  page: number;
  has_more: boolean;
  actions: string[];
  hach_users: HachUser[];
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit',
  });
}

function ActionBadge({ action }: { action: string }) {
  const isWrite = action.includes('approved') || action.includes('deactivated') || action.includes('invited') || action.includes('created') || action.includes('rejected') || action.includes('waived');
  const isAuth = action.startsWith('auth.');
  const bg = isAuth ? '#fef3c7' : isWrite ? '#ede9fe' : '#f1f5f9';
  const color = isAuth ? '#92400e' : isWrite ? '#5b21b6' : COLORS.textMuted;
  return (
    <code style={{
      display: 'inline-block', padding: '2px 6px', fontSize: 11, fontWeight: 600,
      background: bg, color, fontFamily: FONT_MONO, letterSpacing: 0,
    }}>
      {action}
    </code>
  );
}

function ExpandableDetails({ details }: { details: Record<string, any> | null }) {
  const [open, setOpen] = useState(false);
  if (!details || Object.keys(details).length === 0) {
    return <span style={{ color: COLORS.textSubtle, fontSize: 11 }}>—</span>;
  }
  const preview = Object.entries(details)
    .slice(0, 2)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? '[…]' : String(v).slice(0, 30)}`)
    .join(', ');
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontSize: 11, color: COLORS.info, fontFamily: FONT_MONO,
          textDecoration: 'underline', textAlign: 'left',
        }}
      >
        {open ? '▲ hide' : `▼ ${preview.length > 60 ? preview.slice(0, 60) + '…' : preview}`}
      </button>
      {open && (
        <pre style={{
          marginTop: 6, padding: '8px 10px', background: '#f5f5f4',
          border: `1px solid ${COLORS.border}`, fontSize: 11,
          fontFamily: FONT_MONO, color: COLORS.text,
          whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxWidth: 320,
        }}>
          {JSON.stringify(details, null, 2)}
        </pre>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600,
  color: COLORS.textMuted, letterSpacing: '0.04em', textTransform: 'uppercase',
  borderBottom: `1px solid ${COLORS.borderStrong}`, whiteSpace: 'nowrap',
  position: 'sticky', top: 0, background: COLORS.panel, zIndex: 2,
};

function td(extra?: React.CSSProperties): React.CSSProperties {
  return {
    padding: '9px 12px', fontSize: 12, color: COLORS.text,
    borderBottom: `1px solid ${COLORS.border}`, verticalAlign: 'top',
    ...extra,
  };
}

// ---- Date preset helpers ----

function daysAgoIso(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// ---- Filter bar ----

interface Filters {
  dateFrom: string;
  dateTo: string;
  userId: string;
  action: string;
}

function FilterBar({
  filters,
  onChange,
  actions,
  hachUsers,
  loading,
}: {
  filters: Filters;
  onChange: (f: Partial<Filters>) => void;
  actions: string[];
  hachUsers: HachUser[];
  loading: boolean;
}) {
  const selectStyle: React.CSSProperties = {
    padding: '6px 8px', fontSize: 12, fontFamily: FONT, color: COLORS.text,
    border: `1px solid ${COLORS.borderStrong}`, borderRadius: 0,
    background: '#fff', cursor: 'pointer', minWidth: 120,
  };
  const inputStyle: React.CSSProperties = { ...selectStyle, minWidth: 110 };

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end',
      padding: '12px 16px', background: COLORS.panel, border: `1px solid ${COLORS.border}`,
      borderBottom: 'none', marginTop: 0,
    }}>
      {/* Date presets */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>Preset</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { label: '7d', days: 7 },
            { label: '30d', days: 30 },
            { label: '90d', days: 90 },
          ].map(({ label, days }) => (
            <button
              key={label}
              onClick={() => onChange({ dateFrom: daysAgoIso(days), dateTo: todayIso() })}
              style={{
                padding: '5px 10px', fontSize: 11, fontWeight: 600, borderRadius: 0,
                background: '#fff', color: COLORS.textMuted, border: `1px solid ${COLORS.border}`,
                cursor: 'pointer', fontFamily: FONT,
              }}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => onChange({ dateFrom: '', dateTo: '' })}
            style={{
              padding: '5px 10px', fontSize: 11, fontWeight: 600, borderRadius: 0,
              background: '#fff', color: COLORS.textMuted, border: `1px solid ${COLORS.border}`,
              cursor: 'pointer', fontFamily: FONT,
            }}
          >
            All
          </button>
        </div>
      </div>

      {/* Date range */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>From</div>
        <input type="date" value={filters.dateFrom} onChange={(e) => onChange({ dateFrom: e.target.value })} style={inputStyle} />
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>To</div>
        <input type="date" value={filters.dateTo} onChange={(e) => onChange({ dateTo: e.target.value })} style={inputStyle} />
      </div>

      {/* User */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>User</div>
        <select value={filters.userId} onChange={(e) => onChange({ userId: e.target.value })} style={selectStyle}>
          <option value="">All users</option>
          {hachUsers.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>

      {/* Action */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>Action</div>
        <select value={filters.action} onChange={(e) => onChange({ action: e.target.value })} style={selectStyle}>
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div style={{ fontSize: 12, color: COLORS.textMuted, paddingBottom: 6 }}>Loading…</div>
      )}
    </div>
  );
}

// ---- Main Page ----

export default function AuditLogPage() {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState('');
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<Filters>({
    dateFrom: daysAgoIso(30),
    dateTo: todayIso(),
    userId: '',
    action: '',
  });
  const abortRef = useRef<AbortController | null>(null);

  const loadData = useCallback(async (f: Filters, pg: number) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pg) });
      if (f.dateFrom) params.set('date_from', f.dateFrom);
      if (f.dateTo) params.set('date_to', f.dateTo);
      if (f.userId) params.set('user_id', f.userId);
      if (f.action) params.set('action', f.action);

      const res = await fetch(`/api/hach/admin/audit-log?${params}`, { signal: controller.signal });

      if (res.status === 403) {
        setAccessError('This page is only accessible to HACH admins.');
        return;
      }
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err: any) {
      if (err.name !== 'AbortError') console.error('[audit-log] load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(filters, page);
  }, [filters, page, loadData]);

  function handleFilterChange(partial: Partial<Filters>) {
    setPage(0);
    setFilters((prev) => ({ ...prev, ...partial }));
  }

  if (!loading && accessError) {
    return (
      <div style={{ padding: '48px 32px', fontFamily: FONT }}>
        <div style={{ background: COLORS.errorBg, color: COLORS.error, padding: '12px 16px', fontSize: 13, border: '1px solid #fecaca', maxWidth: 480 }}>
          {accessError}
        </div>
        <Link href="/hach" style={{ display: 'inline-block', marginTop: 16, fontSize: 13, color: COLORS.accent }}>Back to queue</Link>
      </div>
    );
  }

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const actions = data?.actions ?? [];
  const hachUsers = data?.hach_users ?? [];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px', fontFamily: FONT }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/hach" style={{ fontSize: 12, color: COLORS.textMuted, textDecoration: 'none' }}>← Back to queue</Link>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: COLORS.text, margin: '6px 0 4px' }}>Audit Log</h1>
        <p style={{ fontSize: 13, color: COLORS.textMuted, margin: 0 }}>
          All actions taken by HACH reviewers and admins · {total.toLocaleString()} matching entries
        </p>
      </div>

      <FilterBar
        filters={filters}
        onChange={handleFilterChange}
        actions={actions}
        hachUsers={hachUsers}
        loading={loading}
      />

      <div style={{ border: `1px solid ${COLORS.border}`, background: COLORS.panel, overflowX: 'auto' }}>
        {entries.length === 0 && !loading ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: COLORS.textMuted, fontSize: 13 }}>
            No audit entries match the current filters.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Timestamp</th>
                <th style={th}>User</th>
                <th style={th}>Action</th>
                <th style={th}>Entity</th>
                <th style={th}>Details</th>
                <th style={th}>IP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isApplicationEntity =
                  entry.entity_type === 'application' && entry.entity_id;
                return (
                  <tr key={entry.id}>
                    <td style={td({ fontFamily: FONT_MONO, fontSize: 11, whiteSpace: 'nowrap', color: COLORS.textMuted })}>
                      {fmtDateTime(entry.created_at)}
                    </td>
                    <td style={td()}>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{entry.username}</div>
                      {entry.user_type && (
                        <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>{entry.user_type}</div>
                      )}
                    </td>
                    <td style={td({ whiteSpace: 'nowrap' })}>
                      <ActionBadge action={entry.action} />
                    </td>
                    <td style={td({ fontSize: 11 })}>
                      {entry.entity_type && (
                        <div style={{ color: COLORS.textMuted, marginBottom: 2 }}>{entry.entity_type}</div>
                      )}
                      {entry.entity_id && (
                        isApplicationEntity ? (
                          <Link
                            href={`/hach/applications/${entry.entity_id}`}
                            style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.info }}
                          >
                            {entry.entity_id.slice(0, 8)}…
                          </Link>
                        ) : (
                          <code style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.textMuted }}>
                            {entry.entity_id.slice(0, 8)}…
                          </code>
                        )
                      )}
                      {!entry.entity_type && !entry.entity_id && (
                        <span style={{ color: COLORS.textSubtle }}>—</span>
                      )}
                    </td>
                    <td style={td({ maxWidth: 280 })}>
                      <ExpandableDetails details={entry.details} />
                    </td>
                    <td style={td({ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.textSubtle, whiteSpace: 'nowrap' })}>
                      {entry.ip_address ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {(page > 0 || (data?.has_more ?? false)) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, fontSize: 12, color: COLORS.textMuted }}>
          <span>
            Showing {page * 50 + 1}–{Math.min((page + 1) * 50, total)} of {total.toLocaleString()}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0 || loading}
              style={{
                padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 0,
                background: '#fff', color: COLORS.text, border: `1px solid ${COLORS.borderStrong}`,
                cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1,
                fontFamily: FONT,
              }}
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!data?.has_more || loading}
              style={{
                padding: '6px 14px', fontSize: 12, fontWeight: 600, borderRadius: 0,
                background: COLORS.accent, color: '#fff', border: 'none',
                cursor: !data?.has_more ? 'not-allowed' : 'pointer', opacity: !data?.has_more ? 0.4 : 1,
                fontFamily: FONT,
              }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
