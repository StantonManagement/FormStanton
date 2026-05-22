/**
 * PRP-003 — Magic-bytes detection unit tests.
 *
 * Verifies the leading-byte signatures for each accepted type, rejection of
 * spoofed and zero-byte buffers, and the claimed-vs-detected reporting.
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ALLOWED_UPLOAD_TYPES,
  detectMagicType,
  detectedToMime,
  isAllowedUpload,
} from '@/lib/upload/magicBytes';

function bufWithLeading(prefix: number[], rest = 32): Buffer {
  const b = Buffer.alloc(prefix.length + rest);
  for (let i = 0; i < prefix.length; i++) b[i] = prefix[i];
  return b;
}

describe('detectMagicType', () => {
  it('detects JPEG (FF D8 FF)', () => {
    expect(detectMagicType(bufWithLeading([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
  });

  it('detects PNG (89 50 4E 47 0D 0A 1A 0A)', () => {
    expect(
      detectMagicType(bufWithLeading([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ).toBe('png');
  });

  it('detects PDF (%PDF)', () => {
    expect(detectMagicType(bufWithLeading([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]))).toBe('pdf');
  });

  it('detects WebP (RIFF....WEBP)', () => {
    const b = Buffer.alloc(32);
    b.write('RIFF', 0, 'ascii');
    b.writeUInt32LE(24, 4); // size field
    b.write('WEBP', 8, 'ascii');
    expect(detectMagicType(b)).toBe('webp');
  });

  it('detects HEIC (....ftypheic)', () => {
    const b = Buffer.alloc(32);
    b.writeUInt32BE(24, 0);
    b.write('ftyp', 4, 'ascii');
    b.write('heic', 8, 'ascii');
    expect(detectMagicType(b)).toBe('heic');
  });

  it('detects HEIF variant brands (mif1)', () => {
    const b = Buffer.alloc(32);
    b.write('ftyp', 4, 'ascii');
    b.write('mif1', 8, 'ascii');
    expect(detectMagicType(b)).toBe('heic');
  });

  it('rejects an unknown brand under ftyp', () => {
    const b = Buffer.alloc(32);
    b.write('ftyp', 4, 'ascii');
    b.write('mp42', 8, 'ascii'); // valid mp4 brand but not allowed here
    expect(detectMagicType(b)).toBeNull();
  });

  it('rejects an MZ (Windows exe) buffer renamed as JPG', () => {
    // 'MZ' header
    expect(detectMagicType(bufWithLeading([0x4d, 0x5a, 0x90, 0x00]))).toBeNull();
  });

  it('rejects zero-byte buffer', () => {
    expect(detectMagicType(Buffer.alloc(0))).toBeNull();
  });

  it('rejects a too-short buffer', () => {
    expect(detectMagicType(Buffer.from([0xff, 0xd8]))).toBeNull();
  });

  it('accepts Uint8Array input (not just Buffer)', () => {
    const u8 = new Uint8Array([0xff, 0xd8, 0xff, ...new Array(12).fill(0)]);
    expect(detectMagicType(u8)).toBe('jpeg');
  });
});

describe('detectedToMime', () => {
  it('maps each detected type to a canonical MIME', () => {
    expect(detectedToMime('jpeg')).toBe('image/jpeg');
    expect(detectedToMime('png')).toBe('image/png');
    expect(detectedToMime('pdf')).toBe('application/pdf');
    expect(detectedToMime('webp')).toBe('image/webp');
    expect(detectedToMime('heic')).toBe('image/heic');
  });
});

describe('isAllowedUpload', () => {
  it('accepts a JPEG buffer claimed as image/jpeg', () => {
    const r = isAllowedUpload(bufWithLeading([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.detected).toBe('jpeg');
      expect(r.mime).toBe('image/jpeg');
    }
  });

  it('still accepts when the browser mislabels the MIME (PNG bytes claimed as image/jpeg)', () => {
    // Mismatch among allowed types must not block — see PRP-003 ambiguity default.
    const pngBytes = bufWithLeading([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const r = isAllowedUpload(pngBytes, 'image/jpeg');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.detected).toBe('png');
  });

  it('rejects an MZ (exe) buffer claimed as image/jpeg → 415-mappable', () => {
    const r = isAllowedUpload(bufWithLeading([0x4d, 0x5a, 0x90, 0x00]), 'image/jpeg');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('unrecognized');
      expect(r.claimedMime).toBe('image/jpeg');
    }
  });

  it('rejects a zero-byte buffer → 400-mappable', () => {
    const r = isAllowedUpload(Buffer.alloc(0), 'image/jpeg');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('empty');
  });

  it('rejects a real type that is not in the allow set', () => {
    const pngBytes = bufWithLeading([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const r = isAllowedUpload(pngBytes, 'image/png', new Set(['jpeg', 'pdf']));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('disallowed_type');
      expect(r.detected).toBe('png');
    }
  });

  it('default allow set includes jpeg, png, pdf, webp, heic', () => {
    expect(DEFAULT_ALLOWED_UPLOAD_TYPES.has('jpeg')).toBe(true);
    expect(DEFAULT_ALLOWED_UPLOAD_TYPES.has('png')).toBe(true);
    expect(DEFAULT_ALLOWED_UPLOAD_TYPES.has('pdf')).toBe(true);
    expect(DEFAULT_ALLOWED_UPLOAD_TYPES.has('webp')).toBe(true);
    expect(DEFAULT_ALLOWED_UPLOAD_TYPES.has('heic')).toBe(true);
  });
});
