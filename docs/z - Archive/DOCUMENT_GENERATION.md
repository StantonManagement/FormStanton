# Document Generation Guide

This document explains how the automated document generation works in the tenant onboarding form.

## Overview

The system automatically generates Word documents (.docx) based on form submissions using **docxtemplater**. Documents are filled with tenant data and include embedded signature images.

## Document Templates

Three Word templates are used:

1. **`pet_addendum_template.docx`** - For tenants with pets
2. **`no_pets_template.docx`** - For tenants without pets
3. **`vehicle_addendum_template.docx`** - For tenants with vehicles

Templates are stored in the project root directory and accessed server-side during form submission.

## Template Placeholders

Templates use `{{placeholder}}` format for data insertion:

### Common Placeholders (All Templates)
- `{{tenant_name}}` - Full name of tenant
- `{{building_address}}` - Building address
- `{{unit_number}}` - Unit/apartment number
- `{{date}}` - Current date (formatted)
- `{{signature_date}}` - Date of signature
- `{{signature_image}}` - Embedded signature image

### Pet Addendum Specific
- `{{pet_type}}` - Dog or Cat
- `{{pet_name}}` - Pet's name
- `{{pet_breed}}` - Breed
- `{{pet_weight}}` - Weight in pounds
- `{{pet_color}}` - Color/markings
- `{{pet_spayed}}` - Yes/No
- `{{pet_vaccinations}}` - Yes/No

### Vehicle Addendum Specific
- `{{vehicle_make}}` - Make (e.g., Toyota)
- `{{vehicle_model}}` - Model (e.g., Camry)
- `{{vehicle_year}}` - Year
- `{{vehicle_color}}` - Color
- `{{vehicle_plate}}` - License plate number

## Generation Flow

### 1. Form Submission
When a tenant submits the form:
1. Form data is validated
2. Files (vaccination records, insurance, photos) are uploaded to Supabase storage
3. Signature images are saved as PNG files
4. Submission record is created in database

### 2. Document Generation
Based on form responses:

**If tenant has pets:**
- Generate `pet_addendum_template.docx` with pet details
- Include pet signature image
- Save as `{submission_id}_pet_addendum.docx`

**If tenant has no pets:**
- Generate `no_pets_template.docx` 
- Include signature confirming no pets
- Save as `{submission_id}_no_pets_addendum.docx`

**If tenant has vehicle:**
- Generate `vehicle_addendum_template.docx` with vehicle details
- Include vehicle signature image
- Save as `{submission_id}_vehicle_addendum.docx`

### 3. Storage
Generated documents are uploaded to Supabase storage:
```
submissions/
  ├── documents/
  │   ├── {id}_pet_addendum.docx
  │   ├── {id}_no_pets_addendum.docx
  │   └── {id}_vehicle_addendum.docx
  ├── signatures/
  │   ├── {id}_pet_signature.png
  │   └── {id}_vehicle_signature.png
  ├── vaccinations/
  ├── pet_photos/
  └── insurance/
```

### 4. Database Update
Document paths are stored in the submissions table:
- `pet_addendum_file` - Path to pet/no-pet document
- `vehicle_addendum_file` - Path to vehicle document

## Signature Handling

Signatures from `react-signature-canvas` are processed as follows:

1. **Capture**: Canvas generates base64 PNG data URL
2. **Storage**: Base64 converted to buffer and saved as PNG
3. **Embedding**: Base64 (without prefix) inserted into Word template
4. **Sizing**: Signatures rendered at 200x50 pixels in documents

```javascript
// Signature processing
const base64Data = signatureDataUrl.replace(/^data:image\/\w+;base64,/, '');
const buffer = Buffer.from(base64Data, 'base64');

// In template
signature_image: base64Data // Without data URL prefix
```

## Technical Implementation

### Dependencies
```json
{
  "docxtemplater": "^3.45.0",
  "pizzip": "^3.1.6",
  "docxtemplater-image-module-free": "^1.1.1"
}
```

