'use client';

import { useState, useEffect, useCallback } from 'react';
import { useComplianceData } from '@/lib/useComplianceData';
import { useQuickLookup } from '@/lib/useQuickLookup';
import { useToast } from '@/lib/useToast';
import VehicleExportCenter from '@/components/VehicleExportCenter';
import AddTenantModal from '@/components/AddTenantModal';
import SubmissionEditModal from '@/components/SubmissionEditModal';
import { DashboardHeader, ComplianceSidebar, BuildingDetailView, PortfolioTable, TenantSidePanel, BuildingMatrixTable } from '@/components/compliance';
import ReviewMode from '@/components/compliance/ReviewMode';
import Toast from '@/components/kit/Toast';
import type { TenantSubmission } from '@/types/compliance';

interface ProjectOption {
  id: string;
  name: string;
  status: string;
}

interface ComplianceClientProps {
  initialProject: string;
}

export default function ComplianceClient({ initialProject }: ComplianceClientProps) {
  const [selectedProject, setSelectedProject] = useState(initialProject);
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  // Lazy fetch project list — does not block initial render
  useEffect(() => {
    fetch('/api/admin/projects')
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data) {
          setProjects(
            json.data
              .filter((p: any) => p.status === 'active' || p.status === 'closed')
              .map((p: any) => ({ id: p.id, name: p.name, status: p.status }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const handleSelectProject = useCallback((id: string) => {
    setSelectedProject(id);
    const url = id === 'legacy'
      ? '/admin/compliance'
      : `/admin/compliance?project=${id}`;
    window.history.replaceState(null, '', url);
  }, []);

  const data = useComplianceData(selectedProject);
  const lookup = useQuickLookup(data.allSubmissions);
  const { toasts, showToast, dismissToast } = useToast();

  const isProjectMode = data.mode === 'project';

  const [selectedPortfolio, setSelectedPortfolio] = useState('all');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showExportCenter, setShowExportCenter] = useState(false);
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [editingSubmission, setEditingSubmission] = useState<TenantSubmission | null>(null);
  const [reviewMode, setReviewMode] = useState(false);

  useEffect(() => {
    if (editingSubmission) {
      const refreshed = data.allSubmissions.find(s => s.id === editingSubmission.id) as TenantSubmission | undefined;
      if (refreshed && refreshed !== editingSubmission) setEditingSubmission(refreshed);
    }
  }, [data.allSubmissions]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search name"]') as HTMLInputElement;
        searchInput?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarCollapsed(prev => !prev);
      }
      if (e.key === 'Escape' && lookup.query) {
        lookup.clear();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [lookup.query]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear building selection when switching projects
  useEffect(() => {
    data.setSelectedBuilding('');
  }, [selectedProject]); // eslint-disable-line react-hooks/exhaustive-deps

  if (data.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)]">
        <div className="text-[var(--muted)]">Loading compliance data...</div>
      </div>
    );
  }

  // In project mode, use project buildings for sidebar
  const sidebarBuildings = isProjectMode ? data.projectBuildings : data.buildings;

  // Find project building stats for selected building (project mode)
  const currentProjectBuildingStats = isProjectMode
    ? data.projectBuildingStats.find(b => b.building === data.selectedBuilding)
    : undefined;

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <DashboardHeader
        portfolioStats={data.portfolioStats}
        onOpenExportCenter={() => setShowExportCenter(true)}
        projects={projects}
        selectedProject={selectedProject}
        onSelectProject={handleSelectProject}
      />

      <div className="flex" style={{ height: 'calc(100vh - 120px)' }}>
        <ComplianceSidebar
          buildings={sidebarBuildings}
          buildingStats={data.buildingStats}
          selectedBuilding={data.selectedBuilding}
          onSelectBuilding={data.setSelectedBuilding}
          selectedPortfolio={selectedPortfolio}
          onSelectPortfolio={setSelectedPortfolio}
          collapsed={sidebarCollapsed}
          quickLookupQuery={lookup.query}
          onQuickLookupChange={lookup.setQuery}
          quickLookupResults={lookup.results}
          onQuickLookupClear={lookup.clear}
          matrixRows={data.matrixRows}
          matrixLoading={data.matrixLoading}
          activeFilters={data.activeFilters}
          onToggleFilter={data.handleToggleFilter}
          onClearFilters={() => data.setActiveFilters(new Set())}
          mode={data.mode}
          projectColumns={data.projectColumns}
          projectRows={data.filteredProjectRows}
          portfolioBuildingStats={data.portfolioBuildingStats}
        />

        <div className="flex-1 overflow-y-auto p-4 lg:p-6 xl:p-8 relative">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="absolute top-4 left-4 z-10 p-2 bg-white border border-[var(--border)] rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out shadow-sm"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg className="w-5 h-5 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sidebarCollapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              )}
            </svg>
          </button>

          {/* Portfolio / All Buildings view */}
          {!data.selectedBuilding && (
            <div className="max-w-7xl mx-auto space-y-6 pt-2">
              <div>
                <h2 className="text-2xl font-serif text-[var(--primary)]">
                  {isProjectMode ? data.projectName || 'Project' : 'All Buildings'}
                </h2>
                <p className="text-sm text-[var(--muted)] mt-1">
                  {isProjectMode
                    ? `${data.projectBuildingStats.length} buildings \u00b7 Click a building to open the detail view.`
                    : 'Click a building to open the detail view. Sorted by completion \u2014 least complete first.'
                  }
                </p>
              </div>
              <PortfolioTable
                rows={data.portfolioBuildingStats}
                selectedPortfolio={selectedPortfolio}
                onSelectBuilding={data.setSelectedBuilding}
                mode={data.mode}
                projectColumns={data.projectColumns}
                projectBuildingStats={data.projectBuildingStats}
              />
            </div>
          )}

          {/* Building detail — legacy mode */}
          {data.selectedBuilding && !isProjectMode && (
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => data.setSelectedBuilding('')}
                  className="text-xs text-[var(--primary)] hover:text-[var(--primary-light)] hover:underline transition-colors duration-200 ease-out font-medium"
                >
                  &larr; All Buildings
                </button>

                {/* Review Mode toggle — now available in legacy mode too */}
                <button
                  onClick={() => setReviewMode(!reviewMode)}
                  className={`px-4 py-2 text-sm font-medium border transition-colors ${
                    reviewMode
                      ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                      : 'bg-white text-[var(--primary)] border-[var(--border)] hover:bg-[var(--bg-section)]'
                  }`}
                >
                  {reviewMode ? '✓ Review Mode' : 'Review Mode'}
                </button>
              </div>

              {reviewMode ? (
                /* Review Mode UI — placeholder for legacy mode */
                <div className="bg-white border border-[var(--border)] shadow-sm p-6" style={{ height: 'calc(100vh - 240px)' }}>
                  <div className="flex items-center justify-center h-full text-[var(--muted)]">
                    <div className="text-center">
                      <svg className="w-16 h-16 mx-auto mb-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm">Review mode is available for project-based workflows.</p>
                      <p className="text-xs mt-2">Select a project from the dropdown to use review mode.</p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Standard legacy building detail view */
                <BuildingDetailView
                  selectedBuilding={data.selectedBuilding}
                  onBack={() => data.setSelectedBuilding('')}
                  onAddTenant={() => setShowAddTenant(true)}
                  matrixRows={data.matrixRows}
                  matrixStats={data.matrixStats}
                  matrixLoading={data.matrixLoading}
                  filteredMatrixRows={data.filteredMatrixRows}
                  missingSubmissions={data.missingSubmissions}
                  activeFilters={data.activeFilters}
                  selectedIds={data.selectedIds}
                  onSelectionChange={data.setSelectedIds}
                  duplicateGroups={data.duplicateGroups}
                  onMerge={data.handleMergeSubmissions}
                  onMarkPrimary={data.handleMarkPrimary}
                  onDismiss={data.handleDismissDuplicate}
                  pendingParkingRequests={data.pendingParkingRequests}
                  parkingExpanded={data.parkingExpanded}
                  onSetParkingExpanded={data.setParkingExpanded}
                  onSelectTenant={data.setSelectedRow}
                  onRefresh={data.handleRefreshAll}
                  onToast={showToast}
                />
              )}
            </div>
          )}

          {/* Building detail — project mode */}
          {data.selectedBuilding && isProjectMode && (
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => data.setSelectedBuilding('')}
                  className="text-xs text-[var(--primary)] hover:text-[var(--primary-light)] hover:underline transition-colors duration-200 ease-out font-medium"
                >
                  &larr; All Buildings
                </button>
                
                {/* Review Mode toggle */}
                <button
                  onClick={() => setReviewMode(!reviewMode)}
                  className={`px-4 py-2 text-sm font-medium border transition-colors ${
                    reviewMode
                      ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                      : 'bg-white text-[var(--primary)] border-[var(--border)] hover:bg-[var(--bg-section)]'
                  }`}
                >
                  {reviewMode ? '✓ Review Mode' : 'Review Mode'}
                </button>
              </div>

              {currentProjectBuildingStats && (
                <div className="bg-white border border-[var(--border)] shadow-sm p-6">
                  <h2 className="text-2xl font-serif text-[var(--primary)]">{data.selectedBuilding}</h2>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <div className={`px-3 py-1.5 text-xs font-medium border ${
                      currentProjectBuildingStats.complete_units === currentProjectBuildingStats.total_units
                        ? 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/35'
                        : currentProjectBuildingStats.complete_units > 0
                          ? 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/35'
                          : 'bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/35'
                    }`}>
                      Units Complete: {currentProjectBuildingStats.complete_units}/{currentProjectBuildingStats.total_units}
                    </div>
                    {data.projectColumns.map(col => {
                      const s = currentProjectBuildingStats.columns[col.id];
                      if (!s || s.total === 0) return null;
                      return (
                        <div key={col.id} className={`px-3 py-1.5 text-xs font-medium border ${
                          s.complete === s.total
                            ? 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/35'
                            : s.complete > 0
                              ? 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/35'
                              : 'bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/35'
                        }`}>
                          {col.label}: {s.complete}/{s.total}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {reviewMode ? (
                /* Review Mode UI */
                <div className="bg-white border border-[var(--border)] shadow-sm" style={{ height: 'calc(100vh - 240px)' }}>
                  <ReviewMode
                    columns={data.projectColumns}
                    rows={data.filteredProjectRows}
                    projectName={data.projectName || 'Project'}
                    onStaffComplete={data.handleStaffComplete}
                    onStaffFail={data.handleStaffFail}
                    onStaffUncomplete={data.handleStaffUncomplete}
                  />
                </div>
              ) : (
                /* Standard matrix grid */
                <div className="space-y-3">
                  <BuildingMatrixTable
                    rows={[]}
                    onSelectTenant={() => {}}
                    onRefresh={() => {}}
                    selectedIds={new Set()}
                    onSelectionChange={() => {}}
                    mode="project"
                    projectColumns={data.projectColumns}
                    projectRows={data.filteredProjectRows}
                    onStaffUncomplete={data.handleStaffUncomplete}
                  />
                  {data.activeFilters.size > 0 && (
                    <div className="text-xs text-[var(--muted)]">
                      Showing {data.filteredProjectRows.length} rows (filtered)
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Legacy-only modals and panels */}
      {!isProjectMode && data.selectedRow && (
        <TenantSidePanel
          row={data.selectedRow}
          submission={data.sidePanelSubmission}
          onClose={() => data.setSelectedRow(null)}
          onRefresh={data.handleRefreshAll}
          onEditSubmission={(sub) => setEditingSubmission(sub)}
        />
      )}

      {!isProjectMode && showExportCenter && (
        <VehicleExportCenter
          allSubmissions={data.allSubmissions}
          buildings={data.buildings}
          onClose={() => setShowExportCenter(false)}
          onExportComplete={() => data.handleRefreshAll()}
        />
      )}

      {!isProjectMode && editingSubmission && (
        <SubmissionEditModal
          submission={editingSubmission}
          onClose={() => setEditingSubmission(null)}
          onSuccess={() => data.handleRefreshAll()}
        />
      )}

      {!isProjectMode && (
        <AddTenantModal
          isOpen={showAddTenant}
          onClose={() => setShowAddTenant(false)}
          onSuccess={() => data.handleRefreshAll()}
          prefilledBuilding={data.selectedBuilding}
        />
      )}

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
