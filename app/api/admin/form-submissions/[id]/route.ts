import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();

    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const { data: submission, error } = await supabaseAdmin
      .from('form_submissions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!submission) {
      return NextResponse.json(
        { success: false, message: 'Submission not found' },
        { status: 404 }
      );
    }

    const { data: relatedSubmissions } = await supabaseAdmin
      .from('form_submissions')
      .select('id, form_type, submitted_at, status')
      .eq('tenant_name', submission.tenant_name)
      .neq('id', id)
      .order('submitted_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      success: true,
      data: submission,
      relatedSubmissions: relatedSubmissions || [],
    });
  } catch (error: any) {
    console.error('Form submission detail fetch error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();

    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Get identity from session instead of request body
    const sessionUser = await getSessionUser();
    const actorName = sessionUser?.displayName || body.changed_by || 'Unknown';

    const {
      status,
      assigned_to,
      priority,
      admin_notes,
      denial_reason,
      revision_notes,
    } = body;

    const { data: currentSubmission } = await supabaseAdmin
      .from('form_submissions')
      .select('status, status_history, sent_to_appfolio_at, review_granularity')
      .eq('id', id)
      .single();

    // Per-document submissions derive status from child documents; direct writes are rejected
    if (currentSubmission?.review_granularity === 'per_document') {
      if (status !== undefined || denial_reason !== undefined || revision_notes !== undefined) {
        return NextResponse.json(
          { success: false, message: 'Submission uses per_document review — status, denial_reason, and revision_notes are derived from child documents. Use POST /api/admin/submissions/[id]/documents/[documentId]/review instead.' },
          { status: 400 }
        );
      }
    }

    const updates: any = {};

    if (status !== undefined) {
      updates.status = status;

      if (status === 'sent_to_appfolio' && !currentSubmission?.sent_to_appfolio_at) {
        updates.sent_to_appfolio_at = new Date().toISOString();
        updates.sent_to_appfolio_by = actorName;
      }

      const statusHistory = currentSubmission?.status_history || [];
      updates.status_history = [
        ...statusHistory,
        {
          status,
          changed_by: actorName,
          changed_at: new Date().toISOString(),
          notes: body.status_change_notes || null,
        },
      ];
    }

    if (assigned_to !== undefined) {
      updates.assigned_to = assigned_to;
    }

    if (priority !== undefined) {
      updates.priority = priority;
    }

    if (admin_notes !== undefined) {
      updates.admin_notes = admin_notes;
    }

    if (denial_reason !== undefined) {
      updates.denial_reason = denial_reason;
    }

    if (revision_notes !== undefined) {
      updates.revision_notes = revision_notes;
    }

    const { data, error } = await supabaseAdmin
      .from('form_submissions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await logAudit(sessionUser, 'submission.update', 'form_submission', id, {
      status, assigned_to, priority, admin_notes: !!admin_notes, denial_reason: !!denial_reason,
    }, getClientIp(request));

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Form submission update error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
