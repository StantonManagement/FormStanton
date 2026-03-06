import { compareTwoStrings } from 'string-similarity';

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
  vehicle_verified: boolean;
  vehicle_signature?: string;
  vehicle_signature_date?: string;
  vehicle_submitted_by_phone?: boolean;
  vehicle_phone_submission_date?: string;
  vehicle_phone_submission_by?: string;
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
  has_insurance: boolean;
  insurance_provider?: string;
  insurance_policy_number?: string;
  insurance_file?: string;
  insurance_upload_pending: boolean;
  insurance_verified: boolean;
  admin_notes?: string;
  ready_for_review: boolean;
  reviewed_for_permit: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  merged_into?: string;
  is_primary?: boolean;
  duplicate_group_id?: string;
}

export interface SubmissionGroup {
  id: string;
  primarySubmission: TenantSubmission;
  duplicates: TenantSubmission[];
  similarityScores: Record<string, number>;
  mergeStatus: 'pending' | 'merged' | 'dismissed';
}

/**
 * Normalize a name for comparison by:
 * - Converting to lowercase
 * - Removing punctuation
 * - Handling "Last, First" vs "First Last" formats
 * - Removing extra whitespace
 */
export function normalizeName(name: string): string {
  if (!name) return '';
  
  // Convert to lowercase and trim
  let normalized = name.toLowerCase().trim();
  
  // Remove punctuation except commas (for now)
  normalized = normalized.replace(/[^\w\s,]/g, '');
  
  // Handle "Last, First Middle" format - convert to "First Middle Last"
  if (normalized.includes(',')) {
    const parts = normalized.split(',').map(p => p.trim());
    if (parts.length === 2) {
      normalized = `${parts[1]} ${parts[0]}`;
    }
  }
  
  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

/**
 * Calculate similarity between two names using Jaro-Winkler-like algorithm
 * Returns a score between 0 and 1
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  const normalized1 = normalizeName(name1);
  const normalized2 = normalizeName(name2);
  
  if (!normalized1 || !normalized2) return 0;
  if (normalized1 === normalized2) return 1;
  
  // Use string-similarity library for comparison
  return compareTwoStrings(normalized1, normalized2);
}

/**
 * Normalize phone number by removing all non-digit characters
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

/**
 * Check if two phone numbers match
 */
export function phoneMatch(phone1: string, phone2: string): boolean {
  const normalized1 = normalizePhone(phone1);
  const normalized2 = normalizePhone(phone2);
  
  if (!normalized1 || !normalized2) return false;
  
  // Handle cases where one has country code and other doesn't
  // US numbers: 10 digits vs 11 digits (with 1 prefix)
  if (normalized1.length === 11 && normalized2.length === 10) {
    return normalized1.substring(1) === normalized2;
  }
  if (normalized1.length === 10 && normalized2.length === 11) {
    return normalized1 === normalized2.substring(1);
  }
  
  return normalized1 === normalized2;
}

/**
 * Normalize unit number for comparison
 */
export function normalizeUnit(unit: string): string {
  if (!unit) return '';
  return unit.toLowerCase().replace(/[^\w]/g, '').trim();
}

/**
 * Calculate composite similarity score between two submissions
 * Returns a score between 0 and 100
 */
export function calculateSubmissionSimilarity(
  sub1: TenantSubmission,
  sub2: TenantSubmission
): number {
  // Name similarity (70% weight)
  const nameSimilarity = calculateNameSimilarity(sub1.full_name, sub2.full_name);
  
  // Phone match (20% weight)
  const phoneScore = phoneMatch(sub1.phone, sub2.phone) ? 1 : 0;
  
  // Building + Unit match (10% weight)
  const buildingMatch = sub1.building_address === sub2.building_address ? 1 : 0;
  const unitMatch = normalizeUnit(sub1.unit_number) === normalizeUnit(sub2.unit_number) ? 1 : 0;
  const locationScore = buildingMatch && unitMatch ? 1 : 0;
  
  // Composite score
  const compositeScore = (nameSimilarity * 0.7) + (phoneScore * 0.2) + (locationScore * 0.1);
  
  return Math.round(compositeScore * 100);
}

/**
 * Determine which submission should be primary based on:
 * 1. Most recent submission
 * 2. Most complete data (has more fields filled)
 */
export function selectPrimarySubmission(submissions: TenantSubmission[]): TenantSubmission {
  if (submissions.length === 0) throw new Error('No submissions provided');
  if (submissions.length === 1) return submissions[0];
  
  // Sort by completeness score (descending) then by date (descending)
  const sorted = [...submissions].sort((a, b) => {
    const scoreA = calculateCompletenessScore(a);
    const scoreB = calculateCompletenessScore(b);
    
    if (scoreA !== scoreB) {
      return scoreB - scoreA; // Higher score first
    }
    
    // If same completeness, use most recent
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return dateB - dateA;
  });
  
  return sorted[0];
}

/**
 * Calculate how complete a submission is (0-100)
 */
function calculateCompletenessScore(submission: TenantSubmission): number {
  let score = 0;
  let maxScore = 0;
  
  // Basic info (always counted)
  maxScore += 4;
  if (submission.full_name) score++;
  if (submission.phone) score++;
  if (submission.email) score++;
  if (submission.unit_number) score++;
  
  // Vehicle info (if has_vehicle)
  if (submission.has_vehicle) {
    maxScore += 5;
    if (submission.vehicle_make) score++;
    if (submission.vehicle_model) score++;
    if (submission.vehicle_year) score++;
    if (submission.vehicle_color) score++;
    if (submission.vehicle_plate) score++;
  }
  
  // Pet info (if has_pets)
  if (submission.has_pets) {
    maxScore += 1;
    if (submission.pets) score++;
  }
  
  // Insurance info (if has_insurance)
  if (submission.has_insurance) {
    maxScore += 3;
    if (submission.insurance_provider) score++;
    if (submission.insurance_policy_number) score++;
    if (submission.insurance_file) score++;
  }
  
  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

/**
 * Group duplicate submissions based on similarity threshold
 * Returns array of SubmissionGroup objects
 */
export function groupDuplicateSubmissions(
  submissions: TenantSubmission[],
  similarityThreshold: number = 85
): SubmissionGroup[] {
  const groups: SubmissionGroup[] = [];
  const processedIds = new Set<string>();
  
  for (let i = 0; i < submissions.length; i++) {
    const current = submissions[i];
    
    // Skip if already processed or merged
    if (processedIds.has(current.id) || current.merged_into) {
      continue;
    }
    
    // Find potential duplicates
    const duplicates: TenantSubmission[] = [];
    const similarityScores: Record<string, number> = {};
    
    for (let j = i + 1; j < submissions.length; j++) {
      const candidate = submissions[j];
      
      // Skip if already processed or merged
      if (processedIds.has(candidate.id) || candidate.merged_into) {
        continue;
      }
      
      const similarity = calculateSubmissionSimilarity(current, candidate);
      
      if (similarity >= similarityThreshold) {
        duplicates.push(candidate);
        similarityScores[candidate.id] = similarity;
        processedIds.add(candidate.id);
      }
    }
    
    // Only create a group if duplicates were found
    if (duplicates.length > 0) {
      const allSubmissions = [current, ...duplicates];
      const primary = selectPrimarySubmission(allSubmissions);
      
      // Remove primary from duplicates array
      const finalDuplicates = allSubmissions.filter(s => s.id !== primary.id);
      
      groups.push({
        id: `group-${current.id}`,
        primarySubmission: primary,
        duplicates: finalDuplicates,
        similarityScores,
        mergeStatus: 'pending'
      });
      
      processedIds.add(current.id);
    }
  }
  
  return groups;
}

/**
 * Get similarity confidence level
 */
export function getSimilarityConfidence(score: number): 'high' | 'medium' | 'low' {
  if (score >= 95) return 'high';
  if (score >= 85) return 'medium';
  return 'low';
}

/**
 * Get reasons why two submissions are considered duplicates
 */
export function getDuplicateReasons(sub1: TenantSubmission, sub2: TenantSubmission): string[] {
  const reasons: string[] = [];
  
  const nameSimilarity = calculateNameSimilarity(sub1.full_name, sub2.full_name);
  if (nameSimilarity >= 0.9) {
    reasons.push('Same name');
  } else if (nameSimilarity >= 0.7) {
    reasons.push('Similar name');
  }
  
  if (phoneMatch(sub1.phone, sub2.phone)) {
    reasons.push('Same phone');
  }
  
  if (sub1.building_address === sub2.building_address && 
      normalizeUnit(sub1.unit_number) === normalizeUnit(sub2.unit_number)) {
    reasons.push('Same unit');
  }
  
  return reasons;
}
