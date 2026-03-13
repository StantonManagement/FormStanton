import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sanitizePlate } from '@/lib/plateSanitizer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { batchId } = await request.json();

    if (!batchId) {
      return NextResponse.json({ success: false, message: 'Batch ID required' }, { status: 400 });
    }

    // Get all reviewed extractions for this batch
    const { data: extractions, error: extractionsError } = await supabase
      .from('scan_extractions')
      .select('*')
      .eq('batch_id', batchId)
      .eq('reviewed', true)
      .eq('imported', false)
      .order('page_number', { ascending: true });

    if (extractionsError || !extractions) {
      throw new Error('Failed to fetch reviewed extractions');
    }

    if (extractions.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'No reviewed extractions found to import' 
      }, { status: 400 });
    }

    const importedSubmissions = [];
    const errors = [];

    // Import each extraction as a submission
    for (const extraction of extractions) {
      try {
        const data = extraction.final_data || extraction.extracted_data;

        if (!data) {
          errors.push({ page: extraction.page_number, error: 'No data to import' });
          continue;
        }

        // Prepare submission data
        const submissionData = {
          language: 'en', // Default to English for paper submissions
          full_name: data.full_name || '',
          phone: data.phone || '',
          email: data.email || '',
          phone_is_new: false,
          building_address: data.building_address || '',
          unit_number: data.unit_number || '',
          
          has_pets: data.has_pets || false,
          pets: data.has_pets && data.pets ? data.pets : null,
          pet_signature: null,
          pet_signature_date: null,
          
          has_insurance: data.has_insurance || false,
          insurance_provider: data.insurance_provider || null,
          insurance_policy_number: data.insurance_policy_number || null,
          insurance_file: null,
          insurance_upload_pending: data.has_insurance ? true : false,
          add_insurance_to_rent: false,
          
          has_vehicle: data.has_vehicle || false,
          vehicle_make: data.vehicle_make || null,
          vehicle_model: data.vehicle_model || null,
          vehicle_year: data.vehicle_year || null,
          vehicle_color: data.vehicle_color || null,
          vehicle_plate: sanitizePlate(data.vehicle_plate),
          vehicle_signature: null,
          vehicle_signature_date: null,
          additional_vehicles: null,
          
          pet_addendum_file: null,
          vehicle_addendum_file: null,
          combined_pdf: extraction.scan_pdf_path, // Link to scanned form PDF
          
          ip_address: 'paper-scan-import',
          user_agent: `scan-batch-${batchId}`,
        };

        // Insert submission
        const { data: submission, error: submissionError } = await supabase
          .from('submissions')
          .insert(submissionData)
          .select()
          .single();

        if (submissionError) {
          errors.push({ 
            page: extraction.page_number, 
            error: submissionError.message 
          });
          continue;
        }

        // Update extraction record
        await supabase
          .from('scan_extractions')
          .update({
            imported: true,
            submission_id: submission.id,
          })
          .eq('id', extraction.id);

        importedSubmissions.push({
          page: extraction.page_number,
          submissionId: submission.id,
          tenantName: data.full_name,
        });

      } catch (pageError: any) {
        errors.push({ 
          page: extraction.page_number, 
          error: pageError.message 
        });
      }
    }

    // Update batch status if all imported
    const { data: remainingExtractions } = await supabase
      .from('scan_extractions')
      .select('id')
      .eq('batch_id', batchId)
      .eq('imported', false);

    if (!remainingExtractions || remainingExtractions.length === 0) {
      await supabase
        .from('scan_batches')
        .update({ status: 'imported' })
        .eq('id', batchId);
    }

    return NextResponse.json({
      success: true,
      imported: importedSubmissions.length,
      errors: errors.length,
      details: {
        importedSubmissions,
        errors,
      },
    });

  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Import failed' },
      { status: 500 }
    );
  }
}
