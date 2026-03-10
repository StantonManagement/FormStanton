import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { submissionId, exported, adminName } = await request.json();

    if (!submissionId) {
      return NextResponse.json(
        { success: false, message: 'Submission ID is required' },
        { status: 400 }
      );
    }

    const updateData: any = {
      vehicle_exported: exported,
    };

    if (exported) {
      updateData.vehicle_exported_at = new Date().toISOString();
      updateData.vehicle_exported_by = adminName || 'Admin';
    } else {
      updateData.vehicle_exported_at = null;
      updateData.vehicle_exported_by = null;
    }

    const { error } = await supabaseAdmin
      .from('submissions')
      .update(updateData)
      .eq('id', submissionId);

    if (error) {
      console.error('Error updating export status:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to update export status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: exported ? 'Marked as exported' : 'Marked as not exported',
    });

  } catch (error: any) {
    console.error('Toggle export error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update export status' },
      { status: 500 }
    );
  }
}
