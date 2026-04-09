# Asset ID as Canonical Building Key — Revised PRP

**Status:** Ready for implementation
**Last updated:** 2026-04-08
**Revision note:** Rewritten to reflect two-database architecture (forms DB `lieeeqqvshobnqofcdac` / main DB `wkwmxxlfheywwbgdbzxe`), no cross-DB FK constraints, consolidated building identity maps, and safe migration path for active projects.

---

## Problem Statement

The forms app joins `project_units` to `tenant_lookup` using address strings. AppFolio exports the same address in multiple formats across sync runs ("182 Affleck St", "182-184 Affleck St", "182-184 Affleck St Hartford, CT 06106"). A normalizer is a patch — every new format requires a code change.

The forms DB already has a `properties` table with `asset_id` (e.g. "S0028") — a human-readable, system-independent identifier that doesn't change. Switching all joins to `asset_id + unit_number` makes lookups permanently format-agnostic.

## Architecture Constraint

The forms DB and main DB are separate Supabase instances. This is intentional — the forms app is public-facing and must never have credentials to the main DB. No cross-DB foreign keys. `asset_id` is a plain text column validated at write time in application code. The forms DB's `properties.property_id` (UUID soft-reference to main DB `properties.id`) is a reconciliation handle only — not a join key.

---

## What Exists Today

### Forms DB `properties`
```
id, property_id (soft ref to main DB), asset_id, llc_name, portfolio, address, units_count, created_at
```
Populated via one-time CSV import. `asset_id` is already present and canonical.

### Forms DB `tenant_lookup`
```
id, name, first_name, last_name, phone, email, unit_number, building_address, move_in, status, is_current, created_at
```
**Columns added by this migration:** `asset_id TEXT`, `preferred_language TEXT DEFAULT 'en'`
Populated by two manual scripts:
- `import-rentroll-occupancy.ts` — wipes and replaces, occupancy flags only
- `import-csv-tenants.ts` — additive, actual names/contacts from AppFolio CSV export

Both scripts use `propertyNameToAddress` maps where keys encode asset_id: `"S0028 - 182 Affleck" → "182-184 Affleck St"`.

### Building identity maps (the duplication problem)
Three disconnected places define building identity:
1. `lib/buildings.ts` — hardcoded `buildings` array + `buildingUnits` map
2. `import-rentroll-occupancy.ts` — `propertyNameToAddress` map
3. `import-csv-tenants.ts` — `propertyNameToAddress` map

Adding a building requires updating all three with no validation between them.

---

## Plan

### Phase 1 — Schema + Backfill (no code behavior changes)

**Step 1: Consolidate building identity into `lib/buildings.ts`**

Add three exported maps. Full building list:

