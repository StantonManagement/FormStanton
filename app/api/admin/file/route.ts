import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import { resolveBucket } from '@/lib/storage/resolveBucket';

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
    const docId = searchParams.get('id');

    if (!path && !docId) {
      return NextResponse.json(
        { success: false, message: 'File path or document id required' },
        { status: 400 }
      );
    }

    let bucket: string;
    let filePath: string;

    if (docId) {
      // application_documents row — resolve bucket from doc_type
      const { data: doc, error: docErr } = await supabaseAdmin
        .from('application_documents')
        .select('storage_path, doc_type, category')
        .eq('id', docId)
        .single();

      if (docErr || !doc?.storage_path) {
        return NextResponse.json(
          { success: false, message: 'Document not found' },
          { status: 404 }
        );
      }

      bucket = resolveBucket({ doc_type: doc.doc_type, category: doc.category });
      filePath = doc.storage_path;
    } else {
      // Legacy path-based call (lobby, submission forms — files in 'submissions' bucket)
      bucket = 'submissions';
      filePath = path!;
    }

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .download(filePath);

    if (error) throw error;

    const headers = new Headers();
    headers.set('Content-Type', data.type);
    headers.set('Content-Disposition', `inline; filename="${filePath.split('/').pop()}"`);

    return new NextResponse(data, { headers });
  } catch (error: any) {
    console.error('File download error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
