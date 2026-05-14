'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { FileText, Upload, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import UploadSignedDialog from '@/components/signing/UploadSignedDialog';

interface Signature {
  id: string;
  document_label: string;
  signing_party: string;
  plain_language_description?: string | null;
  status: string;
  conditional_note?: string | null;
  is_required: boolean;
}

interface SigningData {
  packet: {
    id: string;
    template_key: string;
    is_executed: boolean;
  } | null;
  signatures: Signature[];
  application: {
    id: string;
    head_of_household_name: string;
    building_address: string;
    unit_number: string;
  };
}

export default function TenantSigningView() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<SigningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedSignatureId, setSelectedSignatureId] = useState<string | null>(null);

  useEffect(() => {
    fetchSigningData();
  }, [token]);

  const fetchSigningData = async () => {
    try {
      const response = await fetch(`/api/tenant/pbv/${token}/signing`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to load signing data');
      }
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (signatureId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`/api/tenant/pbv/${token}/signing/${signatureId}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Upload failed');
    }

    await fetchSigningData();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-gray-400" />;
      case 'sent':
        return <AlertCircle className="h-5 w-5 text-blue-500" />;
      case 'signed':
      case 'executed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'waived':
        return <FileText className="h-5 w-5 text-yellow-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Awaiting signature';
      case 'sent':
        return 'Sent to you for signature';
      case 'signed':
        return 'Signed - pending execution';
      case 'executed':
        return 'Executed';
      case 'waived':
        return 'Waived';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <AlertCircle className="h-5 w-5 text-red-400 inline mr-2" />
          <span className="text-red-700">{error}</span>
        </div>
      </div>
    );
  }

  if (!data || !data.packet) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Signing Not Available Yet
          </h3>
          <p className="text-gray-600">
            Your application is being processed. Documents to sign will appear here once ready.
          </p>
        </div>
      </div>
    );
  }

  const completedCount = data.signatures.filter(
    s => s.status === 'signed' || s.status === 'executed' || s.status === 'waived'
  ).length;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-serif text-gray-900">Documents to Sign</h1>
        <p className="text-gray-600 mt-1">
          {data.application.head_of_household_name} • {data.application.building_address} {data.application.unit_number}
        </p>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{
                width: `${data.signatures.length > 0 ? (completedCount / data.signatures.length) * 100 : 0}%`,
              }}
            />
          </div>
          <span className="text-sm text-gray-600">
            {completedCount} of {data.signatures.length} completed
          </span>
        </div>
      </div>

      {/* Executed Notice */}
      {data.packet.is_executed && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
          <CheckCircle className="h-5 w-5 text-green-500 inline mr-2" />
          <span className="text-green-700 font-medium">
            Your lease has been executed. All documents are now in force.
          </span>
        </div>
      )}

      {/* Signatures List */}
      <div className="space-y-4">
        {data.signatures.map((signature) => (
          <div
            key={signature.id}
            className="bg-white border border-gray-200 rounded-md p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {getStatusIcon(signature.status)}
                <div>
                  <h3 className="font-medium text-gray-900">
                    {signature.document_label}
                    {signature.is_required && (
                      <span className="ml-2 text-xs text-red-600">*Required</span>
                    )}
                  </h3>
                  {signature.plain_language_description && (
                    <p className="text-sm text-gray-600 mt-1">
                      {signature.plain_language_description}
                    </p>
                  )}
                  {signature.conditional_note && (
                    <p className="text-sm text-amber-600 mt-1 italic">
                      {signature.conditional_note}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 mt-2">
                    Status: {getStatusText(signature.status)}
                  </p>
                </div>
              </div>

              {/* Actions */}
              {(signature.status === 'pending' || signature.status === 'sent') && !data.packet.is_executed && (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setSelectedSignatureId(signature.id);
                      setShowUploadDialog(true);
                    }}
                    className="px-4 py-2 text-sm border border-gray-300 bg-white hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Upload Signed PDF
                  </button>

                  {/* PRD IV: Disabled Sign in-app button */}
                  <button
                    disabled
                    className="px-4 py-2 text-sm bg-gray-200 text-gray-500 cursor-not-allowed"
                    title="Coming soon — in-app signing capability"
                  >
                    Sign in-app
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {data.signatures.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No documents require your signature at this time.
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      {selectedSignatureId && (
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
            data.signatures.find((s) => s.id === selectedSignatureId)?.document_label || ''
          }
        />
      )}
    </div>
  );
}
