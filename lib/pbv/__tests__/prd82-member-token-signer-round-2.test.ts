/**
 * PRD-82 — Member-token signer round 2.
 *
 * A4: all three magic-link signer routes (GET bootstrap, GET forms, POST
 *     sign-form) now select packet_locked from the application row and
 *     return 409 packet_locked when staff hold the packet.
 * A12: completeFormSigning carries an additive typed errorCode on every
 *      failure branch; the member-token sign-form route maps HTTP status
 *      from result.errorCode instead of brittle string matching. The
 *      existing `error` string is preserved so the tenant sign-form caller
 *      (PRD-77) is unaffected.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { CompleteFormResult, CompleteFormErrorCode } from '../signing/completeForm';

const bootstrapSrc = readFileSync(
  join(process.cwd(), 'app', 'api', 'pbv-full-app', 'signer', '[member_token]', 'route.ts'),
  'utf8'
);
const formsSrc = readFileSync(
  join(process.cwd(), 'app', 'api', 'pbv-full-app', 'signer', '[member_token]', 'forms', 'route.ts'),
  'utf8'
);
const memberSignSrc = readFileSync(
  join(process.cwd(), 'app', 'api', 'pbv-full-app', 'signer', '[member_token]', 'sign-form', 'route.ts'),
  'utf8'
);
const tenantSignSrc = readFileSync(
  join(process.cwd(), 'app', 'api', 't', '[token]', 'pbv-full-app', 'sign-form', 'route.ts'),
  'utf8'
);
const completeFormSrc = readFileSync(
  join(process.cwd(), 'lib', 'pbv', 'signing', 'completeForm.ts'),
  'utf8'
);

describe('PRD-82 A4 — packet_locked gate across all three member-token routes', () => {
  describe('signer/[member_token] GET (bootstrap)', () => {
    it('selects packet_locked on the application lookup', () => {
      expect(bootstrapSrc).toMatch(
        /from\(['"]pbv_full_applications['"]\)[\s\S]{0,200}select\(['"][^'"]*packet_locked[^'"]*['"]\)/
      );
    });

    it('returns 409 packet_locked when set', () => {
      expect(bootstrapSrc).toMatch(/app\?\.packet_locked/);
      expect(bootstrapSrc).toMatch(/code:\s*['"]packet_locked['"]/);
      expect(bootstrapSrc).toMatch(/status:\s*409/);
    });
  });

  describe('signer/[member_token]/forms GET', () => {
    it('selects packet_locked on the application lookup', () => {
      expect(formsSrc).toMatch(
        /from\(['"]pbv_full_applications['"]\)[\s\S]{0,200}select\(['"][^'"]*packet_locked[^'"]*['"]\)/
      );
    });

    it('returns 409 packet_locked before fetching forms', () => {
      expect(formsSrc).toMatch(/app\?\.packet_locked/);
      expect(formsSrc).toMatch(/code:\s*['"]packet_locked['"]/);
      expect(formsSrc).toMatch(/status:\s*409/);
      // The packet_locked check must precede the docs query so a locked
      // packet is never enumerated to the magic-link signer.
      const lockIdx = formsSrc.indexOf('packet_locked:');
      const docsIdx = formsSrc.indexOf("from('pbv_form_documents')");
      // (`packet_locked:` appears as `packet_locked` in the select and the
      //  response body; just check the response gate is above the docs query.)
      const gateIdx = formsSrc.indexOf("code: 'packet_locked'");
      expect(gateIdx).toBeGreaterThan(-1);
      expect(docsIdx).toBeGreaterThan(-1);
      expect(gateIdx).toBeLessThan(docsIdx);
    });
  });

  describe('signer/[member_token]/sign-form POST', () => {
    it('selects packet_locked alongside submitted_at on the application lookup', () => {
      expect(memberSignSrc).toMatch(
        /select\(['"][^'"]*submitted_at[^'"]*packet_locked[^'"]*['"]\)/
      );
    });

    it('returns 409 packet_locked AFTER the submitted_at check (per PRD-82 plan order)', () => {
      const submittedIdx = memberSignSrc.indexOf("code: 'submitted_locked'");
      const lockedIdx = memberSignSrc.indexOf("code: 'packet_locked'");
      expect(submittedIdx).toBeGreaterThan(-1);
      expect(lockedIdx).toBeGreaterThan(-1);
      expect(submittedIdx).toBeLessThan(lockedIdx);
    });
  });
});

describe('PRD-82 A12 — typed errorCode on completeFormSigning', () => {
  it('exports the CompleteFormErrorCode union', () => {
    expect(completeFormSrc).toMatch(/export type CompleteFormErrorCode\s*=/);
    expect(completeFormSrc).toMatch(/'not_found'/);
    expect(completeFormSrc).toMatch(/'load_error'/);
    expect(completeFormSrc).toMatch(/'signer_not_required'/);
    expect(completeFormSrc).toMatch(/'member_not_found'/);
    expect(completeFormSrc).toMatch(/'unsigned_pdf_missing'/);
    expect(completeFormSrc).toMatch(/'unsigned_pdf_download_error'/);
    expect(completeFormSrc).toMatch(/'event_insert_error'/);
    expect(completeFormSrc).toMatch(/'field_map_missing'/);
    expect(completeFormSrc).toMatch(/'sig_events_load_error'/);
    expect(completeFormSrc).toMatch(/'signed_pdf_upload_error'/);
    expect(completeFormSrc).toMatch(/'doc_update_error'/);
  });

  it('CompleteFormResult.errorCode is optional and additive — error string is preserved', () => {
    expect(completeFormSrc).toMatch(/error\?:\s*string/);
    expect(completeFormSrc).toMatch(/errorCode\?:\s*CompleteFormErrorCode/);
  });

  it('every error branch in completeFormSigning sets an errorCode', () => {
    // Spot-check the not-found branch (the one A12 specifically needs).
    expect(completeFormSrc).toMatch(
      /error:\s*['"]Form document not found['"],\s*errorCode:\s*['"]not_found['"]/
    );
    // Every other branch should also carry an errorCode field.
    const errorReturns = completeFormSrc.match(/return\s*\{\s*success:\s*false[^}]*error:[^}]*\}/g) ?? [];
    expect(errorReturns.length).toBeGreaterThan(5);
    for (const ret of errorReturns) {
      expect(ret).toMatch(/errorCode:/);
    }
  });

  it('member-token sign-form maps status from result.errorCode (not string includes)', () => {
    expect(memberSignSrc).toMatch(/result\.errorCode\s*===\s*['"]not_found['"]/);
    // The pre-PRD-82 `.includes('not found')` brittle check is gone.
    expect(memberSignSrc).not.toMatch(/result\.error\?\.includes\(['"]not found['"]\)/);
  });

  it('tenant sign-form route is NOT modified by this PRD (still uses its own status logic)', () => {
    // PRD-82's scope guard: do not touch the tenant route. The tenant
    // route keeps using its pre-existing `.toLowerCase().includes('not found')`
    // check; it still compiles against the additive errorCode field.
    expect(tenantSignSrc).toMatch(/result\.error\?\.toLowerCase\(\)\.includes\(['"]not found['"]\)/);
  });
});

describe('Type-level compatibility (caller-safety for PRD-77 tenant route)', () => {
  it('the additive errorCode field does not break the existing return shape', () => {
    // A CompleteFormResult constructed without errorCode is still valid.
    const r: CompleteFormResult = {
      success: false,
      alreadySigned: false,
      allSigned: false,
      status: 'error',
      error: 'Form document not found',
    };
    expect(r.errorCode).toBeUndefined();
  });

  it('errorCode is typed against the union', () => {
    const codes: CompleteFormErrorCode[] = [
      'not_found',
      'load_error',
      'signer_not_required',
      'member_not_found',
      'unsigned_pdf_missing',
      'unsigned_pdf_download_error',
      'event_insert_error',
      'field_map_missing',
      'sig_events_load_error',
      'signed_pdf_upload_error',
      'doc_update_error',
    ];
    expect(codes.length).toBe(11);
  });
});
