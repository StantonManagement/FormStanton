# Stanton Management — Project Knowledge Base

**Last updated:** March 19, 2026
**Maintained by:** Alex (Alexander Korallus-Shapiro / StantonCap)

---

## What This Is

A custom property management compliance platform built by Alex for Stanton Management. Replaces paper forms and generic SaaS tools. Lives at `form-stanton.vercel.app`. Built fast, iterated in production.

The first campaign was tenant onboarding (Feb 2025): pet registration, renters insurance verification, parking permits. That's now "Project #1" in the system. The platform is being generalized to handle any compliance campaign going forward.

---

## The Business

**Stanton Management LLC**
421 Park Street, Hartford CT 06106
Phone: (860) 993-3401

Property management company that recently took over multiple apartment buildings. Two portfolios currently in the system:

**Park / South End / North End portfolio** (the original onboarding campaign buildings):
- 31-33 Park St, 57 Park St, 67-73 Park St, 83-91 Park St, 10 Wolcott St
- 144-146, 178, 182, 190, 179, 195 Affleck St

**West End portfolio** — recently added to AppFolio, not yet fully onboarded into the compliance system.

**Key constraint: 20–40% hostile tenancy.** Tenants will not comply voluntarily. The system must make compliance the path of least resistance. Staff points at the screen; they don't negotiate.

---

## The Team

| Person | Role |
|---|---|
| Alex | Builder, decision-maker, primary developer |
| Dan Dvoskin | Co-decision-maker, legal/operational strategy |
| Tess Dumalagan | Office staff, handles document uploads, AppFolio admin |
| Will | Lobby intake — runs the in-person permit pickup process |
| Dean | Field staff / assistant property manager — showings, door-to-door, maintenance |
| Judy | New hire, not yet started — will handle lower-priority tasks like AppFolio document upload |
| Zach | Handles AppFolio setup tasks (bank accounts, property creation, etc.) |

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js (App Router) |
| Database + Storage | Supabase |
| Deployment | Vercel |
| Signatures | react-signature-canvas |
| Doc generation | docxtemplater + docxtemplater-image-module-free |
| Email | Resend |
| SMS | Twilio (in progress — not yet live) |
| Property management | AppFolio (API access confirmed) |

---

## What's Built

- **Tenant onboarding form** — trilingual (EN/ES/PT), collects pet, insurance, vehicle info, generates signed Word docs
- **Lobby intake form** — staff-facing version Will uses in person; includes ID upload, add pets/vehicles, insurance verification, ESA handling
- **Compliance matrix** — shows all units, completion status per task column (pet doc, insurance, vehicle addendum, etc.)
- **Projects system** — staff can create named campaigns, define tasks, scope units, generate unique magic links per unit
- **Magic links** — `form-stanton.vercel.app/t/[token]`, one per unit per project, tenant sees only their tasks
- **Document generation** — pet addendum, no-pets acknowledgment, vehicle addendum filled from templates on submission
- **Bulk AppFolio fee upload** — in testing; pulls occupancy IDs via API, generates CSV for bulk recurring charge import

---

## What's In Progress / Planned

- **Twilio SMS bulk send** — nearly done; will allow one-click link delivery to all units in a project
- **Pre-printed door notices with QR codes** — app generates per-unit notices listing what's missing, QR links to tenant's magic link
- **Compliance matrix action items view** — secondary view showing staff-side tasks (e.g., enroll tenant in AppFolio insurance), not just tenant completion status
- **One-way language sync** — AppFolio (mono DB) → forms DB `tenant_profiles` table; delivers preferred language so portal auto-loads correct language
- **West End onboarding** — next campaign after South/North End compliance is resolved

---

## Current Compliance Campaign Status (March 2026)

South End and North End have major noncompliance. Door-to-door campaign planned this week with Dean/Will. Pre-printed notices with QR codes will be generated per unit. Will knock every door regardless — even compliant units need the no-pet acknowledgment signed.

**What "fully compliant" looks like for a unit:**
- Pet addendum signed (or no-pets acknowledgment signed)
- Renters insurance uploaded with correct coverage limit AND additional insured confirmed — OR opted into AppFolio-added insurance
- Vehicle addendum signed (if they have a vehicle)
- All documents stored in Supabase, status marked in compliance matrix

**AppFolio document upload** (signed docs from submissions) — deferred. Keeping in Supabase database for now. Will assign to Judy or new hire when bandwidth exists.

---

## Key Business Rules (Locked)

- Everyone signs pet section — either registers pets or signs no-pet acknowledgment
- Everyone addresses insurance — uploads proof (with correct LLC as additional insured + minimum coverage) or opts into rent-added insurance
- Vehicle section only required if they have a vehicle
- Legal addendums stay in English regardless of tenant language
- Renters insurance must show: tenant address, minimum $100K liability ($300K with pets), correct LLC as "Additional Insured" at 421 Park St, Hartford CT 06106
- Pet noncompliance fee: $500 + back-owed pet rent from date of no-pet acknowledgment
- Parking: vehicles without permit after Feb 28 get towed

---

## LLC → Additional Insured Mapping

| Building | LLC |
|---|---|
| 31-33 Park St | SREP Park 1 LLC c/o Stanton Management LLC |
| 57 Park St | SREP Park 4 LLC c/o Stanton Management LLC |
| 67-73 Park St | SREP Park 2 LLC c/o Stanton Management LLC |
| 83-91 Park St | SREP Park 3 LLC c/o Stanton Management LLC |
| 10 Wolcott St | SREP Park 5 LLC c/o Stanton Management LLC |
| 144-146, 178, 182, 190 Affleck St | SREP Park 7 LLC c/o Stanton Management LLC |
| 179 Affleck St | SREP Park 6 LLC c/o Stanton Management LLC |
| 195 Affleck St | SREP Park 8 LLC c/o Stanton Management LLC |

---

## Open Decisions / Known Issues

- AppFolio renters insurance enrollment — need to confirm what info AppFolio requires to add insurance to rent; may need a follow-up form for tenants who opted in
- ESA documentation standard — must be a letter from licensed mental health professional (therapist, psychologist, psychiatrist, or physician) on official letterhead with license number. Certificate/ID cards are not sufficient. Will needs training on this.
- Angelica's entry has stale vehicle data — needs to be deleted from compliance matrix
- Pet document column showing broken for some units — needs investigation
- Photos on lobby form not displaying in modal — known bug, needs fix

---

## PRDs / Specs in This Project

| Document | Status |
|---|---|
| `TENANT_FORM_SPECIFICATION.md` | Complete — original onboarding form spec v1.0 |
| `multi-project-compliance-prp.md` | Complete — multi-project system design, ready for implementation |
| PRD: Tenant Portal (`/t/[token]`) | Not yet written |
| PRD: Door notice / QR code generation | Not yet written — most immediate |
| PRD: Compliance matrix v2 (project-aware) | Not yet written |
