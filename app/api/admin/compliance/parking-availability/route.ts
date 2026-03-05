import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateParkingAvailability, getAdditionalVehicleRequests } from '@/lib/parkingAnalytics';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const buildingAddress = searchParams.get('building');

    if (!buildingAddress) {
      return NextResponse.json(
        { success: false, message: 'Building address required' },
        { status: 400 }
      );
    }

    // Fetch all submissions for this building
    const { data: submissions, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('building_address', buildingAddress);

    if (error) {
      console.error('Error fetching submissions:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch submissions' },
        { status: 500 }
      );
    }

    // Calculate parking availability
    const availability = calculateParkingAvailability(buildingAddress, submissions);
    
    // Get additional vehicle requests
    const requests = getAdditionalVehicleRequests(buildingAddress, submissions);

    return NextResponse.json({
      success: true,
      availability,
      requests,
    });

  } catch (error: any) {
    console.error('Parking availability error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to get parking availability' },
      { status: 500 }
    );
  }
}
