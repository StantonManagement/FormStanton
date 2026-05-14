'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '@/lib/adminAuthContext';
import {
  Shield,
  Users,
  Plus,
  Trash2,
  UserX,
  Eye,
  Clock,
  AlertCircle,
  CheckCircle,
  Search,
} from 'lucide-react';

interface Reviewer {
  id: string;
  username: string;
  display_name: string;
  is_active: boolean;
  last_login_at: string | null;
  assigned_at: string | null;
}

interface AccessLogEntry {
  id: string;
  user_id: string;
  user_display_name: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  accessed_at: string;
  notes: string | null;
}

interface AdminUser {
  id: string;
  username: string;
  display_name: string;
  is_active: boolean;
}

export default function PbvReviewersPage() {
  const { hasPermission } = useAdminAuth();
  const canAdmin = hasPermission('pbv-full-applications', 'admin');

  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [accessLog, setAccessLog] = useState<AccessLogEntry[]>([]);
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roleExists, setRoleExists] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'reviewers' | 'log'>('reviewers');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/pbv/reviewers?include_log=true');
      const json = await res.json();
      if (json.success) {
        setReviewers(json.data.reviewers);
        setAccessLog(json.data.recent_access);
        setRoleExists(json.data.role_exists);
      } else {
        setError(json.message || 'Failed to load data');
      }
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAllUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      const json = await res.json();
      if (json.success) {
        setAllUsers(json.data.filter((u: AdminUser) => u.is_active));
      }
    } catch {
      // Silent fail - users list is optional
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchAllUsers();
  }, [fetchData, fetchAllUsers]);

  const handleAddReviewer = async () => {
    if (!selectedUserId) return;
    setAdding(true);
    setError('');
    try {
      const res = await fetch('/api/admin/pbv/reviewers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedUserId }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddModal(false);
        setSelectedUserId('');
        setSearchTerm('');
        fetchData();
      } else {
        setError(json.message || 'Failed to add reviewer');
      }
    } catch {
      setError('Failed to add reviewer');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveReviewer = async (userId: string) => {
    if (!confirm('Remove PBV reviewer access from this user?')) return;
    setRemovingId(userId);
    setError('');
    try {
      const res = await fetch(`/api/admin/pbv/reviewers?user_id=${userId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        fetchData();
      } else {
        setError(json.message || 'Failed to remove reviewer');
      }
    } catch {
      setError('Failed to remove reviewer');
    } finally {
      setRemovingId(null);
    }
  };

  const filteredUsers = allUsers.filter(
    (u) =>
      !reviewers.some((r) => r.id === u.id) &&
      (u.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.username.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatDate = (s: string | null) => {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif text-[var(--primary)] flex items-center gap-2">
            <Shield className="w-6 h-6" /> PBV Reviewers
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Manage who can view decrypted SSNs for PBV household members.
          </p>
        </div>
        {canAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white text-sm rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out"
          >
            <Plus className="w-4 h-4" /> Add Reviewer
          </button>
        )}
      </div>

      {!roleExists && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>The PBV reviewer role has not been initialized. It will be created automatically when you add the first reviewer.</span>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto underline">Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--divider)] mb-4">
        <button
          onClick={() => setActiveTab('reviewers')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'reviewers'
              ? 'text-[var(--primary)] border-b-2 border-[var(--primary)]'
              : 'text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          <span className="flex items-center gap-2">
            <Users className="w-4 h-4" /> Reviewers ({reviewers.length})
          </span>
        </button>
        <button
          onClick={() => setActiveTab('log')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'log'
              ? 'text-[var(--primary)] border-b-2 border-[var(--primary)]'
              : 'text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          <span className="flex items-center gap-2">
            <Eye className="w-4 h-4" /> Access Log ({accessLog.length})
          </span>
        </button>
      </div>

      {/* Reviewers Tab */}
      {activeTab === 'reviewers' && (
        <div className="space-y-2">
          {loading ? (
            <div className="p-8 text-center text-[var(--muted)] border border-[var(--border)] bg-white">
              Loading...
            </div>
          ) : reviewers.length === 0 ? (
            <div className="p-8 text-center text-[var(--muted)] border border-[var(--border)] bg-white">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No PBV reviewers assigned yet.</p>
              {canAdmin && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="mt-3 text-sm text-[var(--primary)] underline"
                >
                  Add your first reviewer
                </button>
              )}
            </div>
          ) : (
            reviewers.map((reviewer) => (
              <div
                key={reviewer.id}
                className="bg-white border border-[var(--border)] px-4 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[var(--primary)]/10 rounded-none flex items-center justify-center">
                    <Shield className="w-4 h-4 text-[var(--primary)]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--ink)] text-sm">{reviewer.display_name}</span>
                      <span className="text-xs text-[var(--muted)]">@{reviewer.username}</span>
                      {!reviewer.is_active && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-200">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[var(--muted)] mt-0.5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Assigned: {formatDate(reviewer.assigned_at)}
                      </span>
                      {reviewer.last_login_at && (
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          Last login: {formatDate(reviewer.last_login_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {canAdmin && (
                  <button
                    onClick={() => handleRemoveReviewer(reviewer.id)}
                    disabled={removingId === reviewer.id}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs border border-red-200 text-red-600 hover:bg-red-50 rounded-none transition-colors disabled:opacity-50"
                  >
                    {removingId === reviewer.id ? (
                      <>
                        <UserX className="w-3 h-3" /> Removing...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3 h-3" /> Remove
                      </>
                    )}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Access Log Tab */}
      {activeTab === 'log' && (
        <div className="space-y-2">
          {loading ? (
            <div className="p-8 text-center text-[var(--muted)] border border-[var(--border)] bg-white">
              Loading...
            </div>
          ) : accessLog.length === 0 ? (
            <div className="p-8 text-center text-[var(--muted)] border border-[var(--border)] bg-white">
              <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No SSN access recorded yet.</p>
            </div>
          ) : (
            <div className="bg-white border border-[var(--border)] divide-y divide-[var(--divider)]">
              {accessLog.map((entry) => (
                <div key={entry.id} className="px-4 py-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[var(--primary)] uppercase">
                          {entry.action}
                        </span>
                        <span className="text-xs text-[var(--muted)]">
                          by {entry.user_display_name || 'Unknown'}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--muted)] mt-0.5">
                        {entry.resource_type} • {entry.resource_id.slice(0, 8)}...
                      </p>
                      {entry.notes && (
                        <p className="text-xs text-[var(--ink)] mt-1">{entry.notes}</p>
                      )}
                    </div>
                    <span className="text-xs text-[var(--muted)]">
                      {formatDate(entry.accessed_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Reviewer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
            <div className="px-5 py-3 border-b border-[var(--divider)]">
              <h2 className="text-base font-serif text-[var(--primary)]">Add PBV Reviewer</h2>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Select a user to grant access to decrypted SSNs for PBV household members.
              </p>
            </div>

            <div className="p-5 flex-1 overflow-y-auto">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)]"
                />
              </div>

              {filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-[var(--muted)] text-sm">
                  {searchTerm ? 'No matching users found' : 'All active users already have reviewer access'}
                </div>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto border border-[var(--border)] divide-y divide-[var(--divider)]">
                  {filteredUsers.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[var(--bg-section)]"
                    >
                      <input
                        type="radio"
                        name="user"
                        value={user.id}
                        checked={selectedUserId === user.id}
                        onChange={() => setSelectedUserId(user.id)}
                        className="rounded-none"
                      />
                      <div>
                        <p className="text-sm font-medium text-[var(--ink)]">{user.display_name}</p>
                        <p className="text-xs text-[var(--muted)]">@{user.username}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-[var(--divider)] flex gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedUserId('');
                  setSearchTerm('');
                }}
                className="flex-1 px-4 py-2 border border-[var(--border)] text-[var(--primary)] text-sm rounded-none hover:bg-[var(--bg-section)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddReviewer}
                disabled={!selectedUserId || adding}
                className="flex-1 px-4 py-2 bg-[var(--primary)] text-white text-sm rounded-none hover:bg-[var(--primary-light)] transition-colors disabled:opacity-50"
              >
                {adding ? 'Adding...' : 'Grant Access'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
