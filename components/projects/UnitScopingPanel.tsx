'use client';

import { useState, useMemo } from 'react';
import { buildings, buildingUnits } from '@/lib/buildings';

type ScopeMode = 'all' | 'by_building' | 'handpick';

interface UnitScopingPanelProps {
  selectedUnits: { building: string; unit_number: string }[];
  onChange: (units: { building: string; unit_number: string }[]) => void;
  disabled?: boolean;
}

export default function UnitScopingPanel({ selectedUnits, onChange, disabled }: UnitScopingPanelProps) {
  const [mode, setMode] = useState<ScopeMode>('all');
  const [selectedBuildings, setSelectedBuildings] = useState<Set<string>>(new Set());
  const [handpickSearch, setHandpickSearch] = useState('');

  const allUnits = useMemo(() => {
    const result: { building: string; unit_number: string }[] = [];
    for (const b of buildings) {
      const units = buildingUnits[b] || [];
      for (const u of units) {
        result.push({ building: b, unit_number: u });
      }
    }
    return result;
  }, []);

  const totalUnitCount = allUnits.length;

  const handleModeChange = (newMode: ScopeMode) => {
    setMode(newMode);
    if (newMode === 'all') {
      onChange(allUnits);
    } else if (newMode === 'by_building') {
      setSelectedBuildings(new Set());
      onChange([]);
    } else {
      onChange([]);
    }
  };

  const handleBuildingToggle = (building: string) => {
    const next = new Set(selectedBuildings);
    if (next.has(building)) {
      next.delete(building);
    } else {
      next.add(building);
    }
    setSelectedBuildings(next);
    const units: { building: string; unit_number: string }[] = [];
    for (const b of next) {
      for (const u of buildingUnits[b] || []) {
        units.push({ building: b, unit_number: u });
      }
    }
    onChange(units);
  };

  const handleUnitToggle = (building: string, unit_number: string) => {
    const key = `${building}||${unit_number}`;
    const exists = selectedUnits.some((u) => `${u.building}||${u.unit_number}` === key);
    if (exists) {
      onChange(selectedUnits.filter((u) => `${u.building}||${u.unit_number}` !== key));
    } else {
      onChange([...selectedUnits, { building, unit_number }]);
    }
  };

  const selectedSet = useMemo(() => {
    return new Set(selectedUnits.map((u) => `${u.building}||${u.unit_number}`));
  }, [selectedUnits]);

  const filteredUnits = useMemo(() => {
    if (!handpickSearch.trim()) return allUnits;
    const q = handpickSearch.toLowerCase();
    return allUnits.filter(
      (u) => u.building.toLowerCase().includes(q) || u.unit_number.toLowerCase().includes(q)
    );
  }, [allUnits, handpickSearch]);

  // On initial render with mode=all, push all units
  useMemo(() => {
    if (mode === 'all' && selectedUnits.length === 0) {
      onChange(allUnits);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={disabled ? 'opacity-60 pointer-events-none' : ''}>
      <div className="flex gap-2 mb-4">
        {(['all', 'by_building', 'handpick'] as ScopeMode[]).map((m) => {
          const labels: Record<ScopeMode, string> = { all: 'All Portfolio', by_building: 'By Building', handpick: 'Handpick' };
          return (
            <button
              key={m}
              type="button"
              onClick={() => handleModeChange(m)}
              className={`px-3 py-1.5 text-xs font-medium border rounded-none transition-colors duration-200 ${
                mode === m
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                  : 'bg-white text-[var(--ink)] border-[var(--border)] hover:bg-[var(--bg-section)]'
              }`}
            >
              {labels[m]}
            </button>
          );
        })}
      </div>

      <div className="text-sm text-[var(--muted)] mb-3">
        <strong className="text-[var(--ink)] font-sans">{selectedUnits.length}</strong> units selected
        {mode === 'all' && ` (${totalUnitCount} total)`}
      </div>

      {mode === 'by_building' && (
        <div className="border border-[var(--border)] max-h-64 overflow-y-auto">
          {buildings.map((b) => {
            const unitCount = (buildingUnits[b] || []).length;
            const isSelected = selectedBuildings.has(b);
            return (
              <label
                key={b}
                className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-[var(--bg-section)] border-b border-[var(--divider)] last:border-b-0 ${
                  isSelected ? 'bg-blue-50' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleBuildingToggle(b)}
                  className="rounded-none"
                />
                <span className="flex-1">{b}</span>
                <span className="text-xs text-[var(--muted)]">{unitCount} units</span>
              </label>
            );
          })}
        </div>
      )}

      {mode === 'handpick' && (
        <div>
          <input
            type="text"
            placeholder="Search buildings or units..."
            value={handpickSearch}
            onChange={(e) => setHandpickSearch(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm mb-2 focus:outline-none focus:border-[var(--primary)]"
          />
          <div className="border border-[var(--border)] max-h-64 overflow-y-auto">
            {filteredUnits.map((u) => {
              const key = `${u.building}||${u.unit_number}`;
              const isSelected = selectedSet.has(key);
              return (
                <label
                  key={key}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-[var(--bg-section)] border-b border-[var(--divider)] last:border-b-0 ${
                    isSelected ? 'bg-blue-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleUnitToggle(u.building, u.unit_number)}
                    className="rounded-none"
                  />
                  <span>{u.building}</span>
                  <span className="text-[var(--muted)]">—</span>
                  <span>{u.unit_number}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
