'use client';

interface WarningHintProps {
  message: string;
  actionText?: string;
  onAction?: () => void;
}

export default function WarningHint({
  message,
  actionText,
  onAction,
}: WarningHintProps) {
  if (!actionText || !onAction) {
    return (
      <div className="text-xs text-[var(--error)] mt-2">
        ⚠️ {message}
      </div>
    );
  }

  const parts = message.split(actionText);
  
  if (parts.length === 1) {
    return (
      <div className="text-xs text-[var(--error)] mt-2">
        ⚠️ {message}
      </div>
    );
  }

  return (
    <div className="text-xs text-[var(--error)] mt-2">
      ⚠️ {parts[0]}
      <button
        onClick={onAction}
        className="underline hover:text-[var(--primary)] transition-colors duration-200 font-medium"
      >
        {actionText}
      </button>
      {parts.slice(1).join(actionText)}
    </div>
  );
}
