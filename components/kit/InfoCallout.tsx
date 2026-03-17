'use client';

interface InfoCalloutProps {
  variant?: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  compact?: boolean;
}

export default function InfoCallout({
  variant = 'info',
  title,
  message,
  actionLabel,
  onAction,
  icon,
  compact = false,
}: InfoCalloutProps) {
  const variantStyles = {
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      accent: 'border-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700',
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      accent: 'border-yellow-600',
      button: 'bg-yellow-600 hover:bg-yellow-700',
    },
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      accent: 'border-green-600',
      button: 'bg-green-600 hover:bg-green-700',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      accent: 'border-red-600',
      button: 'bg-red-600 hover:bg-red-700',
    },
  };

  const styles = variantStyles[variant];

  const defaultIcons = {
    info: '💡',
    warning: '⚠️',
    success: '✓',
    error: '✕',
  };

  return (
    <div
      className={`${styles.bg} border ${styles.border} ${compact ? 'p-3' : 'p-4'}`}
      style={{ borderLeftWidth: '3px', borderLeftColor: styles.accent.replace('border-', '') }}
    >
      <div className="flex items-start gap-3">
        {(icon || !compact) && (
          <div className={`text-lg ${styles.text} flex-shrink-0`}>
            {icon || defaultIcons[variant]}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className={`font-semibold ${styles.text} ${compact ? 'text-sm' : 'text-base'}`}>
            {title}
          </div>
          <div className={`${styles.text} ${compact ? 'text-xs' : 'text-sm'} mt-1`}>
            {message}
          </div>
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              className={`mt-3 px-4 py-2 ${styles.button} text-white text-sm rounded-none transition-colors duration-200 ease-out`}
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
