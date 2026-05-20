'use client';

import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';

interface WaiveSignatureDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onWaive: (reason: string) => Promise<void>;
  signatureLabel: string;
}

export default function WaiveSignatureDialog({
  isOpen,
  onClose,
  onWaive,
  signatureLabel,
}: WaiveSignatureDialogProps) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!reason.trim() || reason.trim().length < 3) {
      setError('Reason must be at least 3 characters');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onWaive(reason.trim());
      setReason('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to waive');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h3 className="font-medium text-[var(--ink)]">Waive Signature Requirement</h3>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--ink)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="mb-4 bg-amber-50 border border-amber-200 p-3">
            <p className="text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 inline mr-1" />
              Waiving a signature is permanent and requires a reason.
            </p>
          </div>

          <p className="text-sm text-[var(--muted)] mb-4">
            Document: <span className="text-[var(--ink)] font-medium">{signatureLabel}</span>
          </p>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--ink)] mb-1">
              Reason for waiver *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this signature is being waived..."
              rows={3}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-[var(--border)] hover:bg-[var(--paper)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason.trim() || isSubmitting}
            className="px-4 py-2 text-sm bg-amber-600 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isSubmitting ? 'Waiving...' : 'Waive Signature'}
          </button>
        </div>
      </div>
    </div>
  );
}
