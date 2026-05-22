/**
 * PRP-003 — Server-side magic-bytes upload validation.
 *
 * Browser-supplied `file.type` is derived from the extension and trivially
 * spoofed; we inspect the actual leading bytes to confirm the buffer is one
 * of the accepted types before handing it to storage.
 *
 * Findings: Angle-2 D4.
 */

export type DetectedMagicType = 'jpeg' | 'png' | 'pdf' | 'heic' | 'webp';

/**
 * Returns the detected type or `null` if the buffer is empty / unreadable /
 * not one of the accepted types.
 *
 * Signatures:
 *   JPEG       FF D8 FF
 *   PNG        89 50 4E 47 0D 0A 1A 0A
 *   PDF        25 50 44 46 ('%PDF')
 *   WebP       offset 0..3 'RIFF', offset 8..11 'WEBP'
 *   HEIC/HEIF  offset 4..7  'ftyp', offset 8..11 brand in
 *              { heic, heix, heim, heis, hevc, hevx, mif1, msf1, heif, heim }
 */
export function detectMagicType(buffer: Buffer | Uint8Array | null | undefined): DetectedMagicType | null {
  if (!buffer || buffer.length < 12) return null;
  const b = buffer instanceof Buffer ? buffer : Buffer.from(buffer);

  // JPEG
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';

  // PNG
  if (
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return 'png';
  }

  // PDF
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf';

  // WebP
  if (
    b[0] === 0x52 && // R
    b[1] === 0x49 && // I
    b[2] === 0x46 && // F
    b[3] === 0x46 && // F
    b[8] === 0x57 && // W
    b[9] === 0x45 && // E
    b[10] === 0x42 && // B
    b[11] === 0x50 // P
  ) {
    return 'webp';
  }

  // HEIC / HEIF — 'ftyp' box at offset 4, brand at offset 8.
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = b.slice(8, 12).toString('ascii');
    const heifBrands = new Set([
      'heic',
      'heix',
      'heim',
      'heis',
      'hevc',
      'hevx',
      'mif1',
      'msf1',
      'heif',
    ]);
    if (heifBrands.has(brand)) return 'heic';
  }

  return null;
}

/**
 * Mapping from the detected magic type to a canonical MIME used downstream.
 */
export function detectedToMime(t: DetectedMagicType): string {
  switch (t) {
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'pdf':
      return 'application/pdf';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
  }
}

/**
 * Accept the buffer iff its true bytes are one of `allowed`. The browser-
 * supplied `claimedMime` is reported back for diagnostics but is NOT used
 * for the allow/deny decision — mislabeling is common (browsers sometimes
 * report PNG as `image/jpeg`) and should not block a real image.
 *
 * Returns `{ ok: false }` for zero-byte / unreadable buffers and for any
 * buffer whose true bytes are not in `allowed`.
 */
export function isAllowedUpload(
  buffer: Buffer | Uint8Array | null | undefined,
  claimedMime: string,
  allowed: ReadonlySet<DetectedMagicType> = DEFAULT_ALLOWED_UPLOAD_TYPES
): { ok: true; detected: DetectedMagicType; mime: string } | { ok: false; reason: 'empty' | 'unrecognized' | 'disallowed_type'; detected: DetectedMagicType | null; claimedMime: string } {
  if (!buffer || buffer.length === 0) {
    return { ok: false, reason: 'empty', detected: null, claimedMime };
  }
  const detected = detectMagicType(buffer);
  if (!detected) {
    return { ok: false, reason: 'unrecognized', detected: null, claimedMime };
  }
  if (!allowed.has(detected)) {
    return { ok: false, reason: 'disallowed_type', detected, claimedMime };
  }
  return { ok: true, detected, mime: detectedToMime(detected) };
}

export const DEFAULT_ALLOWED_UPLOAD_TYPES: ReadonlySet<DetectedMagicType> = new Set([
  'jpeg',
  'png',
  'pdf',
  'webp',
  'heic',
]);
