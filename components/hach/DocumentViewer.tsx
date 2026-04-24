'use client';

import { useState, useEffect, useCallback } from 'react';

const COLORS = {
  accent: '#0f4c5c',
  accentLight: '#e6f0f3',
  panel: '#ffffff',
  border: '#e7e5e4',
  borderStrong: '#d6d3d1',
  text: '#1c1917',
  textMuted: '#78716c',
  textSubtle: '#a8a29e',
  bg: '#fafaf9',
  error: '#dc2626',
  errorBg: '#fef2f2',
};
const FONT = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif";
const FONT_MONO = "'IBM Plex Mono', 'Courier New', monospace";

interface Revision {
  revision: number;
  file_name: string | null;
  uploaded_at: string | null;
  uploaded_by: string | null;
  signed_url: string | null;
}

interface ViewerData {
  document_id: string;
  label: string;
  file_name: string | null;
  revision: number | null;
  signed_url: string | null;
  revisions: Revision[];
}

function inferType(fileName: string | null): 'pdf' | 'image' | 'unknown' {
  if (!fileName) return 'unknown';
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return 'image';
  return 'unknown';
}

export interface DocumentViewerProps {
  document: {
    id: string;
    label: string;
    file_name?: string | null;
    storage_path?: string | null;
    revision?: number | null;
  };
  onClose: () => void;
}

export default function DocumentViewer({ document: doc, onClose }: DocumentViewerProps) {
  const [data, setData] = useState<ViewerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeRevision, setActiveRevision] = useState<number | null>(null);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);

  // Fetch signed URL data on mount
  useEffect(() => {
    setLoading(true);
    fetch(`/api/hach/documents/${doc.id}/signed-url`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setData(res.data);
          const revs: Revision[] = res.data.revisions ?? [];
          const latest = revs[revs.length - 1] ?? null;
          setActiveRevision(latest?.revision ?? res.data.revision ?? null);
          setActiveUrl(latest?.signed_url ?? res.data.signed_url ?? null);
          setActiveFileName(latest?.file_name ?? res.data.file_name ?? null);
        } else {
          setError(res.message || 'Failed to load document');
        }
      })
      .catch(() => setError('Network error — could not load document'))
      .finally(() => setLoading(false));
  }, [doc.id]);

  const selectRevision = useCallback((rev: Revision) => {
    setActiveRevision(rev.revision);
    setActiveUrl(rev.signed_url);
    setActiveFileName(rev.file_name);
  }, []);

  const navigateRevision = useCallback((dir: 1 | -1) => {
    if (!data) return;
    const revs = data.revisions;
    const idx = revs.findIndex((r) => r.revision === activeRevision);
    const next = revs[idx + dir];
    if (next) selectRevision(next);
  }, [data, activeRevision, selectRevision]);

  // Keyboard: Esc closes, ← → navigate versions
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowLeft') { navigateRevision(-1); return; }
      if (e.key === 'ArrowRight') { navigateRevision(1); return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, navigateRevision]);

  const fileType = inferType(activeFileName);
  const revisions = data?.revisions ?? [];
  const hasMultiple = revisions.length > 1;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed' as const, inset: 0,
        backgroundColor: 'rgba(28, 25, 23, 0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 150, padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: COLORS.panel,
          width: '100%', maxWidth: 720, maxHeight: '90vh',
          display: 'flex', flexDirection: 'column' as const,
          boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          fontFamily: FONT,
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 22px', borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{doc.label}</div>
            {activeFileName && (
              <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: FONT_MONO, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                {activeFileName}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              marginLeft: 16, padding: '5px 10px', fontSize: 12, fontWeight: 600,
              backgroundColor: 'transparent', border: `1px solid ${COLORS.borderStrong}`,
              borderRadius: 4, cursor: 'pointer', color: COLORS.textMuted, fontFamily: FONT, flexShrink: 0,
            }}
          >
            Close ✕
          </button>
        </div>

        {/* Version tabs (only when >1 revision) */}
        {hasMultiple && (
          <div style={{
            display: 'flex', gap: 4, padding: '8px 22px',
            borderBottom: `1px solid ${COLORS.border}`, flexShrink: 0, backgroundColor: COLORS.bg,
          }}>
            {revisions.map((rev) => {
              const isActive = rev.revision === activeRevision;
              return (
                <button
                  key={rev.revision}
                  onClick={() => selectRevision(rev)}
                  title={rev.file_name ?? undefined}
                  style={{
                    padding: '4px 10px', fontSize: 11, fontWeight: 600,
                    backgroundColor: isActive ? COLORS.accent : 'transparent',
                    color: isActive ? '#fff' : COLORS.textMuted,
                    border: `1px solid ${isActive ? COLORS.accent : COLORS.borderStrong}`,
                    borderRadius: 3, cursor: 'pointer', fontFamily: FONT,
                  }}
                >
                  v{rev.revision}
                  {rev.uploaded_at ? (
                    <span style={{ marginLeft: 5, opacity: 0.75, fontWeight: 400 }}>
                      {new Date(rev.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  ) : null}
                </button>
              );
            })}
            <div style={{ flex: 1 }} />
            {hasMultiple && (
              <div style={{ fontSize: 11, color: COLORS.textSubtle, alignSelf: 'center' }}>
                ← → to navigate
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div style={{
          flex: 1, overflow: 'auto', backgroundColor: '#f5f5f4',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 0,
        }}>
          {loading && (
            <div style={{ fontSize: 13, color: COLORS.textMuted, padding: 40 }}>Loading…</div>
          )}
          {!loading && error && (
            <div style={{ fontSize: 13, color: COLORS.error, background: COLORS.errorBg, padding: '12px 16px', maxWidth: 480, border: '1px solid #fecaca' }}>
              {error}
            </div>
          )}
          {!loading && !error && !activeUrl && (
            <div style={{ fontSize: 13, color: COLORS.textMuted, padding: 40, textAlign: 'center' as const }}>
              No file uploaded for this document slot.
            </div>
          )}
          {!loading && !error && activeUrl && fileType === 'pdf' && (
            <iframe
              src={activeUrl}
              title={activeFileName ?? doc.label}
              style={{ width: '100%', height: '100%', border: 'none', minHeight: 500 }}
            />
          )}
          {!loading && !error && activeUrl && fileType === 'image' && (
            <img
              src={activeUrl}
              alt={activeFileName ?? doc.label}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
            />
          )}
          {!loading && !error && activeUrl && fileType === 'unknown' && (
            <div style={{ padding: 40, textAlign: 'center' as const }}>
              <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 16 }}>
                Preview not available for this file type.
              </div>
              <a
                href={activeUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={activeFileName ?? undefined}
                style={{
                  display: 'inline-block', padding: '8px 16px', fontSize: 13, fontWeight: 600,
                  backgroundColor: COLORS.accent, color: '#fff', textDecoration: 'none', borderRadius: 4,
                }}
              >
                Download file
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 22px', borderTop: `1px solid ${COLORS.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, backgroundColor: COLORS.bg,
        }}>
          <div style={{ fontSize: 11, color: COLORS.textSubtle, fontFamily: FONT_MONO }}>
            {revisions.length > 0 ? `v${activeRevision} of ${revisions.length}` : ''}
          </div>
          {activeUrl && (
            <a
              href={activeUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 11, color: COLORS.textMuted, textDecoration: 'none' }}
            >
              Open in new tab ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
