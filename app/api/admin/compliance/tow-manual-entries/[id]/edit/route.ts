import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { logAudit, getClientIp } from '@/lib/audit';
import { createTenantIssue, findExistingIssue } from '@/lib/tenantIssues';

const VALID_REASONS = ['moved_out', 'vehicle_sold', 'violation', 'parking_non_payment', 'other'] as const;
type TowReason = typeof VALID_REASONS[number];

/**
 * POST /api/admin/compliance/tow-manual-entries/[id]/edit
 * Edit a manual tow entry's reason and notes.
 * Preserves edit history in tow_manual_entry_history table.
 * 
 * Body: { 
 *   reason: 'moved_out' | 'vehicle_sold' | 'violation' | 'parking_non_payment' | 'other',
 *   notes?: string,
 *   context?: string // optional context for why edit was made
 * }
 */

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { reason, notes, editContext } = body;

    if (!reason || !VALID_REASONS.includes(reason as TowReason)) {
      return NextResponse.json(
        { success: false, message: 'Valid reason required (moved_out, vehicle_sold, violation, parking_non_payment, or other)' },
        { status: 400 }
      );
    }

    // 'other' reason requires notes
    if (reason === 'other' && (!notes || !String(notes).trim())) {
      return NextResponse.json(
        { success: false, message: 'Notes are required when reason is "other"' },
        { status: 400 }
      );
    }

    const sessionUser = await getSessionUser();
    const by = sessionUser?.displayName || 'Admin';

    // Get current values for history
    const { data: currentEntry } = await supabaseAdmin
      .from('tow_manual_entries')
      .select('reason, notes, tenant_name, unit_number, building_address, linked_submission_id')
      .eq('id', id)
      .single();

    if (!currentEntry) {
      return NextResponse.json({ success: false, message: 'Manual entry not found' }, { status: 404 });
    }

    const priorReason = currentEntry.reason;
    const priorNotes = currentEntry.notes;
    const newReason = reason;
    const newNotes = notes ? String(notes).trim() : null;

    // Write to history before updating
    const { error: historyError } = await supabaseAdmin
      .from('tow_manual_entry_history')
      .insert({
        tow_manual_entry_id: id,
        prior_reason: priorReason,
        prior_notes: priorNotes,
        new_reason: newReason,
        new_notes: newNotes,
        edited_by: by,
        edit_context: editContext ? String(editContext).trim() : null,
      });

    if (historyError) {
      console.error('tow-manual-entry edit history error:', historyError);
      // Continue with update even if history fails
    }

    // Update the entry
    const { data, error } = await supabaseAdmin
      .from('tow_manual_entries')
      .update({
        reason: newReason,
        notes: newNotes,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('tow-manual-entry edit error:', error);
      return NextResponse.json({ success: false, message: 'Failed to update manual entry' }, { status: 500 });
    }

    // Log to audit trail
    await logAudit(
      sessionUser,
      'tow_manual_entry.edited',
      'tow_manual_entries',
      id,
      { 
        by,
        priorReason,
        newReason,
        priorNotes,
        newNotes,
        context: editContext || null
      },
      getClientIp(request),
    );

    // If reason is parking_non_payment, ensure tenant issue exists for scoring
    if (newReason === 'parking_non_payment') {
      const existing = await findExistingIssue('tow_manual_entry', id, 'parking_tow_listed');
      if (existing.success && (!existing.data || existing.data.length === 0)) {
        await createTenantIssue({
          tenant_name: currentEntry.tenant_name || 'Unknown',
          unit_number: currentEntry.unit_number,
          building_address: currentEntry.building_address,
          issue_type: 'parking_tow_listed',
          issue_date: new Date().toISOString(),
          reference_type: 'tow_manual_entry',
          reference_id: id,
          severity: 4, // Higher severity for non-payment
          notes: `Manual entry added to tow list for parking non-payment${newNotes ? `: ${newNotes}` : ''}`,
          created_by: by,
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      data,
      priorReason,
      newReason
    });
  } catch (error: any) {
    console.error('tow-manual-entry edit exception:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update manual entry' },
      { status: 500 }
    );
  }
}
