'use client';

import { useState, useEffect, useCallback } from 'react';
import { PreferredLanguage } from '@/types/compliance';
import { portalTranslations, PortalStrings } from '@/lib/portalTranslations';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  AcknowledgmentTask,
  SignatureTask,
  FileUploadTask,
  PhotoTask,
  FormTask,
  StaffCheckTask,
} from '@/components/portal';
import type { PortalTask } from '@/components/portal';

interface PortalData {
  project_unit_id: string;
  project_name: string | null;
  deadline: string | null;
  sequential: boolean;
  preferred_language: PreferredLanguage;
  building: string;
  unit_number: string;
  overall_status: string;
  tasks: PortalTask[];
}

type PortalState =
  | { status: 'loading' }
  | { status: 'error'; code: number; message: string }
  | { status: 'ready'; data: PortalData };

export default function TenantPortal({ token }: { token: string }) {
  const [state, setState] = useState<PortalState>({ status: 'loading' });
  const [language, setLanguage] = useState<PreferredLanguage>('en');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [skipping, setSkipping] = useState(false);

  const fetchPortal = useCallback(async () => {
    try {
      const res = await fetch(`/api/t/${token}`);

      if (res.status === 404) {
        setState({ status: 'error', code: 404, message: '' });
        return;
      }
      if (res.status === 410) {
        setState({ status: 'error', code: 410, message: '' });
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setState({ status: 'error', code: res.status, message: data.message || 'Something went wrong' });
        return;
      }

      const json = await res.json();
      const data = json.data as PortalData;

      setLanguage(data.preferred_language || 'en');
      setState({ status: 'ready', data });

      // Auto-expand first incomplete tenant task
      const firstIncomplete = data.tasks.find(
        (t) => t.completion.status !== 'complete' && t.task_type.assignee !== 'staff'
      );
      if (firstIncomplete) {
        setExpandedTask(firstIncomplete.id);
      }
    } catch {
      setState({ status: 'error', code: 0, message: 'Network error' });
    }
  }, [token]);

  useEffect(() => {
    fetchPortal();
  }, [fetchPortal]);

  const t = portalTranslations[language];

  const handleSkipToVehicle = async (vehicleTaskId: string) => {
    setSkipping(true);
    try {
      const res = await fetch(`/api/t/${token}/skip-to-vehicle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleTaskId }),
      });
      if (!res.ok) return;
      const json = await res.json();
      const refreshed = json.data;
      // Re-fetch full portal data to get updated state
      const portalRes = await fetch(`/api/t/${token}`);
      if (!portalRes.ok) return;
      const portalJson = await portalRes.json();
      const portalData = portalJson.data as PortalData;
      setState({ status: 'ready', data: portalData });
      setExpandedTask(vehicleTaskId);
    } catch {
      // Silent
    } finally {
      setSkipping(false);
    }
  };

  const handleTaskComplete = async () => {
    // Re-fetch portal data to get updated task list
    try {
      const res = await fetch(`/api/t/${token}`);
      if (!res.ok) return;
      const json = await res.json();
      const data = json.data as PortalData;
      setState({ status: 'ready', data });

      // Expand next incomplete task
      const nextIncomplete = data.tasks.find(
        (task) => task.completion.status !== 'complete' && task.task_type.assignee !== 'staff'
      );
      setExpandedTask(nextIncomplete?.id || null);
    } catch {
      // Silent — user sees the task was completed
    }
  };

  // --- Loading ---
  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-[var(--muted)] text-sm">{t.loading}</p>
      </div>
    );
  }

  // --- Error states ---
  if (state.status === 'error') {
    const errorText =
      state.code === 404
        ? t.link_invalid
        : state.code === 410
        ? t.link_expired
        : state.message || t.link_invalid;

    return (
      <>
        <header className="border-b border-[var(--divider)] bg-white sticky top-0 z-50 shadow-sm">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-2 flex items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[var(--primary)] rounded-sm flex items-center justify-center">
                <span className="text-white font-serif font-bold text-sm">SM</span>
              </div>
              <div className="hidden sm:block border-l border-[var(--divider)] pl-3">
                <p className="text-sm font-medium text-[var(--primary)]">Stanton Management LLC</p>
              </div>
            </div>
          </div>
        </header>
        <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center p-4">
          <div className="bg-white border border-[var(--border)] rounded-sm shadow-sm p-8 max-w-md w-full text-center">
            <svg className="mx-auto h-12 w-12 text-[var(--muted)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-sm text-[var(--ink)] leading-relaxed">{errorText}</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // --- Ready ---
  const { data } = state;
  const completedCount = data.tasks.filter((task) => task.completion.status === 'complete').length;
  const totalCount = data.tasks.length;
  const allComplete = data.overall_status === 'complete' || completedCount === totalCount;

  const deadlineFormatted = data.deadline
    ? new Date(data.deadline + 'T00:00:00').toLocaleDateString(
        language === 'es' ? 'es-US' : language === 'pt' ? 'pt-BR' : 'en-US',
        { month: 'long', day: 'numeric', year: 'numeric' }
      )
    : null;

  // Determine locked tasks for sequential mode
  const getTaskLocked = (task: PortalTask, index: number): boolean => {
    if (!data.sequential) return false;
    if (task.completion.status === 'complete') return false;
    if (task.completion.status === 'waived') return false;
    const firstIncompleteIndex = data.tasks.findIndex(
      (t) => t.completion.status !== 'complete' && t.completion.status !== 'waived'
    );
    return index > firstIncompleteIndex && firstIncompleteIndex !== -1;
  };

  // Detect locked vehicle task behind skippable non-required tasks
  const vehicleTask = data.sequential
    ? data.tasks.find(
        (task, idx) =>
          /vehicle/i.test(task.task_type.name) &&
          task.completion.status !== 'complete' &&
          task.completion.status !== 'waived' &&
          getTaskLocked(task, idx)
      )
    : null;

  const showVehicleBanner = !!vehicleTask && !skipping;

  // --- All Complete Screen ---
  if (allComplete) {
    return (
      <>
        <Header language={language} onLanguageChange={setLanguage} />
        <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center p-4">
          <div className="bg-white border border-[var(--border)] rounded-sm shadow-sm p-8 max-w-md w-full text-center">
            <svg className="mx-auto h-16 w-16 text-[var(--success)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h1 className="font-serif text-2xl text-[var(--primary)] mb-2">{t.all_complete_title}</h1>
            <p className="text-sm text-[var(--muted)] leading-relaxed mb-6">{t.all_complete_body}</p>

            <div className="border-t border-[var(--divider)] pt-4 space-y-2">
              {data.tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2 text-sm text-[var(--ink)]">
                  <svg className="w-4 h-4 text-[var(--success)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{task.task_type.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // --- Task List ---
  return (
    <>
      <Header language={language} onLanguageChange={setLanguage} />

      <main className="min-h-screen bg-[var(--paper)]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* Project header */}
          <div className="mb-6">
            {data.project_name && (
              <h1 className="font-serif text-xl sm:text-2xl text-[var(--primary)] mb-1">{data.project_name}</h1>
            )}
            {deadlineFormatted && (
              <p className="text-sm font-medium text-[var(--warning)]">
                {t.deadline_label} {deadlineFormatted}
              </p>
            )}
          </div>

          {/* Skip-to-vehicle banner */}
          {showVehicleBanner && (
            <div className="bg-white border border-[var(--primary)]/30 rounded-sm p-4 mb-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <svg className="w-6 h-6 text-[var(--primary)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8m-8 4h4m-2 4v-2a2 2 0 012-2h4a2 2 0 012 2v2m-6 0h6m-9 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p className="text-sm font-medium text-[var(--ink)]">{t.skip_to_vehicle}</p>
              </div>
              <button
                type="button"
                onClick={() => handleSkipToVehicle(vehicleTask!.id)}
                disabled={skipping}
                className="flex-shrink-0 bg-[var(--primary)] text-white py-2 px-4 rounded-none text-sm font-medium hover:bg-[var(--primary-light)] transition-colors duration-200 disabled:opacity-50"
              >
                {t.skip_to_vehicle_btn}
              </button>
            </div>
          )}

          {/* Progress bar */}
          <div className="bg-white border border-[var(--border)] rounded-sm p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-[var(--ink)]">{t.progress_label(completedCount, totalCount)}</p>
              <span className="text-sm font-medium text-[var(--primary)]">
                {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-[var(--bg-section)] rounded-none h-2">
              <div
                className="bg-[var(--success)] h-2 rounded-none transition-all duration-300 ease-out"
                style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Task list */}
          <div className="space-y-3">
            {data.tasks.map((task, index) => {
              const isComplete = task.completion.status === 'complete' || task.completion.status === 'waived';
              const isStaffCheck = task.task_type.assignee === 'staff';
              const isLocked = getTaskLocked(task, index);
              const isExpanded = expandedTask === task.id && !isComplete && !isLocked;

              return (
                <div
                  key={task.id}
                  className={`bg-white border rounded-sm overflow-hidden transition-colors duration-200 ${
                    isComplete
                      ? 'border-[var(--success)]/30 bg-green-50/30'
                      : isLocked
                      ? 'border-[var(--border)] opacity-60'
                      : 'border-[var(--border)]'
                  }`}
                >
                  {/* Task header — always visible */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isComplete || isLocked || isStaffCheck) return;
                      setExpandedTask(expandedTask === task.id ? null : task.id);
                    }}
                    disabled={isComplete || isLocked}
                    className={`w-full flex items-center gap-3 p-4 text-left ${
                      isComplete || isLocked || isStaffCheck ? 'cursor-default' : 'cursor-pointer'
                    }`}
                  >
                    {/* Status icon */}
                    <div className="flex-shrink-0">
                      {isComplete ? (
                        <div className="w-6 h-6 rounded-full bg-[var(--success)] flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : isLocked ? (
                        <div className="w-6 h-6 rounded-full bg-[var(--border)] flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                      ) : isStaffCheck ? (
                        <div className="w-6 h-6 rounded-full bg-[var(--bg-section)] border border-[var(--border)] flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)] flex items-center justify-center">
                          <span className="text-xs font-bold text-[var(--primary)]">{index + 1}</span>
                        </div>
                      )}
                    </div>

                    {/* Task info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${isComplete ? 'text-[var(--success)]' : 'text-[var(--ink)]'}`}>
                        {task.task_type.name}
                      </p>
                      {isLocked && (
                        <p className="text-xs text-[var(--muted)] mt-0.5">{t.task_locked}</p>
                      )}
                      {isStaffCheck && !isComplete && (
                        <p className="text-xs text-[var(--muted)] mt-0.5">{t.staff_check_label}</p>
                      )}
                      {isComplete && (
                        <p className="text-xs text-[var(--success)] mt-0.5">{t.completed}</p>
                      )}
                      {isComplete && task.completion.notes && (
                        <p className="text-xs text-[var(--muted)] mt-1 italic">{task.completion.notes}</p>
                      )}
                    </div>

                    {/* Expand chevron */}
                    {!isComplete && !isLocked && !isStaffCheck && (
                      <svg
                        className={`w-5 h-5 text-[var(--muted)] flex-shrink-0 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </button>

                  {/* Expanded task UI */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-[var(--divider)]">
                      <div className="pt-4">
                        <TaskRenderer
                          task={task}
                          token={token}
                          projectUnitId={data.project_unit_id}
                          language={language}
                          t={portalTranslations[language]}
                          onComplete={handleTaskComplete}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}

function TaskRenderer({
  task,
  token,
  projectUnitId,
  language,
  t,
  onComplete,
}: {
  task: PortalTask;
  token: string;
  projectUnitId: string;
  language: PreferredLanguage;
  t: PortalStrings;
  onComplete: () => void;
}) {
  const props = { task, token, projectUnitId, language, t, onComplete };

  switch (task.task_type.evidence_type) {
    case 'acknowledgment':
      return <AcknowledgmentTask {...props} />;
    case 'signature':
      return <SignatureTask {...props} />;
    case 'file_upload':
      return <FileUploadTask {...props} />;
    case 'photo':
      return <PhotoTask {...props} />;
    case 'form':
      return <FormTask {...props} />;
    case 'staff_check':
      return <StaffCheckTask {...props} />;
    default:
      return <p className="text-sm text-[var(--muted)]">Unknown task type</p>;
  }
}
