import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import { buildingToAssetId } from '@/lib/buildingAssetIds';
import JSZip from 'jszip';

/** Parse a "First Last" or "Last, First" full_name into parts. */
function parseName(fullName: string | null): { last: string; first: string } {
  if (!fullName) return { last: 'Unknown', first: '' };
  const trimmed = fullName.trim();
  if (trimmed.includes(',')) {
    const [last, first] = trimmed.split(',').map((s) => s.trim());
    return { last: last || 'Unknown', first: first || '' };
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { last: 'Unknown', first: '' };
  if (parts.length === 1) return { last: parts[0], first: '' };
  return { last: parts[parts.length - 1], first: parts.slice(0, -1).join(' ') };
}

/** YYYY-MM-DD or 'undated'. Accepts ISO strings or Date objects. */
function formatDate(d: string | null | undefined): string {
  if (!d) return 'undated';
  const date = new Date(d);
  if (isNaN(date.getTime())) return 'undated';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Remove characters that are illegal or annoying in filenames, across filesystems. */
function sanitizeForFilename(s: string): string {
  return s
    .replace(/[\/\\:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Build a filename per the Stanton convention:
 *  {AssetID} - {DOCUMENT TYPE} - {Last, First} - {YYYY-MM-DD}.{ext}
 *  Example: S0006 - Pet Addendum - Ferguson, Shara - 2026-03-15.pdf
 */
function buildFilename(params: {
  assetId: string;
  docType: string;
  fullName: string | null;
  scanDate: string | null;
  ext: string;
  suffix?: string;
}): string {
  const { assetId, docType, fullName, scanDate, ext, suffix } = params;
  const { last, first } = parseName(fullName);
  const namepart = first ? `${last}, ${first}` : last;
  const base = `${assetId} - ${docType} - ${namepart} - ${formatDate(scanDate)}${suffix || ''}`;
  return `${sanitizeForFilename(base)}.${ext}`;
}

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { submissionId, submissionIds } = body;

    // Determine the list of IDs to process
    const ids: string[] = submissionIds
      ? (Array.isArray(submissionIds) ? submissionIds : [submissionIds])
      : submissionId
        ? [submissionId]
        : [];

    if (ids.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Submission ID(s) required' },
        { status: 400 }
      );
    }

    // Fetch all submissions
    const { data: submissions, error: fetchError } = await supabaseAdmin
      .from('submissions')
      .select(
        'id, full_name, building_address, unit_number, created_at, ' +
        'pet_addendum_file, pet_signature_date, ' +
        'vehicle_addendum_file, vehicle_signature_date, ' +
        'insurance_file, exemption_documents, pickup_id_photo, tenant_picked_up_at'
      )
      .in('id', ids);

    if (fetchError || !submissions || submissions.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No submissions found' },
        { status: 404 }
      );
    }

    const zip = new JSZip();
    const isBulk = submissions.length > 1;
    let totalDocs = 0;

    // Supabase can't narrow the dynamic .select(); cast to a concrete shape.
    type SubmissionRow = {
      id: string;
      full_name: string | null;
      building_address: string | null;
      unit_number: string | null;
      created_at: string | null;
      pet_addendum_file: string | null;
      pet_signature_date: string | null;
      vehicle_addendum_file: string | null;
      vehicle_signature_date: string | null;
      insurance_file: string | null;
      exemption_documents: string[] | string | null;
      pickup_id_photo: string | null;
      tenant_picked_up_at: string | null;
    };

    for (const submission of submissions as unknown as SubmissionRow[]) {
      const assetId =
        (submission.building_address && buildingToAssetId[submission.building_address]) || 'UNKNOWN';

      // Folder prefix for bulk zip — e.g. "S0006 - Ferguson, Shara - Unit 1E/"
      const { last, first } = parseName(submission.full_name);
      const namePart = first ? `${last}, ${first}` : last;
      const unitLabel = submission.unit_number || 'NoUnit';
      const folderBase = `${assetId} - ${namePart} - Unit ${unitLabel}`;
      const folderPrefix = isBulk ? `${sanitizeForFilename(folderBase)}/` : '';

      const documents: Array<{ path: string; name: string }> = [];

      if (submission.pet_addendum_file) {
        const ext = (submission.pet_addendum_file.split('.').pop() || 'pdf').toLowerCase();
        documents.push({
          path: submission.pet_addendum_file,
          name: buildFilename({
            assetId,
            docType: 'Pet Addendum',
            fullName: submission.full_name,
            scanDate: submission.pet_signature_date || submission.created_at,
            ext,
          }),
        });
      }
      if (submission.vehicle_addendum_file) {
        const ext = (submission.vehicle_addendum_file.split('.').pop() || 'pdf').toLowerCase();
        documents.push({
          path: submission.vehicle_addendum_file,
          name: buildFilename({
            assetId,
            docType: 'Parking Agreement',
            fullName: submission.full_name,
            scanDate: submission.vehicle_signature_date || submission.created_at,
            ext,
          }),
        });
      }
      if (submission.insurance_file) {
        const ext = (submission.insurance_file.split('.').pop() || 'pdf').toLowerCase();
        documents.push({
          path: submission.insurance_file,
          name: buildFilename({
            assetId,
            docType: 'Insurance',
            fullName: submission.full_name,
            scanDate: submission.created_at,
            ext,
          }),
        });
      }
      if (submission.pickup_id_photo) {
        const ext = (submission.pickup_id_photo.split('.').pop() || 'jpg').toLowerCase();
        documents.push({
          path: submission.pickup_id_photo,
          name: buildFilename({
            assetId,
            docType: 'Pickup ID',
            fullName: submission.full_name,
            scanDate: submission.tenant_picked_up_at || submission.created_at,
            ext,
          }),
        });
      }
      const exemptionDocs = submission.exemption_documents;
      const exemptionList: string[] = Array.isArray(exemptionDocs)
        ? exemptionDocs.filter((d: unknown): d is string => typeof d === 'string' && d.length > 0)
        : typeof exemptionDocs === 'string' && exemptionDocs.length > 0
        ? [exemptionDocs]
        : [];
      exemptionList.forEach((path, idx) => {
        const ext = (path.split('.').pop() || 'pdf').toLowerCase();
        const suffix = exemptionList.length > 1 ? ` (${idx + 1})` : undefined;
        documents.push({
          path,
          name: buildFilename({
            assetId,
            docType: 'ESA Document',
            fullName: submission.full_name,
            scanDate: submission.created_at,
            ext,
            suffix,
          }),
        });
      });

      for (const doc of documents) {
        try {
          const { data: fileData, error: downloadError } = await supabaseAdmin.storage
            .from('submissions')
            .download(doc.path);

          if (downloadError || !fileData) {
            console.error(`Failed to download ${doc.name} for ${submission.id}:`, downloadError);
            continue;
          }

          const arrayBuffer = await fileData.arrayBuffer();
          zip.file(`${folderPrefix}${doc.name}`, arrayBuffer);
          totalDocs++;
        } catch (error) {
          console.error(`Error processing ${doc.name} for ${submission.id}:`, error);
        }
      }
    }

    if (totalDocs === 0) {
      return NextResponse.json(
        { success: false, message: 'No documents available to download' },
        { status: 404 }
      );
    }

    // Generate ZIP file
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Create zip filename
    const filename = (() => {
      if (isBulk) {
        return `Stanton Documents - ${submissions.length} tenants - ${formatDate(new Date().toISOString())}.zip`;
      }
      const s = submissions[0] as unknown as SubmissionRow;
      const assetId = (s.building_address && buildingToAssetId[s.building_address]) || 'UNKNOWN';
      const { last, first } = parseName(s.full_name);
      const namePart = first ? `${last}, ${first}` : last;
      const unit = s.unit_number || 'NoUnit';
      return `${sanitizeForFilename(`${assetId} - ${namePart} - Unit ${unit}`)}.zip`;
    })();

    return new NextResponse(zipBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error: any) {
    console.error('Download documents ZIP error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create document archive' },
      { status: 500 }
    );
  }
}
