export interface PetEntry {
  petType: string;
  petName: string;
  petBreed: string;
  petWeight: string;
  petColor: string;
  petSpayed: boolean | null;
  petVaccinationsCurrent: boolean | null;
  petVaccinationFile?: string | null;
  petPhotoFile?: string | null;
}

export const emptyPetEntry: PetEntry = {
  petType: '',
  petName: '',
  petBreed: '',
  petWeight: '',
  petColor: '',
  petSpayed: null,
  petVaccinationsCurrent: null,
  petVaccinationFile: null,
  petPhotoFile: null,
};

export interface FormData {
  fullName: string;
  phone: string;
  phoneIsNew: boolean;
  buildingAddress: string;
  unitNumber: string;
  hasPets: boolean | null;
  pets: PetEntry[];
  hasInsurance: boolean | null;
  insuranceProvider: string;
  insurancePolicyNumber: string;
  addInsuranceToRent: boolean;
  hasVehicle: boolean | null;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleColor: string;
  vehiclePlate: string;
  finalConfirm: boolean;
}

export interface SubmissionPet {
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

export interface Submission {
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
  pets: SubmissionPet[] | null;
  pet_signature: string | null;
  pet_signature_date: string | null;
  has_insurance: boolean;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  insurance_file: string | null;
  insurance_upload_pending: boolean;
  add_insurance_to_rent: boolean;
  has_vehicle: boolean;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vehicle_color: string | null;
  vehicle_plate: string | null;
  vehicle_signature: string | null;
  vehicle_signature_date: string | null;
  pet_addendum_file: string | null;
  vehicle_addendum_file: string | null;
  combined_pdf: string | null;
  ip_address: string;
  user_agent: string;
}
