'use client';

interface ExemptionStatusBadgeProps {
  status: 'pending' | 'approved' | 'denied' | 'more_info_needed' | null;
  reason?: string;
  compact?: boolean;
}

export default function ExemptionStatusBadge({ 
  status, 
  reason, 
  compact = false 
}: ExemptionStatusBadgeProps) {
  if (!status) return null;

  const getStatusConfig = () => {
    switch (status) {
      case 'approved':
        return {
          label: 'FEE EXEMPT',
          bgColor: 'bg-green-100',
          textColor: 'text-green-800',
          borderColor: 'border-green-200',
          icon: (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ),
        };
      case 'pending':
        return {
          label: 'PENDING',
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-800',
          borderColor: 'border-yellow-200',
          icon: (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
          ),
        };
      case 'denied':
        return {
          label: 'DENIED',
          bgColor: 'bg-red-100',
          textColor: 'text-red-800',
          borderColor: 'border-red-200',
          icon: (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          ),
        };
      case 'more_info_needed':
        return {
          label: 'MORE INFO',
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-800',
          borderColor: 'border-blue-200',
          icon: (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          ),
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  if (compact) {
    return (
      <span className={`
        inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
        ${config.bgColor} ${config.textColor}
      `}>
        {config.icon}
        <span className="ml-1">{config.label}</span>
      </span>
    );
  }

  return (
    <div className={`
      inline-flex items-center px-3 py-2 rounded-md border
      ${config.bgColor} ${config.textColor} ${config.borderColor}
    `}>
      {config.icon}
      <span className="ml-2 font-medium">{config.label}</span>
      {reason && (
        <span className="ml-2 text-sm opacity-75">({reason})</span>
      )}
    </div>
  );
}
