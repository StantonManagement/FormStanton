'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProjects } from '@/lib/useProjects';
import { ProjectStatusBadge } from '@/components/projects';
import type { ProjectStatus } from '@/types/compliance';

export default function ProjectsListPage() {
  const router = useRouter();
  const { projects, loading, error, createProject, deleteProject } = useProjects();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newSequential, setNewSequential] = useState(false);
  const [newParentId, setNewParentId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteProject(confirmDeleteId);
      setConfirmDeleteId(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const project = await createProject({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        deadline: newDeadline || undefined,
        sequential: newSequential,
        parent_project_id: newParentId || undefined,
      });
      setShowCreate(false);
      setNewName('');
      setNewDescription('');
      setNewDeadline('');
      setNewSequential(false);
      setNewParentId('');
      if (project) {
        router.push(`/admin/projects/${project.id}`);
      }
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)]">
        <div className="text-[var(--muted)]">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      {/* Header */}
      <div className="bg-white border-b border-[var(--divider)] shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif text-[var(--primary)]">Projects</h1>
            <p className="text-sm text-[var(--muted)] mt-0.5">Manage compliance campaigns</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200"
          >
            New Project
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {projects.length === 0 ? (
          <div className="text-center py-16 bg-white border border-[var(--border)]">
            <svg className="w-12 h-12 text-[var(--muted)] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-[var(--muted)]">No projects yet. Create your first project.</p>
          </div>
        ) : (
          <div className="bg-white border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--bg-section)] border-b border-[var(--divider)]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Deadline</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Units</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">% Complete</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/admin/projects/${p.id}`)}
                    className="group border-b border-[var(--divider)] hover:bg-[var(--bg-section)] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-[var(--ink)]">
                      <div className="flex items-center gap-2">
                        <span>{p.name}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(p.id); setDeleteError(''); }}
                          className="ml-auto opacity-0 group-hover:opacity-100 p-1 text-[var(--muted)] hover:text-[var(--error)] transition-colors duration-200"
                          title="Delete project"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <ProjectStatusBadge status={p.status as ProjectStatus} />
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {p.deadline || '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--muted)]">{p.unit_count}</td>
                    <td className="px-4 py-3 text-right">
                      {p.unit_count > 0 ? (
                        <span className={`text-sm font-medium ${
                          p.completion_percent === 100 ? 'text-[var(--success)]' : 'text-[var(--ink)]'
                        }`}>
                          {p.completion_percent}%
                        </span>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirm Modal */}
      {confirmDeleteId && (() => {
        const proj = projects.find((p) => p.id === confirmDeleteId);
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
            <div className="bg-white border border-gray-300 w-full max-w-sm p-6">
              <h3 className="font-serif text-xl mb-2">Delete Project?</h3>
              <p className="text-sm text-[var(--ink)] mb-1">
                <strong>{proj?.name}</strong>
              </p>
              <p className="text-sm text-[var(--muted)] mb-4">
                This will permanently delete all units, task completions, and data associated with this project. This cannot be undone.
              </p>

              {deleteError && (
                <div className="mb-3 border border-red-200 bg-red-50 p-2 text-sm text-red-700">{deleteError}</div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => { setConfirmDeleteId(null); setDeleteError(''); }}
                  disabled={deleting}
                  className="px-4 py-2 border border-[var(--border)] text-[var(--ink)] text-sm hover:bg-[var(--bg-section)] transition-colors rounded-none disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-700 text-white text-sm font-medium rounded-none hover:bg-red-800 transition-colors duration-200 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete Project'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white border border-gray-300 w-full max-w-md p-6">
            <h3 className="font-serif text-xl mb-4">New Project</h3>

            {createError && (
              <div className="mb-4 border border-red-200 bg-red-50 p-2 text-sm text-red-700">{createError}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--ink)]">
                  Name <span className="text-[var(--error)]">*</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Spring 2026 Inspections"
                  className="mt-1 w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)]"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--ink)]">Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={2}
                  className="mt-1 w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] resize-y"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--ink)]">Deadline</label>
                <input
                  type="date"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--ink)]">Parent Project</label>
                <select
                  value={newParentId}
                  onChange={(e) => setNewParentId(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)]"
                >
                  <option value="">None (standalone project)</option>
                  {projects.filter(p => p.status !== 'draft').map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <p className="text-xs text-[var(--muted)] mt-1">Link to a parent project to inherit its evidence</p>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newSequential}
                    onChange={(e) => setNewSequential(e.target.checked)}
                    className="rounded-none"
                  />
                  <span className="text-[var(--ink)]">Sequential tasks</span>
                </label>
                <p className="text-xs text-[var(--muted)] mt-1">Tenants must complete tasks in order</p>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                type="button"
                onClick={() => { setShowCreate(false); setCreateError(''); }}
                className="px-4 py-2 border border-[var(--border)] text-[var(--ink)] text-sm hover:bg-[var(--bg-section)] transition-colors rounded-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
