import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import { PET_ADDENDUM, VEHICLE_ADDENDUM } from '@/lib/addendums';
import { drawHeader, drawFooter, wrapText, drawTextBlock, drawCheckbox, drawSignatureLine } from './pdfTemplates';

export async function generatePetAddendumPdf(
  formData: any,
  petsArray: any[],
  signatureBase64?: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([612, 792]);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const margin = 50;
  const contentWidth = 512;
  let y = 742;

  const tenantName = formData.fullName || formData.full_name || formData.tenantName || formData.tenant_name || '';
  const building = formData.buildingAddress || formData.building_address || '';
  const unit = formData.unitNumber || formData.unit_number || '';
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Title
  page.drawText('PET ADDENDUM', { x: margin, y, size: 18, font: fontBold, color: rgb(0.1, 0.1, 0.2) });
  y -= 28;

  // Tenant info
  page.drawText(`Tenant: ${tenantName}`, { x: margin, y, size: 10, font: fontRegular });
  y -= 14;
  page.drawText(`Building: ${building}  |  Unit: ${unit}  |  Date: ${dateStr}`, { x: margin, y, size: 10, font: fontRegular });
  y -= 24;

  // Addendum body text
  const bodyLines = wrapText(PET_ADDENDUM, fontRegular, 9, contentWidth);
  const result1 = drawTextBlock(pdfDoc, page, bodyLines, margin, y, fontRegular, 9, 12);
  page = result1.page;
  y = result1.y - 20;

  // Registered Pets section — highlighted
  if (y < 120) { page = pdfDoc.addPage([612, 792]); y = 742; }
  page.drawText('REGISTERED PETS:', { x: margin, y, size: 14, font: fontBold, color: rgb(0.0, 0.2, 0.5) });
  y -= 24;

  for (let i = 0; i < petsArray.length; i++) {
    const pet = petsArray[i];
    if (y < 140) { page = pdfDoc.addPage([612, 792]); y = 742; }

    // Pet header — larger distinct font
    const petLabel = `Pet #${i + 1}`;
    page.drawText(petLabel, { x: margin, y, size: 13, font: fontBold, color: rgb(0.0, 0.3, 0.6) });
    y -= 20;

    // Pet details — larger font to stand out
    const detailFont = fontBold;
    const detailSize = 12;
    const detailColor = rgb(0.0, 0.15, 0.4);
    const labelFont = fontRegular;
    const labelSize = 10;

    const fields = [
      { label: 'Type:', value: (pet.petType || pet.pet_type || '').toUpperCase() },
      { label: 'Name:', value: pet.petName || pet.pet_name || '' },
      { label: 'Breed:', value: pet.petBreed || pet.pet_breed || '' },
      { label: 'Weight:', value: `${pet.petWeight || pet.pet_weight || ''} lbs` },
      { label: 'Color:', value: pet.petColor || pet.pet_color || '' },
      { label: 'Spayed/Neutered:', value: (pet.petSpayed ?? pet.pet_spayed) ? 'Yes' : 'No' },
      { label: 'Vaccinations Current:', value: (pet.petVaccinationsCurrent ?? pet.pet_vaccinations_current) ? 'Yes' : 'No' },
    ];

    for (const f of fields) {
      if (y < 50) { page = pdfDoc.addPage([612, 792]); y = 742; }
      page.drawText(`${f.label}`, { x: margin + 10, y, size: labelSize, font: labelFont, color: rgb(0.3, 0.3, 0.3) });
      page.drawText(f.value, { x: margin + 140, y, size: detailSize, font: detailFont, color: detailColor });
      y -= 18;
    }
    y -= 10;
  }

  // Signature
  if (signatureBase64) {
    if (y < 100) { page = pdfDoc.addPage([612, 792]); y = 742; }
    y -= 10;
    page.drawText('Signature:', { x: margin, y, size: 10, font: fontBold });
    y -= 5;
    try {
      const sigData = signatureBase64.replace(/^data:image\/\w+;base64,/, '');
      const sigImage = await pdfDoc.embedPng(Buffer.from(sigData, 'base64'));
      const sigDims = sigImage.scale(0.4);
      y -= sigDims.height;
      if (y < 50) { page = pdfDoc.addPage([612, 792]); y = 742 - sigDims.height; }
      page.drawImage(sigImage, { x: margin, y, width: sigDims.width, height: sigDims.height });
      y -= 15;
    } catch (e) {
      console.error('Failed to embed signature image:', e);
    }
    page.drawText(`Date: ${dateStr}`, { x: margin, y, size: 10, font: fontRegular });
  }

  return pdfDoc.save();
}

