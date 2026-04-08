'use client';

import type { PortfolioStat } from '@/lib/useComplianceData';

interface ProjectOption {
  id: string;
  name: string;
  status: string;
}

interface DashboardHeaderProps {
  portfolioStats: PortfolioStat[];
  onOpenExportCenter: () => void;
  projects?: ProjectOption[];
  selectedProject?: string;
  onSelectProject?: (id: string) => void;
}

export default function DashboardHeader({ portfolioStats, onOpenExportCenter, projects, selectedProject, onSelectProject }: DashboardHeaderProps) {
  return (
    <div className="bg-white border-b border-[var(--divider)] shadow-sm">
      <div className="px-4 py-1.5 lg:px-8 lg:py-4">
        <div className="flex items-center justify-between gap-3 lg:gap-6">
          <div className="flex-shrink-0">
            <h1 className="text-base font-semibold font-serif text-[var(--primary)] lg:text-3xl">Compliance Dashboard</h1>
            <p className="hidden lg:block text-sm text-[var(--muted)] mt-1 tracking-wide">Building-by-building review and verification</p>
          </div>
          {projects && projects.length > 0 && onSelectProject && (
            <div className="flex-shrink-0">
              <select
                value={selectedProject || 'legacy'}
                onChange={(e) => onSelectProject(e.target.value)}
                className="px-2 py-1 lg:px-3 lg:py-2 border border-[var(--border)] rounded-none bg-[var(--bg-input)] text-[var(--ink)] text-xs lg:text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20 transition-colors duration-200 ease-out max-w-[160px] lg:max-w-[260px]"
              >
                <option value="legacy">Legacy: Feb 2025 Onboarding</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.status !== 'active' ? ` (${p.status})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-2 lg:gap-3 flex-1 justify-center overflow-x-auto">
            {portfolioStats.map(stat => (
              <div key={stat.name} className="px-2 py-1 lg:px-3 lg:py-2 bg-[var(--bg-section)] border border-[var(--divider)] flex-shrink-0">
                {/* Compact single-line (zoomed / small viewport) */}
                <div className="block lg:hidden text-xs font-semibold text-[var(--primary)] whitespace-nowrap">
                  {stat.name} · {stat.buildingCount}{stat.buildingCount === 1 ? 'b' : 'b'} · {stat.totalUnits}u
                </div>
                {/* Expanded multi-line (normal zoom) */}
                <div className="hidden lg:block">
                  <div className="text-xs font-semibold text-[var(--primary)]">{stat.name}</div>
                  <div className="text-xs text-[var(--muted)] mt-0.5">{stat.buildingCount} {stat.buildingCount === 1 ? 'bldg' : 'bldgs'}</div>
                  <div className="text-xs text-[var(--ink)] mt-0.5 font-medium">
                    {stat.totalUnits} units | {stat.occupiedUnits} occ | {stat.totalSubmissions} sub
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 lg:gap-2 flex-shrink-0">
            <a href="/admin" className="px-2 py-1 lg:px-3 lg:py-2 bg-white text-[var(--primary)] border border-[var(--border)] rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out text-xs font-medium whitespace-nowrap">Back</a>
            <a href="/admin?view=onboarding" className="px-2 py-1 lg:px-3 lg:py-2 bg-white text-[var(--primary)] border border-[var(--border)] rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out text-xs font-medium whitespace-nowrap">Raw Data</a>
            <button onClick={onOpenExportCenter} className="px-2 py-1 lg:px-3 lg:py-2 bg-[var(--primary)] text-white border border-[var(--primary)] rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out text-xs font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed">Export</button>
          </div>
        </div>
      </div>
    </div>
  );
}
