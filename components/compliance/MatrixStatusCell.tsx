'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import ConfirmDialog from '@/components/kit/ConfirmDialog';

interface MatrixStatusCellProps {
  applicable: boolean;
  done: boolean;
  missing: boolean;
  doneLabel?: string;
  pendingLabel?: string;
  auditBy: string | null;
  auditAt: string | null;
  /** If provided, clicking pending triggers the action. If absent, the cell is read-only. */
  onMark?: () => Promise<void> | void;
  /** If provided, clicking done prompts for confirm then triggers undo. */
  onUndo?: () => Promise<void> | void;
  /** Human label used in confirm dialogs, e.g. "Permit in AppFolio" */
  actionLabel?: string;
}

export default function MatrixStatusCell({
  applicable,
  done,
  missing,
  doneLabel = '✓',
  pendingLabel = '—',
  auditBy,
  auditAt,
  onMark,
  onUndo,
  actionLabel,
}: MatrixStatusCellProps) {
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!applicable || missing) {
    return <td className="px-2 py-1.5 text-center text-xs text-[var(--muted)] border border-[var(--divider)]">—</td>;
  }

  const handleMark = async () => {
    if (!onMark || busy) return;
    setBusy(true);
    try {
      await onMark();
    } finally {
      setBusy(false);
    }
  };

  const handleUndo = async () => {
    if (!onUndo || busy) return;
    setConfirmUndo(false);
    setBusy(true);
    try {
      await onUndo();
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    const auditText = [
      auditBy && `by ${auditBy}`,
      auditAt && new Date(auditAt).toLocaleDateString(),
    ].filter(Boolean).join(' · ');
    const interactive = !!onUndo;

    return (
      <>
        <td
          className={`px-2 py-1.5 text-center border border-[var(--divider)] group relative ${
            interactive ? 'cursor-pointer hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out' : ''
          }`}
          title={interactive ? `${auditText}${auditText ? '\n' : ''}Click to undo` : auditText}
          onClick={interactive ? () => setConfirmUndo(true) : undefined}
        >
          <span className="text-[var(--success)] text-xs font-medium">{doneLabel}</span>
          {auditText && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-[var(--ink)] text-white text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out pointer-events-none z-10">
              {auditText}{interactive ? ' · click to undo' : ''}
            </div>
          )}
        </td>
        {confirmUndo && createPortal(
          <ConfirmDialog
            isOpen={confirmUndo}
            title={`Undo ${actionLabel || 'status'}?`}
            message={`This will clear ${actionLabel || 'this status'}.`}
            confirmText={busy ? 'Undoing...' : 'Undo'}
            cancelText="Keep"
            variant="warning"
            onConfirm={handleUndo}
            onCancel={() => setConfirmUndo(false)}
          />,
          document.body
        )}
      </>
    );
  }

  const interactive = !!onMark;

  return (
    <td
      onClick={interactive ? handleMark : undefined}
      className={`px-2 py-1.5 text-center text-xs border border-[var(--divider)] ${
        interactive ? 'cursor-pointer hover:bg-[var(--warning)]/5 transition-colors duration-200 ease-out' : 'text-[var(--muted)]'
      }`}
      title={interactive ? `Click to mark ${actionLabel || 'done'}` : undefined}
    >
      {busy ? (
        <span className="text-[var(--muted)]">…</span>
      ) : pendingLabel === 'Pending' ? (
        <span className="px-2 py-0.5 bg-[var(--bg-section)] text-[var(--muted)] border border-[var(--divider)] text-xs">
          {pendingLabel}
        </span>
      ) : (
        <span className={interactive ? 'text-[var(--warning)]' : ''}>{pendingLabel}</span>
      )}
    </td>
  );
}
