'use client';

import { useState, useMemo } from 'react';
import type { PortfolioBuildingStats, DynamicColumn, ProjectBuildingStats } from '@/types/compliance';
import { COMPLIANCE_COLUMNS } from '@/lib/complianceColumns';

interface PortfolioTableProps {
  rows: PortfolioBuildingStats[];
  selectedPortfolio: string;
  onSelectBuilding: (address: string) => void;
  // Project mode (optional — defaults to legacy)
  mode?: 'legacy' | 'project';
  projectColumns?: DynamicColumn[];
  projectBuildingStats?: ProjectBuildingStats[];
}

type SortKey = 'needs_attention' | 'asset_id' | 'submissions' | 'building';

function pct(n: number, d: number): number {
  return d === 0 ? -1 : Math.round((n / d) * 100);
}

function FractionCell({ num, den }: { num: number; den: number }) {
  if (den === 0) {
    return (
      <td className="px-2 py-2 text-center text-xs text-[var(--muted)] border border-[var(--divider)]">
        —
      </td>
    );
  }
  const p = pct(num, den);
  const tone =
    p >= 90
      ? 'bg-[var(--success)]/10 text-[var(--success)]'
      : p >= 50
      ? 'bg-[var(--warning)]/10 text-[var(--warning)]'
      : 'bg-[var(--error)]/10 text-[var(--error)]';
  return (
    <td className={`px-2 py-2 text-center text-xs font-medium border border-[var(--divider)] ${tone}`}>
      {num}/{den}
    </td>
  );
}

