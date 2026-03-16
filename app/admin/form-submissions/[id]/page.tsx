'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FormSubmissionStatus,
  FormPriority,
  statusLabels,
  statusColors,
  priorityLabels,
  priorityColors,
  STAFF_MEMBERS,
  getFormTypeInfo,
} from '@/lib/formTypeLabels';

interface StatusHistoryEntry {
  status: string;
  changed_by: string;
  changed_at: string;
  notes?: string | null;
}

interface FormSubmission {
  id: string;
  created_at: string;
  form_type: string;
  tenant_name: string | null;
  building_address: string | null;
  unit_number: string | null;
  form_data: any;
  photo_urls: string[] | null;
  signature_url: string | null;
  language: string | null;
  submitted_at: string;
  reviewed: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  status: FormSubmissionStatus;
  assigned_to: string | null;
  priority: FormPriority | null;
  status_history: StatusHistoryEntry[] | null;
  denial_reason: string | null;
  revision_notes: string | null;
  sent_to_appfolio_at: string | null;
  sent_to_appfolio_by: string | null;
}

interface RelatedSubmission {
  id: string;
  form_type: string;
  submitted_at: string;
  status: string;
}

export default function FormSubmissionDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [submission, setSubmission] = useState<FormSubmission | null>(null);
  const [relatedSubmissions, setRelatedSubmissions] = useState<RelatedSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState('');

  const [editMode, setEditMode] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<FormSubmissionStatus>('pending_review');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<FormPriority>('medium');
  const [statusChangeNotes, setStatusChangeNotes] = useState('');
  const [denialReason, setDenialReason] = useState('');
  const [revisionNotes, setRevisionNotes] = useState('');

  useEffect(() => {
    fetchSubmission();
  }, [params.id]);

  useEffect(() => {
    if (submission) {
      setNotes(submission.admin_notes || '');
      setSelectedStatus(submission.status);
      setSelectedAssignee(submission.assigned_to || '');
      setSelectedPriority(submission.priority || 'medium');
      setDenialReason(submission.denial_reason || '');
      setRevisionNotes(submission.revision_notes || '');
    }
  }, [submission]);

  const fetchSubmission = async () => {
    try {
      const response = await fetch(`/api/admin/form-submissions/${params.id}`);
      const data = await response.json();

      if (data.success) {
        setSubmission(data.data);
        setRelatedSubmissions(data.relatedSubmissions || []);
      } else {
        setError(data.message || 'Failed to load submission');
      }
    } catch (err) {
      setError('Failed to load submission');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!submission) return;

    setIsUpdating(true);
    try {
      const updates: any = {
        status: selectedStatus,
        assigned_to: selectedAssignee || null,
        priority: selectedPriority,
        admin_notes: notes,
        // changed_by is now set server-side from session
        status_change_notes: statusChangeNotes || null,
      };

      if (selectedStatus === 'denied' && denialReason) {
        updates.denial_reason = denialReason;
      }

      if (selectedStatus === 'revision_requested' && revisionNotes) {
        updates.revision_notes = revisionNotes;
      }

      const response = await fetch(`/api/admin/form-submissions/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (data.success) {
        setSubmission(data.data);
        setEditMode(false);
        setStatusChangeNotes('');
      } else {
        setError(data.message || 'Failed to update submission');
      }
    } catch (err) {
      setError('Failed to update submission');
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading submission...</div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Submission not found'}</p>
          <Link
            href="/admin/form-submissions"
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Back to Submissions
          </Link>
        </div>
      </div>
    );
  }

  const formTypeInfo = getFormTypeInfo(submission.form_type);

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-6">
          <Link
            href="/admin/form-submissions"
            className="text-blue-600 hover:text-blue-800 flex items-center gap-2 mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Submissions
          </Link>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className={`px-3 py-1 rounded-none text-sm font-medium ${formTypeInfo.color}`}>
                  {formTypeInfo.label}
                </span>
                <span className={`px-3 py-1 rounded-none text-sm font-medium ${statusColors[submission.status]}`}>
                  {statusLabels[submission.status]}
                </span>
                {submission.priority && (
                  <span className={`px-3 py-1 rounded-none text-sm font-medium ${priorityColors[submission.priority]}`}>
                    {priorityLabels[submission.priority]} Priority
                  </span>
                )}
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {submission.tenant_name || 'Unknown Tenant'}
              </h1>
              <p className="text-gray-600">
                {submission.building_address} {submission.unit_number && `- Unit ${submission.unit_number}`}
              </p>
            </div>

            <button
              onClick={() => setEditMode(!editMode)}
              className="bg-blue-600 text-white px-4 py-2 rounded-none hover:bg-blue-700 transition-colors font-medium"
            >
              {editMode ? 'Cancel Edit' : 'Edit'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-none shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Submission Details</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 font-medium">Submitted:</span>
                  <p className="text-gray-900 mt-1">{new Date(submission.submitted_at).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-600 font-medium">Language:</span>
                  <p className="text-gray-900 mt-1">{submission.language || 'Not specified'}</p>
                </div>
                {submission.assigned_to && (
                  <div>
                    <span className="text-gray-600 font-medium">Assigned To:</span>
                    <p className="text-gray-900 mt-1">{submission.assigned_to}</p>
                  </div>
                )}
                {submission.sent_to_appfolio_at && (
                  <div>
                    <span className="text-gray-600 font-medium">Sent to Appfolio:</span>
                    <p className="text-gray-900 mt-1">
                      {new Date(submission.sent_to_appfolio_at).toLocaleString()}
                      {submission.sent_to_appfolio_by && ` by ${submission.sent_to_appfolio_by}`}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-none shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Form Data</h2>
              <div className="space-y-3">
                {Object.entries(submission.form_data || {}).map(([key, value]) => (
                  <div key={key} className="border-b border-gray-200 pb-3 last:border-0">
                    <span className="text-gray-600 font-medium text-sm">
                      {key.split(/(?=[A-Z])/).join(' ').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                    </span>
                    <p className="text-gray-900 mt-1">
                      {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {submission.photo_urls && submission.photo_urls.length > 0 && (
              <div className="bg-white rounded-none shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Attachments</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {submission.photo_urls.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block border border-gray-200 hover:border-blue-500 transition-colors rounded-none overflow-hidden"
                    >
                      <img src={url} alt={`Attachment ${idx + 1}`} className="w-full h-48 object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {submission.signature_url && (
              <div className="bg-white rounded-none shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Signature</h2>
                <img
                  src={submission.signature_url}
                  alt="Signature"
                  className="border border-gray-200 max-w-md"
                />
              </div>
            )}

            {submission.status_history && submission.status_history.length > 0 && (
              <div className="bg-white rounded-none shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Status History</h2>
                <div className="space-y-3">
                  {submission.status_history.map((entry, idx) => (
                    <div key={idx} className="flex items-start gap-3 pb-3 border-b border-gray-200 last:border-0">
                      <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-600 mt-2" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-none text-xs font-medium ${statusColors[entry.status as FormSubmissionStatus] || 'bg-gray-100 text-gray-800'}`}>
                            {statusLabels[entry.status as FormSubmissionStatus] || entry.status}
                          </span>
                          <span className="text-sm text-gray-600">
                            by {entry.changed_by}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(entry.changed_at).toLocaleString()}
                        </p>
                        {entry.notes && (
                          <p className="text-sm text-gray-700 mt-1">{entry.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {editMode ? (
              <div className="bg-white rounded-none shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Update Submission</h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value as FormSubmissionStatus)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

                  {selectedStatus === 'denied' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Denial Reason</label>
                      <textarea
                        value={denialReason}
                        onChange={(e) => setDenialReason(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Explain why this was denied..."
                      />
                    </div>
                  )}

                  {selectedStatus === 'revision_requested' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Revision Notes</label>
                      <textarea
                        value={revisionNotes}
                        onChange={(e) => setRevisionNotes(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="What needs to be corrected..."
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                    <select
                      value={selectedAssignee}
                      onChange={(e) => setSelectedAssignee(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Unassigned</option>
                      {STAFF_MEMBERS.map((member) => (
                        <option key={member} value={member}>
                          {member}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select
                      value={selectedPriority}
                      onChange={(e) => setSelectedPriority(e.target.value as FormPriority)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status Change Notes</label>
                    <textarea
                      value={statusChangeNotes}
                      onChange={(e) => setStatusChangeNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Optional notes about this change..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Internal notes..."
                    />
                  </div>

                  <button
                    onClick={handleUpdate}
                    disabled={isUpdating}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-none hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
                  >
                    {isUpdating ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-none shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Admin Notes</h2>
                {submission.admin_notes ? (
                  <p className="text-gray-700 whitespace-pre-wrap">{submission.admin_notes}</p>
                ) : (
                  <p className="text-gray-500 italic">No notes yet</p>
                )}
              </div>
            )}

            {relatedSubmissions.length > 0 && (
              <div className="bg-white rounded-none shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Related Submissions</h2>
                <div className="space-y-2">
                  {relatedSubmissions.map((related) => {
                    const relatedTypeInfo = getFormTypeInfo(related.form_type);
                    return (
                      <Link
                        key={related.id}
                        href={`/admin/form-submissions/${related.id}`}
                        className="block p-3 border border-gray-200 hover:border-blue-500 transition-colors rounded-none"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">
                            {relatedTypeInfo.label}
                          </span>
                          <span className={`px-2 py-0.5 rounded-none text-xs font-medium ${statusColors[related.status as FormSubmissionStatus] || 'bg-gray-100 text-gray-800'}`}>
                            {statusLabels[related.status as FormSubmissionStatus] || related.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(related.submitted_at).toLocaleDateString()}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
