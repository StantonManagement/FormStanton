'use client';

import { useState } from 'react';
import { TaskComponentProps } from './types';
import DocumentScanner, { Metadata } from '@/components/DocumentScanner/DocumentScanner';

export default function FileUploadTask({ task, token, projectUnitId, language, onComplete }: TaskComponentProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleScannerComplete = async (evidenceUrl: string, metadata: Metadata) => {
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/t/${token}/tasks/${task.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evidence_url: evidenceUrl,
          evidence_metadata: metadata,
        }),
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
      <DocumentScanner
        taskId={task.id}
        projectUnitId={projectUnitId}
        instructions={task.task_type.instructions || ''}
        language={language}
        onComplete={handleScannerComplete}
        onCancel={() => {
          setError('');
        }}
      />

      {error && (
        <p className="text-sm text-[var(--error)]">{error}</p>
      )}
      {submitting && <p className="text-sm text-[var(--muted)]">Uploading...</p>}
    </div>
  );
}
