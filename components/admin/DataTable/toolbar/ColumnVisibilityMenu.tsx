'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Columns, GripVertical, Eye, EyeOff } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type ColItem = { id: string; label: string };

type ColumnVisibilityMenuProps = {
  columns: ColItem[];
  visibility: Record<string, boolean>;
  order: string[];
  onVisibilityChange: (visibility: Record<string, boolean>) => void;
  onOrderChange: (order: string[]) => void;
};

function SortableItem({
  col,
  visible,
  onToggle,
}: {
  col: ColItem;
  visible: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-2 py-1.5 hover:bg-[var(--bg-section)] transition-colors"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-[var(--muted)] hover:text-[var(--ink)] cursor-grab active:cursor-grabbing flex-shrink-0"
        aria-label={`Drag to reorder ${col.label}`}
        tabIndex={0}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <label className="flex items-center gap-1.5 flex-1 cursor-pointer min-w-0">
        <input
          type="checkbox"
          checked={visible}
          onChange={onToggle}
          className="w-3.5 h-3.5 flex-shrink-0"
          aria-label={`${visible ? 'Hide' : 'Show'} ${col.label}`}
        />
        <span className="text-sm text-[var(--ink)] truncate">{col.label}</span>
      </label>
      {visible ? (
        <Eye className="w-3 h-3 text-[var(--muted)] flex-shrink-0" />
      ) : (
        <EyeOff className="w-3 h-3 text-[var(--muted)] flex-shrink-0" />
      )}
    </div>
  );
}

export function ColumnVisibilityMenu({
  columns,
  visibility,
  order,
  onVisibilityChange,
  onOrderChange,
}: ColumnVisibilityMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const orderedCols = order.length > 0
    ? order.map((id) => columns.find((c) => c.id === id)).filter(Boolean) as ColItem[]
    : columns;

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIdx = orderedCols.findIndex((c) => c.id === active.id);
        const newIdx = orderedCols.findIndex((c) => c.id === over.id);
        onOrderChange(arrayMove(orderedCols, oldIdx, newIdx).map((c) => c.id));
      }
    },
    [orderedCols, onOrderChange]
  );

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && triggerRef.current !== e.target) {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Toggle column visibility"
        className="flex items-center gap-1.5 px-2.5 py-1.5 border border-[var(--border)] text-xs text-[var(--ink)] hover:bg-[var(--bg-section)] transition-colors duration-200 ease-out rounded-none"
      >
        <Columns className="w-3.5 h-3.5" />
        Columns
      </button>
      {open && (
        <div
          ref={menuRef}
          role="dialog"
          aria-label="Column visibility"
          className="absolute right-0 top-full mt-1 z-50 bg-white border border-[var(--border)] shadow-md min-w-[200px] max-h-72 overflow-y-auto"
        >
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedCols.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {orderedCols.map((col) => (
                <SortableItem
                  key={col.id}
                  col={col}
                  visible={visibility[col.id] !== false}
                  onToggle={() =>
                    onVisibilityChange({ ...visibility, [col.id]: visibility[col.id] === false ? true : false })
                  }
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}
