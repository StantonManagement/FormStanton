'use client';

import { useState } from 'react';
import type { MatrixRow, BuildingMatrixStats } from '@/types/compliance';
import type { SubmissionGroup } from '@/lib/duplicateDetection';
import ParkingManagementPanel from '@/components/ParkingManagementPanel';
import DuplicateSubmissionAccordion from '@/components/DuplicateSubmissionAccordion';
import { BuildingHeader, BuildingMatrixTable, countRowsWithActions, BulkActionsBar, ComplianceTabs } from '@/components/compliance';
import type { ComplianceTab } from '@/components/compliance';
import MissingSubmissionsGrid from './MissingSubmissionsGrid';

interface BuildingDetailViewProps {
  selectedBuilding: string;
  onBack: () => void;
  onAddTenant: () => void;
  // Matrix data
  matrixRows: MatrixRow[];
  matrixStats: BuildingMatrixStats | null;
  matrixLoading: boolean;
  filteredMatrixRows: MatrixRow[];
  missingSubmissions: MatrixRow[];
  // Filters
  activeFilters: Set<string>;
  // Bulk selection
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  // Duplicates
  duplicateGroups: SubmissionGroup[];
  onMerge: (primaryId: string, duplicateIds: string[]) => Promise<void>;
  onMarkPrimary: (submissionId: string, groupId: string) => Promise<void>;
  onDismiss: (groupId: string, duplicateId: string) => Promise<void>;
  // Parking
  pendingParkingRequests: number;
  parkingExpanded: boolean;
  onSetParkingExpanded: (v: boolean | ((prev: boolean) => boolean)) => void;
  // Actions
  onSelectTenant: (row: MatrixRow) => void;
  onRefresh: () => void;
  onToast: (message: string, onUndo?: () => void) => void;
}

export default function BuildingDetailView({
  selectedBuilding,
  onBack,
  onAddTenant,
  matrixRows,
  matrixStats,
  matrixLoading,
  filteredMatrixRows,
  missingSubmissions,
  activeFilters,
  selectedIds,
  onSelectionChange,
  duplicateGroups,
  onMerge,
  onMarkPrimary,
  onDismiss,
  pendingParkingRequests,
  parkingExpanded,
  onSetParkingExpanded,
  onSelectTenant,
  onRefresh,
  onToast,
}: BuildingDetailViewProps) {
  const [activeTab, setActiveTab] = useState<ComplianceTab>('tenants');

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <button
        onClick={onBack}
        className="text-xs text-[var(--primary)] hover:text-[var(--primary-light)] hover:underline transition-colors duration-200 ease-out font-medium"
      >
        &larr; All Buildings
      </button>

      {matrixStats && (
        <BuildingHeader
          buildingAddress={selectedBuilding}
          stats={matrixStats}
          onAddTenant={onAddTenant}
        />
      )}

      <ComplianceTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        actionCount={countRowsWithActions(matrixRows)}
        missingCount={missingSubmissions.length}
        duplicateCount={duplicateGroups.length}
      />

      {activeTab === 'tenants' && (
        <div className="space-y-3">
          {pendingParkingRequests > 0 && (
            <div className="border border-[var(--warning)]/35 bg-[var(--warning)]/5">
              <button
                onClick={() => onSetParkingExpanded(prev => !prev)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-[var(--warning)] hover:bg-[var(--warning)]/10 transition-colors duration-200 ease-out"
              >
                <span>{pendingParkingRequests} additional vehicle request{pendingParkingRequests !== 1 ? 's' : ''} pending review</span>
                <span className="text-[10px]">{parkingExpanded ? '▲ Collapse' : '▼ Expand'}</span>
              </button>
              {parkingExpanded && (
                <div className="px-4 pb-4">
                  <ParkingManagementPanel buildingAddress={selectedBuilding} onRefresh={onRefresh} />
                </div>
              )}
            </div>
          )}

          <BulkActionsBar
            selectedIds={selectedIds}
            rows={matrixRows}
            onClearSelection={() => onSelectionChange(new Set())}
            onRefresh={onRefresh}
          />

          {matrixLoading ? (
            <div className="p-8 text-center text-[var(--muted)]">Loading building matrix...</div>
          ) : (
            <BuildingMatrixTable
              rows={filteredMatrixRows}
              onSelectTenant={onSelectTenant}
              onRefresh={onRefresh}
              selectedIds={selectedIds}
              onSelectionChange={onSelectionChange}
              onToast={onToast}
            />
          )}

          {activeFilters.size > 0 && (
            <div className="text-xs text-[var(--muted)]">
              Showing {filteredMatrixRows.length} of {matrixRows.length} rows
            </div>
          )}
        </div>
      )}

      {activeTab === 'duplicates' && (
        <div className="space-y-4">
          {duplicateGroups.length === 0 ? (
            <div className="p-8 text-center text-[var(--muted)] bg-white border border-[var(--border)]">
              No duplicate submissions detected for this building.
            </div>
          ) : (
            duplicateGroups.map(group => (
              <DuplicateSubmissionAccordion
                key={group.id}
                group={group}
                onMerge={onMerge}
                onMarkPrimary={onMarkPrimary}
                onDismiss={onDismiss}
              />
            ))
          )}
        </div>
      )}

      {activeTab === 'missing' && (
        <MissingSubmissionsGrid rows={missingSubmissions} />
      )}
    </div>
  );
}
