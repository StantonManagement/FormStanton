'use client';

interface MatrixStatusCellProps {
  applicable: boolean;
  done: boolean;
  missing: boolean;
  doneLabel?: string;
  pendingLabel?: string;
  auditBy: string | null;
  auditAt: string | null;
}

export default function MatrixStatusCell({
  applicable,
  done,
  missing,
  doneLabel = '✓',
  pendingLabel = '—',
  auditBy,
  auditAt,
}: MatrixStatusCellProps) {
  if (!applicable || missing) {
    return <td className="px-2 py-1.5 text-center text-xs text-[var(--muted)] border border-[var(--divider)]">—</td>;
  }

  if (done) {
    const auditText = [
      auditBy && `by ${auditBy}`,
      auditAt && new Date(auditAt).toLocaleDateString(),
    ].filter(Boolean).join(' · ');

    return (
      <td className="px-2 py-1.5 text-center border border-[var(--divider)] group relative" title={auditText}>
        <span className="text-[var(--success)] text-xs font-medium">{doneLabel}</span>
        {auditText && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-[var(--ink)] text-white text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-out pointer-events-none z-10">
            {auditText}
          </div>
        )}
      </td>
    );
  }

  return (
    <td className="px-2 py-1.5 text-center text-xs text-[var(--muted)] border border-[var(--divider)]">
      {pendingLabel === 'Pending' ? (
        <span className="px-2 py-0.5 bg-[var(--bg-section)] text-[var(--muted)] border border-[var(--divider)] text-xs">
          {pendingLabel}
        </span>
      ) : (
        pendingLabel
      )}
    </td>
  );
}
