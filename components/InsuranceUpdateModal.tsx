'use client';

import { useState } from 'react';
import { translations, Language } from '@/lib/translations';
import { getErrorMessage } from '@/lib/errorMessage';

interface InsuranceUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

export default function InsuranceUpdateModal({ isOpen, onClose, language }: InsuranceUpdateModalProps) {
  const [step, setStep] = useState<'lookup' | 'upload'>('lookup');
  const [phone, setPhone] = useState('');
  const [buildingAddress, setBuildingAddress] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [submissionId, setSubmissionId] = useState('');
  const [submissionData, setSubmissionData] = useState<any>(null);
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const t = translations[language];

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, buildingAddress, unitNumber }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(getErrorMessage(data?.message, 'Submission not found'));
      }

      setSubmissionId(data.submission.id);
      setSubmissionData(data.submission);
      setStep('upload');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to find submission'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!insuranceFile) {
      setError('Please select a file to upload');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('submissionId', submissionId);
      formData.append('insuranceProof', insuranceFile);

      const response = await fetch('/api/update-insurance', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(getErrorMessage(data?.message, 'Upload failed'));
      }

      setSuccess(true);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to upload insurance documents'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStep('lookup');
    setPhone('');
    setBuildingAddress('');
    setUnitNumber('');
    setSubmissionId('');
    setSubmissionData(null);
    setInsuranceFile(null);
    setError('');
    setSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {language === 'en' ? 'Upload Insurance Documents' : 
             language === 'es' ? 'Subir Documentos de Seguro' : 
             'Carregar Documentos de Seguro'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-medium">
                {language === 'en' ? 'Insurance documents uploaded successfully!' :
                 language === 'es' ? '¡Documentos de seguro subidos exitosamente!' :
                 'Documentos de seguro carregados com sucesso!'}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition"
            >
              {language === 'en' ? 'Close' : language === 'es' ? 'Cerrar' : 'Fechar'}
            </button>
          </div>
        ) : step === 'lookup' ? (
          <form onSubmit={handleLookup} className="space-y-4">
            <p className="text-sm text-gray-600">
              {language === 'en' ? 'Enter your information to find your submission:' :
               language === 'es' ? 'Ingrese su información para encontrar su envío:' :
               'Insira suas informações para encontrar seu envio:'}
            </p>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">{t.phone}</span>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">{t.building}</span>
              <input
                type="text"
                required
                value={buildingAddress}
                onChange={(e) => setBuildingAddress(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">{t.unit}</span>
              <input
                type="text"
                required
                value={unitNumber}
                onChange={(e) => setUnitNumber(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
              />
            </label>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
            >
              {isLoading ? 
                (language === 'en' ? 'Searching...' : language === 'es' ? 'Buscando...' : 'Procurando...') :
                (language === 'en' ? 'Find Submission' : language === 'es' ? 'Buscar Envío' : 'Encontrar Envio')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-gray-700">
                <strong>{language === 'en' ? 'Found submission for:' : 
                         language === 'es' ? 'Envío encontrado para:' : 
                         'Envio encontrado para:'}</strong> {submissionData?.fullName}
              </p>
            </div>

            <label className="block">
              <span className="text-sm font-medium text-gray-700">{t.insuranceUpload} <span className="text-red-500">*</span></span>
              <input
                type="file"
                required
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setInsuranceFile(e.target.files?.[0] || null)}
                className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </label>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setStep('lookup')}
                className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 transition"
              >
                {language === 'en' ? 'Back' : language === 'es' ? 'Atrás' : 'Voltar'}
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
              >
                {isLoading ? 
                  (language === 'en' ? 'Uploading...' : language === 'es' ? 'Subiendo...' : 'Carregando...') :
                  (language === 'en' ? 'Upload' : language === 'es' ? 'Subir' : 'Carregar')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
