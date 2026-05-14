/**
 * Signing Surface Page
 * 
 * Staff signing interface for PBV applications.
 * Shows config-gap banners, signature status, and action buttons.
 * Disabled "Sign in-app" buttons as placeholders for future Phase V.
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  Play
} from 'lucide-react';
import Link from 'next/link';
import FormButton from '@/components/form/FormButton';

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
  const router = useRouter();
  const applicationId = params.id as string;

  const [application, setApplication] = useState<Application | null>(null);
  const [packet, setPacket] = useState<SigningPacket | null>(null);
  const [configGaps, setConfigGaps] = useState<ConfigGaps | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [applicationId]);

  const fetchData = async () => {
    try {
      // Fetch application and packet in parallel
      const [appResponse, packetResponse] = await Promise.all([
        fetch(`/api/admin/pbv/full-applications/${applicationId}`),
        fetch(`/api/signing/packets?application_id=${applicationId}`)
      ]);

      if (!appResponse.ok) {
        throw new Error('Failed to fetch application');
      }
      const appData = await appResponse.json();
      setApplication(appData);

      if (packetResponse.ok) {
        const packetData = await packetResponse.json();
        if (packetData.packet) {
          setPacket(packetData.packet);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const createPacket = async () => {
    setActionLoading('create-packet');
    try {
      const response = await fetch('/api/signing/packets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: applicationId,
          template_key: 'default_pbv'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create packet');
      }

      const data = await response.json();
      setPacket(data.packet);
      setConfigGaps(data.config_gaps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSignatureAction = async (signatureId: string, action: string, body?: any) => {
    setActionLoading(`${signatureId}-${action}`);
    try {
      const response = await fetch(`/api/signing/signatures/${signatureId}?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to perform action');
      }

      // Refresh packet data
      const packetResponse = await fetch(`/api/signing/packets?application_id=${applicationId}`);
      if (packetResponse.ok) {
        const packetData = await packetResponse.json();
        setPacket(packetData.packet);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionLoading(null);
    }
  };

  const executeHap = async () => {
    setActionLoading('execute-hap');
    try {
      const response = await fetch('/api/signing/execute-hap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: applicationId,
          direction: 'stanton_first' // Default direction
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to execute HAP');
      }

      // Refresh data
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionLoading(null);
    }
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
    
    const requiredSignatures = packet.packet_signatures?.filter(sig => sig.is_required) || [];
    const completeSignatures = requiredSignatures.filter(
      sig => ['signed', 'waived'].includes(sig.status)
    );
    
    const hapSignature = packet.packet_signatures?.find(sig => 
      sig.document_slug === 'hap_contract' && sig.signing_party === 'stanton_and_hach'
    );
    
    return completeSignatures.length === requiredSignatures.length && 
           hapSignature?.status === 'signed';
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

      {/* Config Gap Banners */}
      {configGaps && (configGaps.property_not_configured || configGaps.template_defaulted || configGaps.year_built_unknown) && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Configuration gaps detected</h3>
              <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside">
                {configGaps.property_not_configured && (
                  <li>Property not configured in system — using defaults</li>
                )}
                {configGaps.template_defaulted && (
                  <li>Using default template — no custom template configured</li>
                )}
                {configGaps.year_built_unknown && (
                  <li>Property year built unknown — conditional signatures may default to required</li>
                )}
              </ul>
              <div className="mt-3">
                <Link href="/admin/properties">
                  <FormButton variant="secondary" size="sm">
                    Configure Properties
                  </FormButton>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Packet State */}
      {!packet && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No signing packet created</h3>
          <p className="text-gray-600 mb-6">
            Create a signing packet to begin the document collection process
          </p>
          <FormButton
            onClick={createPacket}
            disabled={actionLoading === 'create-packet' || application.hach_review_status !== 'approved_by_hach'}
          >
            <Plus className="h-4 w-4 mr-2" />
            {actionLoading === 'create-packet' ? 'Creating...' : 'Create Signing Packet'}
          </FormButton>
          {application.hach_review_status !== 'approved_by_hach' && (
            <p className="mt-2 text-sm text-gray-500">
              Application must be approved by HACH before creating signing packet
            </p>
          )}
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
                  onClick={executeHap}
                  disabled={actionLoading === 'execute-hap'}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {actionLoading === 'execute-hap' ? 'Executing...' : 'Execute HAP'}
                </FormButton>
              )}
            </div>
          </div>

          {/* Signatures List */}
          <div className="bg-white shadow-sm border border-gray-200 rounded-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Signatures</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {packet.packet_signatures?.map((signature) => (
                <div key={signature.id} className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center">
                        {getStatusIcon(signature.status)}
                        <h4 className="ml-3 text-lg font-medium text-gray-900">
                          {signature.document_label}
                        </h4>
                        <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(signature.status)}`}>
                          {signature.status}
                        </span>
                        {signature.is_required && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Required
                          </span>
                        )}
                      </div>
                      
                      <p className="mt-1 text-sm text-gray-600">
                        Party: {signature.signing_party.replace(/_/g, ' ')}
                      </p>
                      
                      {signature.plain_language_description && (
                        <p className="mt-2 text-sm text-gray-700 bg-gray-50 p-3 rounded">
                          <strong>Plain language:</strong> {signature.plain_language_description}
                        </p>
                      )}
                      
                      {signature.conditional_note && (
                        <p className="mt-2 text-sm text-yellow-700 bg-yellow-50 p-3 rounded">
                          <strong>Note:</strong> {signature.conditional_note}
                        </p>
                      )}
                      
                      {signature.notes && (
                        <p className="mt-2 text-sm text-gray-600">
                          <strong>Notes:</strong> {signature.notes}
                        </p>
                      )}
                      
                      {signature.waived_reason && (
                        <p className="mt-2 text-sm text-yellow-700">
                          <strong>Waived reason:</strong> {signature.waived_reason}
                        </p>
                      )}
                    </div>
                    
                    <div className="ml-6 flex flex-col space-y-2">
                      {signature.status === 'pending' && (
                        <>
                          <FormButton
                            variant="secondary"
                            size="sm"
                            onClick={() => handleSignatureAction(signature.id, 'send')}
                            disabled={actionLoading === `${signature.id}-send`}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            {actionLoading === `${signature.id}-send` ? 'Sending...' : 'Mark Sent'}
                          </FormButton>
                          
                          {/* Placeholder "Sign in-app" button - disabled per PRD */}
                          <FormButton
                            variant="secondary"
                            size="sm"
                            disabled
                            title="Coming soon - Phase V implementation"
                          >
                            Sign in-app
                          </FormButton>
                        </>
                      )}
                      
                      {signature.status === 'sent' && (
                        <>
                          <FormButton
                            variant="secondary"
                            size="sm"
                            onClick={() => handleSignatureAction(signature.id, 'receive')}
                            disabled={actionLoading === `${signature.id}-receive`}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            {actionLoading === `${signature.id}-receive` ? 'Receiving...' : 'Mark Received'}
                          </FormButton>
                          
                          {/* Placeholder "Sign in-app" button - disabled per PRD */}
                          <FormButton
                            variant="secondary"
                            size="sm"
                            disabled
                            title="Coming soon - Phase V implementation"
                          >
                            Sign in-app
                          </FormButton>
                        </>
                      )}
                      
                      {signature.status === 'pending' && signature.is_required && (
                        <FormButton
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            const reason = prompt('Enter waiver reason:');
                            if (reason) {
                              handleSignatureAction(signature.id, 'waive', { waived_reason: reason });
                            }
                          }}
                          disabled={actionLoading === `${signature.id}-waive`}
                          className="text-yellow-600 hover:text-yellow-800"
                        >
                          <Ban className="h-4 w-4 mr-2" />
                          {actionLoading === `${signature.id}-waive` ? 'Waiving...' : 'Waive'}
                        </FormButton>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
