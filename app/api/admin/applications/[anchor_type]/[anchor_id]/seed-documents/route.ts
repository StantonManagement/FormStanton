import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { seedDocumentsForApplication } from '@/lib/documents/seedFromTemplates';
import type { HouseholdMember } from '@/lib/memberFilter';

export const dynamic = 'force-dynamic';

const ANCHOR_TYPE_FORM_ID_MAP: Record<string, string> = {
  pbv_full_application: 'pbv-full-application',
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ anchor_type: string; anchor_id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { anchor_type, anchor_id } = await params;

    if (!ANCHOR_TYPE_FORM_ID_MAP[anchor_type]) {
      return NextResponse.json(
        { success: false, message: `Unknown anchor_type: ${anchor_type}` },
        { status: 400 }
      );
    }

    const formId = ANCHOR_TYPE_FORM_ID_MAP[anchor_type];

    const body = await request.json().catch(() => ({}));
    const householdMembers: HouseholdMember[] = Array.isArray(body.household_members)
      ? body.household_members
      : [];

    const result = await seedDocumentsForApplication({
      formId,
      anchorType: anchor_type,
      anchorId: anchor_id,
      householdMembers,
    });

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[seed-documents] error:', message);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
