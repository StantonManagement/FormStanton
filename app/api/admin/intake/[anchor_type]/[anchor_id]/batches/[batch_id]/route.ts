import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireStantonStaff } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ anchor_type: string; anchor_id: string; batch_id: string }>;
  }
) {
  const guard = await requireStantonStaff();
  if (guard) return guard;

  const { anchor_type, anchor_id, batch_id } = await params;

  const { data: batch, error: batchErr } = await supabaseAdmin
    .from('intake_batches')
    .select('id, anchor_type, anchor_id, status, source_label, total_pages, committed_at, committed_document_count, created_at')
    .eq('id', batch_id)
    .single();

  if (batchErr || !batch) {
    return NextResponse.json({ success: false, message: 'Batch not found' }, { status: 404 });
  }

  if (batch.anchor_type !== anchor_type || batch.anchor_id !== anchor_id) {
    return NextResponse.json(
      { success: false, message: 'Batch does not belong to this application' },
      { status: 403 }
    );
  }

  const { data: pages, error: pagesErr } = await supabaseAdmin
    .from('intake_pages')
    .select(
      'id, global_index, page_index, source_file_name, image_path, ocr_confidence, suggested_doc_type, suggested_person_slot, staged_assignment'
    )
    .eq('batch_id', batch_id)
    .order('global_index');

  if (pagesErr) {
    return NextResponse.json({ success: false, message: 'Failed to fetch pages' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: { batch, pages: pages ?? [] } });
}
