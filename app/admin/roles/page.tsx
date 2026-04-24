'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '@/lib/adminAuthContext';
import { ShieldCheck, Plus, ChevronDown, ChevronUp, Users } from 'lucide-react';

interface Permission {
  id: string;
  resource: string;
  action: string;
  description: string;
}

interface Role {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_system: boolean;
  user_count: number;
  departments: { id: string; name: string; code: string } | null;
  permissions: Array<{ resource: string; action: string }>;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

const RESOURCE_LABELS: Record<string, string> = {
  'home': 'Home',
  'compliance': 'Compliance',
  'projects': 'Projects',
  'pbv-preapps': 'PBV Pre-Apps',
  'lobby': 'Lobby',
  'phone-entry': 'Phone Entry',
  'appfolio-queue': 'AppFolio Queue',
  'scan-import': 'Scan Import',
  'form-submissions': 'Form Submissions',
  'onboarding': 'Onboarding',
  'reimbursements': 'Reimbursements',
  'forms-library': 'Forms Library',
  'tow-list': 'Tow List',
  'audit-log': 'Audit Log',
  'user-management': 'User Management',
  'role-management': 'Role Management',
};

const ACTION_ORDER = ['read', 'write', 'delete', 'admin'];

function groupPermissions(permissions: Permission[]) {
  const grouped: Record<string, Permission[]> = {};
  for (const p of permissions) {
    if (!grouped[p.resource]) grouped[p.resource] = [];
    grouped[p.resource].push(p);
  }
  for (const resource of Object.keys(grouped)) {
    grouped[resource].sort((a, b) => ACTION_ORDER.indexOf(a.action) - ACTION_ORDER.indexOf(b.action));
  }
  return grouped;
}

export default function RolesPage() {
  const { hasPermission } = useAdminAuth();
  const canWrite = hasPermission('role-management', 'write');
  const canDelete = hasPermission('role-management', 'delete');

  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = { name: '', code: '', description: '', department_id: '', selectedPermissions: new Set<string>() };
  const [form, setForm] = useState(emptyForm);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes, deptsRes] = await Promise.all([
        fetch('/api/admin/roles').then((r) => r.json()),
        fetch('/api/admin/permissions').then((r) => r.json()),
        fetch('/api/admin/departments').then((r) => r.json()),
      ]);
      if (rolesRes.success) setRoles(rolesRes.data);
      if (permsRes.success) setAllPermissions(permsRes.data);
      if (deptsRes.success) setDepartments(deptsRes.data);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCreate = () => {
    setForm(emptyForm);
    setShowCreate(true);
    setEditingRole(null);
  };

  const openEdit = (role: Role) => {
    const selectedIds = new Set<string>(
      allPermissions
        .filter((p) => role.permissions.some((rp) => rp.resource === p.resource && rp.action === p.action))
        .map((p) => p.id)
    );
    setForm({
      name: role.name,
      code: role.code,
      description: role.description ?? '',
      department_id: role.departments?.id ?? '',
      selectedPermissions: selectedIds,
    });
    setEditingRole(role);
    setShowCreate(false);
  };