export async function generateNoPetsAddendumPdf(
  formData: any,
  signatureBase64?: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([612, 792]);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const margin = 50;
  const contentWidth = 512;
  let y = 742;

  const tenantName = formData.fullName || formData.full_name || formData.tenantName || formData.tenant_name || '';
  const building = formData.buildingAddress || formData.building_address || '';
  const unit = formData.unitNumber || formData.unit_number || '';
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  page.drawText('PET ADDENDUM — NO PETS', { x: margin, y, size: 18, font: fontBold, color: rgb(0.1, 0.1, 0.2) });
  y -= 28;
  page.drawText(`Tenant: ${tenantName}`, { x: margin, y, size: 10, font: fontRegular });
  y -= 14;
  page.drawText(`Building: ${building}  |  Unit: ${unit}  |  Date: ${dateStr}`, { x: margin, y, size: 10, font: fontRegular });
  y -= 24;

  const bodyLines = wrapText(PET_ADDENDUM, fontRegular, 9, contentWidth);
  const result1 = drawTextBlock(pdfDoc, page, bodyLines, margin, y, fontRegular, 9, 12);
  page = result1.page;
  y = result1.y - 20;

  if (y < 80) { page = pdfDoc.addPage([612, 792]); y = 742; }
  page.drawText('TENANT CONFIRMS: NO PETS', { x: margin, y, size: 14, font: fontBold, color: rgb(0.5, 0.0, 0.0) });
  y -= 20;
  page.drawText('I confirm I do not have pets. I understand that if I get a pet, I must register it within 7 days.', { x: margin, y, size: 10, font: fontRegular });
  y -= 30;

  if (signatureBase64) {
    page.drawText('Signature:', { x: margin, y, size: 10, font: fontBold });
    y -= 5;
    try {
      const sigData = signatureBase64.replace(/^data:image\/\w+;base64,/, '');
      const sigImage = await pdfDoc.embedPng(Buffer.from(sigData, 'base64'));
      const sigDims = sigImage.scale(0.4);
      y -= sigDims.height;
      if (y < 50) { page = pdfDoc.addPage([612, 792]); y = 742 - sigDims.height; }
      page.drawImage(sigImage, { x: margin, y, width: sigDims.width, height: sigDims.height });
      y -= 15;
    } catch (e) {
      console.error('Failed to embed signature image:', e);
    }
    page.drawText(`Date: ${dateStr}`, { x: margin, y, size: 10, font: fontRegular });
  }

  return pdfDoc.save();
}

