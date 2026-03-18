# Stage 2: Modular Compliance Column Registry

Replace all hardcoded compliance checks with a single column-definition registry so adding a new requirement means adding one entry to the registry + the DB fields, not touching 7 files.

---

## Audit Summary (Current State)

The same 7 compliance items are hardcoded **independently** in 7 files:

| File | What's hardcoded | Lines affected |
|---|---|---|
| `BuildingMatrixTable.tsx:17-93` | `computeNextAction()` — 12 if-checks across 5 priority tiers | ~75 lines |
| `MatrixFilterBar.tsx:5-91` | `MatrixFilter` union, 7 `FILTER_DEFS`, 7 switch cases in `applyMatrixFilters` | ~90 lines |
| `building-matrix/route.ts:250-268` | 12 `.filter()` calls computing `BuildingMatrixStats` | ~18 lines |
| `BuildingHeader.tsx:23-52` | 5 stat pills with conditional spreads | ~30 lines |
| `BuildingMatrixTable.tsx:195-380` | 7 `<th>` headers + 7 cell component instances | ~185 lines |
| `PortfolioTable.tsx:104-138` | 7 `<th>` headers + 7 `<FractionCell>` instances | ~35 lines |
| `types/compliance.ts:84-101` | `BuildingMatrixStats` — 12 named stat fields | ~18 lines |

**Today:** Adding one new compliance column (e.g., "Lead Paint Disclosure") requires editing all 7 locations.
**After:** Add one entry to the registry array.

---

## What Changes

### 1. NEW: `lib/complianceColumns.ts` — The Registry

**Minimal shared interface** — the registry functions accept only the fields they read, not the full `MatrixRow`. This lets both `MatrixRow` and raw `TenantSubmission` objects satisfy the contract without casting:

```ts
/** Minimal fields that both MatrixRow and raw TenantSubmission share */
export interface ComplianceRecord {
  has_vehicle: boolean;
  has_pets: boolean;
  has_insurance: boolean;
  requires_parking_permit: boolean;
  vehicle_addendum_file: string | null;
  vehicle_addendum_uploaded_to_appfolio: boolean;
  pet_addendum_file: string | null;
  pet_addendum_uploaded_to_appfolio: boolean;
  insurance_file: string | null;
  insurance_uploaded_to_appfolio: boolean;
  pet_fee_added_to_appfolio: boolean;
  permit_fee_added_to_appfolio: boolean;
  permit_issued: boolean;
  calculated_pet_fee: number | null;
  calculated_permit_fee: number | null;
}
```

Column definitions use `ComplianceRecord` for applicability/completion, and `MatrixRow` only for cell-rendering props:

```ts
interface BaseColumnDef {
  id: string;                 // 'vehicle_doc', 'pet_fee', 'permit', etc.
  label: string;              // Table header text
  priority: number;           // Action urgency (1 = red, 2 = blue, 3 = amber)
  isApplicable: (rec: ComplianceRecord) => boolean;
  isComplete: (rec: ComplianceRecord) => boolean;
  getAction: (rec: ComplianceRecord) => { text: string; level: 'red'|'blue'|'amber' } | null;
}

// Discriminated union for cell rendering:
interface DocColumnDef extends BaseColumnDef {
  cellType: 'doc';
  getDocCellProps: (row: MatrixRow) => {
    filePath: string | null;
    uploadedToAppfolio: boolean;
    uploadedBy: string | null;
    uploadedAt: string | null;
    documentType: string;
  };
}

interface FeeColumnDef extends BaseColumnDef {
  cellType: 'fee';
  feeType: string;            // 'pet_rent' | 'permit_fee'
  getFeeCellProps: (row: MatrixRow) => {
    feeLoaded: boolean;
    feeAmount: number | null;
    loadedBy: string | null;
    loadedAt: string | null;
    calculatedFee: number | null;
  };
}

interface StatusColumnDef extends BaseColumnDef {
  cellType: 'status';
  getStatusCellProps: (row: MatrixRow) => {
    done: boolean;
    doneLabel: string;
    pendingLabel: string;
    auditBy: string | null;
    auditAt: string | null;
  };
}

export type ComplianceColumnDef = DocColumnDef | FeeColumnDef | StatusColumnDef;

export const COMPLIANCE_COLUMNS: ComplianceColumnDef[] = [
  // 6 entries: vehicle_doc, pet_doc, insurance, pet_fee, permit_fee, permit
];
```

Each entry's `isApplicable` / `isComplete` / `getAction` replaces the hardcoded checks that currently live in `computeNextAction`, filter bar, stats, etc.

### 2. `BuildingMatrixTable.tsx` — Use Registry

