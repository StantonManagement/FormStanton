'use client';

import React from 'react';

import { useState, useEffect, useCallback } from 'react';

interface AuditEntry {
  id: string;
  user_id: string | null;
  username: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, any>;
  ip_address: string | null;
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
  'export.toggle': 'Export Status Toggled',
  'appfolio.document_upload': 'Document Uploaded to AppFolio',
  'appfolio.fee_added': 'Fee Added in AppFolio',
  'tenant.add': 'Tenant Added',
};

const ACTION_COLORS: Record<string, string> = {
  'auth': 'bg-blue-50 text-blue-700 border-blue-200',
  'submission': 'bg-amber-50 text-amber-700 border-amber-200',
  'interaction': 'bg-purple-50 text-purple-700 border-purple-200',
  'exemption': 'bg-rose-50 text-rose-700 border-rose-200',
  'scan': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'vehicle': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'permit': 'bg-green-50 text-green-700 border-green-200',
  'receipt': 'bg-teal-50 text-teal-700 border-teal-200',
  'export': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'appfolio': 'bg-orange-50 text-orange-700 border-orange-200',
  'tenant': 'bg-violet-50 text-violet-700 border-violet-200',
};

function getActionColor(action: string): string {
  const prefix = action.split('.')[0];
  return ACTION_COLORS[prefix] || 'bg-gray-50 text-gray-700 border-gray-200';
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [filterAction, setFilterAction] = useState('');
  const [filterUsername, setFilterUsername] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (filterAction) params.set('action', filterAction);
      if (filterUsername) params.set('username', filterUsername);

      const res = await fetch(`/api/admin/audit-log?${params}`);
      const data = await res.json();

      if (data.success) {
        setEntries(data.data);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      }
    } catch (err) {
      console.error('Failed to fetch audit log:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filterAction, filterUsername]);

  useEffect(() => {
    fetchLog();
  }, [fetchLog]);

  const handleFilter = () => {
    setPage(1);
    fetchLog();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif text-[var(--primary)]">Audit Log</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {total} total entries
          </p>
        </div>
        <button
          onClick={fetchLog}
          className="px-4 py-2 border border-[var(--border)] text-[var(--primary)] rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out text-sm"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[var(--border)] p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-[var(--muted)] mb-1">Action</label>
          <input
            type="text"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            placeholder="e.g. auth.login"
            className="px-3 py-1.5 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/30 w-48"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--muted)] mb-1">User</label>
          <input
            type="text"
            value={filterUsername}
            onChange={(e) => setFilterUsername(e.target.value)}
            placeholder="e.g. Alex"
            className="px-3 py-1.5 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/30 w-48"
          />
        </div>
        <button
          onClick={handleFilter}
          className="px-4 py-1.5 bg-[var(--primary)] text-white border border-[var(--primary)] rounded-none text-sm hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out"
        >
          Filter
        </button>
        {(filterAction || filterUsername) && (
          <button
            onClick={() => { setFilterAction(''); setFilterUsername(''); setPage(1); }}
            className="px-4 py-1.5 border border-[var(--border)] text-[var(--muted)] rounded-none text-sm hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-[var(--border)] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[var(--muted)]">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center text-[var(--muted)]">No audit entries found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-section)]">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Time</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">User</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Action</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Entity</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">IP</th>
                <th className="px-4 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <React.Fragment key={entry.id}>
                  <tr
                    className="border-b border-[var(--divider)] hover:bg-[var(--bg)] cursor-pointer transition-colors duration-150"
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  >
                    <td className="px-4 py-2.5 text-[var(--ink)] whitespace-nowrap">
                      {formatTimestamp(entry.created_at)}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-[var(--primary)]">
                      {entry.username}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-2 py-0.5 border text-xs font-medium ${getActionColor(entry.action)}`}>
                        {ACTION_LABELS[entry.action] || entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--muted)] text-xs font-mono">
                      {entry.entity_type && (
                        <span>
                          {entry.entity_type}
                          {entry.entity_id && <span className="ml-1 opacity-60">#{entry.entity_id.slice(0, 8)}</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--muted)] text-xs font-mono">
                      {entry.ip_address || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--muted)]">
                      <span className={`text-xs transition-transform duration-150 inline-block ${expandedId === entry.id ? 'rotate-90' : ''}`}>▶</span>
                    </td>
                  </tr>
                  {expandedId === entry.id && (
                    <tr className="bg-[var(--bg)]">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="text-xs font-mono text-[var(--ink)] bg-white border border-[var(--divider)] p-3 max-h-48 overflow-auto">
                          <pre className="whitespace-pre-wrap">{JSON.stringify(entry.details, null, 2)}</pre>
                        </div>
                        <div className="mt-2 text-xs text-[var(--muted)] flex gap-4">
                          <span>ID: {entry.id}</span>
                          {entry.user_id && <span>User ID: {entry.user_id}</span>}
                          <span>Full timestamp: {new Date(entry.created_at).toISOString()}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-[var(--muted)]">
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 border border-[var(--border)] text-sm rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 border border-[var(--border)] text-sm rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
