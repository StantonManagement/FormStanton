'use client';

import { useState } from 'react';

interface FlagDocDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  documentLabel: string;
}

export default function FlagDocDialog({
  isOpen,
  onClose,
  onSubmit,
  documentLabel,
}: FlagDocDialogProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    setError('');

    if (!reason.trim() || reason.trim().length < 10) {
      setError('Flag reason must be at least 10 characters');
      return;
    }

    setSubmitting(true);
    onSubmit(reason.trim());
    setSubmitting(false);
    setReason('');
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-[var(--border)] w-full max-w-md shadow-xl">
        <div className="px-5 py-4 border-b border-[var(--divider)]">
          <h2 className="text-lg font-bold font-serif text-[var(--primary)]">
            Flag for Re-review
          </h2>
          <p className="text-sm text-[var(--muted)] mt-1">{documentLabel}</p>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-[var(--ink)]">
            Flagging this document will mark it for re-review by the assigned reviewer. The reviewer will be notified to re-examine the document.
          </p>

          <div>
            <label className="block text-sm font-medium text-[var(--ink)] mb-1">
              Flag reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Explain why this document needs re-review (minimum 10 characters)..."
              className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white resize-none"
            />
            {error && (
              <p className="mt-1 text-xs text-red-600">{error}</p>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[var(--divider)] flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || reason.trim().length < 10}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting ? 'Flagging...' : 'Flag Document'}
          </button>
        </div>
      </div>
    </div>
  );
}
