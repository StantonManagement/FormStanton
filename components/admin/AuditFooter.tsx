'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface AuditEntry {
  id: string;
  username: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Login',
  'auth.login_legacy': 'Login (Legacy)',
  'auth.logout': 'Logout',
  'submission.update': 'Submission Updated',
  'submission.bulk_action': 'Bulk Action',
  'submission.edit': 'Submission Edited',
  'submission.merge': 'Submissions Merged',
  'interaction.create': 'Interaction Created',
  'interaction.delete': 'Interaction Deleted',
  'exemption.review': 'Exemption Reviewed',
  'scan.review': 'Scan Reviewed',
  'vehicle.phone_entry': 'Vehicle Phone Entry',
  'vehicle.approve_additional': 'Additional Vehicle Approved',
  'vehicle.deny_additional': 'Additional Vehicle Denied',
  'permit.issue': 'Permit Issued',
  'permit.pickup': 'Permit Picked Up',
  'receipt.pet_addendum': 'Pet Addendum Received',
  'receipt.vehicle_addendum': 'Vehicle Addendum Received',
  'export.vehicles': 'Vehicles Exported',
  'appfolio.document_upload': 'AppFolio Upload',
  'appfolio.fee_added': 'AppFolio Fee Added',
  'tenant.add': 'Tenant Added',
  'project.create': 'Project Created',
  'project.update': 'Project Updated',
  'project.activate': 'Project Activated',
  'project.task_add': 'Task Added',
  'project.task_update': 'Task Updated',
  'project.task_delete': 'Task Deleted',
  'project.task_complete': 'Task Completed',
  'project.task_uncomplete': 'Task Undone',
  'project.send_links': 'Links Sent',
  'project.token_regen': 'Token Regenerated',
  'user.create': 'User Created',
  'user.update': 'User Updated',
};

function labelFor(action: string): string {
  return ACTION_LABELS[action] || action;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function shortTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function AuditFooter() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchRecent = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/audit-log?limit=8&page=1');
      const data = await res.json();
      if (data.success) setEntries(data.data);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecent();
    const interval = setInterval(fetchRecent, 30_000);
    return () => clearInterval(interval);
  }, [fetchRecent]);

  const latest = entries[0];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50" style={{ fontFamily: 'var(--font-sans)' }}>
      {/* Expanded panel */}
      {expanded && (
        <div
          className="border-t"
          style={{ background: 'var(--primary)', borderColor: 'rgba(255,255,255,0.12)' }}
        >
          <div className="max-w-screen-2xl mx-auto px-4 py-3">
            <table className="w-full text-xs" style={{ color: 'rgba(255,255,255,0.9)' }}>
              <thead>
                <tr style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <th className="text-left pb-1.5 font-medium uppercase tracking-wider pr-6" style={{ fontSize: '10px' }}>Time</th>
                  <th className="text-left pb-1.5 font-medium uppercase tracking-wider pr-6" style={{ fontSize: '10px' }}>User</th>
                  <th className="text-left pb-1.5 font-medium uppercase tracking-wider pr-6" style={{ fontSize: '10px' }}>Action</th>
                  <th className="text-left pb-1.5 font-medium uppercase tracking-wider" style={{ fontSize: '10px' }}>Entity</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      Loading…
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      No entries yet.
                    </td>
                  </tr>
                ) : (
                  entries.map((e) => (
                    <tr key={e.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <td className="py-1.5 pr-6 font-mono whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {shortTime(e.created_at)}
                      </td>
                      <td className="py-1.5 pr-6 font-medium whitespace-nowrap">
                        {e.username}
                      </td>
                      <td className="py-1.5 pr-6 whitespace-nowrap">
                        {labelFor(e.action)}
                      </td>
                      <td className="py-1.5 font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {e.entity_type
                          ? `${e.entity_type}${e.entity_id ? ` #${e.entity_id.slice(0, 8)}` : ''}`
                          : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="mt-2 flex justify-end">
              <Link
                href="/admin/audit-log"
                className="text-xs underline-offset-2 hover:underline transition-colors duration-200"
                style={{ color: 'rgba(255,255,255,0.5)' }}
                onClick={() => setExpanded(false)}
              >
                View full log →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed bar (always visible) */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-1.5 transition-colors duration-200"
        style={{
          background: 'var(--primary)',
          borderTop: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.75)',
        }}
      >
        <span className="flex items-center gap-3 text-xs">
          <span className="font-medium uppercase tracking-wider" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>
            Activity
          </span>
          {!loading && latest ? (
            <span>
              <span className="font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>{latest.username}</span>
              <span style={{ color: 'rgba(255,255,255,0.45)' }}> — </span>
              <span>{labelFor(latest.action)}</span>
              <span style={{ color: 'rgba(255,255,255,0.45)' }}> — {timeAgo(latest.created_at)}</span>
            </span>
          ) : (
            <span style={{ color: 'rgba(255,255,255,0.35)' }}>
              {loading ? 'Loading…' : 'No recent activity'}
            </span>
          )}
        </span>
        <span
          className="text-xs transition-transform duration-200"
          style={{
            color: 'rgba(255,255,255,0.4)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            display: 'inline-block',
          }}
        >
          ▲
        </span>
      </button>
    </div>
  );
}
