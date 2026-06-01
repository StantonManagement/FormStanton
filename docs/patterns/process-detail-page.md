# Process-Driven Detail Page — Design Principles

A reusable way to think about **any admin/detail page that represents one thing moving through a
step-by-step process**, where an operator lands on it and has to figure out *where are we* and
*what do I do next (X or Y)*.

This is **not** a component spec or a hard layout. The content on your page will be completely
different. What carries over is the *shape of the problem* and a set of principles for solving it.
Adopt the ones that fit; ignore the rest.

> First reference implementation: Stanton's PBV full-application page
> (`app/admin/pbv/full-applications/[id]/page.tsx` + `components/pbv/PipelineStepper.tsx`).

---

## When this pattern applies

Reach for it when a page has **most** of these traits:

- It represents **one record** (an application, a case, an order, a ticket, a deal, an onboarding).
- That record **advances through stages** — a lifecycle with a beginning, middle, and end.
- Different stages need **different actions**, and some actions are gated until earlier ones finish.
- The page has accumulated **many concerns in one scroll** — reading data, taking decisions,
  communicating, destructive admin — and they don't all matter at once.
- An operator's first question on open is *"what state is this in, and what's my next move?"*

If your page is a simple read-only record or a single form, you don't need this. The pattern earns
its weight only when there's a **process** and **competing jobs-to-be-done**.

---

## The core idea

A process page is doing two jobs that fight each other in a single scroll:

1. **Orient** — show where the record sits in its lifecycle and what's blocking progress.
2. **Act** — give the operator the right tools for *this* stage without drowning them in the tools
   for every other stage.

Solve them with two complementary devices:

- A **progress indicator** (stepper / status rail) that answers *where are we* at a glance.
- A **segmentation** (tabs, sections, accordions, a sidebar) that groups the page **by the job the
  operator is doing**, not by data type — so only the relevant surface is in front of them.

Everything below is in service of those two.

---

## Principle 1 — Make the lifecycle visible

If the record has stages, *show the stages*. A horizontal stepper or status rail that marks each
stage **done / current / upcoming** turns an opaque record into a story the operator can read in
half a second.

- **Derive stage state from data you already have** — don't add a `current_stage` column that can
  drift out of sync with reality. Compute it: "intake done = `intake_status === 'complete'`",
  "review done = approved", etc. The truth lives in the underlying fields; the stepper is a *view*.
- **"Current" = the first stage that isn't done.** Simple, robust, no extra bookkeeping.
- Keep it to **4–7 stages**. More than that and it stops being scannable; collapse sub-steps.
- The stepper is also **navigation** — clicking a stage can jump to the surface where you act on it.

## Principle 2 — Segment by job, not by data type

The instinct is to group sections by *what the data is* (members, documents, income, messages).
The better cut is *what the operator is trying to do*:

