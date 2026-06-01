import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getRealSessionUser } from '@/lib/auth';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';

const RELATIONSHIPS = new Set(['head', 'spouse', 'partner', 'child', 'other']);
const CITIZENSHIP = new Set(['citizen', 'eligible_non_citizen', 'ineligible', 'not_reported']);

function computeAge(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

/**
 * PATCH — edit a household member's non-SSN fields (staff correction / paper
 * intake). SSN has its own endpoint (.../ssn/[memberId]). Recomputes age +
 * signature_required when DOB changes, audits the change, and regenerates forms.
 *
 * Body: any subset of { name, date_of_birth, relationship, citizenship_status,
 * criminal_history, disability, student, annual_income, income_sources }.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const actor = await getRealSessionUser();
  if (!actor) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, memberId } = await params;
    const body = await request.json().catch(() => ({}));

    const updates: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (typeof body.name === 'string' && body.name.trim()) {
      updates.name = body.name.trim();
      changedFields.push('name');
    }
    if (typeof body.relationship === 'string') {
      if (!RELATIONSHIPS.has(body.relationship)) {
        return NextResponse.json({ success: false, message: 'Invalid relationship' }, { status: 422 });
      }
      updates.relationship = body.relationship;
      changedFields.push('relationship');
    }
    if (typeof body.citizenship_status === 'string') {
      if (!CITIZENSHIP.has(body.citizenship_status)) {
        return NextResponse.json({ success: false, message: 'Invalid citizenship status' }, { status: 422 });
      }
      updates.citizenship_status = body.citizenship_status;
      changedFields.push('citizenship_status');
    }
    if ('criminal_history' in body) {
      updates.criminal_history = body.criminal_history === null ? null : body.criminal_history === true;
      changedFields.push('criminal_history');
    }
    if ('disability' in body) {
      updates.disability = body.disability === true;
      changedFields.push('disability');
    }
    if ('student' in body) {
      updates.student = body.student === true;
      changedFields.push('student');
    }
    if ('annual_income' in body) {
      const n = Number(body.annual_income);
      if (Number.isNaN(n) || n < 0) {
        return NextResponse.json({ success: false, message: 'Invalid annual income' }, { status: 422 });
      }
      updates.annual_income = n;
      changedFields.push('annual_income');
    }
    if (Array.isArray(body.income_sources)) {
      updates.income_sources = body.income_sources.filter((s: unknown) => typeof s === 'string');
      changedFields.push('income_sources');
    }
    // DOB drives age + signature_required (18+).
    if (typeof body.date_of_birth === 'string') {
      updates.date_of_birth = body.date_of_birth || null;
      const age = computeAge(body.date_of_birth || null);
      updates.age = age;
      updates.signature_required = age !== null && age >= 18;
      changedFields.push('date_of_birth');
    }

    if (changedFields.length === 0) {
      return NextResponse.json({ success: false, message: 'No valid fields to update' }, { status: 400 });
    }

    const { data: member, error: readErr } = await supabaseAdmin
      .from('pbv_household_members')
      .select('id, full_application_id, name')
      .eq('id', memberId)
      .eq('full_application_id', id)
      .single();
    if (readErr || !member) {
      return NextResponse.json({ success: false, message: 'Member not found' }, { status: 404 });
    }

    const { error: updErr } = await supabaseAdmin
      .from('pbv_household_members')
      .update(updates)
      .eq('id', memberId);
    if (updErr) throw updErr;

    await writePbvApplicationEvent({
      applicationId: id,
      eventType: ApplicationEventType.PBV_MEMBER_CORRECTED,
      actorUserId: actor.userId,
      actorDisplayName: actor.displayName ?? '',
      payload: { member_id: memberId, fields: changedFields },
    });

    // Forms are regenerated separately via the idempotent generate-forms endpoint
    // (it re-stamps from current member data). Signal the caller to trigger it.
    return NextResponse.json({ success: true, data: { regenerate_required: true } });
  } catch (error: any) {
    console.error('PATCH /api/admin/pbv/full-applications/[id]/members/[memberId] error:', error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
