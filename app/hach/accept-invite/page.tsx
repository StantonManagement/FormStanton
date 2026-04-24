'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const COLORS = {
  accent: '#0f4c5c',
  bg: '#fafaf9',
  panel: '#ffffff',
  border: '#e7e5e4',
  borderStrong: '#d6d3d1',
  text: '#1c1917',
  textMuted: '#78716c',
  error: '#dc2626',
  errorBg: '#fef2f2',
  success: '#16a34a',
  successBg: '#f0fdf4',
};
const FONT = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif";

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', fontSize: 13,
  border: `1px solid ${COLORS.borderStrong}`, borderRadius: 0,
  fontFamily: FONT, color: COLORS.text, backgroundColor: '#fff',
  outline: 'none', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: COLORS.textMuted, letterSpacing: '0.04em',
  textTransform: 'uppercase', marginBottom: 6,
};

function AcceptInviteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [inviteData, setInviteData] = useState<{ email: string; user_type: string } | null>(null);
  const [tokenError, setTokenError] = useState('');
  const [validating, setValidating] = useState(true);

  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenError('No invitation token provided. Check your link and try again.');
      setValidating(false);
      return;
    }

    fetch(`/api/hach/accept-invite?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setInviteData(data.data);
        } else {
          setTokenError(data.message || 'Invalid invitation.');
        }
      })
      .catch(() => setTokenError('Network error — could not validate invitation.'))
      .finally(() => setValidating(false));
  }, [token]);

  function validatePassword(pw: string): string | null {
    if (pw.length < 12) return 'Password must be at least 12 characters';
    if (!/[a-zA-Z]/.test(pw)) return 'Password must include at least one letter';
    if (!/[0-9]/.test(pw)) return 'Password must include at least one number';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    if (displayName.trim().length < 2) {
      setFormError('Full name is required');
      return;
    }
    const pwErr = validatePassword(password);
    if (pwErr) { setFormError(pwErr); return; }
    if (password !== passwordConfirm) {
      setFormError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/hach/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, display_name: displayName.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFormError(data.message || 'Failed to create account');
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push('/hach'), 1500);
    } catch {
      setFormError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  const roleLabel: Record<string, string> = {
    hach_admin: 'HACH Admin',
    hach_reviewer: 'HACH Reviewer',
  };

  return (
    <div style={{
      minHeight: '100vh', background: COLORS.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT, padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{
          background: COLORS.accent, color: '#fff',
          padding: '14px 24px', marginBottom: 0,
          fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          HACH · Reviewer Portal
        </div>

        <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderTop: 'none' }}>
          {validating && (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: COLORS.textMuted, fontSize: 13 }}>
              Validating invitation…
            </div>
          )}

          {!validating && tokenError && (
            <div style={{ padding: '32px 24px' }}>
              <div style={{ background: COLORS.errorBg, color: COLORS.error, padding: '12px 16px', fontSize: 13, border: '1px solid #fecaca', marginBottom: 20 }}>
                {tokenError}
              </div>
              <p style={{ fontSize: 12, color: COLORS.textMuted, margin: 0 }}>
                Contact a HACH administrator to request a new invitation link.
              </p>
            </div>
          )}

          {!validating && !tokenError && inviteData && !success && (
            <div style={{ padding: '28px 24px' }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, margin: '0 0 6px' }}>
                Set up your account
              </h1>
              <p style={{ fontSize: 13, color: COLORS.textMuted, margin: '0 0 24px' }}>
                You were invited as a <strong>{roleLabel[inviteData.user_type] ?? inviteData.user_type}</strong>.
                <br />
                Account email: <span style={{ fontWeight: 600, color: COLORS.text }}>{inviteData.email}</span>
              </p>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Full name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your full name"
                    required
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 12 characters, include letters + numbers"
                    required
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Confirm password</label>
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Repeat password"
                    required
                    style={inputStyle}
                  />
                </div>

                {formError && (
                  <div style={{ marginBottom: 14, padding: '8px 12px', background: COLORS.errorBg, color: COLORS.error, fontSize: 12, border: '1px solid #fecaca' }}>
                    {formError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    width: '100%', padding: '10px 0', fontSize: 13, fontWeight: 600,
                    background: COLORS.accent, color: '#fff', border: 'none',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.6 : 1, fontFamily: FONT, borderRadius: 0,
                    letterSpacing: '0.02em',
                  }}
                >
                  {submitting ? 'Creating account…' : 'Create Account & Sign In'}
                </button>
              </form>

              <p style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 16, marginBottom: 0, lineHeight: 1.6 }}>
                Minimum 12-character password, must include at least one letter and one number.
              </p>
            </div>
          )}

          {success && (
            <div style={{ padding: '32px 24px', textAlign: 'center' }}>
              <div style={{ background: COLORS.successBg, color: COLORS.success, padding: '12px 16px', fontSize: 13, fontWeight: 600, border: '1px solid #bbf7d0' }}>
                Account created — redirecting to the portal…
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'IBM Plex Sans', sans-serif", color: '#78716c' }}>
        Loading…
      </div>
    }>
      <AcceptInviteInner />
    </Suspense>
  );
}
