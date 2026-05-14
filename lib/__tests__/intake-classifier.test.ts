import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyPage, warmSignatureCache } from '../intake/classifier';

const MOCK_SIGNATURES = [
  { doc_type: 'paystubs', signature_kind: 'phrase', pattern: 'Pay Period', weight: 0.3, negative: false, min_score_for_match: 0.6 },
  { doc_type: 'paystubs', signature_kind: 'phrase', pattern: 'Gross Pay', weight: 0.3, negative: false, min_score_for_match: 0.6 },
  { doc_type: 'paystubs', signature_kind: 'phrase', pattern: 'Earnings', weight: 0.3, negative: false, min_score_for_match: 0.6 },
  { doc_type: 'bank_statement_checking', signature_kind: 'phrase', pattern: 'Checking Account', weight: 0.5, negative: false, min_score_for_match: 0.7 },
  { doc_type: 'bank_statement_checking', signature_kind: 'phrase', pattern: 'Beginning Balance', weight: 0.3, negative: false, min_score_for_match: 0.7 },
  { doc_type: 'hud_9886a', signature_kind: 'form_number', pattern: 'HUD-9886-A', weight: 1.0, negative: false, min_score_for_match: 0.5 },
  { doc_type: 'vawa_certification', signature_kind: 'form_number', pattern: 'HUD-5382', weight: 1.0, negative: false, min_score_for_match: 0.5 },
];

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: MOCK_SIGNATURES, error: null }),
      }),
    }),
  },
}));

describe('classifyPage', () => {
  beforeEach(async () => {
    await warmSignatureCache('pbv-full-application');
  });

  it('classifies a paystub correctly', () => {
    const text = 'Employee Pay Period: 04/01 - 04/15\nGross Pay: $2,450.00\nEarnings Statement';
    const result = classifyPage(text, [], 'pbv-full-application');
    expect(result.suggested_doc_type).toBe('paystubs');
    expect(result.suggested_score).toBeGreaterThanOrEqual(0.6);
    expect(['high', 'medium']).toContain(result.ocr_confidence);
  });

  it('classifies a bank statement correctly', () => {
    const text = 'Chase Checking Account\nStatement Period: March 2025\nBeginning Balance: $1,200.00';
    const result = classifyPage(text, [], 'pbv-full-application');
    expect(result.suggested_doc_type).toBe('bank_statement_checking');
  });

  it('classifies a HUD-9886-A form by form number', () => {
    const text = 'HUD-9886-A Authorization for Release of Information';
    const result = classifyPage(text, [], 'pbv-full-application');
    expect(result.suggested_doc_type).toBe('hud_9886a');
    expect(result.suggested_score).toBeGreaterThanOrEqual(0.5);
  });

  it('returns null for blank page', () => {
    const result = classifyPage('[BLANK]', [], 'pbv-full-application');
    expect(result.suggested_doc_type).toBeNull();
    expect(result.ocr_confidence).toBe('none');
  });

  it('returns null for very short text', () => {
    const result = classifyPage('hello', [], 'pbv-full-application');
    expect(result.suggested_doc_type).toBeNull();
    expect(result.ocr_confidence).toBe('none');
  });

  it('detects person slot from household member name', () => {
    const members = [
      { first_name: 'Maria', last_name: 'Santos', person_slot: 1 },
      { first_name: 'Jose', last_name: 'Santos', person_slot: 2 },
    ];
    const text = 'HUD-5382 VAWA Certification\nApplicant: Maria Santos\nDate: 05/01/2025';
    const result = classifyPage(text, members, 'pbv-full-application');
    expect(result.suggested_person_slot).toBe(1);
  });

  it('returns null person slot when multiple members match', () => {
    const members = [
      { first_name: 'Maria', last_name: 'Santos', person_slot: 1 },
      { first_name: 'Jose', last_name: 'Santos', person_slot: 2 },
    ];
    const text = 'HUD-5382 VAWA\nSantos family — both adults must sign.';
    const result = classifyPage(text, members, 'pbv-full-application');
    expect(result.suggested_person_slot).toBeNull();
  });

  it('returns null when score below min_score_for_match', () => {
    const text = 'This document contains absolutely no recognizable financial keywords whatsoever at all.';
    const result = classifyPage(text, [], 'pbv-full-application');
    expect(result.suggested_doc_type).toBeNull();
  });
});
