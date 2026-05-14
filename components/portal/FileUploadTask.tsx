'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { TaskComponentProps } from './types';
import type { ScannerMetadata } from '@/components/DocumentScanner/DocumentScanner';

const DocumentScanner = dynamic(
  () => import('@/components/DocumentScanner/DocumentScanner'),
  { ssr: false }
);

export default function FileUploadTask({ task, token, projectUnitId, language, onComplete }: TaskComponentProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleScannerComplete = async (file: File, metadata: ScannerMetadata) => {
    setSubmitting(true);
    setError('');

    try {
      // Upload to Supabase storage (same path convention as before refactor)
      const timestamp = Date.now();
      const basePath = `uploads/${projectUnitId}/${task.id}`;
      const ext = metadata.format === 'pdf' ? 'pdf' : 'jpeg';
      const storagePath = `${basePath}/${timestamp}_combined.${ext}`;

      const { error: uploadError } = await supabase.storage.from('project-evidence').upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from('project-evidence').getPublicUrl(storagePath);
      const evidenceUrl = data.publicUrl;

      // Write to task_completions (same columns as before refactor)
      const { error: completionError } = await supabase
        .from('task_completions')
        .update({
          status: 'complete',
          evidence_url: evidenceUrl,
          completed_by: 'tenant',
          completed_at: new Date().toISOString(),
          evidence_metadata: metadata,
        })
        .eq('project_unit_id', projectUnitId)
        .eq('project_task_id', task.id);

      if (completionError) {
        throw completionError;
      }

      // Call API route to trigger status recalculation and return refreshed task list
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
