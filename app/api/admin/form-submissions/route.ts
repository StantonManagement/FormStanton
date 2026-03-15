import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();

    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const formType = searchParams.get('formType');
    const building = searchParams.get('building');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const assignedTo = searchParams.get('assignedTo');
    const priority = searchParams.get('priority');
    const language = searchParams.get('language');
    const view = searchParams.get('view');
    const search = searchParams.get('search');

    let query = supabaseAdmin
      .from('form_submissions')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (formType && formType !== 'all') {
      query = query.eq('form_type', formType);
    }

    if (building && building !== 'all') {
      query = query.eq('building_address', building);
    }

    if (startDate) {
      query = query.gte('submitted_at', startDate);
    }

    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      query = query.lte('submitted_at', endDateTime.toISOString());
    }

    if (assignedTo && assignedTo !== 'all') {
      if (assignedTo === 'unassigned') {
        query = query.is('assigned_to', null);
      } else {
        query = query.eq('assigned_to', assignedTo);
      }
    }

    if (priority && priority !== 'all') {
      query = query.eq('priority', priority);
    }

    if (language && language !== 'all') {
      query = query.eq('language', language);
    }

    const { data, error } = await query;

    if (error) throw error;

    let submissions = data || [];

    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      submissions = submissions.filter((sub) => {
        const tenantName = (sub.tenant_name || '').toLowerCase();
        const buildingAddr = (sub.building_address || '').toLowerCase();
        const unitNum = (sub.unit_number || '').toLowerCase();
        const formData = sub.form_data || {};
        const phone = (formData.phone || '').toLowerCase();
        const email = (formData.email || '').toLowerCase();

        return (
          tenantName.includes(searchLower) ||
          buildingAddr.includes(searchLower) ||
          unitNum.includes(searchLower) ||
          phone.includes(searchLower) ||
          email.includes(searchLower)
        );
      });
    }

    if (view) {
      switch (view) {
        case 'needs_action':
          submissions = submissions.filter(
            (sub) => sub.status === 'pending_review' || sub.status === 'revision_requested'
          );
          break;
        case 'approved_not_sent':
          submissions = submissions.filter(
            (sub) => sub.status === 'approved' && !sub.sent_to_appfolio_at
          );
          break;
        case 'ready_for_appfolio':
          submissions = submissions.filter(
            (sub) => sub.status === 'approved' && !sub.sent_to_appfolio_at
          );
          break;
        case 'waiting_on_tenant':
          submissions = submissions.filter((sub) => sub.status === 'revision_requested');
          break;
      }
    }

    const statusCounts = {
      pending_review: submissions.filter((s) => s.status === 'pending_review').length,
      under_review: submissions.filter((s) => s.status === 'under_review').length,
      approved: submissions.filter((s) => s.status === 'approved').length,
      denied: submissions.filter((s) => s.status === 'denied').length,
      revision_requested: submissions.filter((s) => s.status === 'revision_requested').length,
      sent_to_appfolio: submissions.filter((s) => s.status === 'sent_to_appfolio').length,
      completed: submissions.filter((s) => s.status === 'completed').length,
    };

    const formTypesQuery = await supabaseAdmin
      .from('form_submissions')
      .select('form_type')
      .order('form_type');

    const formTypes = formTypesQuery.data
      ? [...new Set(formTypesQuery.data.map((item) => item.form_type))].filter(Boolean)
      : [];

    return NextResponse.json({
      success: true,
      data: submissions,
      meta: {
        total: submissions.length,
        statusCounts,
        formTypes,
      },
    });
  } catch (error: any) {
    console.error('Form submissions fetch error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
