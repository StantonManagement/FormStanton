import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function uploadFile(file: File, folder: string, label: string): Promise<string | null> {
  try {
    const ext = file.name.split('.').pop() ?? 'bin';
    const fileName = `${Date.now()}-${label}.${ext}`;
    const { data, error } = await supabase.storage
      .from('form-photos')
      .upload(`rental-application/${folder}/${fileName}`, file, {
        contentType: file.type,
        upsert: false,
      });
    if (error || !data) {
      console.error(`Upload error (${label}):`, error);
      return null;
    }
    const { data: urlData } = supabase.storage.from('form-photos').getPublicUrl(data.path);
    return urlData.publicUrl;
  } catch (err) {
    console.error(`Upload exception (${label}):`, err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const multipart = await request.formData();

    const language = (multipart.get('language') as string) || 'en';
    const signature = (multipart.get('signature') as string) || '';
    const formDataString = multipart.get('formData') as string | null;

    if (!formDataString) {
      return NextResponse.json({ message: 'Missing form data' }, { status: 400 });
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(formDataString);
    } catch {
      return NextResponse.json({ message: 'Invalid form data payload' }, { status: 400 });
    }

    const fullName = (data.fullName as string)?.trim();
    const phone = (data.phone as string)?.trim();

    if (!fullName) return NextResponse.json({ message: 'Full name is required' }, { status: 400 });
    if (!phone) return NextResponse.json({ message: 'Phone number is required' }, { status: 400 });

    // -- Signature upload --
    let signatureUrl: string | null = null;
    if (signature) {
      try {
        const signatureBuffer = Buffer.from(signature.split(',')[1], 'base64');
        const sigFile = new File([signatureBuffer], 'signature.png', { type: 'image/png' });
        signatureUrl = await uploadFile(sigFile, 'signatures', 'signature');
      } catch (err) {
        console.error('Signature upload error:', err);
      }
    }

    // -- Income proof uploads --
    const incomeProofUrls: (string | null)[] = [];
    const incomeSources = (data.incomeSources as unknown[]) ?? [];
    for (let i = 0; i < incomeSources.length; i++) {
      const file = multipart.get(`incomeProof_${i}`) as File | null;
      if (file && file.size > 0) {
        incomeProofUrls[i] = await uploadFile(file, 'income-proof', `income_${i}`);
      } else {
        incomeProofUrls[i] = null;
      }
    }

    // -- Document uploads --
    const docKeys = ['docsVoucher', 'docsMovingPacket', 'docsBankStatement', 'docsPhotoId', 'docsSsnCard'];
    const docUrls: Record<string, string | null> = {};
    for (const key of docKeys) {
      const file = multipart.get(key) as File | null;
      if (file && file.size > 0) {
        docUrls[key] = await uploadFile(file, 'documents', key);
      } else {
        docUrls[key] = null;
      }
    }

    // -- Build form payload --
    const formPayload = {
      ...data,
      phone,
      signatureUrl,
      incomeProofUrls,
      docUrls,
    };

    const { data: submission, error: dbError } = await supabase
      .from('form_submissions')
      .insert({
        form_type: 'rental_application',
        tenant_name: fullName,
        building_address: null,
        unit_number: null,
        form_data: formPayload,
        language,
        submitted_at: new Date().toISOString(),
        reviewed: false,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error (rental application):', dbError);
      return NextResponse.json(
        { message: 'Failed to save submission', error: dbError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Application submitted successfully', id: submission.id },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Rental application submission error:', error);
    return NextResponse.json(
      { message: 'Submission failed', error: error.message },
      { status: 500 }
    );
  }
}
