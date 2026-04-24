'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProjectDetail } from '@/lib/useProjectDetail';
import { ProjectStatusBadge, SetupTab, UnitsTab, SendLinksTab } from '@/components/projects';
import ConfirmDialog from '@/components/kit/ConfirmDialog';

type Tab = 'setup' | 'units' | 'links';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const detail = useProjectDetail(projectId);

  const [activeTab, setActiveTab] = useState<Tab>('setup');
  const [selectedUnits, setSelectedUnits] = useState<{ building: string; unit_number: string }[]>([]);
  const [showActivateConfirm, setShowActivateConfirm] = useState(false);
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    if (detail.project?.name) {
      document.title = `${detail.project.name} — Projects - Stanton Management`;
    }
  }, [detail.project?.name]);

  const handleActivate = async () => {
    setShowActivateConfirm(false);
    setActivating(true);
    try {
      await detail.activate(selectedUnits);
      setActiveTab('units');
    } catch (err) {
      console.error('Activation failed:', err);
    } finally {
      setActivating(false);
    }
  };

  if (detail.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)]">
        <div className="text-[var(--muted)]">Loading project...</div>
      </div>
    );
  }

  if (detail.error || !detail.project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)]">
        <div className="text-center">
          <p className="text-[var(--error)] mb-4">{detail.error || 'Project not found'}</p>
          <button
            type="button"
            onClick={() => router.push('/admin/projects')}
            className="text-sm text-[var(--primary)] hover:text-[var(--primary-light)]"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  const project = detail.project;
  const tabs: { id: Tab; label: string }[] = [
    { id: 'setup', label: 'Setup' },
    { id: 'units', label: 'Units' },
    { id: 'links', label: 'Send Links' },
  ];

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      {/* Header */}
      <div className="bg-white border-b border-[var(--divider)] shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3 mb-1">
            <button
              type="button"
              onClick={() => router.push('/admin/projects')}
              className="text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Projects
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-serif text-[var(--primary)]">{project.name}</h1>
                <ProjectStatusBadge status={project.status} />
              </div>
              {project.parent_project_id && (
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  ↳ Child of: <button
                    type="button"
                    onClick={() => router.push(`/admin/projects/${project.parent_project_id}`)}
                    className="text-[var(--primary)] hover:underline"
                  >
                    {detail.parentProjectName || project.parent_project_id}
                  </button>
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              {project.status === 'active' && (
                <button
                  type="button"
                  onClick={() => router.push(`/admin/compliance?project=${project.id}`)}
                  className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Open Audit Dashboard
                </button>
              )}
              {project.deadline && (
                <div className="text-sm text-[var(--muted)]">
                  Deadline: <span className="text-[var(--ink)] font-medium">{project.deadline}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex border-b-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-[var(--primary)] text-[var(--primary)]'
                    : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-5xl mx-auto px-6 py-6">
        {activeTab === 'setup' && (
          <SetupTab
            project={project}
            onUpdateProject={detail.updateProject}
            onAddTask={detail.addTask}
            onUpdateTask={detail.updateTask}
            onRemoveTask={detail.removeTask}
            onActivate={() => setShowActivateConfirm(true)}
            selectedUnitCount={selectedUnits.length}
          />
        )}

        {activeTab === 'units' && (
          <UnitsTab
            project={project}
            units={detail.units}
            unitsLoading={detail.unitsLoading}
            selectedUnits={selectedUnits}
            onSelectedUnitsChange={setSelectedUnits}
            onRegenerateToken={detail.regenerateToken}
            onAddUnits={detail.addUnits}
          />
        )}

        {activeTab === 'links' && (
          <SendLinksTab
            project={project}
            units={detail.units}
            unitsLoading={detail.unitsLoading}
            onRefresh={detail.fetchUnits}
          />
        )}
      </div>

      <ConfirmDialog
        isOpen={showActivateConfirm}
        title="Activate Project"
        message={`Activate this project? This will generate tenant links for ${selectedUnits.length} units. Tasks cannot be edited after activation.`}
        confirmText={activating ? 'Activating...' : 'Activate'}
        cancelText="Cancel"
        onConfirm={handleActivate}
        onCancel={() => setShowActivateConfirm(false)}
      />
    </div>
  );
}
