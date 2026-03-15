import { useState } from 'react';
import Link from 'next/link';
import {
  FormSubmissionStatus,
  FormPriority,
  statusLabels,
  statusColors,
  STAFF_MEMBERS,
  getFormTypeInfo,
} from '@/lib/formTypeLabels';

interface FormSubmission {
  id: string;
  form_type: string;
  tenant_name: string | null;
  building_address: string | null;
  unit_number: string | null;
  submitted_at: string;
  status: FormSubmissionStatus;
  assigned_to: string | null;
  priority: FormPriority | null;
  form_data: any;
}

interface Props {
  submission: FormSubmission | null;
  onClose: () => void;
  onUpdate: (updated: FormSubmission) => void;
  currentUser?: string;
}

export default function FormSubmissionQuickViewModal({
  submission,
  onClose,
  onUpdate,
  currentUser,
}: Props) {
  const [isUpdating, setIsUpdating] = useState(false);

  if (!submission) return null;

  const formTypeInfo = getFormTypeInfo(submission.form_type);

  const handleStatusChange = async (newStatus: FormSubmissionStatus) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/form-submissions/${submission.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          changed_by: currentUser || 'Unknown',
        }),
      });

      const data = await response.json();
      if (data.success) {
        onUpdate(data.data);
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAssignToMe = async () => {
    if (!currentUser) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/form-submissions/${submission.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigned_to: currentUser,
          changed_by: currentUser,
        }),
      });

      const data = await response.json();
      if (data.success) {
        onUpdate(data.data);
      }
    } catch (error) {
      console.error('Failed to assign:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const getKeyFields = () => {
    const formData = submission.form_data || {};
    const fields = [];

    if (formData.phone) fields.push({ label: 'Phone', value: formData.phone });
    if (formData.email) fields.push({ label: 'Email', value: formData.email });
    if (formData.urgency) fields.push({ label: 'Urgency', value: formData.urgency });
    if (formData.description) fields.push({ label: 'Description', value: formData.description });
    if (formData.issue) fields.push({ label: 'Issue', value: formData.issue });

    return fields.slice(0, 4);
  };

  const keyFields = getKeyFields();

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-none shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-3 py-1 rounded-none text-sm font-medium ${formTypeInfo.color}`}>
                {formTypeInfo.label}
              </span>
              <span className={`px-3 py-1 rounded-none text-sm font-medium ${statusColors[submission.status]}`}>
                {statusLabels[submission.status]}
              </span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {submission.tenant_name || 'Unknown Tenant'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {submission.building_address} {submission.unit_number && `- Unit ${submission.unit_number}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors ml-4"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Submitted:</span>
              <span className="ml-2 font-medium text-gray-900">
                {new Date(submission.submitted_at).toLocaleString()}
              </span>
            </div>
            {submission.assigned_to && (
              <div>
                <span className="text-gray-600">Assigned to:</span>
                <span className="ml-2 font-medium text-gray-900">{submission.assigned_to}</span>
              </div>
            )}
          </div>
        </div>

        {keyFields.length > 0 && (
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Key Details</h3>
            <div className="space-y-2">
              {keyFields.map((field, idx) => (
                <div key={idx} className="text-sm">
                  <span className="text-gray-600 font-medium">{field.label}:</span>
                  <span className="ml-2 text-gray-900">
                    {typeof field.value === 'string' && field.value.length > 100
                      ? field.value.substring(0, 100) + '...'
                      : field.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quick Actions</label>
            <div className="flex flex-wrap gap-2">
              {currentUser && submission.assigned_to !== currentUser && (
                <button
                  onClick={handleAssignToMe}
                  disabled={isUpdating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-none hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  Assign to Me
                </button>
              )}

              <select
                value={submission.status}
                onChange={(e) => handleStatusChange(e.target.value as FormSubmissionStatus)}
                disabled={isUpdating}
                className="px-4 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-sm"
              >
                <option value="pending_review">Pending Review</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="denied">Denied</option>
                <option value="revision_requested">Revision Requested</option>
                <option value="sent_to_appfolio">Sent to Appfolio</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <Link
              href={`/admin/form-submissions/${submission.id}`}
              className="flex-1 bg-gray-900 text-white py-2 px-4 rounded-none hover:bg-gray-800 transition-colors text-center font-medium"
            >
              View Full Details
            </Link>
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-none hover:bg-gray-50 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
