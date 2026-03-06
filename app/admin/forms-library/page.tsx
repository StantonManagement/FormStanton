'use client';

import { useState, useEffect, useMemo } from 'react';
import { tenantForms, Department, departmentLabels, TenantForm, getFormsByDepartment, searchForms } from '@/lib/formsData';
import FormCard from '@/components/FormCard';
import FormDetailModal from '@/components/FormDetailModal';

export default function FormsLibraryPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeDepartment, setActiveDepartment] = useState<Department>('property_management');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedForm, setSelectedForm] = useState<TenantForm | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

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
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const departments: Department[] = ['property_management', 'maintenance', 'compliance', 'finance'];

  const displayedForms = useMemo(() => {
    if (searchQuery.trim()) {
      return searchForms(searchQuery);
    }
    return getFormsByDepartment(activeDepartment);
  }, [activeDepartment, searchQuery]);

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

        {/* Department Tabs */}
        {!searchQuery && (
          <div className="mb-6 border-b border-gray-200">
            <nav className="flex space-x-1">
              {departments.map((dept) => {
                const count = getFormsByDepartment(dept).length;
                return (
                  <button
                    key={dept}
                    onClick={() => setActiveDepartment(dept)}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeDepartment === dept
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {departmentLabels[dept]}
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                      activeDepartment === dept ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        {/* Results Header */}
        <div className="mb-4">
          {searchQuery ? (
            <h2 className="text-lg font-semibold text-gray-900">
              Search Results ({displayedForms.length} {displayedForms.length === 1 ? 'form' : 'forms'})
            </h2>
          ) : (
            <h2 className="text-lg font-semibold text-gray-900">
              {departmentLabels[activeDepartment]} ({displayedForms.length} {displayedForms.length === 1 ? 'form' : 'forms'})
            </h2>
          )}
        </div>

        {/* Forms Grid */}
        {displayedForms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedForms.map((form) => (
              <FormCard 
                key={form.id} 
                form={form} 
                onView={setSelectedForm}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500">No forms found matching your search.</p>
          </div>
        )}
      </div>

      {/* Form Detail Modal */}
      <FormDetailModal 
        form={selectedForm} 
        onClose={() => setSelectedForm(null)} 
      />
    </div>
  );
}
