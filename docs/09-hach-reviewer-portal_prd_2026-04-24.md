# HACH Reviewer Portal — Queue & Packet View — PRD

**Status:** Draft — ready for build
**Depends on:** `hach-auth` (routes + user types), `income-eligibility-engine` (income panel)
**Blocks:** `rejection-tenant-loop` (core packet view must exist before we layer on the rejection UX)

---

## Problem Statement

HACH reviewers today receive PBV application packages as email attachments with folders full of PDFs. They track review state in spreadsheets or their heads, calculate income math from scratch on paper, and request missing documents through long email threads. The experience is slow, error-prone, and completely dependent on one or two reviewers' memory.

We're replacing that with a focused workspace:
- A **queue** that organizes packets by what needs attention
- A **packet view** that opens to everything the reviewer needs — household, income math, documents, version history — without hunting
- Per-document **approve / reject / view** with visible receipts
- A final **voucher issuance** decision when everything's clean

The strategic goal: make this so much faster than HACH's current tooling that reviewers *prefer* logging in here.

---

## Users & Roles

| Role | Capabilities |
|---|---|
| HACH Reviewer | Reviews packets; approves/rejects documents; issues voucher decision |
| HACH Admin | Same as reviewer + user management (covered by `hach-auth`) |

---

## Core Features

### 1. Queue (`/hach`)
Left-rail navigation with three groups:

**Needs First Review** — packets submitted by Stanton that no one has touched yet
- Sort: oldest first, high-priority flagged first
- Show: tenant name, unit, days waiting, new upload count

**Awaiting Your Response** — packets the reviewer previously acted on; tenant has resubmitted or Stanton has replied
- Sort: oldest activity first (stale packets surface)
- Show: tenant name, unit, days since the last review action, new upload count

**Approved This Week** — rolling 7-day view of packets the reviewer approved
- Sort: most recent first
- Collapsible, default closed

Queue badge in header shows total count for first two groups combined.

### 2. Packet view (`/hach/applications/[id]`)
Opens directly to the working surface. No intermediate summary page.

