import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { generateToken } from '@/lib/generateToken';

function getBaseUrl(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const proto = request.headers.get('x-forwarded-proto') ?? 'http';
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

function buildingUnitSlug(building: string, unit: string): string {
  const clean = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${clean(building)}-unit-${clean(unit)}`;
}

// Helper to enrich rows with assignee information
async function enrichWithAssignees(rows: any[]) {
  if (rows.length === 0) return;

  const appIds = rows.map((r: any) => r.id).filter(Boolean);
  if (appIds.length === 0) return;

  // Fetch assignees per application from application_documents
  const { data: docAssignees } = await supabaseAdmin
    .from('application_documents')
    .select('anchor_id, assigned_to_user_id, admin_users(display_name)')
    .eq('anchor_type', 'pbv_full_application')
    .in('anchor_id', appIds)
    .not('assigned_to_user_id', 'is', null);

  // Group assignees by application id
  const assigneesByApp = new Map<string, Map<string, { user_id: string; display_name: string; count: number }>>();
  
  for (const doc of (docAssignees ?? [])) {
    const anchorId = doc.anchor_id;
    const userId = doc.assigned_to_user_id;
    const userName = (doc.admin_users as unknown as { display_name: string } | null)?.display_name ?? 'Unknown';
    
    if (!assigneesByApp.has(anchorId)) {
      assigneesByApp.set(anchorId, new Map());
    }
    
    const userMap = assigneesByApp.get(anchorId)!;
    if (userMap.has(userId)) {
      userMap.get(userId)!.count++;
    } else {
      userMap.set(userId, { user_id: userId, display_name: userName, count: 1 });
    }
  }

  // Attach to rows
  for (const row of rows) {
    const userMap = assigneesByApp.get(row.id);
    if (userMap) {
      row.assignees = Array.from(userMap.values()).slice(0, 3); // Up to 3 assignees
      row.total_assignees = userMap.size;
    } else {
      row.assignees = [];
      row.total_assignees = 0;
    }
  }
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? '';
    const building = searchParams.get('building') ?? '';
    const assignedToMe = searchParams.get('assigned_to_me') === 'true';

    let query = supabaseAdmin
      .from('pbv_full_applications')
      .select(
        `id, created_at, head_of_household_name, building_address, unit_number,
         bedroom_count, household_size, intake_submitted_at,
         stanton_review_status,
         tenant_access_token, form_submission_id, preapp_id`
      )
      .order('created_at', { ascending: false });

    if (status) query = query.eq('stanton_review_status', status);
    if (building) query = query.ilike('building_address', `%${building}%`);

    const { data, error } = await query;
    if (error) throw error;

    let rows = data ?? [];

    // Filter by assigned_to_me if requested
    if (assignedToMe) {
      const allAppIds = rows.map((r: any) => r.id).filter(Boolean);
      const { data: assignedDocs } = await supabaseAdmin
        .from('application_documents')
        .select('anchor_id')
        .eq('anchor_type', 'pbv_full_application')
        .eq('assigned_to_user_id', sessionUser.userId)
        .in('anchor_id', allAppIds.length ? allAppIds : ['__none__']);
      
      const assignedAppIds = new Set((assignedDocs ?? []).map(d => d.anchor_id));
      rows = rows.filter((r: any) => assignedAppIds.has(r.id));
    }

    // Enrich with workspace unread counts and assignee information
    if (rows.length > 0) {
      const appIds = rows.map((r: any) => r.id);

      // Fetch workspaces for these applications
      const { data: workspaces } = await supabaseAdmin
        .from('review_workspaces')
        .select('id, anchor_id')
        .eq('workspace_type', 'pbv')
        .in('anchor_id', appIds);

      if (workspaces && workspaces.length > 0) {
        const workspaceIds = workspaces.map((w: any) => w.id);
        const workspaceByAnchor = new Map(workspaces.map((w: any) => [w.anchor_id, w.id]));

        // Fetch read receipts for this user across all these workspaces
        const { data: receipts } = await supabaseAdmin
          .from('workspace_read_receipts')
          .select('workspace_id, channel, last_read_at')
          .eq('user_id', sessionUser.userId)
          .in('workspace_id', workspaceIds)
          .in('channel', ['stanton', 'shared']);

        const receiptMap = new Map(
          (receipts ?? []).map((r: any) => [`${r.workspace_id}:${r.channel}`, r.last_read_at])
        );

        // Batch count unread stanton messages
        const { data: stantonMsgs } = await supabaseAdmin
          .from('stanton_workspace_messages')
          .select('workspace_id, author_user_id, created_at')
          .in('workspace_id', workspaceIds);

        // Batch count unread shared messages
        const { data: sharedMsgs } = await supabaseAdmin
          .from('shared_workspace_messages')
          .select('workspace_id, author_user_id, created_at')
          .in('workspace_id', workspaceIds);

        // Compute unread per workspace
        const unreadByWorkspace = new Map<string, { stanton: number; shared: number }>();
        for (const wsId of workspaceIds) {
          const lastReadStanton = receiptMap.get(`${wsId}:stanton`);
          const lastReadShared = receiptMap.get(`${wsId}:shared`);

          const stantonUnread = (stantonMsgs ?? []).filter((m: any) => {
            if (m.workspace_id !== wsId) return false;
            if (m.author_user_id === sessionUser.userId) return false;
            if (lastReadStanton && m.created_at <= lastReadStanton) return false;
            return true;
          }).length;

          const sharedUnread = (sharedMsgs ?? []).filter((m: any) => {
            if (m.workspace_id !== wsId) return false;
            if (m.author_user_id === sessionUser.userId) return false;
            if (lastReadShared && m.created_at <= lastReadShared) return false;
            return true;
          }).length;

          unreadByWorkspace.set(wsId, { stanton: stantonUnread, shared: sharedUnread });
        }

        const enriched = rows.map((r: any) => {
          const wsId = workspaceByAnchor.get(r.id);
          if (!wsId) return r;
          return { ...r, workspace_unread_counts: unreadByWorkspace.get(wsId) ?? { stanton: 0, shared: 0 } };
        });

        // Add assignee information
        await enrichWithAssignees(enriched);

        return NextResponse.json({ success: true, data: enriched });
      }
    }

    // Add assignee information even without workspace data
    await enrichWithAssignees(rows);

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('GET /api/admin/pbv/full-applications error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
    }

    const {
      preapp_id,
      building_address,
      unit_number,
      bedroom_count,
      head_of_household_name,
      language = 'en',
      phone,
      email,
    } = body as {
      preapp_id?: string;
      building_address: string;
      unit_number: string;
      bedroom_count?: number;
      head_of_household_name: string;
      language?: string;
      phone?: string | null;
      email?: string | null;
    };

    if (!building_address?.trim() || !unit_number?.trim() || !head_of_household_name?.trim()) {
      return NextResponse.json(
        { success: false, message: 'building_address, unit_number, and head_of_household_name are required' },
        { status: 400 }
      );
    }

    // Prevent duplicate invitations for the same building/unit
    const { data: existing } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, tenant_access_token')
      .eq('building_address', building_address.trim())
      .eq('unit_number', unit_number.trim())
      .is('intake_submitted_at', null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message: 'An active invitation already exists for this unit.',
          data: {
            id: existing.id,
            tenant_access_token: existing.tenant_access_token,
            magic_link: `${getBaseUrl(request)}/pbv-full-app/${existing.tenant_access_token}`,
          },
        },
        { status: 409 }
      );
    }

    // Create form_submissions row (foundation layer)
    const formSubmissionToken = generateToken();
    const { data: submission, error: subError } = await supabaseAdmin
      .from('form_submissions')
      .insert({
        form_type: 'pbv-full-application',
        tenant_name: head_of_household_name.trim(),
        building_address: building_address.trim(),
        unit_number: unit_number.trim(),
        language,
        review_granularity: 'per_document',
        status: 'pending_review',
        tenant_access_token: formSubmissionToken,
        created_by: 'admin',
      })
      .select('id')
      .single();

    if (subError) throw subError;

    // Create pbv_full_applications row
    const slug = buildingUnitSlug(building_address.trim(), unit_number.trim());
    const appToken = `${slug}-${generateToken()}`;
    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .insert({
        preapp_id: preapp_id ?? null,
        form_submission_id: submission.id,
        building_address: building_address.trim(),
        unit_number: unit_number.trim(),
        bedroom_count: bedroom_count ?? null,
        head_of_household_name: head_of_household_name.trim(),
        household_size: 1,
        tenant_access_token: appToken,
        phone: phone ?? null,
        email: email ?? null,
        created_by: 'admin',
      })
      .select('id, tenant_access_token')
      .single();

    if (appError) throw appError;

    const magicLink = `${getBaseUrl(request)}/pbv-full-app/${app.tenant_access_token}`;

    return NextResponse.json({
      success: true,
      data: {
        id: app.id,
        tenant_access_token: app.tenant_access_token,
        form_submission_token: formSubmissionToken,
        magic_link: magicLink,
      },
    });
  } catch (error: any) {
    console.error('POST /api/admin/pbv/full-applications error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
