# Move-Out Inspection Form — PRD v1

**Status:** Draft — ready for review
**Last updated:** April 17, 2026
**Author:** Alex / Stanton Management

---

## Problem Statement

Move-out inspections currently happen ad-hoc. Inspector walks a unit, sends an email with whatever they remember, no photos, no structured damage assessment, no standardized pricing. Result: can't generate the 21-day itemized deposit letter cleanly, can't defend charges if disputed, inconsistent standards between inspections, impossible to onboard a new inspector without retraining from scratch.

Need: a structured walkthrough form that any field staff can use on mobile, produces auditable photo evidence, maps damage to a published rate schedule, and feeds clean input to whoever handles the deposit math and 21-day letter downstream.

---

## Scope

**In scope:** The inspector's walkthrough — unit condition, damage identification, photo documentation, key return tracking, standardized damage categorization, inspector signature.

**Out of scope:** Deposit math, wear-vs-damage final determination, 21-day itemization letter generation, tenant communication. Those live in a separate downstream flow (future PRD).

---

## Users & Roles

| Role | What they do |
|---|---|
| Inspector (Dean, future field staff) | Complete walkthrough form in-unit on mobile |
| Office staff (Tess) | Review completed inspection, apply deposit math, generate itemization letter |
| Management (Alex, Dan) | Maintain damage rate catalog, review flagged edge cases |

---

## Mental Model

Three layers, same pattern as the multi-project compliance system:

**Damage Catalog** — the reusable pricing table. Versioned. Staff-maintained.

**Inspection** — a single walkthrough record tied to a unit + tenant + inspection date. Locks to a catalog version on submission.

**Damage Items** — zero to many per inspection. Each one references a catalog item, captures photos, and inherits the charge from the catalog at submission time.

---

## Core Features

### 1. Inspection metadata
- Tenant name(s)
- Building (dropdown — existing list) + unit number
- Lease-end date + actual move-out date
- Inspection date
- Inspector name (auto-filled from logged-in staff)
- Forwarding address (if tenant provided)

### 2. Key & access return
- Unit keys: count returned / count issued
- Mailbox key (y/n)
- Parking permit returned (y/n — ties to existing permit system)
- Fobs / garage remotes returned (count)

### 3. Room-by-room condition
Per room (kitchen, each bath, each bedroom, living, common):
- Rating: clean / needs cleaning / damaged
- Notes field
- Optional overall room photo

### 4. Fixture & system checks
- Walls, floors, appliances, windows/blinds, fixtures each rated
- Smoke/CO detectors present + functional (y/n)
- Open notes field for anything that doesn't fit a category

### 5. Belongings left behind
- Y/N
- If yes: description + photos + haul-size dropdown (maps to catalog)

### 6. Damage items — catalog-driven
Per damage item:
- **Category** (dropdown from catalog — drywall, paint, flooring, etc.)
- **Severity/size** (dropdown scoped to category)
- **Room** (dropdown)
- **Photo** (required, 1–5)
- **Notes** (optional)
- **Flag for review** (checkbox — "I'm not sure if this is wear or damage")
- **Charge** — auto-populates from catalog. Inspector cannot edit.

### 7. Summary & submit
- Auto-calculated total estimated charges
- Overall unit condition rating (clean / light / moderate / heavy)
- Inspector signature (react-signature-canvas)
- Disclaimer shown: "Charges shown are estimates from the current damage schedule. Final deposit math is handled by the office."
- Submit locks the inspection to the active catalog version

---

## Damage Rate Catalog — Starter v1

**[Speculation]** All rates below are placeholders. Real rates need to come from Alex + Dan + what maintenance actually bills before publishing v1.

### Drywall
| Severity | Charge |
|---|---|
| Nail/screw hole (≤ dime) | $0 (wear) |
| Hole: dime to golf ball | $35 |
| Hole: golf ball to fist | $75 |
| Hole: larger than fist | $150 + estimate |

### Paint
| Severity | Charge |
|---|---|
| Scuffs/marks (normal use) | $0 (wear) |
| One wall touch-up | $50 |
| One wall full repaint | $100 |
| Full room repaint | $250 |
| Unauthorized color (full unit) | estimate |

### Flooring
| Severity | Charge |
|---|---|
| Carpet stain — small, cleanable | $0 |
| Carpet stain — spot replacement | $75 |
| Carpet burn/tear | $150 |
| Full carpet replacement | estimate by sqft |
| Hardwood scratch/gouge | $50 per spot |
| Vinyl/LVP tile replacement | $40 per tile |

### Doors & trim
| Severity | Charge |
|---|---|
| Interior door replacement | $175 |
| Damaged trim/baseboard | $50 per section |
| Door hardware replacement | $40 |

### Appliances
| Severity | Charge |
|---|---|
| Stovetop burner replacement | $75 per burner |
| Oven interior clean (neglect) | $100 |
| Refrigerator deep clean | $75 |
| Microwave replacement | $150 |
| Dishwasher repair/replacement | estimate |

### Fixtures
| Severity | Charge |
|---|---|
| Blind replacement | $35 per window |
| Light fixture replacement | $60 |
| Outlet/switch cover | $10 |
| Toilet seat replacement | $40 |
| Shower curtain rod | $30 |

