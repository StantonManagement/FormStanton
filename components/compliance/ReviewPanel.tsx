'use client';

import { useState } from 'react';
import type { DynamicColumn, ProjectMatrixRow } from '@/types/compliance';
import EvidenceViewer from './EvidenceViewer';

interface ReviewPanelProps {
  column: DynamicColumn;
  row: ProjectMatrixRow;
  projectName: string;
  onPass: (reviewerNotes?: string) => Promise<void>;
  onFail: (failureReason: string, reviewerNotes?: string) => Promise<void>;
  onUndo: () => Promise<void>;
}

export default function ReviewPanel({
  column,
  row,
  projectName,
  onPass,
  onFail,
  onUndo,
}: ReviewPanelProps) {
  const [submitting, setSubmitting] = useState(false);
  const [showFailForm, setShowFailForm] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [passNotes, setPassNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const completion = row.completions[column.id];
  const status = completion?.status || 'pending';
  const failureReasons = column.failure_reasons || [];

  const handlePass = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onPass(passNotes.trim() || undefined);
      setPassNotes('');
    } catch (err: any) {
      setError(err?.message || 'Failed to submit pass');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFailSubmit = async () => {
    const reason = failureReasons.length === 0
      ? customReason.trim()
      : (selectedReason === 'Other' ? customReason.trim() : selectedReason);
    if (!reason) return;

    setSubmitting(true);
    setError(null);
    try {
      await onFail(reason, reviewerNotes.trim() || undefined);
      setShowFailForm(false);
      setSelectedReason('');
      setCustomReason('');
      setReviewerNotes('');
    } catch (err: any) {
      setError(err?.message || 'Failed to submit failure');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUndoClick = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onUndo();
    } catch (err: any) {
      setError(err?.message || 'Failed to undo');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--paper)]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-[var(--divider)] shadow-sm px-6 py-4">
        <div className="text-xs text-[var(--muted)] mb-1">{projectName}</div>
        <h2 className="text-xl font-serif text-[var(--primary)]">{column.label}</h2>
        <div className="text-sm text-[var(--muted)] mt-1">
          Unit {row.unit_number} · {row.tenant_name || 'No tenant name'}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Evidence viewer */}
        <div>
          <EvidenceViewer
            column={column}
            completion={completion}
            parentEvidence={row.parent_evidence}
            submissionData={row.submission_data}
            taskId={column.id}
          />
        </div>

        {/* Action area */}
        <div className="border border-[var(--divider)] bg-white">
          {error && (
            <div className="mx-6 mt-4 px-4 py-3 bg-[var(--error)]/10 border border-[var(--error)]/35 text-[var(--error)] text-sm">
              {error}
            </div>
          )}
          {/* Pending state */}
          {status === 'pending' && (
            <div className="p-6 space-y-4">
              <div className="text-sm font-semibold text-[var(--ink)] uppercase tracking-wide">
                Review Actions
              </div>

              {!showFailForm ? (
                <>
                  {/* Pass section */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-[var(--ink)]">
                      Optional Notes (Pass)
                    </label>
                    <textarea
                      value={passNotes}
                      onChange={(e) => setPassNotes(e.target.value)}
                      placeholder="Add internal notes (optional)..."
                      rows={2}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 resize-none"
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handlePass}
                      disabled={submitting}
                      className="flex-1 px-4 py-2.5 bg-[var(--success)] text-white text-sm font-medium rounded-none hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? 'Submitting...' : 'Pass'}
                    </button>
                    <button
                      onClick={() => setShowFailForm(true)}
                      disabled={submitting}
                      className="flex-1 px-4 py-2.5 bg-[var(--error)] text-white text-sm font-medium rounded-none hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Fail
                    </button>
                  </div>
                </>
              ) : (
                /* Fail form */
                <div className="space-y-4">
                  {/* Failure reason */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--ink)] mb-2">
                      Failure Reason <span className="text-[var(--error)]">*</span>
                    </label>
                    {failureReasons.length > 0 ? (
                      <select
                        value={selectedReason}
                        onChange={(e) => setSelectedReason(e.target.value)}
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20"
                      >
                        <option value="">Select a reason...</option>
                        {failureReasons.map((reason) => (
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
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 resize-none"
                      />
                    )}
                  </div>

                  {/* Custom reason if "Other" selected */}
                  {selectedReason === 'Other' && (
                    <div>
                      <label className="block text-sm font-medium text-[var(--ink)] mb-2">
                        Specify Reason <span className="text-[var(--error)]">*</span>
                      </label>
                      <textarea
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        placeholder="Enter custom reason..."
                        rows={3}
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 resize-none"
                      />
                    </div>
                  )}

                  {/* Internal reviewer notes */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--ink)] mb-2">
                      Internal Notes — Not Shared with Tenant
                    </label>
                    <textarea
                      value={reviewerNotes}
                      onChange={(e) => setReviewerNotes(e.target.value)}
                      placeholder="Add internal notes (optional)..."
                      rows={2}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 resize-none"
                    />
                  </div>

                  {/* Fail form actions */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => {
                        setShowFailForm(false);
                        setSelectedReason('');
                        setCustomReason('');
                        setReviewerNotes('');
                      }}
                      disabled={submitting}
                      className="px-4 py-2 border border-[var(--border)] rounded-none text-sm font-medium hover:bg-[var(--bg-section)] transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleFailSubmit}
                      disabled={
                        submitting ||
                        (failureReasons.length > 0
                          ? !selectedReason || (selectedReason === 'Other' && !customReason.trim())
                          : !customReason.trim())
                      }
                      className="flex-1 px-4 py-2.5 bg-[var(--error)] text-white text-sm font-medium rounded-none hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? 'Submitting...' : 'Submit Failure'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Complete/Failed state */}
          {(status === 'complete' || status === 'waived' || status === 'failed') && (
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-sm ${
                    status === 'failed'
                      ? 'bg-[var(--error)]/10 text-[var(--error)]'
                      : 'bg-[var(--success)]/10 text-[var(--success)]'
                  }`}>
                    {status === 'failed' ? '✗ Failed' : '✓ Passed'}
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    {completion?.failure_reason && (
                      <div>
                        <span className="font-medium text-[var(--ink)]">Reason:</span>{' '}
                        <span className="text-[var(--error)]">{completion.failure_reason}</span>
                      </div>
                    )}
                    {completion?.reviewer_notes && (
                      <div>
                        <span className="font-medium text-[var(--ink)]">Internal Notes:</span>{' '}
                        <span className="text-[var(--muted)]">{completion.reviewer_notes}</span>
                      </div>
                    )}
                    {completion?.completed_by && (
                      <div className="text-[var(--muted)]">
                        By {completion.completed_by}
                        {completion.completed_at && ` on ${new Date(completion.completed_at).toLocaleString()}`}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleUndoClick}
                  disabled={submitting}
                  className="px-3 py-1.5 text-xs font-medium text-[var(--error)] border border-[var(--error)]/35 rounded-none hover:bg-[var(--error)]/5 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Undoing...' : 'Undo'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
