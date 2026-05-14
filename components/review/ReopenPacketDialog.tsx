'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface ReopenPacketDialogProps {
  applicationId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReopenPacketDialog({
  applicationId,
  onClose,
  onSuccess,
}: ReopenPacketDialogProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/pbv/full-applications/${applicationId}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Reopen failed');
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-md shadow-xl border border-[var(--border)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--divider)]">
          <h2 className="text-base font-semibold text-[var(--primary)] font-serif">
            Reopen Packet
          </h2>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold mb-1">Warning</p>
            <p>
              Reopening pauses HACH review and requires re-submission. HACH will see this packet
              as reopened by Stanton until you re-submit.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2">{error}</p>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--ink)] mb-1">
              Reason for reopening <span className="text-red-600">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Describe why this packet needs to be reopened…"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--divider)]">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--bg-section)] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!reason.trim() || submitting}
            className="px-5 py-2 text-sm bg-red-700 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Reopening…' : 'Confirm Reopen'}
          </button>
        </div>
      </div>
    </div>
  );
}
