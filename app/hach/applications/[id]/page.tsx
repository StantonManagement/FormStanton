'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const COLORS = {
  accent: '#0f4c5c',
  accentLight: '#e6f0f3',
  bg: '#fafaf9',
  panel: '#ffffff',
  border: '#e7e5e4',
  borderStrong: '#d6d3d1',
  text: '#1c1917',
  textMuted: '#78716c',
  textSubtle: '#a8a29e',
  approve: '#15803d',
  approveLight: '#dcfce7',
  reject: '#b91c1c',
  rejectLight: '#fee2e2',
  pending: '#a16207',
  pendingLight: '#fef9c3',
  missing: '#9ca3af',
  missingLight: '#f3f4f6',
  waived: '#6366f1',
  waivedLight: '#e0e7ff',
  success: '#16a34a',
  successBg: '#f0fdf4',
  warning: '#d97706',
  warningBg: '#fffbeb',
  error: '#dc2626',
  errorBg: '#fef2f2',
  infoBg: '#eff6ff',
  info: '#1d4ed8',
};
const FONT = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif";
const FONT_MONO = "'IBM Plex Mono', 'Courier New', monospace";

function StatusBadge({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) {
  const config: Record<string, { label: string; bg: string; color: string }> = {
    approved:  { label: 'Approved',        bg: COLORS.approveLight, color: COLORS.approve },
    pending:   { label: 'Awaiting Review', bg: COLORS.pendingLight, color: COLORS.pending },
    submitted: { label: 'Awaiting Review', bg: COLORS.pendingLight, color: COLORS.pending },
    rejected:  { label: 'Rejected',        bg: COLORS.rejectLight,  color: COLORS.reject },
    missing:   { label: 'Not Uploaded',    bg: COLORS.missingLight, color: COLORS.missing },
    waived:    { label: 'Waived',          bg: COLORS.waivedLight,  color: COLORS.waived },
  };
  const s = config[status] ?? { label: status, bg: COLORS.missingLight, color: COLORS.missing };
  return (
    <span style={{
      display: 'inline-block',
      padding: size === 'sm' ? '2px 7px' : '3px 9px',
      fontSize: size === 'sm' ? 10 : 11,
      fontWeight: 600, backgroundColor: s.bg, color: s.color,
      letterSpacing: '0.02em', textTransform: 'uppercase' as const, whiteSpace: 'nowrap' as const,
    }}>
      {s.label}
    </span>
  );
}

function HachStatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    pending_hach:      { label: 'Needs Review', bg: '#fef3c7', color: '#92400e' },
    under_hach_review: { label: 'In Review',    bg: COLORS.infoBg, color: COLORS.info },
    approved_by_hach:  { label: 'Approved',     bg: COLORS.successBg, color: COLORS.success },
    rejected_by_hach:  { label: 'Rejected',     bg: COLORS.errorBg, color: COLORS.error },
  };
  const s = map[status ?? ''] ?? { label: 'Not Routed', bg: '#f5f5f4', color: COLORS.textMuted };
  return (
    <span style={{
      display: 'inline-block', padding: '4px 12px',
      background: s.bg, color: s.color,
      fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' as const,
    }}>
      {s.label}
    </span>
  );
}

