import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireStantonStaff } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export interface StagedAssignment {
  target: 'doc_row' | 'custom' | 'discard';
  doc_row_id?: string;
  group_id?: string;
  custom_label?: string;
}

export async function PATCH(
  request: NextRequest,
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
    .select('id, anchor_type, anchor_id, status')
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
  if (batch.status === 'committed' || batch.status === 'abandoned') {
    return NextResponse.json(
      { success: false, message: `Batch is ${batch.status} and cannot be modified` },
      { status: 409 }
    );
  }

  let body: { assignments: Array<{ page_id: string; assignment: StagedAssignment | null }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.assignments)) {
    return NextResponse.json(
      { success: false, message: 'assignments must be an array' },
      { status: 400 }
    );
  }

  const updates = body.assignments.map(({ page_id, assignment }) =>
    supabaseAdmin
      .from('intake_pages')
      .update({ staged_assignment: assignment ?? null })
      .eq('id', page_id)
      .eq('batch_id', batch_id)
  );

  const results = await Promise.all(updates);
  const failed = results.filter((r) => r.error);
  if (failed.length > 0) {
    console.error('[intake/assignments] Partial update failure:', failed.map((r) => r.error));
    return NextResponse.json(
      { success: false, message: `${failed.length} assignment(s) failed to save` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
