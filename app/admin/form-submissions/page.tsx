'use client';

import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import FormSubmissionQuickViewModal from '@/components/FormSubmissionQuickViewModal';
import {
  FormSubmissionStatus,
  FormPriority,
  statusLabels,
  statusColors,
  priorityColors,
  STAFF_MEMBERS,
  getFormTypeInfo,
} from '@/lib/formTypeLabels';

interface FormSubmission {
  id: string;
  form_type: string;
  tenant_name: string | null;
  building_address: string | null;
  unit_number: string | null;
  submitted_at: string;
  status: FormSubmissionStatus;
  assigned_to: string | null;
  priority: FormPriority | null;
  form_data: any;
  review_granularity?: 'atomic' | 'per_document' | null;
}

type QuickView = 'all' | 'my_queue' | 'needs_action' | 'approved_not_sent' | 'ready_for_appfolio' | 'waiting_on_tenant';

export default function FormSubmissionsPage() {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<FormSubmission[]>([]);
  const [buildings, setBuildings] = useState<string[]>([]);
  const [formTypes, setFormTypes] = useState<string[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'submitted_at',
    direction: 'desc',
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isBulkActionProcessing, setIsBulkActionProcessing] = useState(false);

  const [activeQuickView, setActiveQuickView] = useState<QuickView>('all');
  const [filters, setFilters] = useState({
    status: 'all',
    formType: 'all',
    building: 'all',
    startDate: '',
    endDate: '',
    assignedTo: 'all',
    priority: 'all',
    language: 'all',
  });

  const [statusCounts, setStatusCounts] = useState({
    pending_review: 0,
    under_review: 0,
    approved: 0,
    denied: 0,
    revision_requested: 0,
    sent_to_appfolio: 0,
    completed: 0,
  });

  useEffect(() => {
    fetchBuildings();
  }, []);

  useEffect(() => {
    fetchSubmissions();
  }, [filters, activeQuickView]);

  const fetchSubmissions = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.formType !== 'all') params.append('formType', filters.formType);
      if (filters.building !== 'all') params.append('building', filters.building);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.assignedTo !== 'all') params.append('assignedTo', filters.assignedTo);
      if (filters.priority !== 'all') params.append('priority', filters.priority);
      if (filters.language !== 'all') params.append('language', filters.language);
      if (activeQuickView !== 'all') params.append('view', activeQuickView);

      const response = await fetch(`/api/admin/form-submissions?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setSubmissions(data.data || []);
        setFilteredSubmissions(data.data || []);
        if (data.meta) {
          setStatusCounts(data.meta.statusCounts || {});
          setFormTypes(data.meta.formTypes || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
    } finally {
      setIsLoading(false);
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

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleBulkAssign = async (assignee: string) => {
    if (selectedIds.size === 0) return;

    setIsBulkActionProcessing(true);
    try {
      const response = await fetch('/api/admin/form-submissions/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          submissionIds: Array.from(selectedIds),
          value: assignee,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSelectedIds(new Set());
        fetchSubmissions();
      }
    } catch (error) {
      console.error('Bulk assign failed:', error);
    } finally {
      setIsBulkActionProcessing(false);
    }
  };

  const handleBulkMarkSentToAppfolio = async () => {
    if (selectedIds.size === 0) return;

    setIsBulkActionProcessing(true);
    try {
      const response = await fetch('/api/admin/form-submissions/bulk-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_sent_to_appfolio',
          submissionIds: Array.from(selectedIds),
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSelectedIds(new Set());
        fetchSubmissions();
      }
    } catch (error) {
      console.error('Bulk mark sent failed:', error);
    } finally {
      setIsBulkActionProcessing(false);
    }
  };

  const handleBulkExport = async () => {
    const exportIds = Array.from(selectedIds).filter((id) => {
      const sub = sortedSubmissions.find((s) => s.id === id);
      return sub?.review_granularity === 'per_document';
    });
    if (exportIds.length === 0) return;

    setIsBulkActionProcessing(true);
    try {
      const response = await fetch('/api/admin/submissions/bulk-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionIds: exportIds }),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error((json as any).message || `Export failed (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = response.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? 'bulk_export.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`Export failed: ${e.message}`);
    } finally {
      setIsBulkActionProcessing(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedSubmissions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedSubmissions.map((s) => s.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const sortedSubmissions = useMemo(() => {
    let items = [...filteredSubmissions];

    if (search.trim()) {
      const searchLower = search.toLowerCase();
      items = items.filter((sub) => {
        const tenantName = (sub.tenant_name || '').toLowerCase();
        const building = (sub.building_address || '').toLowerCase();
        const unit = (sub.unit_number || '').toLowerCase();
        const formData = sub.form_data || {};
        const phone = (formData.phone || '').toLowerCase();
        const email = (formData.email || '').toLowerCase();

        return (
          tenantName.includes(searchLower) ||
          building.includes(searchLower) ||
          unit.includes(searchLower) ||
          phone.includes(searchLower) ||
          email.includes(searchLower)
        );
      });
    }

    items.sort((a, b) => {
      const aVal = (a as any)[sortConfig.key] ?? '';
      const bVal = (b as any)[sortConfig.key] ?? '';
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return items;
  }, [filteredSubmissions, search, sortConfig]);

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

  const quickViews: { id: QuickView; label: string; count?: number }[] = [
    { id: 'all', label: 'All Submissions' },
    { id: 'needs_action', label: 'Needs Action', count: statusCounts.pending_review + statusCounts.revision_requested },
    { id: 'approved_not_sent', label: 'Approved (Not Sent)', count: statusCounts.approved },
    { id: 'ready_for_appfolio', label: 'Ready for Appfolio', count: statusCounts.approved },
    { id: 'waiting_on_tenant', label: 'Waiting on Tenant', count: statusCounts.revision_requested },
  ];

  const hasPerDocSelection = Array.from(selectedIds).some(
    (id) => sortedSubmissions.find((s) => s.id === id)?.review_granularity === 'per_document'
  );

  return (
    <>
      <Head>
        <title>Form Submissions - Stanton Management</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="w-full px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Form Submissions</h1>
          <p className="text-gray-600">Manage all tenant form submissions with workflow tracking</p>
        </div>

        <div className="mb-6 border-b border-gray-200">
          <nav className="flex space-x-1 overflow-x-auto">
            {quickViews.map((view) => (
              <button
                key={view.id}
                onClick={() => setActiveQuickView(view.id)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeQuickView === view.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {view.label}
                {view.count !== undefined && (
                  <span
                    className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                      activeQuickView === view.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {view.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="bg-white rounded-none shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Filters</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="pending_review">Pending Review</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="denied">Denied</option>
                <option value="revision_requested">Revision Requested</option>
                <option value="sent_to_appfolio">Sent to Appfolio</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Form Type</label>
              <select
                value={filters.formType}
                onChange={(e) => setFilters({ ...filters, formType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                {formTypes.map((type) => {
                  const typeInfo = getFormTypeInfo(type);
                  return (
                    <option key={type} value={type}>
                      {typeInfo.label}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Building</label>
              <select
                value={filters.building}
                onChange={(e) => setFilters({ ...filters, building: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Buildings</option>
                {buildings.map((building) => (
                  <option key={building} value={building}>
                    {building}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
              <select
                value={filters.assignedTo}
                onChange={(e) => setFilters({ ...filters, assignedTo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All</option>
                <option value="unassigned">Unassigned</option>
                {STAFF_MEMBERS.map((member) => (
                  <option key={member} value={member}>
                    {member}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
              <select
                value={filters.language}
                onChange={(e) => setFilters({ ...filters, language: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Languages</option>
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="pt">Portuguese</option>
              </select>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            Showing {sortedSubmissions.length} of {submissions.length} submissions
          </div>
        </div>

        <div className="mb-4 flex items-center gap-4">
          <div className="flex-1 relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, building, unit, phone, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white shadow-sm"
            />
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">{selectedIds.size} selected</span>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkAssign(e.target.value);
                    e.target.value = '';
                  }
                }}
                disabled={isBulkActionProcessing}
                className="px-3 py-2 border border-gray-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:opacity-50"
              >
                <option value="">Assign to...</option>
                {STAFF_MEMBERS.map((member) => (
                  <option key={member} value={member}>
                    {member}
                  </option>
                ))}
              </select>
              <button
                onClick={handleBulkMarkSentToAppfolio}
                disabled={isBulkActionProcessing}
                className="px-4 py-2 bg-purple-600 text-white rounded-none hover:bg-purple-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                Mark Sent to Appfolio
              </button>
              {hasPerDocSelection && (
                <button
                  onClick={handleBulkExport}
                  disabled={isBulkActionProcessing}
                  className="px-4 py-2 bg-gray-700 text-white rounded-none hover:bg-gray-800 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  Export ZIP
                </button>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-none shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === sortedSubmissions.length && sortedSubmissions.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <SortHeader label="Date" sortKey="submitted_at" />
                  <SortHeader label="Form Type" sortKey="form_type" />
                  <SortHeader label="Tenant" sortKey="tenant_name" />
                  <SortHeader label="Building" sortKey="building_address" />
                  <SortHeader label="Unit" sortKey="unit_number" />
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                      Loading submissions...
                    </td>
                  </tr>
                ) : sortedSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                      No submissions found matching the current filters.
                    </td>
                  </tr>
                ) : (
                  sortedSubmissions.map((submission) => {
                    const formTypeInfo = getFormTypeInfo(submission.form_type);
                    return (
                      <tr
                        key={submission.id}
                        onClick={() => setSelectedSubmission(submission)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(submission.id)}
                            onChange={() => toggleSelect(submission.id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {new Date(submission.submitted_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-none text-xs font-medium ${formTypeInfo.color}`}>
                            {formTypeInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {submission.tenant_name || 'Unknown'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{submission.building_address || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{submission.unit_number || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <span className={`px-2 py-1 rounded-none text-xs font-medium ${statusColors[submission.status]}`}>
                            {statusLabels[submission.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {submission.assigned_to || 'Unassigned'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {submission.priority && (
                            <span className={`px-2 py-1 rounded-none text-xs font-medium ${priorityColors[submission.priority]}`}>
                              {submission.priority.charAt(0).toUpperCase() + submission.priority.slice(1)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <FormSubmissionQuickViewModal
          submission={selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
          onUpdate={(updated) => {
            setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
            setSelectedSubmission(updated);
          }}
          currentUser="Admin"
        />
      </div>
    </>
  );
}
