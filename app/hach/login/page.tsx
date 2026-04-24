'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const COLORS = {
  accent: '#0f4c5c',
  accentHover: '#0a3a47',
  bg: '#fafaf9',
  panel: '#ffffff',
  border: '#e7e5e4',
  borderStrong: '#d6d3d1',
  text: '#1c1917',
  textMuted: '#78716c',
  error: '#b91c1c',
  errorLight: '#fee2e2',
};
const FONT = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif";

export default function HachLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Invalid username or password');
        setLoading(false);
        return;
      }

      // Verify this is a HACH account, not Stanton staff
      const authRes = await fetch('/api/admin/auth');
      const authData = await authRes.json();

      if (
        !authData.isAuthenticated ||
        authData.user_type === 'stanton_staff' ||
        !authData.user_type
      ) {
        // Log them back out — wrong portal
        await fetch('/api/admin/auth', { method: 'DELETE' });
        setError(
          'This portal is for HACH reviewers only. Please use the Stanton admin login.'
        );
        setLoading(false);
        return;
      }

      router.push('/hach');
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: COLORS.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT,
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
        }}
      >
        {/* Logo / identity */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-block',
              background: COLORS.accent,
              color: '#fff',
              padding: '6px 16px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: 16,
            }}
          >
            HACH
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: COLORS.text, marginBottom: 6 }}>
            Reviewer Portal
          </div>
          <div style={{ fontSize: 13, color: COLORS.textMuted }}>
            Hartford Area Communities for Housing
          </div>
        </div>

        {/* Login card */}
        <div
          style={{
            background: COLORS.panel,
            border: `1px solid ${COLORS.border}`,
            padding: 32,
          }}
        >
          {error && (
            <div
              style={{
                background: COLORS.errorLight,
                color: COLORS.error,
                border: `1px solid #fecaca`,
                padding: '10px 14px',
                fontSize: 13,
                marginBottom: 20,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: COLORS.textMuted,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Email address
              </label>
              <input
                type="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="email"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  border: `1px solid ${COLORS.borderStrong}`,
                  fontSize: 14,
                  color: COLORS.text,
                  background: '#fff',
                  fontFamily: FONT,
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: COLORS.textMuted,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  border: `1px solid ${COLORS.borderStrong}`,
                  fontSize: 14,
                  color: COLORS.text,
                  background: '#fff',
                  fontFamily: FONT,
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px 0',
                background: loading ? '#6b9eab' : COLORS.accent,
                color: '#fff',
                border: 'none',
                fontSize: 14,
                fontWeight: 600,
                fontFamily: FONT,
                cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '0.02em',
                transition: 'background 200ms ease-out',
              }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <div
          style={{
            marginTop: 20,
            textAlign: 'center',
            fontSize: 12,
            color: COLORS.textMuted,
          }}
        >
          For account access, contact your HACH administrator.
        </div>
      </div>
    </div>
  );
}
