import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { primaryId, duplicateIds, mergeStrategy = 'keep_newest' } = await request.json();

    if (!primaryId || !duplicateIds || duplicateIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Primary ID and duplicate IDs are required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch primary submission
    const { data: primary, error: primaryError } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', primaryId)
      .single();

    if (primaryError || !primary) {
      return NextResponse.json(
        { success: false, message: 'Primary submission not found' },
        { status: 404 }
      );
    }

    // Fetch duplicate submissions
    const { data: duplicates, error: duplicatesError } = await supabase
      .from('submissions')
      .select('*')
      .in('id', duplicateIds);

    if (duplicatesError || !duplicates) {
      return NextResponse.json(
        { success: false, message: 'Failed to fetch duplicate submissions' },
        { status: 500 }
      );
    }

    // Merge data based on strategy
    let mergedData = { ...primary };

    if (mergeStrategy === 'keep_newest') {
      // Use most recent data for each field
      const allSubmissions = [primary, ...duplicates];
      allSubmissions.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      for (const submission of allSubmissions) {
        // Merge vehicle data
        if (submission.has_vehicle) {
          if (!mergedData.vehicle_make) mergedData.vehicle_make = submission.vehicle_make;
          if (!mergedData.vehicle_model) mergedData.vehicle_model = submission.vehicle_model;
          if (!mergedData.vehicle_year) mergedData.vehicle_year = submission.vehicle_year;
          if (!mergedData.vehicle_color) mergedData.vehicle_color = submission.vehicle_color;
          if (!mergedData.vehicle_plate) mergedData.vehicle_plate = submission.vehicle_plate;
          if (!mergedData.vehicle_signature) mergedData.vehicle_signature = submission.vehicle_signature;
          if (!mergedData.vehicle_signature_date) mergedData.vehicle_signature_date = submission.vehicle_signature_date;
        }

        // Merge pet data
        if (submission.has_pets && !mergedData.pets) {
          mergedData.pets = submission.pets;
          mergedData.pet_signature = submission.pet_signature;
          mergedData.pet_signature_date = submission.pet_signature_date;
        }

        // Merge insurance data
        if (submission.has_insurance) {
          if (!mergedData.insurance_provider) mergedData.insurance_provider = submission.insurance_provider;
          if (!mergedData.insurance_policy_number) mergedData.insurance_policy_number = submission.insurance_policy_number;
          if (!mergedData.insurance_file) mergedData.insurance_file = submission.insurance_file;
        }

        // Merge contact info (prefer most complete)
        if (!mergedData.email && submission.email) mergedData.email = submission.email;
        if (!mergedData.phone && submission.phone) mergedData.phone = submission.phone;
      }
    } else if (mergeStrategy === 'keep_most_complete') {
      // Use submission with most fields filled for each category
      const allSubmissions = [primary, ...duplicates];
      
      // Find most complete vehicle data
      const vehicleSubmissions = allSubmissions.filter(s => s.has_vehicle);
      if (vehicleSubmissions.length > 0) {
        const mostCompleteVehicle = vehicleSubmissions.reduce((best, current) => {
          const bestScore = [best.vehicle_make, best.vehicle_model, best.vehicle_year, best.vehicle_color, best.vehicle_plate].filter(Boolean).length;
          const currentScore = [current.vehicle_make, current.vehicle_model, current.vehicle_year, current.vehicle_color, current.vehicle_plate].filter(Boolean).length;
          return currentScore > bestScore ? current : best;
        });
        
        mergedData.vehicle_make = mostCompleteVehicle.vehicle_make;
        mergedData.vehicle_model = mostCompleteVehicle.vehicle_model;
        mergedData.vehicle_year = mostCompleteVehicle.vehicle_year;
        mergedData.vehicle_color = mostCompleteVehicle.vehicle_color;
        mergedData.vehicle_plate = mostCompleteVehicle.vehicle_plate;
        mergedData.vehicle_signature = mostCompleteVehicle.vehicle_signature;
        mergedData.vehicle_signature_date = mostCompleteVehicle.vehicle_signature_date;
      }

      // Find most complete pet data
      const petSubmissions = allSubmissions.filter(s => s.has_pets && s.pets);
      if (petSubmissions.length > 0) {
        const mostCompletePet = petSubmissions[0];
        mergedData.pets = mostCompletePet.pets;
        mergedData.pet_signature = mostCompletePet.pet_signature;
        mergedData.pet_signature_date = mostCompletePet.pet_signature_date;
      }

      // Find most complete insurance data
      const insuranceSubmissions = allSubmissions.filter(s => s.has_insurance);
      if (insuranceSubmissions.length > 0) {
        const mostCompleteInsurance = insuranceSubmissions.reduce((best, current) => {
          const bestScore = [best.insurance_provider, best.insurance_policy_number, best.insurance_file].filter(Boolean).length;
          const currentScore = [current.insurance_provider, current.insurance_policy_number, current.insurance_file].filter(Boolean).length;
          return currentScore > bestScore ? current : best;
        });
        
        mergedData.insurance_provider = mostCompleteInsurance.insurance_provider;
        mergedData.insurance_policy_number = mostCompleteInsurance.insurance_policy_number;
        mergedData.insurance_file = mostCompleteInsurance.insurance_file;
      }
    }

    // Update primary submission with merged data
    const { error: updateError } = await supabase
      .from('submissions')
      .update({
        ...mergedData,
        is_primary: true,
        admin_notes: mergedData.admin_notes 
          ? `${mergedData.admin_notes}\n\nMerged ${duplicateIds.length} duplicate submission(s) on ${new Date().toISOString()}`
          : `Merged ${duplicateIds.length} duplicate submission(s) on ${new Date().toISOString()}`
      })
      .eq('id', primaryId);

    if (updateError) {
      console.error('Failed to update primary submission:', updateError);
      return NextResponse.json(
        { success: false, message: 'Failed to update primary submission' },
        { status: 500 }
      );
    }

    // Mark duplicates as merged
    const { error: markError } = await supabase
      .from('submissions')
      .update({
        merged_into: primaryId,
        is_primary: false
      })
      .in('id', duplicateIds);

    if (markError) {
      console.error('Failed to mark duplicates:', markError);
      return NextResponse.json(
        { success: false, message: 'Failed to mark duplicate submissions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully merged ${duplicateIds.length} submission(s)`,
      primaryId
    });

  } catch (error) {
    console.error('Merge submissions error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { submissionId, groupId, action } = await request.json();

    if (!submissionId || !action) {
      return NextResponse.json(
        { success: false, message: 'Submission ID and action are required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === 'mark_primary') {
      // Get the group's current primary
      const { data: currentPrimary, error: currentError } = await supabase
        .from('submissions')
        .select('id')
        .eq('duplicate_group_id', groupId)
        .eq('is_primary', true)
        .single();

      if (currentError && currentError.code !== 'PGRST116') {
        console.error('Failed to fetch current primary:', currentError);
        return NextResponse.json(
          { success: false, message: 'Failed to fetch current primary' },
          { status: 500 }
        );
      }

      // Unmark current primary
      if (currentPrimary) {
        await supabase
          .from('submissions')
          .update({ is_primary: false })
          .eq('id', currentPrimary.id);
      }

      // Mark new primary
      const { error: updateError } = await supabase
        .from('submissions')
        .update({ is_primary: true })
        .eq('id', submissionId);

      if (updateError) {
        console.error('Failed to mark as primary:', updateError);
        return NextResponse.json(
          { success: false, message: 'Failed to mark as primary' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Successfully marked as primary'
      });
    }

    if (action === 'dismiss') {
      // Remove from duplicate group
      const { error: dismissError } = await supabase
        .from('submissions')
        .update({ duplicate_group_id: null })
        .eq('id', submissionId);

      if (dismissError) {
        console.error('Failed to dismiss duplicate:', dismissError);
        return NextResponse.json(
          { success: false, message: 'Failed to dismiss duplicate' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Successfully dismissed duplicate'
      });
    }

    return NextResponse.json(
      { success: false, message: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Update submission error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
