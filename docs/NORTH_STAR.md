# FormsStanton — North Star

**The goal of this system is to get a qualified tenant into a unit with a signed HAP contract and rent flowing — as fast as possible, with zero lost paperwork.**

---

## What We're Building

Stanton Management has the ability to award Section 8 / Project-Based Vouchers to existing tenants. This is not an entitlement program — it's discretionary. Tenants wait 15+ years on the open housing authority list; this is a shortcut that Stanton controls.

The system exists to move tenants through every stage of that process — from first contact to the moment the housing authority pays Stanton and the tenant pays their share — without anything falling through the cracks.

**Every build decision should be evaluated against: does this move an application closer to `hap_executed`, or does it add friction?**

---

## The Pipeline

| Stage | What Happens | System |
|---|---|---|
| 1 | Prospect expresses interest | `/apartment-inquiry` lead capture |
| 2 | Prospect submits full rental application | `/rental-application` — income, household, Section 8 details, signature |
| 3 | Tenant completes PBV pre-application | Short qualification screen, auto-screened against income thresholds by household size |
| 4 | Tenant submits PBV full application | 33-document packet — income verification, signed HUD forms, household docs |
| 5 | HACH reviews and approves | Staff tracks status; HACH reviewer portal |
| 6 | Post-approval signing packet executed | Lease, tenancy addendum, lead paint, VAWA, HAP contract, move-in inspection — all signed and stored |
| 7 | **HAP executed → rent flows** | HACH pays HAP portion; tenant pays 30–40% of income. Terminal event: `hap_executed`. |

---

## Design Principles

**Speed over perfection.** A tenant stuck on a confusing form page costs days. A missing document that has to be re-requested costs weeks. Make the right action obvious and the wrong action hard.

**No lost state.** Paper gets lost. Email threads get lost. PDFs disappear. The system is the record — if it's not in the system, it didn't happen.

**The bottleneck is always a person, not the software.** Staff waiting on a tenant. Tenant waiting on a caseworker. HACH waiting on a document. The system's job is to make the current bottleneck visible and reduce the time to clear it.

**Stanton controls the shortcut.** This isn't an open housing authority queue — Stanton decides who gets vouchers. The software reflects that: discretionary, relationship-based, behavior-contingent. Award eligibility is tied to compliance, tenant behavior, unit cleanliness, lease adherence, no undue damage.

**This is a partnership, not a giveaway.** Tenant-facing messaging leads with the value ("you'd otherwise wait 15 years, potentially never") and frames the award as mutual. Do not frame it as "here's what you have to do." Frame it as "here's what we're building together."

**The tenant is not the customer — the HAP contract is.** Design for the outcome. Tenant satisfaction is a means to the end: compliance, clean unit, stable tenancy.

---

## Current Status

Stages 1–5 are built. The gap is **Stage 6–7: post-approval signing packet and HAP execution**. That is what stands between the current system and getting paid. The PRD for this is written (`docs/04-post-approval-execution_prd_2026-05-13.md`) and ready to build.
