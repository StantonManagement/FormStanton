'use client';

import { useState, useMemo } from 'react';
import type { PortfolioBuildingStats } from '@/types/compliance';

interface PortfolioTableProps {
  rows: PortfolioBuildingStats[];
  selectedPortfolio: string;
  onSelectBuilding: (address: string) => void;
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

export default function PortfolioTable({ rows, selectedPortfolio, onSelectBuilding }: PortfolioTableProps) {
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
              <th className={thClass}>Vehicle Docs</th>
              <th className={thClass}>Pet Docs</th>
              <th className={thClass}>Insurance</th>
              <th className={thClass}>Pet Fees</th>
              <th className={thClass}>Permit Fees</th>
              <th className={thClass}>Permits</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[var(--muted)] border border-[var(--divider)]">
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
                <FractionCell num={row.vehicle_docs_uploaded} den={row.vehicle_docs_total} />
                <FractionCell num={row.pet_docs_uploaded} den={row.pet_docs_total} />
                <FractionCell num={row.insurance_uploaded} den={row.insurance_total} />
                <FractionCell num={row.pet_fees_loaded} den={row.pet_fees_total} />
                <FractionCell num={row.permit_fees_loaded} den={row.permit_fees_total} />
                <FractionCell num={row.permits_issued} den={row.permits_total} />
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
