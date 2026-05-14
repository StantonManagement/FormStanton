'use client';

import { useState, useEffect, useCallback } from 'react';

interface AdminUser {
  id: string;
  display_name: string;
  is_active: boolean;
}

interface AssignDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (userId: string | null, note?: string) => void;
  currentAssigneeId: string | null;
  currentUserId: string;
  currentUserName: string;
  documentLabel: string;
  count?: number; // For bulk assignment
}

export default function AssignDialog({
  isOpen,
  onClose,
  onAssign,
  currentAssigneeId,
  currentUserId,
  currentUserName,
  documentLabel,
  count = 1,
}: AssignDialogProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const json = await res.json();
      if (json.success) {
        // Filter to active users only
        setUsers((json.data ?? []).filter((u: AdminUser) => u.is_active !== false));
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      setSearch('');
      setNote('');
    }
  }, [isOpen, fetchUsers]);

  if (!isOpen) return null;

  const filteredUsers = users.filter((u) =>
    u.display_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAssignToMe = () => {
    setSubmitting(true);
    onAssign(currentUserId, note || undefined);
    setSubmitting(false);
  };

  const handleUnassign = () => {
    setSubmitting(true);
    onAssign(null, note || undefined);
    setSubmitting(false);
  };

  const handleAssignToUser = (userId: string) => {
    setSubmitting(true);
    onAssign(userId, note || undefined);
    setSubmitting(false);
  };

  const isCurrentlyAssignedToMe = currentAssigneeId === currentUserId;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white border border-[var(--border)] w-full max-w-md shadow-xl">
        <div className="px-5 py-4 border-b border-[var(--divider)]">
          <h2 className="text-lg font-bold font-serif text-[var(--primary)]">
            {count > 1 ? `Assign ${count} documents` : `Assign — ${documentLabel}`}
          </h2>
        </div>

        <div className="p-5 space-y-4">
          {/* Assign to me quick action */}
          {!isCurrentlyAssignedToMe && (
            <button
              type="button"
              onClick={handleAssignToMe}
              disabled={submitting}
              className="w-full px-4 py-2.5 bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 text-left"
            >
              <span className="font-semibold">Assign to me</span>
              <span className="text-white/80 ml-2">— {currentUserName}</span>
            </button>
          )}

          {/* Unassign button (when currently assigned) */}
          {currentAssigneeId && (
            <button
              type="button"
              onClick={handleUnassign}
              disabled={submitting}
              className="w-full px-4 py-2.5 border border-red-300 text-red-700 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50 text-left"
            >
              Unassign
              {currentAssigneeId && (
                <span className="text-red-600/70 ml-2">
                  (currently assigned)
                </span>
              )}
            </button>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--divider)]"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="px-2 bg-white text-xs text-[var(--muted)]">or assign to</span>
            </div>
          </div>

          {/* User search */}
          <div>
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white"
            />
          </div>

          {/* User list */}
          <div className="max-h-48 overflow-y-auto border border-[var(--border)]">
            {loading ? (
              <div className="p-4 text-sm text-[var(--muted)]">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-4 text-sm text-[var(--muted)]">No users found.</div>
            ) : (
              <div className="divide-y divide-[var(--divider)]">
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleAssignToUser(user.id)}
                    disabled={submitting || user.id === currentAssigneeId}
                    className={`w-full px-4 py-2.5 text-left text-sm hover:bg-[var(--bg-section)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      user.id === currentAssigneeId ? 'bg-blue-50 text-blue-700' : ''
                    }`}
                  >
                    <span className="font-medium">{user.display_name}</span>
                    {user.id === currentAssigneeId && (
                      <span className="ml-2 text-xs text-blue-600">(currently assigned)</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Optional note */}
          <div>
            <label className="block text-xs font-medium text-[var(--ink)] mb-1">
              Note (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Add a note about this assignment..."
              className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white resize-none"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[var(--divider)] flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
