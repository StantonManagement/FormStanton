'use client';

import { useState, useCallback, useMemo } from 'react';
import type { MatrixRow } from '@/types/compliance';
import { COMPLIANCE_COLUMNS } from '@/lib/complianceColumns';
import type { FeeColumnDef } from '@/lib/complianceColumns';
import MatrixDocumentCell from './MatrixDocumentCell';
import MatrixFeeCell from './MatrixFeeCell';
import MatrixStatusCell from './MatrixStatusCell';
import FeeEntryPopover from './FeeEntryPopover';

interface RowAction {
  text: string;
  level: 'red' | 'blue' | 'amber' | 'green';
  totalRemaining: number;
}

/** Compute the single most urgent next action for a row (registry-driven) */
function computeNextAction(row: MatrixRow): RowAction {
  if (row.missing) {
    return { text: '⚠ No submission', level: 'red', totalRemaining: 1 };
  }

  const actions = COMPLIANCE_COLUMNS
    .map(col => col.getAction(row))
    .filter((a): a is { text: string; level: 'red' | 'blue' | 'amber' } => a !== null);

  const allComplete = COMPLIANCE_COLUMNS.every(
    col => !col.isApplicable(row) || col.isComplete(row)
  );

  if (allComplete) {
    return { text: '✓ Complete', level: 'green', totalRemaining: 0 };
  }

  if (actions.length === 0) {
    return { text: 'Incomplete', level: 'amber', totalRemaining: 1 };
  }

  return {
    text: actions[0].text,
    level: actions[0].level,
    totalRemaining: actions.length,
  };
}

/** Count rows that have at least one action remaining */
export function countRowsWithActions(rows: MatrixRow[]): number {
  return rows.filter(r => !r.missing && computeNextAction(r).totalRemaining > 0).length;
}

interface BuildingMatrixTableProps {
  rows: MatrixRow[];
  onSelectTenant: (row: MatrixRow) => void;
  onRefresh: () => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onToast?: (message: string, onUndo?: () => void) => void;
}

interface PopoverState {
  submissionId: string;
  feeType: string;
  label: string;
  anchorRect: DOMRect;
  tenantName: string;
  unitNumber: string;
  defaultAmount: number | null;
}

