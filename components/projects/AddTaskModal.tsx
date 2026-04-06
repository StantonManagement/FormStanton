'use client';

import { useState, useEffect, useMemo } from 'react';
import type { TaskType, EvidenceType, Assignee } from '@/types/compliance';

interface AddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectExisting: (taskType: TaskType) => void;
  onCreateNew: (taskType: Omit<TaskType, 'id' | 'created_at' | 'created_by'>) => Promise<void>;
}

const EVIDENCE_TYPES: { value: EvidenceType; label: string }[] = [
  { value: 'form', label: 'Form' },
  { value: 'file_upload', label: 'File Upload' },
  { value: 'photo', label: 'Photo' },
  { value: 'signature', label: 'Signature' },
  { value: 'acknowledgment', label: 'Acknowledgment' },
  { value: 'staff_check', label: 'Staff Check' },
];

const ASSIGNEES: { value: Assignee; label: string }[] = [
  { value: 'tenant', label: 'Tenant' },
  { value: 'staff', label: 'Staff' },
];

export default function AddTaskModal({ isOpen, onClose, onSelectExisting, onCreateNew }: AddTaskModalProps) {
  const [tab, setTab] = useState<'existing' | 'new'>('existing');
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [taskTypesLoading, setTaskTypesLoading] = useState(false);
  const [search, setSearch] = useState('');

  // New task type form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState<Assignee>('tenant');
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('form');
  const [instructions, setInstructions] = useState('');
  const [formId, setFormId] = useState('');
  const [submissionColumn, setSubmissionColumn] = useState('');
  const [forms, setForms] = useState<{ id: number; title: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setTab('existing');
    setSearch('');
    setName('');
    setDescription('');
    setAssignee('tenant');
    setEvidenceType('form');
    setInstructions('');
    setFormId('');
    setSubmissionColumn('');
    setError('');
    fetchTaskTypes();
    fetchForms();
  }, [isOpen]);

  const fetchTaskTypes = async () => {
    setTaskTypesLoading(true);
    try {
      const res = await fetch('/api/admin/task-types');
      const json = await res.json();
      if (json.success) setTaskTypes(json.data || []);
    } catch (err) {
      console.error('Failed to fetch task types:', err);
    } finally {
      setTaskTypesLoading(false);
    }
  };

  const fetchForms = async () => {
    try {
      const res = await fetch('/api/admin/forms-library');
      const json = await res.json();
      if (json.success) {
        setForms((json.data || []).map((f: any) => ({ id: f.id, title: f.title })));
      }
    } catch (err) {
      console.error('Failed to fetch forms:', err);
    }
  };

  const filteredTaskTypes = useMemo(() => {
    if (!search.trim()) return taskTypes;
    const q = search.toLowerCase();
    return taskTypes.filter(
      (t) => t.name.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)
    );
  }, [taskTypes, search]);

  const handleCreateNew = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await onCreateNew({
        name: name.trim(),
        description: description.trim() || null,
        assignee,
        evidence_type: evidenceType,
        form_id: evidenceType === 'form' && formId ? formId : null,
        instructions: instructions.trim() || null,
        submission_column: submissionColumn.trim() || null,
        failure_reasons: null,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create task type');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
      <div className="bg-white border border-gray-300 w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--divider)]">
          <h3 className="font-serif text-xl">Add Task</h3>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex border-b border-[var(--divider)]">
          <button
            onClick={() => setTab('existing')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'existing' ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            Existing Task Types
          </button>
          <button
            onClick={() => setTab('new')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'new' ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            Create New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'existing' && (
            <div>
              <input
                type="text"
                placeholder="Search task types..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm mb-3 focus:outline-none focus:border-[var(--primary)]"
              />
              {taskTypesLoading ? (
                <p className="text-sm text-[var(--muted)] py-4 text-center">Loading...</p>
              ) : filteredTaskTypes.length === 0 ? (
                <p className="text-sm text-[var(--muted)] py-4 text-center">
                  {taskTypes.length === 0 ? 'No task types yet. Create one first.' : 'No matching task types.'}
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredTaskTypes.map((tt) => (
                    <button
                      key={tt.id}
                      type="button"
                      onClick={() => { onSelectExisting(tt); onClose(); }}
                      className="w-full text-left px-3 py-2.5 border border-[var(--border)] hover:bg-[var(--bg-section)] transition-colors duration-200"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--ink)]">{tt.name}</span>
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 border border-gray-200 rounded-none">
                          {tt.evidence_type.replace('_', ' ')}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 border rounded-none ${
                          tt.assignee === 'tenant' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {tt.assignee}
                        </span>
                      </div>
                      {tt.description && (
                        <p className="text-xs text-[var(--muted)] mt-1">{tt.description}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'new' && (
            <div className="space-y-4">
              {error && (
                <div className="border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>
              )}

              <div>
                <label className="text-sm font-medium text-[var(--ink)]">
                  Name <span className="text-[var(--error)]">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)]"
                  placeholder="e.g. Upload Insurance Certificate"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--ink)]">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="mt-1 w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] resize-y"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[var(--ink)]">Assignee</label>
                  <select
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value as Assignee)}
                    className="mt-1 w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm bg-white focus:outline-none focus:border-[var(--primary)]"
                  >
                    {ASSIGNEES.map((a) => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--ink)]">Evidence Type</label>
                  <select
                    value={evidenceType}
                    onChange={(e) => setEvidenceType(e.target.value as EvidenceType)}
                    className="mt-1 w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm bg-white focus:outline-none focus:border-[var(--primary)]"
                  >
                    {EVIDENCE_TYPES.map((et) => (
                      <option key={et.value} value={et.value}>{et.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {evidenceType === 'form' && (
                <div>
                  <label className="text-sm font-medium text-[var(--ink)]">Form</label>
                  <select
                    value={formId}
                    onChange={(e) => setFormId(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm bg-white focus:outline-none focus:border-[var(--primary)]"
                  >
                    <option value="">Select a form...</option>
                    {forms.map((f) => (
                      <option key={f.id} value={f.id}>{f.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {assignee === 'staff' && evidenceType === 'staff_check' && (
                <div>
                  <label className="text-sm font-medium text-[var(--ink)]">Submission Column (optional)</label>
                  <input
                    type="text"
                    value={submissionColumn}
                    onChange={(e) => setSubmissionColumn(e.target.value)}
                    placeholder="e.g. insurance_verified"
                    className="mt-1 w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)]"
                  />
                  <p className="text-xs text-[var(--muted)] mt-1">If set, completing this task will also set this boolean column to true on the matching submission.</p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-[var(--ink)]">Instructions</label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={2}
                  placeholder="Instructions shown to tenant or staff"
                  className="mt-1 w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] resize-y"
                />
              </div>

              <button
                type="button"
                onClick={handleCreateNew}
                disabled={saving || !name.trim()}
                className="w-full px-4 py-2.5 bg-[var(--primary)] text-white text-sm font-medium rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create & Add Task'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
