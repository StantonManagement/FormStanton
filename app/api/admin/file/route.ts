import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';

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
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json(
        { success: false, message: 'File path required' },
        { status: 400 }
      );
    }

    // Determine bucket from path
    let bucket = 'submissions';
    let filePath = path;

    // Signatures are stored in the submissions bucket with "signatures/" prefix
    // Pet photos are stored in the submissions bucket with "pet_photos/" prefix
    // No need to change the path, just use it as-is

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .download(filePath);

    if (error) throw error;

    const headers = new Headers();
    headers.set('Content-Type', data.type);
    headers.set('Content-Disposition', `inline; filename="${path.split('/').pop()}"`);

    return new NextResponse(data, { headers });
  } catch (error: any) {
    console.error('File download error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
