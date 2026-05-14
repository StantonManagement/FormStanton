/**
 * Property Edit Page
 * 
 * Allows editing a single property's configuration.
 * Handles building metadata and required addenda.
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Building, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import FormButton from '@/components/form/FormButton';

interface Property {
  id: string;
  building_address: string;
  year_built?: number | null;
  required_addenda: Array<{
    slug: string;
    label: string;
    signing_party: string;
    required: boolean;
    plain_language_description?: string;
  }>;
  created_at: string;
  updated_at: string;
}

interface Addendum {
  slug: string;
  label: string;
  signing_party: string;
  required: boolean;
  plain_language_description?: string;
}

const SIGNING_PARTIES = [
  { value: 'tenant', label: 'Tenant' },
  { value: 'stanton', label: 'Stanton' },
  { value: 'hach', label: 'HACH' },
  { value: 'tenant_and_stanton', label: 'Tenant & Stanton' },
  { value: 'stanton_and_hach', label: 'Stanton & HACH' }
];

export default function PropertyEditPage() {
  const params = useParams();
  const router = useRouter();
  const address = decodeURIComponent(params.address as string);

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [yearBuilt, setYearBuilt] = useState<string>('');
  const [addenda, setAddenda] = useState<Addendum[]>([]);

  useEffect(() => {
    fetchProperty();
  }, [address]);

  const fetchProperty = async () => {
    try {
      const response = await fetch(`/api/admin/properties/${encodeURIComponent(address)}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('Property not found');
          return;
        }
        throw new Error('Failed to fetch property');
      }
      const data = await response.json();
      setProperty(data);
      setYearBuilt(data.year_built?.toString() || '');
      setAddenda(data.required_addenda || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const addAddendum = () => {
    setAddenda([...addenda, {
      slug: '',
      label: '',
      signing_party: 'tenant',
      required: true,
      plain_language_description: ''
    }]);
  };

  const updateAddendum = (index: number, field: keyof Addendum, value: any) => {
    const updated = [...addenda];
    updated[index] = { ...updated[index], [field]: value };
    setAddenda(updated);
  };

  const removeAddendum = (index: number) => {
    setAddenda(addenda.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    if (!address.trim()) {
      setError('Building address is required');
      return false;
    }

    if (yearBuilt && (isNaN(Number(yearBuilt)) || Number(yearBuilt) < 1800 || Number(yearBuilt) > new Date().getFullYear() + 10)) {
      setError('Please enter a valid year built');
      return false;
    }

    for (const addendum of addenda) {
      if (!addendum.slug.trim() || !addendum.label.trim() || !addendum.signing_party) {
        setError('All addenda must have slug, label, and signing party');
        return false;
      }
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/properties/${encodeURIComponent(address)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          year_built: yearBuilt ? Number(yearBuilt) : null,
          required_addenda: addenda
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save property');
      }

      router.push('/admin/properties');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
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

  if (error && !property) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <Link href="/admin/properties">
            <FormButton variant="secondary">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Properties
            </FormButton>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <Link href="/admin/properties" className="mr-4">
            <FormButton variant="secondary" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </FormButton>
          </Link>
          <div>
            <h1 className="text-2xl font-serif text-gray-900 flex items-center">
              <Building className="h-6 w-6 mr-2" />
              {address}
            </h1>
            <p className="text-gray-600 mt-1">
              Configure building metadata for signing packets
            </p>
          </div>
        </div>
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

      {/* Form */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-md p-6">
        <div className="space-y-6">
          {/* Building Address (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Building Address
            </label>
            <input
              type="text"
              value={address}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-none bg-gray-50 text-gray-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              Building address cannot be changed
            </p>
          </div>

          {/* Year Built */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Year Built
            </label>
            <input
              type="number"
              value={yearBuilt}
              onChange={(e) => setYearBuilt(e.target.value)}
              placeholder="e.g., 1985"
              className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              Used for conditional logic (e.g., lead paint disclosure for buildings built before 1978)
            </p>
          </div>

          {/* Required Addenda */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Required Addenda
              </label>
              <FormButton
                variant="secondary"
                size="sm"
                onClick={addAddendum}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Addendum
              </FormButton>
            </div>

            {addenda.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-md">
                <p className="text-gray-500">No required addenda configured</p>
                <p className="text-sm text-gray-400 mt-1">
                  Add property-specific documents that must be signed
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {addenda.map((addendum, index) => (
                  <div key={index} className="border border-gray-200 rounded-md p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Slug
                        </label>
                        <input
                          type="text"
                          value={addendum.slug}
                          onChange={(e) => updateAddendum(index, 'slug', e.target.value)}
                          placeholder="e.g., pet_addendum"
                          className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Label
                        </label>
                        <input
                          type="text"
                          value={addendum.label}
                          onChange={(e) => updateAddendum(index, 'label', e.target.value)}
                          placeholder="e.g., Pet Addendum"
                          className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Signing Party
                        </label>
                        <select
                          value={addendum.signing_party}
                          onChange={(e) => updateAddendum(index, 'signing_party', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          {SIGNING_PARTIES.map(party => (
                            <option key={party.value} value={party.value}>
                              {party.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={addendum.required}
                            onChange={(e) => updateAddendum(index, 'required', e.target.checked)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded-none"
                          />
                          <span className="ml-2 text-sm text-gray-700">Required</span>
                        </label>
                        <FormButton
                          variant="secondary"
                          size="sm"
                          onClick={() => removeAddendum(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </FormButton>
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Plain Language Description (Optional)
                      </label>
                      <textarea
                        value={addendum.plain_language_description || ''}
                        onChange={(e) => updateAddendum(index, 'plain_language_description', e.target.value)}
                        placeholder="Explain this document in simple terms for the tenant..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
          <Link href="/admin/properties">
            <FormButton variant="secondary">
              Cancel
            </FormButton>
          </Link>
          <FormButton
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </FormButton>
        </div>
      </div>
    </div>
  );
}
