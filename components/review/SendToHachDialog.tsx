'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface PreflightCheck {
  name: string;
  key: string;
  passed: boolean;
  detail: string;
}

interface PacketSummary {
  applicant_name: string;
  building_address: string;
  unit_number: string;
  doc_counts: Record<string, number>;
  total_docs: number;
  hha_file: string | null;
  total_annual_income: number | null;
  stanton_reviewer: string | null;
  stanton_review_date: string | null;
  packet_locked: boolean;
  hach_packet_revision: number;
}

interface SendToHachDialogProps {
  applicationId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0 });
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function SendToHachDialog({
  applicationId,
  onClose,
  onSuccess,
}: SendToHachDialogProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [checks, setChecks] = useState<PreflightCheck[]>([]);
  const [allPassed, setAllPassed] = useState(false);
  const [packetSummary, setPacketSummary] = useState<PacketSummary | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [acknowledgedKeys, setAcknowledgedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadPreflight() {
      try {
        const res = await fetch(`/api/admin/pbv/full-applications/${applicationId}/preflight`);
        const json = await res.json();
        if (!json.success) throw new Error(json.message || 'Failed to load pre-flight data');
        setChecks(json.data.checks);
        setAllPassed(json.data.all_passed);
        setPacketSummary(json.data.packet_summary);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    loadPreflight();
  }, [applicationId]);

  const failedChecks = checks.filter((c) => !c.passed);
  const isOverrideMode = !allPassed && failedChecks.length > 0;
  const allAcknowledged = failedChecks.every((c) => acknowledgedKeys.has(c.key));
  const canSubmit = isOverrideMode
    ? allAcknowledged && overrideReason.trim().length > 0
    : true;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const body: Record<string, unknown> = {};
      if (isOverrideMode) {
        body.override_reason = overrideReason.trim();
        body.override_failed_checks = failedChecks.map((c) => c.key);
      }
      const res = await fetch(`/api/admin/pbv/full-applications/${applicationId}/send-to-hach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Send to HACH failed');
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAck = (key: string) => {
    setAcknowledgedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-lg shadow-xl border border-[var(--border)] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--divider)]">
          <h2 className="text-base font-semibold text-[var(--primary)] font-serif">
            Send Packet to HACH
          </h2>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {loading && (
            <p className="text-sm text-[var(--muted)]">Loading pre-flight checks…</p>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2">{error}</p>
          )}

          {!loading && packetSummary && (
            <>
              {/* Packet summary */}
              <div className="bg-[var(--bg-section)] border border-[var(--border)] p-4 space-y-2 text-sm">
                <p className="font-semibold text-[var(--ink)]">{packetSummary.applicant_name}</p>
                <p className="text-[var(--muted)]">
                  {packetSummary.building_address} Unit {packetSummary.unit_number}
                </p>
                <div className="flex flex-wrap gap-3 pt-1 text-xs">
                  {Object.entries(packetSummary.doc_counts).map(([status, count]) => (
                    <span key={status} className="text-[var(--ink)]">
                      <span className="font-medium capitalize">{status}:</span> {count}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-4 pt-1 text-xs text-[var(--muted)]">
                  <span>Income: {fmtMoney(packetSummary.total_annual_income)}</span>
                  {packetSummary.hha_file && (
                    <span className="text-green-700">HHA: {packetSummary.hha_file}</span>
                  )}
                  {!packetSummary.hha_file && (
                    <span className="text-amber-700">HHA: not generated</span>
                  )}
                  {packetSummary.stanton_reviewer && (
                    <span>
                      Reviewed by {packetSummary.stanton_reviewer}
                      {packetSummary.stanton_review_date ? ` on ${fmtDate(packetSummary.stanton_review_date)}` : ''}
                    </span>
                  )}
                </div>
                {packetSummary.hach_packet_revision > 0 && (
                  <p className="text-xs text-amber-700 pt-1">
                    This will be revision {packetSummary.hach_packet_revision + 1} sent to HACH.
                  </p>
                )}
              </div>

              {/* Pre-flight checks */}
              <div className="space-y-2">
                {checks.map((check) => (
                  <div
                    key={check.key}
                    className={`flex items-start gap-2 text-sm px-3 py-2 border ${
                      check.passed
                        ? 'border-green-200 bg-green-50 text-green-800'
                        : 'border-amber-300 bg-amber-50 text-amber-900'
                    }`}
                  >
                    <span className="mt-0.5 text-xs">{check.passed ? '✓' : '!'}</span>
                    <div>
                      <p className="font-medium">{check.name}</p>
                      <p className="text-xs mt-0.5 opacity-80">{check.detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Override mode */}
              {isOverrideMode && (
                <div className="border border-amber-400 bg-amber-50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-amber-900">
                    Pre-flight checks failed. You may override with acknowledgment and a reason.
                  </p>
                  <div className="space-y-2">
                    {failedChecks.map((check) => (
                      <label key={check.key} className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={acknowledgedKeys.has(check.key)}
                          onChange={() => toggleAck(check.key)}
                          className="mt-0.5"
                        />
                        <span className="text-xs text-amber-900">
                          I acknowledge: <strong>{check.name}</strong> — {check.detail}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-amber-900 mb-1">
                      Override reason <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      rows={3}
                      placeholder="Explain why you are submitting despite failed checks…"
                      className="w-full px-3 py-2 border border-amber-400 rounded-none text-sm focus:outline-none focus:border-amber-600 bg-white resize-none"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--divider)]">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--bg-section)] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting || loading || !!error}
            className="px-5 py-2 text-sm bg-[var(--primary)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Sending…' : isOverrideMode ? 'Confirm — Send to HACH (Override)' : 'Confirm — Send to HACH'}
          </button>
        </div>
      </div>
    </div>
  );
}
