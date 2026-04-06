'use client';

import { useMemo } from 'react';
import type { DynamicColumn, ProjectMatrixRow } from '@/types/compliance';

interface ReviewUnitListProps {
  columns: DynamicColumn[];
  rows: ProjectMatrixRow[];
  selectedTaskId: string | null;
  selectedUnitId: string | null;
  onSelectTask: (taskId: string) => void;
  onSelectUnit: (unitId: string) => void;
}

export default function ReviewUnitList({
  columns,
  rows,
  selectedTaskId,
  selectedUnitId,
  onSelectTask,
  onSelectUnit,
}: ReviewUnitListProps) {
  // Filter to tasks that produce evidence (not staff_check only, or include staff tasks)
  const reviewableTasks = useMemo(() => {
    return columns.filter(col => col.evidence_type !== 'staff_check' || col.assignee === 'staff');
  }, [columns]);

  // Default to first task with pending completions
  const defaultTaskId = useMemo(() => {
    if (selectedTaskId) return selectedTaskId;
    
    for (const task of reviewableTasks) {
      const hasPending = rows.some(row => {
        const comp = row.completions[task.id];
        return !comp || comp.status === 'pending';
      });
      if (hasPending) return task.id;
    }
    
    return reviewableTasks[0]?.id || null;
  }, [reviewableTasks, rows, selectedTaskId]);

  const currentTaskId = selectedTaskId || defaultTaskId;

  // Sort rows for the selected task: failed → pending → passed
  const sortedRows = useMemo(() => {
    if (!currentTaskId) return [];

    return [...rows].sort((a, b) => {
      const aComp = a.completions[currentTaskId];
      const bComp = b.completions[currentTaskId];
      const aStatus = aComp?.status || 'pending';
      const bStatus = bComp?.status || 'pending';

      // Sort order: failed (3) → pending (2) → complete/waived (1)
      const statusOrder = (s: string) => {
        if (s === 'failed') return 3;
        if (s === 'pending') return 2;
        return 1;
      };

      const orderDiff = statusOrder(bStatus) - statusOrder(aStatus);
      if (orderDiff !== 0) return orderDiff;

      // Within same status, sort by unit number
      const aNum = parseInt(a.unit_number.match(/\d+/)?.[0] || '999');
      const bNum = parseInt(b.unit_number.match(/\d+/)?.[0] || '999');
      return aNum - bNum;
    });
  }, [rows, currentTaskId]);

  if (reviewableTasks.length === 0) {
    return (
      <div className="w-80 border-r border-[var(--divider)] bg-[var(--bg-section)] p-4">
        <div className="text-sm text-[var(--muted)]">No reviewable tasks in this project.</div>
      </div>
    );
  }

  return (
    <div className="w-80 border-r border-[var(--divider)] bg-white flex flex-col h-full">
      {/* Task selector */}
      <div className="p-4 border-b border-[var(--divider)] bg-[var(--bg-section)]">
        <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">
          Reviewing Task
        </label>
        <select
          value={currentTaskId || ''}
          onChange={(e) => onSelectTask(e.target.value)}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-none bg-white text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20"
        >
          {reviewableTasks.map(task => {
            const pendingCount = rows.filter(r => {
              const comp = r.completions[task.id];
              return !comp || comp.status === 'pending';
            }).length;
            
            return (
              <option key={task.id} value={task.id}>
                {task.label} {pendingCount > 0 ? `(${pendingCount} pending)` : ''}
              </option>
            );
          })}
        </select>
      </div>

      {/* Unit list */}
      <div className="flex-1 overflow-y-auto">
        {sortedRows.length === 0 ? (
          <div className="p-4 text-sm text-[var(--muted)] text-center">
            No units to review for this task.
          </div>
        ) : (
          <div className="divide-y divide-[var(--divider)]">
            {sortedRows.map(row => {
              const comp = row.completions[currentTaskId!];
              const status = comp?.status || 'pending';
              const hasEvidence = !!(comp?.evidence_url || comp?.form_submission_id);
              const isActive = row.unit_id === selectedUnitId;

              let statusColor = 'text-[var(--muted)]';
              let statusBg = 'bg-gray-100';
              let statusIcon = '○';

              if (status === 'complete' || status === 'waived') {
                statusColor = 'text-[var(--success)]';
                statusBg = 'bg-[var(--success)]/10';
                statusIcon = '✓';
              } else if (status === 'failed') {
                statusColor = 'text-[var(--error)]';
                statusBg = 'bg-[var(--error)]/10';
                statusIcon = '✗';
              }

              return (
                <button
                  key={row.unit_id}
                  onClick={() => onSelectUnit(row.unit_id)}
                  className={`w-full px-4 py-3 text-left hover:bg-[var(--bg-section)] transition-colors ${
                    isActive ? 'bg-[var(--primary)]/5 border-l-2 border-l-[var(--primary)]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--ink)] mb-1">
                        Unit {row.unit_number}
                      </div>
                      <div className="text-xs text-[var(--muted)] truncate">
                        {row.tenant_name || 'No tenant name'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {hasEvidence && status === 'pending' && (
                        <svg className="w-4 h-4 text-[var(--primary)]" fill="currentColor" viewBox="0 0 20 20">
                          <title>Has evidence</title>
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                      )}
                      <div className={`px-2 py-0.5 text-xs font-medium ${statusBg} ${statusColor} rounded-sm`}>
                        {statusIcon}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary footer */}
      {currentTaskId && (
        <div className="p-3 border-t border-[var(--divider)] bg-[var(--bg-section)] text-xs text-[var(--muted)]">
          {(() => {
            const total = sortedRows.length;
            const pending = sortedRows.filter(r => {
              const s = r.completions[currentTaskId]?.status;
              return !s || s === 'pending';
            }).length;
            const passed = sortedRows.filter(r => {
              const s = r.completions[currentTaskId]?.status;
              return s === 'complete' || s === 'waived';
            }).length;
            const failed = sortedRows.filter(r => r.completions[currentTaskId]?.status === 'failed').length;

            return (
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Pending:</span>
                  <span className="font-medium">{pending}</span>
                </div>
                <div className="flex justify-between">
                  <span>Passed:</span>
                  <span className="font-medium text-[var(--success)]">{passed}</span>
                </div>
                {failed > 0 && (
                  <div className="flex justify-between">
                    <span>Failed:</span>
                    <span className="font-medium text-[var(--error)]">{failed}</span>
                  </div>
                )}
                <div className="pt-1 border-t border-[var(--divider)] flex justify-between font-semibold">
                  <span>Total:</span>
                  <span>{total}</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
