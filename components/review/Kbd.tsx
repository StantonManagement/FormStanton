'use client';

interface KbdProps {
  children: React.ReactNode;
  context?: 'stanton' | 'hach';
}

export default function Kbd({ children, context = 'stanton' }: KbdProps) {
  if (context === 'hach') {
    const FONT_MONO = "'IBM Plex Mono', 'Courier New', monospace";
    const COLORS = {
      border: '#e7e5e4',
      text: '#1c1917',
    };
    
    return (
      <span style={{
        display: 'inline-block', 
        padding: '1px 6px', 
        borderRadius: 3,
        backgroundColor: '#f5f5f4', 
        border: `1px solid ${COLORS.border}`,
        fontFamily: FONT_MONO, 
        fontSize: 11, 
        fontWeight: 600,
        color: COLORS.text, 
        lineHeight: '16px', 
        minWidth: 16, 
        textAlign: 'center' as const,
      }}>
        {children}
      </span>
    );
  }

  // Stanton context - use Tailwind
  return (
    <kbd className="inline-block px-1.5 py-0.5 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded">
      {children}
    </kbd>
  );
}