**`computeNextAction()`** (lines 17-93 → ~15 lines):
```ts
function computeNextAction(row: MatrixRow): RowAction {
  if (row.missing) return { text: '⚠ No submission', level: 'red', totalRemaining: 1 };

  const actions = COMPLIANCE_COLUMNS
    .map(col => col.getAction(row))
    .filter(Boolean);

  const allComplete = COMPLIANCE_COLUMNS.every(
    col => !col.isApplicable(row) || col.isComplete(row)
  );

  if (allComplete) return { text: '✓ Complete', level: 'green', totalRemaining: 0 };
  if (actions.length === 0) return { text: 'Incomplete', level: 'amber', totalRemaining: 1 };
  return { text: actions[0].text, level: actions[0].level, totalRemaining: actions.length };
}
```

**Table headers** (lines 195-203 → loop):
```tsx
{COMPLIANCE_COLUMNS.map(col => (
  <th key={col.id} className={`${thClass} text-center`}>{col.label}</th>
))}
```

**Table cells** (lines 287-380 → loop with switch on `cellType`):
```tsx
{COMPLIANCE_COLUMNS.map(col => {
  switch (col.cellType) {
    case 'doc': return <MatrixDocumentCell key={col.id} {...col.getDocCellProps(row)} submissionId={row.submission_id} missing={isMissing} onRefresh={onRefresh} tenantName={name} unitNumber={row.unit_number} onToast={onToast} />;
    case 'fee': return <MatrixFeeCell key={col.id} {...col.getFeeCellProps(row)} applicable={col.isApplicable(row)} missing={isMissing} feeType={col.feeType} onOpenPopover={(rect) => handleOpenFeePopover(col, row, rect)} ... />;
    case 'status': return <MatrixStatusCell key={col.id} {...col.getStatusCellProps(row)} applicable={col.isApplicable(row)} missing={isMissing} />;
  }
})}
```

**Fee popover handlers** (lines 141-165): Replace two separate handlers with one generic:
```ts
const handleOpenFeePopover = useCallback((col: FeeColumnDef, row: MatrixRow, rect: DOMRect) => {
  if (!row.submission_id) return;
  const props = col.getFeeCellProps(row);
  setPopover({
    submissionId: row.submission_id,
    feeType: col.feeType,
    label: `${col.label} — ${getTenantName(row)}`,
    anchorRect: rect,
    tenantName: getTenantName(row),
    unitNumber: row.unit_number,
    defaultAmount: props.calculatedFee,
  });
}, [getTenantName]);
```

PopoverState `feeType` changes from `'pet_rent' | 'permit_fee'` to `string`.

### 3. `MatrixFilterBar.tsx` — Derive from Registry

**`MatrixFilter` type** (line 5): Changes from hardcoded union to `string`.

**`FILTER_DEFS`** (lines 21-57 → derived):
```ts
const COLUMN_FILTERS = COMPLIANCE_COLUMNS.map(col => ({
  id: col.id,
  label: col.label,
  countFn: (rows: MatrixRow[]) => rows.filter(r => col.isApplicable(r) && !col.isComplete(r) && !r.missing).length,
}));

const FILTER_DEFS = [
  ...COLUMN_FILTERS,
  { id: 'missing_submission', label: 'Missing', countFn: (rows: MatrixRow[]) => rows.filter(r => r.missing).length },
];
```

**`applyMatrixFilters()`** (lines 60-91 → derived):
```ts
export function applyMatrixFilters(rows: MatrixRow[], activeFilters: Set<string>): MatrixRow[] {
  if (activeFilters.size === 0) return rows;
  return rows.filter(row => {
    for (const fId of activeFilters) {
      if (fId === 'missing_submission') { if (row.missing) return true; continue; }
      const col = COMPLIANCE_COLUMNS.find(c => c.id === fId);
      if (col && col.isApplicable(row) && !col.isComplete(row) && !row.missing) return true;
    }
    return false;
  });
}
```

### 4. `types/compliance.ts` — Generic Stats

**`BuildingMatrixStats`** (lines 84-101): Replace 12 named fields with:
```ts
export interface ColumnStat {
  complete: number;
  total: number;
}

export interface BuildingMatrixStats {
  total_units: number;
  occupied_units: number;
  submissions: number;
  missing_submissions: number;
  columns: Record<string, ColumnStat>;  // keyed by column ID
}
```

**`PortfolioBuildingStats`** (lines 104-125): Same change:
```ts
export interface PortfolioBuildingStats {
  building_address: string;
  asset_id: string;
  portfolio: string;
  total_units: number;
  occupied_units: number;
  submissions: number;
  columns: Record<string, ColumnStat>;
  completion_score: number;
}
```

### 5. `building-matrix/route.ts` — Stats via Registry

**Stats block** (lines 250-268 → loop):
```ts
import { COMPLIANCE_COLUMNS } from '@/lib/complianceColumns';

const columnStats: Record<string, ColumnStat> = {};
for (const col of COMPLIANCE_COLUMNS) {
  const applicable = withSub.filter(r => col.isApplicable(r));
  const complete = applicable.filter(r => col.isComplete(r));
  columnStats[col.id] = { complete: complete.length, total: applicable.length };
}

const stats: BuildingMatrixStats = {
  total_units: knownUnits.length,
  occupied_units: buildingTenants.length,
  submissions: withSub.length,
  missing_submissions: rows.filter(r => r.missing).length,
  columns: columnStats,
};
```

