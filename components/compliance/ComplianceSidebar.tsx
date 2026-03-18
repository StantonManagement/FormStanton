'use client';

import { useState } from 'react';
import { buildingToAssetId } from '@/lib/buildingAssetIds';
import { buildingToPortfolio, portfolioOrder } from '@/lib/portfolios';
import type { BuildingStats, TenantSubmission, DynamicColumn, ProjectMatrixRow } from '@/types/compliance';
import type { MatrixRow } from '@/types/compliance';
import MatrixFilterBar from './MatrixFilterBar';

interface ComplianceSidebarProps {
  buildings: string[];
  buildingStats: Record<string, BuildingStats>;
  selectedBuilding: string;
  onSelectBuilding: (b: string) => void;
  selectedPortfolio: string;
  onSelectPortfolio: (p: string) => void;
  collapsed: boolean;
  // Quick lookup
  quickLookupQuery: string;
  onQuickLookupChange: (q: string) => void;
  quickLookupResults: TenantSubmission[];
  onQuickLookupClear: () => void;
  // Filters (shown when building selected)
  matrixRows: MatrixRow[];
  matrixLoading: boolean;
  activeFilters: Set<string>;
  onToggleFilter: (f: string) => void;
  onClearFilters: () => void;
  // Project mode (optional — defaults to legacy)
  mode?: 'legacy' | 'project';
  projectColumns?: DynamicColumn[];
  projectRows?: ProjectMatrixRow[];
}

const inputClass = 'w-full px-3 py-2 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200 ease-out';
const panelClass = 'bg-[var(--bg-section)] border border-[var(--divider)]';

export default function ComplianceSidebar({
  buildings,
  buildingStats,
  selectedBuilding,
  onSelectBuilding,
  selectedPortfolio,
  onSelectPortfolio,
  collapsed,
  quickLookupQuery,
  onQuickLookupChange,
  quickLookupResults,
  onQuickLookupClear,
  matrixRows,
  matrixLoading,
  activeFilters,
  onToggleFilter,
  onClearFilters,
  mode = 'legacy',
  projectColumns,
  projectRows,
}: ComplianceSidebarProps) {
  const isProjectMode = mode === 'project';
  const [buildingSearch, setBuildingSearch] = useState('');

  const filteredBuildings = buildings.filter(building => {
    const matchesSearch = building.toLowerCase().includes(buildingSearch.toLowerCase());
    if (isProjectMode) return matchesSearch;
    const matchesPortfolio = selectedPortfolio === 'all' || buildingToPortfolio[building] === selectedPortfolio;
    return matchesSearch && matchesPortfolio;
  });

  return (
    <div className={`${collapsed ? 'w-0' : 'w-72'} bg-white border-r border-[var(--divider)] overflow-y-auto transition-all duration-300 flex-shrink-0`}>
      <div className={`${collapsed ? 'hidden' : 'block'} p-4 space-y-4`}>
        {/* Quick Lookup (legacy only) */}
        {!isProjectMode && (
          <div className={`${panelClass} p-3`}>
            <div className="flex items-center justify-between mb-3 border-b border-[var(--divider)] pb-2">
              <h3 className="text-sm font-semibold text-[var(--primary)]">Quick Tenant Lookup</h3>
              <span className="text-xs text-[var(--muted)]">Ctrl+K</span>
            </div>
            <input
              type="text"
              placeholder="Search name, unit, phone..."
              value={quickLookupQuery}
              onChange={(e) => onQuickLookupChange(e.target.value)}
              className={inputClass}
            />
            {quickLookupResults.length > 0 && (
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {quickLookupResults.map(result => (
                  <div
                    key={result.id}
                    onClick={() => {
                      onSelectBuilding(result.building_address);
                      onQuickLookupClear();
                    }}
                    className="p-2 bg-white border border-[var(--divider)] cursor-pointer hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out"
                  >
                    <div className="text-xs font-medium text-[var(--ink)]">{result.full_name}</div>
                    <div className="text-xs text-[var(--muted)]">{result.building_address} - Unit {result.unit_number}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Portfolio Filter (legacy only) */}
        {!isProjectMode && (
          <div className={`${panelClass} p-3`}>
            <h3 className="text-sm font-semibold text-[var(--primary)] mb-3 border-b border-[var(--divider)] pb-2">Portfolio</h3>
            <select
              value={selectedPortfolio}
              onChange={(e) => onSelectPortfolio(e.target.value)}
              className={inputClass}
            >
              <option value="all">All Portfolios</option>
              {portfolioOrder.map(portfolio => (
                <option key={portfolio} value={portfolio}>{portfolio}</option>
              ))}
            </select>
          </div>
        )}

        {/* Building List */}
        <div className={`${panelClass} p-3`}>
          <h3 className="text-sm font-semibold text-[var(--primary)] mb-3 border-b border-[var(--divider)] pb-2">Buildings</h3>
          <input
            type="text"
            placeholder="Filter buildings..."
            value={buildingSearch}
            onChange={(e) => setBuildingSearch(e.target.value)}
            className={`${inputClass} mb-3`}
          />
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {filteredBuildings.map(building => {
              if (isProjectMode) {
                return (
                  <button
                    key={building}
                    onClick={() => onSelectBuilding(building)}
                    className={`w-full text-left px-3 py-2 text-xs border transition-colors duration-200 ease-out ${
                      selectedBuilding === building
                        ? 'bg-[var(--bg-section)] border-[var(--primary)] text-[var(--primary)]'
                        : 'bg-white border-[var(--divider)] hover:bg-[var(--bg-section)]'
                    }`}
                  >
                    <div className="font-medium">{building}</div>
                  </button>
                );
              }
              const stats = buildingStats[building] || { totalUnits: 0, occupiedUnits: 0, submissionCount: 0, percentComplete: 0, missingUnits: [], missingSubmissions: [], vacantUnits: 0 };
              const assetId = buildingToAssetId[building] || '';
              const icon = stats.percentComplete === 100 ? '\u2705' : stats.percentComplete > 0 ? '\uD83D\uDFE1' : '\u26AA';
              return (
                <button
                  key={building}
                  onClick={() => onSelectBuilding(building)}
                  className={`w-full text-left px-3 py-2 text-xs border transition-colors duration-200 ease-out ${
                    selectedBuilding === building
                      ? 'bg-[var(--bg-section)] border-[var(--primary)] text-[var(--primary)]'
                      : 'bg-white border-[var(--divider)] hover:bg-[var(--bg-section)]'
                  }`}
                >
                  <div className="font-medium">{icon} {assetId} - {building}</div>
                  <div className="text-[var(--muted)] mt-1">
                    {stats.totalUnits} units | {stats.occupiedUnits} occ | {stats.submissionCount} sub ({stats.percentComplete}%)
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters — visible when a building is selected */}
        {selectedBuilding && !matrixLoading && (isProjectMode ? (projectColumns && projectColumns.length > 0) : matrixRows.length > 0) && (
          <div className={`${panelClass} p-3`}>
            <h3 className="text-sm font-semibold text-[var(--primary)] mb-3 border-b border-[var(--divider)] pb-2">Filters</h3>
            <MatrixFilterBar
              activeFilters={activeFilters}
              onToggleFilter={onToggleFilter}
              onClearFilters={onClearFilters}
              rows={matrixRows}
              mode={mode}
              projectColumns={projectColumns}
              projectRows={projectRows}
            />
          </div>
        )}
      </div>
    </div>
  );
}
