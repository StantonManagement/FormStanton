type AvatarItem = {
  id: string;
  name: string;
  initials?: string;
};

type AvatarStackCellProps = {
  items: AvatarItem[];
  max?: number;
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function AvatarStackCell({ items, max = 3 }: AvatarStackCellProps) {
  if (!items || items.length === 0) return <span className="text-[var(--muted)]">—</span>;
  const visible = items.slice(0, max);
  const overflow = items.length - visible.length;

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((item) => (
        <div
          key={item.id}
          title={item.name}
          className="w-6 h-6 rounded-full bg-[var(--primary)] border border-white flex items-center justify-center text-white text-[9px] font-medium flex-shrink-0"
        >
          {item.initials ?? getInitials(item.name)}
        </div>
      ))}
      {overflow > 0 && (
        <div className="w-6 h-6 rounded-full bg-[var(--border)] border border-white flex items-center justify-center text-[var(--muted)] text-[9px] font-medium flex-shrink-0">
          +{overflow}
        </div>
      )}
    </div>
  );
}
