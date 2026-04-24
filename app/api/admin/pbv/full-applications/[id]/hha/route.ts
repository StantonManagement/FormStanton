import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errorMessage';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

const HHA_TEMPLATE_BUCKET = 'hha-templates';
const HHA_TEMPLATE_PATH = 'hca-application.docx';
const DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const action = new URL(request.url).searchParams.get('action');

    if (action === 'upload-template') {
      const formData = await request.formData().catch(() => null);
      const templateFile = formData?.get('template');

      if (!(templateFile instanceof File)) {
        return NextResponse.json(
          { success: false, message: 'Template file is required.' },
          { status: 400 }
        );
      }

      const isDocx = templateFile.name.toLowerCase().endsWith('.docx');
      if (!isDocx) {
        return NextResponse.json(
          { success: false, message: 'Template must be a .docx file.' },
          { status: 400 }
        );
      }

      if (templateFile.size <= 0) {
        return NextResponse.json(
          { success: false, message: 'Template file is empty.' },
          { status: 400 }
        );
      }

      const buffer = await templateFile.arrayBuffer();
      const { error: uploadError } = await supabaseAdmin.storage
        .from(HHA_TEMPLATE_BUCKET)
        .upload(HHA_TEMPLATE_PATH, buffer, {
          contentType: DOCX_CONTENT_TYPE,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      return NextResponse.json({
        success: true,
        data: {
          bucket: HHA_TEMPLATE_BUCKET,
          path: HHA_TEMPLATE_PATH,
          uploaded_file_name: templateFile.name,
          uploaded_at: new Date().toISOString(),
        },
      });
    }

    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select(
        `id, head_of_household_name, building_address, unit_number, bedroom_count,
         household_size, total_annual_income, stanton_review_status,
         dv_status, homeless_at_admission, claiming_medical_deduction,
         has_childcare_expense, reasonable_accommodation_requested,
         form_submission_id, tenant_access_token`
      )
      .eq('id', id)
      .single();

    if (appError || !app) {
      return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
    }

    if (app.stanton_review_status !== 'approved') {
      return NextResponse.json(
        { success: false, message: 'HHA application can only be generated after Stanton review is approved.' },
        { status: 400 }
      );
    }

    const { data: docs, error: docsError } = await supabaseAdmin
      .from('form_submission_documents')
      .select('status, required')
      .eq('form_submission_id', app.form_submission_id);

    if (docsError) throw docsError;

    const requiredDocs = (docs ?? []).filter((d) => d.required);
    const allApproved = requiredDocs.every(
      (d) => d.status === 'approved' || d.status === 'waived'
    );

    if (!allApproved) {
      return NextResponse.json(
        {
          success: false,
          message: 'All required documents must be approved or waived before generating the HHA application.',
        },
        { status: 400 }
      );
    }

    const { data: members, error: membersError } = await supabaseAdmin
      .from('pbv_household_members')
      .select('slot, name, date_of_birth, age, relationship, citizenship_status, annual_income, disability, student')
      .eq('full_application_id', id)
      .order('slot', { ascending: true });

    if (membersError) throw membersError;

    const { data: templateData, error: templateError } = await supabaseAdmin.storage
      .from(HHA_TEMPLATE_BUCKET)
      .download(HHA_TEMPLATE_PATH);

    if (templateError || !templateData) {
      return NextResponse.json(
        {
          success: false,
          message:
            'HHA template not yet configured. Upload the HACH HC application template to the hha-templates storage bucket as hca-application.docx.',
        },
        { status: 422 }
      );
    }

    const templateBuffer = Buffer.from(await templateData.arrayBuffer());
    const pizZip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(pizZip, { paragraphLoop: true, linebreaks: true });

    const hohMember = members?.[0];
    const today = new Date();

    doc.render({
      applicant_name: app.head_of_household_name,
      building_address: app.building_address,
      unit_number: app.unit_number,
      bedroom_count: app.bedroom_count ?? '',
      household_size: app.household_size,
      total_annual_income: app.total_annual_income ?? '',
      dv_status: app.dv_status ? 'Yes' : 'No',
      homeless_at_admission: app.homeless_at_admission ? 'Yes' : 'No',
      claiming_medical_deduction: app.claiming_medical_deduction ? 'Yes' : 'No',
      has_childcare_expense: app.has_childcare_expense ? 'Yes' : 'No',
      reasonable_accommodation_requested: app.reasonable_accommodation_requested ? 'Yes' : 'No',
      generation_date: today.toLocaleDateString('en-US'),
      hoh_dob: hohMember?.date_of_birth ?? '',
      members: (members ?? []).map((m) => ({
        name: m.name,
        dob: m.date_of_birth ?? '',
        age: m.age ?? '',
        relationship: m.relationship,
        citizenship_status: m.citizenship_status,
        annual_income: m.annual_income ?? 0,
        disability: m.disability ? 'Yes' : 'No',
        student: m.student ? 'Yes' : 'No',
      })),
    });

    const outputBuffer = doc.getZip().generate({ type: 'arraybuffer' }) as ArrayBuffer;

    const lastName = (app.head_of_household_name ?? 'Unknown').split(' ').pop() ?? 'Unknown';
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `HHA_${lastName}_${app.unit_number}_${dateStr}.docx`;
    const storagePath = `hha-applications/${id}/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(HHA_TEMPLATE_BUCKET)
      .upload(storagePath, outputBuffer, {
        contentType: DOCX_CONTENT_TYPE,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    await supabaseAdmin
      .from('pbv_full_applications')
      .update({ hha_application_file: storagePath, updated_at: new Date().toISOString() })
      .eq('id', id);

    return new NextResponse(outputBuffer, {
      status: 200,
      headers: {
        'Content-Type': DOCX_CONTENT_TYPE,
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: unknown) {
    console.error('POST /api/admin/pbv/full-applications/[id]/hha error:', error);
    return NextResponse.json(
      { success: false, message: getErrorMessage(error, 'Failed to process HHA request.') },
      { status: 500 }
    );
  }
}