function Button({
  children, variant = 'secondary', size = 'md', onClick, disabled, style: extra = {},
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'approve' | 'reject' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const vars = {
    primary:   { bg: COLORS.accent,  color: '#fff',        border: COLORS.accent,       hover: '#0a3a47' },
    approve:   { bg: COLORS.approve, color: '#fff',        border: COLORS.approve,      hover: '#166534' },
    reject:    { bg: '#fff',         color: COLORS.reject, border: COLORS.reject,       hover: COLORS.rejectLight },
    secondary: { bg: '#fff',         color: COLORS.text,   border: COLORS.borderStrong, hover: '#f5f5f4' },
    ghost:     { bg: 'transparent',  color: COLORS.textMuted, border: 'transparent',    hover: '#f5f5f4' },
  }[variant];
  const sz = { sm: { padding: '5px 10px', fontSize: 12 }, md: { padding: '7px 14px', fontSize: 13 }, lg: { padding: '10px 18px', fontSize: 14 } }[size];
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        ...sz, backgroundColor: h && !disabled ? vars.hover : vars.bg,
        color: vars.color, border: `1px solid ${vars.border}`,
        borderRadius: 4, fontWeight: 600, fontFamily: FONT,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, transition: 'background-color 0.12s ease', ...extra,
      }}
    >
      {children}
    </button>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, marginBottom: 20 }}>
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${COLORS.border}`, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: COLORS.textMuted }}>
        {title}
      </div>
      <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
  );
}

interface ToastData { message: string; type: 'success' | 'error' }

function ToastBar({ toast }: { toast: ToastData | null }) {
  return (
    <div style={{
      position: 'fixed' as const, bottom: 52, right: 24,
      padding: '10px 18px',
      background: toast?.type === 'success' ? COLORS.approve : COLORS.reject,
      color: '#fff', borderRadius: 4, fontSize: 13, fontWeight: 600, fontFamily: FONT,
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      transition: 'opacity 0.25s ease, transform 0.25s ease',
      opacity: toast ? 1 : 0,
      transform: toast ? 'translateY(0)' : 'translateY(8px)',
      pointerEvents: 'none' as const, zIndex: 200,
    }}>
      {toast?.message ?? ''}
    </div>
  );
}

function IncomePanel({ applicationId }: { applicationId: string }) {
  const [income, setIncome] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`/api/pbv/applications/${applicationId}/income-eligibility`)
      .then((r) => r.json())
      .then((d) => setIncome(d.success ? d.data : null))
      .catch(() => setIncome(null))
      .finally(() => setLoading(false));
  }, [applicationId]);
  return (
    <Panel title="Income Eligibility">
      {loading && <span style={{ fontSize: 13, color: COLORS.textMuted }}>Computing…</span>}
      {!loading && !income && <span style={{ fontSize: 13, color: COLORS.textMuted }}>No income data available.</span>}
      {!loading && income && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: 'Total Income', value: income.total_household_income != null ? `$${Number(income.total_household_income).toLocaleString()}` : '—' },
            { label: `${income.ami_pct}% AMI (${income.household_size}-person)`, value: income.ami_limit != null ? `$${Number(income.ami_limit).toLocaleString()}` : '—' },
            { label: 'Delta', value: income.delta != null ? `${income.delta >= 0 ? '+' : ''}$${Math.abs(income.delta).toLocaleString()}` : '—' },
            { label: 'Within Tolerance', value: income.within_tolerance == null ? '—' : income.within_tolerance ? '? Yes' : '? No' },
          ].map((item) => (
            <div key={item.label}>
              <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' as const, marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: FONT_MONO, color: item.label === 'Within Tolerance' ? (income.within_tolerance ? COLORS.success : COLORS.error) : COLORS.text }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function getEffectiveStatus(doc: any): string {
  const la = doc.latest_action;
  if (!la) return doc.status ?? 'pending';
  if (la.action === 'approved') return 'approved';
  if (la.action === 'rejected') return 'rejected';
  if (la.action === 'waived') return 'waived';
  return doc.status ?? 'pending';
}

function DocumentRow({
  doc, isFocused, isApproving, onApprove, onView, onClick, rowRef,
}: {
  doc: any; isFocused: boolean; isApproving: boolean;
  onApprove: (id: string) => void; onView: (doc: any) => void;
  onClick: () => void; rowRef?: (el: HTMLDivElement | null) => void;
}) {
  const [hover, setHover] = useState(false);
  const eff = getEffectiveStatus(doc);
  const canApprove = eff !== 'approved' && eff !== 'waived' && eff !== 'missing';
  const canView = !!(doc.storage_path || doc.file_name);

  return (
    <div
      ref={rowRef}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      data-doc-row="true"
      style={{
        padding: '12px 16px', borderTop: `1px solid ${COLORS.border}`, cursor: 'pointer',
        backgroundColor: isFocused ? COLORS.accentLight : (hover ? '#fafaf9' : 'transparent'),
        borderLeft: isFocused ? `3px solid ${COLORS.accent}` : '3px solid transparent',
        transition: 'all 0.1s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: COLORS.text }}>{doc.label}</span>
            <StatusBadge status={eff} size="sm" />
          </div>
          {doc.file_name && (
            <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: FONT_MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
              {doc.file_name}
            </div>
          )}
          {!doc.file_name && eff === 'missing' && (
            <div style={{ fontSize: 11, color: COLORS.textMuted, fontStyle: 'italic' }}>Not yet uploaded</div>
          )}
          {doc.latest_action?.rejection_reason && (
            <div style={{ marginTop: 4, fontSize: 11, color: COLORS.reject, background: COLORS.rejectLight, padding: '3px 8px', display: 'inline-block' }}>
              {doc.latest_action.rejection_reason}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {canView && (
            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onView(doc); }}>View</Button>
          )}
          {canApprove && (
            <Button size="sm" variant="approve" disabled={isApproving} onClick={(e) => { e.stopPropagation(); onApprove(doc.id); }}>
              {isApproving ? '…' : 'Approve'}
            </Button>
          )}
        </div>
      </div>
      {doc.latest_action && (
        <div style={{ fontSize: 11, color: COLORS.textSubtle, marginTop: 6 }}>
          {doc.latest_action.action.charAt(0).toUpperCase() + doc.latest_action.action.slice(1)} by {doc.latest_action.reviewer_name}
          {doc.latest_action.created_at ? ` · ${new Date(doc.latest_action.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
        </div>
      )}
    </div>
  );
}

