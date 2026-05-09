'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface QueueRow {
  application_id: string;
  tenant_name: string;
  building: string;
  unit: string;
  field_name: string;
  appfolio_value: string | null;
  pbv_value: string | null;
  confirmed_at: string;
}

const FONT = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif";

const C = {
  bg: '#fafaf9',
  panel: '#ffffff',
  border: '#e7e5e4',
  borderStrong: '#d6d3d1',
  text: '#1c1917',
  textMuted: '#78716c',
  textSubtle: '#a8a29e',
  accent: '#0f4c5c',
  accentLight: '#e6f0f3',
};

export default function AppfolioQueuePage() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/pbv/appfolio-queue')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setRows(d.data ?? []);
        else setError(d.message || 'Failed to load');
      })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ fontFamily: FONT, background: C.bg, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0 }}>PBV AppFolio Update Queue</h1>
            <p style={{ fontSize: 12, color: C.textMuted, margin: '4px 0 0' }}>
              Tenants provided updated contact info via PBV. Push these values to AppFolio at end of project.
            </p>
          </div>
          <Link
            href="/admin/pbv/pipeline"
            style={{ fontSize: 12, color: C.accent, textDecoration: 'underline' }}
          >
            ← Back to Pipeline
          </Link>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
        {loading && (
          <p style={{ fontSize: 13, color: C.textMuted }}>Loading…</p>
        )}

        {error && (
          <div style={{ padding: 12, background: '#fee2e2', border: '1px solid #fecaca', fontSize: 13, color: '#991b1b' }}>
            {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <p style={{ fontSize: 13, color: C.textMuted }}>No pending updates. All contact info matches AppFolio.</p>
        )}

        {!loading && rows.length > 0 && (
          <div style={{ background: C.panel, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f5f5f4', borderBottom: `1px solid ${C.borderStrong}` }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: C.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Tenant</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: C.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Building</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: C.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Unit</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: C.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Field</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: C.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em' }}>AppFolio Value</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: C.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em' }}>PBV Value</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: C.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Confirmed At</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '10px 14px', color: C.text, fontWeight: 500 }}>{row.tenant_name}</td>
                    <td style={{ padding: '10px 14px', color: C.textMuted }}>{row.building}</td>
                    <td style={{ padding: '10px 14px', color: C.textMuted }}>{row.unit}</td>
                    <td style={{ padding: '10px 14px', color: C.textMuted }}>
                      {row.field_name === 'phone' ? 'Phone' : 'Preferred Language'}
                    </td>
                    <td style={{ padding: '10px 14px', color: C.textMuted }}>{row.appfolio_value ?? '—'}</td>
                    <td style={{ padding: '10px 14px', color: C.accent, fontWeight: 500 }}>{row.pbv_value ?? '—'}</td>
                    <td style={{ padding: '10px 14px', color: C.textSubtle, fontSize: 12 }}>
                      {row.confirmed_at ? new Date(row.confirmed_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
