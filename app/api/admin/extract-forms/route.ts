import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    const { batchId } = await request.json();

    if (!batchId) {
      return NextResponse.json({ success: false, message: 'Batch ID required' }, { status: 400 });
    }

    // Get all extractions for this batch
    const { data: extractions, error: extractionsError } = await supabase
      .from('scan_extractions')
      .select('*')
      .eq('batch_id', batchId)
      .order('page_number', { ascending: true });

    if (extractionsError || !extractions) {
      throw new Error('Failed to fetch extractions');
    }

    // Update batch status
    await supabase
      .from('scan_batches')
      .update({ status: 'processing' })
      .eq('id', batchId);

    let processedCount = 0;
    const results = [];

    // Process each page
    for (const extraction of extractions) {
      try {
        // Skip if already extracted
        if (extraction.extracted_data) {
          processedCount++;
          results.push({ page: extraction.page_number, status: 'already_processed' });
          continue;
        }

        // Download image from Supabase
        const { data: imageData, error: downloadError } = await supabase.storage
          .from('submissions')
          .download(extraction.scan_image_path);

        if (downloadError || !imageData) {
          console.error(`Failed to download image for page ${extraction.page_number}`);
          results.push({ page: extraction.page_number, status: 'download_failed' });
          continue;
        }

        // Convert to base64
        const arrayBuffer = await imageData.arrayBuffer();
        const base64Image = Buffer.from(arrayBuffer).toString('base64');

        // Call Claude Vision API
        const message = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: base64Image,
                  },
                },
                {
                  type: 'text',
                  text: `You are analyzing a tenant onboarding form. The form has printed labels and HANDWRITTEN responses.
Extract the handwritten data carefully. Return ONLY valid JSON with these exact fields:

{
  "full_name": "string",
  "phone": "10-digit number without formatting",
  "email": "string or null if blank",
  "building_address": "exact address from form",
  "unit_number": "string",
  "has_pets": true or false,
  "pets": [
    {
      "pet_type": "Dog or Cat",
      "pet_name": "string",
      "pet_breed": "string",
      "pet_weight": "number in lbs",
      "pet_color": "string",
      "pet_spayed": true or false,
      "pet_vaccinations_current": true or false
    }
  ],
  "has_insurance": true or false,
  "insurance_provider": "string or null",
  "insurance_policy_number": "string or null",
  "has_vehicle": true or false,
  "vehicle_make": "string or null",
  "vehicle_model": "string or null",
  "vehicle_year": "number or null",
  "vehicle_color": "string or null",
  "vehicle_plate": "string or null",
  "confidence": "high, medium, or low",
  "notes": "any unclear fields or issues"
}

If a field is unclear or blank, use null. If has_pets is false, pets should be an empty array [].
If has_insurance is false, insurance fields should be null.
If has_vehicle is false, vehicle fields should be null.
Return ONLY the JSON object, no other text.`,
                },
              ],
            },
          ],
        });

        // Extract JSON from response
        const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
        
        // Try to parse JSON from response
        let extractedData;
        try {
          // Remove markdown code blocks if present
          const jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          extractedData = JSON.parse(jsonText);
        } catch (parseError) {
          console.error('Failed to parse JSON:', responseText);
          extractedData = {
            error: 'Failed to parse response',
            raw_response: responseText,
            confidence: 'low',
          };
        }

        // Determine confidence level
        const confidence = extractedData.confidence || 'medium';

        // Update extraction record
        await supabase
          .from('scan_extractions')
          .update({
            extracted_data: extractedData,
            confidence: confidence,
          })
          .eq('id', extraction.id);

        processedCount++;
        results.push({ 
          page: extraction.page_number, 
          status: 'success',
          confidence: confidence,
        });

      } catch (pageError: any) {
        console.error(`Error processing page ${extraction.page_number}:`, pageError);
        results.push({ 
          page: extraction.page_number, 
          status: 'error',
          error: pageError.message,
        });
      }
    }

    // Update batch status
    await supabase
      .from('scan_batches')
      .update({ status: 'ready_for_review' })
      .eq('id', batchId);

    return NextResponse.json({
      success: true,
      processedCount,
      totalPages: extractions.length,
      results,
    });

  } catch (error: any) {
    console.error('Extraction error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Extraction failed' },
      { status: 500 }
    );
  }
}