export default function HachPacketPage() {
  const params = useParams();
  const id = params?.id as string;

  const [packet, setPacket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [documents, setDocuments] = useState<any[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [focusedDocIdx, setFocusedDocIdx] = useState<number>(-1);
  const [viewingDoc, setViewingDoc] = useState<any>(null);
  const docRowRefs = useRef<(HTMLDivElement | null)[]>([]);

  const showToast = useCallback((message: string, type: ToastData['type'] = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/hach/applications/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) { setPacket(d.data); setDocuments(d.data.documents ?? []); }
        else setError(d.message || 'Failed to load packet');
      })
      .catch(() => setError('Network error — could not load packet'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleApprove = useCallback(async (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;
    const snapshot = documents;
    setDocuments((prev) => prev.map((d) =>
      d.id === docId ? { ...d, latest_action: { action: 'approved', reviewer_name: 'You', created_at: new Date().toISOString(), rejection_reason: null } } : d
    ));
    setApprovingId(docId);
    try {
      const res = await fetch(`/api/hach/documents/${docId}/approve`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setDocuments(snapshot);
        showToast(data.message || 'Approval failed', 'error');
        return;
      }
      showToast(`? Approved · ${doc.label}`, 'success');
    } catch {
      setDocuments(snapshot);
      showToast('Network error — approval not saved', 'error');
    } finally {
      setApprovingId(null);
    }
  }, [documents, showToast]);

  if (loading) return <div style={{ padding: '48px 32px', fontFamily: FONT, color: COLORS.textMuted, fontSize: 14 }}>Loading packet…</div>;

  if (error || !packet) {
    return (
      <div style={{ padding: '48px 32px', fontFamily: FONT }}>
        <div style={{ background: COLORS.errorBg, color: COLORS.error, padding: '12px 16px', fontSize: 13, border: '1px solid #fecaca', maxWidth: 600 }}>{error || 'Application not found'}</div>
        <Link href="/hach" style={{ display: 'inline-block', marginTop: 16, fontSize: 13, color: COLORS.accent }}>? Back to queue</Link>
      </div>
    );
  }

  const { application: app, members } = packet;
  const submittedDate = new Date(app.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const grouped = documents.reduce<Record<string, any[]>>((acc, doc) => {
    const cat = doc.category ?? doc.doc_type ?? 'Documents';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {});

  const progress = documents.reduce(
    (acc, doc) => {
      acc.total++;
      const eff = getEffectiveStatus(doc);
      if (eff === 'approved') acc.approved++;
      else if (eff === 'rejected') acc.rejected++;
      else if (eff === 'waived') acc.waived++;
      else if (eff === 'missing') acc.missing++;
      else acc.pending++;
      return acc;
    },
    { approved: 0, pending: 0, rejected: 0, waived: 0, missing: 0, total: 0 }
  );

  const pct = progress.total > 0 ? Math.round((progress.approved / progress.total) * 100) : 0;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 24px 80px', fontFamily: FONT }}>
      <Link href="/hach" style={{ fontSize: 12, color: COLORS.textMuted, textDecoration: 'none', display: 'inline-block', marginBottom: 20 }}>
        ? Review Queue
      </Link>

      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: COLORS.text, margin: 0 }}>{app.head_of_household_name}</h1>
          <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 4 }}>
            {app.building_address}, Unit {app.unit_number} &middot; {app.household_size}-person household &middot; Submitted {submittedDate}
          </div>
        </div>
        <div style={{ flexShrink: 0, paddingTop: 4 }}><HachStatusBadge status={app.hach_review_status} /></div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>
          <span style={{ fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Document Completion</span>
          <span>{progress.approved} / {progress.total} approved</span>
        </div>
        <div style={{ height: 6, background: COLORS.border, position: 'relative' as const }}>
          <div style={{ position: 'absolute' as const, left: 0, top: 0, bottom: 0, width: `${pct}%`, background: pct === 100 ? COLORS.success : COLORS.accent, transition: 'width 300ms ease-out' }} />
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 11, color: COLORS.textMuted }}>
          <span><strong style={{ color: COLORS.approve }}>{progress.approved}</strong> approved</span>
          <span><strong style={{ color: COLORS.pending }}>{progress.pending}</strong> awaiting</span>
          <span><strong style={{ color: COLORS.reject }}>{progress.rejected}</strong> rejected</span>
          <span><strong style={{ color: COLORS.missing }}>{progress.missing}</strong> missing</span>
          <span><strong style={{ color: COLORS.waived }}>{progress.waived}</strong> waived</span>
        </div>
      </div>

      <IncomePanel applicationId={id} />

      <Panel title="Household Composition">
        {members.length === 0 ? (
          <span style={{ fontSize: 13, color: COLORS.textMuted }}>No household members on file</span>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['#', 'Name', 'Relationship', 'Date of Birth', 'Income Sources', 'Annual Income'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, fontWeight: 600, color: COLORS.textMuted, letterSpacing: '0.04em', textTransform: 'uppercase' as const, borderBottom: `1px solid ${COLORS.borderStrong}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m: any) => (
                <tr key={m.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: '8px', color: COLORS.textMuted }}>{m.slot}</td>
                  <td style={{ padding: '8px', fontWeight: 500, color: COLORS.text }}>{m.name}</td>
                  <td style={{ padding: '8px', color: COLORS.text, textTransform: 'capitalize' as const }}>{m.relationship}</td>
                  <td style={{ padding: '8px', color: COLORS.text, fontFamily: FONT_MONO, fontSize: 12 }}>
                    {m.date_of_birth ? new Date(m.date_of_birth).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    {m.age != null ? ` (${m.age})` : ''}
                  </td>
                  <td style={{ padding: '8px', color: COLORS.text }}>{(m.income_sources ?? []).length > 0 ? (m.income_sources as string[]).join(', ') : '—'}</td>
                  <td style={{ padding: '8px', fontFamily: FONT_MONO, fontSize: 12, color: COLORS.text }}>
                    {m.annual_income != null && m.annual_income > 0 ? `$${Number(m.annual_income).toLocaleString()}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {Object.entries(grouped).map(([category, catDocs]) => (
        <div key={category} style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', backgroundColor: '#fafaf9', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: COLORS.textMuted }}>{category}</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: FONT_MONO }}>
              {catDocs.filter((d) => getEffectiveStatus(d) === 'approved').length}/{catDocs.filter((d) => getEffectiveStatus(d) !== 'waived').length} approved
            </div>
          </div>
          {catDocs.map((doc) => {
            const gIdx = documents.findIndex((d) => d.id === doc.id);
            return (
              <DocumentRow
                key={doc.id}
                doc={doc}
                isFocused={focusedDocIdx === gIdx}
                isApproving={approvingId === doc.id}
                onApprove={handleApprove}
                onView={setViewingDoc}
                onClick={() => setFocusedDocIdx(gIdx)}
                rowRef={(el) => { docRowRefs.current[gIdx] = el; }}
              />
            );
          })}
        </div>
      ))}

      <ToastBar toast={toast} />
    </div>
  );
}