### 6. `BuildingHeader.tsx` — Dynamic Pills

**Pills array** (lines 23-52 → loop):
```ts
const pills = [
  { label: 'Submissions', value: `${stats.submissions}/${stats.occupied_units}`, tone: ... },
  ...Object.entries(stats.columns)
    .filter(([_, s]) => s.total > 0)
    .map(([colId, s]) => {
      const col = COMPLIANCE_COLUMNS.find(c => c.id === colId);
      return {
        label: col?.label || colId,
        value: `${s.complete}/${s.total}`,
        tone: s.complete === s.total ? 'good' : s.complete > 0 ? 'attention' : 'critical',
      };
    }),
  { label: 'Missing', value: `${stats.missing_submissions}`, tone: ... },
];
```

### 7. `PortfolioTable.tsx` — Dynamic Columns

**Headers** (lines 104-109 → loop):
```tsx
{COMPLIANCE_COLUMNS.map(col => (
  <th key={col.id} className={thClass}>{col.label}</th>
))}
```

**Cells** (lines 133-138 → loop):
```tsx
{COMPLIANCE_COLUMNS.map(col => {
  const s = row.columns[col.id];
  return s ? <FractionCell key={col.id} num={s.complete} den={s.total} /> : <td key={col.id}>—</td>;
})}
```

### 8. `page.tsx` — portfolioBuildingStats

**Lines 352-404**: Update to build `columns: Record<string, ColumnStat>` instead of 12 named fields. Uses the shared `computeColumnStats()` helper exported from `lib/complianceColumns.ts`:

```ts
// In lib/complianceColumns.ts:
export function computeColumnStats(records: ComplianceRecord[]): Record<string, ColumnStat> {
  const result: Record<string, ColumnStat> = {};
  for (const col of COMPLIANCE_COLUMNS) {
    const applicable = records.filter(r => col.isApplicable(r));
    const complete = applicable.filter(r => col.isComplete(r));
    result[col.id] = { complete: complete.length, total: applicable.length };
  }
  return result;
}
```

Both the API route (Step 3, operating on `MatrixRow[]`) and the client-side `portfolioBuildingStats` (Step 6, operating on raw `TenantSubmission[]`) call `computeColumnStats()`. Works because both types satisfy `ComplianceRecord`. No casting needed.

**Note:** Raw `TenantSubmission` objects lack `requires_parking_permit` and `calculated_pet_fee`/`calculated_permit_fee`. These must be computed inline when building the `ComplianceRecord[]` array for each building's submissions — using `getBuildingRequirements()` for parking and the existing fee calculation functions.

---

## What Does NOT Change

| File | Why |
|---|---|
| `MatrixDocumentCell.tsx` | Already generic — takes props, renders cell |
| `MatrixFeeCell.tsx` | Already generic |
| `MatrixStatusCell.tsx` | Already generic |
| `FeeEntryPopover.tsx` | Already generic |
| `TenantSidePanel.tsx` | Doesn't use column logic |
| `ComplianceTabs.tsx` | Doesn't use column logic |
| `BulkActionsBar.tsx` | Doesn't use column logic |
| `MatrixRow` flat fields | Mirrors DB columns — kept flat |
| `buildingRequirements.ts` | Stage 1 config — still used by API |

---

## Execution Order

| Step | Files | Verify |
|---|---|---|
| 1 | Create `lib/complianceColumns.ts` with 6 column defs | TypeScript compiles |
| 2 | Change `BuildingMatrixStats` + `PortfolioBuildingStats` to generic `columns` map | Fix type errors in consumers |
| 3 | Refactor `building-matrix/route.ts` stats to use registry | API returns same data, new shape |
| 4 | Refactor `BuildingHeader.tsx` pills to iterate `stats.columns` | Pills render correctly |
| 5 | Refactor `PortfolioTable.tsx` headers + cells to iterate registry | Portfolio table renders correctly |
| 6 | Refactor `page.tsx` `portfolioBuildingStats` to build `columns` map | Portfolio table still works |
| 7 | Refactor `computeNextAction()` to use registry | Status column shows same results |
| 8 | Refactor `MatrixFilterBar.tsx` to derive from registry | Filters work identically |
| 9 | Refactor `BuildingMatrixTable` headers + cells to loop registry | Table renders identically |
| 10 | `next build` — verify clean compile | No TS errors, Vercel-ready |

---

## Risk Assessment

- **Biggest risk:** Step 9 (table cell rendering loop). Each cell type needs different props and the fee cells need popover context. The discriminated union approach handles this but is the most complex change.
- **Mitigation:** Steps 1-8 can be verified independently. Step 9 is the last step.
- **Rollback:** Branch-based — main is clean.

---

## Future (Phase 2B)

- DB table `building_requirements` for per-building config (no code changes to add requirements)
- New API `/api/admin/compliance/portfolio-stats` to eliminate client-side stats duplication
- Dynamic `MatrixRow` fields (EAV or JSONB) for truly arbitrary requirements
