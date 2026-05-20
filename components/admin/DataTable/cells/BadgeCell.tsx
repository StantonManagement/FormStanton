type BadgeVariant = 'green' | 'red' | 'yellow' | 'amber' | 'blue' | 'gray' | 'indigo';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  green:  'bg-green-50 text-green-800 border-green-200',
  red:    'bg-red-50 text-red-800 border-red-200',
  yellow: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  amber:  'bg-amber-50 text-amber-800 border-amber-200',
  blue:   'bg-blue-50 text-blue-800 border-blue-200',
  gray:   'bg-gray-100 text-gray-700 border-gray-200',
  indigo: 'bg-indigo-50 text-indigo-800 border-indigo-200',
};

type BadgeCellProps = {
  value: string | null | undefined;
  variant?: BadgeVariant;
  label?: string;
};

export function BadgeCell({ value, variant = 'gray', label }: BadgeCellProps) {
  if (!value) return <span className="text-[var(--muted)]">—</span>;
  return (
    <span className={`inline-block px-2 py-0.5 border text-xs font-medium ${VARIANT_CLASSES[variant]}`}>
      {label ?? value}
    </span>
  );
}
