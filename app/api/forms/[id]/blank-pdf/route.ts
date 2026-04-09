import { NextRequest, NextResponse } from 'next/server';
import { generateBlankFormPdf } from '@/lib/documentGenerator';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const formId = parseInt(params.id, 10);

  if (isNaN(formId)) {
    return NextResponse.json({ message: 'Invalid form ID' }, { status: 400 });
  }

  try {
    const pdfBytes = await generateBlankFormPdf(formId);

    if (!pdfBytes) {
      return NextResponse.json(
        { message: `No blank PDF generator registered for form ${formId}` },
        { status: 404 }
      );
    }

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="blank-form-${formId}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('Blank PDF generation error:', error);
    return NextResponse.json(
      { message: 'Failed to generate PDF', error: error.message },
      { status: 500 }
    );
  }
}
