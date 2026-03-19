'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '@/lib/adminAuthContext';
import { PARKING_FEES } from '@/lib/policyContent';
import {
  renderVehicleAddendum,
  renderPetAddendum,
  renderNoPetsAcknowledgment,
  renderInsuranceAuth,
  renderAdditionalInsuredInstructions,
  openPrintWindow,
} from '@/lib/formPrintRenderer';
import type { PrintLang } from '@/lib/insurancePrintTranslations';
import ConfirmDialog from '@/components/kit/ConfirmDialog';
import AlertDialog from '@/components/kit/AlertDialog';

interface TenantInfo {
  name: string;
  buildingAddress: string;
  unitNumber: string;
  phone?: string;
  email?: string;
}

interface Interaction {
  id: string;
  action_type: string;
  action_data: any;
  notes: string | null;
  performed_by: string;
  created_at: string;
}

interface InsurancePolicy {
  id: string;
  insurance_type: 'own_policy' | 'appfolio';
  provider: string | null;
  policy_number: string | null;
  liability_coverage: number | null;
  policy_expiration: string | null;
  additional_insured_added: boolean;
  proof_received: boolean;
  has_pets: boolean;
  is_current: boolean;
  created_at: string;
}

interface LobbyIntakePanelProps {
  tenant: TenantInfo;
  submissionData?: any | null;
  staffName?: string;
  onClose: () => void;
  onSubmissionUpdated?: (submissionData: any) => void;
}

type Tab = 'vehicle' | 'pet' | 'insurance' | 'history';

const VEHICLE_TYPES: { label: string; fee: number; key: string }[] = [
  { label: 'Moped, motorcycle, ATV, scooter', fee: PARKING_FEES.moped, key: 'moped' },
  { label: 'Sedan, SUV, Pickup (under 20 ft)', fee: PARKING_FEES.standard, key: 'standard' },
  { label: 'Oversized vehicle (over 20 ft)', fee: PARKING_FEES.oversized, key: 'oversized' },
  { label: 'Boat, trailer, equipment', fee: PARKING_FEES.boats, key: 'boat' },
];

const PET_FEES: { label: string; weight: string; monthly: number; deposit: number }[] = [
  { label: 'Cat', weight: 'N/A', monthly: 25, deposit: 150 },
  { label: 'Small Dog', weight: 'Under 25 lbs', monthly: 25, deposit: 200 },
  { label: 'Medium Dog', weight: '25-50 lbs', monthly: 35, deposit: 250 },
  { label: 'Large Dog', weight: '50+ lbs', monthly: 45, deposit: 300 },
];

const ACTION_LABELS: Record<string, string> = {
  vehicle_registration: 'Vehicle Registered',
  vehicle_update: 'Vehicle Updated',
  vehicle_removal: 'Vehicle Removed',
  pet_registration: 'Pet Registered',
  pet_update: 'Pet Updated',
  pet_removal: 'Pet Removed',
  esa_document_received: 'ESA / Service Animal Doc Received',
  no_pets_acknowledgment: 'No Pets Acknowledgment Printed',
  insurance_choice_own: 'Insurance: Getting Own',
  insurance_choice_appfolio: 'Insurance: Appfolio Enrollment',
  insurance_policy_recorded: 'Insurance Policy Recorded',
  insurance_proof_received: 'Insurance Proof Received',
  insurance_expiration_warning: 'Insurance Expiration Warning',
  gave_additional_insured_instructions: 'Gave Additional Insured Instructions',
  id_photo_upload: 'Tenant ID Photo Uploaded',
  printed_forms: 'Printed Forms',
  data_quality_flag: 'Data Quality Flag',
  general_note: 'Note',
};

const DATA_QUALITY_ISSUES: Array<{ value: string; label: string }> = [
  { value: 'missing_doc', label: 'Missing Required Document' },
  { value: 'field_mismatch', label: 'Field Mismatch' },
  { value: 'tenant_statement_conflict', label: 'Tenant Statement Conflict' },
  { value: 'requires_follow_up', label: 'Requires Follow-Up' },
];

const DATA_QUALITY_LABELS: Record<string, string> = Object.fromEntries(
  DATA_QUALITY_ISSUES.map((issue) => [issue.value, issue.label])
);

const EXEMPTION_REASONS = [
  { value: 'emotional_support', label: 'Emotional Support Animal (ESA)' },
  { value: 'service_animal', label: 'Service Animal (ADA)' },
  { value: 'medical_necessity', label: 'Medical Necessity' },
  { value: 'other', label: 'Other' },
];