```ts
export const appfolioNameToAssetId: Record<string, string> = {
  "S0001 - 90 Park St": "S0001",
  "S0002 - 101 Maple": "S0002",
  "S0003 - 222 Maple": "S0003",
  "S0004 - 43 Frank": "S0004",
  "S0005 - 47 Frank": "S0005",
  "S0006 - 15 Whit": "S0006",
  "S0007 - 36 Whit": "S0007",
  "S0008 - 38 Whit": "S0008",
  "S0009 - 236 Maple": "S0009",
  "S0010 - 228 Maple": "S0010",
  "S0011 - 110 Martin": "S0011",
  "S0012 - 120 Martin": "S0012",
  "S0013 - 152 Wooster": "S0013",
  "S0014 - 160 Wooster": "S0014",
  "S0015 - 165 Westland": "S0015",
  "S0016 - 1721 Main": "S0016",
  "S0017 - 69 Chestnut": "S0017",
  "S0018 - 90 Edwards": "S0018",
  "S0019 - 93 Maple": "S0019",
  "S0020 - 31 Park": "S0020",
  "S0021 - 67 Park": "S0021",
  "S0022 - 83 Park": "S0022",
  "S0023 - 57 Park": "S0023",
  "S0024 - 10 Wolcott": "S0024",
  "S0025 - 179 Affleck": "S0025",
  "S0026 - 144 Affleck": "S0026",
  "S0027 - 178 Affleck": "S0027",
  "S0028 - 182 Affleck": "S0028",
  "S0029 - 190 Affleck": "S0029",
  "S0030 - 195 Affleck": "S0030",
  "S0031 - 88-90 Ward": "S0031",
  "S0032 - 865 Broad": "S0032",
  "S0033 - 142 Seymour": "S0033",
  "S0034 - 158 Seymour": "S0034",
  "S0035 - 164 Seymour": "S0035",
  "S0036 - 167 Seymour": "S0036",
  "S0037 - 169 Seymour": "S0037",
  "S0038 - 170 Seymour": "S0038",
  "S0039 - 180 Seymour": "S0039",
  "S0040 - 213 Buckingh": "S0040",
  "S0041 - 23-31 Squire": "S0041",
};

export const appfolioNameToAddress: Record<string, string> = {
  "S0001 - 90 Park St": "90 Park Street",
  "S0002 - 101 Maple": "97-103 Maple Ave",
  "S0003 - 222 Maple": "222-224 Maple Ave",
  "S0004 - 43 Frank": "43-45 Franklin Ave",
  "S0005 - 47 Frank": "47 Franklin Ave",
  "S0006 - 15 Whit": "15-17 Whitmore Street",
  "S0007 - 36 Whit": "36 Whitmore Street",
  "S0008 - 38 Whit": "38-40 Whitmore Street",
  "S0009 - 236 Maple": "236 Maple Ave",
  "S0010 - 228 Maple": "228 Maple Ave",
  "S0011 - 110 Martin": "110 Martin St",
  "S0012 - 120 Martin": "120 Martin St",
  "S0013 - 152 Wooster": "152-154 Wooster St",
  "S0014 - 160 Wooster": "160 Wooster St",
  "S0015 - 165 Westland": "165 Westland St",
  "S0016 - 1721 Main": "1721-1739 Main St",
  "S0017 - 69 Chestnut": "69-73 Chestnut St",
  "S0018 - 90 Edwards": "90 Edwards St",
  "S0019 - 93 Maple": "93-95 Maple Ave",
  "S0020 - 31 Park": "31-33 Park St",
  "S0021 - 67 Park": "67-73 Park St",
  "S0022 - 83 Park": "83-91 Park St",
  "S0023 - 57 Park": "57 Park St",
  "S0024 - 10 Wolcott": "10 Wolcott St",
  "S0025 - 179 Affleck": "179 Affleck St",
  "S0026 - 144 Affleck": "144-146 Affleck St",
  "S0027 - 178 Affleck": "178 Affleck St",
  "S0028 - 182 Affleck": "182 Affleck St",
  "S0029 - 190 Affleck": "190 Affleck St",
  "S0030 - 195 Affleck": "195 Affleck St",
  "S0031 - 88-90 Ward": "88-90 Ward St",
  "S0032 - 865 Broad": "865 Broad St",
  "S0033 - 142 Seymour": "142 Seymour St",
  "S0034 - 158 Seymour": "158 Seymour St",
  "S0035 - 164 Seymour": "164 Seymour St",
  "S0036 - 167 Seymour": "167 Seymour St",
  "S0037 - 169 Seymour": "169 Seymour St",
  "S0038 - 170 Seymour": "170 Seymour St",
  "S0039 - 180 Seymour": "180 Seymour St",
  "S0040 - 213 Buckingh": "213-217 Buckingham St",
  "S0041 - 23-31 Squire": "23-31 Squire St",
};

// Reverse lookup: canonical address → asset_id (for project activation, backfill)
export const buildingToAssetId: Record<string, string> = Object.fromEntries(
  Object.entries(appfolioNameToAddress).map(([afName, address]) => [address, appfolioNameToAssetId[afName]])
);
```

This is the single source of truth. Import scripts import from here instead of maintaining their own maps.

**Step 2: Add `asset_id` column to `tenant_lookup` and `project_units`**

```sql
-- Migration: add asset_id columns + preferred_language
ALTER TABLE tenant_lookup ADD COLUMN asset_id TEXT;
ALTER TABLE tenant_lookup ADD COLUMN preferred_language TEXT NOT NULL DEFAULT 'en';
ALTER TABLE project_units ADD COLUMN asset_id TEXT;

-- Index for the join pattern
CREATE INDEX idx_tenant_lookup_asset_unit ON tenant_lookup(asset_id, unit_number) WHERE is_current = true;
CREATE INDEX idx_project_units_asset_id ON project_units(asset_id);
```

