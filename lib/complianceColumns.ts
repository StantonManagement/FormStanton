import type { MatrixRow } from '@/types/compliance';

// ---------------------------------------------------------------------------
// ComplianceRecord — minimal shared interface
// Both MatrixRow and raw TenantSubmission objects satisfy this contract,
// so the registry functions work on either without casting.
// ---------------------------------------------------------------------------

export interface ComplianceRecord {
  has_vehicle: boolean;
  has_pets: boolean;
  has_insurance: boolean;
  requires_parking_permit: boolean;
  vehicle_addendum_file: string | null;
  vehicle_addendum_uploaded_to_appfolio: boolean;
  pet_addendum_file: string | null;
  pet_addendum_uploaded_to_appfolio: boolean;
  insurance_file: string | null;
  insurance_uploaded_to_appfolio: boolean;
  pet_fee_added_to_appfolio: boolean;
  permit_fee_added_to_appfolio: boolean;
  permit_issued: boolean;
  calculated_pet_fee: number | null;
  calculated_permit_fee: number | null;
}

// ---------------------------------------------------------------------------
// ColumnStat — aggregate stat for one column (used by stats types)
// ---------------------------------------------------------------------------

export interface ColumnStat {
  complete: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Column definition types (discriminated union by cellType)
// ---------------------------------------------------------------------------

export type ActionLevel = 'red' | 'blue' | 'amber';

interface BaseColumnDef {
  id: string;
  label: string;
  priority: number;
  isApplicable: (rec: ComplianceRecord) => boolean;
  isComplete: (rec: ComplianceRecord) => boolean;
  getAction: (rec: ComplianceRecord) => { text: string; level: ActionLevel } | null;
}

export interface DocColumnDef extends BaseColumnDef {
  cellType: 'doc';
  getDocCellProps: (row: MatrixRow) => {
    filePath: string | null;
    uploadedToAppfolio: boolean;
    uploadedBy: string | null;
    uploadedAt: string | null;
    documentType: string;
  };
}

export interface FeeColumnDef extends BaseColumnDef {
  cellType: 'fee';
  feeType: string;
  getFeeCellProps: (row: MatrixRow) => {
    feeLoaded: boolean;
    feeAmount: number | null;
    loadedBy: string | null;
    loadedAt: string | null;
    calculatedFee: number | null;
  };
}

export interface StatusColumnDef extends BaseColumnDef {
  cellType: 'status';
  getStatusCellProps: (row: MatrixRow) => {
    done: boolean;
    doneLabel: string;
    pendingLabel: string;
    auditBy: string | null;
    auditAt: string | null;
  };
}

export type ComplianceColumnDef = DocColumnDef | FeeColumnDef | StatusColumnDef;

// ---------------------------------------------------------------------------
// The registry — single source of truth for all compliance columns
// ---------------------------------------------------------------------------

export const COMPLIANCE_COLUMNS: ComplianceColumnDef[] = [
  // --- Documents (priority 1 = red when missing, blue when needs upload) ---
  {
    id: 'vehicle_doc',
    label: 'Vehicle Doc',
    cellType: 'doc',
    priority: 1,
    isApplicable: (rec) => rec.has_vehicle,
    isComplete: (rec) => !!(rec.vehicle_addendum_file && rec.vehicle_addendum_uploaded_to_appfolio),
    getAction: (rec) => {
      if (!rec.has_vehicle) return null;
      if (!rec.vehicle_addendum_file) return { text: '⚠ Missing vehicle doc', level: 'red' };
      if (!rec.vehicle_addendum_uploaded_to_appfolio) return { text: 'Upload vehicle doc to AppFolio', level: 'blue' };
      return null;
    },
    getDocCellProps: (row) => ({
      filePath: row.vehicle_addendum_file,
      uploadedToAppfolio: row.vehicle_addendum_uploaded_to_appfolio,
      uploadedBy: row.vehicle_addendum_uploaded_to_appfolio_by,
      uploadedAt: row.vehicle_addendum_uploaded_to_appfolio_at,
      documentType: 'vehicle_addendum',
    }),
  },
  {
    id: 'pet_doc',
    label: 'Pet Doc',
    cellType: 'doc',
    priority: 1,
    isApplicable: (rec) => rec.has_pets,
    isComplete: (rec) => !!(rec.pet_addendum_file && rec.pet_addendum_uploaded_to_appfolio),
    getAction: (rec) => {
      if (!rec.has_pets) return null;
      if (!rec.pet_addendum_file) return { text: '⚠ Missing pet doc', level: 'red' };
      if (!rec.pet_addendum_uploaded_to_appfolio) return { text: 'Upload pet doc to AppFolio', level: 'blue' };
      return null;
    },
    getDocCellProps: (row) => ({
      filePath: row.pet_addendum_file,
      uploadedToAppfolio: row.pet_addendum_uploaded_to_appfolio,
      uploadedBy: row.pet_addendum_uploaded_to_appfolio_by,
      uploadedAt: row.pet_addendum_uploaded_to_appfolio_at,
      documentType: 'pet_addendum',
    }),
  },
  {
    id: 'insurance',
    label: 'Insurance',
    cellType: 'doc',
    priority: 1,
    isApplicable: (rec) => rec.has_insurance,
    isComplete: (rec) => !!(rec.insurance_file && rec.insurance_uploaded_to_appfolio),
    getAction: (rec) => {
      if (!rec.has_insurance) return null;
      if (!rec.insurance_file) return { text: '⚠ Missing insurance doc', level: 'red' };
      if (!rec.insurance_uploaded_to_appfolio) return { text: 'Upload insurance to AppFolio', level: 'blue' };
      return null;
    },
    getDocCellProps: (row) => ({
      filePath: row.insurance_file,
      uploadedToAppfolio: row.insurance_uploaded_to_appfolio,
      uploadedBy: row.insurance_uploaded_to_appfolio_by,
      uploadedAt: row.insurance_uploaded_to_appfolio_at,
      documentType: 'insurance',
    }),
  },

  // --- Fees (priority 2 = blue) ---
  {
    id: 'pet_fee',
    label: 'Pet Fee',
    cellType: 'fee',
    feeType: 'pet_rent',
    priority: 2,
    isApplicable: (rec) => rec.has_pets,
    isComplete: (rec) => rec.pet_fee_added_to_appfolio,
    getAction: (rec) => {
      if (!rec.has_pets) return null;
      if (!rec.pet_fee_added_to_appfolio) {
        const amt = rec.calculated_pet_fee;
        return { text: amt != null ? `Load pet fee $${amt} in AppFolio` : 'Load pet fee in AppFolio (amount TBD)', level: 'blue' };
      }
      return null;
    },
    getFeeCellProps: (row) => ({
      feeLoaded: row.pet_fee_added_to_appfolio,
      feeAmount: row.pet_fee_amount,
      loadedBy: row.pet_fee_added_to_appfolio_by,
      loadedAt: row.pet_fee_added_to_appfolio_at,
      calculatedFee: row.calculated_pet_fee,
    }),
  },
  {
    id: 'permit_fee',
    label: 'Permit Fee',
    cellType: 'fee',
    feeType: 'permit_fee',
    priority: 2,
    isApplicable: (rec) => rec.requires_parking_permit,
    isComplete: (rec) => rec.permit_fee_added_to_appfolio,
    getAction: (rec) => {
      if (!rec.requires_parking_permit) return null;
      if (!rec.permit_fee_added_to_appfolio) {
        const amt = rec.calculated_permit_fee;
        return { text: amt != null ? `Load permit fee $${amt} in AppFolio` : 'Load permit fee in AppFolio (amount TBD)', level: 'blue' };
      }
      return null;
    },
    getFeeCellProps: (row) => ({
      feeLoaded: row.permit_fee_added_to_appfolio,
      feeAmount: row.permit_fee_amount,
      loadedBy: row.permit_fee_added_to_appfolio_by,
      loadedAt: row.permit_fee_added_to_appfolio_at,
      calculatedFee: row.calculated_permit_fee,
    }),
  },

  // --- Permits (priority 3 = amber) ---
  {
    id: 'permit',
    label: 'Permit',
    cellType: 'status',
    priority: 3,
    isApplicable: (rec) => rec.requires_parking_permit,
    isComplete: (rec) => rec.permit_issued,
    getAction: (rec) => {
      if (!rec.requires_parking_permit) return null;
      if (!rec.permit_issued) return { text: 'Issue permit', level: 'amber' };
      return null;
    },
    getStatusCellProps: (row) => ({
      done: row.permit_issued,
      doneLabel: '✓ Issued',
      pendingLabel: 'Pending',
      auditBy: row.permit_issued_by,
      auditAt: row.permit_issued_at,
    }),
  },
];

// ---------------------------------------------------------------------------
// computeColumnStats — shared helper for both server-side and client-side
// Accepts any array of ComplianceRecord-compatible objects.
// ---------------------------------------------------------------------------

export function computeColumnStats(records: ComplianceRecord[]): Record<string, ColumnStat> {
  const result: Record<string, ColumnStat> = {};
  for (const col of COMPLIANCE_COLUMNS) {
    const applicable = records.filter(r => col.isApplicable(r));
    const complete = applicable.filter(r => col.isComplete(r));
    result[col.id] = { complete: complete.length, total: applicable.length };
  }
  return result;
}

// ---------------------------------------------------------------------------
// computeCompletionScore — average of all column fractions (0–100)
// ---------------------------------------------------------------------------

export function computeCompletionScore(
  submissionFraction: { num: number; den: number },
  columnStats: Record<string, ColumnStat>,
): number {
  const fractions: number[] = [];
  if (submissionFraction.den > 0) fractions.push(submissionFraction.num / submissionFraction.den);
  for (const s of Object.values(columnStats)) {
    if (s.total > 0) fractions.push(s.complete / s.total);
  }
  return fractions.length > 0
    ? Math.round((fractions.reduce((a, b) => a + b, 0) / fractions.length) * 100)
    : 0;
}
