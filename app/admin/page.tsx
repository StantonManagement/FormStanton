'use client';

import { useState, useEffect } from 'react';
import SubmissionDetailModal from '@/components/SubmissionDetailModal';
import { exportToExcel } from '@/lib/excelExport';

interface Submission {
  id: string;
  created_at: string;
  language: string;
  full_name: string;
  phone: string;
  email: string;
  phone_is_new: boolean;
  building_address: string;
  unit_number: string;
  has_pets: boolean;
  pet_type?: string;
  pet_name?: string;
  pet_breed?: string;
  pet_weight?: number;
  pet_color?: string;
  pet_spayed?: boolean;
  pet_vaccinations_current?: boolean;
  pet_vaccination_file?: string;
  pet_photo_file?: string;
  pet_signature?: string;
  pet_signature_date?: string;
  has_insurance: boolean;
  insurance_provider?: string;
  insurance_policy_number?: string;
  insurance_file?: string;
  insurance_upload_pending: boolean;
  add_insurance_to_rent?: boolean;
  has_vehicle: boolean;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  vehicle_color?: string;
  vehicle_plate?: string;
  vehicle_signature?: string;
  vehicle_signature_date?: string;
  pet_addendum_file?: string;
  vehicle_addendum_file?: string;
  combined_pdf?: string;
  ip_address?: string;
  user_agent?: string;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<Submission[]>([]);
  const [buildings, setBuildings] = useState<string[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  
  const [filters, setFilters] = useState({
    building: 'all',
    startDate: '',
    endDate: '',
    hasPets: 'all',
    needsInsurance: 'all',
  });

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSubmissions();
      fetchBuildings();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    applyFilters();
  }, [submissions, filters]);

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
        setPassword('');
      } else {
        setAuthError(data.message || 'Invalid password');
      }
    } catch (error) {
      setAuthError('Login failed. Please try again.');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' });
      setIsAuthenticated(false);
      setSubmissions([]);
      setFilteredSubmissions([]);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const fetchSubmissions = async () => {
    try {
      const response = await fetch('/api/admin/submissions');
      const data = await response.json();

      if (data.success) {
        setSubmissions(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
    }
  };

  const fetchBuildings = async () => {
    try {
      const response = await fetch('/api/admin/buildings');
      const data = await response.json();

      if (data.success) {
        setBuildings(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch buildings:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...submissions];

    if (filters.building !== 'all') {
      filtered = filtered.filter(sub => sub.building_address === filters.building);
    }

    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      filtered = filtered.filter(sub => new Date(sub.created_at) >= startDate);
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(sub => new Date(sub.created_at) <= endDate);
    }

    if (filters.hasPets === 'true') {
      filtered = filtered.filter(sub => sub.has_pets === true);
    } else if (filters.hasPets === 'false') {
      filtered = filtered.filter(sub => sub.has_pets === false);
    }

    if (filters.needsInsurance === 'true') {
      filtered = filtered.filter(sub => sub.insurance_upload_pending === true);
    }

    setFilteredSubmissions(filtered);
  };

  const handleExport = () => {
    exportToExcel(filteredSubmissions);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getInsuranceStatus = (submission: Submission) => {
    if (submission.insurance_file) return 'Uploaded';
    if (submission.insurance_upload_pending) return 'Pending';
    if (submission.add_insurance_to_rent) return 'Added to Rent';
    return 'N/A';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Login</h1>
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            {authError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {authError}
              </div>
            )}
            <button
              type="submit"
              className="w-full bg-gray-900 text-white py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            Logout
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Filters</h2>
            <button
              onClick={handleExport}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
            >
              <span>📊</span>
              Export to Excel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Building
              </label>
              <select
                value={filters.building}
                onChange={(e) => setFilters({ ...filters, building: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Buildings</option>
                {buildings.map(building => (
                  <option key={building} value={building}>{building}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Has Pets
              </label>
              <select
                value={filters.hasPets}
                onChange={(e) => setFilters({ ...filters, hasPets: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Needs Insurance
              </label>
              <select
                value={filters.needsInsurance}
                onChange={(e) => setFilters({ ...filters, needsInsurance: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All</option>
                <option value="true">Pending Upload</option>
              </select>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredSubmissions.length} of {submissions.length} submissions
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Building
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pets
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Insurance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vehicle
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSubmissions.map((submission) => (
                  <tr
                    key={submission.id}
                    onClick={() => setSelectedSubmission(submission)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(submission.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {submission.full_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {submission.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {submission.email}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {submission.building_address}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {submission.unit_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        submission.has_pets 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {submission.has_pets ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        submission.insurance_file 
                          ? 'bg-green-100 text-green-800'
                          : submission.insurance_upload_pending
                          ? 'bg-yellow-100 text-yellow-800'
                          : submission.add_insurance_to_rent
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {getInsuranceStatus(submission)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        submission.has_vehicle 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {submission.has_vehicle ? 'Yes' : 'No'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredSubmissions.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No submissions found matching the current filters.
            </div>
          )}
        </div>
      </div>

      {selectedSubmission && (
        <SubmissionDetailModal
          submission={selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
        />
      )}
    </div>
  );
}
