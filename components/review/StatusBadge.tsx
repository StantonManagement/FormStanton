'use client';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  context?: 'stanton' | 'hach';
}

export default function StatusBadge({ status, size = 'md', context = 'stanton' }: StatusBadgeProps) {
  if (context === 'hach') {
    const COLORS = {
      approve: '#15803d',
      approveLight: '#dcfce7',
      reject: '#b91c1c',
      rejectLight: '#fee2e2',
      pending: '#a16207',
      pendingLight: '#fef9c3',
      missing: '#9ca3af',
      missingLight: '#f3f4f6',
      waived: '#6366f1',
      waivedLight: '#e0e7ff',
    };

    const config: Record<string, { label: string; bg: string; color: string }> = {
      approved:  { label: 'Approved',        bg: COLORS.approveLight, color: COLORS.approve },
      pending:   { label: 'Awaiting Review', bg: COLORS.pendingLight, color: COLORS.pending },
      submitted: { label: 'Awaiting Review', bg: COLORS.pendingLight, color: COLORS.pending },
      rejected:  { label: 'Rejected',        bg: COLORS.rejectLight,  color: COLORS.reject },
      missing:   { label: 'Not Uploaded',    bg: COLORS.missingLight, color: COLORS.missing },
      waived:    { label: 'Waived',          bg: COLORS.waivedLight,  color: COLORS.waived },
    };
    
    const s = config[status] ?? { label: status, bg: COLORS.missingLight, color: COLORS.missing };
    
    return (
      <span style={{
        display: 'inline-block',
        padding: size === 'sm' ? '2px 7px' : '3px 9px',
        fontSize: size === 'sm' ? 10 : 11,
        fontWeight: 600, 
        backgroundColor: s.bg, 
        color: s.color,
        letterSpacing: '0.02em', 
        textTransform: 'uppercase' as const, 
        whiteSpace: 'nowrap' as const,
      }}>
        {s.label}
      </span>
    );
  }

  // Stanton context - use Tailwind
  const config: Record<string, { label: string; classes: string }> = {
    approved:  { label: 'Approved',        classes: 'bg-green-100 text-green-800' },
    pending:   { label: 'Pending',         classes: 'bg-yellow-100 text-yellow-800' },
    submitted: { label: 'Submitted',       classes: 'bg-yellow-100 text-yellow-800' },
    rejected:  { label: 'Rejected',        classes: 'bg-red-100 text-red-800' },
    missing:   { label: 'Missing',         classes: 'bg-gray-100 text-gray-600' },
    waived:    { label: 'Waived',          classes: 'bg-indigo-100 text-indigo-800' },
  };
  
  const s = config[status] ?? { label: status, classes: 'bg-gray-100 text-gray-600' };
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';
  
  return (
    <span className={`inline-block font-semibold uppercase tracking-wide ${sizeClasses} ${s.classes}`}>
      {s.label}
    </span>
  );
}
