import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const submissionId = formData.get('submissionId') as string;
    const insuranceProofFile = formData.get('insuranceProof') as File | null;

    if (!submissionId) {
      return NextResponse.json(
        { success: false, message: 'Submission ID is required' },
        { status: 400 }
      );
    }

    if (!insuranceProofFile) {
      return NextResponse.json(
        { success: false, message: 'Insurance proof file is required' },
        { status: 400 }
      );
    }

    // Upload the insurance file
    let insuranceProofPath = null;
    const fileName = `${submissionId}_insurance.${insuranceProofFile.name.split('.').pop()}`;
    const buffer = await insuranceProofFile.arrayBuffer();
    const { data, error: uploadError } = await supabaseAdmin.storage
      .from('submissions')
      .upload(`insurance/${fileName}`, buffer, {
        contentType: insuranceProofFile.type,
        upsert: true,
      });

    if (uploadError) throw uploadError;
    insuranceProofPath = data.path;

    // Update the submission
    const { error: updateError } = await supabaseAdmin
      .from('submissions')
      .update({
        insurance_file: insuranceProofPath,
        insurance_upload_pending: false,
      })
      .eq('id', submissionId);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: 'Insurance documents uploaded successfully',
    });

  } catch (error: any) {
    console.error('Update insurance error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Update failed' },
      { status: 500 }
    );
  }
}