### Key Functions

**`generateDocument(templateName, data)`**
- Loads Word template from file system
- Fills placeholders with provided data
- Embeds signature images
- Returns document as Buffer

**`preparePetTemplateData(formData, signature, date)`**
- Formats form data for pet addendum template
- Converts boolean values to Yes/No
- Formats dates properly

**`prepareVehicleTemplateData(formData, signature, date)`**
- Formats form data for vehicle addendum template
- Ensures all fields are strings

**`prepareTemplateData(formData, signature, date)`**
- Base template data preparation
- Used for no-pets template

### Error Handling

Document generation errors are caught and logged but don't fail the submission:

```javascript
try {
  // Generate documents
} catch (docError) {
  console.error('Document generation failed:', docError);
  // Submission still succeeds
}
```

This ensures form submissions complete even if document generation fails.

## Supabase Storage Setup

### Required Buckets

Create a `submissions` bucket with these folders:
- `documents/` - Generated Word documents
- `signatures/` - Signature PNG files
- `vaccinations/` - Vaccination records
- `pet_photos/` - Pet photos
- `insurance/` - Insurance documents

### Storage Policies

```sql
-- Allow authenticated uploads
create policy "Allow authenticated uploads"
on storage.objects for insert
to authenticated
with check (bucket_id = 'submissions');

-- Allow authenticated reads
create policy "Allow authenticated reads"
on storage.objects for select
to authenticated
using (bucket_id = 'submissions');
```

## Accessing Generated Documents

### From Database
```javascript
const { data: submission } = await supabase
  .from('submissions')
  .select('pet_addendum_file, vehicle_addendum_file')
  .eq('id', submissionId)
  .single();
```

### Download URL
```javascript
const { data } = supabase.storage
  .from('submissions')
  .getPublicUrl(submission.pet_addendum_file);
```

### Download File
```javascript
const { data, error } = await supabase.storage
  .from('submissions')
  .download(submission.pet_addendum_file);
```

## Future Enhancements

### PDF Conversion
Convert generated Word documents to PDF:
```javascript
// Using a service like LibreOffice or Gotenberg
const pdf = await convertToPDF(docxBuffer);
```

### Email Attachments
Attach generated documents to confirmation emails:
```javascript
await resend.emails.send({
  attachments: [
    {
      filename: 'pet_addendum.docx',
      content: docBuffer.toString('base64'),
    }
  ]
});
```

### Combined PDF
Merge multiple addendums into single PDF:
```javascript
const combinedPdf = await mergePDFs([
  petAddendumPdf,
  vehicleAddendumPdf
]);
```

## Troubleshooting

### Template Not Found
**Error**: `ENOENT: no such file or directory`
**Solution**: Ensure template files are in project root

### Invalid Placeholder
**Error**: `Unclosed tag`
**Solution**: Check template for properly formatted `{{placeholders}}`

### Signature Not Appearing
**Issue**: Signature placeholder shows as text
**Solution**: Verify ImageModule is configured and base64 has no prefix

### Document Corrupted
**Issue**: Generated .docx won't open
**Solution**: Check template is valid Word document, not corrupted

### Storage Upload Failed
**Error**: `Storage upload error`
**Solution**: Verify Supabase storage bucket exists and has correct policies

## Testing

### Manual Test
1. Submit form with test data
2. Check Supabase storage for generated documents
3. Download and open documents
4. Verify all placeholders are filled
5. Verify signature images appear correctly

### Automated Test
```javascript
// Test document generation
const testData = {
  tenant_name: 'John Doe',
  building_address: '31-33 Park St',
  unit_number: '2A',
  date: '2024-02-04',
  // ... other fields
};

const doc = await generateDocument('pet_addendum_template', testData);
expect(doc).toBeInstanceOf(Buffer);
```

## Support

For issues with document generation:
1. Check server logs for errors
2. Verify template files are accessible
3. Ensure all required placeholders exist in templates
4. Test with minimal data first
5. Check Supabase storage permissions
