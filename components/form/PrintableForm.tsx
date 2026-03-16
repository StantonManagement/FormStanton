'use client';

import { useEffect } from 'react';
import { formatFormContent } from '@/lib/formUtils';

interface PrintableFormProps {
  content: string;
  formId?: number;
  formTitle?: string;
  showPrintButton?: boolean;
  onClose?: () => void;
}

export default function PrintableForm({
  content,
  formId,
  formTitle,
  showPrintButton = false,
  onClose,
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
    window.print();
  };

  const formattedContent = formatFormContent(content);
  const isModal = Boolean(onClose);

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-start justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8 print:my-0 print:max-w-none print:shadow-none">
          {/* Header - Hidden when printing */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between print:hidden z-10">
            <div>
              {formId && (
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    Form {formId}
                  </span>
                </div>
              )}
              {formTitle && (
                <h2 className="text-xl font-bold text-gray-900">{formTitle}</h2>
              )}
            </div>
            <div className="flex items-center gap-2">
              {showPrintButton && (
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Form Content */}
          <div className="px-6 py-6 print:px-0 print:py-0">
            <div className="prose prose-sm max-w-none print:prose-base">
              <div
                className="form-content"
                dangerouslySetInnerHTML={{ __html: formattedContent }}
              />
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
