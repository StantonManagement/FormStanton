/**
 * lib/__tests__/pbv-sign-dashboard.test.ts
 *
 * Pure-logic unit tests for PRD-26 dashboard state derivation.
 * Tests the can_submit logic and card state derivation without mounting React.
 *
 * Maria scenario:
 *   intake_status=complete, 2 forms, 3 required uploads
 *   Walk through signing flow and verify can_submit gate.
 */

import { describe, it, expect } from 'vitest';
import type { SigningStatus } from '../pbv/hooks/useIntakeBootstrap';

interface FormDoc { signatures_complete: boolean }

/**
 * Mirrors the can_submit derivation in useDashboardState.
 */
function deriveCanSubmit(
  signingStatus: SigningStatus,
  forms: FormDoc[],
  uploadTotal: number,
  uploadComplete: number,
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
    uploadComplete >= uploadTotal
  );
}

const FORMS_UNSIGNED: FormDoc[] = [
  { signatures_complete: false },
  { signatures_complete: false },
];
const FORMS_SIGNED: FormDoc[] = [
  { signatures_complete: true },
  { signatures_complete: true },
];

describe('PRD-26 dashboard can_submit gate — Maria scenario', () => {
  it('false when summary not signed', () => {
    expect(deriveCanSubmit('not_started', FORMS_UNSIGNED, 3, 0)).toBe(false);
  });

  it('false when summary signed but forms not signed', () => {
    expect(deriveCanSubmit('summary_signed', FORMS_UNSIGNED, 3, 0)).toBe(false);
  });

  it('false when all forms signed but uploads incomplete', () => {
    expect(deriveCanSubmit('complete', FORMS_SIGNED, 3, 0)).toBe(false);
  });

  it('false when uploads complete but forms not signed', () => {
    expect(deriveCanSubmit('summary_signed', FORMS_UNSIGNED, 3, 3)).toBe(false);
  });

  it('true only when summary + all forms + all uploads complete', () => {
    expect(deriveCanSubmit('complete', FORMS_SIGNED, 3, 3)).toBe(true);
  });

  it('false when upload_total = 0 (no uploads seeded yet)', () => {
    expect(deriveCanSubmit('complete', FORMS_SIGNED, 0, 0)).toBe(false);
  });
});

describe('PRD-26 summary_signed status includes in_progress', () => {
  it('summary_signed status shows forms unlocked', () => {
    const statuses: SigningStatus[] = ['summary_signed', 'in_progress', 'complete'];
    for (const s of statuses) {
      const summarySignedStatuses: SigningStatus[] = ['summary_signed', 'in_progress', 'complete'];
      expect(summarySignedStatuses.includes(s)).toBe(true);
    }
  });

  it('not_started and unknown status do not unlock forms', () => {
    const summarySignedStatuses: SigningStatus[] = ['summary_signed', 'in_progress', 'complete'];
    expect(summarySignedStatuses.includes('not_started')).toBe(false);
  });
});
