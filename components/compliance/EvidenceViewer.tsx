'use client';

import type { DynamicColumn, ProjectMatrixRow } from '@/types/compliance';

interface EvidenceViewerProps {
  column: DynamicColumn;
  completion: ProjectMatrixRow['completions'][string] | undefined;
  parentEvidence?: ProjectMatrixRow['parent_evidence'];
  submissionData?: ProjectMatrixRow['submission_data'];
  taskId: string;
}

export default function EvidenceViewer({
  column,
  completion,
  parentEvidence,
  submissionData,
  taskId,
}: EvidenceViewerProps) {
  // Evidence URL resolution order:
  // 1. completion.evidence_url (primary — tenant-uploaded evidence for this task)
  // 2. parent_evidence[taskId].evidence_url (inherited from parent project)
  // 3. submission_data[field] (legacy cross-ref for specific evidence types)
  
  let evidenceUrl: string | null = null;
  let evidenceSource: 'completion' | 'parent' | 'submission' | null = null;

  if (completion?.evidence_url) {
    evidenceUrl = completion.evidence_url;
    evidenceSource = 'completion';
  } else if (parentEvidence?.[taskId]?.evidence_url) {
    evidenceUrl = parentEvidence[taskId].evidence_url;
    evidenceSource = 'parent';
  } else if (submissionData?.insurance_file) {
    // Legacy cross-ref: if task name suggests insurance and submission has insurance_file, use it
    if (column.label.toLowerCase().includes('insurance')) {
      evidenceUrl = submissionData.insurance_file;
      evidenceSource = 'submission';
    }
  }

  const proxyUrl = evidenceUrl ? `/api/admin/file?path=${encodeURIComponent(evidenceUrl)}` : null;

  // Staff check without evidence — show "no submission" message
  if (column.evidence_type === 'staff_check' && !proxyUrl) {
    return (
      <div className="p-8 bg-[var(--bg-section)] border border-[var(--divider)] text-center">
        <div className="text-[var(--muted)] text-sm">
          <svg className="w-12 h-12 mx-auto mb-3 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="font-medium">No tenant submission — staff review only</p>
        </div>
      </div>
    );
  }

  // File viewer — handles file_upload, photo, and staff_check with evidence
  if (column.evidence_type === 'file_upload' || column.evidence_type === 'photo' || column.evidence_type === 'staff_check') {
    if (!proxyUrl) {
      return (
        <div className="p-8 bg-[var(--bg-section)] border border-[var(--divider)] text-center">
          <div className="text-[var(--muted)] text-sm">
            <svg className="w-12 h-12 mx-auto mb-3 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="font-medium mb-2">No document uploaded</p>
            <p className="text-xs">Tenant has not submitted evidence for this task.</p>
          </div>
        </div>
      );
    }

    const isPdf = evidenceUrl?.toLowerCase().endsWith('.pdf');
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(evidenceUrl || '');

    return (
      <div className="border border-[var(--divider)] bg-white">
        {evidenceSource && (
          <div className="px-4 py-2 bg-[var(--bg-section)] border-b border-[var(--divider)] text-xs text-[var(--muted)]">
            Source: {evidenceSource === 'parent' ? 'Inherited from parent project' : evidenceSource === 'submission' ? 'Legacy submission data' : 'Tenant upload'}
          </div>
        )}
        <div className="relative" style={{ minHeight: '500px' }}>
          {isPdf ? (
            <iframe
              src={proxyUrl}
              className="w-full h-full absolute inset-0"
              style={{ minHeight: '500px' }}
              title="PDF Viewer"
            />
          ) : isImage ? (
            <div className="p-4 flex items-center justify-center" style={{ minHeight: '500px' }}>
              <img src={proxyUrl} alt="Evidence" className="max-w-full max-h-full object-contain" />
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-sm text-[var(--muted)] mb-4">Preview not available for this file type.</p>
              <a
                href={proxyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary-light)] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open in new tab
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Signature
  if (column.evidence_type === 'signature') {
    if (!proxyUrl) {
      return (
        <div className="p-8 bg-[var(--bg-section)] border border-[var(--divider)] text-center">
          <div className="text-[var(--muted)] text-sm">
            <p className="font-medium">No signature on file</p>
          </div>
        </div>
      );
    }

    return (
      <div className="border border-[var(--divider)] bg-white p-6">
        <div className="text-sm text-[var(--muted)] mb-3">Signature:</div>
        <img src={proxyUrl} alt="Signature" className="max-w-md border border-[var(--divider)] bg-[var(--bg-section)] p-4" />
      </div>
    );
  }

  // Acknowledgment
  if (column.evidence_type === 'acknowledgment') {
    const acknowledged = completion?.status === 'complete' || completion?.status === 'waived';
    const timestamp = completion?.completed_at ? new Date(completion.completed_at).toLocaleString() : null;

    return (
      <div className="border border-[var(--divider)] bg-white p-6">
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium text-[var(--ink)] mb-2">Task Instructions:</div>
            <div className="text-sm text-[var(--muted)] bg-[var(--bg-section)] p-4 border border-[var(--divider)]">
              {column.label}
            </div>
          </div>
          {acknowledged && timestamp && (
            <div className="flex items-center gap-2 text-sm text-[var(--success)]">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Acknowledged on {timestamp}</span>
            </div>
          )}
          {!acknowledged && (
            <div className="text-sm text-[var(--error)]">Not yet acknowledged by tenant</div>
          )}
        </div>
      </div>
    );
  }

  // Form submission
  if (column.evidence_type === 'form') {
    const formSubmissionId = completion?.form_submission_id;
    
    return (
      <div className="border border-[var(--divider)] bg-white p-6">
        {formSubmissionId ? (
          <div className="space-y-3">
            <div className="text-sm text-[var(--ink)]">
              <span className="font-medium">Form Submission ID:</span> {formSubmissionId}
            </div>
            <a
              href={`/admin/form-submissions/${formSubmissionId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium hover:bg-[var(--primary-light)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View submission
            </a>
          </div>
        ) : (
          <div className="text-sm text-[var(--muted)]">No form submission on file</div>
        )}
      </div>
    );
  }

  // Fallback for unknown evidence types
  return (
    <div className="p-8 bg-[var(--bg-section)] border border-[var(--divider)] text-center">
      <div className="text-[var(--muted)] text-sm">
        <p className="font-medium">Unknown evidence type: {column.evidence_type}</p>
      </div>
    </div>
  );
}