  const togglePermission = (id: string) => {
    setForm((prev) => {
      const next = new Set(prev.selectedPermissions);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...prev, selectedPermissions: next };
    });
  };

  const toggleAllForResource = (resource: string, permIds: string[]) => {
    const allSelected = permIds.every((id) => form.selectedPermissions.has(id));
    setForm((prev) => {
      const next = new Set(prev.selectedPermissions);
      if (allSelected) permIds.forEach((id) => next.delete(id));
      else permIds.forEach((id) => next.add(id));
      return { ...prev, selectedPermissions: next };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name,
        code: form.code,
        description: form.description || null,
        department_id: form.department_id || null,
        permissions: Array.from(form.selectedPermissions),
      };
      const url = editingRole ? `/api/admin/roles/${editingRole.id}` : '/api/admin/roles';
      const method = editingRole ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!data.success) { setError(data.message); return; }
      setShowCreate(false);
      setEditingRole(null);
      fetchAll();
    } catch {
      setError('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: Role) => {
    if (!confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/roles/${role.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) { setError(data.message); return; }
      fetchAll();
    } catch {
      setError('Delete failed');
    }
  };

  const grouped = groupPermissions(allPermissions);
  const isFormOpen = showCreate || editingRole !== null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif text-[var(--primary)] flex items-center gap-2">
            <ShieldCheck className="w-6 h-6" /> Roles
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">{roles.length} roles defined</p>
        </div>
        {canWrite && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white text-sm rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out"
          >
            <Plus className="w-4 h-4" /> New Role
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Role list */}
        <div className="space-y-2">
          {loading ? (
            <div className="p-8 text-center text-[var(--muted)] border border-[var(--border)] bg-white">Loading...</div>
          ) : roles.length === 0 ? (
            <div className="p-8 text-center text-[var(--muted)] border border-[var(--border)] bg-white">No roles found.</div>
          ) : (
            roles.map((role) => (
              <div key={role.id} className="bg-white border border-[var(--border)]">
                <div className="flex items-start justify-between px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-[var(--primary)] text-sm">{role.name}</span>
                      {role.is_system && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200">SYSTEM</span>
                      )}
                      {role.departments && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 border border-gray-200">
                          {role.departments.name}
                        </span>
                      )}
                    </div>
                    {role.description && (
                      <p className="text-xs text-[var(--muted)] mt-0.5">{role.description}</p>
                    )}
                    <div className="flex items-center gap-1 mt-1 text-xs text-[var(--muted)]">
                      <Users className="w-3 h-3" />
                      <span>{role.user_count} user{role.user_count !== 1 ? 's' : ''}</span>
                      <span className="mx-1">·</span>
                      <span>{role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    {canWrite && (
                      <button
                        onClick={() => openEdit(role)}
                        className="px-2.5 py-1 text-xs border border-[var(--border)] hover:bg-[var(--bg-section)] rounded-none transition-colors duration-200"
                      >
                        Edit
                      </button>
                    )}
                    {canDelete && !role.is_system && (
                      <button
                        onClick={() => handleDelete(role)}
                        className="px-2.5 py-1 text-xs border border-red-200 text-red-600 hover:bg-red-50 rounded-none transition-colors duration-200"
                      >
                        Delete
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}
                      className="p-1 text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
                    >
                      {expandedRole === role.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {expandedRole === role.id && (
                  <div className="border-t border-[var(--divider)] px-4 py-3 bg-[var(--bg)]">
                    {role.permissions.length === 0 ? (
                      <p className="text-xs text-[var(--muted)]">No permissions assigned.</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {role.permissions.map((p, i) => (
                          <div key={i} className="text-xs text-[var(--ink)]">
                            <span className="font-medium">{RESOURCE_LABELS[p.resource] ?? p.resource}</span>
                            <span className="text-[var(--muted)]"> / {p.action}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Create / Edit form panel */}
        {isFormOpen && (
          <div className="bg-white border border-[var(--border)] p-5">
            <h2 className="text-base font-serif text-[var(--primary)] mb-4">
              {editingRole ? `Edit: ${editingRole.name}` : 'New Role'}
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
                />
              </div>
              {!editingRole && (
                <div>
                  <label className="block text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-1">Code <span className="text-[var(--muted)] normal-case">(slug, auto-lowercased)</span></label>
                  <input
                    type="text"
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/30"
                    placeholder="e.g. leasing_agent"
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
                />
              </div>
              {!(editingRole?.is_system) && (
                <div>
                  <label className="block text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-1">Department</label>
                  <select
                    value={form.department_id}
                    onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                    className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/30"
                  >
                    <option value="">Cross-department (no restriction)</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Permission matrix */}
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-2">Permissions</label>
                <div className="border border-[var(--border)] divide-y divide-[var(--divider)] max-h-80 overflow-y-auto">
                  {Object.entries(grouped).map(([resource, perms]) => {
                    const permIds = perms.map((p) => p.id);
                    const allSelected = permIds.every((id) => form.selectedPermissions.has(id));
                    return (
                      <div key={resource} className="px-3 py-2">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-[var(--ink)]">
                            {RESOURCE_LABELS[resource] ?? resource}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleAllForResource(resource, permIds)}
                            className="text-[10px] text-[var(--muted)] hover:text-[var(--primary)] transition-colors"
                          >
                            {allSelected ? 'Deselect all' : 'Select all'}
                          </button>
                        </div>
                        <div className="flex gap-3 flex-wrap">
                          {perms.map((perm) => (
                            <label key={perm.id} className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={form.selectedPermissions.has(perm.id)}
                                onChange={() => togglePermission(perm.id)}
                                className="rounded-none"
                              />
                              <span className="text-xs text-[var(--ink)] capitalize">{perm.action}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setEditingRole(null); }}
                  className="flex-1 px-4 py-2 border border-[var(--border)] text-[var(--primary)] text-sm rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-[var(--primary)] text-white text-sm rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingRole ? 'Save Changes' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
