/**
 * identity.ts
 * 
 * Identity verification helpers for signature capture.
 * - Tenants: DOB match against household head
 * - Staff: Admin session validation
 * - Lockout tracking for failed attempts
 */

import { supabaseAdmin } from '@/lib/supabase';
import type { SessionUser } from '@/lib/auth';

const MAX_IDENTITY_ATTEMPTS = 3;
const LOCKOUT_DURATION_HOURS = 24;

export interface IdentityResult {
  success: boolean;
  lockedUntil?: Date;
  attemptsRemaining?: number;
  error?: string;
}

/**
 * Verify tenant identity via DOB match against head of household.
 * Tracks failed attempts and enforces 24-hour lockout after 3 failures.
 */
export async function verifyTenantIdentity(
  tenantToken: string,
  providedDob: string,
  captureStateId?: string
): Promise<IdentityResult> {
  // Load application to get member ID
  const { data: app, error: appError } = await supabaseAdmin
    .from('pbv_full_applications')
    .select('id')
    .eq('tenant_access_token', tenantToken)
    .maybeSingle();

  if (appError || !app) {
    return { success: false, error: 'Invalid tenant token' };
  }

  // Load head of household DOB
  const { data: hoh, error: hohError } = await supabaseAdmin
    .from('pbv_household_members')
    .select('date_of_birth')
    .eq('full_application_id', app.id)
    .eq('slot', 1)
    .maybeSingle();

  if (hohError || !hoh) {
    return { success: false, error: 'Household information not found' };
  }

  // Normalize dates for comparison (YYYY-MM-DD)
  const normalizedProvided = providedDob.trim();
  const normalizedExpected = hoh.date_of_birth;

  if (normalizedProvided === normalizedExpected) {
    // Success - clear any previous attempts
    if (captureStateId) {
      await clearFailedAttempts(captureStateId);
    }
    return { success: true };
  }

  // Failed attempt - track it
  if (captureStateId) {
    const { attempts, lockedUntil } = await recordFailedAttempt(captureStateId);
    const remaining = Math.max(0, MAX_IDENTITY_ATTEMPTS - attempts);

    if (lockedUntil && lockedUntil > new Date()) {
      return {
        success: false,
        lockedUntil,
        attemptsRemaining: 0,
        error: `Too many failed attempts. Please try again after ${lockedUntil.toLocaleString()}.`,
      };
    }

    return {
      success: false,
      attemptsRemaining: remaining,
      error: remaining === 0
        ? 'Too many failed attempts. Please try again in 24 hours.'
        : `Date of birth does not match. ${remaining} attempts remaining.`,
    };
  }

  return {
    success: false,
    attemptsRemaining: MAX_IDENTITY_ATTEMPTS - 1,
    error: 'Date of birth does not match.',
  };
}

/**
 * Verify staff identity via admin session.
 * Session must be valid and user must be Stanton staff.
 */
export async function verifyStaffIdentity(
  user: SessionUser
): Promise<IdentityResult> {
  if (!user || !user.userId) {
    return { success: false, error: 'No valid session' };
  }

  // Verify user is still active
  const { data: adminUser, error } = await supabaseAdmin
    .from('admin_users')
    .select('is_active, user_type')
    .eq('id', user.userId)
    .single();

  if (error || !adminUser) {
    return { success: false, error: 'User not found' };
  }

  if (!adminUser.is_active) {
    return { success: false, error: 'Account is deactivated' };
  }

  if (adminUser.user_type === 'hach_admin' || adminUser.user_type === 'hach_reviewer') {
    return { success: false, error: 'HACH users cannot sign documents' };
  }

  return { success: true };
}

/**
 * Record a failed identity attempt and check for lockout.
 */
async function recordFailedAttempt(
  captureStateId: string
): Promise<{ attempts: number; lockedUntil: Date | null }> {
  // Get current state
  const { data: state } = await supabaseAdmin
    .from('signature_capture_in_progress')
    .select('identity_attempts, locked_until')
    .eq('id', captureStateId)
    .single();

  const currentAttempts = (state?.identity_attempts ?? 0) + 1;
  let lockedUntil: Date | null = null;

  if (currentAttempts >= MAX_IDENTITY_ATTEMPTS) {
    lockedUntil = new Date();
    lockedUntil.setHours(lockedUntil.getHours() + LOCKOUT_DURATION_HOURS);
  }

  // Update state
  await supabaseAdmin
    .from('signature_capture_in_progress')
    .update({
      identity_attempts: currentAttempts,
      locked_until: lockedUntil?.toISOString() ?? null,
    })
    .eq('id', captureStateId);

  return { attempts: currentAttempts, lockedUntil };
}

/**
 * Clear failed attempts after successful verification.
 */
async function clearFailedAttempts(captureStateId: string): Promise<void> {
  await supabaseAdmin
    .from('signature_capture_in_progress')
    .update({
      identity_attempts: 0,
      locked_until: null,
    })
    .eq('id', captureStateId);
}

/**
 * Check if a capture state is currently locked out.
 */
export async function isLockedOut(
  captureStateId: string
): Promise<{ locked: boolean; lockedUntil: Date | null }> {
  const { data: state } = await supabaseAdmin
    .from('signature_capture_in_progress')
    .select('locked_until')
    .eq('id', captureStateId)
    .single();

  if (!state?.locked_until) {
    return { locked: false, lockedUntil: null };
  }

  const lockedUntil = new Date(state.locked_until);
  const now = new Date();

  return {
    locked: lockedUntil > now,
    lockedUntil: lockedUntil > now ? lockedUntil : null,
  };
}
