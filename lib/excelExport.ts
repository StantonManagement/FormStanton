import * as XLSX from 'xlsx';

interface SubmissionPet {
  pet_type: string;
  pet_name: string;
  pet_breed: string;
  pet_weight: number | string;
  pet_color: string;
  pet_spayed: boolean;
  pet_vaccinations_current: boolean;
  pet_vaccination_file?: string | null;
  pet_photo_file?: string | null;
}

interface Submission {
  id: string;
  created_at: string;
  language: string;
  full_name: string;
  phone: string;
  email: string;
  phone_is_new: boolean;
  building_address: string;
  unit_number: string;
  has_pets: boolean;
  pets?: SubmissionPet[] | null;
  pet_signature?: string;
  pet_signature_date?: string;
  has_insurance: boolean;
  insurance_provider?: string;
  insurance_policy_number?: string;
  insurance_file?: string;
  insurance_upload_pending: boolean;
  add_insurance_to_rent?: boolean;
  has_vehicle: boolean;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  vehicle_color?: string;
  vehicle_plate?: string;
  vehicle_signature?: string;
  vehicle_signature_date?: string;
  additional_vehicles?: { vehicle_make: string; vehicle_model: string; vehicle_year: number | string; vehicle_color: string; vehicle_plate: string; requested_at: string }[] | null;
  pet_addendum_file?: string;
  vehicle_addendum_file?: string;
  combined_pdf?: string;
  ip_address?: string;
  user_agent?: string;
}

function formatPetsForExcel(pets: SubmissionPet[] | null | undefined): {
  types: string; names: string; breeds: string; weights: string; colors: string; spayed: string; vaccinations: string;
} {
  if (!pets || pets.length === 0) return { types: '', names: '', breeds: '', weights: '', colors: '', spayed: '', vaccinations: '' };
  return {
    types: pets.map((p, i) => `${i + 1}. ${p.pet_type || ''}`).join(', '),
    names: pets.map((p, i) => `${i + 1}. ${p.pet_name || ''}`).join(', '),
    breeds: pets.map((p, i) => `${i + 1}. ${p.pet_breed || ''}`).join(', '),
    weights: pets.map((p, i) => `${i + 1}. ${p.pet_weight || ''}`).join(', '),
    colors: pets.map((p, i) => `${i + 1}. ${p.pet_color || ''}`).join(', '),
    spayed: pets.map((p, i) => `${i + 1}. ${p.pet_spayed ? 'Yes' : 'No'}`).join(', '),
    vaccinations: pets.map((p, i) => `${i + 1}. ${p.pet_vaccinations_current ? 'Yes' : 'No'}`).join(', '),
  };
}

