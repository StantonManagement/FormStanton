/**
 * lib/storage/resolveBucket.ts
 *
 * Bucket-aware resolver for application_documents storage.
 *
 * Background (PRD-35):
 *   All PBV application documents (application_documents rows) are written
 *   to the `form-submissions` bucket regardless of doc_type. This was
 *   confirmed by sweeping every upload route in the codebase:
 *     - app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts
 *     - app/api/admin/applications/.../documents/upload/route.ts
 *     - app/api/admin/intake/.../commit/[batch_id]/route.ts
 *     - app/api/admin/submissions/[submissionId]/documents/upload/route.ts
 *   All four write to `form-submissions`.
 *
 *   The `submissions`, `form-photos`, and `project-evidence` buckets exist for
 *   other purposes (legacy onboarding forms, standalone form submissions, and
 *   project-mode task evidence respectively). They are NOT used for
 *   application_documents rows.
 *
 *   If a future code path writes to a different bucket, add a `storage_bucket`
 *   column to application_documents and populate it at write time, then let
 *   this resolver prefer the explicit column value.
 */

export type KnownBucket =
  | 'form-submissions'
  | 'submissions'
  | 'form-photos'
  | 'project-evidence'
  | 'pbv-applications'
  | 'signing-packets'
  | 'intake-staging';

export interface ResolveBucketInput {
  doc_type: string;
  category?: string | null;
  storage_bucket?: string | null;
}

/**
 * Returns the storage bucket that holds the file for a given application_documents row.
 *
 * Resolution order:
 *   1. Explicit `storage_bucket` column value (future-proofing — currently always null).
 *   2. All known doc_types for application_documents → `form-submissions`.
 *   3. Default → `form-submissions` (current behavior; all application docs live here).
 */
export function resolveBucket(doc: ResolveBucketInput): KnownBucket {
  if (doc.storage_bucket) {
    return doc.storage_bucket as KnownBucket;
  }

  return 'form-submissions';
}
