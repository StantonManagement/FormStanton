import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import ImageModule from 'docxtemplater-image-module-free';
import fs from 'fs';
import path from 'path';

interface TemplateData {
  tenant_name: string;
  building_address: string;
  unit_number: string;
  date: string;
  signature_date?: string;
  signature_image?: string;
  pet_type?: string;
  pet_name?: string;
  pet_breed?: string;
  pet_weight?: string;
  pet_color?: string;
  pet_spayed?: string;
  pet_vaccinations?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: string;
  vehicle_color?: string;
  vehicle_plate?: string;
}

export async function generateDocument(
  templateName: 'pet_addendum_template' | 'no_pets_template' | 'vehicle_addendum_template',
  data: TemplateData
): Promise<Buffer> {
  const templatePath = path.join(process.cwd(), `${templateName}.docx`);
  
  const content = fs.readFileSync(templatePath, 'binary');
  const zip = new PizZip(content);

  const imageOpts = {
    centered: false,
    getImage: (tagValue: string) => {
      return Buffer.from(tagValue, 'base64');
    },
    getSize: (): [number, number] => {
      return [200, 50];
    },
  };

  const doc = new Docxtemplater(zip, {
    modules: [new ImageModule(imageOpts)],
    paragraphLoop: true,
    linebreaks: true,
  });

  doc.render(data);

  const buffer = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });

  return buffer;
}

export function prepareTemplateData(
  formData: any,
  signatureBase64?: string,
  signatureDate?: string
): TemplateData {
  const data: TemplateData = {
    tenant_name: formData.fullName || formData.full_name,
    building_address: formData.buildingAddress || formData.building_address,
    unit_number: formData.unitNumber || formData.unit_number,
    date: new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  };

  if (signatureBase64) {
    data.signature_image = signatureBase64.replace(/^data:image\/\w+;base64,/, '');
  }

  if (signatureDate) {
    data.signature_date = new Date(signatureDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  return data;
}

export function preparePetTemplateData(
  formData: any,
  signatureBase64?: string,
  signatureDate?: string
): TemplateData {
  const baseData = prepareTemplateData(formData, signatureBase64, signatureDate);

  return {
    ...baseData,
    pet_type: formData.petType || formData.pet_type,
    pet_name: formData.petName || formData.pet_name,
    pet_breed: formData.petBreed || formData.pet_breed,
    pet_weight: String(formData.petWeight || formData.pet_weight),
    pet_color: formData.petColor || formData.pet_color,
    pet_spayed: formData.petSpayed || formData.pet_spayed ? 'Yes' : 'No',
    pet_vaccinations: formData.petVaccinationsCurrent || formData.pet_vaccinations_current ? 'Yes' : 'No',
  };
}

export function prepareVehicleTemplateData(
  formData: any,
  signatureBase64?: string,
  signatureDate?: string
): TemplateData {
  const baseData = prepareTemplateData(formData, signatureBase64, signatureDate);

  return {
    ...baseData,
    vehicle_make: formData.vehicleMake || formData.vehicle_make,
    vehicle_model: formData.vehicleModel || formData.vehicle_model,
    vehicle_year: String(formData.vehicleYear || formData.vehicle_year),
    vehicle_color: formData.vehicleColor || formData.vehicle_color,
    vehicle_plate: formData.vehiclePlate || formData.vehicle_plate,
  };
}
