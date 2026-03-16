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
    const { submissionId, documentType, note } = body;

    const sessionUser = await getSessionUser();
    const uploadedBy = sessionUser?.displayName || body.uploadedBy || 'Admin';

    if (!submissionId || !documentType) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Map document type to column names
    const columnMap: Record<string, string> = {
      'pet_addendum': 'pet_addendum_uploaded_to_appfolio',
      'vehicle_addendum': 'vehicle_addendum_uploaded_to_appfolio',
      'insurance': 'insurance_uploaded_to_appfolio',
    };

    const baseColumn = columnMap[documentType];
    if (!baseColumn) {
      return NextResponse.json(
        { success: false, message: 'Invalid document type' },
        { status: 400 }
      );
    }

    const updateData: Record<string, any> = {
      [baseColumn]: true,
      [`${baseColumn}_at`]: new Date().toISOString(),
      [`${baseColumn}_by`]: uploadedBy,
    };

    if (note) {
      updateData[`${documentType}_upload_note`] = note;
    }

    const { data, error } = await supabaseAdmin
      .from('submissions')
      .update(updateData)
      .eq('id', submissionId)
      .select()
      .single();

    if (error) {
      console.error('Error marking document uploaded:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to update document status' },
        { status: 500 }
      );
    }

    await logAudit(sessionUser, 'appfolio.document_upload', 'submission', submissionId, {
      documentType, uploadedBy,
    }, getClientIp(request));

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error: any) {
    console.error('Mark AppFolio upload error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to mark document uploaded' },
      { status: 500 }
    );
  }
}
