'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '@/lib/adminAuthContext';
import { PARKING_FEES } from '@/lib/policyContent';
import {
  renderVehicleAddendum,
  renderPetAddendum,
  renderInsuranceAuth,
  renderAdditionalInsuredInstructions,
  openPrintWindow,
} from '@/lib/formPrintRenderer';
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

const VEHICLE_TYPES: { label: string; fee: number }[] = [
  { label: 'Moped, motorcycle, ATV, scooter', fee: PARKING_FEES.moped },
  { label: 'Sedan, SUV, Pickup (under 20 ft)', fee: PARKING_FEES.standard },
  { label: 'Oversized vehicle (over 20 ft)', fee: PARKING_FEES.oversized },
  { label: 'Boat, trailer, equipment', fee: PARKING_FEES.boats },
];

const PET_FEES: { label: string; weight: string; monthly: number; deposit: number }[] = [
  { label: 'Cat', weight: 'N/A', monthly: 25, deposit: 150 },
  { label: 'Small Dog', weight: 'Under 25 lbs', monthly: 25, deposit: 200 },
  { label: 'Medium Dog', weight: '25-50 lbs', monthly: 35, deposit: 250 },
  { label: 'Large Dog', weight: '50+ lbs', monthly: 45, deposit: 300 },
];

const ACTION_LABELS: Record<string, string> = {
  vehicle_registration: 'Vehicle Registered',
  pet_registration: 'Pet Registered',
  insurance_choice_own: 'Insurance: Getting Own',
  insurance_choice_appfolio: 'Insurance: Appfolio Enrollment',
  insurance_policy_recorded: 'Insurance Policy Recorded',
  insurance_proof_received: 'Insurance Proof Received',
  insurance_expiration_warning: 'Insurance Expiration Warning',
  gave_additional_insured_instructions: 'Gave Additional Insured Instructions',
  printed_forms: 'Printed Forms',
  general_note: 'Note',
};

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

  // Vehicle state - pre-fill from submissionData if exists
  const [vehicleType, setVehicleType] = useState(1);
  const [vehicleMake, setVehicleMake] = useState(submissionData?.vehicle_make || '');
  const [vehicleModel, setVehicleModel] = useState(submissionData?.vehicle_model || '');
  const [vehicleYear, setVehicleYear] = useState(submissionData?.vehicle_year ? String(submissionData.vehicle_year) : '');
  const [vehicleColor, setVehicleColor] = useState(submissionData?.vehicle_color || '');
  const [vehiclePlate, setVehiclePlate] = useState(submissionData?.vehicle_plate || '');

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

  // Insurance state
  const [insuranceChoice, setInsuranceChoice] = useState<'own_policy' | 'appfolio'>('own_policy');
  const [insProvider, setInsProvider] = useState('');
  const [insPolicyNumber, setInsPolicyNumber] = useState('');
  const [insCoverage, setInsCoverage] = useState('100000');
  const [insExpiration, setInsExpiration] = useState('');
  const [insAdditionalInsured, setInsAdditionalInsured] = useState(false);
  const [insProofReceived, setInsProofReceived] = useState(false);
  const [insHasPets, setInsHasPets] = useState(false);
  const [currentPolicy, setCurrentPolicy] = useState<InsurancePolicy | null>(null);
  const [loadingPolicy, setLoadingPolicy] = useState(true);

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
        setInsCoverage(p.liability_coverage ? String(p.liability_coverage) : '100000');
        setInsExpiration(p.policy_expiration || '');
        setInsAdditionalInsured(p.additional_insured_added || false);
        setInsProofReceived(p.proof_received || false);
        setInsHasPets(p.has_pets || false);
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
        const match = data.data.find((t: any) => 
          t.building_address === tenant.buildingAddress &&
          t.unit_number === tenant.unitNumber &&
          t.name === tenant.name
        );
        if (match?.submissionData) {
          const sub = match.submissionData;
          // Update vehicle fields
          if (sub.has_vehicle) {
            setVehicleMake(sub.vehicle_make || '');
            setVehicleModel(sub.vehicle_model || '');
            setVehicleYear(sub.vehicle_year ? String(sub.vehicle_year) : '');
            setVehicleColor(sub.vehicle_color || '');
            setVehiclePlate(sub.vehicle_plate || '');
          }
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

  const printData = {
    tenantName: tenant.name,
    buildingAddress: tenant.buildingAddress,
    unitNumber: tenant.unitNumber,
    phone: tenant.phone,
    email: tenant.email,
    staffName,
  };

  // -- Vehicle handlers --

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
    const actionData = {
      type: vt.label,
      make: vehicleMake,
      model: vehicleModel,
      year: vehicleYear,
      color: vehicleColor,
      plate: vehiclePlate.toUpperCase(),
      monthly_fee: vt.fee,
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
          action_type: 'vehicle_registration',
          action_data: actionData,
          notes: `${vehicleMake} ${vehicleModel} ${vehicleYear} - ${vehiclePlate.toUpperCase()} - $${vt.fee}/mo`,
          performed_by: staffName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchHistory();
        if (data.submissionData && onSubmissionUpdated) {
          onSubmissionUpdated(data.submissionData);
        }
        const wasUpdate = submissionData?.has_vehicle;
        if (wasUpdate) {
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
    const vt = VEHICLE_TYPES[vehicleType];
    const html = renderVehicleAddendum(printData, {
      type: vt.label,
      make: vehicleMake,
      model: vehicleModel,
      year: vehicleYear,
      color: vehicleColor,
      plate: vehiclePlate.toUpperCase(),
      monthlyFee: vt.fee,
    });
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
    if (!petBreed || !petName) {
      setAlertDialog({
        isOpen: true,
        title: 'Missing Information',
        message: 'Please fill in breed and name.',
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
    const fee = PET_FEES[petFeeIndex];
    const html = renderPetAddendum(printData, [{
      type: petType,
      breed: petBreed,
      name: petName,
      weight: petWeight,
      age: petAge,
      spayedNeutered: petSpayed,
      vaccinesUpToDate: petVaccines,
      monthlyFee: fee.monthly,
      deposit: fee.deposit,
    }]);
    openPrintWindow(html);
  };

  // -- Insurance handlers --

  const handleSaveInsurance = async () => {
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
          liability_coverage: Number(insCoverage) || 100000,
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
        : `${insProvider || 'Own policy'} - Policy #${insPolicyNumber || 'N/A'} - $${Number(insCoverage).toLocaleString()} coverage - Exp: ${insExpiration || 'N/A'}`;
      await saveInteraction(
        'insurance_policy_recorded',
        {
          insurance_type: insuranceChoice,
          provider: insProvider,
          policy_number: insPolicyNumber,
          coverage: insCoverage,
          expiration: insExpiration,
          additional_insured: insAdditionalInsured,
          proof_received: insProofReceived,
          has_pets: insHasPets,
        },
        label
      );
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
    const html = renderInsuranceAuth(printData, choice);
    openPrintWindow(html);
  };

  const handleGaveInstructions = async () => {
    const saved = await saveInteraction(
      'gave_additional_insured_instructions',
      { form_given: 'additional_insured_phone_instructions' },
      'Gave Additional Insured phone instructions'
    );
    if (saved) {
      const html = renderAdditionalInsuredInstructions(printData);
      openPrintWindow(html);
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
            <div className="flex gap-3 pt-2">
              <button onClick={handleSaveVehicle} disabled={saving} className={btnPrimary}>
                {saving ? 'Saving...' : (submissionData?.has_vehicle ? 'Update Vehicle' : 'Save Vehicle')}
              </button>
              <button onClick={handlePrintVehicle} className={btnSecondary}>
                Print Addendum
              </button>
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
                        <strong>{pet.pet_name}</strong> ({pet.pet_type}, {pet.pet_breed}, {pet.pet_weight}lbs)
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
            <div className="flex gap-3 pt-2">
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
                    <select value={insCoverage} onChange={e => setInsCoverage(e.target.value)} className={selectClass}>
                      <option value="100000">$100,000</option>
                      <option value="300000">$300,000 (required with pets)</option>
                      <option value="500000">$500,000</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Policy Expiration Date</label>
                    <input type="date" value={insExpiration} onChange={e => setInsExpiration(e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={insAdditionalInsured} onChange={e => setInsAdditionalInsured(e.target.checked)} className="w-4 h-4" />
                    <span className="text-sm">Additional Insured (LLC) added</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={insProofReceived} onChange={e => setInsProofReceived(e.target.checked)} className="w-4 h-4" />
                    <span className="text-sm">Proof of insurance received</span>
                  </label>
                </div>
              </div>
            )}

            {/* Has pets flag */}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input type="checkbox" checked={insHasPets} onChange={e => setInsHasPets(e.target.checked)} className="w-4 h-4" />
              <span className="text-sm font-medium">Tenant has pets (requires $300,000 coverage)</span>
            </label>
            {insHasPets && Number(insCoverage) < 300000 && (
              <div className="text-xs text-red-700 font-semibold bg-red-50 p-2">
                [!] Coverage is below $300,000 -- pet owners must have at least $300,000 liability.
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={handleSaveInsurance} disabled={saving} className={btnPrimary}>
                {saving ? 'Saving...' : 'Save Insurance Policy'}
              </button>
              <button onClick={handlePrintInsurance} className={btnSecondary}>
                Print Authorization
              </button>
            </div>

            <hr className="my-4 border-gray-200" />

            <h3 className="text-sm font-semibold text-[#1a2744]">Additional Insured Instructions</h3>
            <p className="text-xs text-gray-600">
              If tenant chose Option A, give them instructions on how to call their insurance company and add the LLC.
              This will print the instruction sheet and record that you gave it to them.
            </p>
            <button onClick={handleGaveInstructions} disabled={saving} className={btnGold}>
              {saving ? 'Saving...' : 'Print Additional Insured Instructions'}
            </button>
          </div>
        )}

        {/* -- HISTORY TAB -- */}
        {activeTab === 'history' && (
          <div>
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
