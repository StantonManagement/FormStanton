'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { DynamicColumn } from '@/types/compliance';


interface ProjectMatrixCellProps {
  status: string;
  column: DynamicColumn;
  completedAt: string | null;
  completedBy: string | null;
  failureReason?: string | null;
  onStaffComplete?: () => Promise<void>;
  onStaffFail?: (reason: string) => Promise<void>;
  onStaffUncomplete?: () => Promise<void>;
  docUrl?: string | null;
}

export default function ProjectMatrixCell({
  status,
  column,
  completedAt,
  completedBy,
  failureReason,
  onStaffComplete,
  onStaffFail,
  onStaffUncomplete,
  docUrl,
}: ProjectMatrixCellProps) {
  const [completing, setCompleting] = useState(false);
  const [showFailModal, setShowFailModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState('');

  // Waived
  if (status === 'waived') {
    return (
      <td className="px-2 py-1.5 text-center text-xs text-[var(--muted)] border border-[var(--divider)]">
        —
      </td>
    );
  }

  // Failed
  if (status === 'failed') {
    const auditText = [
      failureReason,
      completedBy && `by ${completedBy}`,
      completedAt && new Date(completedAt).toLocaleDateString(),
    ].filter(Boolean).join(' · ');

    return (
      <td className="px-2 py-1.5 text-center border border-[var(--divider)] group relative bg-[var(--error)]/5" title={auditText}>
        <span className="text-[var(--error)] text-xs font-medium">✗</span>
        {column.assignee === 'staff' && onStaffUncomplete && (
          <button
            type="button"
            onClick={async () => {
              setCompleting(true);
              try { await onStaffUncomplete(); } finally { setCompleting(false); }
            }}
            disabled={completing}
            className="absolute top-0 right-0 px-1 py-0.5 text-[9px] text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out hover:bg-[var(--bg-section)] disabled:opacity-50"
            title="Undo"
          >
            ↩
          </button>
        )}
        {auditText && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-[var(--ink)] text-white text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out pointer-events-none z-10 max-w-xs">
            {auditText}
          </div>
        )}
      </td>
    );
  }

  // Complete
  if (status === 'complete') {
    const auditText = [
      completedBy && `by ${completedBy}`,
      completedAt && new Date(completedAt).toLocaleDateString(),
    ].filter(Boolean).join(' · ');

    return (
      <td className="px-2 py-1.5 text-center border border-[var(--divider)] group relative" title={auditText}>
        <span className="text-[var(--success)] text-xs font-medium">✓</span>
        {column.assignee === 'staff' && onStaffUncomplete && (
          <button
            type="button"
            onClick={async () => {
              setCompleting(true);
              try { await onStaffUncomplete(); } finally { setCompleting(false); }
            }}
            disabled={completing}
            className="absolute top-0 right-0 px-1 py-0.5 text-[9px] text-[var(--error)] opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out hover:bg-[var(--error)]/10 disabled:opacity-50"
            title="Undo completion"
          >
            ↩
          </button>
        )}
        {auditText && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-[var(--ink)] text-white text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out pointer-events-none z-10">
            {auditText}
          </div>
        )}
      </td>
    );
  }

  // Pending — staff task (clickable)
  if (column.assignee === 'staff' && (onStaffComplete || onStaffFail)) {
    const failureReasons = column.failure_reasons || [];
    
    const handleFailConfirm = async () => {
      if (!onStaffFail) return;
      const reason = selectedReason === 'Other' ? customReason.trim() : selectedReason;
      if (!reason) return;
      
      setCompleting(true);
      try {
        await onStaffFail(reason);
        setShowFailModal(false);
        setSelectedReason('');
        setCustomReason('');
      } finally {
        setCompleting(false);
      }
    };

    return (
      <>
        <td className="px-2 py-1.5 text-center border border-[var(--divider)]">
          <div className="flex items-center justify-center gap-1">
            {docUrl && (
              <a
                href={docUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-1 py-0.5 text-[10px] text-[var(--primary)] hover:text-[var(--primary-light)] transition-colors"
                title="View document"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </a>
            )}
            {onStaffComplete && (
              <button
                type="button"
                onClick={async () => {
                  setCompleting(true);
                  try {
                    await onStaffComplete();
                  } finally {
                    setCompleting(false);
                  }
                }}
                disabled={completing}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/35 hover:bg-[var(--success)]/20 transition-colors duration-200 ease-out cursor-pointer disabled:opacity-50"
                title="Mark as passed"
              >
                {completing ? (
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  'Pass'
                )}
              </button>
            )}
            {onStaffFail && (
              <button
                type="button"
                onClick={() => setShowFailModal(true)}
                disabled={completing}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-[var(--error)]/10 text-[var(--error)] border border-[var(--error)]/35 hover:bg-[var(--error)]/20 transition-colors duration-200 ease-out cursor-pointer disabled:opacity-50"
                title="Mark as failed"
              >
                Fail
              </button>
            )}
          </div>
        </td>

        {showFailModal && typeof document !== 'undefined' && createPortal(
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4" onClick={() => setShowFailModal(false)}>
            <div className="bg-white border border-gray-300 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-[var(--divider)]">
                <h3 className="font-serif text-lg">Mark Task as Failed</h3>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--ink)] mb-2">
                    Failure Reason
                  </label>
                  {failureReasons.length > 0 ? (
                    <select
                      value={selectedReason}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="w-full border border-[var(--border)] rounded-none px-3 py-2 text-sm focus:outline-none focus:border-[var(--primary)]"
                    >
                      <option value="">Select a reason...</option>
                      {failureReasons.map((reason: string) => (
                        <option key={reason} value={reason}>{reason}</option>
                      ))}
                      <option value="Other">Other</option>
                    </select>
                  ) : (
                    <textarea
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Enter failure reason..."
                      rows={3}
                      className="w-full border border-[var(--border)] rounded-none px-3 py-2 text-sm focus:outline-none focus:border-[var(--primary)] resize-none"
                    />
                  )}
                </div>
                {selectedReason === 'Other' && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--ink)] mb-2">
                      Specify Reason
                    </label>
                    <textarea
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Enter custom reason..."
                      rows={3}
                      className="w-full border border-[var(--border)] rounded-none px-3 py-2 text-sm focus:outline-none focus:border-[var(--primary)] resize-none"
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--divider)]">
                <button
                  type="button"
                  onClick={() => { setShowFailModal(false); setSelectedReason(''); setCustomReason(''); }}
                  className="px-4 py-2 text-sm border border-[var(--border)] rounded-none hover:bg-[var(--bg-section)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFailConfirm}
                  disabled={
                    completing ||
                    (failureReasons.length > 0
                      ? !selectedReason || (selectedReason === 'Other' && !customReason.trim())
                      : !customReason.trim())
                  }
                  className="px-4 py-2 bg-[var(--error)] text-white text-sm font-medium rounded-none hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {completing ? 'Marking Failed...' : 'Mark Failed'}
                </button>
              </div>
            </div>
          </div>
        , document.body)}
      </>
    );
  }

  // Pending — tenant task
  return (
    <td className="px-2 py-1.5 text-center border border-[var(--divider)] bg-[var(--error)]/5">
      <span className="text-[var(--error)] text-xs">✗</span>
    </td>
  );
}
