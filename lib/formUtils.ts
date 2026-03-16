/**
 * Form Utilities
 * Common validation and formatting functions for forms
 */

/**
 * Validates email address format
 */
export function validateEmail(email: string): boolean {
  if (!email || !email.trim()) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Validates phone number (10 digits)
 */
export function validatePhone(phone: string): boolean {
  if (!phone) return false;
  const digitsOnly = phone.replace(/\D/g, '');
  return digitsOnly.length === 10;
}

/**
 * Formats phone number to (XXX) XXX-XXXX
 */
export function formatPhone(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length !== 10) return phone;
  return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
}

/**
 * Strips non-digit characters from phone number
 */
export function sanitizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Validates required field
 */
export function validateRequired(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return !isNaN(value);
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

/**
 * Validates minimum length
 */
export function validateMinLength(value: string, minLength: number): boolean {
  return value.trim().length >= minLength;
}

/**
 * Validates maximum length
 */
export function validateMaxLength(value: string, maxLength: number): boolean {
  return value.trim().length <= maxLength;
}

/**
 * Validates number range
 */
export function validateNumberRange(value: number, min?: number, max?: number): boolean {
  if (isNaN(value)) return false;
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

/**
 * Validates date is not in the future
 */
export function validateDateNotFuture(date: string): boolean {
  const inputDate = new Date(date);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return inputDate <= today;
}

/**
 * Validates date is not in the past
 */
export function validateDateNotPast(date: string): boolean {
  const inputDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return inputDate >= today;
}

/**
 * Creates FormData from object with optional file attachments
 */
export function createFormData(
  data: Record<string, any>,
  files?: Record<string, File | File[] | null>
): FormData {
  const formData = new FormData();

  // Add regular data fields
  Object.entries(data).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      if (typeof value === 'object' && !Array.isArray(value)) {
        formData.append(key, JSON.stringify(value));
      } else if (Array.isArray(value)) {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, String(value));
      }
    }
  });

  // Add file attachments
  if (files) {
    Object.entries(files).forEach(([key, file]) => {
      if (file) {
        if (Array.isArray(file)) {
          file.forEach((f, index) => {
            formData.append(`${key}_${index}`, f);
          });
        } else {
          formData.append(key, file);
        }
      }
    });
  }

  return formData;
}

/**
 * Formats currency value
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

/**
 * Parses currency string to number
 */
export function parseCurrency(value: string): number {
  return parseFloat(value.replace(/[^0-9.-]+/g, '')) || 0;
}

/**
 * Generates a unique ID for form fields
 */
export function generateFieldId(prefix: string = 'field'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Debounces a function call
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Converts markdown-style form content to HTML with enhanced print formatting
 * 
 * Supports:
 * - Headers (## H2, ### H3)
 * - Bold text (**text**)
 * - Horizontal rules (---)
 * - Checkboxes (- [ ] item)
 * - Tables (markdown table syntax)
 * - Blockquotes (> text)
 * - Field lines (Label: _______)
 * - Signature lines (**Label Signature:** __________ Date: _____)
 * - Office use sections (*For office use...*)
 * 
 * @param content - Markdown-style content string
 * @returns HTML string with print-optimized classes
 */
export function formatFormContent(content: string): string {
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
