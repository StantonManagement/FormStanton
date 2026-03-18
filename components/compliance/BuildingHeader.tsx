'use client';

import type { BuildingMatrixStats } from '@/types/compliance';
import { buildingToAssetId, buildingParkingSpots } from '@/lib/buildingAssetIds';
import { buildingToPortfolio } from '@/lib/portfolios';

interface BuildingHeaderProps {
  buildingAddress: string;
  stats: BuildingMatrixStats;
  onAddTenant: () => void;
}

export default function BuildingHeader({ buildingAddress, stats, onAddTenant }: BuildingHeaderProps) {
  const assetId = buildingToAssetId[buildingAddress] || '—';
  const portfolio = buildingToPortfolio[buildingAddress] || '—';
  const parking = buildingParkingSpots[buildingAddress];
  const parkingLabel = parking === undefined ? 'N/A' : typeof parking === 'number' ? `${parking} spots` : parking;

  const submissionPct = stats.occupied_units > 0
    ? Math.round((stats.submissions / stats.occupied_units) * 100)
    : 0;

  const pills: Array<{ label: string; value: string; tone: 'good' | 'attention' | 'critical' | 'neutral' }> = [
    {
      label: 'Submissions',
      value: `${stats.submissions}/${stats.occupied_units}`,
      tone: submissionPct >= 90 ? 'good' : submissionPct >= 50 ? 'attention' : 'critical',
    },
    ...(stats.vehicle_docs_total > 0 ? [{
      label: 'Vehicle Docs',
      value: `${stats.vehicle_docs_uploaded}/${stats.vehicle_docs_total}`,
      tone: (stats.vehicle_docs_uploaded === stats.vehicle_docs_total ? 'good'
        : stats.vehicle_docs_uploaded > 0 ? 'attention' : 'critical') as 'good' | 'attention' | 'critical',
    }] : []),
    ...(stats.pet_docs_total > 0 ? [{
      label: 'Pet Docs',
      value: `${stats.pet_docs_uploaded}/${stats.pet_docs_total}`,
      tone: (stats.pet_docs_uploaded === stats.pet_docs_total ? 'good'
        : stats.pet_docs_uploaded > 0 ? 'attention' : 'critical') as 'good' | 'attention' | 'critical',
    }] : []),
    ...(stats.insurance_total > 0 ? [{
      label: 'Insurance',
      value: `${stats.insurance_uploaded}/${stats.insurance_total}`,
      tone: (stats.insurance_uploaded === stats.insurance_total ? 'good'
        : stats.insurance_uploaded > 0 ? 'attention' : 'critical') as 'good' | 'attention' | 'critical',
    }] : []),
    {
      label: 'Missing',
      value: `${stats.missing_submissions}`,
      tone: stats.missing_submissions === 0 ? 'good' : 'critical',
    },
  ];

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
