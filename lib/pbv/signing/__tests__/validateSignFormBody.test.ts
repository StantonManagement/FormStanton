/**
 * PRD-77 #6 — shared sign-form body validator.
 */

import { describe, it, expect } from 'vitest';
import { validateSignFormBody } from '../validateSignFormBody';

const VALID_UUID = '8c4d5e2a-1f3b-4c91-8a99-f01234567890';
const VALID_UUID_2 = 'a1b2c3d4-e5f6-4a7b-9c8d-0123456789ab';
const VALID_UUID_3 = '11223344-5566-4778-8899-aabbccddeeff';

function baseBody() {
  return {
    form_document_id: VALID_UUID,
    signer_member_id: VALID_UUID_2,
    ceremony_id: VALID_UUID_3,
    typed_name: 'John Smith',
    signature_image_path: 'pbv-signatures/abc/def.png',
  };
}

describe('validateSignFormBody', () => {
  describe('with requireSignerMemberId: true (HOH route)', () => {
    it('accepts a well-formed body', () => {
      const r = validateSignFormBody(baseBody(), { requireSignerMemberId: true });
      expect(r).toEqual({ ok: true });
    });

    it('accepts a well-formed body with optional device_owner', () => {
      for (const owner of ['self', 'hoh_device', 'staff_assisted']) {
        const r = validateSignFormBody(
          { ...baseBody(), device_owner: owner },
          { requireSignerMemberId: true }
        );
        expect(r).toEqual({ ok: true });
      }
    });

    it('rejects null/undefined body', () => {
      expect(validateSignFormBody(null, { requireSignerMemberId: true })).toEqual({
        ok: false,
        message: 'Missing request body',
      });
      expect(validateSignFormBody(undefined, { requireSignerMemberId: true })).toEqual({
        ok: false,
        message: 'Missing request body',
      });
    });

    it('rejects non-UUID form_document_id', () => {
      const r = validateSignFormBody(
        { ...baseBody(), form_document_id: 'not-a-uuid' },
        { requireSignerMemberId: true }
      );
      expect(r.ok).toBe(false);
      expect((r as any).message).toMatch(/form_document_id/);
    });

    it('rejects non-UUID ceremony_id', () => {
      const r = validateSignFormBody(
        { ...baseBody(), ceremony_id: '1234' },
        { requireSignerMemberId: true }
      );
      expect(r.ok).toBe(false);
      expect((r as any).message).toMatch(/ceremony_id/);
    });

    it('rejects non-UUID signer_member_id', () => {
      const r = validateSignFormBody(
        { ...baseBody(), signer_member_id: 'something' },
        { requireSignerMemberId: true }
      );
      expect(r.ok).toBe(false);
      expect((r as any).message).toMatch(/signer_member_id/);
    });

    it('rejects empty typed_name', () => {
      for (const v of ['', '   ', 0, false, null, undefined]) {
        const r = validateSignFormBody(
          { ...baseBody(), typed_name: v },
          { requireSignerMemberId: true }
        );
        expect(r.ok).toBe(false);
        expect((r as any).message).toMatch(/typed_name/);
      }
    });

    it('rejects empty signature_image_path', () => {
      const r = validateSignFormBody(
        { ...baseBody(), signature_image_path: '' },
        { requireSignerMemberId: true }
      );
      expect(r.ok).toBe(false);
      expect((r as any).message).toMatch(/signature_image_path/);
    });

    it('rejects invalid device_owner enum', () => {
      const r = validateSignFormBody(
        { ...baseBody(), device_owner: 'staff' },
        { requireSignerMemberId: true }
      );
      expect(r.ok).toBe(false);
      expect((r as any).message).toMatch(/device_owner/);
    });

    it('accepts an absent device_owner (defaults to "self" downstream)', () => {
      const body = baseBody();
      delete (body as any).device_owner;
      const r = validateSignFormBody(body, { requireSignerMemberId: true });
      expect(r).toEqual({ ok: true });
    });
  });

  describe('with requireSignerMemberId: false (member-token route, used by PRD-78)', () => {
    it('accepts a body that omits signer_member_id', () => {
      const body = baseBody();
      delete (body as any).signer_member_id;
      const r = validateSignFormBody(body, { requireSignerMemberId: false });
      expect(r).toEqual({ ok: true });
    });

    it('still rejects malformed form_document_id', () => {
      const r = validateSignFormBody(
        { ...baseBody(), form_document_id: 'no' },
        { requireSignerMemberId: false }
      );
      expect(r.ok).toBe(false);
    });
  });
});
