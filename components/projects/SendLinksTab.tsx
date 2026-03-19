'use client';

import { useState, useCallback, useEffect, Fragment } from 'react';
import type { ProjectUnit, LinkDelivery } from '@/types/compliance';
import type { ProjectDetail } from '@/lib/useProjectDetail';

interface SendLinksTabProps {
  project: ProjectDetail;
  units: ProjectUnit[];
  unitsLoading: boolean;
  onRefresh?: () => void;
}

interface TenantContact {
  building_address: string;
  unit_number: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}

type SendMethod = 'sms' | 'email' | 'auto';

function buildTenantUrl(token: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/t/${token}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function StatusPill({ status }: { status: 'sent' | 'failed' | 'not_sent' }) {
  const styles = {
    sent: 'bg-blue-100 text-blue-800',
    failed: 'bg-red-100 text-red-800',
    not_sent: 'bg-gray-100 text-gray-500',
  };
  const labels = {
    sent: 'Sent',
    failed: 'Failed',
    not_sent: 'Not Sent',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export default function SendLinksTab({ project, units, unitsLoading, onRefresh }: SendLinksTabProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [bulkCopied, setBulkCopied] = useState(false);
  const [sendMethod, setSendMethod] = useState<SendMethod>('auto');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; no_contact: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tenantMap, setTenantMap] = useState<Map<string, TenantContact>>(new Map());
  const [deliveryMap, setDeliveryMap] = useState<Map<string, LinkDelivery[]>>(new Map());
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);

  // Fetch tenant contacts
  useEffect(() => {
    if (units.length === 0) return;
    fetchTenantContacts();
  }, [units.length, project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTenantContacts = async () => {
    try {
      const res = await fetch(`/api/admin/projects/${project.id}/tenant-contacts`);
      const json = await res.json();
      if (json.success && json.data) {
        const map = new Map<string, TenantContact>();
        for (const t of json.data) {
          map.set(`${t.building_address}||${t.unit_number}`, t);
        }
        setTenantMap(map);
      }
    } catch {
      // Tenant contacts unavailable
    }
  };

  // Fetch delivery history
  useEffect(() => {
    if (units.length === 0) return;
    fetchDeliveries();
  }, [units.length, project.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchDeliveries = async () => {
    try {
      const res = await fetch(`/api/admin/projects/${project.id}/deliveries`);
      const json = await res.json();
      if (json.success && json.data) {
        const map = new Map<string, LinkDelivery[]>();
        for (const d of json.data) {
          const list = map.get(d.project_unit_id) || [];
          list.push(d);
          map.set(d.project_unit_id, list);
        }
        setDeliveryMap(map);
      }
    } catch {
      // Deliveries unavailable
    }
  };

  const handleCopy = useCallback(async (unit: ProjectUnit) => {
    const url = buildTenantUrl(unit.tenant_link_token);
    await navigator.clipboard.writeText(url);
    setCopiedId(unit.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleBulkCopy = useCallback(async () => {
    const lines = units.map((u) => `${u.building} \u2014 ${u.unit_number}: ${buildTenantUrl(u.tenant_link_token)}`);
    await navigator.clipboard.writeText(lines.join('\n'));
    setBulkCopied(true);
    setTimeout(() => setBulkCopied(false), 2000);
  }, [units]);

  const handleSendSelected = async () => {
    if (selectedIds.size === 0) return;
    await doSend([...selectedIds]);
  };

  const handleSendAll = async () => {
    await doSend(undefined);
  };

  const doSend = async (unitIds: string[] | undefined) => {
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(`/api/admin/projects/${project.id}/send-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_ids: unitIds, method: sendMethod }),
      });
      const json = await res.json();
      if (json.success) {
        setSendResult(json.summary);
        setSelectedIds(new Set());
        await fetchDeliveries();
        onRefresh?.();
      } else {
        alert(json.message || 'Send failed');
      }
    } catch (err: any) {
      alert(err.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === units.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(units.map((u) => u.id)));
    }
  };

  const getLastDelivery = (unitId: string): LinkDelivery | null => {
    const deliveries = deliveryMap.get(unitId);
    if (!deliveries || deliveries.length === 0) return null;
    return deliveries[0];
  };

  const getDeliveryStatus = (unitId: string): 'sent' | 'failed' | 'not_sent' => {
    const last = getLastDelivery(unitId);
    if (!last) return 'not_sent';
    return last.send_error ? 'failed' : 'sent';
  };

  const getTenantContact = (unit: ProjectUnit): TenantContact | null => {
    return tenantMap.get(`${unit.building}||${unit.unit_number}`) || null;
  };

  if (project.status === 'draft') {
    return (
      <div className="bg-white border border-[var(--border)] p-6">
        <p className="text-sm text-[var(--muted)] text-center py-6">
          Activate the project first to generate tenant links.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk action bar */}
      <div className="bg-white border border-[var(--border)] px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Send via</label>
          <select
            value={sendMethod}
            onChange={(e) => setSendMethod(e.target.value as SendMethod)}
            className="border border-[var(--border)] rounded-none px-2 py-1 text-sm bg-white text-[var(--ink)]"
          >
            <option value="auto">Auto (SMS then Email)</option>
            <option value="sms">SMS Only</option>
            <option value="email">Email Only</option>
          </select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={handleSendSelected}
              disabled={sending}
              className="px-3 py-1.5 bg-[var(--primary)] text-white text-xs font-medium rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 disabled:opacity-50"
            >
              {sending ? 'Sending...' : `Send Selected (${selectedIds.size})`}
            </button>
          )}
          <button
            type="button"
            onClick={handleSendAll}
            disabled={sending || units.length === 0}
            className="px-3 py-1.5 bg-[var(--primary)] text-white text-xs font-medium rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send All'}
          </button>
          <button
            type="button"
            onClick={handleBulkCopy}
            disabled={units.length === 0}
            className="px-3 py-1.5 border border-[var(--border)] text-[var(--ink)] text-xs font-medium rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 disabled:opacity-50"
          >
            {bulkCopied ? 'Copied!' : 'Copy All Links'}
          </button>
        </div>
      </div>

      {/* Send result banner */}
      {sendResult && (
        <div className="bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 flex items-center justify-between">
          <span>
            <strong>{sendResult.sent}</strong> sent
            {sendResult.failed > 0 && <>, <strong className="text-red-700">{sendResult.failed}</strong> failed</>}
            {sendResult.no_contact > 0 && <>, <strong className="text-amber-700">{sendResult.no_contact}</strong> no contact info</>}
          </span>
          <button type="button" onClick={() => setSendResult(null)} className="text-green-600 hover:text-green-800 text-xs font-medium">
            Dismiss
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-[var(--border)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--divider)]">
          <h3 className="font-serif text-lg text-[var(--primary)]">Tenant Links</h3>
          <span className="text-xs text-[var(--muted)]">{units.length} units</span>
        </div>

        {unitsLoading ? (
          <div className="py-12 text-center text-sm text-[var(--muted)]">Loading...</div>
        ) : units.length === 0 ? (
          <div className="py-12 text-center text-sm text-[var(--muted)]">No units.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--bg-section)] border-b border-[var(--divider)]">
                  <th className="text-left px-3 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === units.length && units.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded-none border-[var(--border)]"
                    />
                  </th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Building</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Unit</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Tenant</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Phone</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Email</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Last Sent</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Opened</th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => {
                  const tenant = getTenantContact(unit);
                  const lastDelivery = getLastDelivery(unit.id);
                  const status = getDeliveryStatus(unit.id);
                  const deliveries = deliveryMap.get(unit.id) || [];
                  const isExpanded = expandedUnit === unit.id;
                  const phoneDisplay = tenant?.phone?.replace(/^(Phone|Mobile|Home|Work|Cell)\s*:\s*/i, '') || null;

                  return (
                    <Fragment key={unit.id}>
                      <tr className="border-b border-[var(--divider)] hover:bg-[var(--bg-section)] transition-colors">
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(unit.id)}
                            onChange={() => toggleSelect(unit.id)}
                            className="w-4 h-4 rounded-none border-[var(--border)]"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-[var(--ink)]">{unit.building}</td>
                        <td className="px-3 py-2.5 text-[var(--ink)] font-medium">{unit.unit_number}</td>
                        <td className="px-3 py-2.5 text-[var(--ink)] text-xs">{tenant?.name || <span className="text-[var(--muted)]">&mdash;</span>}</td>
                        <td className="px-3 py-2.5 text-xs text-[var(--muted)]">{phoneDisplay || '\u2014'}</td>
                        <td className="px-3 py-2.5 text-xs text-[var(--muted)]">{tenant?.email || '\u2014'}</td>
                        <td className="px-3 py-2.5">
                          {lastDelivery ? (
                            <div className="flex items-center gap-1.5">
                              <StatusPill status={status} />
                              <span className="text-xs text-[var(--muted)]">
                                {lastDelivery.method.toUpperCase()} &middot; {formatDate(lastDelivery.sent_at)}
                              </span>
                            </div>
                          ) : (
                            <StatusPill status="not_sent" />
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {unit.first_viewed_at ? (
                            <div className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-xs text-[var(--success)]">{formatDate(unit.first_viewed_at)}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--muted)]">&mdash;</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {deliveries.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setExpandedUnit(isExpanded ? null : unit.id)}
                                className="text-xs text-[var(--muted)] hover:text-[var(--ink)] font-medium"
                              >
                                {isExpanded ? 'Hide' : `History (${deliveries.length})`}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleCopy(unit)}
                              className="text-xs text-[var(--primary)] hover:text-[var(--primary-light)] font-medium"
                            >
                              {copiedId === unit.id ? 'Copied!' : 'Copy'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && deliveries.length > 0 && (
                        <tr className="border-b border-[var(--divider)]">
                          <td colSpan={9} className="px-6 py-3 bg-[var(--bg-section)]">
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2">Delivery History</p>
                              {deliveries.map((d) => (
                                <div key={d.id} className="flex items-center gap-3 text-xs">
                                  <span className="font-medium text-[var(--ink)] w-12">{d.method.toUpperCase()}</span>
                                  <span className="text-[var(--muted)]">{d.sent_to}</span>
                                  <span className="text-[var(--muted)]">{formatDate(d.sent_at)}</span>
                                  <span className="text-[var(--muted)]">by {d.sent_by}</span>
                                  {d.send_error ? (
                                    <span className="text-[var(--error)] font-medium">{d.send_error}</span>
                                  ) : (
                                    <span className="text-[var(--success)]">Sent</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
