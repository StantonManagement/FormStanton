'use client';

import Kbd from './Kbd';

interface ToastData { 
  message: string; 
  type: 'success' | 'error' 
}

interface ShortcutsBarProps {
  toast: ToastData | null;
  onShowHelp: () => void;
  context?: 'stanton' | 'hach';
}

export default function ShortcutsBar({ toast, onShowHelp, context = 'stanton' }: ShortcutsBarProps) {
  if (context === 'hach') {
    const COLORS = {
      panel: '#ffffff',
      border: '#e7e5e4',
      textMuted: '#78716c',
      approve: '#15803d',
      reject: '#b91c1c',
    };
    const FONT = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif";

    return (
      <div style={{
        position: 'fixed' as const, bottom: 0, left: 0, right: 0,
        height: 36, backgroundColor: COLORS.panel,
        borderTop: `1px solid ${COLORS.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', zIndex: 100, fontSize: 11, color: COLORS.textMuted,
        fontFamily: FONT,
      }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span><Kbd context="hach">J</Kbd> <Kbd context="hach">K</Kbd> next/prev</span>
          <span><Kbd context="hach">A</Kbd> approve</span>
          <span><Kbd context="hach">R</Kbd> reject</span>
          <span><Kbd context="hach">V</Kbd> view</span>
          <span><Kbd context="hach">M</Kbd> message</span>
          <span
            onClick={onShowHelp}
            style={{ cursor: 'pointer' }}
          >
            <Kbd context="hach">?</Kbd> help
          </span>
        </div>
        <div style={{
          opacity: toast ? 1 : 0, transition: 'opacity 0.3s',
          color: toast?.type === 'success' ? COLORS.approve : COLORS.reject,
          fontWeight: 600,
        }}>
          {toast?.message ?? ''}
        </div>
      </div>
    );
  }

  // Stanton context - use Tailwind
  return (
    <div className="fixed bottom-0 left-0 right-0 h-9 bg-white border-t border-gray-200 flex items-center justify-between px-6 z-50 text-xs text-gray-500 font-sans">
      <div className="flex items-center gap-4">
        <span><Kbd>J</Kbd> <Kbd>K</Kbd> next/prev</span>
        <span><Kbd>A</Kbd> approve</span>
        <span><Kbd>R</Kbd> reject</span>
        <span><Kbd>W</Kbd> waive</span>
        <span><Kbd>V</Kbd> view</span>
        <span><Kbd>M</Kbd> message</span>
        <button 
          onClick={onShowHelp}
          className="hover:text-gray-700 cursor-pointer"
        >
          <Kbd>?</Kbd> help
        </button>
      </div>
      <div className={`font-medium transition-opacity ${
        toast ? 'opacity-100' : 'opacity-0'
      } ${
        toast?.type === 'success' ? 'text-green-600' : 'text-red-600'
      }`}>
        {toast?.message ?? ''}
      </div>
    </div>
  );
}
