import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import JSZip from 'jszip';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, head_of_household_name, building_address, unit_number, form_submission_id, stanton_review_status, hha_application_file')
      .eq('id', id)
      .single();

    if (appError || !app) {
      return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
    }

    const { data: members } = await supabaseAdmin
      .from('pbv_household_members')
      .select('slot, name, date_of_birth, relationship, annual_income, documented_income, citizenship_status')
      .eq('full_application_id', id)
      .order('slot', { ascending: true });

    const { data: documents, error: docsError } = await supabaseAdmin
      .from('form_submission_documents')
      .select('id, doc_type, label, person_slot, revision, status, file_name, storage_path, reviewer, reviewed_at, rejection_reason')
      .eq('form_submission_id', app.form_submission_id)
      .order('display_order', { ascending: true })
      .order('person_slot', { ascending: true });

    if (docsError) throw docsError;

    const exportable = (documents ?? []).filter(
      (d) => d.storage_path && (d.status === 'approved' || d.status === 'waived' || d.status === 'submitted')
    );

    const zip = new JSZip();

    if (app.hha_application_file) {
      const { data: hhaData, error: hhaDownloadError } = await supabaseAdmin.storage
        .from('hha-templates')
        .download(app.hha_application_file);

      if (hhaDownloadError) {
        console.error(`Failed to download generated HHA file ${app.hha_application_file}:`, hhaDownloadError);
      } else {
        const hhaBuffer = await hhaData.arrayBuffer();
        const hhaFileName = app.hha_application_file.split('/').pop() ?? 'hha_application.docx';
        zip.file(`hha/${hhaFileName}`, hhaBuffer);
      }
    }

    const manifestLines = [
      'doc_type,label,person_slot,revision,status,file_name,reviewer,reviewed_at,rejection_reason',
    ];

    for (const doc of exportable) {
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from('form-submissions')
        .download(doc.storage_path);

      if (downloadError) {
        console.error(`Failed to download ${doc.storage_path}:`, downloadError);
        continue;
      }

      const buffer = await fileData.arrayBuffer();
      zip.file(doc.file_name, buffer);

      manifestLines.push(
        [
          doc.doc_type,
          `"${doc.label}"`,
          doc.person_slot,
          doc.revision,
          doc.status,
          doc.file_name,
          doc.reviewer ?? '',
          doc.reviewed_at ?? '',
          doc.rejection_reason ? `"${doc.rejection_reason}"` : '',
        ].join(',')
      );
    }

    const incomeLines = ['slot,name,relationship,claimed_income,documented_income,citizenship_status'];
    for (const m of members ?? []) {
      incomeLines.push(
        [
          m.slot,
          `"${m.name}"`,
          m.relationship,
          m.annual_income ?? '',
          m.documented_income ?? '',
          m.citizenship_status,
        ].join(',')
      );
    }

    zip.file('manifest.csv', manifestLines.join('\n'));
    zip.file('household_income.csv', incomeLines.join('\n'));

    const coverSheet = [
      `HACH Handoff Package`,
      `Applicant: ${app.head_of_household_name}`,
      `Building: ${app.building_address} — Unit ${app.unit_number}`,
      `Stanton Review Status: ${app.stanton_review_status}`,
      `Generated: ${new Date().toLocaleString('en-US')}`,
      ``,
      `Files in this package: ${exportable.length} documents`,
      `Household members: ${(members ?? []).length}`,
    ].join('\n');

    zip.file('cover_sheet.txt', coverSheet);

    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });

    const lastName = (app.head_of_household_name ?? 'Unknown')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 30);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const zipName = `HACH_${lastName}_${app.unit_number}_${dateStr}.zip`;

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipName}"`,
      },
    });
  } catch (error: any) {
    console.error('GET /api/admin/pbv/full-applications/[id]/export error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