No FK constraint. No NOT NULL on `asset_id` yet. `preferred_language` defaults to `'en'` — updated manually or via future sync when actual language data is available.

**Step 3: Backfill `project_units.asset_id`**

One-time SQL. This must cover every `building` value that exists in `project_units` today — if any active projects use buildings not in this list, they'll remain NULL and the validation query will catch them.

```sql
UPDATE project_units SET asset_id = CASE building
  WHEN '31-33 Park St' THEN 'S0020'
  WHEN '57 Park St' THEN 'S0023'
  WHEN '67-73 Park St' THEN 'S0021'
  WHEN '83-91 Park St' THEN 'S0022'
  WHEN '10 Wolcott St' THEN 'S0024'
  WHEN '144-146 Affleck St' THEN 'S0026'
  WHEN '178 Affleck St' THEN 'S0027'
  WHEN '182 Affleck St' THEN 'S0028'
  WHEN '190 Affleck St' THEN 'S0029'
  WHEN '179 Affleck St' THEN 'S0025'
  WHEN '195 Affleck St' THEN 'S0030'
  WHEN '90 Park Street' THEN 'S0001'
  WHEN '97-103 Maple Ave' THEN 'S0002'
  WHEN '222-224 Maple Ave' THEN 'S0003'
  WHEN '43-45 Franklin Ave' THEN 'S0004'
  WHEN '47 Franklin Ave' THEN 'S0005'
  WHEN '15-17 Whitmore Street' THEN 'S0006'
  WHEN '36 Whitmore Street' THEN 'S0007'
  WHEN '38-40 Whitmore Street' THEN 'S0008'
  WHEN '236 Maple Ave' THEN 'S0009'
  WHEN '228 Maple Ave' THEN 'S0010'
  WHEN '110 Martin St' THEN 'S0011'
  WHEN '120 Martin St' THEN 'S0012'
  WHEN '152-154 Wooster St' THEN 'S0013'
  WHEN '160 Wooster St' THEN 'S0014'
  WHEN '165 Westland St' THEN 'S0015'
  WHEN '1721-1739 Main St' THEN 'S0016'
  WHEN '69-73 Chestnut St' THEN 'S0017'
  WHEN '90 Edwards St' THEN 'S0018'
  WHEN '93-95 Maple Ave' THEN 'S0019'
  WHEN '88-90 Ward St' THEN 'S0031'
  WHEN '865 Broad St' THEN 'S0032'
  WHEN '142 Seymour St' THEN 'S0033'
  WHEN '158 Seymour St' THEN 'S0034'
  WHEN '164 Seymour St' THEN 'S0035'
  WHEN '167 Seymour St' THEN 'S0036'
  WHEN '169 Seymour St' THEN 'S0037'
  WHEN '170 Seymour St' THEN 'S0038'
  WHEN '180 Seymour St' THEN 'S0039'
  WHEN '213-217 Buckingham St' THEN 'S0040'
  WHEN '23-31 Squire St' THEN 'S0041'
END
WHERE asset_id IS NULL;
```

Validate: `SELECT * FROM project_units WHERE asset_id IS NULL` — should return zero rows.

**Step 4: Update import scripts to write `asset_id`**

Both `import-rentroll-occupancy.ts` and `import-csv-tenants.ts`:
- Import maps from `lib/buildings.ts` instead of maintaining local copies
- Extract `asset_id` from AppFolio property name: `key.split(' - ')[0]`
- Write `asset_id` on every insert
- Write `preferred_language = 'en'` as default on every insert (placeholder until actual language data is available)

Next import run populates `tenant_lookup.asset_id` for all rows.

**Checkpoint:** After Phase 1, both tables have `asset_id` populated. All existing behavior unchanged. No route code modified yet. Safe to verify before moving on.

---

### Phase 2 — Route Migration (one file at a time)

Each route file switches from address-string joins to `asset_id + unit_number`. Deploy individually — no big bang.

