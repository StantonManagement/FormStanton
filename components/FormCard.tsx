import { TenantForm } from '@/lib/formsData';

interface FormCardProps {
  form: TenantForm;
  onView: (form: TenantForm) => void;
}

export default function FormCard({ form, onView }: FormCardProps) {
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
      
      <button
        onClick={() => onView(form)}
        className="w-full mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium text-sm flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        View Form
      </button>
    </div>
  );
}
