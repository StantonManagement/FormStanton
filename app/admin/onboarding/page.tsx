'use client';

import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import SubmissionDetailModal from '@/components/SubmissionDetailModal';
import { exportToExcel } from '@/lib/excelExport';

interface SubmissionPet {
  pet_type: string;
  pet_name: string;
  pet_breed: string;
  pet_weight: number | string;
  pet_color: string;
  pet_spayed: boolean;
  pet_vaccinations_current: boolean;
  pet_vaccination_file?: string | null;
  pet_photo_file?: string | null;
}

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
  pets?: SubmissionPet[] | null;
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
  additional_vehicles?: { vehicle_make: string; vehicle_model: string; vehicle_year: number | string; vehicle_color: string; vehicle_plate: string; requested_at: string }[] | null;
  pet_addendum_file?: string;
  vehicle_addendum_file?: string;
  combined_pdf?: string;
  ip_address?: string;
  user_agent?: string;
}

export default function OnboardingPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<Submission[]>([]);
  const [buildings, setBuildings] = useState<string[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [submissionSearch, setSubmissionSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'created_at', direction: 'desc' });
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [filters, setFilters] = useState({
    building: 'all',
    startDate: '',
    endDate: '',
    hasPets: 'all',
    needsInsurance: 'all',
  });

  useEffect(() => {
    fetchSubmissions();
    fetchBuildings();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [submissions, filters]);

  const fetchSubmissions = async () => {
    try {
      const response = await fetch('/api/admin/submissions');
      const data = await response.json();
      if (data.success) setSubmissions(data.data);
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
    }
  };

  const fetchBuildings = async () => {
    try {
      const response = await fetch('/api/admin/buildings');
      const data = await response.json();
      if (data.success) setBuildings(data.data);
    } catch (error) {
      console.error('Failed to fetch buildings:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...submissions];
    if (filters.building !== 'all') filtered = filtered.filter(sub => sub.building_address === filters.building);
    if (filters.startDate) { const d = new Date(filters.startDate); filtered = filtered.filter(sub => new Date(sub.created_at) >= d); }
    if (filters.endDate) { const d = new Date(filters.endDate); d.setHours(23,59,59,999); filtered = filtered.filter(sub => new Date(sub.created_at) <= d); }
    if (filters.hasPets === 'true') filtered = filtered.filter(sub => sub.has_pets === true);
    else if (filters.hasPets === 'false') filtered = filtered.filter(sub => sub.has_pets === false);
    if (filters.needsInsurance === 'true') filtered = filtered.filter(sub => sub.insurance_upload_pending === true);
    setFilteredSubmissions(filtered);
  };

  const handleExport = () => { exportToExcel(filteredSubmissions); };
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString();

  const handleDeleteSubmission = async (id: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch('/api/admin/submissions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const data = await res.json();
      if (data.success) {
        setSubmissions(prev => prev.filter(s => s.id !== id));
        setSelectedSubmission(null);
      }
    } catch (e) { console.error('Delete failed:', e); }
    setIsDeleting(false);
    setDeleteConfirm(null);
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const sortedSubmissions = useMemo(() => {
    let items = [...filteredSubmissions];
    if (submissionSearch.trim()) {
      const q = submissionSearch.toLowerCase();
      items = items.filter(s =>
        (s.full_name || '').toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.building_address || '').toLowerCase().includes(q) ||
        (s.unit_number || '').toLowerCase().includes(q)
      );
    }
    items.sort((a, b) => {
      const aVal = (a as any)[sortConfig.key] ?? '';
      const bVal = (b as any)[sortConfig.key] ?? '';
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return items;
  }, [filteredSubmissions, submissionSearch, sortConfig]);

  const SortHeader = ({ label, sortKey }: { label: string; sortKey: string }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
      onClick={() => handleSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        {sortConfig.key === sortKey ? (
          <span className="text-blue-600">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
        ) : (
          <span className="text-gray-300">▲</span>
        )}
      </span>
    </th>
  );

  const getInsuranceStatus = (submission: Submission) => {
    if (submission.insurance_file) return 'Uploaded';
    if (submission.insurance_upload_pending) return 'Pending';
    if (submission.add_insurance_to_rent) return 'Added to Rent';
    return 'N/A';
  };

  return (
    <>
      <Head>
        <title>Onboarding Submissions - Stanton Management</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="w-full px-4 py-6">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Building</label>
              <select value={filters.building} onChange={(e) => setFilters({ ...filters, building: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="all">All Buildings</option>
                {buildings.map(building => (<option key={building} value={building}>{building}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Has Pets</label>
              <select value={filters.hasPets} onChange={(e) => setFilters({ ...filters, hasPets: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="all">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Needs Insurance</label>
              <select value={filters.needsInsurance} onChange={(e) => setFilters({ ...filters, needsInsurance: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="all">All</option>
                <option value="true">Pending Upload</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-gray-600">Showing {sortedSubmissions.length} of {submissions.length} submissions</span>
          </div>
        </div>

        <div className="mb-4">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, phone, email, building, unit..."
              value={submissionSearch}
              onChange={(e) => setSubmissionSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white shadow-sm"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <SortHeader label="Date" sortKey="created_at" />
                  <SortHeader label="Name" sortKey="full_name" />
                  <SortHeader label="Phone" sortKey="phone" />
                  <SortHeader label="Email" sortKey="email" />
                  <SortHeader label="Building" sortKey="building_address" />
                  <SortHeader label="Unit" sortKey="unit_number" />
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pets</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Insurance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedSubmissions.map((submission) => (
                  <tr key={submission.id} onClick={() => setSelectedSubmission(submission)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{formatDate(submission.created_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{submission.full_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{submission.phone}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{submission.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{submission.building_address}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{submission.unit_number}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${submission.has_pets ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                        {submission.has_pets ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        submission.insurance_file ? 'bg-green-100 text-green-800'
                          : submission.insurance_upload_pending ? 'bg-yellow-100 text-yellow-800'
                          : submission.add_insurance_to_rent ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {getInsuranceStatus(submission)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${submission.has_vehicle ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                        {submission.has_vehicle ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: submission.id, name: submission.full_name }); }}
                        className="text-gray-400 hover:text-red-600 transition-colors p-1"
                        title="Delete submission"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredSubmissions.length === 0 && (
            <div className="text-center py-12 text-gray-500">No submissions found matching the current filters.</div>
          )}
        </div>

        {selectedSubmission && (
          <SubmissionDetailModal
            submission={selectedSubmission}
            onClose={() => setSelectedSubmission(null)}
            onUpdate={(updated) => {
              setSubmissions(prev => prev.map(s => s.id === updated.id ? updated : s));
              setSelectedSubmission(updated);
            }}
          />
        )}

        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Delete</h3>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to delete the submission from <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteSubmission(deleteConfirm.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
