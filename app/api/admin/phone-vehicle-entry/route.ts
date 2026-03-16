import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { sanitizePlate } from '@/lib/plateSanitizer';
import { logAudit, getClientIp } from '@/lib/audit';

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
    const {
      fullName,
      phone,
      email,
      buildingAddress,
      unitNumber,
      vehicleMake,
      vehicleModel,
      vehicleYear,
      vehicleColor,
      vehiclePlate,
    } = body;

    // Get identity from session instead of request body
    const sessionUser = await getSessionUser();
    const staffName = sessionUser?.displayName || body.staffName || 'Unknown';

    // Validate required fields
    if (!fullName || !buildingAddress || !unitNumber) {
      return NextResponse.json(
        { success: false, message: 'Tenant information (name, building, unit) is required' },
        { status: 400 }
      );
    }

    if (!vehicleMake || !vehicleModel || !vehicleYear || !vehicleColor || !vehiclePlate) {
      return NextResponse.json(
        { success: false, message: 'All vehicle fields are required' },
        { status: 400 }
      );
    }

    // Check if submission already exists for this tenant
    const { data: existingSubmissions, error: searchError } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('building_address', buildingAddress)
      .eq('unit_number', unitNumber)
      .eq('full_name', fullName);

    if (searchError) {
      console.error('Error searching for existing submission:', searchError);
      return NextResponse.json(
        { success: false, message: 'Failed to search for existing submission' },
        { status: 500 }
      );
    }

    const now = new Date().toISOString();
    const submissionData = {
      full_name: fullName,
      phone,
      email: email || null,
      building_address: buildingAddress,
      unit_number: unitNumber,
      has_vehicle: true,
      vehicle_make: vehicleMake,
      vehicle_model: vehicleModel,
      vehicle_year: parseInt(vehicleYear),
      vehicle_color: vehicleColor,
      vehicle_plate: sanitizePlate(vehiclePlate),
      vehicle_submitted_by_phone: true,
      vehicle_phone_submission_date: now,
      vehicle_phone_submission_by: staffName,
      vehicle_signature_date: new Date().toISOString().split('T')[0], // Current date in YYYY-MM-DD format
      ip_address: 'phone-entry',
      user_agent: 'admin-phone-entry',
    };

    if (existingSubmissions && existingSubmissions.length > 0) {
      // Update existing submission
      const existingSubmission = existingSubmissions[0];
      
      // Check if vehicle already exists
      if (existingSubmission.has_vehicle && existingSubmission.vehicle_plate) {
        return NextResponse.json(
          { 
            success: false, 
            message: `Vehicle already registered for this tenant: ${existingSubmission.vehicle_make} ${existingSubmission.vehicle_model} (${existingSubmission.vehicle_plate})`,
            existingVehicle: {
              make: existingSubmission.vehicle_make,
              model: existingSubmission.vehicle_model,
              plate: existingSubmission.vehicle_plate,
            }
          },
          { status: 409 }
        );
      }

      // Update with vehicle information
      const { error: updateError } = await supabaseAdmin
        .from('submissions')
        .update(submissionData)
        .eq('id', existingSubmission.id);

      if (updateError) {
        console.error('Error updating submission:', updateError);
        return NextResponse.json(
          { success: false, message: 'Failed to update submission' },
          { status: 500 }
        );
      }

      await logAudit(sessionUser, 'vehicle.phone_entry', 'submission', existingSubmission.id, {
        fullName, buildingAddress, unitNumber, vehiclePlate: body.vehiclePlate, updated: true,
      }, getClientIp(request));

      return NextResponse.json({
        success: true,
        message: 'Vehicle information added to existing submission',
        submissionId: existingSubmission.id,
        updated: true,
      });
    } else {
      // Create new submission
      const newSubmission = {
        ...submissionData,
        language: 'en',
        phone_is_new: false,
        has_pets: null,
        has_insurance: null,
      };

      const { data, error: insertError } = await supabaseAdmin
        .from('submissions')
        .insert(newSubmission)
        .select()
        .single();

      if (insertError) {
        console.error('Error creating submission:', insertError);
        return NextResponse.json(
          { success: false, message: 'Failed to create submission' },
          { status: 500 }
        );
      }

      await logAudit(sessionUser, 'vehicle.phone_entry', 'submission', data.id, {
        fullName, buildingAddress, unitNumber, vehiclePlate: body.vehiclePlate, created: true,
      }, getClientIp(request));

      return NextResponse.json({
        success: true,
        message: 'Vehicle information submitted successfully',
        submissionId: data.id,
        created: true,
      });
    }
  } catch (error: any) {
    console.error('Phone vehicle entry error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Submission failed' },
      { status: 500 }
    );
  }
}
