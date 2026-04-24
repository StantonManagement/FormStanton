'use client';

import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import { Department, departmentLabels, TenantForm } from '@/lib/formsData';
import FormCard from '@/components/FormCard';
import FormDetailModal from '@/components/FormDetailModal';
import FormEditModal from '@/components/FormEditModal';

const WORKFLOW_DEPT_MAP: Array<{ workflow: string; departments: Department[] }> = [
  { workflow: 'Front Desk / Lobby', departments: ['compliance'] },
  { workflow: 'Field Operations',   departments: ['property_management', 'maintenance'] },
  { workflow: 'Back Office',        departments: ['leasing', 'collections'] },
  { workflow: 'Program Compliance', departments: ['housing_programs'] },
  { workflow: 'Administration',     departments: ['hr'] },
];

export default function FormsLibraryPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeDepartment, setActiveDepartment] = useState<Department>('leasing');
  const [searchQuery, setSearchQuery] = useState('');
  const [forms, setForms] = useState<TenantForm[]>([]);
  const [formsError, setFormsError] = useState('');
  const [isFormsLoading, setIsFormsLoading] = useState(false);
  const [selectedForm, setSelectedForm] = useState<TenantForm | null>(null);
  const [editingForm, setEditingForm] = useState<TenantForm | null>(null);
  const [isSavingForm, setIsSavingForm] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [viewMode, setViewMode] = useState<'workflow' | 'department'>('workflow');

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    void fetchForms();
  }, [isAuthenticated]);

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
      setForms([]);
      setEditingForm(null);
      setSelectedForm(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const fetchForms = async () => {
    setIsFormsLoading(true);
    setFormsError('');

    try {
      const response = await fetch('/api/admin/forms-library');
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to load forms library');
      }

      setForms(data.data || []);
    } catch (error: any) {
      setFormsError(error.message || 'Failed to load forms library');
    } finally {
      setIsFormsLoading(false);
    }
  };

  const handleSaveForm = async (updatedForm: {
    id: number;
    title: string;
    department: Department;
    description: string;
    path?: string;
    content?: string;
  }) => {
    setIsSavingForm(true);
    setSaveError('');

    try {
      const response = await fetch(`/api/admin/forms-library/${updatedForm.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: updatedForm.title,
          department: updatedForm.department,
          description: updatedForm.description,
          path: updatedForm.path ?? null,
          content: updatedForm.content ?? null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to save changes');
      }

      setForms((previousForms) =>
        previousForms.map((form) => (form.id === updatedForm.id ? { ...form, ...data.data } : form))
      );
      setEditingForm(null);
    } catch (error: any) {
      setSaveError(error.message || 'Failed to save changes');
    } finally {
      setIsSavingForm(false);
    }
  };

  const departments: Department[] = ['leasing', 'property_management', 'maintenance', 'compliance', 'housing_programs', 'collections', 'hr'];

  const workflowGroups = useMemo(() => {
    if (searchQuery.trim()) return [];
    return WORKFLOW_DEPT_MAP
      .map(({ workflow, departments: depts }) => ({
        workflow,
        forms: forms.filter((f) => depts.includes(f.department)),
      }))
      .filter((g) => g.forms.length > 0);
  }, [forms, searchQuery]);

  const displayedForms = useMemo(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      return forms.filter((form) => {
        const content = form.content?.toLowerCase() ?? '';
        return (
          form.title.toLowerCase().includes(query) ||
          form.description.toLowerCase().includes(query) ||
          content.includes(query)
        );
      });
    }

    return forms.filter((form) => form.department === activeDepartment);
  }, [activeDepartment, forms, searchQuery]);

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
    <>
      <Head>
        <title>Forms Library - Stanton Management</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img 
              src="/Stanton-logo.PNG" 
              alt="Stanton Management" 
              className="h-8 w-auto" 
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} 
            />
            <h1 className="text-2xl font-bold text-gray-900">Forms Library</h1>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/admin"
              className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Admin
            </a>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {formsError && (
          <div className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-700 rounded-none">
            {formsError}
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search all forms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* View Mode Toggle */}
        {!searchQuery && (
          <div className="mb-4 flex items-center gap-1">
            <button
              onClick={() => setViewMode('workflow')}
              className={`px-4 py-2 text-sm transition-colors rounded-none border ${
                viewMode === 'workflow'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              By Workflow
            </button>
            <button
              onClick={() => setViewMode('department')}
              className={`px-4 py-2 text-sm transition-colors rounded-none border ${
                viewMode === 'department'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              By Department
            </button>
          </div>
        )}

        {/* Department Tabs — department mode only */}
        {!searchQuery && viewMode === 'department' && (
          <div className="mb-6 border-b border-gray-200">
            <nav className="flex space-x-1 overflow-x-auto">
              {departments.map((dept) => {
                const count = forms.filter((form) => form.department === dept).length;
                return (
                  <button
                    key={dept}
                    onClick={() => setActiveDepartment(dept)}
                    className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                      activeDepartment === dept
                        ? 'border-gray-900 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {departmentLabels[dept]}
                    <span className={`ml-2 px-1.5 py-0.5 text-xs ${
                      activeDepartment === dept ? 'bg-gray-100 text-gray-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        {/* Workflow mode */}
        {!searchQuery && viewMode === 'workflow' && (
          isFormsLoading ? (
            <div className="py-12 text-center text-sm text-gray-500">Loading forms...</div>
          ) : workflowGroups.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">No forms available.</div>
          ) : (
            <>
              {workflowGroups.map(({ workflow, forms: wForms }) => (
                <div key={workflow} className="mb-8">
                  <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3 pb-2 border-b border-gray-200">
                    {workflow}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {wForms.map((form) => (
                      <FormCard
                        key={form.id}
                        form={form}
                        onView={setSelectedForm}
                        onEdit={setEditingForm}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </>
          )
        )}

        {/* Department mode or search results */}
        {(searchQuery || viewMode === 'department') && (
          <>
            <div className="mb-4">
              {searchQuery ? (
                <p className="text-sm text-gray-500">
                  {displayedForms.length} {displayedForms.length === 1 ? 'form' : 'forms'} matching &ldquo;{searchQuery}&rdquo;
                </p>
              ) : (
                <p className="text-sm text-gray-500">
                  {departmentLabels[activeDepartment]} &mdash; {displayedForms.length} {displayedForms.length === 1 ? 'form' : 'forms'}
                </p>
              )}
            </div>
            {isFormsLoading ? (
              <div className="py-12 text-center text-sm text-gray-500">Loading forms...</div>
            ) : displayedForms.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedForms.map((form) => (
                  <FormCard
                    key={form.id}
                    form={form}
                    onView={setSelectedForm}
                    onEdit={setEditingForm}
                  />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-gray-500">
                No forms found{searchQuery ? ` matching "${searchQuery}"` : ''}.
              </div>
            )}
          </>
        )}
      </div>

      {/* Form Detail Modal */}
      <FormDetailModal 
        form={selectedForm} 
        onClose={() => setSelectedForm(null)} 
      />

      <FormEditModal
        form={editingForm}
        isSaving={isSavingForm}
        saveError={saveError}
        onClose={() => {
          setEditingForm(null);
          setSaveError('');
        }}
        onSave={handleSaveForm}
      />
    </div>
    </>
  );
}
