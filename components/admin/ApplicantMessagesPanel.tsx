'use client';

/**
 * ApplicantMessagesPanel
 *
 * Two-way SMS conversation between staff and the applicant for a PBV full
 * application. Outbound (staff/system) messages align right; inbound (tenant)
 * replies align left. Document "request changes" actions appear here as system
 * messages. Composer sends a free-form SMS via the messages API.
 */

import { useState, useRef, useEffect } from 'react';
import { useApplicationMessages, type ApplicationMessage } from '@/lib/pbv/hooks/useApplicationMessages';

interface Props {
  applicationId: string;
  optedOut?: boolean;
}

function fmtTime(s: string): string {
  return new Date(s).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function deliveryLabel(m: ApplicationMessage): string | null {
  if (m.direction === 'inbound') return null;
  if (!m.delivery_status) return null;
  if (m.delivery_status === 'sent' || m.delivery_status === 'queued') return 'Sent';
  if (m.delivery_status === 'email_fallback') return 'Sent via email';
  if (m.delivery_status.startsWith('blocked')) return 'Blocked (opted out?)';
  if (m.delivery_status.startsWith('failed')) return 'Failed to send';
  if (m.delivery_status === 'pending') return 'Sending…';
  return m.delivery_status;
}

export default function ApplicantMessagesPanel({ applicationId, optedOut }: Props) {
  const { messages, loading, error, sending, sendMessage } = useApplicationMessages(applicationId);
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body) return;
    setSendError('');
    try {
      await sendMessage(body);
      setDraft('');
    } catch (e: any) {
      setSendError(e?.message || 'Failed to send');
    }
  };

  return (
    <section className="bg-white border border-[var(--border)]">
      <div className="px-5 py-3 border-b border-[var(--divider)] flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--primary)] uppercase tracking-wide">Messages</h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">Two-way SMS with the applicant. Replies appear here automatically.</p>
        </div>
      </div>

      {optedOut && (
        <div className="px-5 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800">
          This applicant has opted out of SMS. New messages will not be delivered.
        </div>
      )}

      <div className="p-5">
        <div className="max-h-96 overflow-y-auto space-y-3">
          {loading ? (
            <p className="text-sm text-[var(--muted)]">Loading conversation…</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No messages yet. Send the first message below.</p>
          ) : (
            messages.map((m) => {
              const isInbound = m.direction === 'inbound';
              const dLabel = deliveryLabel(m);
              return (
                <div key={m.id} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] ${isInbound ? '' : 'text-right'}`}>
                    <div
                      className={`inline-block px-3 py-2 text-sm whitespace-pre-wrap text-left border ${
                        isInbound
                          ? 'bg-[var(--bg-section)] border-[var(--border)] text-[var(--ink)]'
                          : m.sender_role === 'system'
                          ? 'bg-amber-50 border-amber-200 text-[var(--ink)]'
                          : 'bg-[var(--primary)] border-[var(--primary)] text-white'
                      }`}
                    >
                      {m.body}
                    </div>
                    <div className="text-[11px] text-[var(--muted)] mt-1">
                      {isInbound
                        ? 'Applicant'
                        : m.sender_role === 'system'
                        ? `${m.sender_display_name ?? 'System'} · request`
                        : (m.sender_display_name ?? 'Staff')}
                      {' · '}
                      {fmtTime(m.created_at)}
                      {dLabel ? ` · ${dLabel}` : ''}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        <div className="mt-4 border-t border-[var(--divider)] pt-4">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a message to the applicant…"
            rows={3}
            className="w-full p-3 text-sm border border-[var(--border)] rounded-none resize-none focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          />
          {sendError && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 text-xs text-red-700">{sendError}</div>
          )}
          <div className="flex justify-end mt-2">
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !draft.trim()}
              className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send SMS'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
