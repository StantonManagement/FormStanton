'use client';

import { useEffect, useState } from 'react';
import { TenantForm, Department, departmentLabels } from '@/lib/formsData';
import { FormField, FormInput, FormSelect, FormTextarea } from '@/components/form';

interface FormEditModalProps {
  form: TenantForm | null;
  isSaving: boolean;
  saveError: string;
  onClose: () => void;
  onSave: (updatedForm: {
    id: number;
    title: string;
    department: Department;
    description: string;
    path?: string;
    content?: string;
  }) => Promise<void>;
}

const departments: Department[] = ['property_management', 'maintenance', 'compliance', 'finance'];

export default function FormEditModal({ form, isSaving, saveError, onClose, onSave }: FormEditModalProps) {
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState<Department>('property_management');
  const [description, setDescription] = useState('');
  const [path, setPath] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (!form) {
      return;
    }

    setTitle(form.title);
    setDepartment(form.department);
    setDescription(form.description);
    setPath(form.path ?? '');
    setContent(form.content ?? '');
  }, [form]);

  if (!form) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    await onSave({
      id: form.id,
      title: title.trim(),
      department,
      description: description.trim(),
      path: path.trim() || undefined,
      content: content || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 p-4 overflow-y-auto">
      <div className="mx-auto my-8 w-full max-w-4xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Edit Form {form.id}</p>
            <h2 className="text-xl font-semibold text-gray-900">{form.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-none hover:bg-gray-50 transition-colors"
            disabled={isSaving}
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {saveError && (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {saveError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Title" required>
              <FormInput value={title} onChange={(event) => setTitle(event.target.value)} required />
            </FormField>

            <FormField label="Department" required>
              <FormSelect
                value={department}
                onChange={(event) => setDepartment(event.target.value as Department)}
                required
              >
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {departmentLabels[dept]}
                  </option>
                ))}
              </FormSelect>
            </FormField>
          </div>

          <FormField label="Description" required>
            <FormTextarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              required
            />
          </FormField>

          <FormField label="Live Form Path">
            <FormInput
              value={path}
              onChange={(event) => setPath(event.target.value)}
              placeholder="/maintenance-request"
            />
          </FormField>

          <FormField label="Template Content (Markdown/Plain Text)">
            <FormTextarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={18}
              className="font-mono text-sm"
            />
          </FormField>

          <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-5 py-2 border border-gray-300 text-gray-700 rounded-none hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-gray-900 text-white rounded-none hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
