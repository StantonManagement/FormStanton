'use client';

/**
 * Segment-level error boundary for /t/[token]/* — catches errors thrown by
 * TokenRouter before it redirects to /pbv-full-app/[token].
 *
 * Same UI/behavior as /pbv-full-app/[token]/error.tsx and global-error.tsx:
 * surface message + digest + stack on screen and POST to /api/log/client-error.
 */

import { useEffect } from 'react';

export default function TenantTokenSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      const payload = {
        when: 't-segment',
        message: error?.message ?? 'unknown',
        stack: error?.stack ?? '',
        digest: error?.digest ?? '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        url: typeof window !== 'undefined' ? window.location.href : '',
      };
      fetch('/api/log/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* never throw from the boundary */
    }
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '24px',
        background: '#f5f5f0',
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#1a1a2e',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          maxWidth: 640,
          margin: '0 auto',
          background: '#fff',
          border: '1px solid #d4d0c8',
          padding: 20,
        }}
      >
        <h1 style={{ fontSize: 18, margin: '0 0 12px', fontWeight: 700 }}>
          Something went wrong loading this page
        </h1>
        <p style={{ fontSize: 13, margin: '0 0 16px', color: '#444' }}>
          The team has been notified. If this is urgent, call (860) 527-3813.
        </p>

        <div
          style={{
            fontSize: 12,
            background: '#faf9f5',
            border: '1px solid #e6e2d8',
            padding: 12,
            margin: '0 0 16px',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          }}
        >
          <div>
            <strong>message:</strong> {error?.message ?? '(no message)'}
          </div>
          {error?.digest ? (
            <div>
              <strong>digest:</strong> {error.digest}
            </div>
          ) : null}
          {error?.stack ? (
            <div style={{ marginTop: 8 }}>
              <strong>stack:</strong>
              {'\n'}
              {error.stack}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => reset()}
          style={{
            display: 'inline-block',
            padding: '10px 16px',
            background: '#1a1a2e',
            color: '#fff',
            border: 'none',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
