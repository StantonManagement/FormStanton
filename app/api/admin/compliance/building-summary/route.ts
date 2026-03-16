import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';

interface TenantSubmission {
  id: string;
  full_name: string;
  unit_number: string;
  phone: string;
  email: string;
  has_vehicle: boolean;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  vehicle_color?: string;
  vehicle_plate?: string;
  vehicle_verified: boolean;
  has_pets: boolean;
  pets?: any;
  pet_verified: boolean;
  has_insurance: boolean;
  insurance_provider?: string;
  insurance_policy_number?: string;
  insurance_file?: string;
  insurance_upload_pending: boolean;
  insurance_verified: boolean;
  admin_notes?: string;
  last_reviewed_at?: string;
  created_at: string;
}

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
    const buildingAddress = searchParams.get('building');

    if (!buildingAddress) {
      return NextResponse.json(
        { success: false, message: 'Building address required' },
        { status: 400 }
      );
    }

    // Fetch all submissions for this building
    const { data: submissions, error } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('building_address', buildingAddress)
      .order('unit_number', { ascending: true });

    if (error) {
      console.error('Error fetching submissions:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch submissions' },
        { status: 500 }
      );
    }

    // Calculate compliance stats
    const stats = {
      totalSubmissions: submissions.length,
      vehicleCount: submissions.filter(s => s.has_vehicle).length,
      vehicleVerifiedCount: submissions.filter(s => s.has_vehicle && s.vehicle_verified).length,
      petCount: submissions.filter(s => s.has_pets).length,
      petVerifiedCount: submissions.filter(s => s.has_pets && s.pet_verified).length,
      insuranceCount: submissions.filter(s => s.has_insurance).length,
      insuranceUploadedCount: submissions.filter(s => s.insurance_file).length,
      insurancePendingCount: submissions.filter(s => s.insurance_upload_pending).length,
      insuranceVerifiedCount: submissions.filter(s => s.has_insurance && s.insurance_verified).length,
    };

    // Expected tenant data removed - now using single database
    const expectedTenants: any[] = [];

    return NextResponse.json({
      success: true,
      building: buildingAddress,
      stats,
      submissions: submissions as TenantSubmission[],
      expectedTenants,
    });

  } catch (error: any) {
    console.error('Building summary error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to get building summary' },
      { status: 500 }
    );
  }
}

// Update verification status
export async function PUT(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { submissionId, itemType, verified, notes, vehicleNotes, petNotes, insuranceNotes, insuranceExpirationDate } = body;

    if (!submissionId || !itemType) {
      return NextResponse.json(
        { success: false, message: 'Submission ID and item type required' },
        { status: 400 }
      );
    }

    const updateData: any = {
      last_reviewed_at: new Date().toISOString(),
    };

    if (itemType === 'vehicle') {
      updateData.vehicle_verified = verified;
      if (vehicleNotes !== undefined) {
        updateData.vehicle_notes = vehicleNotes;
      }
    } else if (itemType === 'pet') {
      updateData.pet_verified = verified;
      if (petNotes !== undefined) {
        updateData.pet_notes = petNotes;
      }
    } else if (itemType === 'insurance') {
      updateData.insurance_verified = verified;
      if (insuranceNotes !== undefined) {
        updateData.insurance_notes = insuranceNotes;
      }
      if (insuranceExpirationDate !== undefined) {
        updateData.insurance_expiration_date = insuranceExpirationDate;
      }
    }

    if (notes !== undefined) {
      updateData.admin_notes = notes;
    }

    const { data, error } = await supabaseAdmin
      .from('submissions')
      .update(updateData)
      .eq('id', submissionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating verification:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to update verification' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error: any) {
    console.error('Verification update error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update verification' },
      { status: 500 }
    );
  }
}
