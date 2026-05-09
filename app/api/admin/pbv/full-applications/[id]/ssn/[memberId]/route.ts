import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getRealSessionUser, userHasPermission } from '@/lib/auth';
import { decryptSsn } from '@/lib/ssnEncryption';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const actor = await getRealSessionUser();

  if (!actor) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  if (!userHasPermission(actor, 'pbv-full-applications', 'read_ssn')) {
    return NextResponse.json(
      { success: false, message: 'Forbidden — pbv_reviewer role required to read SSN' },
      { status: 403 }
    );
  }

  try {
    const { id, memberId } = await params;

    const { data: member, error } = await supabaseAdmin
      .from('pbv_household_members')
      .select('id, full_application_id, name, ssn_encrypted, ssn_last_four')
      .eq('id', memberId)
      .eq('full_application_id', id)
      .single();

    if (error || !member) {
      return NextResponse.json({ success: false, message: 'Member not found' }, { status: 404 });
    }

    if (!member.ssn_encrypted) {
      return NextResponse.json(
        { success: false, message: 'No SSN on file for this member' },
        { status: 404 }
      );
    }

    const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null;

    await supabaseAdmin.from('pbv_access_log').insert({
      user_id: actor.userId,
      action: 'read_ssn',
      resource_type: 'pbv_household_member',
      resource_id: memberId,
      ip_address: ip,
      notes: `SSN read for member "${member.name}" on application ${id}`,
      created_by: actor.userId,
    });

    const ssn = decryptSsn(member.ssn_encrypted);

    return NextResponse.json({
      success: true,
      data: { ssn },
    });
  } catch (error: any) {
    console.error('GET /api/admin/pbv/full-applications/[id]/ssn/[memberId] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
