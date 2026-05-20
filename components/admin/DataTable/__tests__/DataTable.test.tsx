/// <reference types="vitest/globals" />
import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataTable } from '../DataTable';
import type { ColumnDef, BulkAction } from '../types';

// ── Next.js navigation mocks ──────────────────────────────────────────────────
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// ── @dnd-kit mock (avoid pointer-events issues in jsdom) ──────────────────────
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  closestCenter: vi.fn(),
  KeyboardSensor: class {},
  PointerSensor: class {},
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));
vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: '',
    isDragging: false,
  }),
  verticalListSortingStrategy: vi.fn(),
  arrayMove: (arr: unknown[], from: number, to: number) => {
    const result = [...arr];
    const [item] = result.splice(from, 1);
    result.splice(to, 0, item);
    return result;
  },
}));
vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

// ── Test data ─────────────────────────────────────────────────────────────────

type TestRow = {
  id: string;
  name: string;
  status: string;
  amount: number;
  date: string;
};

const TEST_DATA: TestRow[] = [
  { id: '1', name: 'Alpha', status: 'active', amount: 100, date: '2026-01-01' },
  { id: '2', name: 'Beta', status: 'inactive', amount: 200, date: '2026-02-01' },
  { id: '3', name: 'Gamma', status: 'active', amount: 300, date: '2026-03-01' },
  { id: '4', name: 'Delta', status: 'pending', amount: 400, date: '2026-04-01' },
  { id: '5', name: 'Epsilon', status: 'inactive', amount: 500, date: '2026-05-01' },
];

const TEST_COLUMNS: ColumnDef<TestRow>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Name',
    enableSorting: true,
    enableFiltering: true,
    meta: { filter: { type: 'text' } },
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    enableSorting: true,
    enableFiltering: true,
    meta: {
      filter: {
        type: 'select',
        multi: true,
        options: [
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' },
          { label: 'Pending', value: 'pending' },
        ],
      },
    },
  },
  {
    id: 'amount',
    accessorKey: 'amount',
    header: 'Amount',
    enableSorting: true,
  },
  {
    id: 'date',
    accessorKey: 'date',
    header: 'Date',
    enableSorting: true,
    enableFiltering: true,
    meta: { filter: { type: 'dateRange' } },
  },
];

