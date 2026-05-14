'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '@/lib/adminAuthContext';
import Link from 'next/link';

interface Appointment {
  id: string;
  startsAt: string;
  durationMinutes: number;
  purpose: string;
  status: string;
  notes: string | null;
  rescheduledFromId: string | null;
  staff: {
    id: string;
    name: string;
  };
  tenant: {
    name: string;
    unit: string | null;
    building: string | null;
    phone: string | null;
  };
  unsignedDocuments: Array<{ label: string; doc_type: string }>;
}

const PURPOSE_LABELS: Record<string, string> = {
  sign_documents: 'Document Signing',
  inspection_required: 'Unit Inspection',
  intake_help: 'Application Help',
  document_drop: 'Document Drop-off',
  other: 'Office Visit',
};

const PURPOSE_COLORS: Record<string, string> = {
  sign_documents: 'bg-blue-100 text-blue-800',
  inspection_required: 'bg-orange-100 text-orange-800',
  intake_help: 'bg-green-100 text-green-800',
  document_drop: 'bg-purple-100 text-purple-800',
  other: 'bg-gray-100 text-gray-800',
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  no_show: 'No Show',
  cancelled: 'Cancelled',
  rescheduled: 'Rescheduled',
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  no_show: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-50 text-gray-500 border-gray-200',
  rescheduled: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default function StaffDayViewPage() {
  const { user, hasPermission } = useAdminAuth();
  const isAdmin = hasPermission('scheduling', 'admin');

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [myOnly, setMyOnly] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState<string | null>(null);
  const [notesInput, setNotesInput] = useState('');
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL('/api/admin/scheduling/appointments', window.location.origin);
      url.searchParams.set('date', selectedDate);
      if (myOnly && user?.username) {
        url.searchParams.set('myOnly', 'true');
      }

      const res = await fetch(url.toString());
      const data = await res.json();

      if (data.success) {
        setAppointments(data.data);
      } else {
        showMessage(data.message || 'Failed to load appointments');
      }
    } catch (error) {
      showMessage('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, myOnly, user?.username]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const navigateDay = (offset: number) => {
    const date = new Date(selectedDate + 'T00:00:00');
    date.setDate(date.getDate() + offset);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    let dayLabel = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    
    if (diffDays === 0) dayLabel += ' (Today)';
    else if (diffDays === 1) dayLabel += ' (Tomorrow)';
    else if (diffDays === -1) dayLabel += ' (Yesterday)';
    
    return dayLabel;
  };

  const handleStatusUpdate = async (appointmentId: string, newStatus: string, notes?: string) => {
    setProcessingAction(appointmentId);
    try {
      const res = await fetch(`/api/admin/scheduling/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, notes }),
      });

      const data = await res.json();
      if (data.success) {
        showMessage(`Marked as ${STATUS_LABELS[newStatus]}`);
        fetchAppointments();
      } else {
        showMessage(data.message || 'Update failed');
      }
    } catch (error) {
      showMessage('Update failed');
    } finally {
      setProcessingAction(null);
      setShowNotesModal(null);
      setNotesInput('');
    }
  };

  const handleMarkComplete = (appointmentId: string) => {
    setShowNotesModal(appointmentId);
  };

  const handleConfirmComplete = () => {
    if (showNotesModal) {
      handleStatusUpdate(showNotesModal, 'completed', notesInput);
    }
  };

  const handleMarkNoShow = (appointmentId: string) => {
    if (confirm('Mark this appointment as no-show?')) {
      handleStatusUpdate(appointmentId, 'no_show');
    }
  };

  const handleRescheduleClick = (appointment: Appointment) => {
    // Navigate to availability page with context
    const params = new URLSearchParams();
    params.set('reschedule', appointment.id);
    params.set('applicationId', appointment.id); // Will need to extract application ID
    window.location.href = `/admin/scheduling/availability?${params.toString()}`;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-serif text-[var(--primary)]">
            Today's Appointments
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            View and manage scheduled appointments
          </p>
        </div>
        <div className="flex items-center gap-3">
          {message && (
            <span className={`text-sm ${message.includes('fail') ? 'text-red-600' : 'text-green-600'}`}>
              {message}
            </span>
          )}
          <Link
            href="/admin/scheduling/availability"
            className="px-4 py-2 bg-[var(--primary)] text-white text-sm hover:opacity-90"
          >
            Configure Availability
          </Link>
        </div>
      </div>

      {/* Date navigation */}
      <div className="bg-white border border-[var(--border)] p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateDay(-1)}
            className="px-3 py-1.5 border border-[var(--border)] hover:bg-[var(--bg-section)] text-sm"
          >
            ← Previous
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 border border-[var(--border)] text-sm"
          />
          <button
            onClick={() => navigateDay(1)}
            className="px-3 py-1.5 border border-[var(--border)] hover:bg-[var(--bg-section)] text-sm"
          >
            Next →
          </button>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={myOnly}
              onChange={(e) => setMyOnly(e.target.checked)}
              className="rounded-none"
            />
            <span>My appointments only</span>
          </label>
        </div>
      </div>

      {/* Date header */}
      <div className="text-lg font-medium text-[var(--ink)]">
        {formatDate(selectedDate)}
      </div>

      {/* Appointments list */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : appointments.length === 0 ? (
        <div className="bg-white border border-[var(--border)] p-12 text-center">
          <p className="text-[var(--muted)]">No appointments scheduled for this date.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.map((appt) => (
            <div
              key={appt.id}
              className={`bg-white border ${STATUS_COLORS[appt.status] || 'border-[var(--border)]'} p-4`}
            >
              <div className="flex items-start gap-4 flex-wrap">
                {/* Time */}
                <div className="w-20 flex-shrink-0">
                  <div className="text-lg font-semibold text-[var(--primary)]">
                    {formatTime(appt.startsAt)}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {appt.durationMinutes} min
                  </div>
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-[var(--ink)]">
                      {appt.tenant.name}
                    </span>
                    {appt.tenant.unit && (
                      <span className="text-sm text-[var(--muted)]">
                        · Unit {appt.tenant.unit}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 text-xs ${PURPOSE_COLORS[appt.purpose] || 'bg-gray-100'}`}>
                      {PURPOSE_LABELS[appt.purpose] || appt.purpose}
                    </span>
                  </div>

                  <div className="text-sm text-[var(--muted)] mb-2">
                    {appt.tenant.building}
                    {appt.tenant.phone && (
                      <span className="ml-3">· {appt.tenant.phone}</span>
                    )}
                  </div>

                  {/* Context: Unsigned documents */}
                  {appt.purpose === 'sign_documents' && appt.unsignedDocuments.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 p-3 text-sm mb-3">
                      <p className="font-medium text-amber-900 mb-1">Documents to sign:</p>
                      <ul className="list-disc list-inside text-amber-800 space-y-0.5">
                        {appt.unsignedDocuments.slice(0, 5).map((doc, i) => (
                          <li key={i}>{doc.label}</li>
                        ))}
                        {appt.unsignedDocuments.length > 5 && (
                          <li className="text-amber-700 italic">
                            +{appt.unsignedDocuments.length - 5} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {appt.purpose === 'inspection_required' && (
                    <div className="bg-orange-50 border border-orange-200 p-3 text-sm mb-3">
                      <p className="font-medium text-orange-900">Unit inspection required</p>
                    </div>
                  )}

                  {appt.notes && (
                    <div className="text-sm text-[var(--muted)] italic">
                      Notes: {appt.notes}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  {appt.status === 'scheduled' && (
                    <>
                      <button
                        onClick={() => handleMarkComplete(appt.id)}
                        disabled={processingAction === appt.id}
                        className="px-4 py-2 bg-green-600 text-white text-sm hover:bg-green-700 disabled:opacity-50"
                      >
                        Mark Complete
                      </button>
                      <button
                        onClick={() => handleMarkNoShow(appt.id)}
                        disabled={processingAction === appt.id}
                        className="px-4 py-2 border border-red-300 text-red-700 text-sm hover:bg-red-50 disabled:opacity-50"
                      >
                        No Show
                      </button>
                      <button
                        onClick={() => handleRescheduleClick(appt)}
                        className="px-4 py-2 border border-[var(--border)] text-[var(--ink)] text-sm hover:bg-[var(--bg-section)]"
                      >
                        Reschedule
                      </button>
                    </>
                  )}

                  {appt.status !== 'scheduled' && (
                    <span className="px-3 py-1 text-xs font-medium rounded">
                      {STATUS_LABELS[appt.status]}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notes Modal */}
      {showNotesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-[var(--primary)] mb-4">
              Complete Appointment
            </h3>
            <p className="text-sm text-[var(--muted)] mb-4">
              Add any notes about this appointment (optional):
            </p>
            <textarea
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-none mb-4 resize-none"
              placeholder="e.g., Documents signed, follow-up needed..."
            />
            <div className="flex gap-3">
              <button
                onClick={handleConfirmComplete}
                disabled={processingAction === showNotesModal}
                className="flex-1 px-4 py-2 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {processingAction === showNotesModal ? 'Saving...' : 'Mark Complete'}
              </button>
              <button
                onClick={() => {
                  setShowNotesModal(null);
                  setNotesInput('');
                }}
                className="flex-1 px-4 py-2 border border-[var(--border)] hover:bg-[var(--bg-section)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
