import { TenantForm } from '@/lib/formsData';

interface FormCardProps {
  form: TenantForm;
  onView: (form: TenantForm) => void;
  onEdit: (form: TenantForm) => void;
}

export default function FormCard({ form, onView, onEdit }: FormCardProps) {
  const hasTemplate = Boolean(form.content);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded">
              Form {form.id}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {form.title}
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            {form.description}
          </p>
        </div>
      </div>
      
      <div className="mt-4 flex gap-2">
        {form.path && (
          <a
            href={form.path}
            className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm flex items-center justify-center gap-2"
          >
            Open Form
          </a>
        )}

        <button
          onClick={() => onEdit(form)}
          className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-none hover:bg-gray-800 transition-colors font-medium text-sm flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit
        </button>

        {hasTemplate && (
          <button
            onClick={() => onView(form)}
            className="flex-1 px-4 py-2 bg-white text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium text-sm flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View Template
          </button>
        )}
      </div>
    </div>
  );
}
