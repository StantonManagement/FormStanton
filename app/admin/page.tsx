'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/admin/auth');
      const data = await response.json();
      
      if (data.isAuthenticated) {
        router.push('/admin/lobby');
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        router.push('/admin/lobby');
      } else {
        setPassword('');
        setUsername('');
        setAuthError(data.message || 'Invalid password');
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    } catch (error) {
      setAuthError('Login failed. Please try again.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdfcfa]">
        <div className="text-[var(--muted)]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fdfcfa]">
      <div
        className={`bg-white p-10 shadow-lg w-full max-w-sm border border-[var(--divider)] transition-transform duration-200 ${shake ? 'animate-shake' : ''}`}
      >
        <div className="flex justify-center mb-8">
          <img
            src="/Stanton-logo.PNG"
            alt="Stanton Management"
            className="max-w-[180px] w-full h-auto"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
        <h1 className="text-xl font-serif text-[var(--primary)] mb-6 text-center">Admin Portal</h1>
        <form onSubmit={handleLogin}>
          <div className="mb-5">
            <label htmlFor="username" className="block text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-2">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setAuthError(''); }}
              className={`w-full px-4 py-2.5 border rounded-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-colors duration-200 ${
                authError ? 'border-red-400 bg-red-50/30' : 'border-[var(--border)]'
              }`}
              placeholder="Enter username"
              autoFocus
              autoComplete="username"
              required
            />
          </div>
          <div className="mb-5">
            <label htmlFor="password" className="block text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setAuthError(''); }}
              className={`w-full px-4 py-2.5 border rounded-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-colors duration-200 ${
                authError ? 'border-red-400 bg-red-50/30' : 'border-[var(--border)]'
              }`}
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
          </div>
          {authError && (
            <div className="mb-5 p-3 bg-red-50 border-l-3 border-red-500 text-red-700 text-sm" style={{ borderLeftWidth: '3px' }}>
              <div className="font-medium">{authError}</div>
              {authError.includes('locked') && (
                <div className="text-xs mt-1 text-red-600">Too many attempts. Wait before trying again.</div>
              )}
            </div>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[var(--primary)] text-white py-2.5 px-4 rounded-none hover:bg-[var(--primary-light)] transition-colors duration-200 ease-out font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}
