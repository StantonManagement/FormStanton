'use client';

import { useState } from 'react';

interface PermitHistoryCycle {
  permit_issued_at: string | null;
  permit_issued_by: string | null;
  tenant_picked_up: boolean;
  tenant_picked_up_at: string | null;
  pickup_count: number;
  pickup_events: any[];
  pickup_id_photo: string | null;
  permit_revoked_at: string | null;
  permit_revoked_by: string | null;
  permit_revoked_reason: string | null;
  permit_revoked_notes: string | null;
  tow_flagged: boolean;
  towed_at: string | null;
  permit_fee_amount: number | null;
  permit_fee_added_to_appfolio: boolean;
  archived_at: string;
  archived_by: string;
}

interface PermitReissuePanelProps {
  submissionId: string;
  onSuccess: (data: any) => void;
  onError: (title: string, message: string) => void;
  updatingField: string | null;
  setUpdatingField: (v: string | null) => void;
}

export function PermitReissuePanel({
  submissionId,
  onSuccess,
  onError,
  updatingField,
  setUpdatingField,
}: PermitReissuePanelProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [towOld, setTowOld] = useState(false);

  const handleReissue = async () => {
    setUpdatingField('reissue_permit');
    try {
      const res = await fetch('/api/admin/compliance/reissue-permit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, towOldPermit: towOld }),
      });
      const data = await res.json();
      if (data.success) {
        onSuccess(data.data);
        setShowConfirm(false);
        setTowOld(false);
      } else {
        onError('Re-issue Failed', data.message);
      }
    } catch {
      onError('Re-issue Failed', 'Re-issue failed');
    } finally {
      setUpdatingField(null);
    }
  };

  return (
    <>
      <button
        onClick={() => { setShowConfirm(true); setTowOld(false); }}
        disabled={updatingField === 'reissue_permit'}
        className="text-xs px-2 py-1 bg-[var(--primary)] text-white rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out disabled:opacity-50"
      >
        Re-issue new permit
      </button>

      {showConfirm && (
        <div className="mt-2 p-3 bg-white border border-[var(--border)] space-y-2">
          <div className="text-xs font-medium text-[var(--primary)]">
            Re-issue permit — this archives the revoked permit and starts a fresh permit cycle.
          </div>
          <label className="flex items-center gap-2 text-xs text-[var(--ink)] cursor-pointer">
            <input
              type="checkbox"
              checked={towOld}
              onChange={(e) => setTowOld(e.target.checked)}
              className="rounded-none"
            />
            Issue a tow order on the old permit
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleReissue}
              disabled={updatingField === 'reissue_permit'}
              className="px-3 py-1 text-xs bg-[var(--primary)] text-white rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out disabled:opacity-50"
            >
              {updatingField === 'reissue_permit' ? 'Processing…' : 'Confirm re-issue'}
            </button>
            <button
              onClick={() => { setShowConfirm(false); setTowOld(false); }}
              className="px-3 py-1 text-xs border border-[var(--border)] rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function PermitHistoryLog({ history }: { history: PermitHistoryCycle[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!history || history.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-[var(--divider)]">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-xs font-medium text-[var(--primary)] hover:underline"
      >
        {expanded ? '▾' : '▸'} Permit history ({history.length} previous cycle{history.length === 1 ? '' : 's'})
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          {history.map((cycle, idx) => (
            <div key={idx} className="p-2 bg-white border border-[var(--divider)] text-xs space-y-0.5">
              <div className="font-medium text-[var(--ink)]">Cycle {idx + 1}</div>
              <div className="text-[var(--muted)]">
                Issued {cycle.permit_issued_by && <>by {cycle.permit_issued_by}</>}
                {cycle.permit_issued_at && <> on {new Date(cycle.permit_issued_at).toLocaleDateString()}</>}
              </div>
              {cycle.tenant_picked_up && (
                <div className="text-[var(--muted)]">
                  Picked up{cycle.pickup_count > 1 ? ` (×${cycle.pickup_count})` : ''}
                  {cycle.tenant_picked_up_at && <> on {new Date(cycle.tenant_picked_up_at).toLocaleDateString()}</>}
                </div>
              )}
              {cycle.permit_revoked_at && (
                <div className="text-[var(--error)]">
                  Revoked{cycle.permit_revoked_reason && <> — {cycle.permit_revoked_reason.replace('_', ' ')}</>}
                  {cycle.permit_revoked_by && <> by {cycle.permit_revoked_by}</>}
                  {cycle.permit_revoked_at && <> on {new Date(cycle.permit_revoked_at).toLocaleDateString()}</>}
                </div>
              )}
              {cycle.permit_revoked_notes && (
                <div className="text-[var(--muted)] italic">&quot;{cycle.permit_revoked_notes}&quot;</div>
              )}
              {cycle.tow_flagged && (
                <div className="text-[var(--error)]">
                  Tow order issued{cycle.towed_at && <> — towed {new Date(cycle.towed_at).toLocaleDateString()}</>}
                </div>
              )}
              {cycle.permit_fee_amount != null && (
                <div className="text-[var(--muted)]">
                  Parking fee: ${cycle.permit_fee_amount.toFixed(2)}
                  {cycle.permit_fee_added_to_appfolio && <> (synced to AppFolio)</>}
                </div>
              )}
              <div className="text-[var(--muted)] opacity-60">
                Archived {cycle.archived_by && <>by {cycle.archived_by}</>}
                {cycle.archived_at && <> on {new Date(cycle.archived_at).toLocaleDateString()}</>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