export function exportToExcel(submissions: Submission[]) {
  const data = submissions.map(sub => {
    const petInfo = formatPetsForExcel(sub.pets);
    return {
      'Submission Date': new Date(sub.created_at).toLocaleString(),
      'Language': sub.language?.toUpperCase() || '',
      'Full Name': sub.full_name || '',
      'Phone': sub.phone || '',
      'Email': sub.email || '',
      'New Phone': sub.phone_is_new ? 'Yes' : 'No',
      'Building Address': sub.building_address || '',
      'Unit Number': sub.unit_number || '',
      
      'Has Pets': sub.has_pets ? 'Yes' : 'No',
      '# Pets': sub.pets?.length || 0,
      'Pet Types': petInfo.types,
      'Pet Names': petInfo.names,
      'Pet Breeds': petInfo.breeds,
      'Pet Weights (lbs)': petInfo.weights,
      'Pet Colors': petInfo.colors,
      'Pet Spayed/Neutered': petInfo.spayed,
      'Pet Vaccinations Current': petInfo.vaccinations,
      'Pet Signature Date': sub.pet_signature_date || '',
      
      'Has Insurance': sub.has_insurance ? 'Yes' : 'No',
      'Insurance Provider': sub.insurance_provider || '',
      'Insurance Policy Number': sub.insurance_policy_number || '',
      'Insurance Status': sub.insurance_file ? 'Uploaded' : sub.insurance_upload_pending ? 'Pending' : 'N/A',
      'Insurance File': sub.insurance_file ? `${window.location.origin}/api/admin/file?path=${encodeURIComponent(sub.insurance_file)}` : '',
      'Add Insurance to Rent': sub.add_insurance_to_rent ? 'Yes' : 'No',
      
      'Has Vehicle': sub.has_vehicle ? 'Yes' : 'No',
      'Vehicle Make': sub.vehicle_make || '',
      'Vehicle Model': sub.vehicle_model || '',
      'Vehicle Year': sub.vehicle_year || '',
      'Vehicle Color': sub.vehicle_color || '',
      'Vehicle Plate': sub.vehicle_plate || '',
      'Vehicle Signature Date': sub.vehicle_signature_date || '',
      '# Additional Vehicles': sub.additional_vehicles?.length || 0,
      'Additional Vehicles': sub.additional_vehicles && sub.additional_vehicles.length > 0
        ? sub.additional_vehicles.map((av, i) => `${i + 1}. ${av.vehicle_year} ${av.vehicle_make} ${av.vehicle_model} (${av.vehicle_color}) - ${av.vehicle_plate}`).join('; ')
        : '',
      'Additional Vehicle Requested At': sub.additional_vehicles && sub.additional_vehicles.length > 0
        ? sub.additional_vehicles.map((av, i) => `${i + 1}. ${new Date(av.requested_at).toLocaleString()}`).join('; ')
        : '',
      
      'Pet Addendum': sub.pet_addendum_file ? `${window.location.origin}/api/admin/file?path=${encodeURIComponent(sub.pet_addendum_file)}` : '',
      'Vehicle Addendum': sub.vehicle_addendum_file ? `${window.location.origin}/api/admin/file?path=${encodeURIComponent(sub.vehicle_addendum_file)}` : '',
      
      'Submission ID': sub.id || '',
      'IP Address': sub.ip_address || '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  
  const colWidths = [
    { wch: 20 }, // Submission Date
    { wch: 10 }, // Language
    { wch: 20 }, // Full Name
    { wch: 15 }, // Phone
    { wch: 25 }, // Email
    { wch: 10 }, // New Phone
    { wch: 30 }, // Building Address
    { wch: 10 }, // Unit Number
    { wch: 10 }, // Has Pets
    { wch: 8 },  // # Pets
    { wch: 25 }, // Pet Types
    { wch: 25 }, // Pet Names
    { wch: 25 }, // Pet Breeds
    { wch: 20 }, // Pet Weights
    { wch: 20 }, // Pet Colors
    { wch: 25 }, // Pet Spayed
    { wch: 25 }, // Pet Vaccinations
    { wch: 15 }, // Pet Signature Date
    { wch: 15 }, // Has Insurance
    { wch: 20 }, // Insurance Provider
    { wch: 20 }, // Insurance Policy
    { wch: 15 }, // Insurance Status
    { wch: 50 }, // Insurance File
    { wch: 20 }, // Add to Rent
    { wch: 15 }, // Has Vehicle
    { wch: 15 }, // Vehicle Make
    { wch: 15 }, // Vehicle Model
    { wch: 10 }, // Vehicle Year
    { wch: 15 }, // Vehicle Color
    { wch: 15 }, // Vehicle Plate
    { wch: 15 }, // Vehicle Signature Date
    { wch: 8 },  // # Additional Vehicles
    { wch: 60 }, // Additional Vehicles
    { wch: 40 }, // Additional Vehicle Requested At
    { wch: 50 }, // Pet Addendum
    { wch: 50 }, // Vehicle Addendum
    { wch: 40 }, // Submission ID
    { wch: 15 }, // IP Address
  ];
  
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Submissions');

  const today = new Date().toISOString().split('T')[0];
  const filename = `tenant_submissions_${today}.xlsx`;

  XLSX.writeFile(workbook, filename);
}
