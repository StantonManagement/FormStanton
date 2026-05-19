'use client';

/**
 * components/pbv/DebugErrorOverlay.tsx
 *
 * On-page error capture for diagnosing client-side exceptions on devices
 * without DevTools access (e.g., iPhone Edge). Gated behind ?debug=1 in the
 * URL — completely invisible and inert without the flag.
 *
 * Captures:
 *   - window 'error' events (sync JS errors)
 *   - window 'unhandledrejection' events (promise rejections)
 *   - failing fetch() calls (status >= 400 or network failure)
 *
 * Renders a fixed bottom panel listing the last 20 entries with
 * copy-to-clipboard, clear, and dismiss controls.
 *
 * Remove this component once the underlying bug is identified.
 */

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type Entry = {
  id: number;
  kind: 'error' | 'rejection' | 'fetch';
  ts: string;
  title: string;
  detail: string;
};

function DebugErrorOverlayInner() {
  const search = useSearchParams();
  const enabled = search?.get('debug') === '1';

  const [entries, setEntries] = useState<Entry[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const idRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const push = (kind: Entry['kind'], title: string, detail: string) => {
      idRef.current += 1;
      const entry: Entry = {
        id: idRef.current,
        kind,
        ts: new Date().toISOString(),
        title,
        detail,
      };
      setEntries((prev) => [entry, ...prev].slice(0, 20));
      setDismissed(false);
    };

    const handleError = (event: ErrorEvent) => {
      const stack = event.error?.stack ?? '';
      const where = `${event.filename ?? '?'}:${event.lineno ?? '?'}:${event.colno ?? '?'}`;
      push('error', event.message || 'window error', `${where}\n${stack}`);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg = reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? reason.stack ?? '' : '';
      push('rejection', msg || 'unhandled rejection', stack);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    // Monkey-patch fetch to record failures
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const input = args[0];
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
          ? input.toString()
          : input instanceof Request
          ? input.url
          : String(input);
      try {
        const res = await originalFetch(...args);
        if (!res.ok) {
          push('fetch', `${res.status} ${res.statusText || ''}`, url);
        }
        return res;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        push('fetch', 'network error', `${url}\n${msg}`);
        throw err;
      }
    };

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      window.fetch = originalFetch;
    };
  }, [enabled]);

  if (!enabled) return null;
  if (dismissed) {
    return (
      <button
        type="button"
        onClick={() => setDismissed(false)}
        style={{
          position: 'fixed',
          bottom: 8,
          right: 8,
          zIndex: 99999,
          background: '#000',
          color: '#0f0',
          fontFamily: 'monospace',
          fontSize: 12,
          padding: '6px 10px',
          border: '1px solid #0f0',
        }}
      >
        debug ({entries.length})
      </button>
    );
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore — clipboard may be unavailable in some browsers
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: '50vh',
        overflow: 'auto',
        zIndex: 99999,
        background: '#000',
        color: '#0f0',
        fontFamily: 'monospace',
        fontSize: 12,
        padding: 8,
        borderTop: '2px solid #0f0',
      }}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
        <strong style={{ color: '#fff' }}>DEBUG OVERLAY</strong>
        <span style={{ color: '#888' }}>({entries.length})</span>
        <button
          type="button"
          onClick={() => setEntries([])}
          style={{ marginLeft: 'auto', background: 'transparent', color: '#0f0', border: '1px solid #0f0', padding: '2px 8px' }}
        >
          clear
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          style={{ background: 'transparent', color: '#0f0', border: '1px solid #0f0', padding: '2px 8px' }}
        >
          hide
        </button>
        <button
          type="button"
          onClick={() =>
            copy(
              entries
                .map((e) => `[${e.ts}] ${e.kind}: ${e.title}\n${e.detail}`)
                .join('\n\n---\n\n')
            )
          }
          style={{ background: 'transparent', color: '#0f0', border: '1px solid #0f0', padding: '2px 8px' }}
        >
          copy all
        </button>
      </div>

      {entries.length === 0 && (
        <div style={{ color: '#888' }}>
          No errors captured yet. Reproduce the issue; entries will appear here.
        </div>
      )}

      {entries.map((e) => (
        <div
          key={e.id}
          style={{
            borderTop: '1px dashed #333',
            paddingTop: 6,
            paddingBottom: 6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          <div style={{ color: '#ff0' }}>
            [{e.ts}] {e.kind}: {e.title}
          </div>
          <div style={{ color: '#0f0' }}>{e.detail}</div>
          <button
            type="button"
            onClick={() => copy(`[${e.ts}] ${e.kind}: ${e.title}\n${e.detail}`)}
            style={{
              marginTop: 4,
              background: 'transparent',
              color: '#0f0',
              border: '1px solid #0f0',
              padding: '1px 6px',
              fontSize: 11,
            }}
          >
            copy
          </button>
        </div>
      ))}
    </div>
  );
}

export default function DebugErrorOverlay() {
  return (
    <Suspense fallback={null}>
      <DebugErrorOverlayInner />
    </Suspense>
  );
}
