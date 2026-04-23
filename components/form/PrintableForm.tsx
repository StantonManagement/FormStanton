'use client';

import { useEffect } from 'react';
import { formatFormContent } from '@/lib/formUtils';

interface PrintableFormProps {
  content: string;
  formId?: number;
  formTitle?: string;
  formPath?: string;
  showPrintButton?: boolean;
  onClose?: () => void;
  onPrint?: () => void;
}

export default function PrintableForm({
  content,
  formId,
  formTitle,
  formPath,
  showPrintButton = false,
  onClose,
  onPrint,
}: PrintableFormProps) {
  useEffect(() => {
    if (onClose) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  const handlePrint = () => {
    if (onPrint) { onPrint(); } else { window.print(); }
  };

  const formattedContent = formatFormContent(content);
  const isModal = Boolean(onClose);

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-start justify-center p-4">
        <div className="bg-[var(--paper)] shadow-xl max-w-4xl w-full my-8 print:my-0 print:max-w-none print:shadow-none border border-[var(--border)]">
          {/* Branded Header - Hidden when printing */}
          <div className="sticky top-0 z-10 bg-[var(--primary)] px-6 py-4 flex items-center justify-between print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/15 rounded-sm flex items-center justify-center flex-shrink-0">
                <span className="text-white font-serif font-bold text-sm">SM</span>
              </div>
              <div className="border-l border-white/20 pl-3">
                {formId && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
                    Form {formId}
                  </span>
                )}
                {formTitle && (
                  <h2 className="text-base font-semibold text-white font-serif leading-tight">{formTitle}</h2>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {showPrintButton && (
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 text-white/90 bg-white/10 rounded-none hover:bg-white/20 transition-colors duration-200 font-medium text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-white/70 hover:text-white transition-colors duration-200"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Form Content */}
          <div className="bg-white">
            <div className="px-8 py-8 print:px-0 print:py-0">
              <div className="prose prose-sm max-w-none print:prose-base">
                <div
                  className="form-content"
                  dangerouslySetInnerHTML={{ __html: formattedContent }}
                />
              </div>
            </div>
          </div>

          {/* Footer - Hidden when printing */}
          <div className="border-t border-[var(--border)] bg-[var(--bg-section)] px-6 py-4 print:hidden">
            <div className="flex items-center justify-between">
              <div className="text-xs text-[var(--muted)]">
                <p className="font-medium text-[var(--primary)]">Stanton Management LLC</p>
                <p>421 Park Street, Hartford, CT 06106 | (860) 993-3401</p>
              </div>
              <div className="flex items-center gap-2">
                {formPath && (
                  <a
                    href={formPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 border border-[var(--border)] text-[var(--ink)] rounded-none hover:bg-white transition-colors duration-200 font-medium text-sm flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open Live Form
                  </a>
                )}
                <button
                  onClick={onClose}
                  className="px-5 py-2 bg-[var(--primary)] text-white rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 font-medium text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Standalone mode (not modal)
  return (
    <div className="bg-white rounded-none shadow-sm border border-[var(--border)] print:shadow-none print:border-0">
      {(formTitle || showPrintButton) && (
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between print:hidden">
          {formTitle && (
            <h2 className="text-xl font-bold text-gray-900">{formTitle}</h2>
          )}
          {showPrintButton && (
            <button
              onClick={handlePrint}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-none hover:bg-gray-200 transition-colors font-medium text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
          )}
        </div>
      )}
      <div className="px-6 py-6 print:px-0 print:py-0">
        <div className="prose prose-sm max-w-none print:prose-base">
          <div
            className="form-content"
            dangerouslySetInnerHTML={{ __html: formattedContent }}
          />
        </div>
      </div>
    </div>
  );
}
