'use client';

/**
 * useApplicationMessages
 *
 * Loads and sends the staff <-> applicant SMS thread for a PBV full application
 * via the admin messages API. The pbv_application_messages table is
 * service-role-only (RLS), so the browser cannot use Supabase realtime here;
 * the thread is kept fresh by lightweight polling instead. The interval is
 * cleared on unmount.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ApplicationMessage {
  id: string;
  full_application_id: string;
  direction: 'outbound' | 'inbound';
  channel: string;
  body: string;
  sender_role: 'staff' | 'tenant' | 'system';
  sender_user_id: string | null;
  sender_display_name: string | null;
  related_document_ids: string[] | null;
  twilio_message_sid: string | null;
  delivery_status: string | null;
  created_at: string;
}

interface UseApplicationMessagesResult {
  messages: ApplicationMessage[];
  loading: boolean;
  error: string | null;
  sending: boolean;
  sendMessage: (body: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const POLL_INTERVAL_MS = 15000;

export function useApplicationMessages(applicationId: string): UseApplicationMessagesResult {
  const [messages, setMessages] = useState<ApplicationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const mountedRef = useRef(true);

  const load = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await fetch(`/api/admin/pbv/full-applications/${applicationId}/messages`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed to load messages');
      if (mountedRef.current) {
        setMessages(json.data.messages ?? []);
        setError(null);
      }
    } catch (err: any) {
      if (mountedRef.current) setError(err?.message || 'Failed to load messages');
    } finally {
      if (mountedRef.current && showSpinner) setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    mountedRef.current = true;
    load(true);
    const interval = setInterval(() => load(false), POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [load]);

  const sendMessage = useCallback(async (body: string) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/pbv/full-applications/${applicationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: trimmed }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || 'Failed to send message');
      }
      await load(false);
    } finally {
      if (mountedRef.current) setSending(false);
    }
  }, [applicationId, load]);

  const refresh = useCallback(() => load(false), [load]);

  return { messages, loading, error, sending, sendMessage, refresh };
}
