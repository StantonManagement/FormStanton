'use client';

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import ConfirmDialog from '@/components/kit/ConfirmDialog';

// Inline SVG icons
const FileTextIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const AlertTriangleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

const DOC_TYPE_LABELS: Record<string, string> = {
  vehicle_addendum: 'Vehicle Addendum',
  pet_addendum: 'Pet Addendum',
  insurance: 'Insurance',
};

interface MatrixDocumentCellProps {
  /** Whether the tenant has this item at all (has_vehicle, has_pets, has_insurance) */
  applicable: boolean;
  /** Path in Supabase storage, or null if no document on file */
  filePath: string | null;
  /** Whether this doc has been uploaded to AppFolio */
  uploadedToAppfolio: boolean;
  /** Who uploaded it */
  uploadedBy: string | null;
  /** When it was uploaded */
  uploadedAt: string | null;
  /** submission ID for upload/mark actions */
  submissionId: string | null;
  /** e.g. 'vehicle_addendum', 'pet_addendum', 'insurance' */
  documentType: 'vehicle_addendum' | 'pet_addendum' | 'insurance';
  /** Whether this row is a missing-submission row */
  missing: boolean;
  /** Called after a successful action to refresh data */
  onRefresh: () => void;
  /** Tenant name for confirmation messages */
  tenantName: string;
  /** Unit number for confirmation messages */
  unitNumber: string;
  /** Optional toast callback */
  onToast?: (message: string, onUndo?: () => void) => void;
}

export default function MatrixDocumentCell({
  applicable,
  filePath,
  uploadedToAppfolio,
  uploadedBy,
  uploadedAt,
  submissionId,
  documentType,
  missing,
  onRefresh,
  tenantName,
  unitNumber,
  onToast,
}: MatrixDocumentCellProps) {
  const [uploading, setUploading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [confirmMark, setConfirmMark] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const docLabel = DOC_TYPE_LABELS[documentType] || documentType;

  // Not applicable — dash
  if (!applicable || missing) {
    return <td className="px-2 py-1.5 text-center text-xs text-[var(--muted)] border border-[var(--divider)]">—</td>;
  }

  const callMarkApi = async (undo: boolean) => {
    if (!submissionId) return;
    setMarking(true);
    try {
      const res = await fetch('/api/admin/compliance/mark-appfolio-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId, documentType, undo }),
      });
      const data = await res.json();
      if (data.success) {
        onRefresh();
        if (undo) {
          onToast?.(`${docLabel} reverted for ${tenantName}`);
        } else {
          onToast?.(`${docLabel} marked as uploaded for ${tenantName}`, () => callMarkApi(true));
        }
      }
    } catch (err) {
      console.error('Mark upload error:', err);
    } finally {
      setMarking(false);
    }
  };

  // State 2: Already uploaded to AppFolio
  if (uploadedToAppfolio) {
    const auditText = [
      uploadedBy && `by ${uploadedBy}`,
      uploadedAt && new Date(uploadedAt).toLocaleDateString(),
    ].filter(Boolean).join(' · ');
    const downloadUrl = filePath ? `/api/admin/file?path=${encodeURIComponent(filePath)}` : null;

    return (
      <>
        <td className="px-2 py-1.5 border border-[var(--divider)] group relative cursor-pointer hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out" onClick={() => setConfirmUndo(true)} title="Click to undo upload">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[var(--success)]" title="Uploaded to AppFolio">
              <CheckCircleIcon />
            </span>
            <span className="text-[var(--muted)]">Uploaded</span>
            {downloadUrl && (
              <>
                <span className="text-[var(--muted)]">·</span>
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[var(--muted)] hover:text-[var(--primary)] transition-colors duration-200 ease-out"
                  title="Download document"
                >
                  <ChevronDownIcon />
                </a>
              </>
            )}
          </div>
          {auditText && (
            <div className="absolute bottom-full left-2 mb-1 px-2 py-1 bg-[var(--ink)] text-white text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out pointer-events-none z-10">
              {auditText} · click to undo
            </div>
          )}
        </td>
        {confirmUndo && createPortal(
          <ConfirmDialog
            isOpen={confirmUndo}
            title={`Undo ${docLabel} Upload?`}
            message={`This will set ${docLabel.toLowerCase()} back to "not uploaded" for ${tenantName} (Unit ${unitNumber}).`}
            confirmText="Undo"
            cancelText="Keep"
            variant="warning"
            onConfirm={() => { setConfirmUndo(false); callMarkApi(true); }}
            onCancel={() => setConfirmUndo(false)}
          />,
          document.body
        )}
      </>
    );
  }

  // State 1: Document exists but not uploaded to AppFolio
  if (filePath) {
    const downloadUrl = `/api/admin/file?path=${encodeURIComponent(filePath)}`;

    return (
      <>
        <td className="px-2 py-1.5 border border-[var(--divider)]">
          <div className="flex items-center gap-1.5 text-xs">
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--muted)] hover:text-[var(--primary)] transition-colors duration-200 ease-out"
              title={`Download ${docLabel.toLowerCase()}`}
            >
              <FileTextIcon />
            </a>
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--muted)] hover:text-[var(--primary)] hover:underline transition-colors duration-200 ease-out"
              title={`Download ${docLabel.toLowerCase()}`}
            >
              {docLabel}
            </a>
            <span className="text-[var(--muted)]">·</span>
            <button
              onClick={() => setConfirmMark(true)}
              disabled={marking}
              className="text-xs text-[var(--text-muted)] hover:underline cursor-pointer transition-colors duration-200 ease-out disabled:opacity-50"
            >
              {marking ? 'Uploading...' : 'Upload to AppFolio'}
            </button>
          </div>
        </td>
        {confirmMark && createPortal(
          <ConfirmDialog
            isOpen={confirmMark}
            title={`Mark ${docLabel} as Uploaded?`}
            message={`Mark ${docLabel.toLowerCase()} as uploaded to AppFolio for ${tenantName} (Unit ${unitNumber}).`}
            confirmText="Mark Done"
            cancelText="Cancel"
            variant="info"
            onConfirm={() => { setConfirmMark(false); callMarkApi(false); }}
            onCancel={() => setConfirmMark(false)}
          />,
          document.body
        )}
      </>
    );
  }

  // State 3: No document on file — missing
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !submissionId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('submissionId', submissionId);
      formData.append('documentType', documentType);
      formData.append('file', file);

      const res = await fetch('/api/admin/compliance/attach-document', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) onRefresh();
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <td className="px-2 py-1.5 border border-[var(--divider)]">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.heic"
        onChange={handleFileUpload}
        className="hidden"
      />
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-[var(--warning)]" title="Document not yet received">
          <AlertTriangleIcon />
        </span>
        <span className="text-[var(--warning)]">Missing</span>
        <span className="text-[var(--muted)]">·</span>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-xs text-[var(--text-muted)] hover:underline cursor-pointer transition-colors duration-200 ease-out disabled:opacity-50"
        >
          {uploading ? 'Attaching...' : '+ Attach'}
        </button>
      </div>
    </td>
  );
}
