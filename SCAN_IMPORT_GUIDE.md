# Scan Import Feature - Setup & Usage Guide

## Overview

The Scan Import feature allows you to automatically digitize paper tenant forms using AI-powered OCR. Simply scan your forms, upload them, and let Claude Vision extract the data. Review and correct the extracted information, then import it into your database.

## Features

- **AI-Powered Extraction**: Uses Claude 3.5 Sonnet Vision to read handwritten text from scanned forms
- **Batch Processing**: Upload multiple pages at once (PDF or images)
- **Side-by-Side Review**: View scanned form next to extracted data for easy verification
- **Individual PDFs**: Each scanned form is saved as a separate PDF attached to the submission
- **Confidence Scoring**: AI indicates confidence level (high/medium/low) for each extraction

## Setup

### 1. Database Migration

Run the database migration to create the required tables:

```sql
-- Run this in your Supabase SQL Editor
-- File: supabase/migrations/create_scan_tables.sql
```

This creates:
- `scan_batches` - Tracks upload batches
- `scan_extractions` - Stores extracted data before import

### 2. Environment Variables

Add your Anthropic API key to `.env.local`:

```env
ANTHROPIC_API_KEY=sk-ant-api03-...
```

Get your API key from: https://console.anthropic.com/

### 3. Supabase Storage

The `submissions` bucket is already configured. Scanned forms will be stored in:
- `scans/{batch_id}/{page_number}.png` - Images for AI processing
- `scans/{batch_id}/{page_number}.pdf` - Individual PDFs

## Usage Workflow

### Step 1: Scan Your Forms

1. Gather all paper forms from tenants
2. Scan them using a scanner or phone camera
3. Save as a single PDF or multiple image files (PNG/JPG)

**Tips for best results:**
- Ensure good lighting and contrast
- Keep forms flat and straight
- Use 300 DPI or higher for scanning
- Make sure handwriting is legible

### Step 2: Upload to Admin Dashboard

1. Log into admin dashboard
2. Click the **"Scan Import"** tab
3. Click the upload area or drag & drop your PDF/images
4. Wait for upload to complete

The system will:
- Split PDF into individual pages
- Store each page as an image and PDF
- Create a batch record

### Step 3: AI Extraction (Automatic)

After upload, extraction starts automatically:
- Claude Vision analyzes each page
- Extracts handwritten data from form fields
- Assigns confidence scores
- Stores extracted data

This takes ~5-10 seconds per page.

### Step 4: Review & Correct

1. Click **"Review & Import"** on your batch
2. Review interface opens with:
   - **Left side**: Scanned form image (zoomable)
   - **Right side**: Extracted data (editable)

3. For each page:
   - Verify extracted data against scanned image
   - Correct any errors in the form fields
   - Click **"Mark Reviewed & Next"** to move to next page

4. Navigate with:
   - **Previous** - Go back one page
   - **Save** - Save changes without marking reviewed
   - **Mark Reviewed & Next** - Save, mark as reviewed, and advance

### Step 5: Import to Database

1. After reviewing all pages, click **"Import All Reviewed"**
2. Confirm the import
3. System creates submission records for each reviewed page
4. Scanned PDF is attached to each submission

## Data Extraction

### Fields Extracted

The AI extracts these fields from each form:

**Resident Information:**
- Full Name
- Phone Number (10 digits)
- Email Address
- Building Address
- Unit Number

**Pet Information:**
- Has Pets (Yes/No)
- Pet Type (Dog/Cat)
- Pet Name
- Pet Breed
- Pet Weight (lbs)
- Pet Color
- Spayed/Neutered
- Vaccinations Current

**Insurance Information:**
- Has Insurance (Yes/No)
- Insurance Provider
- Policy Number

**Vehicle Information:**
- Has Vehicle (Yes/No)
- Make, Model, Year
- Color
- License Plate

### Confidence Levels

- **High** (Green): AI is very confident in extraction
- **Medium** (Yellow): Some uncertainty, review carefully
- **Low** (Red): Low confidence, likely needs correction

## Troubleshooting

### Upload Fails

**Problem**: PDF upload fails or times out

**Solutions**:
- Check file size (keep under 50MB)
- Try uploading images individually instead of PDF
- Ensure file is not corrupted

### Extraction Errors

**Problem**: AI extraction returns gibberish or empty data

**Solutions**:
- Check scan quality (must be legible)
- Ensure form is right-side up
- Verify handwriting is clear
- Manually enter data in review interface

### Missing Fields

**Problem**: Some fields not extracted

**Solutions**:
- AI skips blank fields (this is normal)
- Fill in missing data during review
- Check if handwriting is too light/unclear

### Import Fails

**Problem**: Import to database fails

**Solutions**:
- Ensure all required fields are filled
- Check for duplicate submissions (same name + building + unit)
- Verify building address matches existing addresses

## Cost Estimate

**Claude 3.5 Sonnet Vision Pricing:**
- ~$0.015 per page
- 50 forms = ~$0.75
- 100 forms = ~$1.50
- 200 forms = ~$3.00

Very affordable compared to manual data entry time.

## Best Practices

1. **Batch Similar Forms**: Upload forms from same building together
2. **Review Immediately**: Review extractions while forms are fresh
3. **Double-Check Critical Fields**: Always verify phone numbers and addresses
4. **Save Progress**: You can close review and resume later
5. **Keep Original Scans**: PDFs are attached to submissions for reference

## Technical Details

### Database Schema

```sql
-- Batch tracking
scan_batches (
  id, created_at, uploaded_by, total_pages, status, notes
)

-- Individual extractions
scan_extractions (
  id, batch_id, page_number, scan_image_path, scan_pdf_path,
  extracted_data, confidence, reviewed, final_data, 
  imported, submission_id
)
```

### API Endpoints

- `POST /api/admin/scan-upload` - Upload PDF/images
- `POST /api/admin/extract-forms` - Trigger AI extraction
- `GET /api/admin/scan-extractions` - Get extraction data
- `PUT /api/admin/scan-extractions` - Update reviewed data
- `POST /api/admin/import-scans` - Import to submissions

### Batch Statuses

- **uploaded** - Files uploaded, ready for extraction
- **processing** - AI extraction in progress
- **ready_for_review** - Extraction complete, ready to review
- **imported** - All pages reviewed and imported

## Support

For issues or questions:
1. Check scan quality first
2. Verify API key is configured
3. Check browser console for errors
4. Review Supabase logs for backend issues

## Future Enhancements

Potential improvements:
- Multi-language support (Spanish, Portuguese)
- Signature extraction from scans
- Automatic duplicate detection
- Bulk edit capabilities
- Export review corrections for training
