import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
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
    const { submissionId, documentType } = body;

    if (!submissionId || !documentType) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!['pet_addendum', 'insurance', 'vehicle_addendum'].includes(documentType)) {
      return NextResponse.json(
        { success: false, message: 'Invalid document type' },
        { status: 400 }
      );
    }

    // Determine column to read/clear based on document type
    let fileColumn: string;
    const columnsToNull: Record<string, null> = {};

    switch (documentType) {
      case 'pet_addendum':
        fileColumn = 'pet_addendum_file';
        columnsToNull.pet_addendum_file = null;
        break;
      case 'insurance':
        fileColumn = 'insurance_file';
        columnsToNull.insurance_file = null;
        break;
      case 'vehicle_addendum':
        fileColumn = 'vehicle_addendum_file';
        columnsToNull.vehicle_addendum_file = null;
        columnsToNull.vehicle_addendum_file_uploaded_at = null;
        columnsToNull.vehicle_addendum_file_uploaded_by = null;
        break;
      default:
        return NextResponse.json(
          { success: false, message: 'Invalid document type' },
          { status: 400 }
        );
    }

    // Fetch the current file path
    const { data: submission, error: fetchError } = await supabaseAdmin
      .from('submissions')
      .select(fileColumn)
      .eq('id', submissionId)
      .single();

    if (fetchError || !submission) {
      return NextResponse.json(
        { success: false, message: 'Submission not found' },
        { status: 404 }
      );
    }

    const filePath = (submission as any)[fileColumn];

    // Delete file from storage if it exists
    if (filePath) {
      const { error: storageError } = await supabaseAdmin.storage
        .from('submissions')
        .remove([filePath]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
        // Continue to clear the DB column even if storage delete fails
      }
    }

    // Clear the column(s) on the submission record
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('submissions')
      .update(columnsToNull)
      .eq('id', submissionId)
      .select()
      .single();

    if (updateError) {
      console.error('Submission update error:', updateError);
      return NextResponse.json(
        { success: false, message: 'Failed to update submission' },
        { status: 500 }
      );
    }

    const sessionUser = await getSessionUser();
    await logAudit(sessionUser, 'document.delete', 'submission', submissionId, {
      documentType, filePath,
    }, getClientIp(request));

    return NextResponse.json({
      success: true,
      data: updated,
    });

  } catch (error: any) {
    console.error('Delete document error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to delete document' },
      { status: 500 }
    );
  }
}
