'use client';

/**
 * components/pbv/sign/DashboardCard.tsx
 *
 * A single task card in the tenant dashboard.
 * States: locked | pending | in_progress | complete
 */

import type { ReactNode } from 'react';

export type CardStatus = 'locked' | 'pending' | 'in_progress' | 'complete';

interface Props {
  title: string;
  subtitle?: string;
  status: CardStatus;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}

const statusDot: Record<CardStatus, string> = {
  locked:      'bg-[var(--muted)] opacity-30',
  pending:     'bg-[var(--muted)]',
  in_progress: 'bg-amber-500',
  complete:    'bg-emerald-600',
};

const statusLabel: Record<CardStatus, Record<string, string>> = {
  locked:      { en: 'Locked', es: 'Bloqueado', pt: 'Bloqueado' },
  pending:     { en: 'To do', es: 'Pendiente', pt: 'A fazer' },
  in_progress: { en: 'In progress', es: 'En progreso', pt: 'Em andamento' },
  complete:    { en: 'Complete ✓', es: 'Completo ✓', pt: 'Completo ✓' },
};

export default function DashboardCard({ title, subtitle, status, actionLabel, onAction, icon }: Props) {
  const isComplete = status === 'complete';
  const isLocked = status === 'locked';

  return (
    <div className={`bg-white border border-[var(--border)] p-4 flex items-start gap-4 ${isComplete ? 'opacity-75' : ''}`}>
      {/* Left icon / dot */}
      <div className="flex-shrink-0 flex flex-col items-center pt-1">
        {icon ?? <span className={`w-3 h-3 rounded-full mt-1 ${statusDot[status]}`} />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${isComplete ? 'line-through text-[var(--muted)]' : 'text-[var(--body)]'}`}>
          {title}
        </p>
        {subtitle && (
          <p className="text-xs text-[var(--muted)] mt-0.5">{subtitle}</p>
        )}
        <p className={`text-xs mt-1 ${
          status === 'complete' ? 'text-emerald-600' :
          status === 'in_progress' ? 'text-amber-600' :
          'text-[var(--muted)]'
        }`}>
          {statusLabel[status].en}
        </p>
      </div>

      {/* Action button */}
      {!isLocked && !isComplete && actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="flex-shrink-0 min-h-[44px] px-4 bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
