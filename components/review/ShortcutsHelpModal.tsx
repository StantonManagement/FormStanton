'use client';

import { useEffect } from 'react';
import Kbd from './Kbd';

interface ShortcutsHelpModalProps {
  onClose: () => void;
  context?: 'stanton' | 'hach';
}

export default function ShortcutsHelpModal({ onClose, context = 'stanton' }: ShortcutsHelpModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const shortcuts = [
    { key: 'J / ArrowDown', desc: 'Focus next document row' },
    { key: 'K / ArrowUp',   desc: 'Focus previous document row' },
    { key: 'A',             desc: 'Approve focused document (if pending)' },
    { key: 'V',             desc: 'Open document viewer for focused row' },
    { key: 'R',             desc: 'Reject focused document (if pending)' },
    { key: 'M',             desc: 'Focus message input on focused document' },
    { key: '?',             desc: 'Show this help dialog' },
    { key: 'Esc',           desc: 'Close modals / dialogs' },
  ];

  if (context === 'hach') {
    const COLORS = {
      panel: '#ffffff',
      border: '#e7e5e4',
      text: '#1c1917',
      textMuted: '#78716c',
      bg: '#fafaf9',
    };
    const FONT = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif";

    return (
      <div
        onClick={onClose}
        style={{
          position: 'fixed' as const, inset: 0, backgroundColor: 'rgba(28,25,23,0.5)',
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
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>Keyboard Shortcuts</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: COLORS.textMuted, fontFamily: FONT, padding: '2px 6px' }}>x</button>
          </div>
          <div style={{ padding: '12px 22px 20px' }}>
            {shortcuts.map((s) => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '6px 0', borderBottom: `1px solid ${COLORS.border}` }}>
                <div style={{ width: 130, flexShrink: 0 }}>
                  {s.key.split(' / ').map((k, i) => (
                    <span key={k}>{i > 0 && <span style={{ color: COLORS.textMuted, margin: '0 4px' }}>/</span>}<Kbd context="hach">{k}</Kbd></span>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: COLORS.textMuted }}>{s.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '10px 22px', borderTop: `1px solid ${COLORS.border}`, backgroundColor: COLORS.bg, textAlign: 'right' as const }}>
            <button onClick={onClose} style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, backgroundColor: '#0f4c5c', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontFamily: FONT }}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Stanton context - use Tailwind
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-5" onClick={onClose}>
      <div className="bg-white w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Keyboard Shortcuts</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
        </div>
        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center gap-4 py-2 border-b border-gray-100 last:border-0">
              <div className="w-32 flex-shrink-0">
                {s.key.split(' / ').map((k, i) => (
                  <span key={k}>
                    {i > 0 && <span className="text-gray-400 mx-1">/</span>}
                    <Kbd>{k}</Kbd>
                  </span>
                ))}
              </div>
              <div className="text-sm text-gray-600">{s.desc}</div>
            </div>
          ))}
        </div>
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-right">
          <button onClick={onClose} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 rounded">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
