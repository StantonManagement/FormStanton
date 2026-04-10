import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);

async function uploadFile(file: File, prefix: string): Promise<string | null> {
  if (!file || file.size === 0) return null;
  const buf = Buffer.from(await file.arrayBuffer());
  const key = `${prefix}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const { error } = await supabase.storage.from('form-photos').upload(key, buf, { contentType: file.type });
  if (error) { console.error('Upload error:', error); return null; }
  const { data } = supabase.storage.from('form-photos').getPublicUrl(key);
  return data.publicUrl;
}

export async function POST(request: NextRequest) {
  try {
    const fd = await request.formData();
    const raw = fd.get('formData');
    if (typeof raw !== 'string') {
      return NextResponse.json({ message: 'Invalid request format' }, { status: 400 });
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const { fullName, phone, email, bedrooms, paymentType, language } = parsed;

    if (!fullName || !(fullName as string).trim())
      return NextResponse.json({ message: 'Full name is required' }, { status: 400 });
    if (!phone || !(phone as string).replace(/\D/g, '').match(/^\d{10}$/))
      return NextResponse.json({ message: 'A valid 10-digit phone number is required' }, { status: 400 });
    if (!bedrooms)
      return NextResponse.json({ message: 'Bedrooms selection is required' }, { status: 400 });
    if (!paymentType)
      return NextResponse.json({ message: 'Payment type is required' }, { status: 400 });

    // Upload income proof files
    const incomeFileUrls: Record<string, string[]> = {};
    for (let i = 0; i < 10; i++) {
      const files = fd.getAll(`income_${i}`) as File[];
      if (files.length === 0) break;
      const urls: string[] = [];
      for (const f of files) {
        const url = await uploadFile(f, `tenant-applications/${(fullName as string).replace(/\s+/g, '-')}/income-${i}`);
        if (url) urls.push(url);
      }
      if (urls.length) incomeFileUrls[`source_${i}`] = urls;
    }

    // Upload Section I docs
    const voucherUrls: string[] = [];
    for (const f of fd.getAll('voucher') as File[]) {
      const url = await uploadFile(f, `tenant-applications/${(fullName as string).replace(/\s+/g, '-')}/voucher`);
      if (url) voucherUrls.push(url);
    }
    const movingPacketUrls: string[] = [];
    for (const f of fd.getAll('movingPacket') as File[]) {
      const url = await uploadFile(f, `tenant-applications/${(fullName as string).replace(/\s+/g, '-')}/moving-packet`);
      if (url) movingPacketUrls.push(url);
    }
    const bankStatementUrls: string[] = [];
    for (const f of fd.getAll('bankStatement') as File[]) {
      const url = await uploadFile(f, `tenant-applications/${(fullName as string).replace(/\s+/g, '-')}/bank-statement`);
      if (url) bankStatementUrls.push(url);
    }

    // Upload Section J docs
    const idUrls: string[] = [];
    for (const f of fd.getAll('id') as File[]) {
      const url = await uploadFile(f, `tenant-applications/${(fullName as string).replace(/\s+/g, '-')}/id`);
      if (url) idUrls.push(url);
    }
    const ssnUrls: string[] = [];
    for (const f of fd.getAll('ssnCard') as File[]) {
      const url = await uploadFile(f, `tenant-applications/${(fullName as string).replace(/\s+/g, '-')}/ssn`);
      if (url) ssnUrls.push(url);
    }

    const formData = {
      ...parsed,
      incomeFileUrls,
      voucherUrls,
      movingPacketUrls,
      bankStatementUrls,
      idUrls,
      ssnUrls,
    };

    const { data: submission, error: dbError } = await supabase
      .from('form_submissions')
      .insert({
        form_type: 'tenant_application',
        tenant_name: (fullName as string).trim(),
        building_address: '',
        unit_number: '',
        form_data: formData,
        language: language || 'en',
        submitted_at: new Date().toISOString(),
        reviewed: false,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ message: 'Failed to save submission', error: dbError.message }, { status: 500 });
    }

    // Email notification
    const jcEmail = process.env.JC_EMAIL || 'admin@stantonmanagement.com';
    try {
      await resend.emails.send({
        from: 'Stanton Management <onboarding@stantonmanagement.com>',
        to: jcEmail,
        subject: `New Tenant Application — ${(fullName as string).trim()}`,
        html: `
          <h2>New Full Tenant Application Received</h2>
          <p><strong>Name:</strong> ${(fullName as string).trim()}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>Email:</strong> ${email || 'Not provided'}</p>
          <p><strong>Bedrooms:</strong> ${bedrooms}</p>
          <p><strong>Payment type:</strong> ${paymentType}</p>
          <p><strong>Language:</strong> ${language || 'en'}</p>
          <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
          <hr/>
          <p><a href="${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('.supabase.co', '') || ''}/admin/form-submissions">View in admin dashboard</a></p>
          <p>Stanton Management — Full Tenant Application System</p>
        `,
      });
    } catch (emailErr) {
      console.error('Email notification failed:', emailErr);
    }

    return NextResponse.json({ message: 'Application submitted successfully', id: submission.id }, { status: 200 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Tenant application submission error:', error);
    return NextResponse.json({ message: 'Submission failed', error: msg }, { status: 500 });
  }
}
