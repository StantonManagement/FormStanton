import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';

/**
 * GET /api/admin/compliance/tow-reason-history
 * Fetch the edit history for a submission's tow reason.
 * 
 * Query params:
 *   submissionId: string - the submission ID to fetch history for
 *   type: 'submission' | 'manual' - optional, defaults to 'submission'
 */

export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const submissionId = request.nextUrl.searchParams.get('submissionId');
    const manualEntryId = request.nextUrl.searchParams.get('manualEntryId');
    const type = request.nextUrl.searchParams.get('type') || 'submission';

    if (type === 'submission') {
      if (!submissionId) {
        return NextResponse.json({ success: false, message: 'Submission ID required' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('tow_reason_history')
        .select('*')
        .eq('submission_id', submissionId)
        .order('edited_at', { ascending: false });

      if (error) {
        console.error('tow-reason-history GET error:', error);
        return NextResponse.json({ success: false, message: 'Failed to fetch reason history' }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        history: data || [],
        count: data?.length || 0,
        type: 'submission',
        submissionId
      });
    } else {
      // manual entry history
      if (!manualEntryId) {
        return NextResponse.json({ success: false, message: 'Manual entry ID required' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('tow_manual_entry_history')
        .select('*')
        .eq('tow_manual_entry_id', manualEntryId)
        .order('edited_at', { ascending: false });

      if (error) {
        console.error('tow-reason-history GET error (manual):', error);
        return NextResponse.json({ success: false, message: 'Failed to fetch manual entry history' }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        history: data || [],
        count: data?.length || 0,
        type: 'manual',
        manualEntryId
      });
    }
  } catch (error: any) {
    console.error('tow-reason-history GET exception:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch reason history' },
      { status: 500 }
    );
  }
}