- **Read / understand** (intake responses, the record's facts)
- **Decide** (review, scoring, the actual approve/reject)
- **Act on the world** (generate, send, export, sign)
- **Communicate** (notifications, message threads)
- **Dangerous / rare** (delete, reopen, override)

Group those, and each segment maps to a mode the operator is actually in. A tab labeled
"Communications" is a *mode*; a tab labeled "SMS table" is a *noun*. Prefer the mode.

## Principle 3 — Keep orientation always in view; let the work scroll

Pin the **identity + status + progress** in a sticky zone so the operator never loses the answer to
"what am I looking at and where is it." The *work surface* below scrolls. This is the single
highest-leverage move for a long page — context stays, bulk moves.

- Know your **scroll container**. `sticky top-0` pins to the nearest scrolling ancestor — that may
  be the viewport, or an inner `<main>`/panel. Pin to the right one.
- The sticky zone needs an **opaque background** so scrolled content passes cleanly underneath.

## Principle 4 — Land the operator where the work is

Don't always dump them on a generic "overview." **Default the view to the record's current stage**
— mid-review → open the review surface; approved-and-awaiting-signature → open the signing tools.
The page should feel like it *knows* what you came to do. Fall back to overview only when the stage
is ambiguous or the record is brand-new.

## Principle 5 — Make the active view addressable (URL state)

If you split into tabs/sections, **put the active one in the URL** (`?tab=…` or a route segment).
This buys, almost for free:

- **Refresh-safe** — reloading (or a post-action refetch) keeps the operator's place.
- **Shareable / bookmarkable** — "look at the documents on this one" is a link.
- **Back/forward** works as expected.

Validate the param against known values and fall back to the smart default (Principle 4) when it's
absent or junk.

## Principle 6 — Reveal actions by stage; never show a wall of buttons

A button the operator can't use yet is noise at best and a footgun at worst. Show an action when its
preconditions are met, and when you must show a disabled one, **say why** ("Approve all required
documents before generating"). Gate destructive/rare actions behind their own quiet corner
(a "Danger Zone", a confirm step) so they're never one stray click away.

## Principle 7 — Reorganizing is presentation; don't disturb behavior

When you restructure a page like this, treat it as a **pure presentation refactor**:

- Keep state and handlers where they are (usually the page/container), so values **survive moving
  between views** — half-entered form fields shouldn't vanish when the operator flips tabs.
- Things that must always work regardless of the active view — **modals/dialogs, toasts** — render
  outside the segmentation, at the container root.
- Don't change APIs, data, or side effects in the same pass. Move the furniture; don't rewire it.
  It keeps the change low-risk and easy to revert.

## Principle 8 — Reuse the segmentation primitive you already have

Tabs, steppers, and progress bars are commodities. Before building one, find the existing
component in the codebase (a `TabNavigation`, a design-system `Tabs`, a `ProgressBar`) and reuse it
so the new page feels native and ships without new dependencies. A bespoke stepper is fine when
none exists — keep it small and presentational (state in, markup out).

---

## Choosing the segmentation device

Tabs are the default, but they're not the only answer. Pick by how the operator works:

| Device | Best when | Cost |
|---|---|---|
| **Tabs** | Concerns are distinct *modes*; you rarely need two at once | Cross-referencing across tabs needs a switch |
| **Sticky sidebar + scrollspy** | Operator constantly cross-references sections; nothing should ever be hidden | Page stays long, just navigable |
| **Collapsible accordions** | Mostly one-section-at-a-time, but occasional "show me everything" | More clicks than tabs; weaker structure |
| **Wizard / forced steps** | The process is strictly linear and you *want* to prevent skipping | Wrong for review/ops pages where people jump around |

A tell: if the operator needs section A and section B **side by side** (e.g. compare submitted docs
against stated income), tabs will fight them — prefer a sidebar/scrollspy, or co-locate A and B in
the same tab.

---

## Anti-patterns

- **Stepper that lies** — a stored "stage" field that disagrees with the data. Derive it.
- **Tabs as filing cabinet** — one tab per table. Group by *job*, or you've just added clicks.
- **Hiding a blocker** — if something needs attention (a missing signer, a failed send), surface it
  in the always-visible zone, not buried three tabs deep.
- **Losing work on navigation** — state stored inside a tab panel that unmounts. Lift it up.
- **Big-bang rewrite** — changing layout *and* behavior together. Separate the two passes.
- **Over-segmenting a short page** — if it fits one comfortable screen, tabs add friction, not
  clarity. Earn the structure.

---

## A 6-step adoption checklist for a new page

1. **Name the lifecycle.** List the record's stages and the data condition that makes each "done."
2. **Inventory the page** and bucket every block by *job* (read / decide / act / communicate / danger).
3. **Pin orientation.** Sticky zone: identity + status + a stepper derived from step 1.
4. **Segment** the buckets with the device chosen above; default the landing to the current stage.
5. **Address it** in the URL; lift any per-view state to the container; keep dialogs at the root.
6. **Gate actions** by stage with reasons for disabled ones; quarantine destructive actions.

If you can do steps 1–2 cleanly, the rest follows. If you *can't* name the lifecycle, this pattern
probably isn't the one your page needs.
