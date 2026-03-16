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
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-start justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
          <div className="px-6 py-6">
            <div className="text-sm text-gray-600">
              No printable template is available for this form.
            </div>
          </div>
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-900 text-white rounded-none hover:bg-gray-800 transition-colors font-medium text-sm"
            >
              Close
            </button>
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
      showPrintButton
      onClose={onClose}
    />
  );
}
