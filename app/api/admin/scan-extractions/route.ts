import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    if (!batchId) {
      return NextResponse.json({ success: false, message: 'Batch ID required' }, { status: 400 });
    }

    // Get all extractions for this batch
    const { data: extractions, error } = await supabase
      .from('scan_extractions')
      .select('*')
      .eq('batch_id', batchId)
      .order('page_number', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, data: extractions });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { extractionId, finalData, reviewed, reviewedBy } = await request.json();

    if (!extractionId) {
      return NextResponse.json({ success: false, message: 'Extraction ID required' }, { status: 400 });
    }

    const updateData: any = {};
    
    if (finalData !== undefined) {
      updateData.final_data = finalData;
    }
    
    if (reviewed !== undefined) {
      updateData.reviewed = reviewed;
      if (reviewed) {
        updateData.reviewed_at = new Date().toISOString();
        if (reviewedBy) {
          updateData.reviewed_by = reviewedBy;
        }
      }
    }

    const { data, error } = await supabase
      .from('scan_extractions')
      .update(updateData)
      .eq('id', extractionId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
