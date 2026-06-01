'use client';

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  filterFns,
  type Table,
  type ColumnDef as TanstackColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
  type PaginationState,
} from '@tanstack/react-table';
import { ArrowUp, ArrowDown, ChevronsUpDown, Filter } from 'lucide-react';

import type { ColumnDef, DataTableProps, DataTableState, FilterState } from './types';
import { useUrlState } from './useUrlState';
import { useColumnPersistence, loadPersistedColumns } from './useColumnPersistence';
import { GlobalSearch } from './toolbar/GlobalSearch';
import { ColumnVisibilityMenu } from './toolbar/ColumnVisibilityMenu';
import { CsvExportButton } from './toolbar/CsvExportButton';
import { BulkActionBar } from './toolbar/BulkActionBar';
import { PaginationControls } from './toolbar/PaginationControls';
import { TextFilter } from './filters/TextFilter';
import { SelectFilter } from './filters/SelectFilter';
import { DateRangeFilter } from './filters/DateRangeFilter';

function getDefaultPageSize(enablePagination: DataTableProps<unknown>['enablePagination']): number {
  if (!enablePagination) return -1;
  if (typeof enablePagination === 'object' && enablePagination.pageSize) return enablePagination.pageSize;
  return 50;
}

type TableState = {
  globalSearch: string;
  sorting: SortingState;
  columnFilters: FilterState;
  pagination: PaginationState;
  columnVisibility: VisibilityState;
  columnOrder: string[];
  rowSelection: RowSelectionState;
};

type Action =
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_SORTING'; payload: SortingState }
  | { type: 'SET_FILTER'; columnId: string; value: unknown }
  | { type: 'SET_FILTERS'; payload: FilterState }
  | { type: 'SET_PAGINATION'; payload: Partial<PaginationState> }
  | { type: 'SET_VISIBILITY'; payload: VisibilityState }
  | { type: 'SET_ORDER'; payload: string[] }
  | { type: 'SET_SELECTION'; payload: RowSelectionState }
  | { type: 'PATCH'; payload: Partial<TableState> };

