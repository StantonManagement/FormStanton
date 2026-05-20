'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProjects } from '@/lib/useProjects';
import { ProjectStatusBadge } from '@/components/projects';
import type { ProjectStatus } from '@/types/compliance';
import type { ProjectListItem } from '@/lib/useProjects';
import {
  DataTable,
  type ColumnDef,
  DateCell,
} from '@/components/admin/DataTable';
import { Plus, Trash2 } from 'lucide-react';

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

  const statusOptions = useMemo(
    () =>
      Array.from(new Set(projects.map((p) => p.status).filter(Boolean))).map((value) => ({
        value,
        label: String(value)
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase()),
      })),
    [projects]
  );

  const columns = useMemo<ColumnDef<ProjectListItem>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Name',
        enableSorting: true,
        enableFiltering: true,
        meta: {
          filter: { type: 'text' },
          csvValue: (row) => row.name,
          className: 'group',
        },
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--ink)]">{row.name}</span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setConfirmDeleteId(row.id);
                setDeleteError('');
              }}
              className="ml-auto opacity-0 transition-opacity text-[var(--muted)] hover:text-[var(--error)] group-hover:opacity-100"
              aria-label={`Delete ${row.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        enableSorting: true,
        enableFiltering: statusOptions.length > 0,
        meta: {
          filter: statusOptions.length > 0 ? { type: 'select', options: statusOptions } : undefined,
          csvValue: (row) => row.status,
        },
        cell: ({ value }) => <ProjectStatusBadge status={value as ProjectStatus} />,
      },
      {
        id: 'deadline',
        accessorKey: 'deadline',
        header: 'Deadline',
        enableSorting: true,
        meta: {
          csvValue: (row) => row.deadline ?? '',
        },
        cell: ({ value }) =>
          value ? (
            <DateCell value={value as string} format="long" />
          ) : (
            <span className="text-sm text-[var(--muted)]">—</span>
          ),
      },
      {
        id: 'unit_count',
        accessorKey: 'unit_count',
        header: 'Units',
        enableSorting: true,
        meta: {
          align: 'right',
          csvValue: (row) => String(row.unit_count),
        },
        cell: ({ value }) => (
          <span className="text-sm text-[var(--muted)]">{value as number}</span>
        ),
      },
      {
        id: 'completion_percent',
        accessorKey: 'completion_percent',
        header: '% Complete',
        enableSorting: true,
        meta: {
          align: 'right',
          csvValue: (row) => `${row.completion_percent}`,
        },
        cell: ({ row }) =>
          row.unit_count > 0 ? (
            <span
              className={`text-sm font-medium ${
                row.completion_percent === 100 ? 'text-[var(--success)]' : 'text-[var(--ink)]'
              }`}
            >
              {row.completion_percent}%
            </span>
          ) : (
            <span className="text-sm text-[var(--muted)]">—</span>
          ),
      },
    ],
    [statusOptions]
  );

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
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200"
          >
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <div className="bg-white border border-[var(--border)]">
          <DataTable<ProjectListItem>
            data={projects}
            columns={columns}
            urlNamespace="projects"
            getRowId={(row) => row.id}
            loading={loading}
            enableGlobalSearch={true}
            enableColumnFilters={true}
            enableColumnVisibility={true}
            enableCsvExport={true}
            onRowClick={(row) => router.push(`/admin/projects/${row.id}`)}
            emptyState={
              <div className="text-center py-16 flex flex-col items-center gap-3">
                <svg className="w-12 h-12 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm text-[var(--muted)]">No projects yet. Create your first project.</p>
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--border)] text-sm text-[var(--primary)] hover:bg-[var(--bg-section)] transition-colors rounded-none"
                >
                  <Plus className="h-4 w-4" />
                  New Project
                </button>
              </div>
            }
          />
        </div>
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
