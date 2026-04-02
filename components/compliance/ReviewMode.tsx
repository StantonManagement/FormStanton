'use client';

import { useState, useEffect, useMemo } from 'react';
import type { DynamicColumn, ProjectMatrixRow } from '@/types/compliance';
import ReviewUnitList from './ReviewUnitList';
import ReviewPanel from './ReviewPanel';

interface ReviewModeProps {
  columns: DynamicColumn[];
  rows: ProjectMatrixRow[];
  projectName: string;
  onStaffComplete: (unitId: string, taskId: string, reviewerNotes?: string) => Promise<void>;
  onStaffFail: (unitId: string, taskId: string, reason: string, reviewerNotes?: string) => Promise<void>;
  onStaffUncomplete: (unitId: string, taskId: string) => Promise<void>;
}

export default function ReviewMode({
  columns,
  rows,
  projectName,
  onStaffComplete,
  onStaffFail,
  onStaffUncomplete,
}: ReviewModeProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  // Auto-select first reviewable task on mount
  useEffect(() => {
    if (selectedTaskId) return;
    if (columns.length === 0) return;

    // Pick first task with pending units
    for (const col of columns) {
      const hasPending = rows.some(row => {
        const comp = row.completions[col.id];
        return !comp || comp.status === 'pending';
      });
      if (hasPending) {
        setSelectedTaskId(col.id);
        return;
      }
    }
    // Fallback: first column
    setSelectedTaskId(columns[0].id);
  }, [columns, rows, selectedTaskId]);

  // Auto-select first pending unit when task changes
  useEffect(() => {
    if (!selectedTaskId) return;

    const pendingUnits = rows.filter(row => {
      const comp = row.completions[selectedTaskId];
      return !comp || comp.status === 'pending';
    });

    if (pendingUnits.length > 0) {
      setSelectedUnitId(pendingUnits[0].unit_id);
    } else if (rows.length > 0) {
      setSelectedUnitId(rows[0].unit_id);
    }
  }, [selectedTaskId, rows]);

  const selectedColumn = useMemo(() => {
    return columns.find(col => col.id === selectedTaskId) || null;
  }, [columns, selectedTaskId]);

  const selectedRow = useMemo(() => {
    return rows.find(row => row.unit_id === selectedUnitId) || null;
  }, [rows, selectedUnitId]);

  // Auto-advance to next pending unit after action
  const advanceToNextPending = () => {
    if (!selectedTaskId) return;

    const currentIndex = rows.findIndex(r => r.unit_id === selectedUnitId);
    if (currentIndex === -1) return;

    // Find next pending unit after current
    for (let i = currentIndex + 1; i < rows.length; i++) {
      const comp = rows[i].completions[selectedTaskId];
      if (!comp || comp.status === 'pending') {
        setSelectedUnitId(rows[i].unit_id);
        return;
      }
    }

    // No pending units after current — stay on current unit
  };

  const handlePass = async (reviewerNotes?: string) => {
    if (!selectedUnitId || !selectedTaskId) return;
    await onStaffComplete(selectedUnitId, selectedTaskId, reviewerNotes);
    advanceToNextPending();
  };

  const handleFail = async (failureReason: string, reviewerNotes?: string) => {
    if (!selectedUnitId || !selectedTaskId) return;
    await onStaffFail(selectedUnitId, selectedTaskId, failureReason, reviewerNotes);
    advanceToNextPending();
  };

  const handleUndo = async () => {
    if (!selectedUnitId || !selectedTaskId) return;
    await onStaffUncomplete(selectedUnitId, selectedTaskId);
    // Stay on current unit after undo
  };

  if (!selectedColumn || !selectedRow) {
    return (
      <div className="flex h-full">
        <ReviewUnitList
          columns={columns}
          rows={rows}
          selectedTaskId={selectedTaskId}
          selectedUnitId={selectedUnitId}
          onSelectTask={setSelectedTaskId}
          onSelectUnit={setSelectedUnitId}
        />
        <div className="flex-1 flex items-center justify-center bg-[var(--paper)]">
          <div className="text-center text-[var(--muted)]">
            <svg className="w-16 h-16 mx-auto mb-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">Select a task and unit to begin review</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <ReviewUnitList
        columns={columns}
        rows={rows}
        selectedTaskId={selectedTaskId}
        selectedUnitId={selectedUnitId}
        onSelectTask={setSelectedTaskId}
        onSelectUnit={setSelectedUnitId}
      />
      <ReviewPanel
        column={selectedColumn}
        row={selectedRow}
        projectName={projectName}
        onPass={handlePass}
        onFail={handleFail}
        onUndo={handleUndo}
      />
    </div>
  );
}
