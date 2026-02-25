import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const formDataJson = JSON.parse(formData.get('formData') as string);
    const signatureData = formData.get('signature') as string;
    const language = formData.get('language') as string;

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const submissionId = crypto.randomUUID();

    // Upload receipt files
    const receiptPaths: string[] = [];
    for (let i = 0; i < 5; i++) {
      const file = formData.get(`receipt_${i}`) as File | null;
      if (file) {
        const fileName = `${submissionId}_receipt_${i}.${file.name.split('.').pop()}`;
        const buffer = await file.arrayBuffer();
        const { data, error } = await supabaseAdmin.storage
          .from('submissions')
          .upload(`reimbursements/${fileName}`, buffer, {
            contentType: file.type,
          });
        if (error) throw error;
        receiptPaths.push(data.path);
      }
    }

    // Upload signature
    let signaturePath = null;
    if (signatureData) {
      const base64Data = signatureData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const fileName = `${submissionId}_signature.png`;
      const { data, error } = await supabaseAdmin.storage
        .from('submissions')
        .upload(`reimbursements/signatures/${fileName}`, buffer, {
          contentType: 'image/png',
        });
      if (error) throw error;
      signaturePath = data.path;
    }

    // Build expenses array for DB
    const expenses = formDataJson.expenses.map((exp: any) => ({
      date: exp.date,
      category: exp.category,
      description: exp.description,
      amount: parseFloat(exp.amount) || 0,
      notes: exp.notes || '',
    }));

    const totalAmount = expenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);

    // Insert into database
    const { error: dbError } = await supabaseAdmin
      .from('reimbursement_requests')
      .insert({
        id: submissionId,
        language,
        tenant_name: formDataJson.tenantName,
        building_address: formDataJson.buildingAddress,
        unit_number: formDataJson.unitNumber,
        phone: formDataJson.phone,
        email: formDataJson.email,
        date_submitted: formDataJson.dateSubmitted,
        expenses,
        total_amount: totalAmount,
        payment_preference: formDataJson.paymentPreference || null,
        urgency: formDataJson.urgency || 'normal',
        receipt_files: receiptPaths.length > 0 ? receiptPaths : null,
        tenant_signature: signaturePath,
        signature_date: formDataJson.dateSubmitted,
        ip_address: ip,
        user_agent: userAgent,
      });

    if (dbError) throw dbError;

    // Send confirmation email
    try {
      const expenseRows = expenses.map((exp: any) =>
        `<tr><td style="padding:4px 8px;border:1px solid #ddd">${exp.date}</td><td style="padding:4px 8px;border:1px solid #ddd">${exp.category}</td><td style="padding:4px 8px;border:1px solid #ddd">${exp.description}</td><td style="padding:4px 8px;border:1px solid #ddd">$${exp.amount.toFixed(2)}</td></tr>`
      ).join('');

      await resend.emails.send({
        from: 'Stanton Management <onboarding@stantonmanagement.com>',
        to: formDataJson.email,
        subject: 'Reimbursement Request Received - Stanton Management',
        html: `
          <h2>Reimbursement Request Received</h2>
          <p>Dear ${formDataJson.tenantName},</p>
          <p>We have received your reimbursement request. Here's a summary:</p>
          <ul>
            <li><strong>Building:</strong> ${formDataJson.buildingAddress}</li>
            <li><strong>Unit:</strong> ${formDataJson.unitNumber}</li>
            <li><strong>Total Requested:</strong> $${totalAmount.toFixed(2)}</li>
            <li><strong>Payment Preference:</strong> ${formDataJson.paymentPreference || 'Not specified'}</li>
          </ul>
          <h3>Expenses</h3>
          <table style="border-collapse:collapse;width:100%">
            <thead><tr style="background:#f5f5f5">
              <th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Date</th>
              <th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Category</th>
              <th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Description</th>
              <th style="padding:4px 8px;border:1px solid #ddd;text-align:left">Amount</th>
            </tr></thead>
            <tbody>${expenseRows}</tbody>
          </table>
          <p style="margin-top:16px">We will review your request and contact you if additional information is needed. You will be notified once a decision has been made.</p>
          <p>Best regards,<br>Stanton Management</p>
        `,
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
    }

    return NextResponse.json({
      success: true,
      submissionId,
    });

  } catch (error: any) {
    console.error('Reimbursement submission error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Submission failed' },
      { status: 500 }
    );
  }
}
