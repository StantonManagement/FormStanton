import { NextRequest, NextResponse } from 'next/server';
import { requireHachUser } from '@/lib/auth';
import { fetchRejectionTemplates } from '@/lib/rejection-templates';

/**
 * GET /api/hach/rejection-reasons
 * Returns all active rejection reason templates.
 * Used by the RejectDialog for live preview.
 */
export async function GET(_request: NextRequest) {
  const guard = await requireHachUser();
  if (guard) return guard;

  try {
    const templates = await fetchRejectionTemplates();
    return NextResponse.json({ success: true, data: templates });
  } catch (error: any) {
    console.error('[hach/rejection-reasons] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
