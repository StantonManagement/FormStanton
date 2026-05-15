import { describe, it, expect } from 'vitest';
import {
  canAccessSignSummary,
  canAccessSignForms,
  canAccessSignAdditionalSigners,
  canAccessDashboard,
  GateResult,
} from '@/lib/pbv/stepGates';
import { DashboardState } from '@/lib/pbv/hooks/useDashboardState';

function makeDashboardState(overrides: Partial<DashboardState> = {}): DashboardState {
  return {
    status: 'ready',
    data: {
      preferred_language: 'en',
      submission_language: 'en',
      signing_status: 'not_started',
      head_of_household_name: 'Test User',
      hoh_member_id: null,
      summary_signed: false,
      forms: [],
      forms_total: 0,
      forms_signed: 0,
      upload_total: 0,
      upload_complete: 0,
      additional_signers_needed: false,
      additional_signers_pending_count: 0,
      can_submit: false,
      ...overrides,
    },
  } as DashboardState;
}

describe('canAccessSignSummary', () => {
  it('allows access when forms are generated', () => {
    const state = makeDashboardState({
      forms: [{ id: '1', form_id: 'test', display_name: 'Test', status: 'generated', signatures_complete: false }],
      forms_total: 1,
    });
    expect(canAccessSignSummary(state)).toEqual({ allowed: true });
  });

  it('blocks access when no forms (intake not complete)', () => {
    const state = makeDashboardState({ forms: [] });
    const result = canAccessSignSummary(state);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('intake_not_complete');
  });

  it('blocks access when state is loading', () => {
    expect(canAccessSignSummary({ status: 'loading' })).toEqual({
      allowed: false,
      redirectTo: '/pbv-full-app',
      reason: 'state_loading',
    });
  });

  it('blocks access when state is error', () => {
    expect(canAccessSignSummary({ status: 'error', message: 'Failed' })).toEqual({
      allowed: false,
      redirectTo: '/pbv-full-app',
      reason: 'error',
    });
  });

  it('blocks access when state is null', () => {
    expect(canAccessSignSummary(null)).toEqual({
      allowed: false,
      redirectTo: '/pbv-full-app',
      reason: 'state_loading',
    });
  });
});

describe('canAccessSignForms', () => {
  it('allows access when summary is signed and forms exist', () => {
    const state = makeDashboardState({
      summary_signed: true,
      forms: [{ id: '1', form_id: 'test', display_name: 'Test', status: 'generated', signatures_complete: false }],
    });
    expect(canAccessSignForms(state)).toEqual({ allowed: true });
  });

  it('blocks access when summary not signed', () => {
    const state = makeDashboardState({
      summary_signed: false,
      forms: [{ id: '1', form_id: 'test', display_name: 'Test', status: 'generated', signatures_complete: false }],
    });
    const result = canAccessSignForms(state);
    expect(result.allowed).toBe(false);
    expect(result.redirectTo).toBe('/pbv-full-app/sign/summary');
    expect(result.reason).toBe('summary_not_signed');
  });

  it('blocks access when no forms', () => {
    const state = makeDashboardState({ summary_signed: true, forms: [] });
    const result = canAccessSignForms(state);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('intake_not_complete');
  });

  it('blocks access when state is loading', () => {
    expect(canAccessSignForms({ status: 'loading' })).toEqual({
      allowed: false,
      redirectTo: '/pbv-full-app',
      reason: 'state_loading',
    });
  });
});

describe('canAccessSignAdditionalSigners', () => {
  it('allows access when summary signed and all forms signed', () => {
    const state = makeDashboardState({
      summary_signed: true,
      forms: [
        { id: '1', form_id: 'form1', display_name: 'Form 1', status: 'signed', signatures_complete: true },
        { id: '2', form_id: 'form2', display_name: 'Form 2', status: 'finalized', signatures_complete: true },
      ],
    });
    expect(canAccessSignAdditionalSigners(state)).toEqual({ allowed: true });
  });

  it('blocks access when summary not signed', () => {
    const state = makeDashboardState({
      summary_signed: false,
      forms: [{ id: '1', form_id: 'test', display_name: 'Test', status: 'signed', signatures_complete: true }],
    });
    const result = canAccessSignAdditionalSigners(state);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('summary_not_signed');
  });

  it('blocks access when forms not all signed', () => {
    const state = makeDashboardState({
      summary_signed: true,
      forms: [
        { id: '1', form_id: 'form1', display_name: 'Form 1', status: 'signed', signatures_complete: true },
        { id: '2', form_id: 'form2', display_name: 'Form 2', status: 'generated', signatures_complete: false },
      ],
    });
    const result = canAccessSignAdditionalSigners(state);
    expect(result.allowed).toBe(false);
    expect(result.redirectTo).toBe('/pbv-full-app/sign/forms');
    expect(result.reason).toBe('forms_not_complete');
  });

  it('blocks access when no forms', () => {
    const state = makeDashboardState({ summary_signed: true, forms: [] });
    const result = canAccessSignAdditionalSigners(state);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('intake_not_complete');
  });
});

describe('canAccessDashboard', () => {
  it('always allows dashboard access', () => {
    expect(canAccessDashboard(null)).toEqual({ allowed: true });
    expect(canAccessDashboard({ status: 'loading' })).toEqual({ allowed: true });
    expect(canAccessDashboard({ status: 'error', message: 'Failed' })).toEqual({ allowed: true });
    expect(canAccessDashboard(makeDashboardState())).toEqual({ allowed: true });
  });
});
