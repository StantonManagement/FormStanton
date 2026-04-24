'use client';

import { useEffect, useState } from 'react';
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
};
const FONT = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif";

function statusBadge(status: string | null) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    pending_hach:      { label: 'Needs Review', bg: '#fef3c7', color: '#92400e' },
    under_hach_review: { label: 'In Review',    bg: '#dbeafe', color: '#1e40af' },
    approved_by_hach:  { label: 'Approved',     bg: COLORS.successBg, color: COLORS.success },
    rejected_by_hach:  { label: 'Rejected',     bg: COLORS.errorBg,   color: COLORS.error },
  };
  const s = map[status ?? ''] ?? { label: status ?? 'Unknown', bg: '#f5f5f4', color: COLORS.textMuted };
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
      }}
    >
      {s.label}
    </span>
  );
}

function docBadge(label: string, count: number, color: string) {
  if (count === 0) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 7px',
        border: `1px solid ${color}30`,
        color,
        fontSize: 11,
        fontWeight: 500,
        marginRight: 6,
      }}
    >
      {count} {label}
    </span>
  );
}

interface QueueApp {
  id: string;
  head_of_household_name: string;
  building_address: string;
  unit_number: string;
  household_size: number;
  created_at: string;
  hach_review_status: string;
  doc_summary: { total: number; approved: number; rejected: number; missing: number; submitted: number };
}

interface QueueData {
  needs_first_review: QueueApp[];
  awaiting_response: QueueApp[];
  approved: QueueApp[];
}

function AppRow({ app }: { app: QueueApp }) {
  const submitted = new Date(app.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const ds = app.doc_summary;
  return (
    <Link
      href={`/hach/applications/${app.id}`}
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1.5fr auto auto',
          alignItems: 'center',
          gap: 16,
          padding: '14px 20px',
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.panel,
          cursor: 'pointer',
          transition: 'background 150ms ease-out',
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = '#f9fafb')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = COLORS.panel)}
      >
        {/* Name + address */}
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text }}>
            {app.head_of_household_name}
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>
            {app.building_address}, Unit {app.unit_number} &middot; {app.household_size} person household
          </div>
        </div>

        {/* Doc summary */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          {docBadge('approved', ds.approved, COLORS.success)}
          {docBadge('rejected', ds.rejected, COLORS.error)}
          {docBadge('pending', ds.missing + ds.submitted, COLORS.textMuted)}
          {ds.total > 0 && (
            <span style={{ fontSize: 11, color: COLORS.textMuted, marginLeft: 2 }}>
              / {ds.total} docs
            </span>
          )}
        </div>

        {/* Submitted date */}
        <div style={{ fontSize: 12, color: COLORS.textMuted, whiteSpace: 'nowrap' }}>
          {submitted}
        </div>

        {/* Status badge */}
        <div>{statusBadge(app.hach_review_status)}</div>
      </div>
    </Link>
  );
}

function QueueSection({
  title,
  apps,
  emptyMessage,
  accentColor,
}: {
  title: string;
  apps: QueueApp[];
  emptyMessage: string;
  accentColor?: string;
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 20px',
          borderBottom: `2px solid ${accentColor ?? COLORS.accent}`,
          marginBottom: 0,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: accentColor ?? COLORS.accent,
          }}
        >
          {title}
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            background: accentColor ?? COLORS.accent,
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {apps.length}
        </span>
      </div>
      <div
        style={{
          border: `1px solid ${COLORS.border}`,
          borderTop: 'none',
        }}
      >
        {apps.length === 0 ? (
          <div
            style={{
              padding: '20px',
              fontSize: 13,
              color: COLORS.textMuted,
              textAlign: 'center',
            }}
          >
            {emptyMessage}
          </div>
        ) : (
          apps.map((app) => <AppRow key={app.id} app={app} />)
        )}
      </div>
    </div>
  );
}

export default function HachQueuePage() {
  const [queue, setQueue] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/hach/applications')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setQueue(d.data);
        else setError(d.message || 'Failed to load queue');
      })
      .catch(() => setError('Network error — could not load queue'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: '32px 24px',
        fontFamily: FONT,
      }}
    >
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: COLORS.text,
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          Review Queue
        </h1>
        <p style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 6, marginBottom: 0 }}>
          PBV full applications awaiting HACH eligibility determination
        </p>
      </div>

      {loading && (
        <div style={{ color: COLORS.textMuted, fontSize: 14 }}>Loading queue…</div>
      )}

      {error && (
        <div
          style={{
            background: COLORS.errorBg,
            color: COLORS.error,
            padding: '12px 16px',
            fontSize: 13,
            border: `1px solid #fecaca`,
          }}
        >
          {error}
        </div>
      )}

      {queue && (
        <>
          <QueueSection
            title="Needs First Review"
            apps={queue.needs_first_review}
            emptyMessage="No applications awaiting initial review"
            accentColor="#92400e"
          />
          <QueueSection
            title="Awaiting Applicant Response"
            apps={queue.awaiting_response}
            emptyMessage="No applications awaiting response"
            accentColor="#1e40af"
          />
          <QueueSection
            title="Approved This Week"
            apps={queue.approved}
            emptyMessage="No approvals this week"
            accentColor={COLORS.success}
          />
        </>
      )}
    </div>
  );
}
