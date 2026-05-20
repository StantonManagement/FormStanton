/**
 * storage.ts
 *
 * Signed PDF storage helpers for signing packets.
 * Handles versioned storage paths and signed URL generation.
 */

import { supabaseAdmin } from '@/lib/supabase';

const BUCKET_NAME = 'signing-packets';

/**
 * Build a versioned storage path for a signed PDF.
 * Format: {application_id}/{signature_id}/{revision}_{original_filename}
 */
export function buildSignedPdfPath(
  applicationId: string,
  signatureId: string,
  revision: number,
  originalFilename: string
): string {
  // Sanitize filename - remove path components and excessive special chars
  const sanitized = originalFilename
    .replace(/\\/g, '/')
    .split('/')
    .pop() || 'document.pdf';
  
  return `${applicationId}/${signatureId}/${revision}_${sanitized}`;
}

/**
 * Extract revision number from a storage path.
 */
export function getRevisionFromPath(path: string): number {
  const filename = path.split('/').pop() || '';
  const match = filename.match(/^(\d+)_/);
  return match ? parseInt(match[1], 10) : 1;
}

/**
 * Upload a signed PDF to storage.
 */
export async function uploadSignedPdf(
  path: string,
  fileBuffer: Buffer,
  contentType: string = 'application/pdf'
): Promise<{ path: string; error: null } | { path: null; error: Error }> {
  const { error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(path, fileBuffer, {
      contentType,
      upsert: false, // Never overwrite - versioned paths ensure uniqueness
    });

  if (error) {
    return { path: null, error: new Error(`Upload failed: ${error.message}`) };
  }

  return { path, error: null };
}

/**
 * Get a signed URL for downloading a signed PDF.
 * Expires in 1 hour by default.
 */
export async function getSignedPdfUrl(
  path: string,
  expiresIn: number = 3600
): Promise<{ url: string | null; error: Error | null }> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, expiresIn);

  if (error) {
    return { url: null, error: new Error(`Failed to create signed URL: ${error.message}`) };
  }

  return { url: data?.signedUrl ?? null, error: null };
}

/**
 * Get a public URL for a signed PDF (if bucket allows public access).
 * Currently returns signed URL since bucket is private.
 */
export async function getPublicPdfUrl(path: string): Promise<string | null> {
  // Bucket is private, so we return null and require signed URL
  return null;
}

/**
 * Delete a signed PDF from storage.
 * Note: Per PRD, we preserve prior versions. This is only for admin/cleanup use.
 */
export async function deleteSignedPdf(path: string): Promise<{ success: boolean; error: Error | null }> {
  const { error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .remove([path]);

  if (error) {
    return { success: false, error: new Error(`Delete failed: ${error.message}`) };
  }

  return { success: true, error: null };
}

/**
 * List all signed PDF versions for a signature.
 */
export async function listSignatureVersions(
  applicationId: string,
  signatureId: string
): Promise<{ path: string; revision: number; createdAt: string }[]> {
  const prefix = `${applicationId}/${signatureId}/`;
  
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .list(prefix, {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' }
    });

  if (error || !data) {
    return [];
  }

  return data
    .filter(file => file.name.match(/^\d+_/))
    .map(file => ({
      path: `${prefix}${file.name}`,
      revision: getRevisionFromPath(file.name),
      createdAt: file.created_at || new Date().toISOString()
    }))
    .sort((a, b) => b.revision - a.revision);
}