**Header**
- Tenant name, asset ID, building, unit
- Submitted date, last activity timestamp
- Progress bar: approved / pending / rejected / missing / waived (stacked)
- "Issue Voucher" button (disabled until all docs approved)
- "Email Stanton" shortcut (pre-filled to Stanton's assigned reviewer for this app)

**Income & Eligibility panel** — (uses `income-eligibility-engine`)
- Tenant claimed vs. documented vs. AMI limit
- Tolerance check
- Per-source breakdown with document references

**Household panel**
- Full household: name, role, age, citizenship, SSN last 4, disability/student flags
- Flags any citizenship concern (non-citizen without eligible status documented)

**Documents** — grouped by category
- Categories: Application & Signatures / Income Verification / Assets / Citizenship / Medical / Childcare / Acknowledgments
- Per-document row:
  - Label + status badge
  - Latest filename + version + size
  - Review history (every prior action with timestamp + reviewer)
  - Action buttons: View / Approve / Reject (for pending); View only (for approved/rejected)
- Resubmission callout — if current version replaces a prior rejection, show the rejection reason inline
- Missing docs: "Not yet uploaded — Stanton notified to chase tenant"
- Waived docs: shows why they were waived

### 3. Approve action
- Click "Approve" → immediate (no confirm dialog)
- Doc status flips to approved
- Review action logged (`document_review_actions`)
- Toast confirmation
- If this was the last pending doc, the "Issue Voucher" button becomes enabled

### 4. Reject action (UI only in this PRD)
- Click "Reject" → opens dialog with reason dropdown
- Structured reasons from controlled vocabulary (stale / illegible / wrong_member / missing_pages / wrong_doc / insufficient / other)
- Submission logs a review action
- **Tenant notification is OUT OF SCOPE for this PRD** — handled by `rejection-tenant-loop`
- In this PRD, rejection just changes the doc status, logs the action, and returns to queue. The tenant notification side of the loop is next.

### 5. Document viewer
- Inline modal — does not download
- Supports PDF and image
- Shows filename, upload timestamp, size
- Navigation between versions if document has history (v1, v2, v3)
- Keyboard: Esc to close, ←/→ between versions

### 6. Keyboard shortcuts
| Key | Action |
|---|---|
| J / K | Next / previous document in packet |
| A | Approve focused document |
| R | Open reject dialog for focused document |
| V | View focused document |
| Esc | Close modal / dialog |
| ? | Show all shortcuts |

Shortcut hint bar fixed at bottom of screen (like Linear).

### 7. "New since last visit" tracking
- `application_view_events` records every time a reviewer opens an application
- On next visit, documents uploaded/modified since that timestamp get a "new" badge
- Queue view shows upload count since last visit

### 8. Issue Voucher action
- Only enabled when: all reviewable docs are approved (pending=0, rejected=0, missing=0)
- Click → confirm dialog
- Logs final approval decision
- Changes application status to `approved_by_hach`
- Emits event for Stanton to begin next steps (HAP contract, inspection scheduling — out of scope here)

---

## Data Model

```sql
-- Receipts for every review action
CREATE TABLE document_review_actions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references form_submission_documents(id) on delete cascade,
  reviewer_id uuid references admin_users(id) not null,
  action text not null,                   -- approved, rejected, waived, unwaived
  reason_code text,                       -- for rejections (vocabulary in rejection-tenant-loop)
  reason_text text,                       -- free-text elaboration
  created_at timestamptz default now() not null
);

CREATE INDEX dra_document_idx ON document_review_actions(document_id, created_at desc);
CREATE INDEX dra_reviewer_idx ON document_review_actions(reviewer_id, created_at desc);

-- Powers "new since last visit" badges
CREATE TABLE application_view_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references pbv_full_applications(id) on delete cascade,
  user_id uuid references admin_users(id) not null,
  viewed_at timestamptz default now() not null
);

CREATE INDEX ave_user_app_idx ON application_view_events(user_id, application_id, viewed_at desc);
```

Extends existing `pbv_full_applications` with new status value `approved_by_hach` (if not already present).

---

## Integration Points

| System | Direction | Purpose |
|---|---|---|
| `hach-auth` | Depends on | Session `user_type`, route guards, RBAC |
| `income-eligibility-engine` | Reads | Income panel data |
| `pbv_full_applications` | Read/update | Packet data, status changes |
| `pbv_application_members` | Read | Household table |
| `form_submission_documents` | Read/update | Document status via `document_review_actions` |
| Supabase Storage | Read | Document files for viewer |

---

## Implementation Phases

### Phase 1 — Read-only packet view
- Queue layout + data fetch
- Packet page with all panels rendered from DB
- No mutations yet — everything visible but no buttons work

### Phase 2 — Approve action
- Approve button wired up
- `document_review_actions` logging
- Progress bar + queue badge update live (revalidation or optimistic UI)

### Phase 3 — Document viewer
- Inline modal rendering PDF + images
- Version navigation

### Phase 4 — Reject action (stub)
- Dialog with reason dropdown
- Logs action with reason_code
- No tenant notification (that's `rejection-tenant-loop`)

### Phase 5 — Keyboard shortcuts
- J/K navigation
- A / R / V bindings
- Shortcut hint bar

### Phase 6 — View tracking + "new" badges
- `application_view_events` logging on page view
- Badge computation in queue

### Phase 7 — Issue Voucher action
- Final decision UI
- Status change
- Audit trail entry

---

## Out of Scope

- Tenant notification when a document is rejected (that's `rejection-tenant-loop`)
- Bulk approve across multiple packets (v2 — first get them comfortable with single-packet flow)
- Custom queue filters beyond the three default groups (v2)
- Reviewer-to-reviewer handoff or reassignment (v2)
- Comments / internal notes between reviewers (v2)
- Dashboard with metrics (packets approved per week, average time to decision) — v2

---

## Open Questions

| Question | Owner |
|---|---|
| Do HACH reviewers need to see the intake form responses (not just documents)? E.g., stated household composition vs. documented | Alex / HACH contact |
| What happens when a HACH reviewer disagrees with an approved doc that a colleague already approved — is there an "unapprove" flow? | Alex |
| Is "Issue Voucher" really a unilateral reviewer decision, or does it need a second reviewer sign-off? | Alex / HACH |
| For multi-reviewer setups, do reviewers see each other's queues or just their own? | Alex |