function reducer(state: TableState, action: Action): TableState {
  switch (action.type) {
    case 'SET_SEARCH':
      return { ...state, globalSearch: action.payload, pagination: { ...state.pagination, pageIndex: 0 } };
    case 'SET_SORTING':
      return { ...state, sorting: action.payload };
    case 'SET_FILTER':
      return {
        ...state,
        columnFilters: { ...state.columnFilters, [action.columnId]: action.value },
        pagination: { ...state.pagination, pageIndex: 0 },
      };
    case 'SET_FILTERS':
      return { ...state, columnFilters: action.payload, pagination: { ...state.pagination, pageIndex: 0 } };
    case 'SET_PAGINATION':
      return { ...state, pagination: { ...state.pagination, ...action.payload } };
    case 'SET_VISIBILITY':
      return { ...state, columnVisibility: action.payload };
    case 'SET_ORDER':
      return { ...state, columnOrder: action.payload };
    case 'SET_SELECTION':
      return { ...state, rowSelection: action.payload };
    case 'PATCH':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

function buildTanstackColumnDefs<TRow>(
  cols: ColumnDef<TRow>[],
  enableRowSelection: boolean
): TanstackColumnDef<TRow>[] {
  const defs: TanstackColumnDef<TRow>[] = [];

  if (enableRowSelection) {
    defs.push({
      id: '__select__',
      enableSorting: false,
      enableHiding: false,
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          aria-label="Select all rows"
          className="w-3.5 h-3.5"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select row ${row.id}`}
          className="w-3.5 h-3.5"
        />
      ),
      size: 40,
    });
  }

  for (const col of cols) {
    const accessorKey = col.accessorKey as string | undefined;
    const filterMeta = col.meta?.filter;

    let filterFn: TanstackColumnDef<TRow>['filterFn'] | undefined;
    if (filterMeta) {
      if (filterMeta.type === 'text') {
        filterFn = (row, colId, filterValue: string) => {
          if (!filterValue) return true;
          const val = row.getValue(colId);
          return String(val ?? '').toLowerCase().includes(filterValue.toLowerCase());
        };
      } else if (filterMeta.type === 'select') {
        filterFn = (row, colId, filterValue: string | string[]) => {
          if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) return true;
          const val = String(row.getValue(colId) ?? '');
          if (Array.isArray(filterValue)) return filterValue.includes(val);
          return val === filterValue;
        };
      } else if (filterMeta.type === 'dateRange') {
        filterFn = (row, colId, filterValue: { from?: string; to?: string }) => {
          if (!filterValue || (!filterValue.from && !filterValue.to)) return true;
          const rawVal = row.getValue(colId);
          if (!rawVal) return false;
          const d = new Date(String(rawVal)).getTime();
          const from = filterValue.from ? new Date(filterValue.from).getTime() : -Infinity;
          const to = filterValue.to ? new Date(filterValue.to + 'T23:59:59').getTime() : Infinity;
          return d >= from && d <= to;
        };
      }
    }

    const tanDef: TanstackColumnDef<TRow> = {
      id: col.id,
      enableSorting: col.enableSorting ?? true,
      enableHiding: col.enableHiding ?? true,
      enableColumnFilter: col.enableFiltering ?? false,
      ...(accessorKey ? { accessorKey } : {}),
      header: typeof col.header === 'string' ? col.header : col.header,
      ...(col.cell ? {
        cell: ({ row }) => {
          const key = accessorKey as keyof TRow | undefined;
          const value = key ? row.original[key] : undefined;
          return col.cell!({ row: row.original, value });
        },
      } : {}),
      ...(filterFn ? { filterFn } : {}),
      meta: col.meta,
    };
    defs.push(tanDef);
  }

  return defs;
}

export function DataTable<TRow extends object>(props: DataTableProps<TRow>) {
  const {
    data,
    columns,
    urlNamespace,
    getRowId,
    enableSorting = true,
    enableGlobalSearch = true,
    enableColumnFilters = true,
    enableColumnVisibility = true,
    enableColumnOrdering = true,
    enableRowSelection = false,
    enablePagination = { pageSize: 50 },
    enableUrlState = true,
    enableCsvExport = true,
    onRowClick,
    onSelectionChange,
    bulkActions = [],
    expandedRowRenderer,
    manualPagination = false,
    manualFiltering = false,
    manualSorting = false,
    pageCount: externalPageCount,
    onStateChange,
    loading = false,
    emptyState,
  } = props;

  const defaultPageSize = getDefaultPageSize(enablePagination);
  const hasPagination = enablePagination !== false;

  const initialState = useMemo((): TableState => {
    const persisted = loadPersistedColumns(urlNamespace);
    const ps = defaultPageSize > 0 ? defaultPageSize : 50;
    // Sanitize the persisted column order against the columns that actually
    // exist now. A saved view (URL/localStorage) can reference a column id that
    // was since renamed or removed; passing that stale id through to react-table
    // and the column menus crashes the page ("reading 'map' of undefined").
    // Keep the saved order for ids that still exist, drop unknown ids, and append
    // any current columns the saved view didn't know about so new columns appear.
    const knownColumnIds = columns.map((c) => c.id).filter((id): id is string => !!id);
    const columnOrder = (() => {
      if (!persisted.cols) return knownColumnIds;
      const knownSet = new Set(knownColumnIds);
      const kept = persisted.cols.filter((id) => knownSet.has(id));
      const missing = knownColumnIds.filter((id) => !kept.includes(id));
      return [...kept, ...missing];
    })();
    return {
      globalSearch: '',
      sorting: [],
      columnFilters: {},
      pagination: { pageIndex: 0, pageSize: persisted.pageSize ?? ps },
      columnVisibility: {},
      columnOrder,
      rowSelection: {},
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [state, dispatch] = useReducer(reducer, initialState);

  const patchState = useCallback((partial: Partial<DataTableState>) => {
    // Only patch keys that were actually provided. The previous version spread
    // every field as `partial.x ?? undefined`, which clobbered existing state
    // with `undefined` for any key the caller omitted. When a URL carried
    // column state (`.cols`) but no sort (`.sort`), useUrlState's update had no
    // `sorting`, so this set `state.sorting = undefined` — and the next render's
    // `state.sorting.map(...)` threw "Cannot read properties of undefined
    // (reading 'map')", crashing the whole page on every refresh.
    const payload: Partial<TableState> = {};
    if (partial.globalSearch !== undefined) payload.globalSearch = partial.globalSearch;
    if (partial.sorting !== undefined) payload.sorting = partial.sorting;
    if (partial.columnFilters !== undefined) payload.columnFilters = partial.columnFilters;
    if (partial.pagination !== undefined) payload.pagination = partial.pagination;
    if (partial.columnVisibility !== undefined) payload.columnVisibility = partial.columnVisibility;
    if (partial.columnOrder !== undefined) payload.columnOrder = partial.columnOrder;
    if (partial.rowSelection !== undefined) payload.rowSelection = partial.rowSelection;
    dispatch({ type: 'PATCH', payload });
  }, []);

  const urlHasCols = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.has(`${urlNamespace}.cols`);
  }, [urlNamespace]);

  useUrlState(
    { urlNamespace, enabled: enableUrlState },
    {
      globalSearch: state.globalSearch,
      sorting: state.sorting.map((s) => ({ id: s.id, desc: s.desc })),
      columnFilters: state.columnFilters,
      pagination: state.pagination,
      columnVisibility: state.columnVisibility,
      columnOrder: state.columnOrder,
      rowSelection: state.rowSelection,
    },
    patchState
  );

  useColumnPersistence(
    urlNamespace,
    state.columnOrder,
    state.columnVisibility,
    state.pagination.pageSize,
    urlHasCols
  );

  const columnFiltersForTanstack = useMemo((): ColumnFiltersState => {
    return Object.entries(state.columnFilters)
      .filter(([, v]) => {
        if (v === null || v === undefined || v === '') return false;
        if (Array.isArray(v) && v.length === 0) return false;
        if (typeof v === 'object' && !Array.isArray(v)) {
          const dr = v as { from?: string; to?: string };
          if (!dr.from && !dr.to) return false;
        }
        return true;
      })
      .map(([id, value]) => ({ id, value }));
  }, [state.columnFilters]);

  const tanstackColumns = useMemo(() => buildTanstackColumnDefs(columns, enableRowSelection), [columns, enableRowSelection]);

  const tanstackPageSize = hasPagination ? (state.pagination.pageSize === -1 ? data.length || 1 : state.pagination.pageSize) : data.length || 1;

  const table: Table<TRow> = useReactTable({
    data,
    columns: tanstackColumns,
    getRowId,
    state: {
      sorting: state.sorting,
      columnFilters: columnFiltersForTanstack,
      globalFilter: state.globalSearch,
      columnVisibility: state.columnVisibility,
      ...(state.columnOrder.length > 0 ? {
        columnOrder: enableRowSelection
          ? ['__select__', ...state.columnOrder]
          : state.columnOrder,
      } : {}),
      rowSelection: state.rowSelection,
      ...(hasPagination ? { pagination: { ...state.pagination, pageSize: tanstackPageSize } } : {}),
    },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(state.sorting) : updater;
      dispatch({ type: 'SET_SORTING', payload: next });
    },
    onColumnFiltersChange: () => {},
    onGlobalFilterChange: () => {},
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === 'function' ? updater(state.columnVisibility) : updater;
      dispatch({ type: 'SET_VISIBILITY', payload: next });
    },
    onColumnOrderChange: (updater) => {
      const next = typeof updater === 'function' ? updater(state.columnOrder) : updater;
      dispatch({ type: 'SET_ORDER', payload: next });
    },
    onRowSelectionChange: (updater) => {
      const next = typeof updater === 'function' ? updater(state.rowSelection) : updater;
      dispatch({ type: 'SET_SELECTION', payload: next });
    },
    ...(hasPagination ? {
      onPaginationChange: (updater: PaginationState | ((old: PaginationState) => PaginationState)) => {
        const next = typeof updater === 'function' ? updater({ pageIndex: state.pagination.pageIndex, pageSize: tanstackPageSize }) : updater;
        dispatch({ type: 'SET_PAGINATION', payload: { pageIndex: next.pageIndex } });
      },
    } : {}),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: hasPagination ? getPaginationRowModel() : undefined,
    globalFilterFn: filterFns.includesString,
    manualPagination,
    manualFiltering,
    manualSorting,
    pageCount: manualPagination ? (externalPageCount ?? -1) : undefined,
    enableMultiSort: true,
    enableSorting,
    enableColumnFilters,
    enableGlobalFilter: enableGlobalSearch,
  });

  const selectedRows = useMemo(
    () => table.getSelectedRowModel().rows.map((r) => r.original),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.rowSelection, data]
  );

  useEffect(() => {
    onSelectionChange?.(selectedRows);
  }, [selectedRows, onSelectionChange]);

  useEffect(() => {
    if (!onStateChange) return;
    onStateChange({
      globalSearch: state.globalSearch,
      sorting: state.sorting.map((s) => ({ id: s.id, desc: s.desc })),
      columnFilters: state.columnFilters,
      pagination: state.pagination,
      columnVisibility: state.columnVisibility,
      columnOrder: state.columnOrder,
      rowSelection: state.rowSelection,
    });
  }, [state, onStateChange]);

  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [activeFilterCol, setActiveFilterCol] = useState<string | null>(null);
  const filterTriggerRefs = useRef<Record<string, React.RefObject<HTMLButtonElement>>>({});

  function getFilterTriggerRef(colId: string): React.RefObject<HTMLButtonElement> {
    if (!filterTriggerRefs.current[colId]) {
      filterTriggerRefs.current[colId] = { current: null };
    }
    return filterTriggerRefs.current[colId] as React.RefObject<HTMLButtonElement>;
  }

  const visibleColumnIds = useMemo(() => {
    return columns
      .filter((c) => state.columnVisibility[c.id] !== false)
      .map((c) => c.id);
  }, [columns, state.columnVisibility]);

  const allRows = table.getRowModel().rows;

  const rows = hasPagination ? allRows : allRows;

  const skeletonCols = enableRowSelection
    ? columns.length + 1
    : columns.length;

  function handleRowKeyDown(e: React.KeyboardEvent, rowId: string, rowIndex: number) {
    if (e.key === ' ') {
      e.preventDefault();
      dispatch({ type: 'SET_SELECTION', payload: { ...state.rowSelection, [rowId]: !state.rowSelection[rowId] } });
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = document.querySelector<HTMLElement>(`[data-row-index="${rowIndex + 1}"]`);
      next?.focus();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = document.querySelector<HTMLElement>(`[data-row-index="${rowIndex - 1}"]`);
      prev?.focus();
    }
  }

  const colItems = useMemo(
    () => columns.filter((c) => c.enableHiding !== false).map((c) => ({ id: c.id, label: typeof c.header === 'string' ? c.header : c.id })),
    [columns]
  );

  const exportRows = useMemo(() => {
    const pageRows = hasPagination ? table.getPaginationRowModel().rows : table.getRowModel().rows;
    return pageRows.map((r) => r.original);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPagination, state.pagination, state.columnFilters, state.globalSearch, state.sorting, data]);

  return (
    <div className="flex flex-col gap-0">
      {/* Bulk Action Bar */}
      {enableRowSelection && bulkActions.length > 0 && selectedRows.length > 0 && (
        <BulkActionBar
          selectedRows={selectedRows}
          actions={bulkActions}
          onClearSelection={() => dispatch({ type: 'SET_SELECTION', payload: {} })}
        />
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {enableGlobalSearch && (
            <GlobalSearch
              value={state.globalSearch}
              onChange={(v) => dispatch({ type: 'SET_SEARCH', payload: v })}
            />
          )}
          {Object.keys(state.columnFilters).some((k) => {
            const v = state.columnFilters[k];
            if (!v) return false;
            if (Array.isArray(v)) return v.length > 0;
            if (typeof v === 'object') {
              const dr = v as { from?: string; to?: string };
              return !!(dr.from || dr.to);
            }
            return true;
          }) && (
            <button
              onClick={() => dispatch({ type: 'SET_FILTERS', payload: {} })}
              className="text-xs text-[var(--muted)] hover:text-[var(--ink)] underline transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {enableColumnVisibility && (
            <ColumnVisibilityMenu
              columns={colItems}
              visibility={state.columnVisibility}
              order={state.columnOrder}
              onVisibilityChange={(v) => dispatch({ type: 'SET_VISIBILITY', payload: v })}
              onOrderChange={(o) => dispatch({ type: 'SET_ORDER', payload: o })}
            />
          )}
          {enableCsvExport && (
            <CsvExportButton
              namespace={urlNamespace}
              columns={columns}
              rows={exportRows}
              visibleColumnIds={visibleColumnIds}
            />
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border border-[var(--border)] overflow-x-auto">
        <table
          role="grid"
          aria-busy={loading}
          aria-rowcount={data.length}
          className="w-full text-sm border-collapse"
        >
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-[var(--border)] bg-[var(--bg-section)]">
                {headerGroup.headers.map((header) => {
                  const colDef = columns.find((c) => c.id === header.id);
                  const isSortable = header.column.getCanSort();
                  const sortDir = header.column.getIsSorted();
                  const hasFilter = !!colDef?.meta?.filter;
                  const filterActive = !!state.columnFilters[header.id];
                  const trigRef = getFilterTriggerRef(header.id);

                  const alignClass =
                    colDef?.meta?.align === 'right'
                      ? 'text-right'
                      : colDef?.meta?.align === 'center'
                      ? 'text-center'
                      : 'text-left';

                  return (
                    <th
                      key={header.id}
                      className={`px-3 py-2.5 text-xs font-medium text-[var(--muted)] uppercase tracking-wider whitespace-nowrap ${alignClass} relative`}
                      aria-sort={
                        sortDir === 'asc'
                          ? 'ascending'
                          : sortDir === 'desc'
                          ? 'descending'
                          : isSortable
                          ? 'none'
                          : undefined
                      }
                      style={{ width: header.getSize() }}
                    >
                      <div className={`flex items-center gap-1 ${alignClass === 'text-right' ? 'justify-end' : ''}`}>
                        {isSortable ? (
                          <button
                            onClick={(e) => {
                              const handler = header.column.getToggleSortingHandler();
                              if (handler) handler(e);
                            }}
                            className="flex items-center gap-1 hover:text-[var(--ink)] transition-colors group"
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sortDir === 'asc' ? (
                              <ArrowUp className="w-3 h-3 text-[var(--primary)]" />
                            ) : sortDir === 'desc' ? (
                              <ArrowDown className="w-3 h-3 text-[var(--primary)]" />
                            ) : (
                              <ChevronsUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                            )}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                        {hasFilter && enableColumnFilters && (
                          <div className="relative">
                            <button
                              ref={trigRef}
                              onClick={() => setActiveFilterCol(activeFilterCol === header.id ? null : header.id)}
                              aria-label={`Filter ${typeof colDef?.header === 'string' ? colDef.header : header.id}`}
                              className={`ml-0.5 p-0.5 transition-colors ${
                                filterActive ? 'text-[var(--primary)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                              }`}
                            >
                              <Filter className={`w-3 h-3 ${filterActive ? 'fill-current' : ''}`} />
                            </button>
                            {activeFilterCol === header.id && colDef?.meta?.filter && (() => {
                              const filter = colDef.meta.filter;
                              if (filter.type === 'text') {
                                return (
                                  <TextFilter
                                    columnId={header.id}
                                    value={(state.columnFilters[header.id] as string) ?? ''}
                                    onChange={(v) => dispatch({ type: 'SET_FILTER', columnId: header.id, value: v })}
                                    onClose={() => setActiveFilterCol(null)}
                                    triggerRef={trigRef as React.RefObject<HTMLElement | null>}
                                  />
                                );
                              }
                              if (filter.type === 'select') {
                                return (
                                  <SelectFilter
                                    columnId={header.id}
                                    options={filter.options}
                                    multi={filter.multi}
                                    value={(state.columnFilters[header.id] as string | string[]) ?? ''}
                                    onChange={(v) => dispatch({ type: 'SET_FILTER', columnId: header.id, value: v })}
                                    onClose={() => setActiveFilterCol(null)}
                                    triggerRef={trigRef as React.RefObject<HTMLElement | null>}
                                  />
                                );
                              }
                              if (filter.type === 'dateRange') {
                                return (
                                  <DateRangeFilter
                                    columnId={header.id}
                                    value={(state.columnFilters[header.id] as { from?: string; to?: string }) ?? {}}
                                    onChange={(v) => dispatch({ type: 'SET_FILTER', columnId: header.id, value: v })}
                                    onClose={() => setActiveFilterCol(null)}
                                    triggerRef={trigRef as React.RefObject<HTMLElement | null>}
                                  />
                                );
                              }
                              return null;
                            })()}
                          </div>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} aria-hidden="true" className="border-b border-[var(--divider)]">
                  {Array.from({ length: skeletonCols }).map((__, j) => (
                    <td key={j} className="px-3 py-3">
                      <div className="h-4 bg-[var(--bg-section)] animate-pulse rounded-sm" style={{ width: j === 0 ? '60%' : j % 3 === 0 ? '40%' : '70%' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={skeletonCols} className="py-16 text-center text-[var(--muted)] text-sm">
                  {emptyState ?? 'No results.'}
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <React.Fragment key={row.id}>
                  <tr
                    key={row.id}
                    data-row-index={rowIndex}
                    tabIndex={0}
                    onClick={() => {
                      if (onRowClick) onRowClick(row.original);
                      if (expandedRowRenderer) {
                        setExpandedRowId(expandedRowId === row.id ? null : row.id);
                      }
                    }}
                    onKeyDown={(e) => handleRowKeyDown(e, row.id, rowIndex)}
                    className={`border-b border-[var(--divider)] transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)]/40 focus-visible:ring-inset ${
                      row.getIsSelected() ? 'bg-blue-50' : 'hover:bg-[var(--bg)]'
                    } ${onRowClick || expandedRowRenderer ? 'cursor-pointer' : ''}`}
                    aria-selected={enableRowSelection ? row.getIsSelected() : undefined}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const colDef = columns.find((c) => c.id === cell.column.id);
                      const alignClass =
                        colDef?.meta?.align === 'right'
                          ? 'text-right'
                          : colDef?.meta?.align === 'center'
                          ? 'text-center'
                          : 'text-left';
                      return (
                        <td
                          key={cell.id}
                          className={`px-3 py-3 text-[var(--ink)] ${alignClass} ${colDef?.meta?.className ?? ''}`}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                  {expandedRowRenderer && expandedRowId === row.id && (
                    <tr key={`${row.id}-expanded`} className="border-b border-[var(--divider)]">
                      <td colSpan={skeletonCols} className="px-4 py-3 bg-[var(--bg-section)]">
                        {expandedRowRenderer(row.original)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {hasPagination && !loading && data.length > 0 && (
        <PaginationControls
          pageIndex={state.pagination.pageIndex}
          pageSize={state.pagination.pageSize}
          pageCount={table.getPageCount()}
          total={table.getFilteredRowModel().rows.length}
          onPageChange={(p) => dispatch({ type: 'SET_PAGINATION', payload: { pageIndex: p } })}
          onPageSizeChange={(s) => dispatch({ type: 'SET_PAGINATION', payload: { pageSize: s, pageIndex: 0 } })}
        />
      )}
    </div>
  );
}
