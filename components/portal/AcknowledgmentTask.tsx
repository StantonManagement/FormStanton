'use client';

import { useState } from 'react';
import { TaskComponentProps } from './types';

export default function AcknowledgmentTask({ task, token, t, onComplete }: TaskComponentProps) {
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');

  const instructionText = task.task_type.instructions || t.acknowledgment_default;

  const handleSubmit = async () => {
    if (!checked) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/t/${token}/tasks/${task.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: note ? `Acknowledged: ${note}` : 'Acknowledged' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed');
      }

      onComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 w-5 h-5 rounded-none border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
        />
        <span className="text-sm text-[var(--ink)] leading-relaxed">{instructionText}</span>
      </label>

      <button
        type="button"
        onClick={() => setShowNote(!showNote)}
        className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors duration-200 underline"
      >
        {t.add_note}
      </button>

      {showNote && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t.notes_placeholder}
          rows={2}
          className="w-full border border-[var(--border)] rounded-none p-3 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] bg-white focus:outline-none focus:border-[var(--primary)] transition-colors duration-200 resize-none"
        />
      )}

      {error && (
        <p className="text-sm text-[var(--error)]">{error}</p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!checked || submitting}
        className="w-full bg-[var(--primary)] text-white py-3 px-4 rounded-none font-medium text-sm hover:bg-[var(--primary-light)] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? t.submitting : t.submit}
      </button>
    </div>
  );
}
