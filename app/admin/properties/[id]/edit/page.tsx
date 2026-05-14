'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, AlertCircle } from 'lucide-react';
import FormButton from '@/components/form/FormButton';

interface Addendum {
  slug: string;
  label: string;
  signing_party: 'tenant' | 'stanton' | 'hach' | 'tenant_and_stanton' | 'stanton_and_hach';
  required: boolean;
  plain_language_description?: string;
}

interface Property {
  id: string;
  address: string;
  year_built?: number | null;
  required_addenda: Addendum[];
  created_at: string;
  updated_at: string;
}

export default function EditPropertyPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params.id as string;

  const [property, setProperty] = useState<Property | null>(null);
  const [yearBuilt, setYearBuilt] = useState<string>('');
  const [addenda, setAddenda] = useState<Addendum[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchProperty();
  }, [propertyId]);

  const fetchProperty = async () => {
    try {
      const response = await fetch(`/api/admin/properties/${propertyId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch property');
      }
      const data = await response.json();
      if (data.success) {
        setProperty(data.property);
        setYearBuilt(data.property.year_built?.toString() || '');
        setAddenda(data.property.required_addenda || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAddendum = () => {
    const newAddendum: Addendum = {
      slug: `addendum_${Date.now()}`,
      label: '',
      signing_party: 'tenant',
      required: true,
      plain_language_description: ''
    };
    setAddenda([...addenda, newAddendum]);
  };

  const handleRemoveAddendum = (index: number) => {
    setAddenda(addenda.filter((_, i) => i !== index));
  };

  const handleUpdateAddendum = (index: number, field: keyof Addendum, value: any) => {
    const updated = [...addenda];
    updated[index] = { ...updated[index], [field]: value };
    setAddenda(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setError(null);

    try {
      const response = await fetch(`/api/admin/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year_built: yearBuilt ? parseInt(yearBuilt, 10) : null,
          required_addenda: addenda
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to save property');
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <AlertCircle className="h-5 w-5 text-red-400 inline mr-2" />
          <span className="text-red-700">Property not found</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/properties"
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Properties
        </Link>
        <h1 className="text-2xl font-serif text-gray-900">{property.address}</h1>
        <p className="text-gray-600 mt-1">Configure building metadata for signing packets</p>
      </div>

      {/* Success Message */}
      {saveSuccess && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
          <span className="text-green-700">Property configuration saved successfully</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <AlertCircle className="h-5 w-5 text-red-400 inline mr-2" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Year Built */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-md p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Building Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Year Built
            </label>
            <input
              type="number"
              value={yearBuilt}
              onChange={(e) => setYearBuilt(e.target.value)}
              placeholder="e.g., 1975"
              className="w-full px-3 py-2 border border-gray-300 rounded-none focus:outline-none focus:border-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Used to determine if lead paint disclosure is required (pre-1978)
            </p>
          </div>
        </div>

        {(!yearBuilt || parseInt(yearBuilt) < 1978) && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-sm text-yellow-800">
              <AlertCircle className="h-4 w-4 inline mr-1" />
              {!yearBuilt 
                ? 'Year built is not set. Lead paint disclosure will be required by default.'
                : 'Building was constructed before 1978. Lead paint disclosure will be included in signing packets.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Required Addenda */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-md p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">Required Addenda</h2>
          <FormButton onClick={handleAddAddendum} disabled={saving}>
            <Plus className="h-4 w-4 mr-1" />
            Add Addendum
          </FormButton>
        </div>

        {addenda.length === 0 ? (
          <p className="text-gray-500 text-sm italic">
            No custom addenda. Only the standard HUD template documents will be required.
          </p>
        ) : (
          <div className="space-y-4">
            {addenda.map((addendum, index) => (
              <div key={index} className="border border-gray-200 rounded-md p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Label *
                    </label>
                    <input
                      type="text"
                      value={addendum.label}
                      onChange={(e) => handleUpdateAddendum(index, 'label', e.target.value)}
                      placeholder="e.g., Pet Addendum"
                      className="w-full px-3 py-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:border-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Slug *
                    </label>
                    <input
                      type="text"
                      value={addendum.slug}
                      onChange={(e) => handleUpdateAddendum(index, 'slug', e.target.value)}
                      placeholder="e.g., pet_addendum"
                      className="w-full px-3 py-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:border-gray-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Signing Party *
                    </label>
                    <select
                      value={addendum.signing_party}
                      onChange={(e) => handleUpdateAddendum(index, 'signing_party', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:border-gray-500"
                    >
                      <option value="tenant">Tenant</option>
                      <option value="stanton">Stanton</option>
                      <option value="hach">HACH</option>
                      <option value="tenant_and_stanton">Tenant & Stanton</option>
                      <option value="stanton_and_hach">Stanton & HACH</option>
                    </select>
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addendum.required}
                        onChange={(e) => handleUpdateAddendum(index, 'required', e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Required</span>
                    </label>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Plain Language Description
                    </label>
                    <input
                      type="text"
                      value={addendum.plain_language_description || ''}
                      onChange={(e) => handleUpdateAddendum(index, 'plain_language_description', e.target.value)}
                      placeholder="Description shown to tenants explaining what this document is for"
                      className="w-full px-3 py-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:border-gray-500"
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => handleRemoveAddendum(index)}
                    className="text-red-600 hover:text-red-800 text-sm flex items-center"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <FormButton onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Configuration'}
        </FormButton>
      </div>
    </div>
  );
}
