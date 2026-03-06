import { TenantForm } from '@/lib/formsData';
import { useEffect } from 'react';

interface FormDetailModalProps {
  form: TenantForm | null;
  onClose: () => void;
}

export default function FormDetailModal({ form, onClose }: FormDetailModalProps) {
  useEffect(() => {
    if (form) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [form]);

  if (!form) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-start justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8 print:my-0 print:max-w-none print:shadow-none">
        {/* Header - Hidden when printing */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between print:hidden z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                Form {form.id}
              </span>
            </div>
            <h2 className="text-xl font-bold text-gray-900">{form.title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
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
        <div className="px-6 py-6 print:px-12 print:py-8">
          <div className="prose prose-sm max-w-none print:prose-base">
            {/* Render form content with proper formatting */}
            <div 
              className="form-content"
              dangerouslySetInnerHTML={{ 
                __html: formatFormContent(form.content) 
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function formatFormContent(content: string): string {
  // Convert markdown-style content to HTML
  let html = content;

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-gray-900 mt-6 mb-3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-gray-900 mt-8 mb-4">$1</h2>');

  // Bold text
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr class="my-6 border-gray-300" />');

  // Checkboxes
  html = html.replace(/- \[ \] (.+)$/gm, '<div class="flex items-start gap-2 my-2"><input type="checkbox" class="mt-1" /><span>$1</span></div>');

  // Tables - convert markdown tables to HTML
  html = html.replace(/\|(.+)\|/g, (match) => {
    const cells = match.split('|').filter(cell => cell.trim());
    const isHeader = match.includes('---');
    
    if (isHeader) {
      return ''; // Skip separator rows
    }
    
    const cellTags = cells.map(cell => {
      const trimmed = cell.trim();
      return `<td class="border border-gray-300 px-3 py-2">${trimmed}</td>`;
    }).join('');
    
    return `<tr>${cellTags}</tr>`;
  });

  // Wrap table rows
  html = html.replace(/(<tr>.+<\/tr>\n?)+/g, (match) => {
    return `<table class="w-full border-collapse my-4"><tbody>${match}</tbody></table>`;
  });

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-4">$1</blockquote>');

  // Line breaks
  html = html.replace(/\n\n/g, '<br /><br />');
  html = html.replace(/\n/g, '<br />');

  return html;
}