export default function PortfolioTable({ rows, selectedPortfolio, onSelectBuilding, mode = 'legacy', projectColumns, projectBuildingStats }: PortfolioTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('needs_attention');

  const filtered = useMemo(() => {
    let list = rows;
    if (selectedPortfolio !== 'all') {
      list = list.filter(r => r.portfolio === selectedPortfolio);
    }
    return list;
  }, [rows, selectedPortfolio]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    switch (sortKey) {
      case 'needs_attention':
        return copy.sort((a, b) => a.completion_score - b.completion_score);
      case 'asset_id':
        return copy.sort((a, b) => a.asset_id.localeCompare(b.asset_id));
      case 'submissions': {
        const subPct = (r: PortfolioBuildingStats) => pct(r.submissions, r.occupied_units);
        return copy.sort((a, b) => subPct(a) - subPct(b));
      }
      case 'building':
        return copy.sort((a, b) => a.building_address.localeCompare(b.building_address));
      default:
        return copy;
    }
  }, [filtered, sortKey]);

  const thClass = 'px-2 py-2 text-[10px] uppercase tracking-wide text-[var(--muted)] font-semibold text-center border border-[var(--divider)] bg-[var(--bg-section)] whitespace-nowrap cursor-pointer hover:text-[var(--ink)] transition-colors duration-200 ease-out';
  const thLeft = thClass.replace('text-center', 'text-left');

  // -----------------------------------------------------------------------
  // Project mode rendering
  // -----------------------------------------------------------------------
  if (mode === 'project' && projectColumns && projectBuildingStats) {
    const sortedPBS = [...projectBuildingStats].sort((a, b) => {
      const aPct = a.total_units > 0 ? a.complete_units / a.total_units : 0;
      const bPct = b.total_units > 0 ? b.complete_units / b.total_units : 0;
      return aPct - bPct;
    });

    return (
      <div className="space-y-3">
        <div className="overflow-x-auto border border-[var(--border)]">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className={thLeft}>Building</th>
                <th className={thClass}>Units</th>
                <th className={thClass}>Complete</th>
                {projectColumns.map(col => (
                  <th key={col.id} className={thClass}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedPBS.length === 0 && (
                <tr>
                  <td colSpan={3 + projectColumns.length} className="px-4 py-8 text-center text-[var(--muted)] border border-[var(--divider)]">
                    No buildings to display.
                  </td>
                </tr>
              )}
              {sortedPBS.map((row) => (
                <tr
                  key={row.building}
                  onClick={() => onSelectBuilding(row.building)}
                  className="bg-white hover:bg-[var(--bg-section)] cursor-pointer transition-colors duration-200 ease-out"
                >
                  <td className="px-2 py-2 text-xs font-medium text-[var(--primary)] border border-[var(--divider)] hover:underline whitespace-nowrap">
                    {row.building}
                  </td>
                  <td className="px-2 py-2 text-center text-xs text-[var(--muted)] border border-[var(--divider)]">
                    {row.total_units}
                  </td>
                  <FractionCell num={row.complete_units} den={row.total_units} />
                  {projectColumns.map(col => {
                    const s = row.columns[col.id];
                    return s ? <FractionCell key={col.id} num={s.complete} den={s.total} /> : (
                      <td key={col.id} className="px-2 py-2 text-center text-xs text-[var(--muted)] border border-[var(--divider)]">—</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-[var(--muted)]">
          {sortedPBS.length} building{sortedPBS.length !== 1 ? 's' : ''} shown. Click a row to open the building view.
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Legacy mode rendering (unchanged)
  // -----------------------------------------------------------------------
  return (
    <div className="space-y-3">
      {/* Sort controls */}
      <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
        <span className="font-medium">Sort:</span>
        {([
          ['needs_attention', 'Needs Attention'],
          ['asset_id', 'Asset ID'],
          ['submissions', 'Submissions'],
          ['building', 'Address'],
        ] as [SortKey, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSortKey(key)}
            className={`px-2 py-1 border rounded-none transition-colors duration-200 ease-out ${
              sortKey === key
                ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--primary)]/5'
                : 'border-[var(--divider)] hover:border-[var(--primary)]/50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto border border-[var(--border)]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className={thLeft} onClick={() => setSortKey('building')}>Building</th>
              <th className={thClass} onClick={() => setSortKey('asset_id')}>Asset ID</th>
              <th className={thClass} onClick={() => setSortKey('submissions')}>Submissions</th>
              {COMPLIANCE_COLUMNS.map(col => (
                <th key={col.id} className={thClass}>{col.label}</th>
              ))}
              <th className={thClass}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={3 + COMPLIANCE_COLUMNS.length} className="px-4 py-8 text-center text-[var(--muted)] border border-[var(--divider)]">
                  No buildings to display.
                </td>
              </tr>
            )}
            {sorted.map((row) => (
              <tr
                key={row.building_address}
                onClick={() => onSelectBuilding(row.building_address)}
                className="bg-white hover:bg-[var(--bg-section)] cursor-pointer transition-colors duration-200 ease-out"
              >
                <td className="px-2 py-2 text-xs font-medium text-[var(--primary)] border border-[var(--divider)] hover:underline whitespace-nowrap">
                  {row.building_address}
                </td>
                <td className="px-2 py-2 text-center text-xs text-[var(--muted)] border border-[var(--divider)] whitespace-nowrap">
                  {row.asset_id}
                </td>
                <FractionCell num={row.submissions} den={row.occupied_units} />
                {COMPLIANCE_COLUMNS.map(col => {
                  const s = row.columns[col.id];
                  return s ? <FractionCell key={col.id} num={s.complete} den={s.total} /> : (
                    <td key={col.id} className="px-2 py-2 text-center text-xs text-[var(--muted)] border border-[var(--divider)]">—</td>
                  );
                })}
                <td className="px-2 py-2 text-center text-xs border border-[var(--divider)]">
                  {row.unprocessed_notes_count > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[var(--warning)] font-medium">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2z" /></svg>
                      {row.unprocessed_notes_count}
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

      <div className="text-xs text-[var(--muted)]">
        {sorted.length} building{sorted.length !== 1 ? 's' : ''} shown. Click a row to open the building view.
      </div>
    </div>
  );
}
