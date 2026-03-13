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

  const hasTemplateContent = Boolean(form.content);

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
        <div className="px-6 py-6 print:px-0 print:py-0">
          <div className="prose prose-sm max-w-none print:prose-base">
            {hasTemplateContent ? (
              <div
                className="form-content"
                dangerouslySetInnerHTML={{
                  __html: formatFormContent(form.content as string)
                }}
              />
            ) : (
              <div className="text-sm text-gray-600">
                No printable template is available for this form.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatFormContent(content: string): string {
  // Convert markdown-style content to HTML with enhanced print formatting
  let html = content;

  // Escape HTML entities first
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Headers with print-optimized classes
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-gray-900 mt-6 mb-3 avoid-break">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-gray-900 mt-8 mb-4 avoid-break">$1</h2>');

  // Bold text - company name and field labels
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Horizontal rules - section dividers
  html = html.replace(/^---$/gm, '<hr class="my-6 border-gray-300" />');

  // Checkboxes with better spacing for print
  html = html.replace(/- \[ \] (.+)$/gm, '<div class="flex items-start gap-2 my-3 avoid-break"><input type="checkbox" class="mt-1" /><span>$1</span></div>');

  // Process markdown tables with enhanced print styling
  const tableRegex = /\|(.+)\|\n\|[-\s|]+\|\n((\|.+\|\n?)+)/gm;
  html = html.replace(tableRegex, (match, headerRow, bodyRows) => {
    // Parse header
    const headers = headerRow.split('|').filter((cell: string) => cell.trim()).map((cell: string) => cell.trim());
    
    // Parse body rows
    const rows = bodyRows.trim().split('\n').map((row: string) => {
      return row.split('|').filter((cell: string) => cell.trim()).map((cell: string) => cell.trim());
    });

    // Build table HTML
    let tableHtml = '<table class="w-full border-collapse my-4 avoid-break">';
    
    // Add header
    if (headers.length > 0) {
      tableHtml += '<thead><tr>';
      headers.forEach((header: string) => {
        tableHtml += `<th class="border border-gray-400 px-3 py-2 bg-gray-100 text-left font-semibold">${header}</th>`;
      });
      tableHtml += '</tr></thead>';
    }
    
    // Add body
    tableHtml += '<tbody>';
    rows.forEach((row: string[]) => {
      if (row.length > 0) {
        tableHtml += '<tr>';
        row.forEach((cell: string) => {
          tableHtml += `<td class="border border-gray-400 px-3 py-2">${cell || '&nbsp;'}</td>`;
        });
        tableHtml += '</tr>';
      }
    });
    tableHtml += '</tbody></table>';
    
    return tableHtml;
  });

  // Blockquotes - important instructions
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-4 border-gray-400 pl-4 italic text-gray-700 my-4 bg-gray-50 py-2 avoid-break">$1</blockquote>');

  // Format field lines (e.g., "Tenant Name: _______________")
  html = html.replace(/([A-Z][^:]+):\s*_{5,}/g, (match, label) => {
    return `<div class="my-3"><strong>${label}:</strong> <span class="inline-block border-b border-gray-800 min-w-[300px] pb-1">&nbsp;</span></div>`;
  });

  // Signature lines - special formatting
  html = html.replace(/\*\*([^*]+Signature[^*]*):\*\*\s*_{10,}\s*Date:\s*_{5,}/g, (match, label) => {
    return `<div class="mt-6 mb-4 avoid-break">
      <div class="flex gap-8 items-end">
        <div class="flex-1">
          <div class="border-b-2 border-gray-800 pb-1 mb-1">&nbsp;</div>
          <div class="text-sm font-semibold">${label}</div>
        </div>
        <div class="w-32">
          <div class="border-b-2 border-gray-800 pb-1 mb-1">&nbsp;</div>
          <div class="text-sm font-semibold">Date</div>
        </div>
      </div>
    </div>`;
  });

  // Office use sections
  html = html.replace(/\*For office use[^*]*\*/gi, (match) => {
    return `<div class="mt-6 pt-4 border-t-2 border-dashed border-gray-400 text-sm text-gray-600 italic">${match.replace(/\*/g, '')}</div>`;
  });

  // Convert line breaks - preserve double breaks for paragraphs
  html = html.replace(/\n\n/g, '</p><p class="my-3">');
  html = html.replace(/\n/g, '<br />');
  
  // Wrap in paragraph tags
  html = '<p class="my-3">' + html + '</p>';
  
  // Clean up empty paragraphs
  html = html.replace(/<p class="my-3">\s*<\/p>/g, '');

  return html;
}