export async function generateVehicleAddendumPdf(
  formData: any,
  signatureBase64?: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([612, 792]);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const margin = 50;
  const contentWidth = 512;
  let y = 742;

  const tenantName = formData.fullName || formData.full_name || formData.tenantName || formData.tenant_name || '';
  const building = formData.buildingAddress || formData.building_address || '';
  const unit = formData.unitNumber || formData.unit_number || '';
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  page.drawText('VEHICLE & PARKING ADDENDUM', { x: margin, y, size: 18, font: fontBold, color: rgb(0.1, 0.1, 0.2) });
  y -= 28;
  page.drawText(`Tenant: ${tenantName}`, { x: margin, y, size: 10, font: fontRegular });
  y -= 14;
  page.drawText(`Building: ${building}  |  Unit: ${unit}  |  Date: ${dateStr}`, { x: margin, y, size: 10, font: fontRegular });
  y -= 24;

  const bodyLines = wrapText(VEHICLE_ADDENDUM, fontRegular, 9, contentWidth);
  const result1 = drawTextBlock(pdfDoc, page, bodyLines, margin, y, fontRegular, 9, 12);
  page = result1.page;
  y = result1.y - 20;

  // Vehicle details — highlighted
  if (y < 160) { page = pdfDoc.addPage([612, 792]); y = 742; }
  page.drawText('REGISTERED VEHICLE:', { x: margin, y, size: 14, font: fontBold, color: rgb(0.0, 0.2, 0.5) });
  y -= 24;

  const vehicleFields = [
    { label: 'Make:', value: formData.vehicleMake || formData.vehicle_make || '' },
    { label: 'Model:', value: formData.vehicleModel || formData.vehicle_model || '' },
    { label: 'Year:', value: String(formData.vehicleYear || formData.vehicle_year || '') },
    { label: 'Color:', value: formData.vehicleColor || formData.vehicle_color || '' },
    { label: 'License Plate:', value: formData.vehiclePlate || formData.vehicle_plate || '' },
  ];

  for (const f of vehicleFields) {
    if (y < 50) { page = pdfDoc.addPage([612, 792]); y = 742; }
    page.drawText(`${f.label}`, { x: margin + 10, y, size: 10, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
    page.drawText(f.value, { x: margin + 140, y, size: 12, font: fontBold, color: rgb(0.0, 0.15, 0.4) });
    y -= 18;
  }
  y -= 20;

  // Additional vehicles
  const additionalVehicles = formData.additionalVehicles || formData.additional_vehicles || [];
  if (additionalVehicles.length > 0) {
    for (let i = 0; i < additionalVehicles.length; i++) {
      const av = additionalVehicles[i];
      if (y < 160) { page = pdfDoc.addPage([612, 792]); y = 742; }
      page.drawText(`ADDITIONAL VEHICLE #${i + 1} (waitlisted):`, { x: margin, y, size: 12, font: fontBold, color: rgb(0.6, 0.3, 0.0) });
      y -= 20;

      const avFields = [
        { label: 'Make:', value: av.vehicleMake || av.vehicle_make || '' },
        { label: 'Model:', value: av.vehicleModel || av.vehicle_model || '' },
        { label: 'Year:', value: String(av.vehicleYear || av.vehicle_year || '') },
        { label: 'Color:', value: av.vehicleColor || av.vehicle_color || '' },
        { label: 'License Plate:', value: av.vehiclePlate || av.vehicle_plate || '' },
      ];

      for (const f of avFields) {
        if (y < 50) { page = pdfDoc.addPage([612, 792]); y = 742; }
        page.drawText(`${f.label}`, { x: margin + 10, y, size: 10, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
        page.drawText(f.value, { x: margin + 140, y, size: 11, font: fontBold, color: rgb(0.4, 0.2, 0.0) });
        y -= 18;
      }
      y -= 15;
    }
  }

  if (signatureBase64) {
    if (y < 100) { page = pdfDoc.addPage([612, 792]); y = 742; }
    page.drawText('Signature:', { x: margin, y, size: 10, font: fontBold });
    y -= 5;
    try {
      const sigData = signatureBase64.replace(/^data:image\/\w+;base64,/, '');
      const sigImage = await pdfDoc.embedPng(Buffer.from(sigData, 'base64'));
      const sigDims = sigImage.scale(0.4);
      y -= sigDims.height;
      if (y < 50) { page = pdfDoc.addPage([612, 792]); y = 742 - sigDims.height; }
      page.drawImage(sigImage, { x: margin, y, width: sigDims.width, height: sigDims.height });
      y -= 15;
    } catch (e) {
      console.error('Failed to embed signature image:', e);
    }
    page.drawText(`Date: ${dateStr}`, { x: margin, y, size: 10, font: fontRegular });
  }

  return pdfDoc.save();
}

export async function generateGenericFormPdf(
  formType: string,
  formTitle: string,
  formData: any,
  signatureBase64?: string,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([612, 792]);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const margin = 50;
  const contentWidth = 512;
  let y = 742;

  const tenantName = formData.fullName || formData.full_name || formData.tenantName || formData.tenant_name || '';
  const building = formData.buildingAddress || formData.building_address || '';
  const unit = formData.unitNumber || formData.unit_number || '';
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Header bar
  page.drawRectangle({ x: margin, y: y - 4, width: 512, height: 18, color: rgb(0.18, 0.22, 0.36) });
  page.drawText('STANTON MANAGEMENT LLC', { x: margin + 6, y: y - 1, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('421 Park Street, Hartford, CT 06106  |  (860) 993-3401', { x: margin + 6 + 160, y: y - 1, size: 8, font: fontRegular, color: rgb(0.8, 0.85, 0.95) });
  y -= 26;

  // Title
  page.drawText(formTitle.toUpperCase(), { x: margin, y, size: 15, font: fontBold, color: rgb(0.18, 0.22, 0.36) });
  y -= 20;

  // Tenant info block
  const unitSizeVal = formData.unitSize ? `  |  Unit Size: ${formData.unitSize}` : '';
  const moveInDateVal = formData.moveInDate || dateStr;
  page.drawRectangle({ x: margin, y: y - 40, width: 512, height: 52, color: rgb(0.95, 0.95, 0.97) });
  page.drawText(`Tenant: ${tenantName}`, { x: margin + 8, y: y - 8, size: 9, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(`Address: ${building}  |  Unit: ${unit}${unitSizeVal}`, { x: margin + 8, y: y - 20, size: 9, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(`Move-In Date: ${moveInDateVal}  |  Keys: ${formData.unitKeys || 0} unit  ${formData.mailboxKeys || 0} mailbox  ${formData.fobs || 0} fobs`, { x: margin + 8, y: y - 32, size: 9, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
  y -= 62;

  // Horizontal rule
  page.drawLine({ start: { x: margin, y }, end: { x: 612 - margin, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
  y -= 16;

  // Form data fields
  const excludeFields = ['buildingAddress', 'building_address', 'unitNumber', 'unit_number', 'tenantName', 'tenant_name', 'fullName', 'full_name', 'dateSubmitted', 'date_submitted', 'finalConfirm', 'final_confirm', 'unitSize', 'unit_size', 'moveInDate', 'move_in_date', 'unitKeys', 'unit_keys', 'mailboxKeys', 'mailbox_keys', 'fobs'];
  
  for (const [key, value] of Object.entries(formData)) {
    if (excludeFields.includes(key) || value === null || value === undefined || value === '') continue;
    
    if (y < 80) { page = pdfDoc.addPage([612, 792]); y = 742; }
    
    // Format field name
    const fieldLabel = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, str => str.toUpperCase())
      .trim();
    
    // Handle arrays of inspection items (item/condition/notes structure)
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null && 'item' in value[0] && 'condition' in value[0]) {
      const visibleItems = (value as Array<{ item: string; condition: string; notes: string }>).filter(r => r.item && r.item.trim());
      if (visibleItems.length === 0) continue;

      if (y < 80) { page = pdfDoc.addPage([612, 792]); y = 742; }

      // Section header bar
      page.drawRectangle({ x: margin, y: y - 4, width: 512, height: 16, color: rgb(0.18, 0.22, 0.36) });
      page.drawText(fieldLabel.toUpperCase(), { x: margin + 6, y: y - 1, size: 8, font: fontBold, color: rgb(1, 1, 1) });
      y -= 20;

      // Column header row
      page.drawRectangle({ x: margin, y: y - 4, width: 512, height: 14, color: rgb(0.93, 0.94, 0.96) });
      const colItem = margin + 4;
      const colCond = margin + 210;
      const colNotes = margin + 320;
      page.drawText('Item', { x: colItem, y: y - 1, size: 7, font: fontBold, color: rgb(0.3, 0.3, 0.4) });
      page.drawText('Condition', { x: colCond, y: y - 1, size: 7, font: fontBold, color: rgb(0.3, 0.3, 0.4) });
      page.drawText('Notes / Description', { x: colNotes, y: y - 1, size: 7, font: fontBold, color: rgb(0.3, 0.3, 0.4) });
      y -= 18;

      for (let ri = 0; ri < visibleItems.length; ri++) {
        const inspItem = visibleItems[ri];
        if (y < 50) { page = pdfDoc.addPage([612, 792]); y = 742; }

        const rowH = 13;
        if (ri % 2 === 1) {
          page.drawRectangle({ x: margin, y: y - rowH + 10, width: 512, height: rowH, color: rgb(0.96, 0.97, 0.98) });
        }

        const condLabel = {
          good: 'Good',
          damage: 'Damage Present',
          immediate_repair: 'Immediate Repair Required',
          missing: 'Missing',
          na: 'N/A',
        }[inspItem.condition] ?? (inspItem.condition || '');

        const condColor = inspItem.condition === 'good'
          ? rgb(0.05, 0.45, 0.05)
          : inspItem.condition === 'damage' || inspItem.condition === 'immediate_repair'
            ? rgb(0.7, 0.35, 0.05)
            : inspItem.condition === 'missing'
              ? rgb(0.65, 0.05, 0.05)
              : rgb(0.4, 0.4, 0.4);

        page.drawText(inspItem.item, { x: colItem, y, size: 8, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
        if (condLabel) page.drawText(condLabel, { x: colCond, y, size: 8, font: fontRegular, color: condColor });
        if (inspItem.notes) page.drawText(inspItem.notes.substring(0, 42), { x: colNotes, y, size: 7, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });

        page.drawLine({ start: { x: margin, y: y - 4 }, end: { x: 562, y: y - 4 }, thickness: 0.3, color: rgb(0.85, 0.85, 0.88) });
        y -= rowH;
      }
      y -= 10;
      continue;
    }

    // Handle other value types
    let displayValue = '';
    if (typeof value === 'boolean') {
      displayValue = value ? 'Yes' : 'No';
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      displayValue = JSON.stringify(value, null, 2);
    } else if (Array.isArray(value)) {
      displayValue = value.join(', ');
    } else {
      displayValue = String(value);
    }
    
    // Draw field
    page.drawText(`${fieldLabel}:`, { x: margin, y, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
    y -= 14;
    
    const valueLines = wrapText(displayValue, fontRegular, 9, contentWidth - 20);
    for (const line of valueLines) {
      if (y < 50) { page = pdfDoc.addPage([612, 792]); y = 742; }
      page.drawText(line, { x: margin + 10, y, size: 9, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
      y -= 12;
    }
    y -= 6;
  }

  // Legal acknowledgment blocks
  if (y < 180) { page = pdfDoc.addPage([612, 792]); y = 742; }
  y -= 10;

  // Management ack
  page.drawRectangle({ x: margin, y: y - 4, width: 512, height: 14, color: rgb(0.18, 0.22, 0.36) });
  page.drawText('MANAGEMENT ACKNOWLEDGMENT', { x: margin + 6, y: y - 1, size: 7, font: fontBold, color: rgb(1, 1, 1) });
  y -= 20;
  const mgmtAckLines = wrapText('This unit is in decent, safe and sanitary condition. Any deficiencies identified in this report will be remedied within 30 days of the date the tenant moves into the unit.', fontRegular, 8, 500);
  for (const line of mgmtAckLines) {
    if (y < 50) { page = pdfDoc.addPage([612, 792]); y = 742; }
    page.drawText(line, { x: margin + 4, y, size: 8, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
    y -= 11;
  }
  y -= 8;
  page.drawLine({ start: { x: margin, y }, end: { x: margin + 220, y }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3) });
  y -= 4;
  page.drawText("Manager's Signature", { x: margin, y, size: 7, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
  page.drawText('Date _______________', { x: margin + 230, y, size: 7, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
  y -= 20;

  // Tenant ack
  if (y < 140) { page = pdfDoc.addPage([612, 792]); y = 742; }
  page.drawRectangle({ x: margin, y: y - 4, width: 512, height: 14, color: rgb(0.18, 0.22, 0.36) });
  page.drawText('TENANT ACKNOWLEDGMENT', { x: margin + 6, y: y - 1, size: 7, font: fontBold, color: rgb(1, 1, 1) });
  y -= 20;
  const tenantAckLines = wrapText('I have inspected the apartment and found this unit to be in decent, safe, and sanitary condition. Any deficiencies are noted above. I understand that I have 48 hours from the time of move-in to report any additional issues in writing. If I do not report any issues within this timeframe, I acknowledge that I am accepting the unit as-is and will be responsible for maintaining its condition, aside from normal wear and tear. In the event of damage, I agree to pay the cost to restore the apartment to its original condition.', fontRegular, 8, 500);
  for (const line of tenantAckLines) {
    if (y < 50) { page = pdfDoc.addPage([612, 792]); y = 742; }
    page.drawText(line, { x: margin + 4, y, size: 8, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
    y -= 11;
  }
  y -= 10;

  if (signatureBase64) {
    if (y < 100) { page = pdfDoc.addPage([612, 792]); y = 742; }
    page.drawText('Resident Signature:', { x: margin, y, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
    y -= 5;
    try {
      const sigData = signatureBase64.replace(/^data:image\/\w+;base64,/, '');
      const sigImage = await pdfDoc.embedPng(Buffer.from(sigData, 'base64'));
      const sigDims = sigImage.scale(0.4);
      y -= sigDims.height;
      if (y < 50) { page = pdfDoc.addPage([612, 792]); y = 742 - sigDims.height; }
      page.drawImage(sigImage, { x: margin, y, width: sigDims.width, height: sigDims.height });
      y -= 10;
    } catch (e) {
      console.error('Failed to embed signature image:', e);
    }
    page.drawText(`Date: ${dateStr}`, { x: margin + 230, y: y + 4, size: 8, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
  } else {
    if (y < 50) { page = pdfDoc.addPage([612, 792]); y = 742; }
    page.drawLine({ start: { x: margin, y }, end: { x: margin + 220, y }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3) });
    y -= 4;
    page.drawText("Resident's Signature", { x: margin, y, size: 7, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
    page.drawText('Date _______________', { x: margin + 230, y, size: 7, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
    y -= 14;
    page.drawLine({ start: { x: margin, y }, end: { x: margin + 220, y }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3) });
    y -= 4;
    page.drawText("Resident's Signature (if applicable)", { x: margin, y, size: 7, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
  }

  return pdfDoc.save();
}

// ─── Blank Form Generators ────────────────────────────────────────────────────

const INSPECTION_SECTIONS = [
  'ENTRANCE / HALLS',
  'BEDROOM(S)',
  'KITCHEN',
  'LIVING ROOM',
  'BATHROOM(S)',
  'OTHER',
];

const BLANK_ROW_COUNT = 6;

export async function generateBlankMoveInPdf(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([612, 792]);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const margin = 50;
  let y = 742;

  const navy = rgb(0.18, 0.22, 0.36);
  const lightGray = rgb(0.96, 0.97, 0.98);
  const medGray = rgb(0.93, 0.94, 0.96);
  const inkLight = rgb(0.4, 0.4, 0.4);
  const borderColor = rgb(0.82, 0.84, 0.88);

  // ── Header bar ──────────────────────────────────────────────────────────────
  page.drawRectangle({ x: margin, y: y - 4, width: 512, height: 20, color: navy });
  page.drawText('STANTON MANAGEMENT LLC', { x: margin + 6, y: y, size: 9, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText('421 Park Street, Hartford, CT 06106  |  (860) 993-3401', {
    x: margin + 6 + 166, y: y, size: 8, font: fontRegular, color: rgb(0.8, 0.85, 0.95),
  });
  y -= 28;

  // ── Title ───────────────────────────────────────────────────────────────────
  page.drawText('MOVE-IN INSPECTION FORM', { x: margin, y, size: 15, font: fontBold, color: navy });
  y -= 22;

  // ── Tenant info block ────────────────────────────────────────────────────────
  page.drawRectangle({ x: margin, y: y - 52, width: 512, height: 64, color: medGray });

  const fieldLine = (label: string, x: number, fy: number, lineW: number) => {
    page.drawText(label, { x, y: fy, size: 7, font: fontBold, color: inkLight });
    page.drawLine({ start: { x, y: fy - 10 }, end: { x: x + lineW, y: fy - 10 }, thickness: 0.6, color: rgb(0.3, 0.3, 0.3) });
  };

  fieldLine('Tenant Name(s)', margin + 8, y - 8, 220);
  fieldLine('Move-In Date', margin + 240, y - 8, 100);
  fieldLine('Unit Size', margin + 355, y - 8, 80);
  fieldLine('Property Address', margin + 8, y - 32, 150);
  fieldLine('Unit No.', margin + 175, y - 32, 60);
  fieldLine('Keys: Unit', margin + 252, y - 32, 30);
  fieldLine('Mailbox', margin + 310, y - 32, 30);
  fieldLine('Fobs', margin + 368, y - 32, 30);

  y -= 72;

  // ── Condition legend ─────────────────────────────────────────────────────────
  page.drawRectangle({ x: margin, y: y - 12, width: 512, height: 16, color: rgb(0.97, 0.97, 0.97) });
  const legendText = 'Conditions:  Good  |  Damage Present  |  Immediate Repair Required  |  Missing  |  N/A';
  page.drawText(legendText, { x: margin + 8, y: y - 8, size: 7, font: fontRegular, color: inkLight });
  y -= 18;

  // ── Inspection sections ──────────────────────────────────────────────────────
  const drawSection = (title: string) => {
    // May need new page
    if (y < 100) {
      page = pdfDoc.addPage([612, 792]);
      y = 742;
    }

    // Section header
    page.drawRectangle({ x: margin, y: y - 4, width: 512, height: 16, color: navy });
    page.drawText(title, { x: margin + 6, y: y - 1, size: 8, font: fontBold, color: rgb(1, 1, 1) });
    y -= 20;

    // Column headers
    page.drawRectangle({ x: margin, y: y - 4, width: 512, height: 14, color: medGray });
    page.drawText('Item', { x: margin + 4, y: y - 1, size: 7, font: fontBold, color: inkLight });
    page.drawText('Condition', { x: margin + 214, y: y - 1, size: 7, font: fontBold, color: inkLight });
    page.drawText('Notes / Description', { x: margin + 324, y: y - 1, size: 7, font: fontBold, color: inkLight });
    y -= 18;

    // Blank rows
    for (let i = 0; i < BLANK_ROW_COUNT; i++) {
      if (y < 50) {
        page = pdfDoc.addPage([612, 792]);
        y = 742;
      }
      const rowH = 16;
      if (i % 2 === 1) {
        page.drawRectangle({ x: margin, y: y - rowH + 10, width: 512, height: rowH, color: lightGray });
      }
      // Column dividers
      page.drawLine({ start: { x: margin + 210, y: y + 8 }, end: { x: margin + 210, y: y - 8 }, thickness: 0.4, color: borderColor });
      page.drawLine({ start: { x: margin + 320, y: y + 8 }, end: { x: margin + 320, y: y - 8 }, thickness: 0.4, color: borderColor });
      // Row bottom border
      page.drawLine({ start: { x: margin, y: y - 8 }, end: { x: margin + 512, y: y - 8 }, thickness: 0.3, color: borderColor });
      y -= rowH;
    }
    y -= 6;
  };

  for (const section of INSPECTION_SECTIONS) {
    drawSection(section);
  }

  // ── Legal acknowledgment ─────────────────────────────────────────────────────
  if (y < 200) {
    page = pdfDoc.addPage([612, 792]);
    y = 742;
  }
  y -= 8;

  // Management ack
  page.drawRectangle({ x: margin, y: y - 4, width: 512, height: 14, color: navy });
  page.drawText('MANAGEMENT ACKNOWLEDGMENT', { x: margin + 6, y: y - 1, size: 7, font: fontBold, color: rgb(1, 1, 1) });
  y -= 20;
  const mgmtLines = wrapText('This unit is in decent, safe and sanitary condition. Any deficiencies identified in this report will be remedied within 30 days of the date the tenant moves into the unit.', fontRegular, 8, 500);
  for (const line of mgmtLines) {
    if (y < 50) { page = pdfDoc.addPage([612, 792]); y = 742; }
    page.drawText(line, { x: margin + 4, y, size: 8, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
    y -= 11;
  }
  y -= 8;
  page.drawLine({ start: { x: margin, y }, end: { x: margin + 220, y }, thickness: 0.6, color: rgb(0.3, 0.3, 0.3) });
  y -= 4;
  page.drawText("Manager's Signature", { x: margin, y, size: 7, font: fontRegular, color: inkLight });
  page.drawText('Date _______________', { x: margin + 230, y, size: 7, font: fontRegular, color: inkLight });
  y -= 22;

  // Tenant ack
  if (y < 150) { page = pdfDoc.addPage([612, 792]); y = 742; }
  page.drawRectangle({ x: margin, y: y - 4, width: 512, height: 14, color: navy });
  page.drawText('TENANT ACKNOWLEDGMENT', { x: margin + 6, y: y - 1, size: 7, font: fontBold, color: rgb(1, 1, 1) });
  y -= 20;
  const tenantLines = wrapText('I have inspected the apartment and found this unit to be in decent, safe, and sanitary condition. Any deficiencies are noted above. I understand that I have 48 hours from the time of move-in to report any additional issues in writing. If I do not report any issues within this timeframe, I acknowledge that I am accepting the unit as-is and will be responsible for maintaining its condition, aside from normal wear and tear. In the event of damage, I agree to pay the cost to restore the apartment to its original condition.', fontRegular, 8, 500);
  for (const line of tenantLines) {
    if (y < 50) { page = pdfDoc.addPage([612, 792]); y = 742; }
    page.drawText(line, { x: margin + 4, y, size: 8, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
    y -= 11;
  }
  y -= 10;

  // Resident signature lines
  if (y < 60) { page = pdfDoc.addPage([612, 792]); y = 742; }
  page.drawLine({ start: { x: margin, y }, end: { x: margin + 220, y }, thickness: 0.6, color: rgb(0.3, 0.3, 0.3) });
  page.drawLine({ start: { x: margin + 280, y }, end: { x: margin + 500, y }, thickness: 0.6, color: rgb(0.3, 0.3, 0.3) });
  y -= 4;
  page.drawText("Resident's Signature", { x: margin, y, size: 7, font: fontRegular, color: inkLight });
  page.drawText('Date', { x: margin + 280, y, size: 7, font: fontRegular, color: inkLight });
  y -= 18;

  if (y < 40) { page = pdfDoc.addPage([612, 792]); y = 742; }
  page.drawLine({ start: { x: margin, y }, end: { x: margin + 220, y }, thickness: 0.6, color: rgb(0.3, 0.3, 0.3) });
  page.drawLine({ start: { x: margin + 280, y }, end: { x: margin + 500, y }, thickness: 0.6, color: rgb(0.3, 0.3, 0.3) });
  y -= 4;
  page.drawText("Resident's Signature (if applicable)", { x: margin, y, size: 7, font: fontRegular, color: inkLight });
  page.drawText('Date', { x: margin + 280, y, size: 7, font: fontRegular, color: inkLight });

  return pdfDoc.save();
}

// ─── Form ID → blank PDF dispatch ─────────────────────────────────────────────

export async function generateBlankFormPdf(formId: number): Promise<Uint8Array | null> {
  switch (formId) {
    case 1:
      return generateBlankMoveInPdf();
    default:
      return null;
  }
}

// Legacy exports kept for backward compatibility — these are no longer used
export function prepareTemplateData(formData: any, signatureBase64?: string, signatureDate?: string) {
  return { tenant_name: formData.fullName || formData.full_name };
}
export function preparePetTemplateData(formData: any, signatureBase64?: string, signatureDate?: string) {
  return prepareTemplateData(formData, signatureBase64, signatureDate);
}
export function prepareVehicleTemplateData(formData: any, signatureBase64?: string, signatureDate?: string) {
  return prepareTemplateData(formData, signatureBase64, signatureDate);
}
export async function generateDocument(templateName: string, data: any): Promise<Buffer> {
  return Buffer.from([]);
}