function renderTable(overrides: Partial<Parameters<typeof DataTable<TestRow>>[0]> = {}) {
  return render(
    <DataTable<TestRow>
      data={TEST_DATA}
      columns={TEST_COLUMNS}
      urlNamespace="test"
      getRowId={(r) => r.id}
      enableUrlState={false}
      enablePagination={false}
      {...overrides}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────

describe('DataTable — rendering', () => {
  it('renders all rows from data prop', () => {
    renderTable();
    expect(screen.getAllByText(/Alpha/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Beta/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Gamma/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Delta/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Epsilon/i).length).toBeGreaterThan(0);
  });

  it('renders column headers', () => {
    renderTable();
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Status')).toBeTruthy();
    expect(screen.getByText('Amount')).toBeTruthy();
  });

  it('table root has role="grid"', () => {
    renderTable();
    expect(screen.getByRole('grid')).toBeTruthy();
  });
});

describe('DataTable — empty state', () => {
  it('renders generic empty state when data is empty', () => {
    renderTable({ data: [] });
    expect(screen.getByText('No results.')).toBeTruthy();
  });

  it('renders custom emptyState when provided', () => {
    renderTable({ data: [], emptyState: <span>Nothing here</span> });
    expect(screen.getByText('Nothing here')).toBeTruthy();
  });
});

describe('DataTable — loading state', () => {
  it('renders skeleton rows when loading=true', () => {
    renderTable({ loading: true });
    const grid = screen.getByRole('grid');
    expect(grid.getAttribute('aria-busy')).toBe('true');
    const hiddenRows = grid.querySelectorAll('tr[aria-hidden="true"]');
    expect(hiddenRows.length).toBeGreaterThan(0);
  });

  it('does not render data rows when loading', () => {
    renderTable({ loading: true });
    expect(screen.queryByText('Alpha')).toBeNull();
  });
});

describe('DataTable — sorting', () => {
  it('clicking a sortable header toggles to ascending', async () => {
    renderTable();
    const nameHeader = screen.getByText('Name').closest('button') ?? screen.getByText('Name');
    await act(async () => fireEvent.click(nameHeader));
    const grid = screen.getByRole('grid');
    const th = grid.querySelector('th[aria-sort="ascending"]');
    expect(th).toBeTruthy();
  });

  it('clicking again toggles to descending', async () => {
    renderTable();
    const nameHeader = screen.getByText('Name').closest('button') ?? screen.getByText('Name');
    await act(async () => fireEvent.click(nameHeader));
    await act(async () => fireEvent.click(nameHeader));
    const grid = screen.getByRole('grid');
    const th = grid.querySelector('th[aria-sort="descending"]');
    expect(th).toBeTruthy();
  });

  it('sortable headers have aria-sort="none" by default', () => {
    renderTable();
    const grid = screen.getByRole('grid');
    const noneHeaders = grid.querySelectorAll('th[aria-sort="none"]');
    expect(noneHeaders.length).toBeGreaterThan(0);
  });
});

describe('DataTable — global search', () => {
  it('shows search input when enableGlobalSearch=true', () => {
    renderTable({ enableGlobalSearch: true });
    expect(screen.getByRole('searchbox', { hidden: true }) ?? screen.getByPlaceholderText('Search…')).toBeTruthy();
  });

  it('filters rows when typing in global search', async () => {
    const user = userEvent.setup();
    renderTable({ enableGlobalSearch: true });
    const search = screen.getByPlaceholderText('Search…');
    await act(async () => {
      await user.type(search, 'Alpha');
    });
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByText('Beta')).toBeNull();
  });
});

describe('DataTable — row selection', () => {
  it('shows checkboxes when enableRowSelection=true', () => {
    renderTable({ enableRowSelection: true, enablePagination: false });
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(1);
  });

  it('select-all checkbox has correct aria-label', () => {
    renderTable({ enableRowSelection: true, enablePagination: false });
    const selectAll = screen.getByLabelText('Select all rows');
    expect(selectAll).toBeTruthy();
  });

  it('row checkboxes have aria-label with row id', () => {
    renderTable({ enableRowSelection: true, enablePagination: false });
    const rowCheckbox = screen.getByLabelText('Select row 1');
    expect(rowCheckbox).toBeTruthy();
  });

  it('calls onSelectionChange when a row is selected', async () => {
    const onSelectionChange = vi.fn();
    renderTable({ enableRowSelection: true, enablePagination: false, onSelectionChange });
    const checkbox = screen.getByLabelText('Select row 1');
    await act(async () => fireEvent.click(checkbox));
    expect(onSelectionChange).toHaveBeenCalled();
    const args = onSelectionChange.mock.calls[onSelectionChange.mock.calls.length - 1][0] as TestRow[];
    expect(args.some((r) => r.id === '1')).toBe(true);
  });
});

describe('DataTable — bulk action bar', () => {
  const bulkActions: BulkAction<TestRow>[] = [
    { label: 'Mark Done', onClick: vi.fn() },
    { label: 'Delete', variant: 'danger', onClick: vi.fn() },
  ];

  it('bulk action bar is hidden when no rows selected', () => {
    renderTable({ enableRowSelection: true, bulkActions });
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).toBeNull();
  });

  it('bulk action bar appears when a row is selected', async () => {
    renderTable({ enableRowSelection: true, bulkActions });
    const checkbox = screen.getByLabelText('Select row 1');
    await act(async () => fireEvent.click(checkbox));
    expect(screen.getByRole('region', { name: 'Bulk actions' })).toBeTruthy();
  });

  it('bulk action click calls handler with selected rows', async () => {
    const handler = vi.fn();
    const actions: BulkAction<TestRow>[] = [{ label: 'Do Thing', onClick: handler }];
    renderTable({ enableRowSelection: true, bulkActions: actions });
    const checkbox = screen.getByLabelText('Select row 1');
    await act(async () => fireEvent.click(checkbox));
    const btn = screen.getByText('Do Thing');
    await act(async () => fireEvent.click(btn));
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0]).toHaveLength(1);
  });

  it('bulk action bar disappears after clearing selection', async () => {
    renderTable({ enableRowSelection: true, bulkActions });
    const checkbox = screen.getByLabelText('Select row 1');
    await act(async () => fireEvent.click(checkbox));
    const clearBtn = screen.getByLabelText('Clear selection');
    await act(async () => fireEvent.click(clearBtn));
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).toBeNull();
  });
});

