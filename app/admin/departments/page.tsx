'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '@/lib/adminAuthContext';
import { Building2, Plus, Users } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  user_count: number;
  created_at: string;
}

export default function DepartmentsPage() {
  const { hasPermission } = useAdminAuth();
  const canWrite = hasPermission('role-management', 'write');

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const emptyForm = { name: '', code: '', description: '' };
  const [form, setForm] = useState(emptyForm);

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/departments');
      const data = await res.json();
      if (data.success) setDepartments(data.data);
      else setError(data.message);
    } catch {
      setError('Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditingDept(null);
    setShowCreate(true);
  };

  const openEdit = (dept: Department) => {
    setForm({ name: dept.name, code: dept.code, description: dept.description ?? '' });
    setEditingDept(dept);
    setShowCreate(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const url = editingDept ? `/api/admin/departments/${editingDept.id}` : '/api/admin/departments';
      const method = editingDept ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, code: form.code, description: form.description || null }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.message); return; }
      setShowCreate(false);
      setEditingDept(null);
      fetchDepartments();
    } catch {
      setError('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (dept: Department) => {
    try {
      const res = await fetch(`/api/admin/departments/${dept.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !dept.is_active }),
      });
      const data = await res.json();
      if (!data.success) setError(data.message);
      else fetchDepartments();
    } catch {
      setError('Update failed');
    }
  };

  const isFormOpen = showCreate || editingDept !== null;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif text-[var(--primary)] flex items-center gap-2">
            <Building2 className="w-6 h-6" /> Departments
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">{departments.length} departments</p>
        </div>
        {canWrite && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white text-sm rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out"
          >
            <Plus className="w-4 h-4" /> New Department
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* List */}
        <div className="space-y-2">
          {loading ? (
            <div className="p-8 text-center text-[var(--muted)] border border-[var(--border)] bg-white">Loading...</div>
          ) : departments.length === 0 ? (
            <div className="p-8 text-center text-[var(--muted)] border border-[var(--border)] bg-white">No departments found.</div>
          ) : (
            departments.map((dept) => (
              <div key={dept.id} className={`bg-white border border-[var(--border)] px-4 py-3 ${!dept.is_active ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--primary)] text-sm">{dept.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-gray-100 text-gray-500 border border-gray-200">{dept.code}</span>
                      {!dept.is_active && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 border border-gray-200">INACTIVE</span>
                      )}
                    </div>
                    {dept.description && (
                      <p className="text-xs text-[var(--muted)] mt-0.5">{dept.description}</p>
                    )}
                    <div className="flex items-center gap-1 mt-1 text-xs text-[var(--muted)]">
                      <Users className="w-3 h-3" />
                      <span>{dept.user_count} active user{dept.user_count !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  {canWrite && (
                    <div className="flex gap-2 shrink-0 ml-3">
                      <button
                        onClick={() => openEdit(dept)}
                        className="px-2.5 py-1 text-xs border border-[var(--border)] hover:bg-[var(--bg-section)] rounded-none transition-colors duration-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(dept)}
                        className={`px-2.5 py-1 text-xs border rounded-none transition-colors duration-200 ${
                          dept.is_active
                            ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                            : 'border-green-200 text-green-700 hover:bg-green-50'
                        }`}
                      >
                        {dept.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create / Edit form */}
        {isFormOpen && (
          <div className="bg-white border border-[var(--border)] p-5">
            <h2 className="text-base font-serif text-[var(--primary)] mb-4">
              {editingDept ? `Edit: ${editingDept.name}` : 'New Department'}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/30"
                  placeholder="e.g. Leasing"
                />
              </div>
              {!editingDept && (
                <div>
                  <label className="block text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-1">Code <span className="text-[var(--muted)] normal-case">(slug)</span></label>
                  <input
                    type="text"
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/30"
                    placeholder="e.g. leasing"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/30"
                  placeholder="Optional description"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setEditingDept(null); }}
                  className="flex-1 px-4 py-2 border border-[var(--border)] text-[var(--primary)] text-sm rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-[var(--primary)] text-white text-sm rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingDept ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
