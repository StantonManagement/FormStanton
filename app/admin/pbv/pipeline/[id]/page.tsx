'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// ── Types ────────────────────────────────────────────────────────────────────

interface ApplicationEvent {
  id: string;
  event_type: string;
  actor_user_id: string | null;
  actor_display_name: string;
  document_id: string | null;
  payload: Record<string, any>;
  created_at: string;
}

interface CorrespondenceEntry {
  id: string;
  direction: 'inbound' | 'outbound';
  channel: 'email' | 'phone' | 'portal' | 'in_person' | 'other';
  from_party: string | null;
  to_party: string | null;
  subject: string | null;
  body: string;
  occurred_at: string;
  status: 'awaiting_their_response' | 'awaiting_our_response' | 'resolved';
  logged_by: string | null;
  logged_by_name: string | null;
  logged_at: string;
}

interface AppDetail {
  id: string;
  head_of_household_name: string;
  building_address: string;
  unit_number: string;
  household_size: number;
  stage: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  stanton_review_status: string;
  hach_review_status: string | null;
  last_activity_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FONT = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif";
const FONT_MONO = "'IBM Plex Mono', 'Courier New', monospace";

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
  approve: '#15803d',
  reject: '#b91c1c',
  warn: '#a16207',
};

const STAGE_LABELS: Record<string, string> = {
  pre_app: 'Pre-App',
  intake: 'Intake',
  stanton_review: 'Stanton Review',
  submitted_to_hach: 'Submitted to HACH',
  hach_review: 'HACH Review',
  approved: 'Approved',
  denied: 'Denied',
  withdrawn: 'Withdrawn',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  'document.uploaded_by_staff': 'Document uploaded by staff',
  'document.recategorized': 'Document recategorized',
  'document.approved': 'Document approved',
  'document.rejected': 'Document rejected',
  'document.waived': 'Document waived',
  'handoff.sent': 'Sent to HACH',
  'handoff.reopened': 'Packet reopened',
  'doc_assigned': 'Document assigned',
  'app_lead_assigned': 'Lead assigned',
  'app_assigned': 'Application assigned',
  'doc_owner_confirmed': 'Document owner confirmed',
  'doc_owner_flagged': 'Document owner flagged',
  'packet_intake_started': 'Packet intake started',
  'packet_intake_committed': 'Packet intake committed',
  'packet_intake_abandoned': 'Packet intake abandoned',
  'document.uploaded_by_tenant': 'Document uploaded by tenant',
  'pbv_full_application.created': 'Application created',
  'notification.scheduled': 'Notification scheduled',
  'notification.sent': 'Notification sent',
  'notification.failed': 'Notification failed',
  'notification.opted_out': 'SMS opted out',
  'signing_packet_created': 'Signing packet created',
  'signature_marked_sent': 'Signature marked sent',
  'hap_received_from_hach': 'HAP received from HACH',
  'signature_received': 'Signature received',
  'signature_waived': 'Signature waived',
  'hap_executed': 'HAP executed',
  'property_configured': 'Property configured',
  'appointment.scheduled': 'Appointment scheduled',
  'appointment.completed': 'Appointment completed',
  'appointment.no_show': 'No-show',
  'appointment.rescheduled': 'Appointment rescheduled',
  'appointment.cancelled': 'Appointment cancelled',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(s: string): string {
  const d = new Date(s);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(s: string): string {
  const d = new Date(s);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRelativeTime(s: string): string {
  const d = new Date(s);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EventIcon({ eventType }: { eventType: string }) {
  const icon = eventType.includes('document')
    ? '📄'
    : eventType.includes('assigned')
    ? '👤'
    : eventType.includes('handoff') || eventType.includes('hap')
    ? '📤'
    : eventType.includes('notification')
    ? '🔔'
    : eventType.includes('appointment')
    ? '📅'
    : eventType.includes('signature')
    ? '✍️'
    : '📝';
  return <span style={{ fontSize: 14 }}>{icon}</span>;
}

function EventPayload({ event }: { event: ApplicationEvent }) {
  const { payload, event_type } = event;

  if (event_type === 'app_assigned') {
    const prev = payload.previous_assignee_name ?? payload.previous_assignee_id ?? 'Unassigned';
    const next = payload.new_assignee_name ?? payload.new_assignee_id ?? 'Unassigned';
    return (
      <span style={{ color: C.textMuted }}>
        {prev} → {next}
        {payload.bulk_operation && ' (bulk)'}
      </span>
    );
  }

  if (event_type === 'document.approved' || event_type === 'document.rejected') {
    return <span style={{ color: C.textMuted }}>{payload.label ?? payload.doc_type}</span>;
  }

  if (event_type === 'document.rejected' && payload.rejection_reason) {
    return (
      <span style={{ color: C.textMuted }}>
        {payload.label ?? payload.doc_type}: {payload.rejection_reason}
      </span>
    );
  }

  if (event_type === 'handoff.sent') {
    return <span style={{ color: C.textMuted }}>Revision {payload.hach_packet_revision}</span>;
  }

  if (event_type === 'notification.sent') {
    return <span style={{ color: C.textMuted }}>{payload.notification_type}</span>;
  }

  return null;
}

function ActivityTimeline({ applicationId }: { applicationId: string }) {
  const [events, setEvents] = useState<ApplicationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filter) params.set('event_type', filter);
      params.set('limit', '50');
      const res = await fetch(`/api/admin/pbv/applications/${applicationId}/events?${params}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setEvents(data.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [applicationId, filter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const eventTypes = [...new Set(events.map((e) => e.event_type))];

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>Activity Timeline</h3>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: '4px 8px',
            fontSize: 12,
            fontFamily: FONT,
            border: `1px solid ${C.border}`,
            background: C.panel,
          }}
        >
          <option value="">All event types</option>
          {eventTypes.map((t) => (
            <option key={t} value={t}>
              {EVENT_TYPE_LABELS[t] ?? t}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div style={{ padding: 32, textAlign: 'center', color: C.textMuted }}>Loading...</div>
      )}

      {error && (
        <div style={{ padding: 16, color: C.reject, background: '#fef2f2' }}>{error}</div>
      )}

      {!loading && !error && events.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: C.textMuted }}>No events yet.</div>
      )}

      {!loading && !error && events.length > 0 && (
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {events.map((event, idx) => (
            <div
              key={event.id}
              style={{
                padding: '12px 16px',
                borderBottom: idx < events.length - 1 ? `1px solid ${C.border}` : undefined,
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <div style={{ marginTop: 2 }}>
                <EventIcon eventType={event.event_type} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: C.text }}>
                  <strong>{EVENT_TYPE_LABELS[event.event_type] ?? event.event_type}</strong>
                  <span style={{ color: C.textMuted, marginLeft: 8 }}>by {event.actor_display_name}</span>
                </div>
                <div style={{ fontSize: 12, marginTop: 2 }}>
                  <EventPayload event={event} />
                </div>
                <div style={{ fontSize: 11, color: C.textSubtle, marginTop: 4 }}>
                  {formatDateTime(event.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CorrespondenceLog({ applicationId }: { applicationId: string }) {
  const [entries, setEntries] = useState<CorrespondenceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showCallDialog, setShowCallDialog] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/pbv/applications/${applicationId}/correspondence`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setEntries(data.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const updateStatus = async (id: string, status: CorrespondenceEntry['status']) => {
    try {
      const res = await fetch(`/api/admin/pbv/correspondence/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update');
      fetchEntries();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const channelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return '✉️';
      case 'phone':
        return '📞';
      case 'portal':
        return '💻';
      case 'in_person':
        return '🤝';
      default:
        return '📝';
    }
  };

  const statusConfig: Record<string, { label: string; bg: string; color: string }> = {
    awaiting_their_response: { label: 'Awaiting HACH', bg: '#fef3c7', color: '#a16207' },
    awaiting_our_response: { label: 'Awaiting us', bg: '#dbeafe', color: '#1e40af' },
    resolved: { label: 'Resolved', bg: '#dcfce7', color: '#15803d' },
  };

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}` }}>
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>HACH Correspondence</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowEmailDialog(true)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontFamily: FONT,
              background: C.accent,
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Log Email
          </button>
          <button
            onClick={() => setShowCallDialog(true)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontFamily: FONT,
              background: C.panel,
              color: C.text,
              border: `1px solid ${C.border}`,
              cursor: 'pointer',
            }}
          >
            Log Call
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ padding: 32, textAlign: 'center', color: C.textMuted }}>Loading...</div>
      )}

      {error && (
        <div style={{ padding: 16, color: C.reject, background: '#fef2f2' }}>{error}</div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: C.textMuted }}>No correspondence logged yet.</div>
      )}

      {!loading && !error && entries.length > 0 && (
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {entries.map((entry, idx) => {
            const cfg = statusConfig[entry.status];
            return (
              <div
                key={entry.id}
                style={{
                  padding: '12px 16px',
                  borderBottom: idx < entries.length - 1 ? `1px solid ${C.border}` : undefined,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>
                      {entry.direction === 'inbound' ? '⬇️' : '⬆️'} {channelIcon(entry.channel)}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>
                      {entry.direction === 'inbound' ? 'From HACH' : 'To HACH'}
                    </span>
                    <span style={{ fontSize: 11, color: C.textMuted }}>
                      {formatDateTime(entry.occurred_at)}
                    </span>
                  </div>
                  <select
                    value={entry.status}
                    onChange={(e) => updateStatus(entry.id, e.target.value as CorrespondenceEntry['status'])}
                    style={{
                      padding: '2px 6px',
                      fontSize: 11,
                      fontFamily: FONT,
                      border: 'none',
                      background: cfg.bg,
                      color: cfg.color,
                      cursor: 'pointer',
                    }}
                  >
                    <option value="awaiting_their_response">Awaiting HACH</option>
                    <option value="awaiting_our_response">Awaiting us</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>

                {entry.subject && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginTop: 6 }}>
                    {entry.subject}
                  </div>
                )}

                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, whiteSpace: 'pre-wrap' }}>
                  {entry.body.length > 200 ? entry.body.slice(0, 200) + '...' : entry.body}
                </div>

                <div style={{ fontSize: 11, color: C.textSubtle, marginTop: 6 }}>
                  Logged by {entry.logged_by_name ?? 'Unknown'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showEmailDialog && (
        <LogEmailDialog
          applicationId={applicationId}
          onClose={() => setShowEmailDialog(false)}
          onSaved={fetchEntries}
        />
      )}

      {showCallDialog && (
        <LogCallDialog
          applicationId={applicationId}
          onClose={() => setShowCallDialog(false)}
          onSaved={fetchEntries}
        />
      )}
    </div>
  );
}

function LogEmailDialog({
  applicationId,
  onClose,
  onSaved,
}: {
  applicationId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [direction, setDirection] = useState<'inbound' | 'outbound'>('inbound');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [status, setStatus] = useState<'awaiting_their_response' | 'awaiting_our_response' | 'resolved'>('resolved');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/pbv/applications/${applicationId}/correspondence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction,
          channel: 'email',
          subject: subject || null,
          body: body.trim(),
          occurred_at: new Date(occurredAt).toISOString(),
          status,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      onSaved();
      onClose();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 16,
      }}
    >
      <div style={{ background: C.panel, width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>Log HACH Email</h3>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Direction</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'inbound' | 'outbound')}
              style={{ width: '100%', padding: 8, fontSize: 13, fontFamily: FONT, border: `1px solid ${C.border}` }}
            >
              <option value="inbound">Inbound (from HACH)</option>
              <option value="outbound">Outbound (to HACH)</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              style={{ width: '100%', padding: 8, fontSize: 13, fontFamily: FONT, border: `1px solid ${C.border}` }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="Paste email body..."
              style={{
                width: '100%',
                padding: 8,
                fontSize: 13,
                fontFamily: FONT,
                border: `1px solid ${C.border}`,
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Occurred At</label>
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              style={{ width: '100%', padding: 8, fontSize: 13, fontFamily: FONT, border: `1px solid ${C.border}` }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              style={{ width: '100%', padding: 8, fontSize: 13, fontFamily: FONT, border: `1px solid ${C.border}` }}
            >
              <option value="resolved">Resolved</option>
              <option value="awaiting_their_response">Awaiting HACH response</option>
              <option value="awaiting_our_response">Awaiting our response</option>
            </select>
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontFamily: FONT,
              background: C.panel,
              color: C.text,
              border: `1px solid ${C.border}`,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !body.trim()}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontFamily: FONT,
              background: C.accent,
              color: '#fff',
              border: 'none',
              cursor: saving || !body.trim() ? 'not-allowed' : 'pointer',
              opacity: saving || !body.trim() ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LogCallDialog({
  applicationId,
  onClose,
  onSaved,
}: {
  applicationId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [direction, setDirection] = useState<'inbound' | 'outbound'>('inbound');
  const [notes, setNotes] = useState('');
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [status, setStatus] = useState<'awaiting_their_response' | 'awaiting_our_response' | 'resolved'>('resolved');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!notes.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/pbv/applications/${applicationId}/correspondence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          direction,
          channel: 'phone',
          subject: null,
          body: notes.trim(),
          occurred_at: new Date(occurredAt).toISOString(),
          status,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      onSaved();
      onClose();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 16,
      }}
    >
      <div style={{ background: C.panel, width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>Log HACH Call</h3>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Direction</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'inbound' | 'outbound')}
              style={{ width: '100%', padding: 8, fontSize: 13, fontFamily: FONT, border: `1px solid ${C.border}` }}
            >
              <option value="inbound">Inbound (from HACH)</option>
              <option value="outbound">Outbound (to HACH)</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              placeholder="Call notes..."
              style={{
                width: '100%',
                padding: 8,
                fontSize: 13,
                fontFamily: FONT,
                border: `1px solid ${C.border}`,
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Occurred At</label>
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              style={{ width: '100%', padding: 8, fontSize: 13, fontFamily: FONT, border: `1px solid ${C.border}` }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              style={{ width: '100%', padding: 8, fontSize: 13, fontFamily: FONT, border: `1px solid ${C.border}` }}
            >
              <option value="resolved">Resolved</option>
              <option value="awaiting_their_response">Awaiting HACH response</option>
              <option value="awaiting_our_response">Awaiting our response</option>
            </select>
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontFamily: FONT,
              background: C.panel,
              color: C.text,
              border: `1px solid ${C.border}`,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !notes.trim()}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontFamily: FONT,
              background: C.accent,
              color: '#fff',
              border: 'none',
              cursor: saving || !notes.trim() ? 'not-allowed' : 'pointer',
              opacity: saving || !notes.trim() ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PipelineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [app, setApp] = useState<AppDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchApp = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/pbv/full-applications/${id}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setApp(data.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchApp();
  }, [fetchApp]);

  if (loading) {
    return (
      <div style={{ padding: 40, fontFamily: FONT, color: C.textMuted }}>
        Loading application...
      </div>
    );
  }

  if (error || !app) {
    return (
      <div style={{ padding: 40, fontFamily: FONT, color: C.reject }}>
        {error || 'Application not found'}
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', fontFamily: FONT, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, marginBottom: 8 }}>
          <Link href="/admin/pbv/pipeline" style={{ color: C.accent, textDecoration: 'none' }}>
            ← Back to Pipeline
          </Link>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: '0 0 4px 0', fontSize: 22, fontWeight: 700, color: C.text }}>
              {app.head_of_household_name}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>
              {app.building_address} · Unit {app.unit_number} · {app.household_size} person household
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span
              style={{
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: 600,
                background: C.bg,
                border: `1px solid ${C.border}`,
                color: C.text,
              }}
            >
              {STAGE_LABELS[app.stage] ?? app.stage}
            </span>
            <Link
              href={`/admin/pbv/full-applications/${app.id}`}
              style={{
                padding: '6px 14px',
                fontSize: 12,
                fontFamily: FONT,
                background: C.accent,
                color: '#fff',
                textDecoration: 'none',
              }}
            >
              Full Details →
            </Link>
          </div>
        </div>
      </div>

      {/* Two column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <ActivityTimeline applicationId={app.id} />
        <CorrespondenceLog applicationId={app.id} />
      </div>
    </div>
  );
}
