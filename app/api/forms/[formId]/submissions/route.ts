import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateToken } from '@/lib/generateToken';
import { getApplicableMembers, type HouseholdMember } from '@/lib/memberFilter';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  try {
    const { formId } = await params;
    const body = await request.json();

    const {
      tenant_name,
      building_address,
      unit_number,
      language,
      form_data,
    } = body;

    if (!tenant_name || !building_address || !unit_number || !form_data) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: tenant_name, building_address, unit_number, form_data' },
        { status: 400 }
      );
    }

    // Fetch templates for this form
    const { data: templates, error: templatesError } = await supabaseAdmin
      .from('form_document_templates')
      .select('*')
      .eq('form_id', formId)
      .order('display_order', { ascending: true });

    if (templatesError) throw templatesError;

    if (!templates || templates.length === 0) {
      return NextResponse.json(
        { success: false, message: `No document templates found for form_id '${formId}'. Register templates before accepting submissions.` },
        { status: 400 }
      );
    }

    const tenantAccessToken = generateToken();
    const householdMembers: HouseholdMember[] = Array.isArray(form_data.household_members)
      ? form_data.household_members
      : [];

    // Create the form_submissions row
    const { data: submission, error: submissionError } = await supabaseAdmin
      .from('form_submissions')
      .insert({
        form_type: formId,
        tenant_name,
        building_address,
        unit_number,
        language: language ?? 'en',
        form_data,
        review_granularity: 'per_document',
        tenant_access_token: tenantAccessToken,
        status: 'pending_review',
      })
      .select('id')
      .single();

    if (submissionError) throw submissionError;

    const submissionId = submission.id;

    // Seed form_submission_documents from templates
    const documentRows: object[] = [];

    for (const template of templates) {
      if (!template.per_person || template.applies_to === 'submission') {
        // One slot for the whole submission
        documentRows.push({
          form_submission_id: submissionId,
          doc_type: template.doc_type,
          label: template.label,
          required: template.required,
          display_order: template.display_order,
          person_slot: 0,
          status: 'missing',
          created_by: 'system',
        });
      } else {
        // One slot per applicable household member
        const members = getApplicableMembers(
          householdMembers,
          template.applies_to,
          template.member_filter
        );

        if (members.length === 0) {
          // No matching members — still seed one required slot so staff sees it as missing
          documentRows.push({
            form_submission_id: submissionId,
            doc_type: template.doc_type,
            label: template.label,
            required: template.required,
            display_order: template.display_order,
            person_slot: 0,
            status: 'missing',
            created_by: 'system',
          });
        } else {
          for (const { slot } of members) {
            documentRows.push({
              form_submission_id: submissionId,
              doc_type: template.doc_type,
              label: template.label,
              required: template.required,
              display_order: template.display_order,
              person_slot: slot,
              status: 'missing',
              created_by: 'system',
            });
          }
        }
      }
    }

    const { error: docsError } = await supabaseAdmin
      .from('form_submission_documents')
      .insert(documentRows);

    if (docsError) throw docsError;

    // Write initial document_review_summary
    const total = documentRows.length;
    await supabaseAdmin
      .from('form_submissions')
      .update({
        document_review_summary: {
          total,
          missing: total,
          submitted: 0,
          approved: 0,
          rejected: 0,
          waived: 0,
        },
      })
      .eq('id', submissionId);

    return NextResponse.json({
      success: true,
      data: {
        submission_id: submissionId,
        tenant_access_token: tenantAccessToken,
        document_slots_created: documentRows.length,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Per-document submission creation error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