export default function LobbyIntakePanel({ tenant, submissionData, staffName: staffNameProp, onClose, onSubmissionUpdated }: LobbyIntakePanelProps) {
  const { user } = useAdminAuth();
  const staffName = staffNameProp || user?.displayName || 'Admin';
  const [activeTab, setActiveTab] = useState<Tab>('vehicle');
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Dialog states
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  
  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'success' | 'error' | 'info';
  }>({ isOpen: false, title: '', message: '' });

  // Vehicle state
  const [registeredVehicles, setRegisteredVehicles] = useState<any[]>([]);
  const [editingVehicleIndex, setEditingVehicleIndex] = useState<number | null>(null);
  const [vehicleType, setVehicleType] = useState(1);
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');

  // Pet state
  const [registeredPets, setRegisteredPets] = useState<any[]>([]);
  const [editingPetIndex, setEditingPetIndex] = useState<number | null>(null);
  const [petType, setPetType] = useState('Dog');
  const [petBreed, setPetBreed] = useState('');
  const [petName, setPetName] = useState('');
  const [petWeight, setPetWeight] = useState('');
  const [petAge, setPetAge] = useState('');
  const [petSpayed, setPetSpayed] = useState('Yes');
  const [petVaccines, setPetVaccines] = useState('Yes');
  const [petFeeIndex, setPetFeeIndex] = useState(1);

  // Quick note state
  const [quickNote, setQuickNote] = useState('');
  const [qualityIssueType, setQualityIssueType] = useState('missing_doc');
  const [qualityIssueDetail, setQualityIssueDetail] = useState('');

  // Lobby notes for compliance
  const [lobbyNotes, setLobbyNotes] = useState(submissionData?.lobby_notes || '');
  const [savingLobbyNotes, setSavingLobbyNotes] = useState(false);
  const [lobbyNotesSaved, setLobbyNotesSaved] = useState(true);

  // ESA / Exemption state
  const [esaReason, setEsaReason] = useState('emotional_support');
  const [esaFile, setEsaFile] = useState<File | null>(null);
  const [uploadingEsa, setUploadingEsa] = useState(false);

  // Document upload state
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);

  // ID photo state
  const [idPhotoFile, setIdPhotoFile] = useState<File | null>(null);
  const [idPhotoPreview, setIdPhotoPreview] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState(false);

  // Insurance state
  const [insuranceChoice, setInsuranceChoice] = useState<'own_policy' | 'appfolio'>('own_policy');
  const [insProvider, setInsProvider] = useState('');
  const [insPolicyNumber, setInsPolicyNumber] = useState('');
  const [insCoverage, setInsCoverage] = useState('100000');
  const [insCoverageMode, setInsCoverageMode] = useState<'preset' | 'custom'>('preset');
  const [insCustomCoverage, setInsCustomCoverage] = useState('');
  const [insExpiration, setInsExpiration] = useState('');
  const [insAdditionalInsured, setInsAdditionalInsured] = useState(false);
  const [insProofReceived, setInsProofReceived] = useState(false);
  const [insHasPets, setInsHasPets] = useState(false);
  const [insAdditionalInsuredTouched, setInsAdditionalInsuredTouched] = useState(false);
  const [insProofReceivedTouched, setInsProofReceivedTouched] = useState(false);
  const [insHasPetsTouched, setInsHasPetsTouched] = useState(false);
  const [currentPolicy, setCurrentPolicy] = useState<InsurancePolicy | null>(null);
  const [loadingPolicy, setLoadingPolicy] = useState(true);
  const [printLang, setPrintLang] = useState<PrintLang>('en');

  const getNormalizedCoverageAmount = () => {
    const rawCoverage = insCoverageMode === 'custom' ? insCustomCoverage : insCoverage;
    const sanitized = rawCoverage.replace(/[^\d]/g, '');
    const numericCoverage = Number(sanitized);
    if (!Number.isFinite(numericCoverage) || numericCoverage <= 0) {
      return null;
    }
    return numericCoverage;
  };

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(
        `/api/admin/tenant-interactions?building=${encodeURIComponent(tenant.buildingAddress)}&unit=${encodeURIComponent(tenant.unitNumber)}`
      );
      const data = await res.json();
      if (data.success) setInteractions(data.interactions);
    } catch (e) {
      console.error('Failed to fetch interactions', e);
    } finally {
      setLoadingHistory(false);
    }
  }, [tenant.buildingAddress, tenant.unitNumber]);


  const fetchInsurancePolicy = useCallback(async () => {
    setLoadingPolicy(true);
    try {
      const res = await fetch(
        `/api/admin/tenant-insurance?building=${encodeURIComponent(tenant.buildingAddress)}&unit=${encodeURIComponent(tenant.unitNumber)}`
      );
      const data = await res.json();
      if (data.success && data.policy) {
        const p = data.policy;
        setCurrentPolicy(p);
        setInsuranceChoice(p.insurance_type);
        setInsProvider(p.provider || '');
        setInsPolicyNumber(p.policy_number || '');
        const loadedCoverage = p.liability_coverage ? String(p.liability_coverage) : '100000';
        if (loadedCoverage === '100000' || loadedCoverage === '300000' || loadedCoverage === '500000') {
          setInsCoverageMode('preset');
          setInsCoverage(loadedCoverage);
          setInsCustomCoverage('');
        } else {
          setInsCoverageMode('custom');
          setInsCustomCoverage(loadedCoverage);
          setInsCoverage('100000');
        }
        setInsExpiration(p.policy_expiration || '');
        setInsAdditionalInsured(p.additional_insured_added || false);
        setInsProofReceived(p.proof_received || false);
        setInsHasPets(p.has_pets || false);
        setInsAdditionalInsuredTouched(true);
        setInsProofReceivedTouched(true);
        setInsHasPetsTouched(true);
      }
    } catch (e) {
      console.error('Failed to fetch insurance', e);
    } finally {
      setLoadingPolicy(false);
    }
  }, [tenant.buildingAddress, tenant.unitNumber]);

  // Fetch fresh submission data on mount
  const fetchFreshSubmission = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/unified-tenants');
      const data = await res.json();
      if (data.success) {
        const match = data.data.find((t: any) => {
          if (t.building_address !== tenant.buildingAddress || t.unit_number !== tenant.unitNumber) {
            return false;
          }

          // Unit-only canonical model: prefer canonical submission holder for this unit.
          if (t.canonicalSelectionRequired) return false;
          return !!t.submissionData;
        });
        if (match?.submissionData) {
          const sub = match.submissionData;
          // Build registered vehicles list from flat fields + additional_vehicles
          const vehicles: any[] = [];
          if (sub.has_vehicle && sub.vehicle_make) {
            vehicles.push({
              vehicle_make: sub.vehicle_make,
              vehicle_model: sub.vehicle_model,
              vehicle_year: sub.vehicle_year,
              vehicle_color: sub.vehicle_color,
              vehicle_plate: sub.vehicle_plate,
              vehicle_type: sub.vehicle_type || 'standard',
            });
          }
          if (Array.isArray(sub.additional_vehicles)) {
            vehicles.push(...sub.additional_vehicles);
          }
          setRegisteredVehicles(vehicles);
          // Update registered pets list
          if (sub.pets?.length > 0) {
            setRegisteredPets(sub.pets);
          } else {
            setRegisteredPets([]);
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch fresh submission:', e);
    }
  }, [tenant.buildingAddress, tenant.unitNumber, tenant.name]);

  useEffect(() => {
    fetchFreshSubmission();
    fetchHistory();
    fetchInsurancePolicy();
  }, [fetchFreshSubmission, fetchHistory, fetchInsurancePolicy]);

  const saveInteraction = async (actionType: string, actionData: any, notes?: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/tenant-interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_name: tenant.name,
          building_address: tenant.buildingAddress,
          unit_number: tenant.unitNumber,
          action_type: actionType,
          action_data: actionData,
          notes,
          performed_by: staffName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchHistory();
        return true;
      } else {
        setAlertDialog({
          isOpen: true,
          title: 'Error',
          message: data.message || 'Failed to save',
          variant: 'error'
        });
      }
    } catch (e) {
      setAlertDialog({
        isOpen: true,
        title: 'Error',
        message: 'Failed to save interaction',
        variant: 'error'
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveQualityFlag = async () => {
    const issueLabel = DATA_QUALITY_LABELS[qualityIssueType] || qualityIssueType;
    const detail = qualityIssueDetail.trim();
    const note = detail ? `${issueLabel}: ${detail}` : issueLabel;

    const saved = await saveInteraction(
      'data_quality_flag',
      {
        issue_type: qualityIssueType,
        detail: detail || null,
      },
      note
    );

    if (saved) {
      setQualityIssueDetail('');
      setAlertDialog({
        isOpen: true,
        title: 'Flag Recorded',
        message: 'Data quality flag saved for follow-up.',
        variant: 'success',
      });
    }
  };

  const printData = {
    tenantName: tenant.name,
    buildingAddress: tenant.buildingAddress,
    unitNumber: tenant.unitNumber,
    phone: tenant.phone,
    email: tenant.email,
    staffName,
  };

  // -- Vehicle handlers --

  const clearVehicleForm = () => {
    setVehicleType(1);
    setVehicleMake('');
    setVehicleModel('');
    setVehicleYear('');
    setVehicleColor('');
    setVehiclePlate('');
    setEditingVehicleIndex(null);
  };

  const handleEditVehicle = (index: number) => {
    const v = registeredVehicles[index];
    const typeIdx = VEHICLE_TYPES.findIndex(vt => vt.key === (v.vehicle_type || 'standard'));
    setVehicleType(typeIdx >= 0 ? typeIdx : 1);
    setVehicleMake(v.vehicle_make || '');
    setVehicleModel(v.vehicle_model || '');
    setVehicleYear(v.vehicle_year ? String(v.vehicle_year) : '');
    setVehicleColor(v.vehicle_color || '');
    setVehiclePlate(v.vehicle_plate || '');
    setEditingVehicleIndex(index);
  };

  const handleRemoveVehicle = async (index: number) => {
    const v = registeredVehicles[index];
    setConfirmDialog({
      isOpen: true,
      title: 'Remove Vehicle',
      message: `Remove ${v.vehicle_year || ''} ${v.vehicle_make} ${v.vehicle_model} (${v.vehicle_plate})?`,
      variant: 'danger',
      onConfirm: () => executeRemoveVehicle(index),
    });
  };

  const executeRemoveVehicle = async (index: number) => {
    setConfirmDialog({ ...confirmDialog, isOpen: false });
    const v = registeredVehicles[index];

    setSaving(true);
    try {
      const res = await fetch('/api/admin/lobby-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_name: tenant.name,
          building_address: tenant.buildingAddress,
          unit_number: tenant.unitNumber,
          action_type: 'vehicle_removal',
          action_data: { vehicle_index: index },
          notes: `Removed vehicle: ${v.vehicle_make} ${v.vehicle_model} (${v.vehicle_plate})`,
          performed_by: staffName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchFreshSubmission();
        await fetchHistory();
        if (data.submissionData && onSubmissionUpdated) {
          onSubmissionUpdated(data.submissionData);
        }
        clearVehicleForm();
        setAlertDialog({ isOpen: true, title: 'Vehicle Removed', message: 'Vehicle removed successfully.', variant: 'success' });
      } else {
        setAlertDialog({ isOpen: true, title: 'Error', message: data.message || 'Failed to remove vehicle', variant: 'error' });
      }
    } catch (e) {
      setAlertDialog({ isOpen: true, title: 'Error', message: 'Failed to remove vehicle', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveVehicle = async () => {
    if (!vehicleMake || !vehicleModel || !vehiclePlate) {
      setAlertDialog({
        isOpen: true,
        title: 'Missing Information',
        message: 'Please fill in make, model, and license plate.',
        variant: 'error'
      });
      return;
    }
    const vt = VEHICLE_TYPES[vehicleType];
    const isEditing = editingVehicleIndex !== null;
    const actionData = {
      type: vt.label,
      make: vehicleMake,
      model: vehicleModel,
      year: vehicleYear,
      color: vehicleColor,
      plate: vehiclePlate.toUpperCase(),
      monthly_fee: vt.fee,
      vehicle_type: vt.key,
      vehicle_index: editingVehicleIndex,
    };
    setSaving(true);
    try {
      const res = await fetch('/api/admin/lobby-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_name: tenant.name,
          building_address: tenant.buildingAddress,
          unit_number: tenant.unitNumber,
          action_type: isEditing ? 'vehicle_update' : 'vehicle_registration',
          action_data: actionData,
          notes: `${isEditing ? 'Updated' : 'Added'} vehicle: ${vehicleMake} ${vehicleModel} ${vehicleYear} - ${vehiclePlate.toUpperCase()} - $${vt.fee}/mo`,
          performed_by: staffName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchFreshSubmission();
        await fetchHistory();
        if (data.submissionData && onSubmissionUpdated) {
          onSubmissionUpdated(data.submissionData);
        }
        clearVehicleForm();
        if (isEditing) {
          setAlertDialog({
            isOpen: true,
            title: 'Vehicle Updated',
            message: 'Vehicle updated successfully.\n\nREMINDER: Print new addendum for tenant to sign.',
            variant: 'success'
          });
        } else {
          setAlertDialog({
            isOpen: true,
            title: 'Vehicle Registered',
            message: 'Vehicle registered successfully.',
            variant: 'success'
          });
        }
      } else {
        setAlertDialog({
          isOpen: true,
          title: 'Error',
          message: data.message || 'Failed to save',
          variant: 'error'
        });
      }
    } catch (e) {
      setAlertDialog({
        isOpen: true,
        title: 'Error',
        message: 'Failed to save vehicle',
        variant: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePrintVehicle = () => {
    // Build full list of all registered vehicles
    const allVehicles = registeredVehicles.map(v => {
      const vtMatch = VEHICLE_TYPES.find(vt => vt.key === (v.vehicle_type || 'standard'));
      return {
        type: vtMatch?.label || 'Standard',
        make: v.vehicle_make || '',
        model: v.vehicle_model || '',
        year: v.vehicle_year ? String(v.vehicle_year) : '',
        color: v.vehicle_color || '',
        plate: v.vehicle_plate || '',
        monthlyFee: vtMatch?.fee ?? PARKING_FEES.standard,
      };
    });

    // If form has a vehicle being added (not yet saved), include it
    if (vehicleMake && vehiclePlate && editingVehicleIndex === null) {
      const vt = VEHICLE_TYPES[vehicleType];
      allVehicles.push({
        type: vt.label,
        make: vehicleMake,
        model: vehicleModel,
        year: vehicleYear,
        color: vehicleColor,
        plate: vehiclePlate.toUpperCase(),
        monthlyFee: vt.fee,
      });
    }

    // If editing an existing vehicle, replace it with form values
    if (editingVehicleIndex !== null && editingVehicleIndex < allVehicles.length) {
      const vt = VEHICLE_TYPES[vehicleType];
      allVehicles[editingVehicleIndex] = {
        type: vt.label,
        make: vehicleMake,
        model: vehicleModel,
        year: vehicleYear,
        color: vehicleColor,
        plate: vehiclePlate.toUpperCase(),
        monthlyFee: vt.fee,
      };
    }

    // Fallback: if no vehicles at all, use the current form fields
    if (allVehicles.length === 0) {
      const vt = VEHICLE_TYPES[vehicleType];
      allVehicles.push({
        type: vt.label,
        make: vehicleMake,
        model: vehicleModel,
        year: vehicleYear,
        color: vehicleColor,
        plate: vehiclePlate.toUpperCase(),
        monthlyFee: vt.fee,
      });
    }

    const html = renderVehicleAddendum(printData, allVehicles);
    openPrintWindow(html);
  };

  // -- Pet handlers --

  const clearPetForm = () => {
    setPetType('Dog');
    setPetBreed('');
    setPetName('');
    setPetWeight('');
    setPetAge('');
    setPetSpayed('Yes');
    setPetVaccines('Yes');
    setPetFeeIndex(1);
    setEditingPetIndex(null);
  };

  const handleEditPet = (index: number) => {
    const pet = registeredPets[index];
    setPetType(pet.pet_type || 'Dog');
    setPetBreed(pet.pet_breed || '');
    setPetName(pet.pet_name || '');
    setPetWeight(pet.pet_weight ? String(pet.pet_weight) : '');
    setPetSpayed(pet.pet_spayed || 'Yes');
    setPetVaccines(pet.pet_vaccinations_current || 'Yes');
    setEditingPetIndex(index);
  };

  const handleRemovePet = async (index: number) => {
    const pet = registeredPets[index];
    setConfirmDialog({
      isOpen: true,
      title: 'Remove Pet',
      message: `Remove ${pet.pet_name} (${pet.pet_breed})?`,
      variant: 'danger',
      onConfirm: () => executeRemovePet(index)
    });
  };

  const executeRemovePet = async (index: number) => {
    setConfirmDialog({ ...confirmDialog, isOpen: false });
    const pet = registeredPets[index];
    
    setSaving(true);
    try {
      const res = await fetch('/api/admin/lobby-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_name: tenant.name,
          building_address: tenant.buildingAddress,
          unit_number: tenant.unitNumber,
          action_type: 'pet_removal',
          action_data: { pet_index: index },
          notes: `Removed pet: ${pet.pet_name}`,
          performed_by: staffName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchFreshSubmission();
        await fetchHistory();
        if (data.submissionData && onSubmissionUpdated) {
          onSubmissionUpdated(data.submissionData);
        }
        setAlertDialog({
          isOpen: true,
          title: 'Pet Removed',
          message: 'Pet removed successfully.',
          variant: 'success'
        });
      } else {
        setAlertDialog({
          isOpen: true,
          title: 'Error',
          message: data.message || 'Failed to remove pet',
          variant: 'error'
        });
      }
    } catch (e) {
      setAlertDialog({
        isOpen: true,
        title: 'Error',
        message: 'Failed to remove pet',
        variant: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePet = async () => {
    if (!petName.trim() || !petWeight.trim()) {
      setAlertDialog({
        isOpen: true,
        title: 'Missing Information',
        message: 'Please fill in pet name and weight.',
        variant: 'error'
      });
      return;
    }
    const fee = PET_FEES[petFeeIndex];
    const actionData = {
      pets: [{
        type: petType,
        breed: petBreed,
        name: petName,
        weight: petWeight,
        age: petAge,
        spayed_neutered: petSpayed,
        vaccines: petVaccines,
      }],
      pet_index: editingPetIndex,
      monthly_fee: fee.monthly,
      deposit: fee.deposit,
    };
    setSaving(true);
    try {
      const res = await fetch('/api/admin/lobby-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_name: tenant.name,
          building_address: tenant.buildingAddress,
          unit_number: tenant.unitNumber,
          action_type: editingPetIndex !== null ? 'pet_update' : 'pet_registration',
          action_data: actionData,
          notes: `${editingPetIndex !== null ? 'Updated' : 'Added'} pet: ${petType} - ${petBreed} "${petName}" ${petWeight}lbs - $${fee.monthly}/mo + $${fee.deposit} deposit`,
          performed_by: staffName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchFreshSubmission();
        await fetchHistory();
        if (data.submissionData && onSubmissionUpdated) {
          onSubmissionUpdated(data.submissionData);
        }
        clearPetForm();
        if (editingPetIndex !== null) {
          setAlertDialog({
            isOpen: true,
            title: 'Pet Updated',
            message: 'Pet updated successfully.\n\nREMINDER: Print new addendum for tenant to sign.',
            variant: 'success'
          });
        } else {
          setAlertDialog({
            isOpen: true,
            title: 'Pet Added',
            message: 'Pet added successfully.\n\nREMINDER: Print new addendum for all pets for tenant to sign.',
            variant: 'success'
          });
        }
      } else {
        setAlertDialog({
          isOpen: true,
          title: 'Error',
          message: data.message || 'Failed to save',
          variant: 'error'
        });
      }
    } catch (e) {
      setAlertDialog({
        isOpen: true,
        title: 'Error',
        message: 'Failed to save pet',
        variant: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePrintPet = () => {
    // Build full list of all registered pets mapped to PetData format
    const allPets = registeredPets.map(pet => {
      const type = (pet.pet_type || '').toLowerCase();
      const weight = typeof pet.pet_weight === 'number' ? pet.pet_weight : parseFloat(String(pet.pet_weight)) || 0;
      let monthly = 25, deposit = 200;
      if (type === 'cat') { monthly = 25; deposit = 150; }
      else if (weight > 50) { monthly = 45; deposit = 300; }
      else if (weight >= 25) { monthly = 35; deposit = 250; }
      else { monthly = 25; deposit = 200; }
      return {
        type: pet.pet_type || 'Unknown',
        breed: pet.pet_breed || '',
        name: pet.pet_name || '',
        weight: pet.pet_weight ? String(pet.pet_weight) : '',
        age: '',
        spayedNeutered: pet.pet_spayed || 'Unknown',
        vaccinesUpToDate: pet.pet_vaccinations_current || 'Unknown',
        monthlyFee: monthly,
        deposit,
      };
    });

    // If form has a pet being added (not yet saved), include it too
    if (petName && petBreed && editingPetIndex === null) {
      const fee = PET_FEES[petFeeIndex];
      allPets.push({
        type: petType,
        breed: petBreed,
        name: petName,
        weight: petWeight,
        age: petAge,
        spayedNeutered: petSpayed,
        vaccinesUpToDate: petVaccines,
        monthlyFee: fee.monthly,
        deposit: fee.deposit,
      });
    }

    // If editing an existing pet, replace it with form values
    if (editingPetIndex !== null && editingPetIndex < allPets.length) {
      const fee = PET_FEES[petFeeIndex];
      allPets[editingPetIndex] = {
        type: petType,
        breed: petBreed,
        name: petName,
        weight: petWeight,
        age: petAge,
        spayedNeutered: petSpayed,
        vaccinesUpToDate: petVaccines,
        monthlyFee: fee.monthly,
        deposit: fee.deposit,
      };
    }

    // Fallback: if no pets at all, use the current form fields
    if (allPets.length === 0) {
      const fee = PET_FEES[petFeeIndex];
      allPets.push({
        type: petType,
        breed: petBreed,
        name: petName,
        weight: petWeight,
        age: petAge,
        spayedNeutered: petSpayed,
        vaccinesUpToDate: petVaccines,
        monthlyFee: fee.monthly,
        deposit: fee.deposit,
      });
    }

    const html = renderPetAddendum(printData, allPets);
    openPrintWindow(html);
  };

  // -- Insurance handlers --

  const handleSaveInsurance = async () => {
    const normalizedCoverage = getNormalizedCoverageAmount();

    if (insuranceChoice === 'own_policy' && !insAdditionalInsuredTouched) {
      setAlertDialog({
        isOpen: true,
        title: 'Confirmation Required',
        message: 'Please confirm whether Additional Insured (LLC) has been added before saving.',
        variant: 'error'
      });
      return;
    }

    if (insuranceChoice === 'own_policy' && !insProofReceivedTouched) {
      setAlertDialog({
        isOpen: true,
        title: 'Confirmation Required',
        message: 'Please confirm whether proof of insurance has been received before saving.',
        variant: 'error'
      });
      return;
    }

    if (!insHasPetsTouched) {
      setAlertDialog({
        isOpen: true,
        title: 'Confirmation Required',
        message: 'Please confirm whether the tenant has pets before saving.',
        variant: 'error'
      });
      return;
    }

    if (normalizedCoverage === null) {
      setAlertDialog({
        isOpen: true,
        title: 'Invalid Coverage Amount',
        message: 'Enter a valid liability coverage amount before saving.',
        variant: 'error'
      });
      return;
    }

    if (insHasPets && normalizedCoverage < 300000) {
      const note = `Coverage below compliance minimum for pet household: entered $${normalizedCoverage.toLocaleString()} (minimum $300,000)`;
      await saveInteraction(
        'data_quality_flag',
        {
          issue_type: 'requires_follow_up',
          detail: note,
          category: 'insurance_compliance',
        },
        note
      );

      setAlertDialog({
        isOpen: true,
        title: 'Coverage Too Low',
        message: 'Pet households require at least $300,000 liability coverage. Policy was not saved. You can still upload proof for follow-up.',
        variant: 'error'
      });
      return;
    }

    setSaving(true);
    try {
      // Save to tenant_insurance_policies table
      const res = await fetch('/api/admin/tenant-insurance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_name: tenant.name,
          building_address: tenant.buildingAddress,
          unit_number: tenant.unitNumber,
          insurance_type: insuranceChoice,
          provider: insuranceChoice === 'own_policy' ? insProvider : 'Appfolio',
          policy_number: insuranceChoice === 'own_policy' ? insPolicyNumber : null,
          liability_coverage: normalizedCoverage,
          policy_expiration: insuranceChoice === 'own_policy' && insExpiration ? insExpiration : null,
          additional_insured_added: insAdditionalInsured,
          proof_received: insProofReceived,
          has_pets: insHasPets,
          created_by: staffName,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setAlertDialog({
          isOpen: true,
          title: 'Error',
          message: data.message || 'Failed to save insurance',
          variant: 'error'
        });
        setSaving(false);
        return;
      }
      setCurrentPolicy(data.policy);

      // Also log as interaction
      const label = insuranceChoice === 'appfolio'
        ? 'Appfolio enrollment'
        : `${insProvider || 'Own policy'} - Policy #${insPolicyNumber || 'N/A'} - $${normalizedCoverage.toLocaleString()} coverage - Exp: ${insExpiration || 'N/A'}`;
      await saveInteraction(
        'insurance_policy_recorded',
        {
          insurance_type: insuranceChoice,
          provider: insProvider,
          policy_number: insPolicyNumber,
          coverage: normalizedCoverage,
          expiration: insExpiration,
          additional_insured: insAdditionalInsured,
          proof_received: insProofReceived,
          has_pets: insHasPets,
        },
        label
      );
      // Refresh submission so parent sees updated add_insurance_to_rent
      await fetchFreshSubmission();
      if (onSubmissionUpdated && submissionData) {
        // Re-fetch to get the updated submission with synced flag
        const freshRes = await fetch('/api/admin/unified-tenants');
        const freshData = await freshRes.json();
        if (freshData.success) {
          const match = freshData.data.find((t: any) =>
            t.building_address === tenant.buildingAddress &&
            t.unit_number === tenant.unitNumber &&
            !t.canonicalSelectionRequired &&
            !!t.submissionData
          );
          if (match?.submissionData) {
            onSubmissionUpdated(match.submissionData);
          }
        }
      }

      setAlertDialog({
        isOpen: true,
        title: 'Insurance Saved',
        message: 'Insurance policy saved.',
        variant: 'success'
      });
    } catch (e) {
      setAlertDialog({
        isOpen: true,
        title: 'Error',
        message: 'Failed to save insurance',
        variant: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePrintInsurance = () => {
    const choice = insuranceChoice === 'appfolio' ? 'appfolio' : 'own';
    const html = renderInsuranceAuth(printData, choice, printLang);
    openPrintWindow(html);
  };

  const handleGaveInstructions = async () => {
    const saved = await saveInteraction(
      'gave_additional_insured_instructions',
      { form_given: 'additional_insured_phone_instructions' },
      'Gave Additional Insured phone instructions'
    );
    if (saved) {
      const html = renderAdditionalInsuredInstructions(printData, printLang);
      openPrintWindow(html);
    }
  };

  // -- Quick note handler --

  const handleSaveNote = async () => {
    if (!quickNote.trim()) return;
    const saved = await saveInteraction('general_note', {}, quickNote.trim());
    if (saved) {
      setQuickNote('');
      setAlertDialog({ isOpen: true, title: 'Note Saved', message: 'Note recorded.', variant: 'success' });
    }
  };

  // -- Lobby notes for compliance handler --

  const handleSaveLobbyNotes = async () => {
    setSavingLobbyNotes(true);
    try {
      const res = await fetch('/api/admin/lobby-intake', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_name: tenant.name,
          building_address: tenant.buildingAddress,
          unit_number: tenant.unitNumber,
          lobby_notes: lobbyNotes.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLobbyNotesSaved(true);
        if (data.submissionData && onSubmissionUpdated) {
          onSubmissionUpdated(data.submissionData);
        }
        setAlertDialog({ isOpen: true, title: 'Notes Saved', message: 'Compliance notes saved.', variant: 'success' });
      } else {
        setAlertDialog({ isOpen: true, title: 'Error', message: data.message || 'Failed to save notes', variant: 'error' });
      }
    } catch (e) {
      setAlertDialog({ isOpen: true, title: 'Error', message: 'Failed to save compliance notes', variant: 'error' });
    } finally {
      setSavingLobbyNotes(false);
    }
  };

  // -- ESA / Exemption handler --

  const handleSaveEsa = async () => {
    setSaving(true);
    try {
      // 1. Log ESA interaction & set exemption_status on submission
      const res = await fetch('/api/admin/lobby-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_name: tenant.name,
          building_address: tenant.buildingAddress,
          unit_number: tenant.unitNumber,
          action_type: 'esa_document_received',
          action_data: { reason: esaReason },
          notes: `ESA/Service Animal doc received — ${EXEMPTION_REASONS.find(r => r.value === esaReason)?.label || esaReason}`,
          performed_by: staffName,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setAlertDialog({ isOpen: true, title: 'Error', message: data.message || 'Failed to save', variant: 'error' });
        setSaving(false);
        return;
      }

      // 2. If a file was selected and there's a submission ID, upload it
      if (esaFile && data.submissionData?.id) {
        setUploadingEsa(true);
        const formData = new FormData();
        formData.append('submissionId', data.submissionData.id);
        formData.append('documentType', 'exemption_document');
        formData.append('file', esaFile);

        const uploadRes = await fetch('/api/admin/compliance/attach-document', {
          method: 'POST',
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (uploadData.success && onSubmissionUpdated) {
          onSubmissionUpdated(uploadData.data);
        }
        setUploadingEsa(false);
      } else if (data.submissionData && onSubmissionUpdated) {
        onSubmissionUpdated(data.submissionData);
      }

      await fetchHistory();
      setEsaFile(null);
      setAlertDialog({
        isOpen: true,
        title: 'ESA Document Recorded',
        message: 'Exemption request logged. Status set to PENDING for admin review.',
        variant: 'success',
      });
    } catch (e) {
      setAlertDialog({ isOpen: true, title: 'Error', message: 'Failed to save ESA document', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // -- No Pets Acknowledgment --

  const handlePrintNoPets = async () => {
    const html = renderNoPetsAcknowledgment(printData);
    openPrintWindow(html);
    await saveInteraction('no_pets_acknowledgment', {}, 'Printed No Pets Acknowledgment form');
  };

  // -- Document upload handler (inside intake panel) --

  const handleUploadDoc = async (
    docType: 'pet_addendum' | 'insurance' | 'vehicle_addendum' | 'pet_vaccination_proof' | 'pet_spay_neuter_proof',
    file: File,
    options?: { petIndex?: number }
  ) => {
    const subId = submissionData?.id;
    if (!subId) {
      setAlertDialog({ isOpen: true, title: 'No Submission', message: 'This tenant has no submission record yet. Register a vehicle or pet first.', variant: 'error' });
      return;
    }
    setUploadingDocType(docType);
    try {
      const formData = new FormData();
      formData.append('submissionId', subId);
      formData.append('documentType', docType);
      formData.append('file', file);
      if (typeof options?.petIndex === 'number') {
        formData.append('petIndex', String(options.petIndex));
      }

      const res = await fetch('/api/admin/compliance/attach-document', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        if (onSubmissionUpdated) onSubmissionUpdated(data.data);
        const labels: Record<string, string> = {
          pet_addendum: 'Pet Addendum',
          insurance: 'Insurance Proof',
          vehicle_addendum: 'Vehicle Addendum',
          pet_vaccination_proof: 'Pet Vaccination Proof',
          pet_spay_neuter_proof: 'Pet Spayed/Neutered Proof',
        };
        setAlertDialog({ isOpen: true, title: 'Uploaded', message: `${labels[docType]} uploaded successfully.`, variant: 'success' });
      } else {
        setAlertDialog({ isOpen: true, title: 'Upload Failed', message: data.message || 'Upload failed', variant: 'error' });
      }
    } catch (e) {
      setAlertDialog({ isOpen: true, title: 'Upload Failed', message: 'Upload failed', variant: 'error' });
    } finally {
      setUploadingDocType(null);
    }
  };

  // -- ID photo upload handler --

  const handleUploadId = async () => {
    if (!idPhotoFile) return;
    setUploadingId(true);
    try {
      // Ensure a submission record exists
      let subId = submissionData?.id;
      if (!subId) {
        const res = await fetch('/api/admin/lobby-intake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_name: tenant.name,
            building_address: tenant.buildingAddress,
            unit_number: tenant.unitNumber,
            action_type: 'id_photo_upload',
            action_data: {},
            notes: 'Tenant ID photo uploaded',
            performed_by: staffName,
          }),
        });
        const data = await res.json();
        if (!data.success || !data.submissionData?.id) {
          setAlertDialog({ isOpen: true, title: 'Error', message: data.message || 'Failed to create submission for ID upload', variant: 'error' });
          setUploadingId(false);
          return;
        }
        subId = data.submissionData.id;
        if (onSubmissionUpdated) onSubmissionUpdated(data.submissionData);
      }

      // Upload the file
      const formData = new FormData();
      formData.append('submissionId', subId);
      formData.append('documentType', 'pickup_id_photo');
      formData.append('file', idPhotoFile);

      const uploadRes = await fetch('/api/admin/compliance/attach-document', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      if (uploadData.success) {
        if (onSubmissionUpdated) onSubmissionUpdated(uploadData.data);
        // Log interaction if we didn't already (submission already existed)
        if (submissionData?.id) {
          await saveInteraction('id_photo_upload', {}, 'Tenant ID photo uploaded');
        }
        setIdPhotoFile(null);
        setIdPhotoPreview(null);
        await fetchHistory();
        setAlertDialog({ isOpen: true, title: 'ID Uploaded', message: 'Tenant ID photo saved.', variant: 'success' });
      } else {
        setAlertDialog({ isOpen: true, title: 'Upload Failed', message: uploadData.message || 'Failed to upload ID photo', variant: 'error' });
      }
    } catch (e) {
      setAlertDialog({ isOpen: true, title: 'Upload Failed', message: 'Failed to upload ID photo', variant: 'error' });
    } finally {
      setUploadingId(false);
    }
  };

  // -- Helpers --

  const isExpiringSoon = (dateStr: string | null): boolean => {
    if (!dateStr) return false;
    const exp = new Date(dateStr);
    const now = new Date();
    const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 30 && diff >= 0;
  };

  const isExpired = (dateStr: string | null): boolean => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  const getPetDocUploadIndex = (): number | null => {
    if (editingPetIndex !== null && editingPetIndex >= 0) {
      return editingPetIndex;
    }
    if (registeredPets.length === 1) {
      return 0;
    }
    return null;
  };

  // -- Input styling --

  const inputClass = 'w-full border border-gray-300 rounded-none px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1a2744] focus:border-[#1a2744]';
  const selectClass = inputClass;
  const labelClass = 'block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1';
  const btnPrimary = 'px-4 py-2 bg-[#1a2744] text-white text-sm font-medium rounded-none hover:bg-[#2d3f5f] transition-colors duration-200 disabled:opacity-50';
  const btnSecondary = 'px-4 py-2 border border-[#1a2744] text-[#1a2744] text-sm font-medium rounded-none hover:bg-gray-50 transition-colors duration-200';
  const btnGold = 'px-4 py-2 bg-[#8b7355] text-white text-sm font-medium rounded-none hover:bg-[#a08560] transition-colors duration-200';

  const tabs: { key: Tab; label: string }[] = [
    { key: 'vehicle', label: 'Vehicle' },
    { key: 'pet', label: 'Pet' },
    { key: 'insurance', label: 'Insurance' },
    { key: 'history', label: `History (${interactions.length})` },
  ];

  const hasSubmission = !!submissionData;
  const dogCatPets = Array.isArray(submissionData?.pets)
    ? submissionData.pets.filter((pet: any) => {
        const petType = String(pet?.pet_type || '').toLowerCase();
        return petType === 'dog' || petType === 'cat';
      })
    : [];

  const dataQualityChecklist: Array<{ label: string; passed: boolean; detail: string }> = [
    {
      label: 'Canonical submission selected',
      passed: hasSubmission,
      detail: hasSubmission ? 'Submission record is available for this unit.' : 'No canonical submission selected yet.',
    },
    {
      label: 'Vehicle details complete (if applicable)',
      passed: !submissionData?.has_vehicle || !!(submissionData?.vehicle_make && submissionData?.vehicle_model && submissionData?.vehicle_plate),
      detail: !submissionData?.has_vehicle
        ? 'Not applicable (no vehicle declared).'
        : submissionData?.vehicle_make && submissionData?.vehicle_model && submissionData?.vehicle_plate
          ? 'Vehicle details are present.'
          : 'Missing make/model/plate fields.',
    },
    {
      label: 'Pet details complete for dogs/cats (if applicable)',
      passed: !submissionData?.has_pets || dogCatPets.every((pet: any) => pet.pet_name && pet.pet_weight),
      detail: !submissionData?.has_pets
        ? 'Not applicable (no pets declared).'
        : dogCatPets.every((pet: any) => pet.pet_name && pet.pet_weight)
          ? 'Dog/cat name and weight are complete.'
          : 'One or more dogs/cats are missing required name/weight.',
    },
    {
      label: 'Insurance record present for policy path',
      passed: !!submissionData?.add_insurance_to_rent || !!submissionData?.insurance_file,
      detail: submissionData?.add_insurance_to_rent
        ? 'Insurance is being added to rent (authorization path).'
        : submissionData?.insurance_file
          ? 'Insurance document is on file.'
          : 'No insurance file on record for own-policy path.',
    },
    {
      label: 'Insurance type classified (if file uploaded)',
      passed: !submissionData?.insurance_file || !!submissionData?.insurance_type,
      detail: !submissionData?.insurance_file
        ? 'Not applicable until insurance file is uploaded.'
        : submissionData?.insurance_type
          ? `Classified as ${submissionData.insurance_type}.`
          : 'Insurance file is uploaded but not classified.',
    },
    {
      label: 'ID photo on file before pickup',
      passed: !submissionData?.permit_issued || !!submissionData?.pickup_id_photo || !submissionData?.tenant_picked_up,
      detail: !submissionData?.permit_issued
        ? 'Not applicable until permit is issued.'
        : submissionData?.tenant_picked_up
          ? submissionData?.pickup_id_photo
            ? 'Pickup ID photo is on file.'
            : 'Permit marked picked up without ID photo.'
          : 'Permit not picked up yet.',
    },
  ];

  const dataQualityFlags = interactions.filter((ix) => ix.action_type === 'data_quality_flag');

  return (
    <div className="bg-white border border-gray-200 rounded-none shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-[#fdfcfa]">
        <div>
          <h2 className="text-base font-semibold text-[#1a2744]" style={{ fontFamily: 'Libre Baskerville, serif' }}>
            Lobby Intake
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">{tenant.name} &mdash; {tenant.buildingAddress}, Unit {tenant.unitNumber}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
      </div>

      {/* ID Photo Upload — always visible above tabs */}
      <div className="px-5 py-3 border-b border-gray-200 bg-[#fdfcfa]">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">Tenant ID Photo</label>
          {submissionData?.pickup_id_photo && !idPhotoFile && (
            <span className="text-xs text-green-700 font-medium">&#10003; On file</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          <label className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-none hover:bg-gray-700 transition-colors duration-200 ease-out cursor-pointer">
            {uploadingId ? 'Uploading...' : idPhotoFile ? `\u2713 ${idPhotoFile.name.slice(0, 25)}` : '\uD83D\uDCF7 Take / Upload ID Photo'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setIdPhotoFile(file);
                  setIdPhotoPreview(URL.createObjectURL(file));
                }
                e.target.value = '';
              }}
              disabled={uploadingId}
              className="hidden"
            />
          </label>
          {idPhotoFile && !uploadingId && (
            <>
              <button
                onClick={handleUploadId}
                className="px-3 py-1.5 text-sm bg-[#1a2744] text-white rounded-none hover:bg-[#2d3f5f] transition-colors duration-200"
              >
                Upload
              </button>
              <button
                onClick={() => { setIdPhotoFile(null); setIdPhotoPreview(null); }}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Remove
              </button>
            </>
          )}
        </div>
        {idPhotoPreview && (
          <img src={idPhotoPreview} alt="ID Preview" className="mt-2 max-h-24 border border-gray-200" />
        )}
      </div>

      {/* Notes for Compliance — always visible above tabs */}
      <div className="px-5 py-3 border-b border-gray-200 bg-[#fdfcfa]">
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide">Notes for Compliance</label>
          {!lobbyNotesSaved && (
            <span className="text-xs text-amber-600 font-medium">Unsaved</span>
          )}
        </div>
        <textarea
          value={lobbyNotes}
          onChange={(e) => { setLobbyNotes(e.target.value); setLobbyNotesSaved(false); }}
          placeholder="Leave notes for compliance staff to review..."
          rows={2}
          className="w-full border border-gray-300 rounded-none px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1a2744] focus:border-[#1a2744] resize-none"
        />
        <div className="flex items-center gap-2 mt-1.5">
          <button
            onClick={handleSaveLobbyNotes}
            disabled={savingLobbyNotes || lobbyNotesSaved}
            className="px-3 py-1.5 bg-[#1a2744] text-white text-xs font-medium rounded-none hover:bg-[#2d3f5f] transition-colors duration-200 disabled:opacity-50"
          >
            {savingLobbyNotes ? 'Saving...' : 'Save Notes'}
          </button>
          {lobbyNotes.trim() && (
            <button
              onClick={() => { setLobbyNotes(''); setLobbyNotesSaved(false); }}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors duration-200 ${
              activeTab === tab.key
                ? 'text-[#1a2744] border-b-2 border-[#1a2744] bg-white'
                : 'text-gray-500 hover:text-gray-700 bg-[#fdfcfa]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-5">
        {/* -- VEHICLE TAB -- */}
        {activeTab === 'vehicle' && (
          <div className="space-y-4">
            {/* Registered Vehicles List */}
            {registeredVehicles.length > 0 && (
              <div className="bg-[#f8f7f5] p-4 rounded" style={{ borderLeftWidth: '3px', borderLeftColor: '#8b7355' }}>
                <h3 className="font-serif text-base mb-3">Registered Vehicles</h3>
                <div className="space-y-2">
                  {registeredVehicles.map((v, index) => {
                    const vtMatch = VEHICLE_TYPES.find(vt => vt.key === (v.vehicle_type || 'standard'));
                    const fee = vtMatch?.fee ?? PARKING_FEES.standard;
                    return (
                      <div key={index} className="flex items-center justify-between bg-white p-2 rounded text-sm">
                        <div>
                          <strong>{v.vehicle_year} {v.vehicle_make} {v.vehicle_model}</strong> — {v.vehicle_color} · {v.vehicle_plate}
                          <span className="text-[var(--muted)] ml-2">(${fee}/mo)</span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleEditVehicle(index)} className="text-xs px-3 py-1 bg-[#8b7355] text-white rounded hover:bg-[#6d5a43] transition-colors">
                            Edit
                          </button>
                          <button onClick={() => handleRemoveVehicle(index)} className="text-xs px-3 py-1 border border-[#8b7355] text-[#8b7355] rounded hover:bg-[#f8f7f5] transition-colors">
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add/Edit Vehicle Form */}
            <h3 className="font-serif text-base">{editingVehicleIndex !== null ? 'Edit Vehicle' : 'Add New Vehicle'}</h3>
            <div>
              <label className={labelClass}>Vehicle Type</label>
              <select value={vehicleType} onChange={e => setVehicleType(Number(e.target.value))} className={selectClass}>
                {VEHICLE_TYPES.map((vt, i) => (
                  <option key={i} value={i}>{vt.label} -- ${vt.fee}/mo</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Make</label>
                <input value={vehicleMake} onChange={e => setVehicleMake(e.target.value)} className={inputClass} placeholder="Honda" />
              </div>
              <div>
                <label className={labelClass}>Model</label>
                <input value={vehicleModel} onChange={e => setVehicleModel(e.target.value)} className={inputClass} placeholder="Civic" />
              </div>
              <div>
                <label className={labelClass}>Year</label>
                <input value={vehicleYear} onChange={e => setVehicleYear(e.target.value)} className={inputClass} placeholder="2019" />
              </div>
              <div>
                <label className={labelClass}>Color</label>
                <input value={vehicleColor} onChange={e => setVehicleColor(e.target.value)} className={inputClass} placeholder="Blue" />
              </div>
            </div>
            <div>
              <label className={labelClass}>License Plate</label>
              <input value={vehiclePlate} onChange={e => setVehiclePlate(e.target.value)} className={inputClass} placeholder="ABC1234" />
            </div>
            <div className="bg-[#f8f7f5] p-3 text-sm" style={{ borderLeftWidth: '3px', borderLeftColor: '#8b7355' }}>
              <strong>Monthly Fee:</strong> ${VEHICLE_TYPES[vehicleType].fee}/month
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <button onClick={handleSaveVehicle} disabled={saving} className={btnPrimary}>
                {saving ? 'Saving...' : (editingVehicleIndex !== null ? 'Update Vehicle' : 'Save Vehicle')}
              </button>
              {editingVehicleIndex !== null && (
                <button onClick={clearVehicleForm} className={btnSecondary}>
                  Cancel
                </button>
              )}
              <button onClick={handlePrintVehicle} className={btnSecondary}>
                Print Addendum
              </button>
              <label className={`${btnSecondary} cursor-pointer`}>
                {uploadingDocType === 'vehicle_addendum' ? 'Uploading...' : 'Upload Signed Addendum'}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadDoc('vehicle_addendum', file);
                    e.target.value = '';
                  }}
                  disabled={uploadingDocType === 'vehicle_addendum'}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {/* -- PET TAB -- */}
        {activeTab === 'pet' && (
          <div className="space-y-4">
            {/* Registered Pets List */}
            {registeredPets.length > 0 && (
              <div className="bg-[#f8f7f5] p-4 rounded" style={{ borderLeftWidth: '3px', borderLeftColor: '#8b7355' }}>
                <h3 className="font-serif text-base mb-3">Registered Pets</h3>
                <div className="space-y-2">
                  {registeredPets.map((pet, index) => (
                    <div key={index} className="flex items-center justify-between bg-white p-2 rounded text-sm">
                      <div>
                        <strong>{pet.pet_name}</strong> ({pet.pet_type}{pet.pet_breed ? `, ${pet.pet_breed}` : ''}, {pet.pet_weight}lbs)
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleEditPet(index)} className="text-xs px-3 py-1 bg-[#8b7355] text-white rounded hover:bg-[#6d5a43] transition-colors">
                          Edit
                        </button>
                        <button onClick={() => handleRemovePet(index)} className="text-xs px-3 py-1 border border-[#8b7355] text-[#8b7355] rounded hover:bg-[#f8f7f5] transition-colors">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Add/Edit Pet Form */}
            <h3 className="font-serif text-base">{editingPetIndex !== null ? 'Edit Pet' : 'Add New Pet'}</h3>
            <div>
              <label className={labelClass}>Pet Fee Category</label>
              <select value={petFeeIndex} onChange={e => setPetFeeIndex(Number(e.target.value))} className={selectClass}>
                {PET_FEES.map((f, i) => (
                  <option key={i} value={i}>{f.label} ({f.weight}) -- ${f.monthly}/mo + ${f.deposit} deposit</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Type of Animal</label>
                <select value={petType} onChange={e => setPetType(e.target.value)} className={selectClass}>
                  <option>Dog</option>
                  <option>Cat</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Breed</label>
                <input value={petBreed} onChange={e => setPetBreed(e.target.value)} className={inputClass} placeholder="Labrador" />
              </div>
              <div>
                <label className={labelClass}>Pet Name</label>
                <input value={petName} onChange={e => setPetName(e.target.value)} className={inputClass} placeholder="Max" />
              </div>
              <div>
                <label className={labelClass}>Weight (lbs)</label>
                <input value={petWeight} onChange={e => setPetWeight(e.target.value)} className={inputClass} placeholder="35" />
              </div>
              <div>
                <label className={labelClass}>Age</label>
                <input value={petAge} onChange={e => setPetAge(e.target.value)} className={inputClass} placeholder="3 years" />
              </div>
              <div>
                <label className={labelClass}>Spayed / Neutered?</label>
                <select value={petSpayed} onChange={e => setPetSpayed(e.target.value)} className={selectClass}>
                  <option>Yes</option>
                  <option>No</option>
                  <option>Unknown</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Vaccines Up to Date?</label>
                <select value={petVaccines} onChange={e => setPetVaccines(e.target.value)} className={selectClass}>
                  <option>Yes</option>
                  <option>No</option>
                  <option>Unknown</option>
                </select>
              </div>
            </div>
            <div className="bg-[#f8f7f5] p-3 text-sm" style={{ borderLeftWidth: '3px', borderLeftColor: '#8b7355' }}>
              <p><strong>Monthly Pet Rent:</strong> ${PET_FEES[petFeeIndex].monthly}/month</p>
              <p><strong>Pet Deposit:</strong> ${PET_FEES[petFeeIndex].deposit}</p>
              <p className="mt-2 text-xs text-red-700"><strong>Reminder:</strong> Pet owners need $300,000 liability insurance (not $100,000). Check Insurance tab.</p>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <button onClick={handleSavePet} disabled={saving} className={btnPrimary}>
                {saving ? 'Saving...' : (editingPetIndex !== null ? 'Update Pet' : 'Save Pet')}
              </button>
              {editingPetIndex !== null && (
                <button onClick={clearPetForm} className={btnSecondary}>
                  Cancel
                </button>
              )}
              <button onClick={handlePrintPet} className={btnSecondary}>
                Print Addendum
              </button>
              <label className={`${btnSecondary} cursor-pointer`}>
                {uploadingDocType === 'pet_addendum' ? 'Uploading...' : 'Upload Signed Addendum'}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadDoc('pet_addendum', file);
                    e.target.value = '';
                  }}
                  disabled={uploadingDocType === 'pet_addendum'}
                  className="hidden"
                />
              </label>
              <label className={`${btnSecondary} cursor-pointer`}>
                {uploadingDocType === 'pet_vaccination_proof' ? 'Uploading...' : 'Upload Vaccination Proof'}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const petIndex = getPetDocUploadIndex();
                      if (petIndex === null) {
                        setAlertDialog({
                          isOpen: true,
                          title: 'Select Pet',
                          message: 'Click Edit on a pet first to upload vaccination proof for that specific pet.',
                          variant: 'error',
                        });
                        e.target.value = '';
                        return;
                      }
                      handleUploadDoc('pet_vaccination_proof', file, { petIndex });
                    }
                    e.target.value = '';
                  }}
                  disabled={uploadingDocType === 'pet_vaccination_proof'}
                  className="hidden"
                />
              </label>
              <label className={`${btnSecondary} cursor-pointer`}>
                {uploadingDocType === 'pet_spay_neuter_proof' ? 'Uploading...' : 'Upload Spayed/Neutered Proof'}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const petIndex = getPetDocUploadIndex();
                      if (petIndex === null) {
                        setAlertDialog({
                          isOpen: true,
                          title: 'Select Pet',
                          message: 'Click Edit on a pet first to upload spayed/neutered proof for that specific pet.',
                          variant: 'error',
                        });
                        e.target.value = '';
                        return;
                      }
                      handleUploadDoc('pet_spay_neuter_proof', file, { petIndex });
                    }
                    e.target.value = '';
                  }}
                  disabled={uploadingDocType === 'pet_spay_neuter_proof'}
                  className="hidden"
                />
              </label>
            </div>

            {/* No Pets Section */}
            {registeredPets.length === 0 && !editingPetIndex && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="font-serif text-base mb-2">No Pets?</h3>
                <p className="text-xs text-gray-600 mb-3">If this tenant has no pets, print the No Pets Acknowledgment form for them to sign.</p>
                <button onClick={handlePrintNoPets} disabled={saving} className={btnGold}>
                  {saving ? 'Saving...' : 'Print No Pets Acknowledgment'}
                </button>
              </div>
            )}

            {/* ESA / Service Animal Section */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h3 className="font-serif text-base mb-2">ESA / Service Animal Documentation</h3>
              <p className="text-xs text-gray-600 mb-3">
                If the tenant has an Emotional Support Animal letter, Service Animal documentation, or other fee exemption paperwork, record it here. This flags the tenant for admin review.
              </p>
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Exemption Reason</label>
                  <select value={esaReason} onChange={e => setEsaReason(e.target.value)} className={selectClass}>
                    {EXEMPTION_REASONS.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Upload Document (optional)</label>
                  <div className="flex items-center gap-3">
                    <label className={`${btnSecondary} cursor-pointer text-xs`}>
                      {esaFile ? `Selected: ${esaFile.name.slice(0, 30)}` : 'Choose File'}
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setEsaFile(file);
                        }}
                        className="hidden"
                      />
                    </label>
                    {esaFile && (
                      <button onClick={() => setEsaFile(null)} className="text-xs text-gray-500 hover:text-gray-700 underline">
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <button onClick={handleSaveEsa} disabled={saving || uploadingEsa} className={btnPrimary}>
                  {saving || uploadingEsa ? 'Saving...' : 'Record ESA / Exemption Document'}
                </button>
              </div>
              {submissionData?.exemption_status && (
                <div className={`mt-3 p-2 text-xs font-medium ${
                  submissionData.exemption_status === 'approved' ? 'bg-green-50 text-green-800 border border-green-200' :
                  submissionData.exemption_status === 'denied' ? 'bg-red-50 text-red-800 border border-red-200' :
                  'bg-yellow-50 text-yellow-800 border border-yellow-200'
                }`}>
                  Current exemption status: {submissionData.exemption_status.toUpperCase()}
                  {submissionData.exemption_reason && ` — ${submissionData.exemption_reason}`}
                </div>
              )}
            </div>
          </div>
        )}

        {/* -- INSURANCE TAB -- */}
        {activeTab === 'insurance' && (
          <div className="space-y-4">
            {/* Current policy status */}
            {loadingPolicy ? (
              <p className="text-xs text-gray-500">Loading insurance status...</p>
            ) : currentPolicy ? (
              <div className={`p-3 text-sm border-l-[3px] ${
                isExpired(currentPolicy.policy_expiration)
                  ? 'bg-red-50 border-red-600'
                  : isExpiringSoon(currentPolicy.policy_expiration)
                    ? 'bg-yellow-50 border-yellow-600'
                    : 'bg-green-50 border-green-700'
              }`}>
                <div className="flex items-center justify-between">
                  <strong className="text-xs uppercase tracking-wide">Current Policy on File</strong>
                  {isExpired(currentPolicy.policy_expiration) && (
                    <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5">EXPIRED</span>
                  )}
                  {isExpiringSoon(currentPolicy.policy_expiration) && !isExpired(currentPolicy.policy_expiration) && (
                    <span className="text-xs font-semibold text-yellow-700 bg-yellow-100 px-2 py-0.5">EXPIRING SOON</span>
                  )}
                </div>
                <p className="mt-1">{currentPolicy.insurance_type === 'appfolio' ? 'Appfolio Enrollment' : `${currentPolicy.provider || 'Unknown'} - #${currentPolicy.policy_number || 'N/A'}`}</p>
                <p>Coverage: ${Number(currentPolicy.liability_coverage || 0).toLocaleString()}{currentPolicy.has_pets && Number(currentPolicy.liability_coverage || 0) < 300000 ? ' [!] NEEDS $300k (HAS PETS)' : ''}</p>
                {currentPolicy.policy_expiration && <p>Expires: {new Date(currentPolicy.policy_expiration).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
                <p>Additional Insured: {currentPolicy.additional_insured_added ? 'YES' : 'NO'} | Proof: {currentPolicy.proof_received ? 'Received' : 'Not received'}</p>
              </div>
            ) : (
              <div className="p-3 text-sm bg-red-50 border-l-[3px] border-red-600">
                <strong className="text-red-800">No insurance policy on file.</strong>
              </div>
            )}

            <hr className="border-gray-200" />

            {/* Insurance type choice */}
            <h3 className="text-sm font-semibold text-[#1a2744]">{currentPolicy ? 'Update Insurance' : 'Record Insurance'}</h3>
            <div className="space-y-3">
              <label className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${insuranceChoice === 'own_policy' ? 'border-[#1a2744] bg-blue-50/30' : 'border-gray-200'}`}>
                <input
                  type="radio"
                  name="insurance"
                  checked={insuranceChoice === 'own_policy'}
                  onChange={() => setInsuranceChoice('own_policy')}
                  className="mt-1"
                />
                <div>
                  <div className="text-sm font-semibold">Option A -- Tenant Has Own Insurance</div>
                  <div className="text-xs text-gray-600 mt-1">Record their policy details below.</div>
                </div>
              </label>
              <label className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${insuranceChoice === 'appfolio' ? 'border-[#1a2744] bg-blue-50/30' : 'border-gray-200'}`}>
                <input
                  type="radio"
                  name="insurance"
                  checked={insuranceChoice === 'appfolio'}
                  onChange={() => setInsuranceChoice('appfolio')}
                  className="mt-1"
                />
                <div>
                  <div className="text-sm font-semibold">Option B -- Enroll Through Stanton (Appfolio)</div>
                  <div className="text-xs text-gray-600 mt-1">$10-25/month added to rent. Appfolio manages the policy.</div>
                </div>
              </label>
            </div>

            {insuranceChoice === 'appfolio' && (
              <div className="bg-amber-50 p-3 text-xs text-amber-800 font-medium" style={{ borderLeftWidth: '3px', borderLeftColor: '#d97706' }}>
                ⚠️ Tenant must sign an authorization form before enrollment. If they submitted online and signed digitally, the signature is already on file. Otherwise, print the authorization form below for a physical signature.
              </div>
            )}

            {/* Own policy fields */}
            {insuranceChoice === 'own_policy' && (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Insurance Provider</label>
                    <input value={insProvider} onChange={e => setInsProvider(e.target.value)} className={inputClass} placeholder="State Farm, Lemonade, etc." />
                  </div>
                  <div>
                    <label className={labelClass}>Policy Number</label>
                    <input value={insPolicyNumber} onChange={e => setInsPolicyNumber(e.target.value)} className={inputClass} placeholder="POL-123456" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Liability Coverage</label>
                    <select
                      value={insCoverageMode === 'custom' ? 'custom' : insCoverage}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          setInsCoverageMode('custom');
                          return;
                        }
                        setInsCoverageMode('preset');
                        setInsCoverage(e.target.value);
                      }}
                      className={selectClass}
                    >
                      <option value="100000">$100,000</option>
                      <option value="300000">$300,000 (required with pets)</option>
                      <option value="500000">$500,000</option>
                      <option value="custom">Custom amount...</option>
                    </select>
                    {insCoverageMode === 'custom' && (
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={insCustomCoverage}
                        onChange={(e) => setInsCustomCoverage(e.target.value)}
                        className={`${inputClass} mt-2`}
                        placeholder="Enter policy amount"
                      />
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Policy Expiration Date</label>
                    <input type="date" value={insExpiration} onChange={e => setInsExpiration(e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={insAdditionalInsured}
                      onChange={e => {
                        setInsAdditionalInsured(e.target.checked);
                        setInsAdditionalInsuredTouched(true);
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Additional Insured (LLC) added</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={insProofReceived}
                      onChange={e => {
                        setInsProofReceived(e.target.checked);
                        setInsProofReceivedTouched(true);
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Proof of insurance received</span>
                  </label>
                </div>
              </div>
            )}

            {/* Has pets flag */}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={insHasPets}
                onChange={e => {
                  setInsHasPets(e.target.checked);
                  setInsHasPetsTouched(true);
                }}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">Tenant has pets (requires $300,000 coverage)</span>
            </label>
            {insHasPets && (getNormalizedCoverageAmount() || 0) < 300000 && (
              <div className="text-xs text-red-700 font-semibold bg-red-50 p-2">
                [!] Coverage is below $300,000 -- pet owners must have at least $300,000 liability.
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 mb-2">
              <span className="text-xs font-medium text-[var(--primary)]">Print Language:</span>
              {(['en', 'es', 'pt'] as PrintLang[]).map(l => (
                <button
                  key={l}
                  onClick={() => setPrintLang(l)}
                  className={`px-2 py-0.5 text-xs font-medium border rounded-none transition-colors duration-200 ease-out ${
                    printLang === l
                      ? 'bg-[#1a2744] text-white border-[#1a2744]'
                      : 'bg-white text-[#1a2744] border-[var(--border)] hover:bg-gray-50'
                  }`}
                >
                  {l === 'en' ? 'English' : l === 'es' ? 'Español' : 'Português'}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button onClick={handleSaveInsurance} disabled={saving} className={btnPrimary}>
                {saving ? 'Saving...' : 'Save Insurance Policy'}
              </button>
              <button onClick={handlePrintInsurance} className={btnSecondary}>
                Print Authorization
              </button>
              {insuranceChoice === 'own_policy' && (
                <label className={`${btnSecondary} cursor-pointer`}>
                  {uploadingDocType === 'insurance' ? 'Uploading...' : 'Upload Proof of Insurance'}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadDoc('insurance', file);
                      e.target.value = '';
                    }}
                    disabled={uploadingDocType === 'insurance'}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <hr className="my-4 border-gray-200" />

            <h3 className="text-sm font-semibold text-[#1a2744]">Additional Insured Instructions</h3>
            <p className="text-xs text-gray-600">
              If tenant chose Option A, give them instructions on how to call their insurance company and add the LLC.
              This will print the full renters insurance info + phone instructions in the selected language.
            </p>
            <button onClick={handleGaveInstructions} disabled={saving} className={btnGold}>
              {saving ? 'Saving...' : 'Print Additional Insured Instructions'}
            </button>
          </div>
        )}

        {/* -- HISTORY TAB -- */}
        {activeTab === 'history' && (
          <div>
            {/* Structured quality checklist and flags */}
            <div className="mb-4 pb-4 border-b border-gray-200">
              <h3 className="font-serif text-base mb-2">Data Quality Checklist</h3>
              <div className="space-y-2">
                {dataQualityChecklist.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs">
                    <span className={item.passed ? 'text-green-700' : 'text-red-700'}>
                      {item.passed ? '✓' : '✕'}
                    </span>
                    <div>
                      <div className={item.passed ? 'text-green-800 font-medium' : 'text-red-800 font-medium'}>{item.label}</div>
                      <div className="text-gray-500">{item.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-4 pb-4 border-b border-gray-200">
              <h3 className="font-serif text-base mb-2">Flag Data Quality Issue</h3>
              <div className="space-y-2">
                <div>
                  <label className={labelClass}>Issue Type</label>
                  <select
                    value={qualityIssueType}
                    onChange={(e) => setQualityIssueType(e.target.value)}
                    className={selectClass}
                  >
                    {DATA_QUALITY_ISSUES.map((issue) => (
                      <option key={issue.value} value={issue.value}>{issue.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Details (optional)</label>
                  <textarea
                    value={qualityIssueDetail}
                    onChange={(e) => setQualityIssueDetail(e.target.value)}
                    className={`${inputClass} resize-none`}
                    rows={2}
                    placeholder="Example: Plate on document does not match plate on vehicle"
                  />
                </div>
                <button
                  onClick={handleSaveQualityFlag}
                  disabled={saving}
                  className={btnGold}
                >
                  {saving ? 'Saving...' : 'Save Data Quality Flag'}
                </button>
              </div>
            </div>

            {dataQualityFlags.length > 0 && (
              <div className="mb-4 pb-4 border-b border-gray-200">
                <h3 className="font-serif text-base mb-2">Active Data Quality Flags ({dataQualityFlags.length})</h3>
                <div className="space-y-2">
                  {dataQualityFlags.map((flag) => {
                    const issueType = flag.action_data?.issue_type;
                    const detail = flag.action_data?.detail;
                    return (
                      <div key={flag.id} className="bg-amber-50 border border-amber-200 px-3 py-2 text-xs">
                        <div className="font-medium text-amber-900">
                          {DATA_QUALITY_LABELS[issueType] || 'Data Quality Flag'}
                        </div>
                        {detail && <div className="text-amber-800 mt-0.5">{detail}</div>}
                        <div className="text-amber-700 mt-1">
                          {new Date(flag.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {' '}at{' '}
                          {new Date(flag.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                          {' '}&mdash;{' '}{flag.performed_by}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Note */}
            <div className="mb-4 pb-4 border-b border-gray-200">
              <label className={labelClass}>Add a Note</label>
              <textarea
                value={quickNote}
                onChange={e => setQuickNote(e.target.value)}
                className={`${inputClass} resize-none`}
                rows={2}
                placeholder="e.g. Tenant said they'll bring insurance tomorrow..."
              />
              <button
                onClick={handleSaveNote}
                disabled={saving || !quickNote.trim()}
                className={`${btnPrimary} mt-2`}
              >
                {saving ? 'Saving...' : 'Save Note'}
              </button>
            </div>

            {loadingHistory ? (
              <p className="text-sm text-gray-500">Loading history...</p>
            ) : interactions.length === 0 ? (
              <p className="text-sm text-gray-500">No interactions recorded for this tenant yet.</p>
            ) : (
              <div className="space-y-2">
                {interactions.map(ix => (
                  <div key={ix.id} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                    <div className="w-2 h-2 rounded-full bg-[#8b7355] mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#1a2744]">
                        {ACTION_LABELS[ix.action_type] || ix.action_type}
                        {ix.action_type === 'data_quality_flag' && ix.action_data?.issue_type && (
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-700">
                            {DATA_QUALITY_LABELS[ix.action_data.issue_type] || ix.action_data.issue_type}
                          </span>
                        )}
                      </div>
                      {ix.notes && (
                        <div className="text-xs text-gray-600 mt-0.5">{ix.notes}</div>
                      )}
                      <div className="text-xs text-gray-400 mt-0.5">
                        {new Date(ix.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {' '}at{' '}
                        {new Date(ix.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        {' '}&mdash;{' '}{ix.performed_by}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        setConfirmDialog({
                          isOpen: true,
                          title: 'Remove Entry',
                          message: 'Remove this entry?',
                          variant: 'danger',
                          onConfirm: async () => {
                            setConfirmDialog({ ...confirmDialog, isOpen: false });
                            setDeletingId(ix.id);
                            try {
                              const res = await fetch('/api/admin/tenant-interactions', {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: ix.id }),
                              });
                              const data = await res.json();
                              if (data.success) {
                                setInteractions(prev => prev.filter(i => i.id !== ix.id));
                              } else {
                                setAlertDialog({
                                  isOpen: true,
                                  title: 'Error',
                                  message: data.message || 'Failed to delete interaction',
                                  variant: 'error'
                                });
                              }
                            } catch (e) {
                              setAlertDialog({
                                isOpen: true,
                                title: 'Error',
                                message: 'Failed to delete interaction',
                                variant: 'error'
                              });
                            } finally {
                              setDeletingId(null);
                            }
                          }
                        });
                      }}
                      disabled={deletingId === ix.id}
                      className="flex-shrink-0 text-gray-300 hover:text-red-500 transition-colors duration-200 p-1"
                      title="Remove entry"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        variant={confirmDialog.variant}
      />
      <AlertDialog
        isOpen={alertDialog.isOpen}
        title={alertDialog.title}
        message={alertDialog.message}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        variant={alertDialog.variant}
      />
    </div>
  );
}