**File 1: `app/api/admin/projects/[id]/units/route.ts` GET**

Replace the `normalizeAddress` temp fix with:
```ts
const tenants = await supabaseAdmin
  .from('tenant_lookup')
  .select('asset_id, unit_number, name, first_name, last_name')
  .in('asset_id', assetIds)  // from project_units
  .eq('is_current', true);
```

**File 2: `app/api/admin/projects/[id]/activate/route.ts`**

At insert time:
- Resolve `asset_id = buildingToAssetId[u.building]` — hard error if not found
- Store `asset_id` on `project_units` row
- Lookup tenant name/language via `asset_id + unit_number`

**File 3: `app/api/admin/projects/[id]/units/route.ts` POST**

Same pattern as activate — store `asset_id`, lookup via `asset_id`.

**File 4: `app/api/admin/projects/[id]/send-links/route.ts`**

Replace `building||unit_number` contact lookup with `asset_id||unit_number`.

**File 5: `app/api/admin/projects/[id]/units/[unitId]/tasks/[taskId]/complete/route.ts`**

Parent-child lookup: `.eq('asset_id', unit.asset_id)` instead of `.eq('building', unit.building)`.

The `submissions` update (`.eq('building_address', unit.building)`) is a cross-subsystem concern — leave for a later phase.

---

### Phase 3 — Cleanup

After all routes are deployed and confirmed working:

```sql
ALTER TABLE project_units ALTER COLUMN asset_id SET NOT NULL;
ALTER TABLE tenant_lookup ALTER COLUMN asset_id SET NOT NULL;
```

`preferred_language` is already `NOT NULL DEFAULT 'en'` from the migration — no additional constraint needed.

Update `types/compliance.ts` — add `asset_id: string` to `ProjectUnit` interface.

---

## Adding New Buildings (post-migration)

1. Add row to forms DB `properties` table: `asset_id`, `address`, `llc_name`
2. Add entries to `lib/buildings.ts`: `buildingToAssetId`, `appfolioNameToAssetId`, `appfolioNameToAddress`
3. Run import scripts — `tenant_lookup.asset_id` populated automatically
4. No other code changes required

---

## What Does NOT Change

- `addressNormalizer.ts` — stays, still used by legacy `submissions`/`lobby`/`building-matrix` routes
- `tenant_lookup.building_address` — not dropped (still used by legacy routes)
- `project_units.building` — not dropped (still used for display)
- RLS policies — unchanged
- `submissions`, `lobby`, `forms` routes — out of scope
- No credentials to main DB added to forms app — the firewall stays

---

## Files Touched

| File | Change |
|------|--------|
| `supabase/migrations/..._add_asset_id.sql` | Add `asset_id` to `project_units` + `tenant_lookup`; add `preferred_language` to `tenant_lookup`; indexes |
| `lib/buildings.ts` | Add `buildingToAssetId`, `appfolioNameToAssetId`, `appfolioNameToAddress` exports |
| `scripts/import-rentroll-occupancy.ts` | Import maps from `lib/buildings.ts`, write `asset_id` |
| `scripts/import-csv-tenants.ts` | Import maps from `lib/buildings.ts`, write `asset_id` |
| `app/api/admin/projects/[id]/activate/route.ts` | Store `asset_id`; join via `asset_id` |
| `app/api/admin/projects/[id]/units/route.ts` | POST: store `asset_id`; GET: join via `asset_id` (remove normalizer) |
| `app/api/admin/projects/[id]/send-links/route.ts` | Join via `asset_id` for contacts |
| `app/api/admin/projects/[id]/units/[unitId]/tasks/[taskId]/complete/route.ts` | Parent-child lookup via `asset_id` |
| `types/compliance.ts` | Add `asset_id` to `ProjectUnit` interface |

---

## Open Questions

| Question | Status |
|----------|--------|
| Exact `asset_id` values for all buildings | **Resolved** — full S0001–S0041 list included in Step 1 maps and Step 3 backfill |
| AppFolio property name format consistency | **Resolved** — confirmed consistent across exports |
| `tenant_lookup` language column | **Resolved** — `preferred_language TEXT DEFAULT 'en'` added to this migration; defaults to English until real language data is imported |
