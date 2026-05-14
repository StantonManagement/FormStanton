import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireStantonStaff } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ anchor_type: string; anchor_id: string }>;
  }
) {
  const guard = await requireStantonStaff();
  if (guard) return guard;

  const { anchor_type, anchor_id } = await params;

  const { data: batches, error } = await supabaseAdmin
    .from('intake_batches')
    .select(
      'id, status, source_label, total_pages, committed_at, committed_document_count, created_at'
    )
    .eq('anchor_type', anchor_type)
    .eq('anchor_id', anchor_id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, message: 'Failed to fetch batches' }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: batches ?? [] });
}
