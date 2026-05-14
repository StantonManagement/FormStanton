'use client';

import { useState } from 'react';
import AssignDialog from './AssignDialog';

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onAssign: (userId: string | null) => void;
  onClear: () => void;
  currentUserId: string;
  currentUserName: string;
}

export default function BulkActionBar({
  selectedCount,
  totalCount,
  onAssign,
  onClear,
  currentUserId,
  currentUserName,
}: BulkActionBarProps) {
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (selectedCount === 0) return null;

  const handleAssignClick = () => {
    if (selectedCount >= 50) {
      setShowConfirm(true);
    } else {
      setShowAssignDialog(true);
    }
  };

  const handleConfirmedAssign = () => {
    setShowConfirm(false);
    setShowAssignDialog(true);
  };

  const handleAssignSubmit = (userId: string | null) => {
    onAssign(userId);
    setShowAssignDialog(false);
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--border)] shadow-lg z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-[var(--ink)]">
              {selectedCount} selected
            </span>
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-[var(--muted)] hover:text-[var(--ink)] underline"
            >
              Clear
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAssignClick}
              className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Assign selected to...
            </button>
          </div>
        </div>
      </div>

      {/* Soft confirmation for large selections */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white border border-[var(--border)] w-full max-w-sm p-5 shadow-xl">
            <h3 className="text-base font-semibold text-[var(--primary)] mb-2">
              Confirm bulk assignment
            </h3>
            <p className="text-sm text-[var(--ink)] mb-4">
              You are about to assign <strong>{selectedCount}</strong> documents at once.
              Are you sure?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmedAssign}
                className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign dialog */}
      <AssignDialog
        isOpen={showAssignDialog}
        onClose={() => setShowAssignDialog(false)}
        onAssign={handleAssignSubmit}
        currentAssigneeId={null}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        documentLabel={`${selectedCount} documents`}
        count={selectedCount}
      />
    </>
  );
}
