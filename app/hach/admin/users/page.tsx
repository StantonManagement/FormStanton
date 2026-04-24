'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

const COLORS = {
  accent: '#0f4c5c',
  accentLight: '#e6f0f3',
  bg: '#fafaf9',
  panel: '#ffffff',
  border: '#e7e5e4',
  borderStrong: '#d6d3d1',
  text: '#1c1917',
  textMuted: '#78716c',
  textSubtle: '#a8a29e',
  success: '#16a34a',
  successBg: '#f0fdf4',
  error: '#dc2626',
  errorBg: '#fef2f2',
  warning: '#d97706',
  warningBg: '#fffbeb',
};
const FONT = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif";
const FONT_MONO = "'IBM Plex Mono', 'Courier New', monospace";

interface HachUser {
  id: string;
  username: string;
  display_name: string;
  user_type: string;
  is_active: boolean;
  deactivated_at: string | null;
  last_login_at: string | null;
  created_at: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  user_type: string;
  invited_by: string | null;
  invited_by_name: string | null;
  expires_at: string;
  created_at: string;
}

interface ToastData { message: string; type: 'success' | 'error' }

function Toast({ toast }: { toast: ToastData | null }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, padding: '10px 18px',
      background: toast?.type === 'success' ? COLORS.success : COLORS.error,
      color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: FONT,
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      transition: 'opacity 0.25s ease, transform 0.25s ease',
      opacity: toast ? 1 : 0,
      transform: toast ? 'translateY(0)' : 'translateY(8px)',
      pointerEvents: 'none', zIndex: 200,
    }}>
      {toast?.message ?? ''}
    </div>
  );
}

function UserTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    hach_admin:    { label: 'Admin',    bg: COLORS.accentLight, color: COLORS.accent },
    hach_reviewer: { label: 'Reviewer', bg: '#f5f5f4',           color: COLORS.textMuted },
  };
  const s = map[type] ?? { label: type, bg: '#f5f5f4', color: COLORS.textMuted };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', fontSize: 11,
      fontWeight: 600, background: s.bg, color: s.color,
      letterSpacing: '0.04em', textTransform: 'uppercase' as const,
    }}>
      {s.label}
    </span>
  );
}

function StatusBadge({ active, deactivatedAt }: { active: boolean; deactivatedAt: string | null }) {
  if (!active || deactivatedAt) {
    return (
      <span style={{
        display: 'inline-block', padding: '2px 8px', fontSize: 11,
        fontWeight: 600, background: COLORS.errorBg, color: COLORS.error,
        letterSpacing: '0.04em', textTransform: 'uppercase' as const,
      }}>
        Deactivated
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', fontSize: 11,
      fontWeight: 600, background: COLORS.successBg, color: COLORS.success,
      letterSpacing: '0.04em', textTransform: 'uppercase' as const,
    }}>
      Active
    </span>
  );
}

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// ---- Invite Modal ----

function InviteModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (url: string, email: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [userType, setUserType] = useState('hach_reviewer');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/hach/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), user_type: userType }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Failed to create invitation');
        return;
      }
      onSuccess(data.data.invite_url, data.data.email);
    } catch {
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', fontSize: 13,
    border: `1px solid ${COLORS.borderStrong}`, borderRadius: 0,
    fontFamily: FONT, color: COLORS.text, backgroundColor: '#fff',
    outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 600,
    color: COLORS.textMuted, letterSpacing: '0.04em',
    textTransform: 'uppercase', marginBottom: 6,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(28,25,23,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 160, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: COLORS.panel, width: '100%', maxWidth: 420,
          boxShadow: '0 20px 50px rgba(0,0,0,0.2)', fontFamily: FONT,
        }}
      >
        <div style={{ padding: '16px 22px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Invite HACH User</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: COLORS.textMuted, lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '20px 22px' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="reviewer@hach.org"
              required
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Role</label>
            <select
              value={userType}
              onChange={(e) => setUserType(e.target.value)}
              style={inputStyle}
            >
              <option value="hach_reviewer">Reviewer</option>
              <option value="hach_admin">Admin</option>
            </select>
          </div>
          {error && (
            <div style={{ marginBottom: 14, padding: '8px 12px', background: COLORS.errorBg, color: COLORS.error, fontSize: 12, border: `1px solid #fecaca` }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: '#fff', color: COLORS.text, border: `1px solid ${COLORS.borderStrong}`, cursor: 'pointer', fontFamily: FONT, borderRadius: 0 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: COLORS.accent, color: '#fff', border: `1px solid ${COLORS.accent}`, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1, fontFamily: FONT, borderRadius: 0 }}
            >
              {submitting ? 'Sending…' : 'Create Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Invite URL Dialog (shown after successful invite) ----

function InviteUrlDialog({ url, email, onClose }: { url: string; email: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(28,25,23,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 160, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: COLORS.panel, width: '100%', maxWidth: 520,
          boxShadow: '0 20px 50px rgba(0,0,0,0.2)', fontFamily: FONT,
        }}
      >
        <div style={{ padding: '16px 22px', borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Invitation Created</div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>
            Invitation for <strong>{email}</strong>. Copy the link below and share it manually.
          </div>
        </div>
        <div style={{ padding: '20px 22px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textMuted, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>
            Invitation URL (valid 7 days)
          </div>
          <div style={{
            display: 'flex', gap: 8, alignItems: 'stretch',
          }}>
            <div style={{
              flex: 1, padding: '8px 10px', background: '#f5f5f4',
              border: `1px solid ${COLORS.border}`, fontSize: 12,
              fontFamily: FONT_MONO, color: COLORS.text,
              wordBreak: 'break-all', lineHeight: 1.5,
            }}>
              {url}
            </div>
            <button
              onClick={handleCopy}
              style={{
                padding: '8px 14px', fontSize: 12, fontWeight: 600,
                background: copied ? COLORS.success : COLORS.accent,
                color: '#fff', border: 'none', cursor: 'pointer',
                fontFamily: FONT, flexShrink: 0, borderRadius: 0,
                transition: 'background 0.15s ease',
              }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: COLORS.textMuted }}>
            The URL has been logged to the server console. Resend email integration is deferred.
          </div>
        </div>
        <div style={{ padding: '12px 22px', borderTop: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '7px 16px', fontSize: 13, fontWeight: 600, background: COLORS.accent, color: '#fff', border: 'none', cursor: 'pointer', fontFamily: FONT, borderRadius: 0 }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Deactivate Confirm Dialog ----

function DeactivateDialog({
  user,
  onConfirm,
  onCancel,
  loading,
}: {
  user: HachUser;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(28,25,23,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 160, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: COLORS.panel, width: '100%', maxWidth: 380,
          boxShadow: '0 20px 50px rgba(0,0,0,0.2)', fontFamily: FONT,
        }}
      >
        <div style={{ padding: '16px 22px', borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Deactivate user?</div>
        </div>
        <div style={{ padding: '16px 22px', fontSize: 13, color: COLORS.text, lineHeight: 1.6 }}>
          <strong>{user.display_name}</strong> ({user.username}) will no longer be able to log in.
          Their audit history is preserved. This cannot be undone from this interface.
        </div>
        <div style={{ padding: '12px 22px', borderTop: `1px solid ${COLORS.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{ padding: '7px 14px', fontSize: 13, fontWeight: 600, background: '#fff', color: COLORS.text, border: `1px solid ${COLORS.borderStrong}`, cursor: 'pointer', fontFamily: FONT, borderRadius: 0 }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{ padding: '7px 14px', fontSize: 13, fontWeight: 600, background: COLORS.error, color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, fontFamily: FONT, borderRadius: 0 }}
          >
            {loading ? 'Deactivating…' : 'Deactivate'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Main Page ----

export default function HachUsersPage() {
  const [users, setUsers] = useState<HachUser[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState('');
  const [toast, setToast] = useState<ToastData | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<{ url: string; email: string } | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<HachUser | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  const showToast = useCallback((message: string, type: ToastData['type'] = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/hach/admin/users');
      if (res.status === 403) {
        setAccessError('This page is only accessible to HACH admins.');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setUsers(data.data.users);
        setPendingInvitations(data.data.pending_invitations);
      }
    } catch {
      setAccessError('Failed to load user data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleDeactivate(user: HachUser) {
    setDeactivateLoading(true);
    // Optimistic: remove from list
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_active: false, deactivated_at: new Date().toISOString() } : u));
    try {
      const res = await fetch(`/api/hach/admin/users/${user.id}/deactivate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        // Revert
        setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_active: true, deactivated_at: null } : u));
        showToast(data.message || 'Deactivation failed', 'error');
      } else {
        showToast(`${user.display_name} deactivated`, 'success');
      }
    } catch {
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_active: true, deactivated_at: null } : u));
      showToast('Network error — deactivation not saved', 'error');
    } finally {
      setDeactivateLoading(false);
      setDeactivatingUser(null);
    }
  }

  const th: React.CSSProperties = {
    textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600,
    color: COLORS.textMuted, letterSpacing: '0.04em', textTransform: 'uppercase',
    borderBottom: `1px solid ${COLORS.borderStrong}`, whiteSpace: 'nowrap',
  };
  const td: React.CSSProperties = {
    padding: '10px 12px', fontSize: 13, color: COLORS.text,
    borderBottom: `1px solid ${COLORS.border}`, verticalAlign: 'middle',
  };

  if (loading) {
    return <div style={{ padding: '48px 32px', fontFamily: FONT, color: COLORS.textMuted, fontSize: 14 }}>Loading…</div>;
  }

  if (accessError) {
    return (
      <div style={{ padding: '48px 32px', fontFamily: FONT }}>
        <div style={{ background: COLORS.errorBg, color: COLORS.error, padding: '12px 16px', fontSize: 13, border: '1px solid #fecaca', maxWidth: 480 }}>
          {accessError}
        </div>
        <Link href="/hach" style={{ display: 'inline-block', marginTop: 16, fontSize: 13, color: COLORS.accent }}>Back to queue</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px', fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <Link href="/hach" style={{ fontSize: 12, color: COLORS.textMuted, textDecoration: 'none' }}>← Back to queue</Link>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: COLORS.text, margin: '6px 0 4px' }}>User Management</h1>
          <p style={{ fontSize: 13, color: COLORS.textMuted, margin: 0 }}>Manage HACH reviewer and admin accounts</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          style={{
            padding: '8px 18px', fontSize: 13, fontWeight: 600,
            background: COLORS.accent, color: '#fff', border: 'none',
            cursor: 'pointer', fontFamily: FONT, borderRadius: 0,
            letterSpacing: '0.02em',
          }}
        >
          + Invite User
        </button>
      </div>

      {/* Active users table */}
      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, marginBottom: 32 }}>
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${COLORS.border}`, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: COLORS.textMuted }}>
          Users ({users.length})
        </div>
        {users.length === 0 ? (
          <div style={{ padding: '24px 16px', fontSize: 13, color: COLORS.textMuted, textAlign: 'center' }}>No HACH users yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Name</th>
                  <th style={th}>Email</th>
                  <th style={th}>Role</th>
                  <th style={th}>Status</th>
                  <th style={th}>Last Login</th>
                  <th style={th}>Created</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ opacity: u.deactivated_at ? 0.6 : 1 }}>
                    <td style={{ ...td, fontWeight: 600 }}>{u.display_name}</td>
                    <td style={{ ...td, fontFamily: FONT_MONO, fontSize: 12 }}>{u.username}</td>
                    <td style={td}><UserTypeBadge type={u.user_type} /></td>
                    <td style={td}><StatusBadge active={u.is_active} deactivatedAt={u.deactivated_at} /></td>
                    <td style={{ ...td, color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 12 }}>{fmtDateTime(u.last_login_at)}</td>
                    <td style={{ ...td, color: COLORS.textMuted }}>{fmt(u.created_at)}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' as const }}>
                      {!u.deactivated_at && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => showToast('Password reset coming soon', 'error')}
                            style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, background: '#fff', color: COLORS.textMuted, border: `1px solid ${COLORS.border}`, cursor: 'pointer', fontFamily: FONT, borderRadius: 0 }}
                          >
                            Reset PW
                          </button>
                          <button
                            onClick={() => setDeactivatingUser(u)}
                            style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, background: COLORS.errorBg, color: COLORS.error, border: `1px solid #fecaca`, cursor: 'pointer', fontFamily: FONT, borderRadius: 0 }}
                          >
                            Deactivate
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending invitations */}
      {pendingInvitations.length > 0 && (
        <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}` }}>
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${COLORS.border}`, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: COLORS.textMuted }}>
            Pending Invitations ({pendingInvitations.length})
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Email</th>
                  <th style={th}>Role</th>
                  <th style={th}>Invited By</th>
                  <th style={th}>Expires</th>
                  <th style={th}>Sent</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvitations.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ ...td, fontFamily: FONT_MONO, fontSize: 12 }}>{inv.email}</td>
                    <td style={td}><UserTypeBadge type={inv.user_type} /></td>
                    <td style={{ ...td, color: COLORS.textMuted }}>{inv.invited_by_name ?? '—'}</td>
                    <td style={{ ...td, color: new Date(inv.expires_at) < new Date() ? COLORS.error : COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 12 }}>
                      {fmt(inv.expires_at)}
                    </td>
                    <td style={{ ...td, color: COLORS.textMuted }}>{fmt(inv.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={(url, email) => {
            setShowInviteModal(false);
            setInviteUrl({ url, email });
            loadData();
          }}
        />
      )}

      {inviteUrl && (
        <InviteUrlDialog
          url={inviteUrl.url}
          email={inviteUrl.email}
          onClose={() => setInviteUrl(null)}
        />
      )}

      {deactivatingUser && (
        <DeactivateDialog
          user={deactivatingUser}
          onConfirm={() => handleDeactivate(deactivatingUser)}
          onCancel={() => setDeactivatingUser(null)}
          loading={deactivateLoading}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}
