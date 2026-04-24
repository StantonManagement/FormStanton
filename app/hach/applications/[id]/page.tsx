'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const COLORS = {
  accent: '#0f4c5c',
  bg: '#fafaf9',
  panel: '#ffffff',
  border: '#e7e5e4',
  borderStrong: '#d6d3d1',
  text: '#1c1917',
  textMuted: '#78716c',
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

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function DocStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    missing:   { label: 'Missing',   bg: '#f5f5f4', color: COLORS.textMuted },
    submitted: { label: 'Submitted', bg: COLORS.infoBg,    color: COLORS.info },
    approved:  { label: 'Approved',  bg: COLORS.successBg, color: COLORS.success },
    rejected:  { label: 'Rejected',  bg: COLORS.errorBg,   color: COLORS.error },
    waived:    { label: 'Waived',    bg: '#f5f5f4',        color: COLORS.textMuted },
  };
  const s = map[status] ?? { label: status, bg: '#f5f5f4', color: COLORS.textMuted };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        background: s.bg,
        color: s.color,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  );
}

function HachStatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    pending_hach:      { label: 'Needs Review', bg: '#fef3c7', color: '#92400e' },
    under_hach_review: { label: 'In Review',    bg: COLORS.infoBg, color: COLORS.info },
    approved_by_hach:  { label: 'Approved',     bg: COLORS.successBg, color: COLORS.success },
    rejected_by_hach:  { label: 'Rejected',     bg: COLORS.errorBg,   color: COLORS.error },
  };
  const s = map[status ?? ''] ?? { label: 'Not Routed', bg: '#f5f5f4', color: COLORS.textMuted };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 12px',
        background: s.bg,
        color: s.color,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}
    >
      {s.label}
    </span>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: COLORS.panel,
        border: `1px solid ${COLORS.border}`,
        marginBottom: 20,
      }}
    >
      <div
        style={{
          padding: '12px 20px',
          borderBottom: `1px solid ${COLORS.border}`,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: COLORS.textMuted,
        }}
      >
        {title}
      </div>
      <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '160px 1fr',
        gap: 8,
        padding: '6px 0',
        borderBottom: `1px solid ${COLORS.border}`,
        fontSize: 13,
      }}
    >
      <span style={{ color: COLORS.textMuted, fontWeight: 500 }}>{label}</span>
      <span style={{ color: COLORS.text }}>{value ?? '—'}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Income panel (fetches from income-eligibility endpoint)
