'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { FreshActivityEvent } from '@/lib/work/queries';

const EVENT_LABELS: Record<string, string> = {
  'document.uploaded_by_staff': 'Document uploaded',
  'document.recategorized': 'Document recategorized',
  'shared_workspace_messages': 'Message from HACH',
  'handoff.sent': 'Sent to HACH',
  'handoff.reopened': 'Packet reopened',
  'doc_assigned': 'Document assigned',
  'app_lead_assigned': 'Lead assigned',
  'doc_owner_confirmed': 'Confirmed',
  'doc_owner_flagged': 'Flagged',
};

function formatTimeAgo(s: string): string {
  const date = new Date(s);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

interface FreshActivityProps {
  refreshTrigger?: number;
}

export default function FreshActivity({ refreshTrigger }: FreshActivityProps) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<FreshActivityEvent[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/me/work/fresh-activity');
      const json = await res.json();
      if (json.success) {
        setEvents(json.data.events ?? []);
      }
    } catch (error) {
      console.error('Failed to fetch fresh activity:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  const decisionCopy = "What just changed that I need to react to?";

  return (
    <div className="bg-white border border-[var(--border)]">
      <div className="px-5 py-3 border-b border-[var(--divider)] bg-[var(--bg-section)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-[var(--ink)]">Fresh Activity</h3>
          <span
            className="text-[var(--muted)] text-sm cursor-help"
            title={decisionCopy}
          >
            ⓘ
          </span>
        </div>
        <div className="text-sm text-[var(--muted)]">Last 48h</div>
      </div>

      <div className="divide-y divide-[var(--divider)] max-h-96 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Loading...</div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-[var(--muted)]">
            Nothing in this view right now
          </div>
        ) : (
          events.map((event) => (
            <Link
              key={event.event_id}
              href={`/admin/pbv/full-applications/${event.application_id}`}
              className="flex items-start gap-3 p-4 hover:bg-[var(--bg-section)] border border-transparent hover:border-[var(--border)] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--ink)]">
                    {EVENT_LABELS[event.event_type] ?? event.event_type}
                  </span>
                  <span className="text-xs text-[var(--muted)]">{formatTimeAgo(event.created_at)}</span>
                </div>
                <p className="text-sm text-[var(--ink)]">
                  {event.head_of_household_name}
                  {event.document_label && (
                    <span className="text-[var(--muted)]"> • {event.document_label}</span>
                  )}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {event.building_address} Unit {event.unit_number}
                </p>
                {event.actor_display_name && (
                  <p className="text-xs text-[var(--muted)] mt-1">by {event.actor_display_name}</p>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
