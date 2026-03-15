'use client';

import { useState, useEffect } from 'react';

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentPath: string | null;
  documentType: 'signature' | 'insurance' | 'addendum' | 'photo';
  title?: string;
  date?: string;
}

export default function DocumentViewerModal({ 
  isOpen, 
  onClose, 
  documentPath, 
  documentType,
  title,
  date 
}: DocumentViewerModalProps) {
  const [documentUrl, setDocumentUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen && documentPath) {
      loadDocument();
    }
  }, [isOpen, documentPath]);

  const loadDocument = async () => {
    if (!documentPath) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const url = `/api/admin/file?path=${encodeURIComponent(documentPath)}`;
      setDocumentUrl(url);
    } catch (err) {
      setError('Failed to load document');
      console.error('Document load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const isPdf = documentPath?.toLowerCase().endsWith('.pdf');
  const isImage = !isPdf;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border border-[var(--border)] max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--divider)]">
          <div>
            <h3 className="text-lg font-serif text-[var(--primary)]">
              {title || `${documentType.charAt(0).toUpperCase() + documentType.slice(1)} Document`}
            </h3>
            {date && (
              <div className="text-sm text-[var(--muted)] mt-1">
                {documentType === 'signature' ? 'Signed' : 'Uploaded'}: {new Date(date).toLocaleString()}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors duration-200"
            title="Close (Escape)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 bg-[var(--bg-section)]">
          {isLoading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-[var(--muted)]">Loading document...</div>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="text-[var(--error)] mb-2">⚠️ {error}</div>
              <button
                onClick={loadDocument}
                className="px-4 py-2 bg-[var(--primary)] text-white rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200"
              >
                Retry
              </button>
            </div>
          )}

          {!isLoading && !error && documentUrl && (
            <>
              {isImage && (
                <div className="flex justify-center">
                  <img
                    src={documentUrl}
                    alt={title || 'Document'}
                    className="max-w-full h-auto border border-[var(--divider)]"
                    style={{ maxHeight: '70vh' }}
                  />
                </div>
              )}

              {isPdf && (
                <div className="h-full">
                  <iframe
                    src={documentUrl}
                    className="w-full h-full border border-[var(--divider)] rounded-none"
                    style={{ minHeight: '70vh' }}
                    title={title || 'PDF Document'}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--divider)] bg-white">
          <div className="flex items-center justify-between text-sm text-[var(--muted)]">
            <div>
              {documentPath && `File: ${documentPath.split('/').pop()}`}
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  const printWindow = window.open(documentUrl, '_blank');
                  if (printWindow) {
                    printWindow.onload = () => {
                      setTimeout(() => printWindow.print(), 500);
                    };
                  }
                }}
                className="hover:text-[var(--primary)] transition-colors duration-200"
              >
                Print
              </button>
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = documentUrl;
                  link.download = documentPath?.split('/').pop() || 'document';
                  link.target = '_blank';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="hover:text-[var(--primary)] transition-colors duration-200"
              >
                Download
              </button>
              <button
                onClick={onClose}
                className="hover:text-[var(--primary)] transition-colors duration-200"
              >
                Close (Escape)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