export default function BuildingMatrixTable({ rows, onSelectTenant, onRefresh, selectedIds, onSelectionChange, onToast }: BuildingMatrixTableProps) {
  const [popover, setPopover] = useState<PopoverState | null>(null);

  const selectableRows = useMemo(() => rows.filter(r => !r.missing && r.submission_id), [rows]);
  const allSelected = selectableRows.length > 0 && selectableRows.every(r => selectedIds.has(r.submission_id!));

  const toggleAll = useCallback(() => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(selectableRows.map(r => r.submission_id!)));
    }
  }, [allSelected, selectableRows, onSelectionChange]);

  const toggleOne = useCallback((id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectionChange(next);
  }, [selectedIds, onSelectionChange]);

  const getTenantName = useCallback((row: MatrixRow) => row.full_name || row.tenant_lookup_name || 'Unknown', []);

  const handleOpenFeePopover = useCallback((col: FeeColumnDef, row: MatrixRow, anchorRect: DOMRect) => {
    if (!row.submission_id) return;
    const props = col.getFeeCellProps(row);
    setPopover({
      submissionId: row.submission_id,
      feeType: col.feeType,
      label: `${col.label} — ${getTenantName(row)}`,
      anchorRect,
      tenantName: getTenantName(row),
      unitNumber: row.unit_number,
      defaultAmount: props.calculatedFee,
    });
  }, [getTenantName]);

  const handlePopoverSuccess = useCallback(() => {
    setPopover(null);
    onRefresh();
  }, [onRefresh]);

  const sortedRows = useMemo(() => {
    const withSubmission = rows.filter(r => !r.missing);
    const withoutSubmission = rows.filter(r => r.missing);
    return [...withSubmission, ...withoutSubmission];
  }, [rows]);

  const thClass = 'px-2 py-2 text-[10px] uppercase tracking-wide text-[var(--muted)] font-semibold text-left border border-[var(--divider)] bg-[var(--bg-section)] whitespace-nowrap';

  return (
    <>
      <div className="overflow-x-auto border border-[var(--border)]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className={`${thClass} text-center w-8`}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="accent-[var(--primary)] cursor-pointer"
                  title={allSelected ? 'Deselect all' : 'Select all'}
                />
              </th>
              <th className={thClass}>Unit</th>
              <th className={thClass}>Tenant</th>
              <th className={`${thClass} text-center`}>Status</th>
              {COMPLIANCE_COLUMNS.map(col => (
                <th key={col.id} className={`${thClass} text-center`}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={4 + COMPLIANCE_COLUMNS.length} className="px-4 py-8 text-center text-[var(--muted)] border border-[var(--divider)]">
                  No units to display.
                </td>
              </tr>
            )}
            {sortedRows.map((row) => {
              const isMissing = row.missing;
              const action = computeNextAction(row);
              const rowBg = isMissing
                ? 'bg-[var(--bg-section)]'
                : action.level === 'green'
                  ? 'bg-[var(--bg-section)]/50'
                  : action.level === 'red'
                    ? 'bg-[var(--error)]/5'
                    : 'bg-white hover:bg-[var(--bg-section)]';

              return (
                <tr key={row.unit_number} className={`${rowBg} transition-colors duration-200 ease-out ${!isMissing && row.submission_id && selectedIds.has(row.submission_id) ? 'ring-1 ring-inset ring-[var(--primary)]/30' : ''}`}>
                  {/* Checkbox */}
                  <td className="px-2 py-1.5 text-center border border-[var(--divider)] w-8">
                    {!isMissing && row.submission_id ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.submission_id)}
                        onChange={() => toggleOne(row.submission_id!)}
                        className="accent-[var(--primary)] cursor-pointer"
                      />
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </td>
                  {/* Unit */}
                  <td className="px-2 py-1.5 text-xs font-medium text-[var(--ink)] border border-[var(--divider)] whitespace-nowrap">
                    {row.unit_number}
                  </td>

                  {/* Status */}
                  <td className={`px-2 py-1.5 border border-[var(--divider)] text-xs whitespace-nowrap ${
                    isMissing ? 'text-[var(--muted)]' :
                    action.level === 'red' ? 'text-[var(--error)] font-medium border-l-2 border-l-[var(--error)]' :
                    action.level === 'blue' ? 'text-[var(--primary)] font-medium border-l-2 border-l-[var(--primary)]' :
                    action.level === 'amber' ? 'text-[var(--warning)] font-medium border-l-2 border-l-[var(--warning)]' :
                    'text-[var(--success)]'
                  }`}>
                    {action.totalRemaining > 1 && (
                      <span className={`text-[var(--muted)] mr-1 ${action.totalRemaining >= 4 ? 'font-semibold' : 'font-normal'}`}>
                        {action.totalRemaining} {action.totalRemaining === 1 ? 'task' : 'tasks'} left ·
                      </span>
                    )}
                    {action.text}
                  </td>

                  {/* Tenant name + submission summary */}
                  <td className="px-2 py-1.5 border border-[var(--divider)]">
                    {isMissing ? (
                      <button
                        onClick={() => onSelectTenant(row)}
                        className="text-xs text-[var(--error)] hover:underline transition-colors duration-200 ease-out text-left"
                      >
                        {row.tenant_lookup_name || '[No submission]'}
                      </button>
                    ) : (
                      <button
                        onClick={() => onSelectTenant(row)}
                        className="text-left group"
                      >
                        <div className="text-xs text-[var(--primary)] group-hover:text-[var(--primary-light)] group-hover:underline transition-colors duration-200 ease-out font-medium">
                          {row.full_name || '—'}
                        </div>
                        {(row.vehicle_summary || row.pet_summary || row.insurance_summary) && (
                          <div className="text-[10px] text-[var(--muted)] mt-0.5 leading-tight">
                            {[row.vehicle_summary, row.pet_summary, row.insurance_summary].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </button>
                    )}
                  </td>

                  {/* Compliance columns — registry-driven */}
                  {COMPLIANCE_COLUMNS.map(col => {
                    switch (col.cellType) {
                      case 'doc': {
                        const dp = col.getDocCellProps(row);
                        return (
                          <MatrixDocumentCell
                            key={col.id}
                            applicable={col.isApplicable(row)}
                            filePath={dp.filePath}
                            uploadedToAppfolio={dp.uploadedToAppfolio}
                            uploadedBy={dp.uploadedBy}
                            uploadedAt={dp.uploadedAt}
                            submissionId={row.submission_id}
                            documentType={dp.documentType}
                            missing={isMissing}
                            onRefresh={onRefresh}
                            tenantName={getTenantName(row)}
                            unitNumber={row.unit_number}
                            onToast={onToast}
                          />
                        );
                      }
                      case 'fee': {
                        const fp = col.getFeeCellProps(row);
                        return (
                          <MatrixFeeCell
                            key={col.id}
                            applicable={col.isApplicable(row)}
                            feeLoaded={fp.feeLoaded}
                            feeAmount={fp.feeAmount}
                            loadedBy={fp.loadedBy}
                            loadedAt={fp.loadedAt}
                            missing={isMissing}
                            onOpenPopover={(rect) => handleOpenFeePopover(col, row, rect)}
                            submissionId={row.submission_id}
                            feeType={col.feeType}
                            tenantName={getTenantName(row)}
                            unitNumber={row.unit_number}
                            onToast={onToast}
                            onRefresh={onRefresh}
                            calculatedFee={fp.calculatedFee}
                          />
                        );
                      }
                      case 'status': {
                        const sp = col.getStatusCellProps(row);
                        return (
                          <MatrixStatusCell
                            key={col.id}
                            applicable={col.isApplicable(row)}
                            done={sp.done}
                            missing={isMissing}
                            doneLabel={sp.doneLabel}
                            pendingLabel={sp.pendingLabel}
                            auditBy={sp.auditBy}
                            auditAt={sp.auditAt}
                          />
                        );
                      }
                    }
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Fee entry popover */}
      {popover && (
        <FeeEntryPopover
          submissionId={popover.submissionId}
          feeType={popover.feeType}
          label={popover.label}
          onSuccess={handlePopoverSuccess}
          onClose={() => setPopover(null)}
          anchorRect={popover.anchorRect}
          tenantName={popover.tenantName}
          unitNumber={popover.unitNumber}
          defaultAmount={popover.defaultAmount}
        />
      )}
    </>
  );
}
