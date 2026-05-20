type MoneyCellProps = {
  value: number | null | undefined;
  currency?: string;
};

export function MoneyCell({ value, currency = 'USD' }: MoneyCellProps) {
  if (value === null || value === undefined) {
    return <span className="text-[var(--muted)] text-right block">—</span>;
  }
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  return <span className="text-[var(--ink)] text-sm text-right block tabular-nums">{formatted}</span>;
}
