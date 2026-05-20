import { ReactNode } from 'react';

export type FilterMeta =
  | { type: 'text' }
  | { type: 'select'; options: Array<{ label: string; value: string }>; multi?: boolean }
  | { type: 'dateRange' };

export type ColumnDef<TRow> = {
  id: string;
  accessorKey?: keyof TRow | string;
  header: string | (() => ReactNode);
  cell?: (ctx: { row: TRow; value: unknown }) => ReactNode;
  enableSorting?: boolean;
  enableHiding?: boolean;
  enableFiltering?: boolean;
  meta?: {
    filter?: FilterMeta;
    align?: 'left' | 'right' | 'center';
    className?: string;
    csvValue?: (row: TRow) => string;
  };
};

export type SortState = Array<{ id: string; desc: boolean }>;

export type FilterState = Record<string, unknown>;

export type DataTableState = {
  globalSearch: string;
  sorting: SortState;
  columnFilters: FilterState;
  pagination: { pageIndex: number; pageSize: number };
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  rowSelection: Record<string, boolean>;
};

export type BulkAction<TRow> = {
  label: string;
  onClick: (rows: TRow[]) => void;
  variant?: 'default' | 'danger';
};

export type DataTableProps<TRow> = {
  data: TRow[];
  columns: ColumnDef<TRow>[];
  urlNamespace: string;
  getRowId: (row: TRow) => string;

  enableSorting?: boolean;
  enableGlobalSearch?: boolean;
  enableColumnFilters?: boolean;
  enableColumnVisibility?: boolean;
  enableColumnOrdering?: boolean;
  enableRowSelection?: boolean;
  enablePagination?: boolean | { pageSize: number };
  enableUrlState?: boolean;
  enableCsvExport?: boolean;

  onRowClick?: (row: TRow) => void;
  onSelectionChange?: (rows: TRow[]) => void;
  bulkActions?: BulkAction<TRow>[];
  expandedRowRenderer?: (row: TRow) => ReactNode;

  manualPagination?: boolean;
  manualFiltering?: boolean;
  manualSorting?: boolean;
  pageCount?: number;
  onStateChange?: (state: DataTableState) => void;

  loading?: boolean;
  emptyState?: ReactNode;
};
