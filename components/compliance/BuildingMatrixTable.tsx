'use client';

import { useState, useCallback, useMemo } from 'react';
import type { MatrixRow } from '@/types/compliance';
import MatrixDocumentCell from './MatrixDocumentCell';
import MatrixFeeCell from './MatrixFeeCell';
import MatrixStatusCell from './MatrixStatusCell';
import FeeEntryPopover from './FeeEntryPopover';

interface RowAction {
  text: string;
  level: 'red' | 'blue' | 'amber' | 'green';
  totalRemaining: number;
}

/** Compute the single most urgent next action for a row */
function computeNextAction(row: MatrixRow): RowAction {
  // Priority 1: Missing submission
  if (row.missing) {
    return { text: '⚠ No submission', level: 'red', totalRemaining: 1 };
  }

  // Collect all remaining actions in priority order
  const actions: Array<{ text: string; level: 'red' | 'blue' | 'amber' }> = [];

  // Priority 2: Doc applicable but no file in system (red — gap we need to chase)
  if (row.has_vehicle && !row.vehicle_addendum_file) {
    actions.push({ text: '⚠ Missing vehicle doc', level: 'red' });
  }
  if (row.has_pets && !row.pet_addendum_file) {
    actions.push({ text: '⚠ Missing pet doc', level: 'red' });
  }
  if (row.has_insurance && !row.insurance_file) {
    actions.push({ text: '⚠ Missing insurance doc', level: 'red' });
  }

  // Priority 3: Doc exists, not uploaded to AF (blue — actionable)
  if (row.has_vehicle && row.vehicle_addendum_file && !row.vehicle_addendum_uploaded_to_appfolio) {
    actions.push({ text: 'Upload vehicle doc to AppFolio', level: 'blue' });
  }
  if (row.has_pets && row.pet_addendum_file && !row.pet_addendum_uploaded_to_appfolio) {
    actions.push({ text: 'Upload pet doc to AppFolio', level: 'blue' });
  }
  if (row.has_insurance && row.insurance_file && !row.insurance_uploaded_to_appfolio) {
    actions.push({ text: 'Upload insurance to AppFolio', level: 'blue' });
  }

  // Priority 4: Fee not loaded (blue)
  if (row.has_pets && !row.pet_fee_added_to_appfolio) {
    const amt = row.calculated_pet_fee;
    actions.push({ text: amt != null ? `Load pet fee $${amt} in AppFolio` : 'Load pet fee in AppFolio (amount TBD)', level: 'blue' });
  }
  if (row.requires_parking_permit && !row.permit_fee_added_to_appfolio) {
    const amt = row.calculated_permit_fee;
    actions.push({ text: amt != null ? `Load permit fee $${amt} in AppFolio` : 'Load permit fee in AppFolio (amount TBD)', level: 'blue' });
  }

  // Priority 5: Permit not issued (amber)
  if (row.requires_parking_permit && !row.permit_issued) {
    actions.push({ text: 'Issue permit', level: 'amber' });
  }

  // Priority 6: All done - verify EVERYTHING applicable is complete
  // Documents: all applicable docs must be received AND uploaded
  const docsComplete = 
    (!row.has_vehicle || (row.vehicle_addendum_file && row.vehicle_addendum_uploaded_to_appfolio)) &&
    (!row.has_pets || (row.pet_addendum_file && row.pet_addendum_uploaded_to_appfolio)) &&
    (!row.has_insurance || (row.insurance_file && row.insurance_uploaded_to_appfolio));

  // Fees: all applicable fees must be loaded
  const feesComplete =
    (!row.has_pets || row.pet_fee_added_to_appfolio) &&
    (!row.requires_parking_permit || row.permit_fee_added_to_appfolio);

  // Permits: if parking permit required, permit must be issued
  const permitsComplete = !row.requires_parking_permit || row.permit_issued;

  if (docsComplete && feesComplete && permitsComplete) {
    return { text: '✓ Complete', level: 'green', totalRemaining: 0 };
  }

  // If we get here, something is incomplete but not in the actions array (shouldn't happen)
  // Fall back to showing the first action or a generic incomplete message
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
  feeType: 'pet_rent' | 'permit_fee';
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

  const handleOpenPetFeePopover = useCallback((row: MatrixRow, anchorRect: DOMRect) => {
    if (!row.submission_id) return;
    setPopover({
      submissionId: row.submission_id,
      feeType: 'pet_rent',
      label: `Pet Fee — ${getTenantName(row)}`,
      anchorRect,
      tenantName: getTenantName(row),
      unitNumber: row.unit_number,
      defaultAmount: row.calculated_pet_fee,
    });
  }, [getTenantName]);

  const handleOpenPermitFeePopover = useCallback((row: MatrixRow, anchorRect: DOMRect) => {
    if (!row.submission_id) return;
    setPopover({
      submissionId: row.submission_id,
      feeType: 'permit_fee',
      label: `Permit Fee — ${getTenantName(row)}`,
      anchorRect,
      tenantName: getTenantName(row),
      unitNumber: row.unit_number,
      defaultAmount: row.calculated_permit_fee,
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
              <th className={`${thClass} text-center`}>Vehicle Doc</th>
              <th className={`${thClass} text-center`}>Pet Doc</th>
              <th className={`${thClass} text-center`}>Insurance</th>
              <th className={`${thClass} text-center`}>Pet Fee</th>
              <th className={`${thClass} text-center`}>Permit Fee</th>
              <th className={`${thClass} text-center`}>Permit</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-[var(--muted)] border border-[var(--divider)]">
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

                  {/* Vehicle Doc */}
                  <MatrixDocumentCell
                    applicable={row.has_vehicle}
                    filePath={row.vehicle_addendum_file}
                    uploadedToAppfolio={row.vehicle_addendum_uploaded_to_appfolio}
                    uploadedBy={row.vehicle_addendum_uploaded_to_appfolio_by}
                    uploadedAt={row.vehicle_addendum_uploaded_to_appfolio_at}
                    submissionId={row.submission_id}
                    documentType="vehicle_addendum"
                    missing={isMissing}
                    onRefresh={onRefresh}
                    tenantName={getTenantName(row)}
                    unitNumber={row.unit_number}
                    onToast={onToast}
                  />

                  {/* Pet Doc */}
                  <MatrixDocumentCell
                    applicable={row.has_pets}
                    filePath={row.pet_addendum_file}
                    uploadedToAppfolio={row.pet_addendum_uploaded_to_appfolio}
                    uploadedBy={row.pet_addendum_uploaded_to_appfolio_by}
                    uploadedAt={row.pet_addendum_uploaded_to_appfolio_at}
                    submissionId={row.submission_id}
                    documentType="pet_addendum"
                    missing={isMissing}
                    onRefresh={onRefresh}
                    tenantName={getTenantName(row)}
                    unitNumber={row.unit_number}
                    onToast={onToast}
                  />

                  {/* Insurance */}
                  <MatrixDocumentCell
                    applicable={row.has_insurance}
                    filePath={row.insurance_file}
                    uploadedToAppfolio={row.insurance_uploaded_to_appfolio}
                    uploadedBy={row.insurance_uploaded_to_appfolio_by}
                    uploadedAt={row.insurance_uploaded_to_appfolio_at}
                    submissionId={row.submission_id}
                    documentType="insurance"
                    missing={isMissing}
                    onRefresh={onRefresh}
                    tenantName={getTenantName(row)}
                    unitNumber={row.unit_number}
                    onToast={onToast}
                  />

                  {/* Pet Fee */}
                  <MatrixFeeCell
                    applicable={row.has_pets}
                    feeLoaded={row.pet_fee_added_to_appfolio}
                    feeAmount={row.pet_fee_amount}
                    loadedBy={row.pet_fee_added_to_appfolio_by}
                    loadedAt={row.pet_fee_added_to_appfolio_at}
                    missing={isMissing}
                    onOpenPopover={(rect) => handleOpenPetFeePopover(row, rect)}
                    submissionId={row.submission_id}
                    feeType="pet_rent"
                    tenantName={getTenantName(row)}
                    unitNumber={row.unit_number}
                    onToast={onToast}
                    onRefresh={onRefresh}
                    calculatedFee={row.calculated_pet_fee}
                  />

                  {/* Permit Fee */}
                  <MatrixFeeCell
                    applicable={row.requires_parking_permit}
                    feeLoaded={row.permit_fee_added_to_appfolio}
                    feeAmount={row.permit_fee_amount}
                    loadedBy={row.permit_fee_added_to_appfolio_by}
                    loadedAt={row.permit_fee_added_to_appfolio_at}
                    missing={isMissing}
                    onOpenPopover={(rect) => handleOpenPermitFeePopover(row, rect)}
                    submissionId={row.submission_id}
                    feeType="permit_fee"
                    tenantName={getTenantName(row)}
                    unitNumber={row.unit_number}
                    onToast={onToast}
                    onRefresh={onRefresh}
                    calculatedFee={row.calculated_permit_fee}
                  />

                  {/* Permit Issued */}
                  <MatrixStatusCell
                    applicable={row.requires_parking_permit}
                    done={row.permit_issued}
                    missing={isMissing}
                    doneLabel="✓ Issued"
                    pendingLabel="Pending"
                    auditBy={row.permit_issued_by}
                    auditAt={row.permit_issued_at}
                  />
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
