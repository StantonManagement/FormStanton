'use client';

import { useState } from 'react';
import type { ProjectTask, TaskType } from '@/types/compliance';
import type { ProjectDetail } from '@/lib/useProjectDetail';
import AddTaskModal from './AddTaskModal';

interface SetupTabProps {
  project: ProjectDetail;
  onUpdateProject: (data: Partial<{ name: string; description: string; deadline: string | null; sequential: boolean }>) => Promise<void>;
  onAddTask: (taskTypeId: string, orderIndex: number, required?: boolean) => Promise<void>;
  onUpdateTask: (taskId: string, data: Partial<{ order_index: number; required: boolean }>) => Promise<void>;
  onRemoveTask: (taskId: string) => Promise<void>;
  onActivate: () => void;
  selectedUnitCount: number;
}

export default function SetupTab({
  project,
  onUpdateProject,
  onAddTask,
  onUpdateTask,
  onRemoveTask,
  onActivate,
  selectedUnitCount,
}: SetupTabProps) {
  const isDraft = project.status === 'draft';
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [deadline, setDeadline] = useState(project.deadline || '');
  const [sequential, setSequential] = useState(project.sequential);
  const [saving, setSaving] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdateProject({
        name,
        description,
        deadline: deadline || null,
        sequential,
      });
    } catch (err) {
      console.error('Failed to save project:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSelectExistingTask = async (taskType: TaskType) => {
    const nextIndex = project.tasks.length;
    await onAddTask(taskType.id, nextIndex);
  };

  const handleCreateNewTask = async (taskType: Omit<TaskType, 'id' | 'created_at' | 'created_by'>) => {
    const res = await fetch('/api/admin/task-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskType),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Failed to create task type');
    const nextIndex = project.tasks.length;
    await onAddTask(json.data.id, nextIndex);
  };

  const handleMoveTask = async (task: ProjectTask, direction: 'up' | 'down') => {
    const tasks = [...project.tasks].sort((a, b) => a.order_index - b.order_index);
    const idx = tasks.findIndex((t) => t.id === task.id);
    if (direction === 'up' && idx <= 0) return;
    if (direction === 'down' && idx >= tasks.length - 1) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const swapTask = tasks[swapIdx];

    await onUpdateTask(task.id, { order_index: swapTask.order_index });
    await onUpdateTask(swapTask.id, { order_index: task.order_index });
  };

  const sortedTasks = [...project.tasks].sort((a, b) => a.order_index - b.order_index);

  const canActivate = isDraft && sortedTasks.length > 0 && selectedUnitCount > 0;

  return (
    <div className="space-y-8">
      {/* Project Settings */}
      <div className="bg-white border border-[var(--border)] p-6">
        <h3 className="font-serif text-lg text-[var(--primary)] mb-4">Project Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[var(--ink)]">
              Name <span className="text-[var(--error)]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isDraft}
              className="mt-1 w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] disabled:bg-gray-50 disabled:text-[var(--muted)]"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[var(--ink)]">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!isDraft}
              rows={3}
              className="mt-1 w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] resize-y disabled:bg-gray-50 disabled:text-[var(--muted)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-[var(--ink)]">Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                disabled={!isDraft}
                className="mt-1 w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] disabled:bg-gray-50 disabled:text-[var(--muted)]"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--ink)]">Sequential Tasks</label>
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => isDraft && setSequential(!sequential)}
                  disabled={!isDraft}
                  className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                    sequential ? 'bg-[var(--primary)]' : 'bg-gray-300'
                  } ${!isDraft ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
                      sequential ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
                <span className="text-sm text-[var(--muted)]">
                  {sequential ? 'Yes — tenants must complete tasks in order' : 'No — all tasks available at once'}
                </span>
              </div>
            </div>
          </div>
          {isDraft && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Task List */}
      <div className="bg-white border border-[var(--border)] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-lg text-[var(--primary)]">Tasks</h3>
          {isDraft && (
            <button
              type="button"
              onClick={() => setShowAddTask(true)}
              className="px-3 py-1.5 bg-[var(--primary)] text-white text-xs font-medium rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200"
            >
              + Add Task
            </button>
          )}
        </div>

        {sortedTasks.length === 0 ? (
          <p className="text-sm text-[var(--muted)] py-6 text-center">
            No tasks added yet. Add tasks to define what needs to happen in this project.
          </p>
        ) : (
          <div className="space-y-1">
            {sortedTasks.map((task, idx) => (
              <div
                key={task.id}
                className="flex items-center gap-3 px-3 py-2.5 border border-[var(--border)] bg-[var(--bg-section)]"
              >
                <span className="text-xs text-[var(--muted)] w-5 text-center font-mono">{idx + 1}</span>

                {isDraft && (
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleMoveTask(task, 'up')}
                      disabled={idx === 0}
                      className="text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-30 transition-colors"
                      title="Move up"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveTask(task, 'down')}
                      disabled={idx === sortedTasks.length - 1}
                      className="text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-30 transition-colors"
                      title="Move down"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-[var(--ink)]">
                    {task.task_type?.name || 'Unknown Task'}
                  </span>
                </div>

                <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 border border-gray-200 rounded-none whitespace-nowrap">
                  {(task.task_type?.evidence_type || '').replace('_', ' ')}
                </span>

                <span className={`text-xs px-1.5 py-0.5 border rounded-none whitespace-nowrap ${
                  task.task_type?.assignee === 'tenant'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {task.task_type?.assignee || '—'}
                </span>

                {isDraft && (
                  <label className="flex items-center gap-1 text-xs text-[var(--muted)] cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={task.required}
                      onChange={() => onUpdateTask(task.id, { required: !task.required })}
                      className="rounded-none"
                    />
                    Required
                  </label>
                )}

                {isDraft && (
                  <button
                    type="button"
                    onClick={() => onRemoveTask(task.id)}
                    className="text-[var(--muted)] hover:text-[var(--error)] transition-colors"
                    title="Remove task"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activate Button */}
      {isDraft && (
        <div className="bg-white border border-[var(--border)] p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg text-[var(--primary)]">Activate Project</h3>
              <p className="text-sm text-[var(--muted)] mt-1">
                {sortedTasks.length} {sortedTasks.length === 1 ? 'task' : 'tasks'} configured
                {' · '}
                {selectedUnitCount} {selectedUnitCount === 1 ? 'unit' : 'units'} selected
              </p>
              {!canActivate && (
                <p className="text-xs text-[var(--warning)] mt-1">
                  {sortedTasks.length === 0 && 'Add at least one task. '}
                  {selectedUnitCount === 0 && 'Select at least one unit in the Units tab.'}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onActivate}
              disabled={!canActivate}
              className="px-5 py-2.5 bg-[var(--primary)] text-white text-sm font-medium rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Activate
            </button>
          </div>
        </div>
      )}

      <AddTaskModal
        isOpen={showAddTask}
        onClose={() => setShowAddTask(false)}
        onSelectExisting={handleSelectExistingTask}
        onCreateNew={handleCreateNewTask}
      />
    </div>
  );
}
