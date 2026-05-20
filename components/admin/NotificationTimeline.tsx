'use client';

import { useEffect, useState } from 'react';

interface NotificationRow {
  id: string;
  notification_type: string;
  language: string;
  recipient_phone: string;
  message_body: string;
  delivery_status: string;
  delivery_error: string | null;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  twilio_message_sid: string | null;
}

interface Props {
  applicationId: string;
  optedOut: boolean;
  onResendMagicLink?: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  delivered:            'bg-green-100 text-green-800',
  sent:                 'bg-blue-100 text-blue-800',
  queued:               'bg-yellow-100 text-yellow-700',
  pending:              'bg-gray-100 text-gray-600',
  failed:               'bg-red-100 text-red-800',
  blocked_missing_data: 'bg-orange-100 text-orange-800',
  blocked_invalid_phone:'bg-orange-100 text-orange-800',
};

function fmtDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function typeLabel(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function NotificationTimeline({ applicationId, optedOut, onResendMagicLink }: Props) {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/notifications/timeline?application_id=${applicationId}`);
        const json = await res.json();
        if (!cancelled && json.success) setRows(json.data ?? []);
      } catch {
        // silently fail — non-critical panel
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [applicationId]);

  async function handleResend() {
    setResending(true);
    setResendMsg('');
    try {
      const res = await fetch('/api/admin/notifications/resend-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: applicationId }),
      });
      const json = await res.json();
      setResendMsg(json.success ? 'Sent.' : json.message ?? 'Failed.');
      if (json.success && onResendMagicLink) onResendMagicLink();
    } catch {
      setResendMsg('Failed.');
    } finally {
      setResending(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <h3 style={{ fontFamily: "'Libre Baskerville', Georgia, serif", fontSize: '15px', fontWeight: 700, margin: 0 }}>
          SMS Notifications
        </h3>
        {optedOut && (
          <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', backgroundColor: 'var(--color-warning-bg, #fef3c7)', color: 'var(--color-warning-text, #92400e)', border: '1px solid #fcd34d' }}>
            OPTED OUT
          </span>
        )}
        <button
          onClick={handleResend}
          disabled={resending || optedOut}
          style={{
            marginLeft: 'auto',
            fontSize: '12px',
            padding: '4px 12px',
            backgroundColor: 'var(--color-surface, #1a1a2e)',
            color: '#fff',
            border: 'none',
            cursor: resending || optedOut ? 'not-allowed' : 'pointer',
            opacity: resending || optedOut ? 0.5 : 1,
          }}
        >
          {resending ? 'Sending…' : 'Resend Magic Link'}
        </button>
        {resendMsg && <span style={{ fontSize: '12px', color: 'var(--color-muted, #6b6b6b)' }}>{resendMsg}</span>}
      </div>

      {loading && <p style={{ fontSize: '13px', color: 'var(--color-muted, #6b6b6b)' }}>Loading…</p>}
      {!loading && rows.length === 0 && (
        <p style={{ fontSize: '13px', color: 'var(--color-muted, #6b6b6b)' }}>No notifications sent yet.</p>
      )}
      {!loading && rows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border, #d4d0c8)', textAlign: 'left' }}>
              <th style={{ padding: '4px 8px', fontWeight: 600 }}>Type</th>
              <th style={{ padding: '4px 8px', fontWeight: 600 }}>Lang</th>
              <th style={{ padding: '4px 8px', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '4px 8px', fontWeight: 600 }}>Sent</th>
              <th style={{ padding: '4px 8px', fontWeight: 600 }}>Delivered</th>
              <th style={{ padding: '4px 8px', fontWeight: 600 }}>Error</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ borderBottom: '1px solid var(--color-border, #d4d0c8)' }}>
                <td style={{ padding: '6px 8px' }}>{typeLabel(row.notification_type)}</td>
                <td style={{ padding: '6px 8px', textTransform: 'uppercase' }}>{row.language}</td>
                <td style={{ padding: '6px 8px' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 6px',
                    ...(STATUS_STYLES[row.delivery_status]
                      ? {}
                      : { backgroundColor: '#f3f4f6', color: '#374151' }),
                  }}
                    className={STATUS_STYLES[row.delivery_status] ?? ''}
                  >
                    {row.delivery_status}
                  </span>
                </td>
                <td style={{ padding: '6px 8px', color: 'var(--color-muted, #6b6b6b)' }}>{fmtDate(row.sent_at ?? row.created_at)}</td>
                <td style={{ padding: '6px 8px', color: 'var(--color-muted, #6b6b6b)' }}>{fmtDate(row.delivered_at)}</td>
                <td style={{ padding: '6px 8px', color: '#b45309', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.delivery_error ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
