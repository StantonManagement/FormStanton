import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const uploadedBy = formData.get('uploadedBy') as string || 'admin';

    if (!file) {
      return NextResponse.json({ success: false, message: 'No file provided' }, { status: 400 });
    }

    // Read file as buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create batch record
    const { data: batch, error: batchError } = await supabase
      .from('scan_batches')
      .insert({
        uploaded_by: uploadedBy,
        total_pages: 0, // Will update after processing
        status: 'processing',
      })
      .select()
      .single();

    if (batchError || !batch) {
      throw new Error('Failed to create batch record');
    }

    const batchId = batch.id;
    let totalPages = 0;

    // Check if PDF or image
    if (file.type === 'application/pdf') {
      // Process PDF
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      totalPages = pdfDoc.getPageCount();

      // Split PDF into individual pages
      for (let i = 0; i < totalPages; i++) {
        const pageNumber = i + 1;
        
        // Create single-page PDF
        const singlePagePdf = await PDFDocument.create();
        const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [i]);
        singlePagePdf.addPage(copiedPage);
        const pdfBytes = await singlePagePdf.save();

        // Convert PDF page to image using pdfjs
        const loadingTask = getDocument({ data: pdfBytes });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = {
          width: viewport.width,
          height: viewport.height,
        };

        // Render page to canvas (we'll use a simplified approach)
        // For now, just store the PDF bytes directly
        
        // Upload single-page PDF
        const pdfPath = `scans/${batchId}/${pageNumber}.pdf`;
        const { error: pdfUploadError } = await supabase.storage
          .from('submissions')
          .upload(pdfPath, pdfBytes, {
            contentType: 'application/pdf',
            upsert: false,
          });

        if (pdfUploadError) {
          console.error('PDF upload error:', pdfUploadError);
        }

        // For image extraction, we'll convert first page to PNG for Claude
        // Using a simplified approach - store PDF and we'll extract image when needed
        const imagePath = `scans/${batchId}/${pageNumber}.png`;
        
        // Create extraction record
        await supabase.from('scan_extractions').insert({
          batch_id: batchId,
          page_number: pageNumber,
          scan_image_path: imagePath,
          scan_pdf_path: pdfPath,
          extracted_data: null,
          confidence: null,
          reviewed: false,
        });
      }
    } else if (file.type.startsWith('image/')) {
      // Process single image
      totalPages = 1;
      
      // Optimize image with sharp
      const optimizedImage = await sharp(buffer)
        .resize(2000, null, { withoutEnlargement: true })
        .png()
        .toBuffer();

      const imagePath = `scans/${batchId}/1.png`;
      
      // Upload image
      const { error: imageUploadError } = await supabase.storage
        .from('submissions')
        .upload(imagePath, optimizedImage, {
          contentType: 'image/png',
          upsert: false,
        });

      if (imageUploadError) {
        throw new Error('Failed to upload image');
      }

      // Create single-page PDF from image
      const pdfDoc = await PDFDocument.create();
      const pngImage = await pdfDoc.embedPng(optimizedImage);
      const page = pdfDoc.addPage([pngImage.width, pngImage.height]);
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pngImage.width,
        height: pngImage.height,
      });
      const pdfBytes = await pdfDoc.save();

      const pdfPath = `scans/${batchId}/1.pdf`;
      await supabase.storage
        .from('submissions')
        .upload(pdfPath, pdfBytes, {
          contentType: 'application/pdf',
          upsert: false,
        });

      // Create extraction record
      await supabase.from('scan_extractions').insert({
        batch_id: batchId,
        page_number: 1,
        scan_image_path: imagePath,
        scan_pdf_path: pdfPath,
        extracted_data: null,
        confidence: null,
        reviewed: false,
      });
    } else {
      throw new Error('Unsupported file type');
    }

    // Update batch with total pages and status
    await supabase
      .from('scan_batches')
      .update({
        total_pages: totalPages,
        status: 'uploaded',
      })
      .eq('id', batchId);

    return NextResponse.json({
      success: true,
      batchId,
      totalPages,
      message: `Successfully uploaded ${totalPages} page(s)`,
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get all scan batches
    const { data: batches, error } = await supabase
      .from('scan_batches')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: batches });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
