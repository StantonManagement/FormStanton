type MonoCellProps = {
  value: string | null | undefined;
};

export function MonoCell({ value }: MonoCellProps) {
  if (!value) return <span className="text-[var(--muted)]">—</span>;
  return <span className="font-mono text-xs text-[var(--ink)]">{value}</span>;
}
