/**
 * Properties Admin Page
 * 
 * Lists all properties with their configuration status.
 * Allows adding/editing properties for signing packet configuration.
 */

'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Building, AlertCircle } from 'lucide-react';
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

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      const response = await fetch('/api/admin/properties');
      if (!response.ok) {
        throw new Error('Failed to fetch properties');
      }
      const data = await response.json();
      setProperties(data.properties || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const hasConfigGaps = (property: Property) => {
    return property.year_built === null || property.year_built === undefined;
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

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading properties</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
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
        <div>
          <h1 className="text-2xl font-serif text-gray-900">Properties</h1>
          <p className="text-gray-600 mt-1">
            Configure building metadata for signing packet templates
          </p>
        </div>
        <Link href="/admin/properties/new">
          <FormButton>
            <Plus className="h-4 w-4 mr-2" />
            Add Property
          </FormButton>
        </Link>
      </div>

      {/* Properties List */}
      {properties.length === 0 ? (
        <div className="text-center py-12">
          <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No properties configured</h3>
          <p className="text-gray-600 mb-6">
            Add your first property to configure signing packet templates
          </p>
          <Link href="/admin/properties/new">
            <FormButton>
              <Plus className="h-4 w-4 mr-2" />
              Add Property
            </FormButton>
          </Link>
        </div>
      ) : (
        <div className="bg-white shadow-sm border border-gray-200 rounded-md">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Building Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Year Built
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Required Addenda
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Updated
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {properties.map((property) => (
                  <tr key={property.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {property.building_address}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {property.year_built || (
                          <span className="text-gray-400 italic">Not set</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {property.required_addenda?.length || 0} addenda
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {hasConfigGaps(property) ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Config gaps
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Complete
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(property.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/admin/properties/${encodeURIComponent(property.building_address)}`}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        <Edit className="h-4 w-4 inline" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Config Gaps Notice */}
      {properties.some(hasConfigGaps) && (
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Configuration gaps detected</h3>
              <p className="mt-1 text-sm text-yellow-700">
                Some properties are missing required information (e.g., year built). 
                This may affect conditional logic in signing packet templates.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
