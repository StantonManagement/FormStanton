# Windsurf Prompt — HACH Reviewer Portal (Queue & Packet View)

**PRD:** `hach-reviewer-portal_prd_2026-04-24.md` (read it first — this is a big build)

**Required dependencies already built:** `hach-auth` (user types, route tree, RBAC), `income-eligibility-engine` (`/api/pbv/applications/[id]/income-eligibility` endpoint)

**Reference prototype:** `hach-reviewer-prototype_2026-04-24.jsx` — clickable mockup of the intended UX. Match the visual aesthetic closely.

---

## Context

HACH reviewers need a fast, focused portal to review PBV application packages. Queue on the left, packet view on the right, per-document approve/reject, visible receipts, income math done for them. The goal is an experience so much better than HACH's current email-and-spreadsheets workflow that reviewers actively prefer logging in here.

---

## Build this pass

**Phases 1, 2, 3, and 4 from the PRD.** Phases 5 (keyboard shortcuts), 6 (view tracking), and 7 (voucher issuance) are the next pass.

### Specific scope

1. **Migration** — `document_review_actions` and `application_view_events` tables per PRD schema. `pbv_full_applications.status` enum extended with `approved_by_hach` if not already.

2. **Queue page** at `/hach/page.tsx`:
   - Fetches applications assigned to HACH review
   - Groups into "Needs First Review" (no `document_review_actions` by any HACH user yet), "Awaiting Your Response" (current reviewer has previously acted AND there's been activity since), "Approved This Week" (applications where this reviewer issued voucher in last 7 days — stub this to the `approved_by_hach` status check)
   - Queue item layout per prototype: tenant name, asset ID + building, days waiting, new upload count
   - Selecting a queue item navigates to `/hach/applications/[id]`

3. **Packet view** at `/hach/applications/[id]/page.tsx`:
   - Header with tenant, asset_id, building, unit, submitted date, last activity timestamp
   - Progress bar (approved/pending/rejected/missing/waived segments)
   - "Issue Voucher" button — disabled when any doc is pending/rejected/missing (wire in Phase 7; for now, disabled permanently with tooltip)
   - Income & Eligibility panel — renders data from `/api/pbv/applications/[id]/income-eligibility`
   - Household table from `pbv_application_members`
   - Documents grouped by category (Application & Signatures / Income Verification / Assets / Citizenship / Medical / Childcare / Acknowledgments) from `form_submission_documents`

4. **Document row** component:
   - Status badge (approved / pending / rejected / missing / waived)
   - Latest version filename, size, upload timestamp
   - Full review history list — every entry in `document_review_actions` for this doc, ordered chronologically
   - Resubmission callout when current version has prior rejection in history
   - Action buttons:
     - Pending: View / Approve / Reject
     - Approved: View
     - Rejected: View (plus the reason is shown in history)

5. **Approve action:**
   - POST `/api/hach/documents/[id]/approve`
   - Inserts `document_review_actions` row with action=`approved`
   - Updates `form_submission_documents.status` to `approved`
   - Returns updated doc + packet progress
   - Optimistic UI update in the list
   - Toast: "✓ Approved · {doc label}"

6. **Reject dialog:**
   - POST `/api/hach/documents/[id]/reject`
   - Body: `{ reason_code, reason_text }`
   - Inserts `document_review_actions` row with action=`rejected`, reason_code, reason_text
   - Updates `form_submission_documents.status` to `rejected`
   - Reason dropdown values: `stale`, `illegible`, `wrong_member`, `missing_pages`, `wrong_doc`, `insufficient`, `other`
   - When `other`, text area required
   - **Do NOT send any tenant notification yet** — that's `rejection-tenant-loop`. Just log the rejection.
   - Show a notice in the dialog: "Note: tenant notification coming soon. For now, notify Stanton via email."

7. **Document viewer** modal:
   - Opens from "View" button
   - Renders PDF (via `<iframe>` or a PDF lib already in the codebase) and images (via `<img>`)
   - Signed URL from Supabase Storage
   - Version navigator — if doc has multiple versions, show v1 / v2 / v3 tabs, default to latest
   - Esc to close

8. **Styling:** Match the `hach-reviewer-prototype_2026-04-24.jsx` aesthetic closely — inline styles, IBM Plex Sans, deep teal accent (#0f4c5c), stone-gray backgrounds. Do NOT use Tailwind. Do NOT use any UI library. Reuse primitives from the prototype (StatusBadge, Button, Kbd) but adapt to production data shapes.

9. **Audit logging:** Every approve/reject action calls the `logAudit()` helper from `hach-auth`.

---

## Tech constraints

- Next.js App Router
- Server components for data fetching where possible; client components for interactive pieces (doc row, queue, dialog, viewer)
- Supabase server client with HACH-user-scoped RLS (or application-level scope check in route handler)
- TypeScript strict mode
- Revalidation via `revalidatePath()` after mutations — avoid full page reload
- Do not introduce any new state management library (no Redux, no Zustand) — use React state and server actions

---

## Acceptance criteria

- [ ] Logging in as a HACH user lands on `/hach` with the queue populated
- [ ] Queue groups render correctly with data from seeded test applications (create a test seed with 2–3 apps in each group state)
- [ ] Clicking a queue item opens the packet at `/hach/applications/[id]`
- [ ] Packet header shows progress bar reflecting real doc counts
- [ ] Income panel renders with documented vs. claimed vs. limit and tolerance flag
- [ ] Household table renders all members from DB
- [ ] Document rows render grouped by category, with correct status badges
- [ ] Clicking "Approve" on a pending doc flips it to approved, updates progress bar, logs action, shows toast
- [ ] Clicking "Reject", picking a reason, submitting — flips doc to rejected, logs action with reason, doc now shows in review history
- [ ] Clicking "View" on any doc opens modal, renders the file, Esc closes
- [ ] Attempting to load `/hach/applications/[some-random-uuid]` that isn't a real PBV app returns 404
- [ ] Attempting to load the same as a Stanton user → 403 (from `hach-auth` middleware)
- [ ] "Issue Voucher" button is present but disabled with a tooltip

---

## Do NOT in this pass

- Build keyboard shortcuts (Phase 5)
- Build the "new since last visit" badges (Phase 6)
- Wire up the Issue Voucher action (Phase 7)
- Send any SMS/email to tenants on rejection — that's `rejection-tenant-loop`
- Build HACH user management UI (that's in `hach-auth` Phase 3)
- Add any analytics, metrics, or dashboard views
- Build bulk actions across multiple packets

---

## Test seed data expectation

Create a small seed script or fixture that produces:
- 1 application in "Needs First Review" state (all docs pending, no actions yet)
- 1 application with some docs approved, 1 rejected with a reason, 1 pending resubmission — to exercise the "Awaiting Your Response" state and the resubmission callout
- 1 application fully approved — to exercise "Approved This Week"

This data is essential for verifying the UI works end-to-end.
