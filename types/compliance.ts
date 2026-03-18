// Shared types for the compliance page redesign (Phase 1)

/** One row per unit in the building matrix — computed server-side */
export interface MatrixRow {
  unit_number: string;
  submission_id: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  building_address: string;
  created_at: string | null;

  // Applicability flags
  has_vehicle: boolean;
  has_pets: boolean;
  has_insurance: boolean;

  // Document file paths (null = no document on file)
  vehicle_addendum_file: string | null;
  pet_addendum_file: string | null;
  insurance_file: string | null;

  // AppFolio document upload tracking
  vehicle_addendum_uploaded_to_appfolio: boolean;
  vehicle_addendum_uploaded_to_appfolio_at: string | null;
  vehicle_addendum_uploaded_to_appfolio_by: string | null;
  pet_addendum_uploaded_to_appfolio: boolean;
  pet_addendum_uploaded_to_appfolio_at: string | null;
  pet_addendum_uploaded_to_appfolio_by: string | null;
  insurance_uploaded_to_appfolio: boolean;
  insurance_uploaded_to_appfolio_at: string | null;
  insurance_uploaded_to_appfolio_by: string | null;

  // AppFolio fee tracking
  pet_fee_added_to_appfolio: boolean;
  pet_fee_added_to_appfolio_at: string | null;
  pet_fee_added_to_appfolio_by: string | null;
  pet_fee_amount: number | null;
  permit_fee_added_to_appfolio: boolean;
  permit_fee_added_to_appfolio_at: string | null;
  permit_fee_added_to_appfolio_by: string | null;
  permit_fee_amount: number | null;

  // Permit workflow
  permit_issued: boolean;
  permit_issued_at: string | null;
  permit_issued_by: string | null;
  tenant_picked_up: boolean;

  // Verification status
  vehicle_verified: boolean;
  pet_verified: boolean;
  insurance_verified: boolean;

  // Calculated fees (server-computed from submission data)
  calculated_pet_fee: number | null;
  calculated_permit_fee: number | null;

  // Submission content summaries (for table display)
  vehicle_summary: string | null;
  pet_summary: string | null;
  insurance_summary: string | null;

  // Building requirements (computed from building config, not tenant self-report)
  requires_parking_permit: boolean;

  // Missing flag: occupied unit with no submission
  missing: boolean;

  // Tenant lookup name (for missing rows where submission doesn't exist)
  tenant_lookup_name: string | null;
}

/** Response shape for GET /api/admin/compliance/building-matrix */
export interface BuildingMatrixResponse {
  success: boolean;
  building: string;
  rows: MatrixRow[];
  stats: BuildingMatrixStats;
  message?: string;
}

/** Aggregate stats returned with the matrix */
export interface BuildingMatrixStats {
  total_units: number;
  occupied_units: number;
  submissions: number;
  missing_submissions: number;
  columns: Record<string, import('@/lib/complianceColumns').ColumnStat>;
}

/** One row per building in the portfolio table */
export interface PortfolioBuildingStats {
  building_address: string;
  asset_id: string;
  portfolio: string;
  total_units: number;
  occupied_units: number;
  submissions: number;
  columns: Record<string, import('@/lib/complianceColumns').ColumnStat>;
  /** Overall completion score 0–100 for sorting (average of all applicable column percentages) */
  completion_score: number;
}

/** Cell visual state in the matrix table */
export type CellState =
  | 'not_applicable'   // — (tenant has no vehicle/pets/insurance)
  | 'missing'          // no submission at all
  | 'doc_ready'        // document exists, not yet uploaded to AppFolio
  | 'doc_uploaded'     // document uploaded to AppFolio ✅
  | 'no_doc'           // applicable but no document on file
  | 'fee_not_loaded'   // applicable fee, not yet loaded
  | 'fee_loaded'       // fee loaded ✅
  | 'done'             // generic done state (permit issued, etc.)
  | 'pending';         // generic pending state
