'use client';

import { TaskComponentProps } from './types';

export default function StaffCheckTask({ task, t }: TaskComponentProps) {
  return (
    <div className="space-y-2">
      {task.task_type.instructions && (
        <p className="text-sm text-[var(--ink)] leading-relaxed">{task.task_type.instructions}</p>
      )}
      <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{t.staff_check_label}</span>
      </div>
    </div>
  );
}
