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
  /** When provided, shows a "Request changes" action that asks the applicant
   *  to redo the selected documents with a note. Resolves when the request is
   *  sent so the bar can clear its dialog. */
  onRequestChanges?: (note: string) => Promise<void>;
}

export default function BulkActionBar({
  selectedCount,
  totalCount,
  onAssign,
  onClear,
  currentUserId,
  currentUserName,
  onRequestChanges,
}: BulkActionBarProps) {
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requestNote, setRequestNote] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestError, setRequestError] = useState('');

  if (selectedCount === 0) return null;

  const handleRequestSubmit = async () => {
    if (!onRequestChanges || !requestNote.trim()) return;
    setRequestSubmitting(true);
    setRequestError('');
    try {
      await onRequestChanges(requestNote.trim());
      setShowRequestDialog(false);
      setRequestNote('');
    } catch (e: any) {
      setRequestError(e?.message || 'Failed to send request');
    } finally {
      setRequestSubmitting(false);
    }
  };

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
            {onRequestChanges && (
              <button
                type="button"
                onClick={() => { setRequestError(''); setShowRequestDialog(true); }}
                className="px-4 py-2 border border-[var(--border)] text-[var(--ink)] text-sm font-medium hover:bg-[var(--bg-section)] transition-colors"
              >
                Request changes...
              </button>
            )}
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

      {/* Request changes dialog */}
      {showRequestDialog && onRequestChanges && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white border border-[var(--border)] w-full max-w-md p-5 shadow-xl">
            <h3 classN