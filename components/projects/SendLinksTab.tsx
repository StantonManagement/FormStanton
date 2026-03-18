'use client';

import { useState, useCallback } from 'react';
import type { ProjectUnit } from '@/types/compliance';
import type { ProjectDetail } from '@/lib/useProjectDetail';

interface SendLinksTabProps {
  project: ProjectDetail;
  units: ProjectUnit[];
  unitsLoading: boolean;
}

function buildTenantUrl(token: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/t/${token}`;
}

export default function SendLinksTab({ project, units, unitsLoading }: SendLinksTabProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [bulkCopied, setBulkCopied] = useState(false);

  const handleCopy = useCallback(async (unit: ProjectUnit) => {
    const url = buildTenantUrl(unit.tenant_link_token);
    await navigator.clipboard.writeText(url);
    setCopiedId(unit.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleBulkCopy = useCallback(async () => {
    const lines = units.map((u) => `${u.building} — ${u.unit_number}: ${buildTenantUrl(u.tenant_link_token)}`);
    await navigator.clipboard.writeText(lines.join('\n'));
    setBulkCopied(true);
    setTimeout(() => setBulkCopied(false), 2000);
  }, [units]);

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
      <div className="bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
        SMS delivery via Twilio coming soon. For now, copy and send links manually.
      </div>

      <div className="bg-white border border-[var(--border)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--divider)]">
          <h3 className="font-serif text-lg text-[var(--primary)]">Tenant Links</h3>
          <button
            type="button"
            onClick={handleBulkCopy}
            disabled={units.length === 0}
            className="px-3 py-1.5 bg-[var(--primary)] text-white text-xs font-medium rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 disabled:opacity-50"
          >
            {bulkCopied ? 'Copied!' : 'Copy All Links'}
          </button>
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
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Building</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Unit</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Language</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Link</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Delivery</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => (
                  <tr key={unit.id} className="border-b border-[var(--divider)] hover:bg-[var(--bg-section)] transition-colors">
                    <td className="px-4 py-2.5 text-[var(--ink)]">{unit.building}</td>
                    <td className="px-4 py-2.5 text-[var(--ink)]">{unit.unit_number}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs uppercase font-medium text-[var(--muted)]">{unit.preferred_language}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <code className="text-xs text-[var(--muted)] bg-[var(--bg-section)] px-1.5 py-0.5 break-all">
                        /t/{unit.tenant_link_token}
                      </code>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-[var(--muted)]">—</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleCopy(unit)}
                        className="text-xs text-[var(--primary)] hover:text-[var(--primary-light)] font-medium"
                      >
                        {copiedId === unit.id ? 'Copied!' : 'Copy Link'}
                      </button>
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
