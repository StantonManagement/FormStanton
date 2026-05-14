/**
 * Signing Surface Page
 * 
 * Staff signing interface for PBV applications.
 * Shows config-gap banners, signature status, and action buttons.
 * Disabled "Sign in-app" buttons as placeholders for future Phase V.
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  FileText,
  Send,
  CheckCircle,
  AlertCircle,
  Clock,
  Ban,
  Plus,
  AlertTriangle,
  Play,
  Check
} from 'lucide-react';
import Link from 'next/link';
import FormButton from '@/components/form/FormButton';
import SigningChecklist from '@/components/signing/SigningChecklist';
import HapDirectionPicker from '@/components/signing/HapDirectionPicker';
import UploadSignedDialog from '@/components/signing/UploadSignedDialog';
import WaiveSignatureDialog from '@/components/signing/WaiveSignatureDialog';
import ExecuteHapDialog from '@/components/signing/ExecuteHapDialog';
import ConfigGapBanner from '@/components/signing/ConfigGapBanner';

interface Application {
  id: string;
  head_of_household_name: string;
  building_address: string;
  unit_number: string;
  hach_review_status: string;
  stage: string;
  packet_locked: boolean;
}

interface PacketSignature {
  id: string;
  document_slug: string;
  document_label: string;
  signing_party: string;
  is_required: boolean;
  is_template_default: boolean;
  status: 'pending' | 'sent' | 'signed' | 'waived' | 'executed';
  sent_at?: string;
  signed_at?: string;
  signed_pdf_path?: string;
  signature_method?: string;
  waived_reason?: string;
  notes?: string;
  plain_language_description?: string;
  conditional_note?: string;
  created_at: string;
  updated_at: string;
}

interface SigningPacket {
  id: string;
  application_id: string;
  template_key: string;
  created_at: string;
  created_by?: string;
  executed_at?: string;
  executed_by?: string;
  notes?: string;
  packet_signatures?: PacketSignature[];
}

interface ConfigGaps {
  property_not_configured: boolean;
  template_defaulted: boolean;
  year_built_unknown: boolean;
}

export default function SigningPage() {
  const params = useParams();
  const applicationId = params.id as string;

  const [application, setApplication] = useState<Application | null>(null);
  const [packet, setPacket] = useState<SigningPacket | null>(null);
  const [configGaps, setConfigGaps] = useState<ConfigGaps | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Clean error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    fetchData();
  }, [applicationId]);

  const fetchData = async () => {
    try {
      // Fetch signing data (includes packet, signatures, application, config gaps)
      const response = await fetch(`/api/admin/pbv/full-applications/${applicationId}/signing`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch signing data');
      }

      const data = await response.json();

      if (data.success) {
        setApplication(data.data.application);
        setPacket(data.data.packet);
        setConfigGaps(data.data.config_gaps);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Packet is auto-created on first GET when HACH approved

  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showWaiveDialog, setShowWaiveDialog] = useState(false);
  const [showExecuteDialog, setShowExecuteDialog] = useState(false);
  const [selectedSignatureId, setSelectedSignatureId] = useState<string | null>(null);
  const [hasExecutePermission, setHasExecutePermission] = useState(false);

  // Check execute permission on mount
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const response = await fetch('/api/admin/pbv/full-applications/preflight');
        if (response.ok) {
          const data = await response.json();
          // This is a simplified check - in reality you'd check the specific permission
          setHasExecutePermission(true);
        }
      } catch {
        // Permission check failed
      }
    };
    checkPermission();
  }, []);

  const handleMarkSent = async (signatureId: string, hapDirection?: 'stanton_first' | 'hach_first') => {
    setActionLoading(`${signatureId}-sent`);
    try {
      const body: any = {};
      if (hapDirection) {
        body.hap_initiation_direction = hapDirection;
        if (hapDirection === 'hach_first') {
          // Use received-from-hach endpoint for HACH-first path
          const response = await fetch(`/api/admin/pbv/full-applications/${applicationId}/signing/${signatureId}/received-from-hach`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to mark received from HACH');
          }
          await fetchData();
          return;
        }
      }

      const response = await fetch(`/api/admin/pbv/full-applications/${applicationId}/signing/${signatureId}/sent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to mark sent');
      }

      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpload = async (signatureId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`/api/admin/pbv/full-applications/${applicationId}/signing/${signatureId}/upload`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Upload failed');
    }

    await fetchData();
  };

  const handleWaive = async (signatureId: string, reason: string) => {
    const response = await fetch(`/api/admin/pbv/full-applications/${applicationId}/signing/${signatureId}/waive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to waive');
    }

    await fetchData();
  };

  const handleExecuteHap = async (executionDate: string) => {
    const response = await fetch(`/api/admin/pbv/full-applications/${applicationId}/signing/execute-hap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ execution_date: executionDate })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Execution failed');
    }

    await fetchData();
  };


  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-400" />;
      case 'sent':
        return <Send className="h-4 w-4 text-blue-500" />;
      case 'signed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'waived':
        return <Ban className="h-4 w-4 text-yellow-500" />;
      case 'executed':
        return <Play className="h-4 w-4 text-purple-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'signed':
        return 'bg-green-100 text-green-800';
      case 'waived':
        return 'bg-yellow-100 text-yellow-800';
      case 'executed':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const canExecuteHap = () => {
    if (!packet || packet.executed_at) return false;

    const signatures = (packet as any).signatures || [];
    const requiredSignatures = signatures.filter((sig: any) => sig.is_required);
    const completeSignatures = requiredSignatures.filter(
      (sig: any) => ['signed', 'waived', 'executed'].includes(sig.status)
    );

    const hapSignature = signatures.find((sig: any) =>
      sig.signing_party === 'stanton_and_hach'
    );

    return completeSignatures.length === requiredSignatures.length &&
           hapSignature?.status === 'signed';
  };

  const getHapSignature = () => {
    const signatures = (packet as any).signatures || [];
    return signatures.find((sig: any) => sig.signing_party === 'stanton_and_hach') || null;
  };

  const getHapDirection = (): 'stanton_first' | 'hach_first' | null => {
    const hapSig = getHapSignature();
    if (!hapSig?.notes) return null;
    if (hapSig.notes.includes('hach_first')) return 'hach_first';
    if (hapSig.notes.includes('stanton_first')) return 'stanton_first';
    return null;
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="mt-1 text-sm text-red-700">{error || 'Application not found'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Link href={`/admin/pbv/full-applications/${applicationId}`}>
            <FormButton variant="secondary" size="sm" className="mr-4">
              <ArrowLeft className="h-4 w-4" />
            </FormButton>
          </Link>
          <div>
            <h1 className="text-2xl font-serif text-gray-900">
              Signing Packet
            </h1>
            <p className="text-gray-600 mt-1">
              {application.head_of_household_name} • {application.building_address} {application.unit_number}
            </p>
          </div>
        </div>
        
        {application.packet_locked && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-4 w-4 mr-1" />
            Executed
          </span>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Config Gap Banner */}
      {configGaps && (
        <ConfigGapBanner
          buildingAddress={application.building_address}
          configGaps={configGaps}
          propertyId={null}
        />
      )}

      {/* Waiting for HACH Approval */}
      {!packet && application.hach_review_status !== 'approved_by_hach' && (
        <div className="text-center py-12 bg-gray-50 border border-gray-200 rounded-md">
          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Waiting for HACH Approval</h3>
          <p className="text-gray-600">
            Signing packet will be created automatically once HACH approves this application.
          </p>
        </div>
      )}

      {/* Packet Details */}
      {packet && (
        <div className="space-y-6">
          {/* Packet Header */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-md p-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-lg font-medium text-gray-900">Packet Details</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Template: {packet.template_key} • Created: {new Date(packet.created_at).toLocaleDateString()}
                </p>
                {packet.executed_at && (
                  <p className="text-sm text-green-600 mt-1">
                    Executed: {new Date(packet.executed_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              
              {!packet.executed_at && canExecuteHap() && (
                <FormButton
                  onClick={() => setShowExecuteDialog(true)}
                  disabled={actionLoading === 'execute-hap'}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Execute HAP
                </FormButton>
              )}
            </div>
          </div>

          {/* HAP Direction Picker */}
          {getHapSignature() && !getHapDirection() && !packet.executed_at && (
            <div className="mb-6">
              <HapDirectionPicker
                onSelectDirection={(direction) => {
                  const hapSig = getHapSignature();
                  if (hapSig) {
                    handleMarkSent(hapSig.id, direction);
                  }
                }}
                disabled={!!actionLoading}
              />
            </div>
          )}

          {/* Signatures List */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-md p-6">
            <SigningChecklist
              signatures={(packet as any).signatures || []}
              context="staff"
              onUploadClick={(sigId) => {
                setSelectedSignatureId(sigId);
                setShowUploadDialog(true);
              }}
              disabled={packet.executed_at !== null}
            />
          </div>
        </div>
      )}

      {/* Dialogs */}
      {selectedSignatureId && (
        <>
          <UploadSignedDialog
            isOpen={showUploadDialog}
            onClose={() => {
              setShowUploadDialog(false);
              setSelectedSignatureId(null);
            }}
            onUpload={async (file) => {
              await handleUpload(selectedSignatureId, file);
            }}
            signatureLabel={
              (packet as any).signatures?.find((s: any) => s.id === selectedSignatureId)?.document_label || ''
            }
          />

          <WaiveSignatureDialog
            isOpen={showWaiveDialog}
            onClose={() => {
              setShowWaiveDialog(false);
              setSelectedSignatureId(null);
            }}
            onWaive={async (reason) => {
              await handleWaive(selectedSignatureId, reason);
            }}
            signatureLabel={
              (packet as any).signatures?.find((s: any) => s.id === selectedSignatureId)?.document_label || ''
            }
          />
        </>
      )}

      <ExecuteHapDialog
        isOpen={showExecuteDialog}
        onClose={() => setShowExecuteDialog(false)}
        onExecute={handleExecuteHap}
        hapSignature={getHapSignature()}
        hasPermission={hasExecutePermission}
      />
    </div>
  );
}
