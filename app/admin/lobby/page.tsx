'use client';

import { useState, useEffect } from 'react';
import Head from 'next/head';
import { buildings } from '@/lib/buildings';
import DocumentViewerModal from '@/components/DocumentViewerModal';
import ExemptionStatusBadge from '@/components/ExemptionStatusBadge';
import LobbyIntakePanel from '@/components/LobbyIntakePanel';
import { useAdminAuth } from '@/lib/adminAuthContext';
import AlertDialog from '@/components/kit/AlertDialog';
import ConfirmDialog from '@/components/kit/ConfirmDialog';
import InfoCallout from '@/components/kit/InfoCallout';
import WarningHint from '@/components/kit/WarningHint';

interface TenantSubmission {
  id: string;
  full_name: string;
  unit_number: string;
  phone: string;
  email: string;
  building_address: string;
  has_pets: boolean;
  pets?: any[];
  pet_signature?: string;
  pet_signature_date?: string;
  pet_addendum_file?: string;
  pet_verified: boolean;
  pet_addendum_received: boolean;
  pet_addendum_received_at?: string;
  pet_addendum_received_by?: string;
  // Exemption fields
  exemption_status?: 'pending' | 'approved' | 'denied' | 'more_info_needed' | null;
  exemption_reason?: string;
  exemption_documents?: string[];
  exemption_reviewed_by?: string;
  exemption_reviewed_at?: string;
  exemption_notes?: string;
  has_fee_exemption?: boolean;
  has_insurance: boolean;
  insurance_provider?: string;
  insurance_policy_number?: string;
  insurance_file?: string;
  insurance_type?: 'renters' | 'car' | 'other';
  insurance_upload_pending: boolean;
  insurance_verified: boolean;
  add_insurance_to_rent: boolean;
  insurance_authorization_signature?: string;
  insurance_authorization_signature_date?: string;
  has_vehicle: boolean;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  vehicle_color?: string;
  vehicle_plate?: string;
  vehicle_type?: string;
  additional_vehicles?: Array<{
    vehicle_make: string;
    vehicle_model: string;
    vehicle_year: number | string;
    vehicle_color: string;
    vehicle_plate: string;
    vehicle_type?: string;
  }>;
  vehicle_signature?: string;
  vehicle_signature_date?: string;
  vehicle_addendum_file?: string;
  vehicle_addendum_file_uploaded_at?: string;
  vehicle_addendum_file_uploaded_by?: string;
  vehicle_verified: boolean;
  vehicle_addendum_received: boolean;
  vehicle_addendum_received_at?: string;
  vehicle_addendum_received_by?: string;
  permit_issued: boolean;
  permit_issued_at?: string;
  permit_issued_by?: string;
  tenant_picked_up: boolean;
  tenant_picked_up_at?: string;
  pickup_id_photo?: string;
  pickup_id_photo_at?: string;
  merged_into?: string;
  created_at: string;
}

interface UnifiedTenant {
  key: string;
  name: string;
  unit_number: string;
  building_address: string;
  phone: string | null;
  email: string | null;
  hasSubmission: boolean;
  submissionData: TenantSubmission | null;
  tenantLookupId: string | null;
  move_in: string | null;
  is_current: boolean;
  unitSubmissionCount?: number;
  canonicalSubmissionId?: string | null;
  canonicalSelectionRequired?: boolean;
  unitSubmissionCandidates?: Array<{
    id: string;
    full_name: string;
    created_at: string;
    phone: string | null;
    email: string | null;
    has_vehicle: boolean;
    has_pets: boolean;
    has_insurance: boolean;
    is_primary: boolean;
  }>;
}

// Noise words stripped from search queries — users type "unit 1s" but data stores just "1S"
const SEARCH_NOISE_WORDS = new Set(['unit', 'apt', 'apartment', 'building', 'bldg', 'st', 'street', 'ave', 'avenue']);

function searchTenants(query: string, tenants: UnifiedTenant[]): UnifiedTenant[] {
  const raw = query.toLowerCase().trim();
  if (!raw) return [];

  // Tokenize and strip noise words
  const tokens = raw.split(/\s+/).filter(t => t.length > 0 && !SEARCH_NOISE_WORDS.has(t));
  if (tokens.length === 0) return [];

  return tenants.filter((t) => {
    const fields = [
      (t.name || '').toLowerCase(),
      (t.unit_number || '').toLowerCase(),
      (t.building_address || '').toLowerCase(),
      (t.phone || '').toLowerCase(),
      (t.email || '').toLowerCase(),
    ];

    // Single-token: substring match against any field (preserves current behavior)
    if (tokens.length === 1) {
      return fields.some(f => f.includes(tokens[0]));
    }

    // Multi-token: every token must match at least one field as a substring
    return tokens.every(token =>
      fields.some(field => field.includes(token))
    );
  });
}

