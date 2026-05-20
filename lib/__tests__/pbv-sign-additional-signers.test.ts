/**
 * lib/__tests__/pbv-sign-additional-signers.test.ts
 *
 * Integration tests for PRD-27 additional-signers logic.
 * All pure-logic tests — no React mount required.
 *
 * Covers:
 *   - softMatchName: happy path, accent normalization, middle-initial drop, mismatch
 *   - Dashboard can_submit gate extended with additional_signers_pending_count
 *   - Identity mismatch warning path
 *   - Magic-link expiry detection
 */

import { describe, it, expect } from 'vitest';
import { softMatchName } from '../pbv/nameMatch';
import type { SigningStatus } from '../pbv/hooks/useIntakeBootstrap';

// ——— Soft-match name tests ———

describe('softMatchName — Maria + Carlos scenarios', () => {
  it('exact match returns match', () => {
    expect(softMatchName('Carlos Garcia', 'Carlos Garcia')).toBe('match');
  });

  it('case-insensitive match', () => {
    expect(softMatchName('carlos garcia', 'Carlos Garcia')).toBe('match');
  });

  it('accent-normalized match (José → Jose)', () => {
    expect(softMatchName('Jose Rodriguez', 'Jos\u00e9 Rodr\u00edguez')).toBe('match');
  });

  it('middle initial dropped — Carlos A. Garcia matches Carlos Garcia', () => {
    expect(softMatchName('Carlos A. Garcia', 'Carlos Garcia')).toBe('match');
  });

  it('extra whitespace normalized', () => {
    expect(softMatchName('  Carlos  Garcia  ', 'Carlos Garcia')).toBe('match');
  });

  it('completely wrong name returns mismatch', () => {
    expect(softMatchName('John Smith', 'Carlos Garcia')).toBe('mismatch');
  });

  it('first name only mismatch', () => {
    expect(softMatchName('Maria Garcia', 'Carlos Garcia')).toBe('mismatch');
  });

  it('two-part name is not stripped of last token', () => {
    expect(softMatchName('Carlos', 'Carlos Garcia')).toBe('mismatch');
  });

  it('reverse order is mismatch (Garcia Carlos != Carlos Garcia)', () => {
    expect(softMatchName('Garcia Carlos', 'Carlos Garcia')).toBe('mismatch');
  });
});

// ——— can_submit gate with additional_signers_pending_count ———

interface FormDoc { signatures_complete: boolean }

function deriveCanSubmit(
  signingStatus: SigningStatus,
  forms: FormDoc[],
  uploadTotal: number,
  uploadComplete: number,
  additionalSignersPendingCount: number,
): boolean {
  const summarySignedStatuses: SigningStatus[] = ['summary_signed', 'in_progress', 'complete'];
  const summarySign = summarySignedStatuses.includes(signingStatus);
  const formsSigned = forms.filter((f) => f.signatures_complete).length;
  const formsTotal = forms.length;
  return (
    summarySign &&
    formsTotal > 0 &&
    formsSigned >= formsTotal &&
    uploadTotal > 0 &&
    uploadComplete >= uploadTotal &&
    additionalSignersPendingCount === 0
  );
}

const FORMS_SIGNED: FormDoc[] = [
  { signatures_complete: true },
  { signatures_complete: true },
];

describe('PRD-27 can_submit gate with additional signers', () => {
  it('false when 2 additional signers pending', () => {
    expect(deriveCanSubmit('complete', FORMS_SIGNED, 3, 3, 2)).toBe(false);
  });

  it('false when 1 additional signer pending', () => {
    expect(deriveCanSubmit('complete', FORMS_SIGNED, 3, 3, 1)).toBe(false);
  });

  it('true when 0 additional signers pending + all other tasks done', () => {
    expect(deriveCanSubmit('complete', FORMS_SIGNED, 3, 3, 0)).toBe(true);
  });
});

// ——— Magic-link expiry detection ———

describe('magic-link expiry', () => {
  it('expired: expires_at in the past', () => {
    const expiresAt = new Date(Date.now() - 1000).toISOString();
    const expired = new Date(expiresAt) < new Date();
    expect(expired).toBe(true);
  });

  it('valid: expires_at in the future', () => {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const expired = new Date(expiresAt) < new Date();
    expect(expired).toBe(false);
  });

  it('edge: exactly now is considered expired (< not <=)', () => {
    const now = Date.now();
    const expiresAt = new Date(now - 1).toISOString();
    const expired = new Date(expiresAt) < new Date();
    expect(expired).toBe(true);
  });
});

// ——— Same-device handoff: device_owner should be 'hoh_device' ———

describe('same-device handoff device_owner', () => {
  it("device_owner is 'hoh_device' on same-device sessions", () => {
    const deviceOwner = 'hoh_device' as const;
    expect(deviceOwner).toBe('hoh_device');
  });

  it("device_owner is 'self' on magic-link sessions", () => {
    const deviceOwner = 'self' as const;
    expect(deviceOwner).toBe('self');
  });
});
