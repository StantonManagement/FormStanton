'use client';

import { useState, useCallback } from 'react';
import type { MatrixRow } from '@/types/compliance';
import ConfirmDialog from '@/components/kit/ConfirmDialog';

interface BulkActionsBarProps {
  selectedIds: Set<string>;
  rows: MatrixRow[];
  onClearSelection: () => void;
  onRefresh: () => void;
}

interface BulkProgress {
  action: string;
  current: number;
  total: number;
}

export default function BulkActionsBar({ selectedIds, rows, onClearSelection, onRefresh }: BulkActionsBarProps) {
  const [feePrompt, setFeePrompt] = useState<{ type: 'pet_rent' | 'permit_fee'; label: string } | null>(null);
  const [feeAmount, setFeeAmount] = useState('');
  const [feeError, setFeeError] = useState('');
  const [progress, setProgress] = useState<BulkProgress | null>(null);
  const [downloading, setDownloading] = useState(false);

  const selectedRows = rows.filter(r => r.submission_id && selectedIds.has(r.submission_id));
  const petFeeEligible = selectedRows.filter(r => r.has_pets && !r.pet_fee_added_to_appfolio);
  const permitFeeEligible = selectedRows.filter(r => r.has_vehicle && !r.permit_fee_added_to_appfolio);
  const hasDocuments = selectedRows.some(r => r.vehicle_addendum_file || r.pet_addendum_file || r.insurance_file);

  const [confirmBulk, setConfirmBulk] = useState(false);

  const handleBulkFeeValidate = useCallback(() => {
    if (!feePrompt) return;
    const parsed = parseFloat(feeAmount);
    if (isNaN(parsed) || parsed < 0) {
      setFeeError('Enter a valid amount (0 or more)');
      return;
    }
    const eligible = feePrompt.type === 'pet_rent' ? petFeeEligible : permitFeeEligible;
    if (eligible.length === 0) {
      setFeePrompt(null);
      return;
    }
    setFeeError('');
    setConfirmBulk(true);
  }, [feePrompt, feeAmount, petFeeEligible, permitFeeEligible]);

  const handleBulkFeeExecute = useCallback(async () => {
    if (!feePrompt) return;
    const parsed = parseFloat(feeAmount);
    const eligible = feePrompt.type === 'pet_rent' ? petFeeEligible : permitFeeEligible;
    const label = feePrompt.type === 'pet_rent' ? 'pet fees' : 'permit fees';

    for (let i = 0; i < eligible.length; i++) {
      setProgress({ action: `Marking ${label}`, current: i + 1, total: eligible.length });
      try {
        await fetch('/api/admin/compliance/mark-fee-added', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            submissionId: eligible[i].submission_id,
            feeType: feePrompt.type,
            amount: parsed,
          }),
        });
      } catch (err) {
        console.error(`Bulk fee error for ${eligible[i].submission_id}:`, err);
      }
    }

    setProgress(null);
    setFeePrompt(null);
    setFeeAmount('');
    onRefresh();
  }, [feePrompt, feeAmount, petFeeEligible, permitFeeEligible, onRefresh]);

  const handleBulkDownloadZip = useCallback(async () => {
    const ids = selectedRows.filter(r => r.vehicle_addendum_file || r.pet_addendum_file || r.insurance_file).map(r => r.submission_id!);
    if (ids.length === 0) return;

    setDownloading(true);
    try {
      const res = await fetch('/api/admin/compliance/download-documents-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionIds: ids }),
      });

      if (!res.ok) {
        console.error('Bulk ZIP download failed');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Documents_${ids.length}_tenants.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Bulk ZIP download error:', err);
    } finally {
      setDownloading(false);
    }
  }, [selectedRows]);

  if (selectedIds.size === 0) return null;

  const btnClass = 'px-3 py-1.5 text-xs font-medium border rounded-none transition-colors duration-200 ease-out disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="bg-[var(--primary)]/5 border border-[var(--primary)]/20 px-4 py-3">
      {/* Progress overlay */}
      {progress && (
        <div className="mb-2 flex items-center gap-2 text-xs text-[var(--primary)]">
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>{progress.action}... {progress.current}/{progress.total}</span>
        </div>
      )}

      {/* Fee prompt modal inline */}
      {feePrompt && !progress && (
        <div className="mb-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-[var(--primary)]">{feePrompt.label}:</span>
          <div className="flex items-center gap-1">
            <span className="text-sm text-[var(--muted)]">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={feeAmount}
              onChange={(e) => { setFeeAmount(e.target.value); setFeeError(''); }}
              placeholder="0.00"
              className="w-20 px-2 py-1 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200 ease-out"
              autoFocus
            />
          </div>
          <button
            onClick={handleBulkFeeValidate}
            className={`${btnClass} bg-[var(--primary)] text-white border-[var(--primary)] hover:bg-[var(--primary-light)]`}
          >
            Apply to {feePrompt.type === 'pet_rent' ? petFeeEligible.length : permitFeeEligible.length}
          </button>
          <button
            onClick={() => { setFeePrompt(null); setFeeAmount(''); setFeeError(''); }}
            className={`${btnClass} bg-white text-[var(--muted)] border-[var(--border)] hover:bg-[var(--bg-section)]`}
          >
            Cancel
          </button>
          {feeError && <span className="text-xs text-[var(--error)]">{feeError}</span>}
        </div>
      )}

      {/* Action buttons */}
      {!feePrompt && !progress && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-[var(--primary)]">
            {selectedIds.size} selected
          </span>

          <button
            onClick={() => setFeePrompt({ type: 'pet_rent', label: `Mark Pet Fee Loaded (${petFeeEligible.length} eligible)` })}
            disabled={petFeeEligible.length === 0}
            className={`${btnClass} bg-white text-[var(--primary)] border-[var(--primary)]/40 hover:bg-[var(--primary)]/5`}
          >
            Mark Pet Fee ({petFeeEligible.length})
          </button>

          <button
            onClick={() => { setFeePrompt({ type: 'permit_fee', label: `Mark Permit Fee Loaded (${permitFeeEligible.length} eligible)` }); setFeeAmount('50'); }}
            disabled={permitFeeEligible.length === 0}
            className={`${btnClass} bg-white text-[var(--primary)] border-[var(--primary)]/40 hover:bg-[var(--primary)]/5`}
          >
            Mark Permit Fee ({permitFeeEligible.length})
          </button>

          <button
            onClick={handleBulkDownloadZip}
            disabled={!hasDocuments || downloading}
            className={`${btnClass} bg-white text-[var(--primary)] border-[var(--primary)]/40 hover:bg-[var(--primary)]/5`}
          >
            {downloading ? 'Downloading...' : `Download ZIP`}
          </button>

          <button
            onClick={onClearSelection}
            className={`${btnClass} bg-white text-[var(--muted)] border-[var(--border)] hover:bg-[var(--bg-section)]`}
          >
            Clear
          </button>
        </div>
      )}
      {/* Bulk fee confirmation dialog */}
      {confirmBulk && feePrompt && (
        <ConfirmDialog
          isOpen={confirmBulk}
          title={`Mark ${feePrompt.type === 'pet_rent' ? 'Pet Fee' : 'Permit Fee'} $${feeAmount} for ${(feePrompt.type === 'pet_rent' ? petFeeEligible : permitFeeEligible).length} Tenants?`}
          message={`This will update ${(feePrompt.type === 'pet_rent' ? petFeeEligible : permitFeeEligible).length} submissions. You can undo individual entries afterward by clicking the "✓" cell.`}
          confirmText="Apply All"
          cancelText="Cancel"
          variant="warning"
          onConfirm={() => { setConfirmBulk(false); handleBulkFeeExecute(); }}
          onCancel={() => setConfirmBulk(false)}
        />
      )}
    </div>
  );
}
