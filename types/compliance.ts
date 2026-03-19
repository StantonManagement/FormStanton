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
  has_esa_doc: boolean;

  // Document file paths (null = no document on file)
  vehicle_addendum_file: string | null;
  pet_addendum_file: string | null;
  insurance_file: string | null;
  esa_doc_file: string | null;

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
  esa_doc_uploaded_to_appfolio: boolean;
  esa_doc_uploaded_to_appfolio_at: string | null;
  esa_doc_uploaded_to_appfolio_by: string | null;

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

  // Lobby notes for compliance
  lobby_notes: string | null;
  lobby_notes_processed: boolean;

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
  unprocessed_notes_count: number;
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
  unprocessed_notes_count: number;
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

// ---------------------------------------------------------------------------
// Canonical types — previously duplicated across 6+ files
// ---------------------------------------------------------------------------

/** Full tenant submission record */
export interface TenantSubmission {
  id: string;
  full_name: string;
  unit_number: string;
  phone: string;
  email: string;
  building_address: string;
  has_vehicle: boolean;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  vehicle_color?: string;
  vehicle_plate?: string;
  vehicle_type?: string;
  vehicle_verified: boolean;
  vehicle_signature?: string;
  vehicle_signature_date?: string;
  vehicle_addendum_file?: string;
  vehicle_addendum_file_uploaded_at?: string;
  vehicle_addendum_file_uploaded_by?: string;
  vehicle_submitted_by_phone?: boolean;
  vehicle_phone_submission_date?: string;
  vehicle_phone_submission_by?: string;
  vehicle_exported?: boolean;
  vehicle_exported_at?: string;
  vehicle_exported_by?: string;
  permit_issued: boolean;
  permit_issued_at?: string;
  permit_issued_by?: string;
  tenant_picked_up: boolean;
  tenant_picked_up_at?: string;
  has_pets: boolean;
  pets?: any;
  pet_verified: boolean;
  pet_signature?: string;
  pet_signature_date?: string;
  pet_addendum_file?: string;
  pet_addendum_received?: boolean;
  pet_addendum_received_by?: string;
  vehicle_addendum_received?: boolean;
  vehicle_addendum_received_by?: string;
  exemption_status?: string;
  exemption_reason?: string;
  exemption_documents?: string[];
  pickup_id_photo?: string;
  has_insurance: boolean;
  insurance_provider?: string;
  insurance_policy_number?: string;
  insurance_expiration_date?: string;
  insurance_file?: string;
  insurance_type?: string;
  insurance_upload_pending: boolean;
  insurance_verified: boolean;
  insurance_authorization_signature?: string;
  add_insurance_to_rent?: boolean;
  vehicle_notes?: string;
  pet_notes?: string;
  insurance_notes?: string;
  admin_notes?: string;
  lobby_notes?: string;
  lobby_notes_processed?: boolean;
  lobby_notes_updated_at?: string;
  lobby_notes_updated_by?: string;
  ready_for_review: boolean;
  reviewed_for_permit: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  merged_into?: string;
  is_primary?: boolean;
  duplicate_group_id?: string;
  additional_vehicles?: Array<{
    vehicle_make: string;
    vehicle_model: string;
    vehicle_year: number | string;
    vehicle_color: string;
    vehicle_plate: string;
    vehicle_type?: string;
    requested_at?: string;
  }>;
  additional_vehicle_approved?: boolean;
  additional_vehicle_denied?: boolean;
  vehicle_addendum_uploaded_to_appfolio?: boolean;
  pet_addendum_uploaded_to_appfolio?: boolean;
  insurance_uploaded_to_appfolio?: boolean;
  esa_doc_uploaded_to_appfolio?: boolean;
  esa_doc_uploaded_to_appfolio_at?: string;
  esa_doc_uploaded_to_appfolio_by?: string;
  pet_fee_added_to_appfolio?: boolean;
  permit_fee_added_to_appfolio?: boolean;
}

/** Tenant occupancy data for a building — from tenant lookup API */
export interface BuildingTenantData {
  building_address_normalized: string;
  building_address_original: string;
  occupied_units: Array<{
    unit_number: string;
    tenant_name: string;
    email?: string;
    phone?: string;
    building_address: string;
  }>;
  occupied_count: number;
}

/** Per-building stats computed client-side from submissions + tenant data */
export interface BuildingStats {
  totalUnits: number;
  occupiedUnits: number;
  submissionCount: number;
  percentComplete: number;
  missingUnits: string[];
  missingSubmissions: Array<{ unit: string; tenant: any }>;
  vacantUnits: number;
}

// ---------------------------------------------------------------------------
// Multi-Project Compliance types (Phase 1)
// ---------------------------------------------------------------------------

export type EvidenceType = 'form' | 'file_upload' | 'photo' | 'signature' | 'acknowledgment' | 'staff_check'
export type Assignee = 'tenant' | 'staff'
export type ProjectStatus = 'draft' | 'active' | 'closed'
export type TaskCompletionStatus = 'pending' | 'complete' | 'waived'
export type OverallStatus = 'not_started' | 'in_progress' | 'complete'
export type PreferredLanguage = 'en' | 'es' | 'pt'

export interface TaskType {
  id: string
  name: string
  description: string | null
  assignee: Assignee
  evidence_type: EvidenceType
  form_id: string | null
  instructions: string | null
  created_by: string | null
  created_at: string
}

export interface Project {
  id: string
  name: string
  description: string | null
  deadline: string | null
  status: ProjectStatus
  sequential: boolean
  created_by: string | null
  created_at: string
}

export interface ProjectTask {
  id: string
  project_id: string
  task_type_id: string
  order_index: number
  required: boolean
  task_type?: TaskType
}

export interface ProjectUnit {
  id: string
  project_id: string
  building: string
  unit_number: string
  tenant_link_token: string
  token_expires_at: string | null
  preferred_language: PreferredLanguage
  overall_status: OverallStatus
  first_viewed_at: string | null
  last_viewed_at: string | null
  view_count: number
  created_at: string
  task_completions?: TaskCompletion[]
}

export interface LinkDelivery {
  id: string
  project_unit_id: string
  method: 'sms' | 'email'
  sent_to: string
  sent_at: string
  sent_by: string
  send_error: string | null
  created_at: string
}

export interface TaskCompletion {
  id: string
  project_unit_id: string
  project_task_id: string
  status: TaskCompletionStatus
  evidence_url: string | null
  form_submission_id: string | null
  completed_by: string | null
  completed_at: string | null
  notes: string | null
}

export interface TenantProfile {
  id: string
  building: string
  unit_number: string
  preferred_language: PreferredLanguage
  tenant_name: string | null
  last_synced_at: string
}

// ---------------------------------------------------------------------------
// Phase 4 — Matrix Integration types
// ---------------------------------------------------------------------------

/** Dynamic column definition for project mode */
export interface DynamicColumn {
  id: string            // project_task.id
  label: string         // task_type.name
  assignee: 'tenant' | 'staff'
  evidence_type: string
  required: boolean
  order_index: number
}

/** One row per unit in project mode matrix */
export interface ProjectMatrixRow {
  unit_id: string       // project_units.id
  unit_number: string
  building: string
  tenant_name: string | null
  overall_status: string
  completions: Record<string, {
    status: string
    completed_at: string | null
    completed_by: string | null
    evidence_url: string | null
  }>
}

/** Per-building stats for project mode portfolio table */
export interface ProjectBuildingStats {
  building: string
  total_units: number
  complete_units: number
  columns: Record<string, { complete: number; total: number }>
}
