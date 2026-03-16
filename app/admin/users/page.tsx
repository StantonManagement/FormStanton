'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/lib/adminAuthContext';

interface AdminUser {
  id: string;
  username: string;
  display_name: string;
  role: 'admin' | 'staff';
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export default function UsersPage() {
  const { user: currentUser } = useAdminAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create user form
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ username: '', displayName: '', password: '', role: 'staff' });
  const [creating, setCreating] = useState(false);

  // Edit user form
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({ displayName: '', role: '', newPassword: '' });
  const [updating, setUpdating] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      } else {
        setError(data.message || 'Failed to load users');
      }
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

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
        setCreateForm({ username: '', displayName: '', password: '', role: 'staff' });
        fetchUsers();
      } else {
        setError(data.message);
      }
    } catch (err) {
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
      const body: any = { userId: editingUser.id };
      if (editForm.displayName && editForm.displayName !== editingUser.display_name) body.displayName = editForm.displayName;
      if (editForm.role && editForm.role !== editingUser.role) body.role = editForm.role;
      if (editForm.newPassword) body.newPassword = editForm.newPassword;

      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setEditingUser(null);
        setEditForm({ displayName: '', role: '', newPassword: '' });
        fetchUsers();
      } else {
        setError(data.message);
      }
    } catch (err) {
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
      if (data.success) {
        fetchUsers();
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to update user');
    }
  };

  const openEdit = (user: AdminUser) => {
    setEditingUser(user);
    setEditForm({ displayName: user.display_name, role: user.role, newPassword: '' });
  };

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-serif text-[var(--primary)] mb-4">User Management</h1>
        <div className="bg-white border border-[var(--border)] p-8 text-center text-[var(--muted)]">
          Only administrators can manage users.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif text-[var(--primary)]">User Management</h1>
          <p className="text-sm text-[var(--muted)] mt-1">{users.length} users</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-[var(--primary)] text-white border border-[var(--primary)] rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out text-sm"
        >
          + New User
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      {/* User List */}
      <div className="bg-white border border-[var(--border)] overflow-hidden">
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
                <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider">Role</th>
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
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 border text-xs font-medium ${
                      u.role === 'admin'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-gray-50 text-gray-600 border-gray-200'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 border text-xs font-medium ${
                      u.is_active
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-red-50 text-red-700 border-red-200'
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
                      <button
                        onClick={() => openEdit(u)}
                        className="px-2.5 py-1 border border-[var(--border)] text-xs rounded-none hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out"
                      >
                        Edit
                      </button>
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
          <div className="bg-white border border-[var(--border)] p-6 w-full max-w-md">
            <h2 className="text-lg font-serif text-[var(--primary)] mb-4">Create New User</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--ink)] mb-1">Username (email)</label>
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
                <label className="block text-sm font-medium text-[var(--ink)] mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={createForm.displayName}
                  onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/30"
                  placeholder="First name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--ink)] mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--ink)] mb-1">Role</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/30"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
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
          <div className="bg-white border border-[var(--border)] p-6 w-full max-w-md">
            <h2 className="text-lg font-serif text-[var(--primary)] mb-1">Edit User</h2>
            <p className="text-xs text-[var(--muted)] mb-4 font-mono">{editingUser.username}</p>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--ink)] mb-1">Display Name</label>
                <input
                  type="text"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--ink)] mb-1">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/30"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--ink)] mb-1">New Password <span className="text-[var(--muted)] font-normal">(leave blank to keep current)</span></label>
                <input
                  type="password"
                  value={editForm.newPassword}
                  onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/30"
                  placeholder="Enter new password"
                />
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
