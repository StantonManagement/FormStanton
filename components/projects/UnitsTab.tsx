'use client';

import { useState, useMemo } from 'react';
import type { ProjectUnit, OverallStatus } from '@/types/compliance';
import type { ProjectDetail } from '@/lib/useProjectDetail';
import UnitScopingPanel from './UnitScopingPanel';

const statusColors: Record<OverallStatus, string> = {
  not_started: 'bg-red-50 text-red-700 border-red-300',
  in_progress: 'bg-yellow-50 text-yellow-700 border-yellow-300',
  complete: 'bg-green-50 text-green-700 border-green-300',
  has_failure: 'bg-red-100 text-red-800 border-red-400',
};

const statusLabels: Record<OverallStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  complete: 'Complete',
  has_failure: 'Has Failure',
};

interface UnitsTabProps {
  project: ProjectDetail;
  units: ProjectUnit[];
  unitsLoading: boolean;
  selectedUnits: { building: string; unit_number: string }[];
  onSelectedUnitsChange: (units: { building: string; unit_number: string }[]) => void;
  onRegenerateToken: (unitId: string) => Promise<void>;
  onAddUnits?: (units: { building: string; unit_number: string }[]) => Promise<{ units_added: number; tasks_created: number }>;
}

export default function UnitsTab({
  project,
  units,
  unitsLoading,
  selectedUnits,
  onSelectedUnitsChange,
  onRegenerateToken,
  onAddUnits,
}: UnitsTabProps) {
  const isDraft = project.status === 'draft';
  const isActive = project.status === 'active';
  const [statusFilter, setStatusFilter] = useState<OverallStatus | 'all'>('all');
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [showAddUnits, setShowAddUnits] = useState(false);
  const [addUnitsSelection, setAddUnitsSelection] = useState<{ building: string; unit_number: string }[]>([]);
  const [addingUnits, setAddingUnits] = useState(false);

  const filteredUnits = useMemo(() => {
    if (statusFilter === 'all') return units;
    return units.filter((u) => u.overall_status === statusFilter);
  }, [units, statusFilter]);

  const handleRegenerate = async (unitId: string) => {
    setRegenerating(unitId);
    try {
      await onRegenerateToken(unitId);
    } catch (err) {
      console.error('Failed to regenerate token:', err);
    } finally {
      setRegenerating(null);
    }
  };

  const isTokenExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    const expires = new Date(expiresAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return expires < today;
  };

  if (isDraft) {
    return (
      <div className="bg-white border border-[var(--border)] p-6">
        <h3 className="font-serif text-lg text-[var(--primary)] mb-4">Select Units</h3>
        <p className="text-sm text-[var(--muted)] mb-4">
          Choose which units to include in this project. Unit selection is locked after activation.
        </p>
        <UnitScopingPanel
          selectedUnits={selectedUnits}
          onChange={onSelectedUnitsChange}
        />
      </div>
    );
  }

  const existingUnitSet = useMemo(() => {
    return new Set(units.map((u) => `${u.building}||${u.unit_number}`));
  }, [units]);

  const handleAddUnitsConfirm = async () => {
    if (!onAddUnits || addUnitsSelection.length === 0) return;
    setAddingUnits(true);
    try {
      const filtered = addUnitsSelection.filter(
        (u) => !existingUnitSet.has(`${u.building}||${u.unit_number}`)
      );
      if (filtered.length === 0) {
        setShowAddUnits(false);
        return;
      }
      await onAddUnits(filtered);
      setShowAddUnits(false);
      setAddUnitsSelection([]);
    } catch (err) {
      console.error('Failed to add units:', err);
    } finally {
      setAddingUnits(false);
    }
  };

  // Active/closed — show unit table
  return (
    <div className="bg-white border border-[var(--border)]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--divider)]">
        <div className="flex items-center gap-3">
          <h3 className="font-serif text-lg text-[var(--primary)]">
            Units ({units.length})
          </h3>
          {isActive && onAddUnits && (
            <button
              type="button"
              onClick={() => setShowAddUnits(true)}
              className="px-3 py-1.5 bg-[var(--primary)] text-white text-xs font-medium rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200"
            >
              + Add Units
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {(['all', 'not_started', 'in_progress', 'complete'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={`px-2.5 py-1 text-xs font-medium border rounded-none transition-colors duration-200 ${
                statusFilter === f
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                  : 'bg-white text-[var(--ink)] border-[var(--border)] hover:bg-[var(--bg-section)]'
              }`}
            >
              {f === 'all' ? 'All' : statusLabels[f]}
            </button>
          ))}
        </div>
      </div>

      {unitsLoading ? (
        <div className="py-12 text-center text-sm text-[var(--muted)]">Loading units...</div>
      ) : filteredUnits.length === 0 ? (
        <div className="py-12 text-center text-sm text-[var(--muted)]">No units found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--bg-section)] border-b border-[var(--divider)]">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Building</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Unit</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Language</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Tasks</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Token Expires</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUnits.map((unit) => {
                const completions = unit.task_completions || [];
                const done = completions.filter((c) => c.status === 'complete').length;
                const total = completions.length;
                const expired = isTokenExpired(unit.token_expires_at);

                return (
                  <tr key={unit.id} className="border-b border-[var(--divider)] hover:bg-[var(--bg-section)] transition-colors">
                    <td className="px-4 py-2.5 text-[var(--ink)]">{unit.building}</td>
                    <td className="px-4 py-2.5 text-[var(--ink)]">{unit.unit_number}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs uppercase font-medium text-[var(--muted)]">{unit.preferred_language}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-none ${statusColors[unit.overall_status]}`}>
                        {statusLabels[unit.overall_status]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs">
                        <span className="font-medium text-[var(--ink)]">{done}</span>
                        <span className="text-[var(--muted)]"> / {total}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {unit.token_expires_at ? (
                        <span className={`text-xs ${expired ? 'text-[var(--error)] font-medium' : 'text-[var(--muted)]'}`}>
                          {unit.token_expires_at}
                          {expired && ' (expired)'}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {expired && (
                        <button
                          type="button"
                          onClick={() => handleRegenerate(unit.id)}
                          disabled={regenerating === unit.id}
                          className="text-xs text-[var(--primary)] hover:text-[var(--primary-light)] font-medium disabled:opacity-50"
                        >
                          {regenerating === unit.id ? 'Regenerating...' : 'Regenerate Link'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAddUnits && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white border border-gray-300 w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--divider)]">
              <h3 className="font-serif text-xl">Add Units to Project</h3>
              <button
                onClick={() => { setShowAddUnits(false); setAddUnitsSelection([]); }}
                className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <p className="text-sm text-[var(--muted)] mb-3">
                Units already in this project are excluded. Select additional units to add.
              </p>
              <UnitScopingPanel
                selectedUnits={addUnitsSelection}
                onChange={setAddUnitsSelection}
              />
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--divider)]">
              <span className="text-sm text-[var(--muted)]">
                {addUnitsSelection.filter((u) => !existingUnitSet.has(`${u.building}||${u.unit_number}`)).length} new units selected
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowAddUnits(false); setAddUnitsSelection([]); }}
                  className="px-4 py-2 text-sm border border-[var(--border)] rounded-none hover:bg-[var(--bg-section)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddUnitsConfirm}
                  disabled={addingUnits || addUnitsSelection.filter((u) => !existingUnitSet.has(`${u.building}||${u.unit_number}`)).length === 0}
                  className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 disabled:opacity-50"
                >
                  {addingUnits ? 'Adding...' : 'Add Units'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