### Cleaning
| Severity | Charge |
|---|---|
| Light clean | $100 |
| Deep clean | $250 |
| Extreme (hoarding/biohazard) | estimate |

### Belongings / trash haul
| Severity | Charge |
|---|---|
| Small (under 1 truckload) | $150 |
| Medium (1–2 truckloads) | $350 |
| Large (dumpster required) | estimate |

### Keys & access
| Severity | Charge |
|---|---|
| Unit key not returned | $50 (lock change) |
| Mailbox key not returned | $25 |
| Fob not returned | $75 |
| Parking permit not returned | $25 |

---

## Data Model

```sql
-- Versioned catalog
damage_catalog_versions (
  id uuid primary key,
  version_number integer not null,
  effective_date date not null,
  is_active boolean default false,
  created_by text,
  created_at timestamp default now()
)

damage_catalog_items (
  id uuid primary key,
  version_id uuid references damage_catalog_versions(id),
  category text not null,
  severity text not null,
  description text,
  charge_amount numeric,
  requires_estimate boolean default false,
  wear_and_tear boolean default false,
  display_order integer
)

-- Inspection record
move_out_inspections (
  id uuid primary key,
  building text not null,
  unit_number text not null,
  tenant_name text not null,
  lease_end_date date,
  actual_move_out_date date,
  inspection_date date not null,
  inspector_name text not null,
  forwarding_address text,

  unit_keys_issued integer,
  unit_keys_returned integer,
  mailbox_key_returned boolean,
  parking_permit_returned boolean,
  fobs_returned integer,

  room_conditions jsonb, -- { kitchen: {rating, notes, photo_url}, ... }
  smoke_co_functional boolean,
  fixture_notes jsonb,

  belongings_left boolean,
  belongings_description text,

  overall_condition text, -- 'clean' | 'light' | 'moderate' | 'heavy'
  inspector_signature text,
  inspection_complete boolean default false,
  completed_at timestamp,

  catalog_version_id uuid references damage_catalog_versions(id),
  project_id uuid references projects(id), -- nullable; links to multi-project system if used as a task
  created_at timestamp default now()
)

-- Damage items attached to an inspection
move_out_damage_items (
  id uuid primary key,
  inspection_id uuid references move_out_inspections(id),
  catalog_item_id uuid references damage_catalog_items(id),
  room text,
  notes text,
  photo_urls text[],
  flagged_for_review boolean default false,
  charge_amount_snapshot numeric, -- copied from catalog at submission
  created_at timestamp default now()
)
```

---

## Integration Points

| System | Direction | Purpose |
|---|---|---|
| Building/unit list | Read | Populate unit dropdown |
| Supabase Storage | Write | Photo uploads (damage items + room overviews) |
| Multi-project compliance system | Optional | Move-out inspection can register as a task type (evidence_type: `form`) |
| Document generator | Read | Feeds 21-day itemization letter (separate downstream PRD) |

---

## Implementation Phases

### Phase 1 — Catalog infrastructure
- DB schema for versioned catalog
- Admin UI to create/edit catalog versions
- Seed v1 — **replace [Speculation] rates with real numbers first**
- Publish v1 as active

### Phase 2 — Inspection form
- Mobile-first form in FormsStanton library
- Sections: metadata → keys → rooms → fixtures → belongings → damage items → summary
- Damage item flow: category → severity → photo → notes → charge auto-populated
- Signature + submit, locks to active catalog version

### Phase 3 — Review & export
- Staff-facing inspection list — filter by building, date, inspector
- Single inspection PDF export for file/email
- "Flagged for review" queue for wear-vs-damage edge cases

### Phase 4 — Integration with multi-project compliance
- Register as task type in the compliance system
- Can be assigned to a unit as part of any move-out project
- Feeds `task_completions` via existing architecture

### Phase 5 — 21-day letter generation (separate PRD)
- Takes inspection + deposit held + outstanding balances
- Generates itemized letter from template
- Office review + send

---

## Deferred / Out of Scope for v1

- Automated 21-day letter generation
- Tenant-facing dispute portal
- AI photo analysis for damage detection (discussed, not v1)
- AppFolio auto-charging integration
- Move-in inspection comparison (no structured move-in data exists yet)

---

## Open Questions

| Question | Who decides |
|---|---|
| **[Unverified]** 21-day deadline — CT statute, lease-specific, or policy? Confirm before launch. | Dan |
| Real catalog rates — **[Speculation]** rates above need review | Alex + Dan + maintenance |
| Can inspector edit within X hours of submission, or locked immediately? | Alex |
| Minimum photos per damage item — 1 or 2? | Alex |
| Who can edit the catalog — Alex/Dan only, or office staff too? | Alex |
| Does "flag for review" block downstream letter generation until resolved? | Alex |

---

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-17 | Inspector scope = walkthrough only, not deposit math | Separation of concerns — inspector categorizes, office prices |
| 2026-04-17 | Damage catalog is versioned; inspections lock to version at submission | Protects against disputes when rates change |
| 2026-04-17 | Charges auto-populate from catalog — no free-form dollar entry | Forces standardization, removes judgment-call variance |
| 2026-04-17 | Wear-vs-damage final call happens downstream; inspector can only flag uncertainty | Keeps inspector focused on observation, not legal determination |
