import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { tenantForms, getFormById } from '@/lib/formsData';
import { llcTable } from '@/lib/policyContent';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { drawHeader, drawFooter, wrapText, drawTextBlock, drawCheckbox, drawSignatureLine } from '@/lib/pdfTemplates';
import { FORM_CONTENTS } from '@/lib/pdfTemplates';

interface GeneratePackageRequest {
  tenant: {
    name: string;
    buildingAddress: string;
    unitNumber: string;
    phone?: string;
    email?: string;
  };
  selectedForms: number[];
  staffName: string;
}

interface TemplateData {
  tenant_name: string;
  building_address: string;
  unit_number: string;
  phone?: string;
  email?: string;
  date: string;
  staff_name: string;
  llc_name?: string;
  llc_address: string;
}

function findLLCForAddress(address: string): string | null {
  const entry = llcTable.find(([building]) => 
    address.toLowerCase().includes(building.toLowerCase())
  );
  return entry ? entry[1] : null;
}

function replacePlaceholders(template: string, data: TemplateData): string {
  let result = template;
  
  // Replace standard placeholders
  Object.entries(data).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder, 'g'), value || '');
  });
  
  return result;
}

function markdownToHtml(markdown: string): string {
  let html = markdown;
  
  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>');
  
  // Bold text
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // Line breaks
  html = html.replace(/\n\n/g, '</p><p class="mb-2">');
  html = `<p class="mb-2">${html}</p>`;
  
  // Fix double paragraphs
  html = html.replace(/<p class="mb-2"><\/p>/g, '<br />');
  html = html.replace(/<p class="mb-2">(.*?)<\/p>/g, (match, p1) => {
    if (p1.includes('<h') || p1.includes('<br')) {
      return p1;
    }
    return `<p class="mb-2">${p1}</p>`;
  });
  
  // Horizontal rules
  html = html.replace(/---/g, '<hr class="my-4 border-gray-300" />');
  
  // Checkboxes
  html = html.replace(/\[ \]/g, '<input type="checkbox" class="inline mr-2" />');
  html = html.replace(/\[x\]/g, '<input type="checkbox" checked class="inline mr-2" />');
  
  return html;
}

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: GeneratePackageRequest = await request.json();
    const { tenant, selectedForms, staffName } = body;

    // Validate request
    if (!tenant.name || !tenant.buildingAddress || !tenant.unitNumber || !staffName) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Find LLC for building
    const llcName = findLLCForAddress(tenant.buildingAddress) || 'Stanton Management LLC';
    
    // Prepare template data
    const templateData: TemplateData = {
      tenant_name: tenant.name,
      building_address: tenant.buildingAddress,
      unit_number: tenant.unitNumber,
      phone: tenant.phone,
      email: tenant.email,
      date: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      staff_name: staffName,
      llc_name: llcName,
      llc_address: '421 Park St, Hartford CT 06106'
    };

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    let pageNumber = 1;

    // Generate each selected form as PDF
    for (const formId of selectedForms) {
      let content = '';
      
      // Get form content based on form ID
      switch (formId) {
        case 1: // Move-in inspection
          content = FORM_CONTENTS.MOVE_IN_INSPECTION;
          break;
        case 2: // Smoke detector
          content = FORM_CONTENTS.SMOKE_DETECTOR;
          break;
        case 3: // Utilities
          content = FORM_CONTENTS.UTILITIES;
          break;
        default:
          // For other forms, try to get from formsData
          const form = getFormById(formId);
          if (form && form.content) {
            content = form.content;
          } else {
            console.warn(`Form ${formId} not found or has no content`);
            continue;
          }
      }

      // Add new page for each form
      const page = pdfDoc.addPage([612, 792]);
      let y = drawHeader(page, fontBold, fontRegular, `FORM ${formId}`, 50);

      // Replace placeholders in content
      const processedContent = replacePlaceholders(content, templateData);
      
      // Convert content to lines and draw
      const lines = wrapText(processedContent, fontRegular, 10, 512);
      const result = drawTextBlock(pdfDoc, page, lines, 50, y, fontRegular, 10, 14);
      
      // Add footer
      drawFooter(pdfDoc, result.page, fontRegular, pageNumber, 50);
      pageNumber++;
    }

    if (pdfDoc.getPageCount() === 0) {
      return NextResponse.json(
        { success: false, message: 'No valid forms selected' },
        { status: 400 }
      );
    }

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();

    // Return PDF as base64 for client-side display
    const base64 = Buffer.from(pdfBytes).toString('base64');
    
    return NextResponse.json({
      success: true,
      pdf: `data:application/pdf;base64,${base64}`,
      formCount: pdfDoc.getPageCount(),
      llc: llcName
    });

  } catch (error: any) {
    console.error('Form package generation error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to generate form package' },
      { status: 500 }
    );
  }
}
