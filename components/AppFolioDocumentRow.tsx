'use client';

import { useState } from 'react';
import AlertDialog from '@/components/kit/AlertDialog';
import DocumentDownloadButton from './DocumentDownloadButton';

interface AppFolioDocumentRowProps {
  documentType: 'Pet Addendum' | 'Vehicle Addendum' | 'Insurance';
  documentPath?: string | null;
  uploadedToAppfolio: boolean;
  uploadedAt?: string | null;
  uploadedBy?: string | null;
  uploadNote?: string | null;
  onMarkUploaded: (note: string) => Promise<void>;
  disabled?: boolean;
}

export default function AppFolioDocumentRow({
  documentType,
  documentPath,
  uploadedToAppfolio,
  uploadedAt,
  uploadedBy,
  uploadNote,
  onMarkUploaded,
  disabled = false
}: AppFolioDocumentRowProps) {
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'success' | 'error' | 'info';
  }>({ isOpen: false, title: '', message: '' });

  const handleMarkUploaded = async () => {
    setIsSubmitting(true);
    try {
      await onMarkUploaded(note);
      setShowNoteInput(false);
      setNote('');
    } catch (error) {
      console.error('Failed to mark uploaded:', error);
      setAlertDialog({
        isOpen: true,
        title: 'Error',
        message: 'Failed to mark document as uploaded',
        variant: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-[var(--divider)] last:border-b-0">
      <div className="flex-1">
        <div className="text-sm font-medium text-[var(--ink)] mb-1">
          {documentType}
        </div>
        
        <div className="flex items-center gap-2">
          <DocumentDownloadButton
            documentPath={documentPath}
            documentName={`${documentType.replace(/\s+/g, '_')}.pdf`}
            size="sm"
          />
          
          {uploadedToAppfolio ? (
            <div className="flex items-center gap-1.5 text-xs text-[var(--success)]">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span 
                className="font-medium"
                title={uploadedAt ? `Uploaded on ${new Date(uploadedAt).toLocaleString()}` : ''}
              >
                Uploaded to AppFolio
              </span>
              {uploadedBy && (
                <span className="text-[var(--muted)]">by {uploadedBy}</span>
              )}
              {uploadNote && (
                <span className="text-[var(--muted)] italic ml-1">({uploadNote})</span>
              )}
            </div>
          ) : (
            <div className="text-xs text-[var(--muted)]">
              Not uploaded to AppFolio
            </div>
          )}
        </div>
      </div>

      {!uploadedToAppfolio && !disabled && (
        <div className="flex-shrink-0">
          {!showNoteInput ? (
            <button
              onClick={() => setShowNoteInput(true)}
              className="text-xs px-3 py-1.5 bg-[var(--primary)] text-white rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out whitespace-nowrap"
            >
              Mark Uploaded
            </button>
          ) : (
            <div className="flex flex-col gap-2 min-w-[200px]">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                className="text-xs px-2 py-1 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleMarkUploaded}
                  disabled={isSubmitting}
                  className="flex-1 text-xs px-2 py-1 bg-[var(--primary)] text-white rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Confirm'}
                </button>
                <button
                  onClick={() => {
                    setShowNoteInput(false);
                    setNote('');
                  }}
                  disabled={isSubmitting}
                  className="text-xs px-2 py-1 bg-white text-[var(--muted)] border border-[var(--border)] rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <AlertDialog
        isOpen={alertDialog.isOpen}
        title={alertDialog.title}
        message={alertDialog.message}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        variant={alertDialog.variant}
      />
    </div>
  );
}
