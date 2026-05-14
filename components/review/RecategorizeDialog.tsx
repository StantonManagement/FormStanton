'use client';

import { useState } from 'react';

interface Document {
  id: string;
  label: string;
  doc_type: string;
  status: string;
}

interface RecategorizeDialogProps {
  categorizeUrl: string;
  doc: Document;
  availableSlots: Document[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function RecategorizeDialog({
  categorizeUrl,
  doc,
  availableSlots,
  onClose,
  onSuccess,
}: RecategorizeDialogProps) {
  const eligible = availableSlots.filter(
    (s) => s.doc_type !== doc.doc_type && s.status !== 'approved' && s.status !== 'waived'
  );

  const [targetDocType, setTargetDocType] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!targetDocType) {
      setError('Please select a target slot.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(
        categorizeUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_doc_type: targetDocType }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Move failed');
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Move failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white border border-[var(--border)] w-full max-w-md mx-4 p-6 space-y-5">
        <div>
          <h2 className="text-base font-bold font-serif text-[var(--ink)]">
            Re-categorize Document
          </h2>
          <p className="text-xs text-[var(--muted)] mt-1">
            Moving: <span className="font-medium text-[var(--ink)]">{doc.label}</span>
          </p>
        </div>

        {eligible.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No eligible target slots available. All other slots are either approved, waived, or do not exist.
          </p>
        ) : (
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-[var(--ink)] uppercase tracking-wide">
              Move to slot <span className="text-[var(--error)]">*</span>
            </label>
            <select
              value={targetDocType}
              onChange={(e) => { setTargetDocType(e.target.value); setError(''); }}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] bg-white"
            >
              <option value="">— Select target slot —</option>
              {eligible.map((s) => (
                <option key={s.doc_type} value={s.doc_type}>
                  {s.label} ({s.status})
                </option>
              ))}
            </select>
          </div>
        )}

        <p className="text-xs text-[var(--muted)] border border-[var(--border)] bg-[var(--bg-section)] px-3 py-2">
          The original slot will be cleared. Both slots will remain visible in the review surface. This action is recorded in the audit trail.
        </p>

        {error && <p className="text-xs text-[var(--error)]">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2 px-4 border border-[var(--border)] text-sm text-[var(--ink)] hover:bg-[var(--bg-section)] transition-colors duration-200 disabled:opacity-50"
          >
            Cancel
          </button>
          {eligible.length > 0 && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !targetDocType}
              className="flex-1 py-2 px-4 bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity duration-200 disabled:opacity-50"
            >
              {saving ? 'Moving…' : 'Move Document'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