describe('DataTable — pagination', () => {
  const paginatedData: TestRow[] = Array.from({ length: 60 }, (_, i) => ({
    id: String(i + 1),
    name: `Row ${i + 1}`,
    status: 'active',
    amount: i * 10,
    date: '2026-01-01',
  }));

  it('renders pagination controls', () => {
    renderTable({ data: paginatedData, enablePagination: { pageSize: 25 } });
    expect(screen.getByLabelText('Next page')).toBeTruthy();
    expect(screen.getByLabelText('Previous page')).toBeTruthy();
  });

  it('prev button is disabled on first page', () => {
    renderTable({ data: paginatedData, enablePagination: { pageSize: 25 } });
    const prev = screen.getByLabelText('Previous page');
    expect((prev as HTMLButtonElement).disabled).toBe(true);
  });

  it('page-size dropdown exists', () => {
    renderTable({ data: paginatedData, enablePagination: { pageSize: 25 } });
    expect(screen.getByLabelText('Rows per page')).toBeTruthy();
  });

  it('shows correct row count range', () => {
    const { container } = renderTable({ data: paginatedData, enablePagination: { pageSize: 25 } });
    const liveSpan = container.querySelector('[aria-live]');
    expect(liveSpan?.textContent).toMatch(/of 60/);
  });

  it('next page moves to page 2', async () => {
    renderTable({ data: paginatedData, enablePagination: { pageSize: 25 } });
    const next = screen.getByLabelText('Next page');
    await act(async () => fireEvent.click(next));
    expect(screen.getByText(/2 \/ /)).toBeTruthy();
  });
});

describe('DataTable — manual pagination', () => {
  const manualData: TestRow[] = Array.from({ length: 10 }, (_, i) => ({
    id: String(i + 1), name: `R${i + 1}`, status: 'active', amount: i, date: '2026-01-01',
  }));

  it('does not paginate client-side in manual mode', () => {
    const { container } = renderTable({
      data: manualData,
      manualPagination: true,
      pageCount: 5,
      enablePagination: { pageSize: 10 },
    });
    const tbody = container.querySelector('tbody');
    const dataRows = tbody?.querySelectorAll('tr:not([aria-hidden])') ?? [];
    expect(dataRows.length).toBe(10);
  });

  it('displays pageCount from prop', () => {
    renderTable({
      data: manualData,
      manualPagination: true,
      pageCount: 7,
      enablePagination: { pageSize: 10 },
    });
    expect(screen.getByText(/1 \/ 7/)).toBeTruthy();
  });
});

describe('DataTable — column visibility', () => {
  it('column visibility menu button is visible', () => {
    renderTable({ enableColumnVisibility: true });
    expect(screen.getByLabelText('Toggle column visibility')).toBeTruthy();
  });

  it('opens column visibility menu on click', async () => {
    renderTable({ enableColumnVisibility: true });
    const btn = screen.getByLabelText('Toggle column visibility');
    await act(async () => fireEvent.click(btn));
    expect(screen.getByRole('dialog', { name: 'Column visibility' })).toBeTruthy();
  });

  it('hiding a column removes it from rendered headers', async () => {
    renderTable({ enableColumnVisibility: true });
    const btn = screen.getByLabelText('Toggle column visibility');
    await act(async () => fireEvent.click(btn));
    const amountCheckbox = screen.getByLabelText('Hide Amount');
    await act(async () => fireEvent.click(amountCheckbox));
    expect(screen.queryByRole('columnheader', { name: /Amount/i })).toBeNull();
  });
});

describe('DataTable — expanded row renderer', () => {
  it('clicking a row expands the detail panel', async () => {
    renderTable({
      expandedRowRenderer: (row) => <div data-testid="expanded">{row.name}</div>,
    });
    const nameCell = screen.getAllByText(/Alpha/i)[0];
    const firstRow = nameCell.closest('tr');
    expect(firstRow).toBeTruthy();
    await act(async () => fireEvent.click(firstRow!));
    expect(screen.getByTestId('expanded')).toBeTruthy();
  });

  it('clicking the row again collapses the detail panel', async () => {
    renderTable({
      expandedRowRenderer: (row) => <div data-testid="expanded">{row.name}</div>,
    });
    const nameCell = screen.getAllByText(/Alpha/i)[0];
    const firstRow = nameCell.closest('tr');
    await act(async () => fireEvent.click(firstRow!));
    await act(async () => fireEvent.click(firstRow!));
    expect(screen.queryByTestId('expanded')).toBeNull();
  });
});

describe('DataTable — CSV export', () => {
  it('renders CSV export button when enableCsvExport=true', () => {
    renderTable({ enableCsvExport: true });
    expect(screen.getByLabelText('Export to CSV')).toBeTruthy();
  });

  it('CSV export calls URL.createObjectURL', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(window, 'URL', {
      value: { createObjectURL, revokeObjectURL },
      writable: true,
    });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderTable({ enableCsvExport: true });
    const btn = screen.getByLabelText('Export to CSV');
    await act(async () => fireEvent.click(btn));

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});
