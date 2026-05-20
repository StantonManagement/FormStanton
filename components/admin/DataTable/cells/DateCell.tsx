type DateCellProps = {
  value: string | null | undefined;
  format?: 'short' | 'long' | 'datetime';
};

export function DateCell({ value, format = 'short' }: DateCellProps) {
  if (!value) return <span className="text-[var(--muted)]">—</span>;
  const d = new Date(value);
  if (isNaN(d.getTime())) return <span className="text-[var(--muted)]">—</span>;

  let formatted: string;
  if (format === 'datetime') {
    formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  } else if (format === 'long') {
    formatted = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } else {
    formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return <span className="text-[var(--ink)] text-sm">{formatted}</span>;
}
