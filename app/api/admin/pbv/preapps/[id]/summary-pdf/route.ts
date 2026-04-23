import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generatePbvPreappSummaryPdf } from '@/lib/pbvPreappPdf';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    const { data, error } = await supabaseAdmin
      .from('pbv_preapplications')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
      }
      throw error;
    }

    const pdfBytes = await generatePbvPreappSummaryPdf(data);

    const safeName = data.hoh_name.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_');
    const filename = `PBV_PreApp_Summary_${safeName}_${id.slice(0, 8).toUpperCase()}.pdf`;

    const buffer = Buffer.from(pdfBytes);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBytes.byteLength),
      },
    });
  } catch (err: any) {
    console.error('PBV summary PDF error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
