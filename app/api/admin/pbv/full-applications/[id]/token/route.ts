import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import { generateToken } from '@/lib/generateToken';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const { data: existing } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, intake_submitted_at, form_submission_id')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    }
    if (existing.intake_submitted_at) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Cannot regenerate the invite link after the tenant has submitted their intake form. Use the document portal link instead.',
        },
        { status: 400 }
      );
    }

    // Also block if documents have already been uploaded — the old token is embedded
    // in the document portal link that the tenant may already be using.
    //
    // PRD-01 NOTE: This guard intentionally still queries form_submission_documents.
    // The tenant upload path (/api/t/[token]/documents/[documentId]) writes to
    // form_submission_documents (not application_documents) because tenant-side
    // document upload is not yet migrated — that migration is scoped to PRD-02
    // (packet intake decoupling). While the tenant path remains submission-keyed,
    // this guard correctly reflects whether the tenant has uploaded anything.
    //
    // When PRD-02 migrates the tenant upload path, retarget this check to:
    //   application_documents WHERE anchor_type = 'pbv_full_application'
    //   AND anchor_id = <id> AND revision > 0
    // and remove the form_submission_id dependency.
    if (existing.form_submission_id) {
      const { count } = await supabaseAdmin
        .from('form_submission_documents')
        .select('id', { count: 'exact', head: true })
        .eq('form_submission_id', existing.form_submission_id)
        .gt('revision', 0);
      if ((count ?? 0) > 0) {
        return NextResponse.json(
          {
            success: false,
            message:
              'Cannot regenerate the invite link — the tenant has already uploaded documents. Use the document portal link instead.',
          },
          { status: 400 }
        );
      }
    }

    const newToken = generateToken();
    const { error } = await supabaseAdmin
      .from('pbv_full_applications')
      .update({ tenant_access_token: newToken })
      .eq('id', id);

    if (error) throw error;

    const magicLink = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/pbv-full-app/${newToken}`;
    return NextResponse.json({ success: true, data: { tenant_access_token: newToken, magic_link: magicLink } });
  } catch (error: any) {
    console.error('PATCH /api/admin/pbv/full-applications/[id]/token error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
