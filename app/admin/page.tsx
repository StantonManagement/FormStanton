'use client';

import { useState, useEffect, useMemo } from 'react';
import SubmissionDetailModal from '@/components/SubmissionDetailModal';
import { exportToExcel } from '@/lib/excelExport';
import { ReimbursementSubmission } from '@/lib/types';

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

const formLinks = [
  {
    name: 'Tenant Onboarding Form',
    description: 'Pet registration, insurance, vehicle/parking info',
    path: '/form',
  },
  {
    name: 'Reimbursement Request',
    description: 'Tenant expense reimbursement with receipt upload',
    path: '/reimbursement',
  },
];

export default function AdminHub() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<Submission[]>([]);
  const [buildings, setBuildings] = useState<string[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [activeView, setActiveView] = useState<'send-form' | 'onboarding' | 'reimbursements'>('send-form');
  const [reimbursements, setReimbursements] = useState<ReimbursementSubmission[]>([]);
  const [filteredReimbursements, setFilteredReimbursements] = useState<ReimbursementSubmission[]>([]);
  const [selectedReimbursement, setSelectedReimbursement] = useState<ReimbursementSubmission | null>(null);
  const [copiedLink, setCopiedLink] = useState('');
  const [formSearch, setFormSearch] = useState('');
  const [submissionSearch, setSubmissionSearch] = useState('');
  const [reimbursementSearch, setReimbursementSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'created_at', direction: 'desc' });
  const [reimbursementSortConfig, setReimbursementSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'created_at', direction: 'desc' });
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'submission' | 'reimbursement'; id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [filters, setFilters] = useState({
    building: 'all',
    startDate: '',
    endDate: '',
    hasPets: 'all',
    needsInsurance: 'all',
  });

  const [reimbursementFilters, setReimbursementFilters] = useState({
    building: 'all',
    startDate: '',
    endDate: '',
    status: 'all',
    urgency: 'all',
  });

  const filteredFormLinks = useMemo(() => {
    if (!formSearch.trim()) return formLinks;
    const q = formSearch.toLowerCase();
    return formLinks.filter(f =>
      f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)
    );
  }, [formSearch]);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSubmissions();
      fetchBuildings();
      fetchReimbursements();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    applyFilters();
  }, [submissions, filters]);

  useEffect(() => {
    applyReimbursementFilters();
  }, [reimbursements, reimbursementFilters]);

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
      setReimbursements([]);
      setFilteredReimbursements([]);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

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

  const fetchReimbursements = async () => {
    try {
      const response = await fetch('/api/admin/reimbursements');
      const data = await response.json();
      if (data.success) setReimbursements(data.data);
    } catch (error) {
      console.error('Failed to fetch reimbursements:', error);
    }
  };

  const applyReimbursementFilters = () => {
    let filtered = [...reimbursements];
    if (reimbursementFilters.building !== 'all') filtered = filtered.filter(r => r.building_address === reimbursementFilters.building);
    if (reimbursementFilters.startDate) { const d = new Date(reimbursementFilters.startDate); filtered = filtered.filter(r => new Date(r.created_at) >= d); }
    if (reimbursementFilters.endDate) { const d = new Date(reimbursementFilters.endDate); d.setHours(23,59,59,999); filtered = filtered.filter(r => new Date(r.created_at) <= d); }
    if (reimbursementFilters.status !== 'all') filtered = filtered.filter(r => r.status === reimbursementFilters.status);
    if (reimbursementFilters.urgency !== 'all') filtered = filtered.filter(r => r.urgency === reimbursementFilters.urgency);
    setFilteredReimbursements(filtered);
  };

  const copyFormLink = (path: string) => {
    const url = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(path);
    setTimeout(() => setCopiedLink(''), 2000);
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

  const handleDeleteReimbursement = async (id: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch('/api/admin/reimbursements', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const data = await res.json();
      if (data.success) {
        setReimbursements(prev => prev.filter(r => r.id !== id));
        setSelectedReimbursement(null);
      }
    } catch (e) { console.error('Delete failed:', e); }
    setIsDeleting(false);
    setDeleteConfirm(null);
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const handleReimbursementSort = (key: string) => {
    setReimbursementSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const sortedSubmissions = useMemo(() => {
    let items = [...filteredSubmissions];
    // Text search
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
    // Sort
    items.sort((a, b) => {
      const aVal = (a as any)[sortConfig.key] ?? '';
      const bVal = (b as any)[sortConfig.key] ?? '';
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return items;
  }, [filteredSubmissions, submissionSearch, sortConfig]);

  const sortedReimbursements = useMemo(() => {
    let items = [...filteredReimbursements];
    if (reimbursementSearch.trim()) {
      const q = reimbursementSearch.toLowerCase();
      items = items.filter(r =>
        (r.tenant_name || '').toLowerCase().includes(q) ||
        (r.phone || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.building_address || '').toLowerCase().includes(q) ||
        (r.unit_number || '').toLowerCase().includes(q)
      );
    }
    items.sort((a, b) => {
      const aVal = (a as any)[reimbursementSortConfig.key] ?? '';
      const bVal = (b as any)[reimbursementSortConfig.key] ?? '';
      if (aVal < bVal) return reimbursementSortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return reimbursementSortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return items;
  }, [filteredReimbursements, reimbursementSearch, reimbursementSortConfig]);

  const SortHeader = ({ label, sortKey, config, onSort }: { label: string; sortKey: string; config: { key: string; direction: 'asc' | 'desc' }; onSort: (key: string) => void }) => (
    <th
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        {config.key === sortKey ? (
          <span className="text-blue-600">{config.direction === 'asc' ? '▲' : '▼'}</span>
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
          <div className="flex justify-center mb-6">
            <img
              src="/Stanton-logo.PNG"
              alt="Stanton Management"
              className="max-w-[200px] w-full h-auto"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">Admin Login</h1>
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
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/Stanton-logo.PNG" alt="Stanton Management" className="h-8 w-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <h1 className="text-2xl font-bold text-gray-900">Stanton Forms</h1>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors text-sm"
          >
            Logout
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex space-x-1">
            {[
              { id: 'send-form' as const, label: 'Send Form Links', count: undefined },
              { id: 'onboarding' as const, label: 'Onboarding Submissions', count: submissions.length },
              { id: 'reimbursements' as const, label: 'Reimbursement Requests', count: reimbursements.length },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeView === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                    activeView === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* ===== SEND FORM LINKS (DEFAULT) ===== */}
        {activeView === 'send-form' && (
          <div className="max-w-3xl">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold text-gray-900">Send Form Links</h2>
                <span className="text-sm text-gray-400">{filteredFormLinks.length} form{filteredFormLinks.length !== 1 ? 's' : ''}</span>
              </div>
              <p className="text-sm text-gray-500 mb-4">Click a link to copy it to your clipboard, then paste it in a text or email to send to a tenant.</p>

              {/* Search */}
              <div className="relative mb-6">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search forms..."
                  value={formSearch}
                  onChange={(e) => setFormSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              <div className="space-y-3">
                {filteredFormLinks.map((form) => (
                  <button
                    key={form.path}
                    onClick={() => copyFormLink(form.path)}
                    className={`w-full flex items-center justify-between px-5 py-4 rounded-lg border text-left transition-colors ${
                      copiedLink === form.path
                        ? 'bg-green-50 border-green-300'
                        : 'bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-300'
                    }`}
                  >
                    <div>
                      <h3 className="font-semibold text-gray-900">{form.name}</h3>
                      <p className="text-sm text-gray-500">{form.description}</p>
                      <span className="text-xs text-gray-400 font-mono mt-1 block">{form.path}</span>
                    </div>
                    {copiedLink === form.path ? (
                      <span className="text-green-600 font-medium flex items-center gap-1 text-sm flex-shrink-0 ml-4">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        Copied!
                      </span>
                    ) : (
                      <span className="text-gray-400 flex items-center gap-1 text-sm flex-shrink-0 ml-4">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                        Copy Link
                      </span>
                    )}
                  </button>
                ))}

                {filteredFormLinks.length === 0 && (
                  <div className="text-center py-8 text-gray-500">No forms match your search.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== ONBOARDING VIEW ===== */}
        {activeView === 'onboarding' && (
          <>
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
                      <SortHeader label="Date" sortKey="created_at" config={sortConfig} onSort={handleSort} />
                      <SortHeader label="Name" sortKey="full_name" config={sortConfig} onSort={handleSort} />
                      <SortHeader label="Phone" sortKey="phone" config={sortConfig} onSort={handleSort} />
                      <SortHeader label="Email" sortKey="email" config={sortConfig} onSort={handleSort} />
                      <SortHeader label="Building" sortKey="building_address" config={sortConfig} onSort={handleSort} />
                      <SortHeader label="Unit" sortKey="unit_number" config={sortConfig} onSort={handleSort} />
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pets</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Insurance</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedSubmissions.map((submission) => (
                      <tr key={submission.id} onClick={() => setSelectedSubmission(submission)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(submission.created_at)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{submission.full_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{submission.phone}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{submission.email}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{submission.building_address}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{submission.unit_number}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${submission.has_pets ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                            {submission.has_pets ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            submission.insurance_file ? 'bg-green-100 text-green-800'
                              : submission.insurance_upload_pending ? 'bg-yellow-100 text-yellow-800'
                              : submission.add_insurance_to_rent ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {getInsuranceStatus(submission)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${submission.has_vehicle ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                            {submission.has_vehicle ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'submission', id: submission.id, name: submission.full_name }); }}
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
          </>
        )}

        {/* ===== REIMBURSEMENTS VIEW ===== */}
        {activeView === 'reimbursements' && (
          <>
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Filters</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Building</label>
                  <select value={reimbursementFilters.building} onChange={(e) => setReimbursementFilters({ ...reimbursementFilters, building: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="all">All Buildings</option>
                    {buildings.map(building => (<option key={building} value={building}>{building}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" value={reimbursementFilters.startDate} onChange={(e) => setReimbursementFilters({ ...reimbursementFilters, startDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input type="date" value={reimbursementFilters.endDate} onChange={(e) => setReimbursementFilters({ ...reimbursementFilters, endDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={reimbursementFilters.status} onChange={(e) => setReimbursementFilters({ ...reimbursementFilters, status: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="denied">Denied</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Urgency</label>
                  <select value={reimbursementFilters.urgency} onChange={(e) => setReimbursementFilters({ ...reimbursementFilters, urgency: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                    <option value="all">All</option>
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 text-sm text-gray-600">
                Showing {sortedReimbursements.length} of {reimbursements.length} requests
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
                  value={reimbursementSearch}
                  onChange={(e) => setReimbursementSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white shadow-sm"
                />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <SortHeader label="Date" sortKey="created_at" config={reimbursementSortConfig} onSort={handleReimbursementSort} />
                      <SortHeader label="Tenant" sortKey="tenant_name" config={reimbursementSortConfig} onSort={handleReimbursementSort} />
                      <SortHeader label="Phone" sortKey="phone" config={reimbursementSortConfig} onSort={handleReimbursementSort} />
                      <SortHeader label="Email" sortKey="email" config={reimbursementSortConfig} onSort={handleReimbursementSort} />
                      <SortHeader label="Building" sortKey="building_address" config={reimbursementSortConfig} onSort={handleReimbursementSort} />
                      <SortHeader label="Unit" sortKey="unit_number" config={reimbursementSortConfig} onSort={handleReimbursementSort} />
                      <SortHeader label="Amount" sortKey="total_amount" config={reimbursementSortConfig} onSort={handleReimbursementSort} />
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Urgency</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortedReimbursements.map((r) => (
                      <tr key={r.id} onClick={() => setSelectedReimbursement(r)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(r.created_at)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{r.tenant_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{r.phone}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{r.email}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{r.building_address}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{r.unit_number}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">${Number(r.total_amount).toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            r.status === 'approved' ? 'bg-green-100 text-green-800'
                              : r.status === 'denied' ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {r.urgency === 'urgent' ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 flex items-center gap-1 w-fit">
                              <span className="inline-block w-2 h-2 bg-red-500 rounded-full"></span>
                              Urgent
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Normal</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: 'reimbursement', id: r.id, name: r.tenant_name }); }}
                            className="text-gray-400 hover:text-red-600 transition-colors p-1"
                            title="Delete reimbursement"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredReimbursements.length === 0 && (
                <div className="text-center py-12 text-gray-500">No reimbursement requests found matching the current filters.</div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Onboarding Detail Modal */}
      {selectedSubmission && (
        <SubmissionDetailModal
          submission={selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
        />
      )}

      {/* Reimbursement Detail Modal */}
      {selectedReimbursement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Reimbursement Request Details</h2>
              <button onClick={() => setSelectedReimbursement(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  selectedReimbursement.status === 'approved' ? 'bg-green-100 text-green-800'
                    : selectedReimbursement.status === 'denied' ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {selectedReimbursement.status.charAt(0).toUpperCase() + selectedReimbursement.status.slice(1)}
                </span>
                {selectedReimbursement.urgency === 'urgent' && (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">Urgent</span>
                )}
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2 text-sm">Tenant Information</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-gray-500">Name:</div><div className="font-medium">{selectedReimbursement.tenant_name}</div>
                  <div className="text-gray-500">Building:</div><div className="font-medium">{selectedReimbursement.building_address}</div>
                  <div className="text-gray-500">Unit:</div><div className="font-medium">{selectedReimbursement.unit_number}</div>
                  <div className="text-gray-500">Phone:</div><div className="font-medium">{selectedReimbursement.phone}</div>
                  <div className="text-gray-500">Email:</div><div className="font-medium">{selectedReimbursement.email}</div>
                  <div className="text-gray-500">Submitted:</div><div className="font-medium">{formatDate(selectedReimbursement.date_submitted)}</div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2 text-sm">Expenses</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-300">
                      <th className="text-left py-1 text-gray-500">Date</th>
                      <th className="text-left py-1 text-gray-500">Category</th>
                      <th className="text-left py-1 text-gray-500">Description</th>
                      <th className="text-right py-1 text-gray-500">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReimbursement.expenses?.map((exp: any, idx: number) => (
                      <tr key={idx} className="border-b border-gray-200">
                        <td className="py-1">{exp.date}</td>
                        <td className="py-1">{exp.category}</td>
                        <td className="py-1">{exp.description}</td>
                        <td className="py-1 text-right font-medium">${Number(exp.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-bold">
                      <td colSpan={3} className="py-2 text-right">Total:</td>
                      <td className="py-2 text-right">${Number(selectedReimbursement.total_amount).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-1 text-sm">Payment Preference</h3>
                  <p className="text-sm">{selectedReimbursement.payment_preference || '\u2014'}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-1 text-sm">Receipts</h3>
                  <p className="text-sm">{selectedReimbursement.receipt_files?.length || 0} file(s) attached</p>
                </div>
              </div>

              {selectedReimbursement.office_notes && (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <h3 className="font-semibold text-gray-900 mb-1 text-sm">Office Notes</h3>
                  <p className="text-sm">{selectedReimbursement.office_notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete {deleteConfirm.type === 'submission' ? 'Submission' : 'Reimbursement'}?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete the {deleteConfirm.type} from <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (deleteConfirm.type === 'submission') handleDeleteSubmission(deleteConfirm.id);
                  else handleDeleteReimbursement(deleteConfirm.id);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
