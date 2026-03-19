'use client';

import { useState } from 'react';
import SignatureCanvasComponent from '@/components/SignatureCanvas';
import { TaskComponentProps } from './types';

export default function SignatureTask({ task, token, t, onComplete }: TaskComponentProps) {
  const [signatureData, setSignatureData] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');

  const handleSubmit = async () => {
    if (!signatureData) {
      setError(t.signature_required);
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/t/${token}/tasks/${task.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature_data: signatureData, ...(note.trim() ? { notes: note.trim() } : {}) }),
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
      {task.task_type.instructions && (
        <p className="text-sm text-[var(--ink)] leading-relaxed">{task.task_type.instructions}</p>
      )}

      <SignatureCanvasComponent
        label={task.task_type.name}
        value={signatureData}
        onSave={(dataUrl) => setSignatureData(dataUrl)}
      />

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

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setSignatureData('')}
          className="flex-1 border border-[var(--border)] text-[var(--ink)] py-3 px-4 rounded-none font-medium text-sm hover:bg-[var(--bg-section)] transition-colors duration-200"
        >
          {t.clear}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!signatureData || submitting}
          className="flex-1 bg-[var(--primary)] text-white py-3 px-4 rounded-none font-medium text-sm hover:bg-[var(--primary-light)] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? t.submitting : t.submit}
        </button>
      </div>
    </div>
  );
}
