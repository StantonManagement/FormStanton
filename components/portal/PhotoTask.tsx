'use client';

import { useState, useRef } from 'react';
import { TaskComponentProps } from './types';

export default function PhotoTask({ task, token, t, onComplete }: TaskComponentProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (f: File | null) => {
    setFile(f);
    setError('');
    if (f) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      setError(t.file_required);
      return;
    }
    setSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (note.trim()) formData.append('notes', note.trim());

      const res = await fetch(`/api/t/${token}/tasks/${task.id}/complete`, {
        method: 'POST',
        body: formData,
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

      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-[var(--border)] rounded-none p-6 text-center cursor-pointer hover:border-[var(--primary)] transition-colors duration-200"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
          className="hidden"
        />
        <svg className="mx-auto h-8 w-8 text-[var(--muted)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {file ? (
          <p className="text-sm font-medium text-[var(--primary)]">{file.name}</p>
        ) : (
          <p className="text-sm text-[var(--muted)]">{t.take_photo}</p>
        )}
      </div>

      {preview && (
        <div className="relative">
          <img
            src={preview}
            alt="Preview"
            className="w-full max-h-64 object-contain border border-[var(--border)] rounded-none"
          />
          <button
            type="button"
            onClick={() => { handleFileChange(null); if (inputRef.current) inputRef.current.value = ''; }}
            className="absolute top-2 right-2 bg-white border border-[var(--border)] rounded-none p-1 hover:bg-[var(--bg-section)] transition-colors duration-200"
          >
            <svg className="w-4 h-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

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
        disabled={!file || submitting}
        className="w-full bg-[var(--primary)] text-white py-3 px-4 rounded-none font-medium text-sm hover:bg-[var(--primary-light)] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? t.submitting : t.submit}
      </button>
    </div>
  );
}
