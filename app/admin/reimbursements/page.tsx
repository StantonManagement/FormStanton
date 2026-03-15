'use client';

import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { ReimbursementSubmission } from '@/lib/types';

export default function ReimbursementsPage() {
  const [reimbursements, setReimbursements] = useState<ReimbursementSubmission[]>([]);
  const [filteredReimbursements, setFilteredReimbursements] = useState<ReimbursementSubmission[]>([]);
  const [buildings, setBuildings] = useState<string[]>([]);
  const [selectedReimbursement, setSelectedReimbursement] = useState<ReimbursementSubmission | null>(null);
  const [reimbursementSearch, setReimbursementSearch] = useState('');
  const [reimbursementSortConfig, setReimbursementSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'created_at', direction: 'desc' });
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [reimbursementFilters, setReimbursementFilters] = useState({
    building: 'all',
    startDate: '',
    endDate: '',
    status: 'all',
    urgency: 'all',
  });

  useEffect(() => {
    fetchReimbursements();
    fetchBuildings();
  }, []);

  useEffect(() => {
    applyReimbursementFilters();
  }, [reimbursements, reimbursementFilters]);

  const fetchReimbursements = async () => {
    try {
      const response = await fetch('/api/admin/reimbursements');
      const data = await response.json();
      if (data.success) setReimbursements(data.data);
    } catch (error) {
      console.error('Failed to fetch reimbursements:', error);
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

  const applyReimbursementFilters = () => {
    let filtered = [...reimbursements];
    if (reimbursementFilters.building !== 'all') filtered = filtered.filter(r => r.building_address === reimbursementFilters.building);
    if (reimbursementFilters.startDate) { const d = new Date(reimbursementFilters.startDate); filtered = filtered.filter(r => new Date(r.created_at) >= d); }
    if (reimbursementFilters.endDate) { const d = new Date(reimbursementFilters.endDate); d.setHours(23,59,59,999); filtered = filtered.filter(r => new Date(r.created_at) <= d); }
    if (reimbursementFilters.status !== 'all') filtered = filtered.filter(r => r.status === reimbursementFilters.status);
    if (reimbursementFilters.urgency !== 'all') filtered = filtered.filter(r => r.urgency === reimbursementFilters.urgency);
    setFilteredReimbursements(filtered);
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString();

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

  const handleReimbursementSort = (key: string) => {
    setReimbursementSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

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

  const SortHeader = ({ label, sortKey }: { label: string; sortKey: string }) => (
    <th
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
      onClick={() => handleReimbursementSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        {reimbursementSortConfig.key === sortKey ? (
          <span className="text-blue-600">{reimbursementSortConfig.direction === 'asc' ? '▲' : '▼'}</span>
        ) : (
          <span className="text-gray-300">▲</span>
        )}
      </span>
    </th>
  );

  return (
    <>
      <Head>
        <title>Reimbursement Requests - Stanton Management</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="max-w-7xl mx-auto px-4 py-6">
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
                  <SortHeader label="Date" sortKey="created_at" />
                  <SortHeader label="Tenant" sortKey="tenant_name" />
                  <SortHeader label="Phone" sortKey="phone" />
                  <SortHeader label="Email" sortKey="email" />
                  <SortHeader label="Building" sortKey="building_address" />
                  <SortHeader label="Unit" sortKey="unit_number" />
                  <SortHeader label="Amount" sortKey="total_amount" />
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
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: r.id, name: r.tenant_name }); }}
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

        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Delete</h3>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to delete the reimbursement request from <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
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
                  onClick={() => handleDeleteReimbursement(deleteConfirm.id)}
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
