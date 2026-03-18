'use client';

import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ConfirmDialog from '@/components/kit/ConfirmDialog';

interface MatrixFeeCellProps {
  /** Whether this fee is applicable (has_pets for pet fee, has_vehicle for permit fee) */
  applicable: boolean;
  /** Whether the fee has been loaded in AppFolio */
  feeLoaded: boolean;
  /** The fee amount (null = not yet set) */
  feeAmount: number | null;
  /** Who loaded it */
  loadedBy: string | null;
  /** When it was loaded */
  loadedAt: string | null;
  /** Whether this row is a missing-submission row */
  missing: boolean;
  /** Called to open the FeeEntryPopover with an anchor rect */
  onOpenPopover: (anchorRect: DOMRect) => void;
  /** submission ID for undo actions */
  submissionId: string | null;
  /** 'pet_rent' | 'permit_fee' */
  feeType: 'pet_rent' | 'permit_fee';
  /** Tenant name for confirmation messages */
  tenantName: string;
  /** Unit number for confirmation messages */
  unitNumber: string;
  /** Optional toast callback */
  onToast?: (message: string, onUndo?: () => void) => void;
  /** Called after a successful undo to refresh data */
  onRefresh: () => void;
  /** Server-computed fee amount for display before loading */
  calculatedFee?: number | null;
}

export default function MatrixFeeCell({
  applicable,
  feeLoaded,
  feeAmount,
  loadedBy,
  loadedAt,
  missing,
  onOpenPopover,
  submissionId,
  feeType,
  tenantName,
  unitNumber,
  onToast,
  onRefresh,
  calculatedFee,
}: MatrixFeeCellProps) {
  const cellRef = useRef<HTMLTableCellElement>(null);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const [undoing, setUndoing] = useState(false);

  const feeLabel = feeType === 'pet_rent' ? 'Pet Fee' : 'Permit Fee';

  const handleClick = useCallback(() => {
    if (!applicable || missing || feeLoaded) return;
    if (cellRef.current) {
      onOpenPopover(cellRef.current.getBoundingClientRect());
    }
  }, [applicable, missing, feeLoaded, onOpenPopover]);

  const handleUndo = async () => {
    if (!submissionId) return;
    setUndoing(true);
    try {
      const res = await fetch('/api/admin/compliance/mark-fee-added', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, feeType, undo: true }),
      });
      const data = await res.json();
      if (data.success) {
        onRefresh();
        onToast?.(`${feeLabel} cleared for ${tenantName}`);
      }
    } catch (err) {
      console.error('Fee undo error:', err);
    } finally {
      setUndoing(false);
    }
  };

  // Not applicable — dash
  if (!applicable || missing) {
    return <td className="px-2 py-1.5 text-center text-xs text-[var(--muted)] border border-[var(--divider)]">—</td>;
  }

  // Fee loaded — green check with amount + audit hover + click to undo
  if (feeLoaded) {
    const displayAmount = feeAmount !== null ? `$${feeAmount}` : '';
    const auditText = [
      loadedBy && `by ${loadedBy}`,
      loadedAt && new Date(loadedAt).toLocaleDateString(),
    ].filter(Boolean).join(' · ');

    return (
      <>
        <td
          className="px-2 py-1.5 text-center border border-[var(--divider)] group relative cursor-pointer hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out"
          title={`${auditText}\nClick to undo`}
          onClick={() => setConfirmUndo(true)}
        >
          <span className="text-[var(--success)] text-xs font-medium">✓ {displayAmount}</span>
          {auditText && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-[var(--ink)] text-white text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out pointer-events-none z-10">
              {auditText} · click to undo
            </div>
          )}
        </td>
        {confirmUndo && createPortal(
          <ConfirmDialog
            isOpen={confirmUndo}
            title={`Undo ${feeLabel}?`}
            message={`This will clear the ${displayAmount || ''} ${feeLabel.toLowerCase()} for ${tenantName} (Unit ${unitNumber}).`}
            confirmText={undoing ? 'Undoing...' : 'Undo'}
            cancelText="Keep"
            variant="warning"
            onConfirm={() => { setConfirmUndo(false); handleUndo(); }}
            onCancel={() => setConfirmUndo(false)}
          />,
          document.body
        )}
      </>
    );
  }

  // Fee not loaded — clickable to open popover
  return (
    <td
      ref={cellRef}
      onClick={handleClick}
      className="px-2 py-1.5 text-center border border-[var(--divider)] cursor-pointer hover:bg-[var(--warning)]/5 transition-colors duration-200 ease-out"
      title="Click to enter fee amount"
    >
      <span className="text-[var(--warning)] text-xs">{calculatedFee != null ? `$${calculatedFee}` : '$?'}</span>
    </td>
  );
}
