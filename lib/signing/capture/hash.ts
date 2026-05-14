/**
 * hash.ts
 * 
 * SHA256 hashing utilities for document integrity verification.
 * Server-side only - never trust client-side hashing.
 */

import { createHash } from 'crypto';

/**
 * Compute SHA256 hash of a buffer
 */
export function computeSha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Compute SHA256 hash of a base64 data URL (extracts the data portion)
 */
export function computeSha256FromDataUrl(dataUrl: string): string {
  const base64Data = dataUrl.split(',')[1];
  if (!base64Data) {
    throw new Error('Invalid data URL format');
  }
  const buffer = Buffer.from(base64Data, 'base64');
  return computeSha256(buffer);
}

/**
 * Verify that a buffer matches an expected hash
 */
export function verifyHash(buffer: Buffer, expectedHash: string): boolean {
  const actualHash = computeSha256(buffer);
  return actualHash === expectedHash;
}

/**
 * Compare two hashes in constant time to prevent timing attacks
 */
export function compareHashesConstantTime(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