// ─────────────────────────────────────────────────────────────────────────────

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
      {loading && (
        <span style={{ fontSize: 13, color: COLORS.textMuted }}>Computing…</span>
      )}
      {!loading && !income && (
        <span style={{ fontSize: 13, color: COLORS.textMuted }}>
          No income data available. Sync income sources from intake form to compute.
        </span>
      )}
      {!loading && income && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 16,
              marginBottom: 16,
            }}
          >
            {[
              { label: 'Total Household Income', value: income.total_household_income != null ? `$${Number(income.total_household_income).toLocaleString()}` : '—' },
              { label: `${income.ami_pct}% AMI Limit (${income.household_size}-person)`, value: income.ami_limit != null ? `$${Number(income.ami_limit).toLocaleString()}` : '—' },
              { label: 'Delta', value: income.delta != null ? `${income.delta >= 0 ? '+' : ''}$${Math.abs(income.delta).toLocaleString()}` : '—' },
              { label: 'Within Tolerance', value: income.within_tolerance == null ? '—' : income.within_tolerance ? '✓ Yes' : '✗ No' },
            ].map((item) => (
              <div key={item.label}>
                <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>
                  {item.label}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    fontFamily: FONT_MONO,
                    color: item.label === 'Within Tolerance'
                      ? (income.within_tolerance ? COLORS.success : COLORS.error)
                      : COLORS.text,
                  }}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>
          {income.no_income_sources && (
            <div style={{ fontSize: 12, color: COLORS.warning, background: COLORS.warningBg, padding: '8px 12px', border: `1px solid #fde68a` }}>
              No income sources on file. Run intake sync before submitting for HACH review.
            </div>
          )}
          {income.member_breakdown && income.member_breakdown.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>
                Member Breakdown
              </div>
              {income.member_breakdown.map((m: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                  <span style={{ color: COLORS.text }}>{m.member_name}</span>
                  <span style={{ fontFamily: FONT_MONO, color: COLORS.text }}>${Number(m.member_annual_total).toLocaleString()}/yr</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Document row
// ─────────────────────────────────────────────────────────────────────────────

function DocumentRow({ doc }: { doc: any }) {
  const latestAction = doc.latest_action;
  const effectiveStatus = latestAction
    ? latestAction.action === 'approved' ? 'approved'
      : latestAction.action === 'rejected' ? 'rejected'
      : latestAction.action === 'waived' ? 'waived'
      : doc.status
    : doc.status;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 120px 180px',
        alignItems: 'start',
        gap: 12,
        padding: '10px 0',
        borderBottom: `1px solid ${COLORS.border}`,
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>
          {doc.label}
          {doc.file_name && (
            <span style={{ fontSize: 11, color: COLORS.textMuted, marginLeft: 8, fontFamily: FONT_MONO }}>
              {doc.file_name}
            </span>
          )}
        </div>
        {latestAction?.rejection_reason && (
          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              color: COLORS.error,
              background: COLORS.errorBg,
              padding: '4px 8px',
              border: `1px solid #fecaca`,
            }}
          >
            Rejection reason: {latestAction.rejection_reason}
          </div>
        )}
      </div>
      <div style={{ paddingTop: 2 }}>
        <DocStatusBadge status={effectiveStatus} />
      </div>
      <div style={{ fontSize: 11, color: COLORS.textMuted, paddingTop: 4 }}>
        {latestAction ? (
          <span>
            {latestAction.reviewer_name} &middot;{' '}
            {new Date(latestAction.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function HachPacketPage() {
  const params = useParams();
  const id = params?.id as string;

  const [packet, setPacket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetch(`/api/hach/applications/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setPacket(d.data);
        else setError(d.message || 'Failed to load packet');
      })
      .catch(() => setError('Network error — could not load packet'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: '48px 32px', fontFamily: FONT, color: COLORS.textMuted, fontSize: 14 }}>
        Loading packet…
      </div>
    );
  }

  if (error || !packet) {
    return (
      <div style={{ padding: '48px 32px', fontFamily: FONT }}>
        <div style={{ background: COLORS.errorBg, color: COLORS.error, padding: '12px 16px', fontSize: 13, border: `1px solid #fecaca`, maxWidth: 600 }}>
          {error || 'Application not found'}
        </div>
        <Link href="/hach" style={{ display: 'inline-block', marginTop: 16, fontSize: 13, color: COLORS.accent }}>
          ← Back to queue
        </Link>
      </div>
    );
  }

  const { application: app, members, documents } = packet;

  const submittedDate = new Date(app.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 24px', fontFamily: FONT }}>

      {/* Back nav */}
      <Link
        href="/hach"
        style={{ fontSize: 12, color: COLORS.textMuted, textDecoration: 'none', display: 'inline-block', marginBottom: 20 }}
      >
        ← Review Queue
      </Link>

      {/* Header */}
      <div
        style={{
          background: COLORS.panel,
          border: `1px solid ${COLORS.border}`,
          padding: '20px 24px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: COLORS.text, margin: 0 }}>
            {app.head_of_household_name}
          </h1>
          <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 4 }}>
            {app.building_address}, Unit {app.unit_number} &middot; {app.household_size}-person household &middot; Submitted {submittedDate}
          </div>
        </div>
        <div style={{ flexShrink: 0, paddingTop: 4 }}>
          <HachStatusBadge status={app.hach_review_status} />
        </div>
      </div>

      {/* Doc progress bar */}
      {(() => {
        const total = documents.length;
        const approved = documents.filter((d: any) => d.latest_action?.action === 'approved' || (!d.latest_action && d.status === 'approved')).length;
        const pct = total > 0 ? Math.round((approved / total) * 100) : 0;
        return (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>
              <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Document Completion</span>
              <span>{approved} / {total} approved</span>
            </div>
            <div style={{ height: 6, background: COLORS.border, position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: pct === 100 ? COLORS.success : COLORS.accent, transition: 'width 300ms ease-out' }} />
            </div>
          </div>
        );
      })()}

      {/* Income eligibility */}
      <IncomePanel applicationId={id} />

      {/* Household members */}
      <Panel title="Household Composition">
        {members.length === 0 ? (
          <span style={{ fontSize: 13, color: COLORS.textMuted }}>No household members on file</span>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['#', 'Name', 'Relationship', 'Date of Birth', 'Income Sources', 'Annual Income'].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '6px 8px',
                      fontSize: 11,
                      fontWeight: 600,
                      color: COLORS.textMuted,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      borderBottom: `1px solid ${COLORS.borderStrong}`,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m: any) => (
                <tr key={m.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: '8px', color: COLORS.textMuted }}>{m.slot}</td>
                  <td style={{ padding: '8px', fontWeight: 500, color: COLORS.text }}>{m.name}</td>
                  <td style={{ padding: '8px', color: COLORS.text, textTransform: 'capitalize' }}>{m.relationship}</td>
                  <td style={{ padding: '8px', color: COLORS.text, fontFamily: FONT_MONO, fontSize: 12 }}>
                    {m.date_of_birth ? new Date(m.date_of_birth).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    {m.age != null ? ` (${m.age})` : ''}
                  </td>
                  <td style={{ padding: '8px', color: COLORS.text }}>
                    {(m.income_sources ?? []).length > 0
                      ? (m.income_sources as string[]).join(', ')
                      : '—'}
                  </td>
                  <td style={{ padding: '8px', fontFamily: FONT_MONO, fontSize: 12, color: COLORS.text }}>
                    {m.annual_income != null && m.annual_income > 0
                      ? `$${Number(m.annual_income).toLocaleString()}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {/* Documents */}
      <Panel title={`Documents (${documents.length})`}>
        {documents.length === 0 ? (
          <span style={{ fontSize: 13, color: COLORS.textMuted }}>No document slots found</span>
        ) : (
          <div>
            {documents.map((doc: any) => (
              <DocumentRow key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </Panel>

      {/* Phase 2 notice */}
      <div
        style={{
          background: '#fafaf9',
          border: `1px solid ${COLORS.border}`,
          padding: '12px 20px',
          fontSize: 12,
          color: COLORS.textMuted,
          textAlign: 'center',
        }}
      >
        Approve / Reject actions available in Phase 2
      </div>
    </div>
  );
}