export default function LobbyPage() {
  const { user } = useAdminAuth();
  const adminName = user?.displayName || 'Admin';
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [sessionStarted, setSessionStarted] = useState(false);
  const [allTenants, setAllTenants] = useState<UnifiedTenant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UnifiedTenant[]>([]);
  const [activeTenant, setActiveTenant] = useState<UnifiedTenant | null>(null);
  const [availableUsers, setAvailableUsers] = useState<Array<{ id: string; display_name: string }>>([]);
  const [selectedStaffName, setSelectedStaffName] = useState(adminName);

  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [updatingField, setUpdatingField] = useState<string | null>(null);

  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant?: 'success' | 'error' | 'info';
  }>({ isOpen: false, title: '', message: '' });
  const [documentViewer, setDocumentViewer] = useState<{
    isOpen: boolean;
    documentPath: string | null;
    documentType: 'signature' | 'insurance' | 'addendum' | 'photo';
    title?: string;
    date?: string;
  }>({ isOpen: false, documentPath: null, documentType: 'signature' });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);
  const [showIntakePanel, setShowIntakePanel] = useState(false);
  const [pickupIdFile, setPickupIdFile] = useState<File | null>(null);
  const [pickupIdPreview, setPickupIdPreview] = useState<string | null>(null);
  const [selectedCanonicalSubmissionId, setSelectedCanonicalSubmissionId] = useState<string>('');

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAvailableUsers();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!activeTenant) {
      setSelectedCanonicalSubmissionId('');
      return;
    }

    const preferredId =
      activeTenant.canonicalSubmissionId ||
      activeTenant.unitSubmissionCandidates?.find((candidate) => candidate.is_primary)?.id ||
      activeTenant.unitSubmissionCandidates?.[0]?.id ||
      '';
    setSelectedCanonicalSubmissionId(preferredId);
  }, [activeTenant?.key, activeTenant?.canonicalSubmissionId]);

  const fetchAvailableUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        const activeUsers = data.data.filter((u: any) => u.is_active);
        setAvailableUsers(activeUsers);
        // Set default to current user if available, otherwise first user
        if (activeUsers.length > 0) {
          const currentUserMatch = activeUsers.find((u: any) => u.display_name === adminName);
          setSelectedStaffName(currentUserMatch?.display_name || activeUsers[0].display_name);
        }
      }
    } catch (e) {
      console.error('Failed to fetch users:', e);
    }
  };

  const refreshTenantsAndKeepActive = async (opts?: {
    building?: string;
    unit?: string;
    canonicalId?: string;
  }) => {
    const response = await fetch('/api/admin/unified-tenants');
    const result = await response.json();
    if (!result.success) return;

    const tenants = result.data as UnifiedTenant[];
    setAllTenants(tenants);

    if (!activeTenant && !opts?.building && !opts?.unit && !opts?.canonicalId) return;

    const targetBuilding = opts?.building || activeTenant?.building_address;
    const targetUnit = opts?.unit || activeTenant?.unit_number;
    const targetCanonicalId = opts?.canonicalId;

    const refreshedActive = tenants.find((tenant) => {
      if (targetCanonicalId) {
        return tenant.canonicalSubmissionId === targetCanonicalId;
      }
      return tenant.building_address === targetBuilding && tenant.unit_number === targetUnit;
    });

    if (refreshedActive) {
      setActiveTenant(refreshedActive);
    }
  };

  const handleSetCanonicalSubmission = async () => {
    if (!activeTenant || !selectedCanonicalSubmissionId) return;

    setUpdatingField('set_canonical');
    try {
      const response = await fetch('/api/admin/lobby-canonical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          building_address: activeTenant.building_address,
          unit_number: activeTenant.unit_number,
          canonical_submission_id: selectedCanonicalSubmissionId,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        setAlertDialog({
          isOpen: true,
          title: 'Canonical Selection Failed',
          message: result.message || 'Failed to set canonical submission',
          variant: 'error',
        });
        return;
      }

      await refreshTenantsAndKeepActive({
        building: activeTenant.building_address,
        unit: activeTenant.unit_number,
        canonicalId: selectedCanonicalSubmissionId,
      });

      setAlertDialog({
        isOpen: true,
        title: 'Canonical Submission Set',
        message: 'Canonical submission selected. You can now continue intake and permit workflow for this unit.',
        variant: 'success',
      });
    } catch (error) {
      console.error('Canonical selection error:', error);
      setAlertDialog({
        isOpen: true,
        title: 'Canonical Selection Failed',
        message: 'Failed to set canonical submission',
        variant: 'error',
      });
    } finally {
      setUpdatingField(null);
    }
  };

  // Keyboard shortcuts
  // Live search with debouncing
  useEffect(() => {
    if (!searchQuery.trim() || activeTenant) {
      setSearchResults([]);
      return;
    }

    const debounceTimer = setTimeout(() => {
      const results = searchTenants(searchQuery, allTenants);

      if (results.length === 1) {
        setActiveTenant(results[0]);
        setSearchResults([]);
        setSearchQuery('');
      } else {
        setSearchResults(results);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, allTenants, activeTenant]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K: Focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder="Search by name, unit, or building..."]') as HTMLInputElement;
        searchInput?.focus();
      }
      
      // Escape: Clear tenant or close modal
      if (e.key === 'Escape') {
        if (documentViewer.isOpen) {
          setDocumentViewer({ isOpen: false, documentPath: null, documentType: 'signature' });
        } else if (activeTenant) {
          handleClear();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [activeTenant, documentViewer.isOpen]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/admin/auth');
      const data = await response.json();
      setIsAuthenticated(data.isAuthenticated);
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.success) {
        setIsAuthenticated(true);
      } else {
        setAuthError(data.message || 'Invalid password');
      }
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  const handleStartSession = async () => {
    try {
      const response = await fetch('/api/admin/unified-tenants');
      const result = await response.json();

      if (result.success) {
        setAllTenants(result.data);
        setSessionStarted(true);
      }
    } catch (error) {
      console.error('Failed to load tenants:', error);
      setAlertDialog({
        isOpen: true,
        title: 'Error',
        message: 'Failed to load tenants',
        variant: 'error'
      });
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const results = searchTenants(searchQuery, allTenants);

    if (results.length === 1) {
      setActiveTenant(results[0]);
      setSearchResults([]);
      setSearchQuery('');
    } else {
      setSearchResults(results);
    }
  };

  const handleClear = () => {
    setActiveTenant(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleUploadDocument = async (
    documentType: 'pet_addendum' | 'insurance' | 'vehicle_addendum',
    file: File
  ) => {
    if (!activeTenant || !activeTenant.submissionData) return;

    setUploadingDoc(documentType);

    try {
      const formData = new FormData();
      formData.append('submissionId', activeTenant.submissionData.id);
      formData.append('documentType', documentType);
      formData.append('file', file);

      const response = await fetch('/api/admin/compliance/attach-document', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setActiveTenant({
          ...activeTenant,
          submissionData: result.data,
        });
        const index = allTenants.findIndex((t) => t.key === activeTenant.key);
        if (index !== -1) {
          const updated = [...allTenants];
          updated[index] = {
            ...updated[index],
            submissionData: result.data,
          };
          setAllTenants(updated);
        }
      } else {
        setAlertDialog({
          isOpen: true,
          title: 'Upload Failed',
          message: result.message,
          variant: 'error'
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      setAlertDialog({
        isOpen: true,
        title: 'Upload Failed',
        message: 'Upload failed',
        variant: 'error'
      });
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleDeleteDocument = async (
    documentType: 'pet_addendum' | 'insurance' | 'vehicle_addendum'
  ) => {
    if (!activeTenant || !activeTenant.submissionData) return;

    setDeletingDoc(documentType);

    try {
      const response = await fetch('/api/admin/compliance/delete-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: activeTenant.submissionData.id,
          documentType,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setActiveTenant({
          ...activeTenant,
          submissionData: result.data,
        });
        const index = allTenants.findIndex((t) => t.key === activeTenant.key);
        if (index !== -1) {
          const updated = [...allTenants];
          updated[index] = {
            ...updated[index],
            submissionData: result.data,
          };
          setAllTenants(updated);
        }
        setAlertDialog({
          isOpen: true,
          title: 'Document Deleted',
          message: 'The document has been removed.',
          variant: 'success'
        });
      } else {
        setAlertDialog({
          isOpen: true,
          title: 'Delete Failed',
          message: result.message,
          variant: 'error'
        });
      }
    } catch (error) {
      console.error('Delete error:', error);
      setAlertDialog({
        isOpen: true,
        title: 'Delete Failed',
        message: 'Failed to delete document',
        variant: 'error'
      });
    } finally {
      setDeletingDoc(null);
    }
  };

  const handleSetInsuranceType = async (insuranceType: 'renters' | 'car' | 'other') => {
    if (!activeTenant || !activeTenant.submissionData) return;

    setUpdatingField('insurance_type');

    try {
      const response = await fetch('/api/admin/compliance/insurance-type', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: activeTenant.submissionData.id,
          insuranceType,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setActiveTenant({
          ...activeTenant,
          submissionData: result.data,
        });
        const index = allTenants.findIndex((t) => t.key === activeTenant.key);
        if (index !== -1) {
          const updated = [...allTenants];
          updated[index] = {
            ...updated[index],
            submissionData: result.data,
          };
          setAllTenants(updated);
        }
      } else {
        setAlertDialog({
          isOpen: true,
          title: 'Update Failed',
          message: result.message,
          variant: 'error'
        });
      }
    } catch (error) {
      console.error('Update error:', error);
      setAlertDialog({
        isOpen: true,
        title: 'Update Failed',
        message: 'Update failed',
        variant: 'error'
      });
    } finally {
      setUpdatingField(null);
    }
  };

  const handleMarkReceived = async (type: 'pet' | 'vehicle') => {
    if (!activeTenant || !activeTenant.submissionData) return;

    const endpoint = type === 'pet' ? 'pet-receipt' : 'vehicle-receipt';
    setUpdatingField(`${type}_receipt`);

    try {
      const response = await fetch(`/api/admin/compliance/${endpoint}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: activeTenant.submissionData.id,
          receivedBy: selectedStaffName,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setActiveTenant({
          ...activeTenant,
          submissionData: result.data,
        });
        const index = allTenants.findIndex((t) => t.key === activeTenant.key);
        if (index !== -1) {
          const updated = [...allTenants];
          updated[index] = {
            ...updated[index],
            submissionData: result.data,
          };
          setAllTenants(updated);
        }
      } else {
        setAlertDialog({
          isOpen: true,
          title: 'Update Failed',
          message: result.message,
          variant: 'error'
        });
      }
    } catch (error) {
      console.error('Update error:', error);
      setAlertDialog({
        isOpen: true,
        title: 'Update Failed',
        message: 'Update failed',
        variant: 'error'
      });
    } finally {
      setUpdatingField(null);
    }
  };

  const handleToggleVerified = async (itemType: 'vehicle' | 'pet' | 'insurance') => {
    if (!activeTenant || !activeTenant.submissionData) return;

    const newValue = !activeTenant.submissionData[`${itemType}_verified`];
    setUpdatingField(`${itemType}_verified`);

    try {
      const response = await fetch('/api/admin/compliance/building-summary', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: activeTenant.submissionData.id,
          itemType,
          verified: newValue,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setActiveTenant({
          ...activeTenant,
          submissionData: result.data,
        });
        const index = allTenants.findIndex((t) => t.key === activeTenant.key);
        if (index !== -1) {
          const updated = [...allTenants];
          updated[index] = {
            ...updated[index],
            submissionData: result.data,
          };
          setAllTenants(updated);
        }
      } else {
        setAlertDialog({
          isOpen: true,
          title: 'Update Failed',
          message: result.message,
          variant: 'error'
        });
      }
    } catch (error) {
      console.error('Update error:', error);
      setAlertDialog({
        isOpen: true,
        title: 'Update Failed',
        message: 'Update failed',
        variant: 'error'
      });
    } finally {
      setUpdatingField(null);
    }
  };

  const handleIssuePermit = async (opts?: { managerOverride?: boolean; overrideReason?: string }) => {
    if (!activeTenant || !activeTenant.submissionData) return;

    setUpdatingField('permit_issue');

    try {
      const response = await fetch('/api/admin/compliance/permit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: activeTenant.submissionData.id,
          admin: selectedStaffName,
          managerOverride: !!opts?.managerOverride,
          overrideReason: opts?.overrideReason || null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setActiveTenant({
          ...activeTenant,
          submissionData: result.data,
        });
        const index = allTenants.findIndex((t) => t.key === activeTenant.key);
        if (index !== -1) {
          const updated = [...allTenants];
          updated[index] = {
            ...updated[index],
            submissionData: result.data,
          };
          setAllTenants(updated);
        }
      } else {
        if (!opts?.managerOverride && Array.isArray(result.missingItems) && result.missingItems.length > 0) {
          setConfirmDialog({
            isOpen: true,
            title: 'Manager Override Required',
            message: `Missing: ${result.missingItems.join(', ')}. Proceed with manager override?`,
            onConfirm: async () => {
              setConfirmDialog(prev => ({ ...prev, isOpen: false }));
              const reason = window.prompt('Enter manager override reason (required):', 'Manager approved exception at front desk');
              if (!reason || !reason.trim()) {
                setAlertDialog({
                  isOpen: true,
                  title: 'Override Reason Required',
                  message: 'Permit override was cancelled because no reason was provided.',
                  variant: 'error',
                });
                return;
              }
              await handleIssuePermit({ managerOverride: true, overrideReason: reason.trim() });
            },
          });
          return;
        }

        setAlertDialog({
          isOpen: true,
          title: 'Failed to Issue Permit',
          message: result.message,
          variant: 'error'
        });
      }
    } catch (error) {
      console.error('Issue permit error:', error);
      setAlertDialog({
        isOpen: true,
        title: 'Failed to Issue Permit',
        message: 'Failed to issue permit',
        variant: 'error'
      });
    } finally {
      setUpdatingField(null);
    }
  };

  const handleMarkPickedUp = async () => {
    if (!activeTenant || !activeTenant.submissionData) return;

    if (!pickupIdFile) {
      setAlertDialog({
        isOpen: true,
        title: 'ID Photo Required',
        message: 'Please take a photo of the tenant\'s ID before marking as picked up.',
        variant: 'error'
      });
      return;
    }

    setUpdatingField('mark_picked_up');

    try {
      // Upload ID photo first via attach-document API
      const fileFormData = new FormData();
      fileFormData.append('submissionId', activeTenant.submissionData.id);
      fileFormData.append('documentType', 'pickup_id_photo');
      fileFormData.append('file', pickupIdFile);

      const uploadResponse = await fetch('/api/admin/compliance/attach-document', {
        method: 'POST',
        body: fileFormData,
      });

      const uploadResult = await uploadResponse.json();
      if (!uploadResult.success) {
        setAlertDialog({
          isOpen: true,
          title: 'Upload Failed',
          message: `ID photo upload failed: ${uploadResult.message}`,
          variant: 'error'
        });
        setUpdatingField(null);
        return;
      }

      const response = await fetch('/api/admin/compliance/permit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: activeTenant.submissionData.id,
          idPhotoPath: uploadResult.filePath,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setActiveTenant({
          ...activeTenant,
          submissionData: result.data,
        });
        const index = allTenants.findIndex((t) => t.key === activeTenant.key);
        if (index !== -1) {
          const updated = [...allTenants];
          updated[index] = {
            ...updated[index],
            submissionData: result.data,
          };
          setAllTenants(updated);
        }
        setPickupIdFile(null);
        setPickupIdPreview(null);
      } else {
        setAlertDialog({
          isOpen: true,
          title: 'Update Failed',
          message: result.message,
          variant: 'error'
        });
      }
    } catch (error) {
      console.error('Update error:', error);
      setAlertDialog({
        isOpen: true,
        title: 'Update Failed',
        message: 'Update failed',
        variant: 'error'
      });
    } finally {
      setUpdatingField(null);
    }
  };


  // Conditional lock checks
  const getPetVerifiedStatus = () => {
    if (!activeTenant || !activeTenant.submissionData) return { canVerify: false, reason: '' };

    const sub = activeTenant.submissionData;
    const hasForm = sub.pet_signature || sub.pet_addendum_received;

    // Count only dogs and cats
    const dogsAndCats = sub.pets?.filter((p: any) => 
      p.pet_type === 'dog' || p.pet_type === 'cat'
    ) || [];

    if (sub.has_pets && dogsAndCats.length > 0) {
      // Has dogs/cats - check that all have details
      const hasPetDetails = dogsAndCats.every((pet: any) => 
        pet.pet_name && pet.pet_type && pet.pet_breed
      );
      if (!hasPetDetails) {
        return { 
          canVerify: false, 
          reason: `Pet details incomplete - need details for all ${dogsAndCats.length} dog(s)/cat(s)` 
        };
      }
      if (!hasForm) {
        return { canVerify: false, reason: 'No pet addendum on file — open Lobby Intake to print' };
      }
      return { canVerify: true, reason: '' };
    } else {
      // No dogs/cats or exemption
      if (!hasForm) {
        return { canVerify: false, reason: 'No "no pets" form on file — open Lobby Intake to print' };
      }
      return { canVerify: true, reason: '' };
    }
  };

  const getInsuranceVerifiedStatus = () => {
    if (!activeTenant || !activeTenant.submissionData) return { canVerify: false, reason: '' };

    const sub = activeTenant.submissionData;

    if (sub.add_insurance_to_rent) {
      return { canVerify: true, reason: '' };
    }

    if (!sub.insurance_file) {
      return { canVerify: false, reason: 'No insurance document on file — open Lobby Intake to print' };
    }

    if (!sub.insurance_type) {
      return { canVerify: false, reason: 'Classify insurance type first' };
    }

    if (sub.insurance_type === 'car') {
      return { canVerify: false, reason: 'Car insurance uploaded — renters insurance required' };
    }

    if (sub.insurance_type === 'other') {
      return { canVerify: false, reason: 'Document type not accepted — renters insurance required' };
    }

    return { canVerify: true, reason: '' };
  };

  const getVehicleVerifiedStatus = () => {
    if (!activeTenant || !activeTenant.submissionData) return { canVerify: false, reason: '' };

    const sub = activeTenant.submissionData;
    const hasDetails = sub.vehicle_make && sub.vehicle_model && sub.vehicle_plate;
    const hasForm = sub.vehicle_signature || sub.vehicle_addendum_received;

    if (!hasDetails) {
      return { canVerify: false, reason: 'Vehicle details incomplete' };
    }

    if (!hasForm) {
      return { canVerify: false, reason: 'No vehicle addendum on file — open Lobby Intake to print' };
    }

    return { canVerify: true, reason: '' };
  };

  const getPermitStatus = () => {
    if (!activeTenant || !activeTenant.submissionData || !activeTenant.submissionData.has_vehicle) {
      return { canIssue: false, blocking: [] };
    }

    const sub = activeTenant.submissionData;
    const blocking: string[] = [];

    // Only block on pet verification if they have dogs/cats and no exemption
    if (!sub.pet_verified && sub.has_pets && !sub.has_fee_exemption) blocking.push('Pet verification');
    if (!sub.insurance_verified) blocking.push('Insurance verification');
    if (!sub.vehicle_verified) blocking.push('Vehicle verification');

    return {
      canIssue: blocking.length === 0 && !sub.permit_issued,
      blocking,
    };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="text-[var(--primary)]">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="bg-white border border-[var(--border)] p-8 w-full max-w-md">
          <h1 className="text-2xl font-serif text-[var(--primary)] mb-6">Lobby — Admin Login</h1>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-2 border border-[var(--border)] rounded-none mb-4 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            {authError && <div className="text-[var(--error)] text-sm mb-4">{authError}</div>}
            <button
              type="submit"
              className="w-full bg-[var(--primary)] text-white px-4 py-2 rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!sessionStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-8">
        <div className="bg-white border border-[var(--border)] p-8 w-full max-w-md">
          <h1 className="text-2xl font-serif text-[var(--primary)] mb-6">Start Lobby Session</h1>

          <div className="mb-6">
            <div className="text-sm text-[var(--muted)]">Logged in as</div>
            <div className="text-lg font-medium text-[var(--primary)]">{adminName}</div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-[var(--ink)] mb-2">
              Who is performing intake?
            </label>
            <select
              value={selectedStaffName}
              onChange={(e) => setSelectedStaffName(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            >
              {availableUsers.map((u) => (
                <option key={u.id} value={u.display_name}>
                  {u.display_name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleStartSession}
            className="w-full bg-[var(--primary)] text-white px-4 py-2 rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out"
          >
            Start Session
          </button>
        </div>
      </div>
    );
  }

  const petStatus = getPetVerifiedStatus();
  const insuranceStatus = getInsuranceVerifiedStatus();
  const vehicleStatus = getVehicleVerifiedStatus();
  const permitStatus = getPermitStatus();

  const isComplete = (() => {
    if (!activeTenant?.submissionData) return false;
    
    const sub = activeTenant.submissionData;
    
    if (sub.has_vehicle) {
      return sub.permit_issued && sub.tenant_picked_up;
    } else if (sub.has_pets) {
      return (sub.has_fee_exemption || sub.pet_verified) && sub.insurance_verified;
    } else {
      return sub.insurance_verified;
    }
  })();

  return (
    <>
      <Head>
        <title>Lobby Admin - Stanton Management</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="min-h-screen bg-[var(--bg)] p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white border border-[var(--border)] p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-serif text-[var(--primary)]">Lobby — Permit Distribution</h1>
              <div className="flex items-center gap-2 text-sm text-[var(--muted)] mt-1">
                <span>All Buildings •</span>
                <select
                  value={selectedStaffName}
                  onChange={(e) => setSelectedStaffName(e.target.value)}
                  className="bg-transparent border-b border-[var(--border)] text-[var(--primary)] font-medium text-sm py-0 px-1 focus:outline-none focus:border-[var(--primary)] cursor-pointer"
                >
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.display_name}>
                      {u.display_name}
                    </option>
                  ))}
                </select>
                <span>• Press Ctrl+K to search</span>
              </div>
            </div>
            {activeTenant && (
              <button
                onClick={handleClear}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-none hover:bg-gray-300 transition-colors duration-200 ease-out"
              >
                Clear / Next Tenant
              </button>
            )}
          </div>

          {/* Search */}
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by name, unit, or building..."
              className="flex-1 px-4 py-2 border border-[var(--border)] rounded-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              disabled={!!activeTenant}
            />
            <button
              onClick={handleSearch}
              disabled={!!activeTenant}
              className="px-6 py-2 bg-[var(--primary)] text-white rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out disabled:bg-gray-300"
            >
              Search
            </button>
          </div>

          {/* Search Results */}
          {searchResults.length > 1 && (
            <div className="mt-4 border border-[var(--border)] p-4">
              <div className="text-sm font-medium text-[var(--primary)] mb-2">
                Multiple matches — select one:
              </div>
              {searchResults.map((result) => (
                <button
                  key={result.key}
                  onClick={() => {
                    setActiveTenant(result);
                    setSearchResults([]);
                    setSearchQuery('');
                  }}
                  className="block w-full text-left px-3 py-2 hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out"
                >
                  <span className="font-medium">{result.name}</span> — {result.building_address} Unit {result.unit_number}
                  {result.canonicalSelectionRequired ? (
                    <span className="ml-2 text-xs text-red-700">(Canonical selection required)</span>
                  ) : !result.hasSubmission ? (
                    <span className="ml-2 text-xs text-yellow-600">(No submission)</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}

          {searchResults.length === 0 && searchQuery && !activeTenant && (
            <div className="mt-4 text-sm text-[var(--muted)]">No matching tenants found</div>
          )}
        </div>

        {/* Tenant Card */}
        {activeTenant && (
          <div className="bg-white border border-[var(--border)] p-6">
            {/* Tenant Header */}
            <div className="border-b border-[var(--divider)] pb-4 mb-6">
              <h2 className="text-xl font-serif text-[var(--primary)]">
                {activeTenant.name}
              </h2>
              <div className="text-sm text-[var(--muted)] mt-1">
                {activeTenant.building_address} • Unit {activeTenant.unit_number}
              </div>
              <div className="text-sm text-[var(--muted)]">
                {activeTenant.phone || 'No phone'} • {activeTenant.email || 'No email'}
              </div>
              {!activeTenant.hasSubmission && (
                <div className="mt-3">
                  <InfoCallout
                    variant="warning"
                    title="No Form Submission"
                    message="This tenant has not submitted the online form yet. Click Lobby Intake below to register details and print forms."
                    compact
                  />
                </div>
              )}
              {isComplete && (
                <div className="mt-3 text-lg font-medium text-[var(--success)]">
                  ✓ COMPLETE
                </div>
              )}
              {activeTenant.submissionData?.has_fee_exemption && (
                <div className="mt-2 text-lg font-bold text-green-700 bg-green-100 px-3 py-1 border border-green-300">
                  FEE EXEMPT
                </div>
              )}
            </div>

            {/* Show submission sections only if tenant has submitted */}
            {activeTenant.canonicalSelectionRequired ? (
              <div className="py-4">
                <InfoCallout
                  variant="warning"
                  title="Canonical Selection Required"
                  message="Multiple active submissions exist for this unit. Select the canonical submission before intake, verification, or permit actions."
                />
                <div className="mt-4 p-4 border border-[var(--divider)] bg-[var(--bg-section)]">
                  <label className="block text-sm font-medium text-[var(--ink)] mb-2">
                    Canonical submission for {activeTenant.building_address} Unit {activeTenant.unit_number}
                  </label>
                  <select
                    value={selectedCanonicalSubmissionId}
                    onChange={(e) => setSelectedCanonicalSubmissionId(e.target.value)}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  >
                    <option value="">Select a submission</option>
                    {(activeTenant.unitSubmissionCandidates || []).map((candidate) => {
                      const created = new Date(candidate.created_at).toLocaleString();
                      const flags = [
                        candidate.has_vehicle ? 'vehicle' : null,
                        candidate.has_pets ? 'pets' : null,
                        candidate.has_insurance ? 'insurance' : null,
                      ].filter(Boolean).join(', ');
                      return (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.full_name} — {created}{flags ? ` — ${flags}` : ''}
                        </option>
                      );
                    })}
                  </select>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      onClick={handleSetCanonicalSubmission}
                      disabled={!selectedCanonicalSubmissionId || updatingField === 'set_canonical'}
                      className="px-4 py-2 bg-[var(--primary)] text-white text-sm rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out disabled:bg-gray-300"
                    >
                      {updatingField === 'set_canonical' ? 'Saving...' : 'Set Canonical Submission'}
                    </button>
                    <span className="text-xs text-[var(--muted)]">
                      Required once per duplicate set. All desk actions remain blocked until this is selected.
                    </span>
                  </div>
                </div>
              </div>
            ) : !activeTenant.hasSubmission ? (
              <div className="py-6">
                <InfoCallout
                  variant="warning"
                  title="No Online Submission"
                  message="This tenant hasn't submitted the online form yet. Use Lobby Intake to register their information and print forms."
                  actionLabel="Open Lobby Intake"
                  onAction={() => setShowIntakePanel(true)}
                />
              </div>
            ) : (
            <>
            {/* Lobby Intake Button (for tenants with submissions too) */}
            <div className="mb-4 flex justify-end">
              <button
                onClick={() => setShowIntakePanel(true)}
                className="px-4 py-2 bg-[var(--primary)] text-white text-sm rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out"
              >
                Lobby Intake
              </button>
            </div>
            {(() => {
              const sub = activeTenant.submissionData!;
              return (
                <>
            {/* Pet Section */}
            <div className="mb-6 p-4 bg-[var(--bg-section)] border border-[var(--divider)]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif text-[var(--primary)]">Pet Information</h3>
                {sub.exemption_status && (
                  <ExemptionStatusBadge 
                    status={sub.exemption_status} 
                    reason={sub.exemption_reason}
                    compact
                  />
                )}
              </div>

              <div className="text-sm mb-3">
                {sub.has_pets ? (
                  <div>
                    <div className="font-medium mb-1">Has pets:</div>
                    {sub.pets?.filter((pet: any) => 
                      pet.pet_type === 'dog' || pet.pet_type === 'cat'
                    ).map((pet: any, idx: number) => (
                      <div key={idx} className="text-[var(--muted)] ml-2 mb-2">
                        • {pet.pet_name} ({pet.pet_type}) - {pet.pet_breed}
                        {pet.pet_photo_file && (
                          <div className="mt-1">
                            <button
                              onClick={() => setDocumentViewer({
                                isOpen: true,
                                documentPath: pet.pet_photo_file,
                                documentType: 'photo',
                                title: `${pet.pet_name} - Pet Photo`
                              })}
                              className="text-blue-600 hover:underline text-sm ml-2"
                            >
                              View Photo
                            </button>
                          </div>
                        )}
                        {pet.pet_vaccination_file && (
                          <div className="mt-1">
                            <button
                              onClick={() => setDocumentViewer({
                                isOpen: true,
                                documentPath: pet.pet_vaccination_file,
                                documentType: 'addendum',
                                title: `${pet.pet_name} - Vaccination Record`
                              })}
                              className="text-blue-600 hover:underline text-sm ml-2"
                            >
                              View Vaccination
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[var(--muted)]">No pets registered</div>
                )}
              </div>

              <div className="space-y-2 mb-4">
                {sub.pet_signature && (
                  <div className="text-sm">
                    <span className="text-[var(--success)]">✅ Signed online</span>
                    {sub.pet_signature_date && (
                      <span className="text-[var(--muted)] ml-2">
                        ({new Date(sub.pet_signature_date).toLocaleDateString()})
                      </span>
                    )}
                    <button
                      onClick={() => setDocumentViewer({
                        isOpen: true,
                        documentPath: sub.pet_signature || null,
                        documentType: 'signature',
                        title: 'Pet Addendum Signature',
                        date: sub.pet_signature_date
                      })}
                      className="ml-2 text-blue-600 hover:underline text-sm"
                    >
                      View Signature
                    </button>
                  </div>
                )}

                {sub.pet_addendum_received && (
                  <div className="text-sm">
                    <span className="text-[var(--success)]">✅ Physical form received</span>
                    {sub.pet_addendum_received_by && (
                      <span className="text-[var(--muted)] ml-2">
                        by {sub.pet_addendum_received_by}
                      </span>
                    )}
                  </div>
                )}

                {sub.pet_addendum_file && (
                  <div className="text-sm text-[var(--success)]">
                    ✅ File on record
                    <button
                      onClick={() => setDocumentViewer({
                        isOpen: true,
                        documentPath: sub.pet_addendum_file || null,
                        documentType: 'addendum',
                        title: 'Pet Addendum Document'
                      })}
                      className="ml-2 text-blue-600 hover:underline text-sm"
                    >
                      View Document
                    </button>
                    <button
                      onClick={() => setConfirmDialog({
                        isOpen: true,
                        title: 'Delete Pet Addendum',
                        message: 'Are you sure you want to delete this pet addendum document? This cannot be undone.',
                        onConfirm: () => {
                          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                          handleDeleteDocument('pet_addendum');
                        },
                      })}
                      disabled={deletingDoc === 'pet_addendum'}
                      className="ml-2 text-red-600 hover:underline text-sm"
                    >
                      {deletingDoc === 'pet_addendum' ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                )}

                {/* Exemption Documents */}
                {sub.exemption_status && sub.exemption_documents && sub.exemption_documents.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-[var(--divider)]">
                    <h4 className="text-sm font-semibold text-[var(--primary)] mb-2">Exemption Documents</h4>
                    <div className="space-y-1">
                      {sub.exemption_documents.map((docUrl: string, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => setDocumentViewer({
                            isOpen: true,
                            documentPath: docUrl,
                            documentType: 'addendum',
                            title: `Exemption Document ${idx + 1}`
                          })}
                          className="text-blue-600 hover:underline text-sm block"
                        >
                          View Exemption Document {idx + 1}
                        </button>
                      ))}
                    </div>
                    {sub.exemption_reviewed_at && (
                      <div className="text-xs text-[var(--muted)] mt-2">
                        Reviewed by {sub.exemption_reviewed_by} on {new Date(sub.exemption_reviewed_at).toLocaleDateString()}
                        {sub.exemption_notes && (
                          <div className="mt-1 text-[var(--ink)]">Notes: {sub.exemption_notes}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2 mb-4">
                {!sub.pet_addendum_received && (
                  <button
                    onClick={() => handleMarkReceived('pet')}
                    disabled={updatingField === 'pet_receipt'}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-none hover:bg-blue-700 transition-colors duration-200 ease-out disabled:bg-gray-300"
                  >
                    {updatingField === 'pet_receipt' ? 'Updating...' : 'Mark Physical Form Received'}
                  </button>
                )}

                <label className="px-3 py-1 text-sm bg-gray-600 text-white rounded-none hover:bg-gray-700 transition-colors duration-200 ease-out cursor-pointer">
                  {uploadingDoc === 'pet_addendum' ? 'Uploading...' : 'Upload Document'}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadDocument('pet_addendum', file);
                    }}
                    disabled={uploadingDoc === 'pet_addendum'}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                onClick={() => handleToggleVerified('pet')}
                disabled={!petStatus.canVerify || updatingField === 'pet_verified'}
                className={`flex items-center gap-2 text-sm px-3 py-2 transition-colors duration-200 ease-out ${
                  petStatus.canVerify
                    ? 'hover:bg-white cursor-pointer'
                    : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <span className={`text-lg ${sub.pet_verified ? 'text-[var(--success)]' : 'text-[var(--muted)]'}`}>
                  {sub.pet_verified ? '☑' : '☐'}
                </span>
                <span className={sub.pet_verified ? 'text-[var(--success)] font-medium' : 'text-[var(--muted)]'}>
                  Pet Verified
                </span>
              </button>

              {!petStatus.canVerify && (
                <WarningHint
                  message={petStatus.reason}
                  actionText="Lobby Intake"
                  onAction={() => setShowIntakePanel(true)}
                />
              )}
            </div>

            {/* Insurance Section */}
            <div className="mb-6 p-4 bg-[var(--bg-section)] border border-[var(--divider)]">
              <h3 className="font-serif text-[var(--primary)] mb-3">Insurance Information</h3>

              <div className="text-sm mb-3">
                {sub.add_insurance_to_rent ? (
                  <div>
                    <div className="text-[var(--muted)]">Opted into rent-added insurance</div>
                    {sub.insurance_authorization_signature ? (
                      <div className="text-sm mt-1">
                        <span className="text-[var(--success)]">✅ Authorization signed</span>
                        {sub.insurance_authorization_signature_date && (
                          <span className="text-[var(--muted)] ml-2">
                            ({new Date(sub.insurance_authorization_signature_date).toLocaleDateString()})
                          </span>
                        )}
                        <button
                          onClick={() => setDocumentViewer({
                            isOpen: true,
                            documentPath: sub.insurance_authorization_signature || null,
                            documentType: 'signature',
                            title: 'Insurance Authorization Signature',
                            date: sub.insurance_authorization_signature_date
                          })}
                          className="ml-2 text-blue-600 hover:underline text-sm"
                        >
                          View Signature
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-[var(--error)] mt-1">
                        ⚠️ No authorization signature on file
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    {sub.insurance_provider && (
                      <div>
                        <span className="font-medium">Provider:</span> {sub.insurance_provider}
                      </div>
                    )}
                    {sub.insurance_policy_number && (
                      <div className="text-[var(--muted)]">
                        Policy: {sub.insurance_policy_number}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!sub.add_insurance_to_rent && (
                <>
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-[var(--primary)] mb-1">
                      Insurance Type
                    </label>
                    <select
                      value={sub.insurance_type || ''}
                      onChange={(e) => handleSetInsuranceType(e.target.value as 'renters' | 'car' | 'other')}
                      disabled={updatingField === 'insurance_type'}
                      className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    >
                      <option value="">— Unclassified —</option>
                      <option value="renters">Renters Insurance</option>
                      <option value="car">Car Insurance</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {sub.insurance_file && (
                    <div className="text-sm text-[var(--success)] mb-3">
                      ✅ File on record
                      <button
                        onClick={() => setDocumentViewer({
                          isOpen: true,
                          documentPath: sub.insurance_file || null,
                          documentType: 'insurance',
                          title: 'Insurance Document'
                        })}
                        className="ml-2 text-blue-600 hover:underline text-sm"
                      >
                        View Document
                      </button>
                      <button
                        onClick={() => setConfirmDialog({
                          isOpen: true,
                          title: 'Delete Insurance Document',
                          message: 'Are you sure you want to delete this insurance document? This cannot be undone.',
                          onConfirm: () => {
                            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                            handleDeleteDocument('insurance');
                          },
                        })}
                        disabled={deletingDoc === 'insurance'}
                        className="ml-2 text-red-600 hover:underline text-sm"
                      >
                        {deletingDoc === 'insurance' ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  )}

                  <label className="inline-block px-3 py-1 text-sm bg-gray-600 text-white rounded-none hover:bg-gray-700 transition-colors duration-200 ease-out cursor-pointer mb-4">
                    {uploadingDoc === 'insurance' ? 'Uploading...' : 'Upload Insurance Document'}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadDocument('insurance', file);
                      }}
                      disabled={uploadingDoc === 'insurance'}
                      className="hidden"
                    />
                  </label>
                </>
              )}

              <button
                onClick={() => handleToggleVerified('insurance')}
                disabled={!insuranceStatus.canVerify || updatingField === 'insurance_verified'}
                className={`flex items-center gap-2 text-sm px-3 py-2 transition-colors duration-200 ease-out ${
                  insuranceStatus.canVerify
                    ? 'hover:bg-white cursor-pointer'
                    : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <span className={`text-lg ${sub.insurance_verified ? 'text-[var(--success)]' : 'text-[var(--muted)]'}`}>
                  {sub.insurance_verified ? '☑' : '☐'}
                </span>
                <span className={sub.insurance_verified ? 'text-[var(--success)] font-medium' : 'text-[var(--muted)]'}>
                  Insurance Verified
                </span>
              </button>

              {!insuranceStatus.canVerify && (
                <WarningHint
                  message={insuranceStatus.reason}
                  actionText="Lobby Intake"
                  onAction={() => setShowIntakePanel(true)}
                />
              )}
            </div>

            {/* Vehicle Section */}
            {sub.has_vehicle ? (
              <>
                <div className="mb-6 p-4 bg-[var(--bg-section)] border border-[var(--divider)]">
                  <h3 className="font-serif text-[var(--primary)] mb-3">Vehicle Information</h3>

                  <div className="text-sm mb-3">
                    {sub.vehicle_year && sub.vehicle_make && sub.vehicle_model ? (
                      <div>
                        <div className="font-medium">
                          {sub.vehicle_year} {sub.vehicle_make} {sub.vehicle_model}
                        </div>
                        <div className="text-[var(--muted)]">
                          {sub.vehicle_color} • Plate: {sub.vehicle_plate}
                          {sub.vehicle_type && sub.vehicle_type !== 'standard' && (
                            <span className="ml-2">• {sub.vehicle_type}</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[var(--error)]">Vehicle details incomplete</div>
                    )}
                    {Array.isArray(sub.additional_vehicles) && sub.additional_vehicles.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-[var(--divider)]">
                        <div className="text-xs font-medium text-[var(--primary)] mb-1">Additional Vehicles:</div>
                        {sub.additional_vehicles.map((av: any, idx: number) => (
                          <div key={idx} className="text-[var(--muted)] ml-2 mb-1">
                            • {av.vehicle_year} {av.vehicle_make} {av.vehicle_model} — {av.vehicle_color} · {av.vehicle_plate}
                            {av.vehicle_type && av.vehicle_type !== 'standard' && (
                              <span className="ml-1">({av.vehicle_type})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 mb-4">
                    {sub.vehicle_signature && (
                      <div className="text-sm">
                        <span className="text-[var(--success)]">✅ Signed online</span>
                        {sub.vehicle_signature_date && (
                          <span className="text-[var(--muted)] ml-2">
                            ({new Date(sub.vehicle_signature_date).toLocaleDateString()})
                          </span>
                        )}
                        <button
                          onClick={() => setDocumentViewer({
                            isOpen: true,
                            documentPath: sub.vehicle_signature || null,
                            documentType: 'signature',
                            title: 'Vehicle Addendum Signature',
                            date: sub.vehicle_signature_date
                          })}
                          className="ml-2 text-blue-600 hover:underline text-sm"
                        >
                          View Signature
                        </button>
                      </div>
                    )}

                    {sub.vehicle_addendum_received && (
                      <div className="text-sm">
                        <span className="text-[var(--success)]">✅ Physical form received</span>
                        {sub.vehicle_addendum_received_by && (
                          <span className="text-[var(--muted)] ml-2">
                            by {sub.vehicle_addendum_received_by}
                          </span>
                        )}
                      </div>
                    )}

                    {sub.vehicle_addendum_file && (
                      <div className="text-sm">
                        <span className="text-[var(--success)]">✅ File uploaded</span>
                        {sub.vehicle_addendum_file_uploaded_by && (
                          <span className="text-[var(--muted)] ml-2">
                            by {sub.vehicle_addendum_file_uploaded_by}
                          </span>
                        )}
                        {sub.vehicle_addendum_file_uploaded_at && (
                          <span className="text-[var(--muted)] ml-2">
                            ({new Date(sub.vehicle_addendum_file_uploaded_at).toLocaleDateString()})
                          </span>
                        )}
                        <button
                          onClick={() => setDocumentViewer({
                            isOpen: true,
                            documentPath: sub.vehicle_addendum_file || null,
                            documentType: 'addendum',
                            title: 'Vehicle Addendum Document'
                          })}
                          className="ml-2 text-blue-600 hover:underline text-sm"
                        >
                          View Document
                        </button>
                        <button
                          onClick={() => setConfirmDialog({
                            isOpen: true,
                            title: 'Delete Vehicle Addendum',
                            message: 'Are you sure you want to delete this vehicle addendum document? This cannot be undone.',
                            onConfirm: () => {
                              setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                              handleDeleteDocument('vehicle_addendum');
                            },
                          })}
                          disabled={deletingDoc === 'vehicle_addendum'}
                          className="ml-2 text-red-600 hover:underline text-sm"
                        >
                          {deletingDoc === 'vehicle_addendum' ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mb-4">
                    {!sub.vehicle_addendum_received && (
                      <button
                        onClick={() => handleMarkReceived('vehicle')}
                        disabled={updatingField === 'vehicle_receipt'}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded-none hover:bg-blue-700 transition-colors duration-200 ease-out disabled:bg-gray-300"
                      >
                        {updatingField === 'vehicle_receipt' ? 'Updating...' : 'Mark Physical Form Received'}
                      </button>
                    )}

                    <label className="px-3 py-1 text-sm bg-gray-600 text-white rounded-none hover:bg-gray-700 transition-colors duration-200 ease-out cursor-pointer">
                      {uploadingDoc === 'vehicle_addendum' ? 'Uploading...' : 'Upload Document'}
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadDocument('vehicle_addendum', file);
                        }}
                        disabled={uploadingDoc === 'vehicle_addendum'}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <button
                    onClick={() => handleToggleVerified('vehicle')}
                    disabled={!vehicleStatus.canVerify || updatingField === 'vehicle_verified'}
                    className={`flex items-center gap-2 text-sm px-3 py-2 transition-colors duration-200 ease-out ${
                      vehicleStatus.canVerify
                        ? 'hover:bg-white cursor-pointer'
                        : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <span className={`text-lg ${sub.vehicle_verified ? 'text-[var(--success)]' : 'text-[var(--muted)]'}`}>
                      {sub.vehicle_verified ? '☑' : '☐'}
                    </span>
                    <span className={sub.vehicle_verified ? 'text-[var(--success)] font-medium' : 'text-[var(--muted)]'}>
                      Vehicle Verified
                    </span>
                  </button>

                  {!vehicleStatus.canVerify && (
                    <WarningHint
                      message={vehicleStatus.reason}
                      actionText="Lobby Intake"
                      onAction={() => setShowIntakePanel(true)}
                    />
                  )}
                </div>

                {/* Permit Issuance Section */}
                <div className="p-4 bg-[var(--bg-section)] border border-[var(--divider)]">
                  <h3 className="font-serif text-[var(--primary)] mb-3">Parking Permit</h3>

                  {sub.permit_issued ? (
                    <div>
                      <div className="text-sm text-[var(--success)] mb-3">
                        ✅ Permit Issued by {sub.permit_issued_by}
                        {sub.permit_issued_at && (
                          <span className="text-[var(--muted)] ml-2">
                            on {new Date(sub.permit_issued_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {!sub.tenant_picked_up ? (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-[var(--primary)] mb-1">
                              Tenant ID Photo <span className="text-[var(--error)]">*</span>
                            </label>
                            <div className="flex items-center gap-3">
                              <label className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-none hover:bg-gray-700 transition-colors duration-200 ease-out cursor-pointer">
                                {pickupIdFile ? '✓ Photo Selected' : '📷 Take / Upload ID Photo'}
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      setPickupIdFile(file);
                                      setPickupIdPreview(URL.createObjectURL(file));
                                    }
                                  }}
                                  className="hidden"
                                />
                              </label>
                              {pickupIdFile && (
                                <button
                                  onClick={() => { setPickupIdFile(null); setPickupIdPreview(null); }}
                                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                            {pickupIdPreview && (
                              <img src={pickupIdPreview} alt="ID Preview" className="mt-2 max-h-32 border border-[var(--border)]" />
                            )}
                            {!pickupIdFile && (
                              <p className="text-xs text-[var(--muted)] mt-1">
                                Photo of tenant's ID is required before marking permit as picked up.
                              </p>
                            )}
                          </div>
                          <button
                            onClick={handleMarkPickedUp}
                            disabled={updatingField === 'mark_picked_up' || !pickupIdFile}
                            className="px-4 py-2 bg-purple-600 text-white rounded-none hover:bg-purple-700 transition-colors duration-200 ease-out disabled:bg-gray-300 disabled:cursor-not-allowed"
                          >
                            {updatingField === 'mark_picked_up' ? 'Uploading & Saving...' : 'Mark Picked Up'}
                          </button>
                        </div>
                      ) : (
                        <div className="text-sm text-[var(--success)]">
                          ✓ Picked up
                          {sub.tenant_picked_up_at && (
                            <span className="text-[var(--muted)] ml-2">
                              on {new Date(sub.tenant_picked_up_at).toLocaleDateString()}
                            </span>
                          )}
                          {sub.pickup_id_photo && (
                            <button
                              onClick={() => setDocumentViewer({
                                isOpen: true,
                                documentPath: sub.pickup_id_photo || null,
                                documentType: 'photo',
                                title: 'Tenant ID Photo'
                              })}
                              className="ml-2 text-blue-600 hover:underline text-sm"
                            >
                              View ID
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <button
                        onClick={() => handleIssuePermit()}
                        disabled={updatingField === 'permit_issue'}
                        className="px-4 py-2 bg-[var(--primary)] text-white rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        {updatingField === 'permit_issue' ? 'Issuing...' : '🎫 Issue Permit'}
                      </button>

                      {permitStatus.blocking.length > 0 && (
                        <div className="text-xs text-[var(--error)] mt-2">
                          ⚠️ Missing: {permitStatus.blocking.join(', ')}
                          <div className="mt-1 text-[var(--muted)]">
                            Manager override can still issue with required reason.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-4 bg-[var(--bg-section)] border border-[var(--divider)]">
                <div className="text-sm text-[var(--muted)]">No vehicle registered</div>
                {sub.pet_verified && sub.insurance_verified && (
                  <div className="text-sm text-[var(--success)] mt-2">
                    ✓ Compliance complete (no vehicle)
                  </div>
                )}
              </div>
            )}
                </>
              );
            })()}
            </>
            )}
          </div>
        )}
      </div>
    </div>
    {/* Document Viewer Modal */}
    <DocumentViewerModal
      isOpen={documentViewer.isOpen}
      onClose={() => setDocumentViewer({ isOpen: false, documentPath: null, documentType: 'signature' })}
      documentPath={documentViewer.documentPath}
      documentType={documentViewer.documentType}
      title={documentViewer.title}
      date={documentViewer.date}
    />
    {/* Lobby Intake Panel */}
    {showIntakePanel && activeTenant && (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-12 px-4">
        <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto">
          <LobbyIntakePanel
            tenant={{
              name: activeTenant.name,
              buildingAddress: activeTenant.building_address,
              unitNumber: activeTenant.unit_number,
              phone: activeTenant.phone || undefined,
              email: activeTenant.email || undefined,
            }}
            submissionData={activeTenant.submissionData}
            staffName={selectedStaffName}
            onClose={() => setShowIntakePanel(false)}
            onSubmissionUpdated={(submissionData) => {
              setActiveTenant({
                ...activeTenant,
                hasSubmission: true,
                submissionData,
              });
              const index = allTenants.findIndex((t) => t.key === activeTenant.key);
              if (index !== -1) {
                const updated = [...allTenants];
                updated[index] = {
                  ...updated[index],
                  hasSubmission: true,
                  submissionData,
                };
                setAllTenants(updated);
              }
            }}
          />
        </div>
      </div>
    )}

    {/* Dialogs */}
    <AlertDialog
      isOpen={alertDialog.isOpen}
      title={alertDialog.title}
      message={alertDialog.message}
      onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
      variant={alertDialog.variant}
    />
    <ConfirmDialog
      isOpen={confirmDialog.isOpen}
      title={confirmDialog.title}
      message={confirmDialog.message}
      confirmText="Delete"
      variant="danger"
      onConfirm={confirmDialog.onConfirm}
      onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
    />
  </>
);
}
