# AppFolio Insurance Enrollment — Decision Memo

**Date:** April 30, 2026
**For:** Dan Dvoskin (approver), Alex Korallus-Shapiro (author/operator)
**Re:** How we deliver on the "add insurance to my rent" opt-in from the Feb 2026 onboarding campaign

---

## What you're being asked to decide

A meaningful number of our tenants checked the box during onboarding that said *"I do not have insurance. Please add renters insurance to my monthly rent."* We now need to actually deliver on that, and there is a product-level wrinkle in AppFolio that means we have to make a real choice — not just an operational one — before Allan can start enrolling anyone.

The choice has cost, legal, and reputational implications. **It needs to be made by you before any enrollments begin.**

---

## Background — how we got here

The tenant onboarding form (live since February 2025, now Project #1 in our compliance system) gave tenants two options for renters insurance:

1. **Bring your own** — upload proof of a policy with the right LLC named as additional insured and minimum liability coverage.
2. **We do it for you** — described to tenants as: *"We can sign you up through our partnership with Appfolio Renters Insurance. About $10–25 per month. Added to your rent. No extra bills."*

A portion of tenants chose option 2. Their submissions are flagged in the compliance matrix with `add_insurance_to_rent = true`. We have not yet enrolled any of them in anything. That's the gap.

[Unverified] — exact opt-in count is in the matrix and should be pulled before this conversation.

---

## The product wrinkle — "FolioGuard" is two different things

This is the part that matters and is easy to miss. AppFolio sells a bundle called **FolioGuard**. Inside that bundle there are two distinct insurance products that get marketed under the same name and that do *not* protect the same things:

### Product A — FolioGuard Smart Ensure (formerly "Liability to Landlord Insurance" / LLIP)

- **Who buys it:** Stanton buys a master policy. We add uncovered units to it.
- **Who's protected:** The landlord. Specifically, our LLCs are protected against tenant-caused property damage.
- **Who's NOT protected:** The tenant. Their belongings are not covered. Their personal liability (e.g., guest gets injured) is not covered.
- **How tenants pay:** We add a recoverable expense to their ledger, billed alongside rent. No tenant action required.
- **Mechanics:** Built into AppFolio. Allan can enroll units in a few clicks per unit.
- **Typical cost we'd charge tenants:** [Unverified] — typically $10–15/mo in the industry, exact rate depends on what AppFolio quoted us.

### Product B — FolioGuard Renters Insurance (real renters insurance, sold by AIS)

- **Who buys it:** The tenant. Through the AppFolio tenant portal. We can't enroll them.
- **Who's protected:** Tenant's belongings, tenant's personal liability ($100K), and our LLCs as "interested party" on the policy.
- **How tenants pay:** Through the portal directly to AIS. Not added to rent.
- **Mechanics:** Tenant logs in, clicks "Purchase Renters Insurance," completes signup with AIS. Underwritten by Spinnaker or Century-National.
- **Typical cost:** $10–25/mo, paid by tenant.
- **Availability:** [Inference] Connecticut is on Century-National's listed states, so this product is available to our tenants. Should be confirmed before relying on it.

### Why this matters

The form promised tenants *"renters insurance… added to your rent."* The thing that can actually be added to rent without tenant action is **Smart Ensure / LLIP — which is not renters insurance**. It's landlord protection. If a tenant's apartment is burglarized, LLIP does nothing for them.

Real renters insurance through AppFolio (Product B) requires the tenant to log into their portal and sign up themselves — which we can't do on their behalf, and which "added to rent" doesn't accurately describe.

**So the choice is: which gap do we close, and how honestly?**

---

## Three paths

### Path A — Enroll all opt-ins in Smart Ensure / LLIP. Move on.

**What happens:** Allan adds every opt-in unit to the master LLIP policy in AppFolio. Recoverable expense gets billed monthly. Lease insurance requirement is satisfied on paper. Done.

| Dimension | Detail |
|---|---|
| Operational lift | Low — Allan can process the full backlog in days |
| Tenant friction | Zero — they did their part by checking the box |
| Tenant actually protected | No. Belongings and personal liability are uncovered. |
| Lease compliance | Yes (LLIP satisfies most lease language for liability minimums) |
| Stanton revenue | Modest — markup on recoverable expense if we choose to charge one |
| Risk | Reputational + integrity. We told tenants they were getting "renters insurance." When something happens — fire, theft, dog bite — they will discover they have nothing. We can expect complaints, possibly small claims, and degraded trust. Hartford has tenant-protective courts; this is not nothing. |

### Path B — Push every opt-in tenant to sign up through the portal for real renters insurance.

**What happens:** Allan and Will walk each opt-in tenant through portal signup for FolioGuard Renters Insurance (Product B). Tenants pay AIS directly through the portal.

| Dimension | Detail |
|---|---|
| Operational lift | High — every tenant requires individual outreach + portal walkthrough |
| Tenant friction | High — they checked a box expecting passive enrollment, now we're asking them to log in and complete a signup |
| Tenant actually protected | Yes — real coverage |
| Lease compliance | Yes |
| Stanton revenue | None — money goes to AIS |
| Risk | We give back the easy promise we made. With ~20–40% hostile tenancy, [Inference] half or more won't follow through. Those that don't follow through are now in violation of the lease, which we then have to enforce. We've created our own compliance problem. |

### Path C — Default everyone to LLIP. Offer portal upgrade as honest follow-up.

**What happens:** Allan enrolls every opt-in unit in LLIP immediately (Path A action). Will simultaneously delivers a tenant notice — in EN/ES/PT — that says clearly:

- "You are enrolled in landlord liability insurance, billed at $X/month on your rent."
- "This protects the building. It does not protect your belongings or cover you personally."
- "If you want full renters insurance covering your stuff (~$10–25/mo paid separately), log into your AppFolio portal — here's how."

| Dimension | Detail |
|---|---|
| Operational lift | Medium — LLIP enrollment is fast; outreach is real but bounded |
| Tenant friction | Low for the floor (LLIP), opt-in for upgrade |
| Tenant actually protected | LLIP for the building; full coverage for tenants who upgrade |
| Lease compliance | Yes — universally, on day one |
| Stanton revenue | Modest from LLIP markup; no revenue from upgrades |
| Risk | We handle the integrity problem head-on by being honest about what they got vs. what they thought they were getting. Tenants who want real coverage have a clear path. Tenants who don't act are still compliant on the lease. |

---

## Recommendation

**Path C.**

Reasoning:
1. It closes the lease compliance gap on day one without requiring tenant action — which is what we promised in spirit.
2. It addresses the integrity gap honestly. We made a slightly inaccurate promise (LLIP ≠ renters insurance); rather than quietly delivering the wrong thing, we deliver the floor and offer the real thing transparently.
3. It matches our broader stance with the tenant base: hostile-tenancy reality says we can't rely on tenants completing optional steps — but we can rely on automatic enrollment + clear communication about what to do if they want more.
4. The cost of being honest now is low. The cost of a tenant discovering in twelve months that "renters insurance Stanton added to my rent" didn't cover their stolen laptop is materially higher.

[Inference] If we want to recover the integrity issue cleanly, the tenant notice in Path C is the artifact that does it. It should be drafted carefully and reviewed by you before it goes out.

---

## What you specifically need to decide

| # | Decision | Options | Default if unanswered |
|---|---|---|---|
| 1 | Which path | A, B, or C | C (per recommendation above) |
| 2 | What we charge tenants for LLIP | Cost pass-through, or cost + markup (typical: $2–5/mo markup) | Cost pass-through (cleanest if we're already addressing an integrity issue) |
| 3 | Does the LLIP enrollment notice need a signature, or is it informational? | Signed acknowledgment / informational only | Signed acknowledgment (clean paper trail given prior promise) |
| 4 | Is the original signed addendum + opt-in checkbox sufficient legal authorization for the LLIP recoverable expense, or do we need a supplementary acknowledgment? | Sufficient / need supplement | Need supplement (the addendum was English-only; many opt-ins were Spanish or Portuguese speakers) |
| 5 | Do we open the portal-upgrade outreach (Path C step 2) immediately, or stage it after LLIP enrollment is complete? | Concurrent / sequential | Sequential — close the lease gap first, do upgrade outreach as a follow-up campaign |

---

## Once you decide — proposed ownership

| Role | Owner | Scope |
|---|---|---|
| Path approval + answers to decisions 1–5 | **Dan** | Blocking everything below |
| Confirm AppFolio Smart Ensure is enabled on our account, master LLIP policy is bound, all 8 LLCs are correctly named | Alex | One conversation with AppFolio support |
| Pull opt-in list from compliance matrix | Alex | Generates the work queue for Allan |
| Enroll units in LLIP in AppFolio + set up recoverable expense charges | **Allan** | Allan owns this end-to-end as collections manager |
| Reconcile enrollment vs. ledger charges monthly | Allan | Standing process |
| Tenant notice delivery + signature collection | **Will** | Door-to-door, in tenant's preferred language |
| Compliance matrix updates (status flips to `enrolled_llip`) | System / Alex | Automated where possible |

Allan is the natural owner of execution because (a) it's a collections-adjacent process, (b) it's repetitive and process-bound rather than judgment-heavy, and (c) it lives entirely inside AppFolio where Allan already operates. Will is the right person for tenant-facing delivery because of the existing trust relationship and the multilingual on-the-ground role.

---

## Open items / things we don't yet know

- [Unverified] Exact count of tenants who opted in via the form
- [Unverified] Whether Smart Ensure is currently enabled on our AppFolio account or needs activation
- [Unverified] Whether a master LLIP policy is bound and which LLCs are on it
- [Unverified] What rate AppFolio quoted us for LLIP per unit
- [Unverified] Whether the original opt-in checkbox + addendum text is legally sufficient under CT law to authorize a recoverable expense charge — Dan's call
- [Inference] Some opt-in tenants may already have purchased renters insurance independently since February — the matrix may need a refresh before we enroll anyone, to avoid double-charging

---

## Bottom line

We have a small but real integrity problem from the original form's wording. We have a small but real compliance problem from never having actually enrolled the opt-ins. Both close cleanly with **Path C + a careful tenant notice**, owned by Allan with Will doing the tenant-facing work. The whole thing is bounded — we're not building anything new, we're operationalizing what we already promised.

**Next step:** Dan reviews this memo, answers decisions 1–5, and authorizes Alex to confirm AppFolio configuration so Allan can start.

---

*Stanton Management LLC — Internal*
