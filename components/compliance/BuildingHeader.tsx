'use client';

import type { BuildingMatrixStats, DynamicColumn, ProjectBuildingStats } from '@/types/compliance';
import { buildingToAssetId, buildingParkingSpots } from '@/lib/buildingAssetIds';
import { buildingToPortfolio } from '@/lib/portfolios';
import { COMPLIANCE_COLUMNS } from '@/lib/complianceColumns';

interface BuildingHeaderProps {
  buildingAddress: string;
  stats: BuildingMatrixStats;
  onAddTenant: () => void;
  // Project mode (optional — defaults to legacy)
  mode?: 'legacy' | 'project';
  projectColumns?: DynamicColumn[];
  projectBuildingStats?: ProjectBuildingStats;
}

export default function BuildingHeader({ buildingAddress, stats, onAddTenant, mode = 'legacy', projectColumns, projectBuildingStats }: BuildingHeaderProps) {
  const assetId = buildingToAssetId[buildingAddress] || '—';
  const portfolio = buildingToPortfolio[buildingAddress] || '—';
  const parking = buildingParkingSpots[buildingAddress];
  const parkingLabel = parking === undefined ? 'N/A' : typeof parking === 'number' ? `${parking} spots` : parking;

  const submissionPct = stats.occupied_units > 0
    ? Math.round((stats.submissions / stats.occupied_units) * 100)
    : 0;

  type Tone = 'good' | 'attention' | 'critical' | 'neutral';
  type Pill = { label: string; value: string; tone: Tone };

  const pills: Pill[] = [];

  if (mode === 'project' && projectColumns && projectBuildingStats) {
    pills.push({
      label: 'Units Complete',
      value: `${projectBuildingStats.complete_units}/${projectBuildingStats.total_units}`,
      tone: projectBuildingStats.complete_units === projectBuildingStats.total_units ? 'good'
        : projectBuildingStats.complete_units > 0 ? 'attention' : 'critical',
    });
    for (const col of projectColumns) {
      const s = projectBuildingStats.columns[col.id];
      if (!s || s.total === 0) continue;
      pills.push({
        label: col.label,
        value: `${s.complete}/${s.total}`,
        tone: s.complete === s.total ? 'good' : s.complete > 0 ? 'attention' : 'critical',
      });
    }
  } else {
    pills.push({
      label: 'Submissions',
      value: `${stats.submissions}/${stats.occupied_units}`,
      tone: submissionPct >= 90 ? 'good' : submissionPct >= 50 ? 'attention' : 'critical',
    });

    for (const col of COMPLIANCE_COLUMNS) {
      const s = stats.columns[col.id];
      if (!s || s.total === 0) continue;
      pills.push({
        label: col.label,
        value: `${s.complete}/${s.total}`,
        tone: s.complete === s.total ? 'good' : s.complete > 0 ? 'attention' : 'critical',
      });
    }

    pills.push({
      label: 'Missing',
      value: `${stats.missing_submissions}`,
      tone: stats.missing_submissions === 0 ? 'good' : 'critical',
    });
  }

  const toneClasses: Record<string, string> = {
    good: 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/35',
    attention: 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/35',
    critical: 'bg-[var(--error)]/10 text-[var(--error)] border-[var(--error)]/35',
    neutral: 'bg-[var(--bg-section)] text-[var(--muted)] border-[var(--divider)]',
  };

  return (
    <div className="bg-white border border-[var(--border)] shadow-sm p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-serif text-[var(--primary)]">{buildingAddress}</h2>
          <div className="flex items-center gap-4 mt-2 text-sm text-[var(--muted)]">
            <span>Asset ID: {assetId}</span>
            <span>·</span>
            <span>Portfolio: {portfolio}</span>
            <span>·</span>
            <span>Parking: {parkingLabel}</span>
          </div>
        </div>
        <button
          onClick={onAddTenant}
          className="px-4 py-2 bg-[var(--success)] text-white border border-[var(--success)] rounded-none hover:opacity-90 transition-colors duration-200 ease-out text-sm font-medium"
        >
          + Add Tenant
        </button>
      </div>

      {/* Stat pills */}
      <div className="mt-4 flex flex-wrap gap-2">
        {pills.map(pill => (
          <div
            key={pill.label}
            className={`px-3 py-1.5 text-xs font-medium border ${toneClasses[pill.tone]}`}
          >
            {pill.label}: {pill.value}
          </div>
        ))}
      </div>
    </div>
  );
}
