import { TenantForm } from '@/lib/formsData';
import { PrintableForm } from '@/components/form';

interface FormDetailModalProps {
  form: TenantForm | null;
  onClose: () => void;
}

export default function FormDetailModal({ form, onClose }: FormDetailModalProps) {
  if (!form) return null;

  const hasTemplateContent = Boolean(form.content);

  if (!hasTemplateContent) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-start justify-center p-4">
        <div className="bg-[var(--paper)] shadow-xl max-w-lg w-full my-8 border border-[var(--border)]">
          {/* Branded Header */}
          <div className="bg-[var(--primary)] px-6 py-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-white/15 rounded-sm flex items-center justify-center flex-shrink-0">
              <span className="text-white font-serif font-bold text-sm">SM</span>
            </div>
            <div className="border-l border-white/20 pl-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
                Form {form.id}
              </span>
              <h2 className="text-base font-semibold text-white font-serif leading-tight">{form.title}</h2>
            </div>
          </div>

          <div className="px-6 py-8 text-center">
            <svg className="w-10 h-10 text-[var(--muted)] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-[var(--ink)] font-medium mb-1">No printable template available</p>
            <p className="text-xs text-[var(--muted)]">
              {form.path
                ? 'This form is available as a live digital form.'
                : 'Use the Edit button to add template content for this form.'}
            </p>
          </div>

          <div className="border-t border-[var(--border)] bg-[var(--bg-section)] px-6 py-4 flex items-center justify-between">
            <div className="text-xs text-[var(--muted)]">
              <p className="font-medium text-[var(--primary)]">Stanton Management LLC</p>
            </div>
            <div className="flex items-center gap-2">
              {form.path && (
                <a
                  href={form.path}
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
    );
  }

  return (
    <PrintableForm
      content={form.content as string}
      formId={form.id}
      formTitle={form.title}
      formPath={form.path}
      showPrintButton
      onClose={onClose}
    />
  );
}
