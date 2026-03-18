'use client';

import { useState, useRef } from 'react';
import { TaskComponentProps } from './types';

export default function FileUploadTask({ task, token, t, onComplete }: TaskComponentProps) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!file) {
      setError(t.file_required);
      return;
    }
    setSubmitting(true);
    setProgress(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

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
      setProgress(false);
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
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            setFile(f);
            setError('');
          }}
          className="hidden"
        />
        <svg className="mx-auto h-8 w-8 text-[var(--muted)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        {file ? (
          <p className="text-sm font-medium text-[var(--primary)]">{file.name}</p>
        ) : (
          <p className="text-sm text-[var(--muted)]">{t.select_file}</p>
        )}
        <p className="text-xs text-[var(--muted)] mt-1">PDF, JPG, PNG</p>
      </div>

      {progress && (
        <div className="w-full bg-[var(--bg-section)] rounded-none h-2">
          <div className="bg-[var(--primary)] h-2 rounded-none animate-pulse w-full" />
        </div>
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
