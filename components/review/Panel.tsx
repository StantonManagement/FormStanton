'use client';

interface PanelProps {
  title: string;
  children: React.ReactNode;
  context?: 'stanton' | 'hach';
}

export default function Panel({ title, children, context = 'stanton' }: PanelProps) {
  if (context === 'hach') {
    const COLORS = {
      panel: '#ffffff',
      border: '#e7e5e4',
      textMuted: '#78716c',
    };
    const FONT = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif";

    return (
      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, marginBottom: 20 }}>
        <div style={{ 
          padding: '12px 20px', 
          borderBottom: `1px solid ${COLORS.border}`, 
          fontSize: 11, 
          fontWeight: 700, 
          letterSpacing: '0.08em', 
          textTransform: 'uppercase' as const, 
          color: COLORS.textMuted 
        }}>
          {title}
        </div>
        <div style={{ padding: '16px 20px' }}>{children}</div>
      </div>
    );
  }

  // Stanton context - use Tailwind
  return (
    <div className="bg-white border border-gray-200 mb-5">
      <div className="px-5 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
