/**
 * Step gate utilities for PBV tenant flow.
 * Prevents out-of-order page access by checking dashboard state preconditions.
 */

import { DashboardState, DashboardData, FormDoc } from './hooks/useDashboardState';

export interface GateResult {
  allowed: boolean;
  redirectTo?: string;
  reason?: string;
}

function isReadyState(state: DashboardState): state is { status: 'ready'; data: DashboardData } {
  return state?.status === 'ready';
}

/**
 * Check if tenant can access the summary signing page.
 * Requirements: intake complete, forms generated (summary document exists)
 */
export function canAccessSignSummary(state: DashboardState | null): GateResult {
  if (!state || state.status === 'loading') {
    return { allowed: false, redirectTo: '/pbv-full-app', reason: 'state_loading' };
  }

  if (state.status === 'error') {
    return { allowed: false, redirectTo: '/pbv-full-app', reason: 'error' };
  }

  if (!isReadyState(state)) {
    return { allowed: false, redirectTo: '/pbv-full-app', reason: 'no_data' };
  }

  const data = state.data;

  // Must have completed intake (signing_status not null means intake was submitted)
  // signing_status: 'not_started' | 'summary_signed' | 'in_progress' | 'complete'
  if (!data.signing_status || data.signing_status === 'not_started') {
    // Check if we have any forms — if not, intake likely not complete
    if (data.forms.length === 0) {
      return {
        allowed: false,
        redirectTo: '/pbv-full-app',
        reason: 'intake_not_complete',
      };
    }
  }

  // Note: we allow access even if summary not signed yet — that's the purpose of this page
  return { allowed: true };
}

/**
 * Check if tenant can access the forms signing page.
 * Requirements: intake complete, summary signed
 */
export function canAccessSignForms(state: DashboardState | null): GateResult {
  if (!state || state.status === 'loading') {
    return { allowed: false, redirectTo: '/pbv-full-app', reason: 'state_loading' };
  }

  if (state.status === 'error') {
    return { allowed: false, redirectTo: '/pbv-full-app', reason: 'error' };
  }

  if (!isReadyState(state)) {
    return { allowed: false, redirectTo: '/pbv-full-app', reason: 'no_data' };
  }

  const data = state.data;

  // Must have completed intake (have forms generated)
  if (data.forms.length === 0) {
    return {
      allowed: false,
      redirectTo: '/pbv-full-app',
      reason: 'intake_not_complete',
    };
  }

  // Must have signed summary first
  if (!data.summary_signed) {
    return {
      allowed: false,
      redirectTo: `/pbv-full-app/sign/summary`,
      reason: 'summary_not_signed',
    };
  }

  return { allowed: true };
}

/**
 * Check if tenant can access the additional signers page.
 * Requirements: intake complete, all forms signed
 */
export function canAccessSignAdditionalSigners(state: DashboardState | null): GateResult {
  if (!state || state.status === 'loading') {
    return { allowed: false, redirectTo: '/pbv-full-app', reason: 'state_loading' };
  }

  if (state.status === 'error') {
    return { allowed: false, redirectTo: '/pbv-full-app', reason: 'error' };
  }

  if (!isReadyState(state)) {
    return { allowed: false, redirectTo: '/pbv-full-app', reason: 'no_data' };
  }

  const data = state.data;

  // Must have completed intake (have forms generated)
  if (data.forms.length === 0) {
    return {
      allowed: false,
      redirectTo: '/pbv-full-app',
      reason: 'intake_not_complete',
    };
  }

  // Must have signed summary first
  if (!data.summary_signed) {
    return {
      allowed: false,
      redirectTo: `/pbv-full-app/sign/summary`,
      reason: 'summary_not_signed',
    };
  }

  // Must have all forms signed (or at least started signing them)
  const allFormsSigned =
    data.forms.length > 0 &&
    data.forms.every(
      (f: FormDoc) => f.status === 'signed' || f.status === 'finalized' || f.signatures_complete
    );

  if (!allFormsSigned) {
    return {
      allowed: false,
      redirectTo: `/pbv-full-app/sign/forms`,
      reason: 'forms_not_complete',
    };
  }

  return { allowed: true };
}

/**
 * Check if tenant can access the dashboard page.
 * Dashboard is generally accessible, but may redirect to intake if not started.
 */
export function canAccessDashboard(state: DashboardState | null): GateResult {
  if (!state || state.status === 'loading' || state.status === 'error') {
    return { allowed: true }; // Let it load, the hook will handle errors
  }

  if (!isReadyState(state)) {
    return { allowed: true };
  }

  // If intake not started and we have a pre-filled URL, maybe redirect
  // For now, dashboard is always accessible
  return { allowed: true };
}
