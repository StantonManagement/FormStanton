'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/adminAuthContext';
import { Users, Plus, Eye, EyeOff } from 'lucide-react';

interface Role {
  id: string;
  name: string;
  code: string;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

interface AdminUser {
  id: string;
  username: string;
  display_name: string;
  is_active: boolean;
  is_super_admin?: boolean;
  last_login_at: string | null;
  created_at: string;
  department_id: string | null;
  departments: { id: string; name: string; code: string } | null;
  user_roles: Array<{ role_id: string; roles: { id: string; name: string; code: string } }>;
}

export default function UsersPage() {
  const { hasPermission, isSuperAdmin, startImpersonate } = useAdminAuth();
  const router = useRouter();
  const canWrite = hasPermission('user-management', 'write');
  const canAdmin = hasPermission('user-management', 'admin');
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  const handleImpersonate = async (user: AdminUser) => {
    setImpersonatingId(user.id);
    setError('');
    const result = await startImpersonate(user.id);
    if (!result.success) {
      setError(result.message ?? 'Failed to start View As');
      setImpersonatingId(null);
      return;
    }
    router.push('/admin/home');
    router.refresh();
  };

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: '', displayName: '', password: '', department_id: '', roleIds: [] as string[],
  });
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({
    displayName: '', department_id: '', newPassword: '', roleIds: [] as string[],
  });
  const [updating, setUpdating] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes, deptsRes] = await Promise.all([
        fetch('/api/admin/users').then((r) => r.json()),
        fetch('/api/admin/roles').then((r) => r.json()),
        fetch('/api/admin/departments').then((r) => r.json()),
      ]);
      if (usersRes.success) setUsers(usersRes.data);
      else setError(usersRes.message || 'Failed to load users');
      if (rolesRes.success) setRoles(rolesRes.data);
      if (deptsRes.success) setDepartments(deptsRes.data);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleRoleInList = (list: string[], id: string): string[] =>
    list.includes(id) ? list.filter((r) => r !== id) : [...list, id];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreate(false);
        setCreateForm({ username: '', displayName: '', password: '', department_id: '', roleIds: [] });
        fetchAll();
      } else {
        setError(data.message);
      }
    } catch {
      setError('Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setUpdating(true);
    setError('');
    try {
      const body: Record<string, any> = { userId: editingUser.id };
      if (editForm.displayName && editForm.displayName !== editingUser.display_name) body.displayName = editForm.displayName;
      if (editForm.department_id !== (editingUser.department_id ?? '')) body.department_id = editForm.department_id || null;
      if (editForm.newPassword) body.newPassword = editForm.newPassword;
      body.roleIds = editForm.roleIds;

      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setEditingUser(null);
        fetchAll();
      } else {
        setError(data.message);
      }
    } catch {
      setError('Failed to update user');
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleActive = async (user: AdminUser) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, isActive: !user.is_active }),
      });
      const data = await res.json();
      if (data.success) fetchAll();
      else setError(data.message);
    } catch {
      setError('Failed to update user');
    }
  };

  const openEdit = (user: AdminUser) => {
    setEditingUser(user);
    setEditForm({
      displayName: user.display_name,
      department_id: user.department_id ?? '',
      newPassword: '',
      roleIds: user.user_roles.map((ur) => ur.role_id),
    });
  };

  if (!canAdmin && !canWrite) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-serif text-[var(--primary)] mb-4">User Management</h1>
        <div className="bg-white border border-[var(--border)] p-8 text-center text-[var(--muted)]">
          You do not have permission to manage users.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif text-[var(--primary)] flex items-center gap-2">
            <Users className="w-6 h-6" /> User Management
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">{users.length} users</p>
        </div>
        {canWrite && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white text-sm rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out"
          >
            <Plus className="w-4 h-4" /> New User
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* User table */}
      <div className="bg-white border border-[var(--border)] overflow-hidden mb-6">
        {loading ? (
          <div className="p-12 text-center text-[var(--muted)]">Loading...</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-[var(--muted)]">No users found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-section)]">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Username</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Department</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Roles</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Last Login</th>
                <th className="px-4 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-[var(--divider)] hover:bg-[var(--bg)] transition-colors duration-150">
                  <td className="px-4 py-3 font-medium text-[var(--primary)]">{u.display_name}</td>
                  <td className="px-4 py-3 text-[var(--ink)] font-mono text-xs">{u.username}</td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">
                    {u.departments?.name ?? <span className="italic">None</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.user_roles.length === 0 ? (
                        <span className="text-xs text-[var(--muted)] italic">No roles</span>
                      ) : (
                        u.user_roles.map((ur) => (
                          <span key={ur.role_id} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200">
                            {ur.roles.name}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 border text-xs font-medium ${
                      u.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)] text-xs">
                    {u.last_login_at
                      ? new Date(u.last_login_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                      : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      {isSuperAdmin && u.is_active && !u.is_super_admin && (
                        <button
                          onClick={() => handleImpersonate(u)}
                          disabled={impersonatingId === u.id}
                          className="px-2.5 py-1 border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs rounded-none hover:bg-indigo-100 transition-colors duration-200 ease-out disabled:opacity-50"
                          title="See the app exactly as this user sees it. API calls will be gated by their permissions."
                        >
                          {impersonatingId === u.id ? 'Switching...' : 'View As'}
                        </button>
                      )}
                      {canWrite && (
                        <button
                          onClick={() => openEdit(u)}
                          className="px-2.5 py-1 border border-[var(--border)] text-xs rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out"
                        >
                          Edit
                        </button>
                      )}
                      {canAdmin && (
                        <button
                          onClick={() => handleToggleActive(u)}
                          className={`px-2.5 py-1 border text-xs rounded-none transition-colors duration-200 ease-out ${
                            u.is_active
                              ? 'border-red-200 text-red-600 hover:bg-red-50'
                              : 'border-green-200 text-green-600 hover:bg-green-50'
                          }`}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create User Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white border border-[var(--border)] p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-serif text-[var(--primary)] mb-4">Create New User</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-1">Username (email)</label>
                <input
                  type="text"
                  required
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/30"
                  placeholder="user@stantoncap.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={createForm.displayName}
                  onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/30"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-1">Department</label>
                <select
                  value={createForm.department_id}
                  onChange={(e) => setCreateForm({ ...createForm, department_id: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/30"
                >
                  <option value="">No department</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-2">Roles</label>
                <div className="border border-[var(--border)] divide-y divide-[var(--divider)] max-h-40 overflow-y-auto">
                  {roles.map((role) => (
                    <label key={role.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--bg)] transition-colors">
                      <input
                        type="checkbox"
                        checked={createForm.roleIds.includes(role.id)}
                        onChange={() => setCreateForm({ ...createForm, roleIds: toggleRoleInList(createForm.roleIds, role.id) })}
                        className="rounded-none"
                      />
                      <span className="text-sm text-[var(--ink)]">{role.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2 border border-[var(--border)] text-[var(--primary)] rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-[var(--primary)] text-white border border-[var(--primary)] rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out text-sm disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white border border-[var(--border)] p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-serif text-[var(--primary)] mb-1">Edit User</h2>
            <p className="text-xs text-[var(--muted)] mb-4 font-mono">{editingUser.username}</p>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-1">Display Name</label>
                <input
                  type="text"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-1">Department</label>
                <select
                  value={editForm.department_id}
                  onChange={(e) => setEditForm({ ...editForm, department_id: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/30"
                >
                  <option value="">No department</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-2">Roles</label>
                <div className="border border-[var(--border)] divide-y divide-[var(--divider)] max-h-40 overflow-y-auto">
                  {roles.map((role) => (
                    <label key={role.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--bg)] transition-colors">
                      <input
                        type="checkbox"
                        checked={editForm.roleIds.includes(role.id)}
                        onChange={() => setEditForm({ ...editForm, roleIds: toggleRoleInList(editForm.roleIds, role.id) })}
                        className="rounded-none"
                      />
                      <span className="text-sm text-[var(--ink)]">{role.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-1">
                  New Password <span className="text-[var(--muted)] normal-case font-normal">(leave blank to keep current)</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={editForm.newPassword}
                    onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/30"
                    placeholder="Enter new password"
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 px-4 py-2 border border-[var(--border)] text-[var(--primary)] rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 px-4 py-2 bg-[var(--primary)] text-white border border-[var(--primary)] rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out text-sm disabled:opacity-50"
                >
                  {updating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
