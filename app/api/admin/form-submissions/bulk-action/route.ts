import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();

    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, submissionIds, value } = body;

    // Get identity from session instead of request body
    const sessionUser = await getSessionUser();
    const actorName = sessionUser?.displayName || body.changed_by || 'Unknown';

    if (!action || !submissionIds || !Array.isArray(submissionIds)) {
      return NextResponse.json(
        { success: false, message: 'Invalid request: action and submissionIds required' },
        { status: 400 }
      );
    }

    const results = [];

    for (const id of submissionIds) {
      try {
        let updates: any = {};

        switch (action) {
          case 'assign':
            updates.assigned_to = value;
            break;

          case 'mark_sent_to_appfolio':
            const { data: current } = await supabaseAdmin
              .from('form_submissions')
              .select('status, status_history, sent_to_appfolio_at')
              .eq('id', id)
              .single();

            if (current && !current.sent_to_appfolio_at) {
              updates.status = 'sent_to_appfolio';
              updates.sent_to_appfolio_at = new Date().toISOString();
              updates.sent_to_appfolio_by = actorName;

              const statusHistory = current.status_history || [];
              updates.status_history = [
                ...statusHistory,
                {
                  status: 'sent_to_appfolio',
                  changed_by: actorName,
                  changed_at: new Date().toISOString(),
                  notes: 'Bulk marked as sent to Appfolio',
                },
              ];
            }
            break;

          case 'set_priority':
            updates.priority = value;
            break;

          default:
            throw new Error(`Unknown action: ${action}`);
        }

        if (Object.keys(updates).length > 0) {
          const { error } = await supabaseAdmin
            .from('form_submissions')
            .update(updates)
            .eq('id', id);

          if (error) {
            results.push({ id, success: false, error: error.message });
          } else {
            results.push({ id, success: true });
          }
        } else {
          results.push({ id, success: true, skipped: true });
        }
      } catch (err: any) {
        results.push({ id, success: false, error: err.message });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    await logAudit(sessionUser, 'submission.bulk_action', 'form_submission', undefined, {
      action, count: submissionIds.length, successCount, failureCount,
    }, getClientIp(request));

    return NextResponse.json({
      success: true,
      message: `Bulk action completed: ${successCount} succeeded, ${failureCount} failed`,
      results,
    });
  } catch (error: any) {
    console.error('Bulk action error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
