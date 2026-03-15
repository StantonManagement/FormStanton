import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';

// Helper: wrap text to fit within a given width
export function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');
  for (const para of paragraphs) {
    if (para.trim() === '') { lines.push(''); continue; }
    const words = para.split(' ');
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);
      if (width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
  }
  return lines;
}

// Helper: draw text block and return new Y position, adding pages as needed
export function drawTextBlock(
  doc: PDFDocument,
  page: PDFPage,
  lines: string[],
  x: number,
  startY: number,
  font: PDFFont,
  fontSize: number,
  lineHeight: number,
  color = rgb(0.1, 0.1, 0.1),
): { page: PDFPage; y: number } {
  let y = startY;
  let currentPage = page;
  for (const line of lines) {
    if (y < 50) {
      currentPage = doc.addPage([612, 792]);
      y = 742;
    }
    currentPage.drawText(line, { x, y, size: fontSize, font, color });
    y -= lineHeight;
  }
  return { page: currentPage, y };
}

// Helper: draw a header with company info
export function drawHeader(
  page: PDFPage,
  fontBold: PDFFont,
  fontRegular: PDFFont,
  title: string,
  margin: number = 50,
) {
  let y = 742;
  
  // Company header
  page.drawText('STANTON MANAGEMENT', { x: margin, y, size: 12, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  y -= 14;
  page.drawText('421 Park Street, Hartford CT 06106', { x: margin, y, size: 9, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
  y -= 12;
  page.drawText('Phone: (860) 522-8877 | Fax: (860) 522-8878', { x: margin, y, size: 9, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
  y -= 20;
  
  // Title
  page.drawText(title, { x: margin, y, size: 18, font: fontBold, color: rgb(0.1, 0.1, 0.2) });
  y -= 8;
  
  // Draw line under title
  page.drawLine({
    start: { x: margin, y },
    end: { x: 562, y },
    thickness: 1,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 20;
  
  return y;
}

// Helper: draw footer with page numbers
export function drawFooter(
  doc: PDFDocument,
  page: PDFPage,
  fontRegular: PDFFont,
  pageNumber: number,
  margin: number = 50,
) {
  const y = 30;
  page.drawText(`Page ${pageNumber}`, { x: margin, y, size: 9, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
  page.drawText(`Generated on ${new Date().toLocaleDateString()}`, { x: 562 - 100, y, size: 9, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
}

// Helper: draw a checkbox
export function drawCheckbox(
  page: PDFPage,
  x: number,
  y: number,
  checked: boolean = false,
  size: number = 12,
) {
  // Draw box
  page.drawRectangle({
    x,
    y: y - size,
    width: size,
    height: size,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  });
  
  // Draw checkmark if checked
  if (checked) {
    page.drawLine({
      start: { x: x + 2, y: y - size + 6 },
      end: { x: x + 5, y: y - 3 },
      thickness: 2,
      color: rgb(0, 0, 0),
    });
    page.drawLine({
      start: { x: x + 5, y: y - 3 },
      end: { x: x + 10, y: y - 8 },
      thickness: 2,
      color: rgb(0, 0, 0),
    });
  }
}

// Helper: draw a signature line
export function drawSignatureLine(
  page: PDFPage,
  x: number,
  y: number,
  width: number = 200,
  label: string = 'Signature',
  font: PDFFont = StandardFonts.Helvetica as any, // Default font, should be embedded by caller
) {
  page.drawText(label, { x, y, size: 10, font });
  y -= 4;
  page.drawLine({
    start: { x, y },
    end: { x: x + width, y },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  return y - 20;
}

// Standard form content templates
export const FORM_CONTENTS = {
  MOVE_IN_INSPECTION: `
MOVE-IN INSPECTION CHECKLIST

Property Address: {{building_address}}
Unit: {{unit_number}}
Tenant: {{tenant_name}}
Date: {{date}}

GENERAL CONDITION
☐ Walls - Clean, no holes or damage
☐ Ceilings - No stains or cracks
☐ Floors - Clean, no damage
☐ Windows - Clean, no cracks, locks work
☐ Doors - Close properly, locks work
☐ Light fixtures - All working
☐ Electrical outlets - All working
☐ Smoke detectors - Working, tested
☐ Carbon monoxide detector - Working, tested

KITCHEN
☐ Cabinets - Clean, no damage
☐ Countertops - Clean, no damage
☐ Sink - No leaks, drains properly
☐ Appliances - All working (stove, refrigerator, etc.)
☐ Faucet - No leaks, good pressure

BATHROOM(S)
☐ Toilet - Flushes properly, no leaks
☐ Tub/Shower - No leaks, good drainage
☐ Sink - No leaks, drains properly
☐ Tiles/Grout - No cracks or missing pieces
☐ Exhaust fan - Working

BEDROOM(S)
☐ Closets - Clean, rod present
☐ Windows - Operate properly
☐ Electrical outlets - Working
☐ Light fixtures - Working

LIVING AREAS
☐ Flooring - Clean, no damage
☐ Windows - Operate properly
☐ Electrical outlets - Working
☐ Light fixtures - Working

MISCELLANEOUS
☐ Thermostat - Working
☐ Air filters - Clean
☐ Fire extinguisher - Present (if required)
☐ Mailbox - Key provided, working

COMMENTS/OBSERVATIONS:



TENANT ACKNOWLEDGEMENT:
I acknowledge that the premises have been inspected and that the condition noted above is correct.
Any pre-existing damage has been documented and will not be charged to me upon move-out.

Tenant Signature: _________________________ Date: _______________

Staff Signature: _________________________ Date: _______________
`,

  SMOKE_DETECTOR: `
SMOKE & CARBON MONOXIDE DETECTOR ACKNOWLEDGMENT

Property Address: {{building_address}}
Unit: {{unit_number}}
Tenant: {{tenant_name}}
Date: {{date}}

CONNECTICUT STATE LAW REQUIREMENT:
Connecticut law requires that all residential dwelling units have working smoke detectors
and carbon monoxide detectors installed.

DETECTOR LOCATIONS:
☐ Living room/sitting area
☐ Hallway outside bedrooms
☐ Each bedroom
☐ Near furnace/utility room
☐ Kitchen (if required)

TESTING PROCEDURE:
1. Press test button on each detector
2. Ensure alarm sounds clearly
3. Check battery indicator lights
4. Note any detectors not functioning

TENANT RESPONSIBILITIES:
- Test detectors monthly
- Replace batteries as needed (typically twice per year)
- Never disable or remove detectors
- Report malfunctioning detectors immediately
- Maintain detectors in working condition at all times

LANDLORD RESPONSIBILITIES:
- Install detectors in proper locations
- Provide written instructions
- Replace detectors as needed (typically every 10 years)
- Respond to reports of malfunction

EMERGENCY PROCEDURES:
In case of alarm activation:
1. Evacuate immediately
2. Call 911 from outside the building
3. Do not re-enter until cleared by emergency personnel

ACKNOWLEDGMENT:
I acknowledge receipt of this information and understand my responsibilities regarding
smoke and carbon monoxide detectors. I have tested all detectors and confirm they are
in working condition.

Tenant Signature: _________________________ Date: _______________

Staff Signature: _________________________ Date: _______________

Staff Name: {{staff_name}}
`,

  UTILITIES: `
UTILITIES INFORMATION & RESPONSIBILITIES

Property Address: {{building_address}}
Unit: {{unit_number}}
Tenant: {{tenant_name}}
Date: {{date}}

UTILITY COMPANIES & CONTACT INFORMATION:

ELECTRIC:
☐ Tenant Responsibility
☐ Landlord Responsibility (common areas only)
Provider: Eversource
Contact: 1-800-286-2000
Website: eversource.com

GAS:
☐ Tenant Responsibility
☐ Landlord Responsibility (common areas only)
Provider: Connecticut Natural Gas
Contact: 1-800-659-5299
Website: cngcorp.com

WATER & SEWER:
☐ Tenant Responsibility
☐ Landlord Responsibility
Provider: Metropolitan District Commission (MDC)
Contact: 1-860-278-7850
Website: mdc.ct.gov

HEATING OIL (if applicable):
☐ Tenant Responsibility
☐ Landlord Responsibility
Provider: _________________________
Contact: _________________________

TELEPHONE/INTERNET:
☐ Tenant Responsibility
Provider: Tenant's choice
Options: Frontier, Comcast, etc.

TENANT UTILITY RESPONSIBILITIES:
1. Establish service in your name before move-in
2. Pay all utility bills on time
3. Maintain utilities in good standing
4. Provide proof of final payment when moving out
5. Report utility issues to appropriate company

LANDLORD UTILITY RESPONSIBILITIES:
1. Maintain common area utilities
2. Address utility issues affecting building systems
3. Provide utility connection information
4. Coordinate utility work as needed

IMPORTANT NOTES:
- Utility services must be active at move-in
- Failure to maintain utilities may violate lease
- Water leaks should be reported immediately
- Gas odors should be reported to gas company immediately

ACKNOWLEDGMENT:
I understand which utilities I am responsible for and will ensure all required services
are established and maintained during my tenancy.

Tenant Signature: _________________________ Date: _______________

Staff Signature: _________________________ Date: _______________

Staff Name: {{staff_name}}
`,
};
