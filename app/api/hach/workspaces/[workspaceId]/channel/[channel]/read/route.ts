/**
 * POST /api/hach/workspaces/[workspaceId]/channel/[channel]/read
 * Mark a channel as read for the current HACH user.
 * Valid channels: 'hach', 'shared'
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireHachUser, getSessionUser } from '@/lib/auth';
import { resolveHachWorkspace } from '@/lib/workspaces/scope';
import { supabaseAdmin } from '@/lib/supabase';
import { safeHachJson } from '@/lib/hach/payload-filter';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; channel: string }> }
) {
  const guard = await requireHachUser();
  if (guard) return guard;

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { workspaceId, channel } = await params;

  // Validate channel parameter
  if (channel !== 'hach' && channel !== 'shared') {
    return NextResponse.json(
      { success: false, message: 'Invalid channel. Must be "hach" or "shared"' },
      { status: 400 }
    );
  }

  const resolved = await resolveHachWorkspace(workspaceId, sessionUser);
  if (!resolved) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  // Upsert read receipt
  const { error } = await supabaseAdmin
    .from('workspace_read_receipts')
    .upsert({
      user_id: sessionUser.userId,
      workspace_id: workspaceId,
      channel: channel,
      last_read_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,workspace_id,channel',
    });

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: safeHachJson({ marked_read: channel, at: new Date().toISOString() }),
  });
}
