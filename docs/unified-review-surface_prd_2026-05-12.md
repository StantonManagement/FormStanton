# Unified Review Surface — PRD

**Status:** Draft — ready for build
**Depends on:** `hach-payload-leak-plug` AND `review-workspace-schema` (both must be merged before this starts)
**Blocks:** none — final piece of the war-room arc

---

## Problem Statement

The Stanton internal review surface for PBV applications (`/admin/pbv/full-applications/[id]`) today is a summary page: income editor, member list, document status list with colored dots, and a footer link that says "Open in Per-Document Review" → `/admin/form-submissions/[id]`. To actually look at a document and act on it (approve / reject / waive), the user must leave the application page, do the review on a different page, and come back. The HACH external portal (`/hach/applications/[id]`), in contrast, has a single keyboard-driven cockpit with inline viewer, per-document approve/reject buttons, and J/K navigation. The disparity is doing nobody any favors:

- **Stanton reviewers (Tess, Christine, Dan, Alex)** waste clicks and lose context bouncing between pages. Document review feels slower than it is.
- **The war room is invisible.** There's nowhere on the page to deliberate, ask Christine if she's seen this one, or send HACH a note about a missing pay-stub date range.
- **HACH gets the better tool.** The strategic goal is for HACH to *prefer* this portal over their old workflow — but Stanton, the team running the whole operation, has the worse surface.

This PRD unifies the review experience. One review surface reused on both sides. Same primitives, same UX, contextually adjusted permissions and data. Embed the workspace (war room) directly on the page so deliberation and correspondence happen where the documents live, not in email.

---

## Goals

1. **Extract a shared review-surface component** that renders document rows, the viewer modal, the reject dialog, and keyboard navigation, parameterized by `context: 'stanton' | 'hach'`.
2. **Replace `app/admin/pbv/full-applications/[id]/page.tsx`** with the unified surface — inline document review, no more bouncing to `/admin/form-submissions/[id]`.
3. **Add the workspace panel to both sides.** Stanton sees `stanton-private` + `shared` channels. HACH sees `hach-private` + `shared`.
4. **Per-document message anchoring** — opening a document row reveals its message threads (Stanton-private + Shared on the Stanton side; HACH-private + Shared on the HACH side).
5. **Application-level message threads** — visible in a workspace panel adjacent to the documents.
6. **Save reliability** — particular attention to the failure mode "looks great but writes silently fail." Every save round-trips to the DB and reloads from it.

---

## Users & Roles

| Role | Sees | Can act |
|---|---|---|
| Stanton staff | Stanton-private + Shared channels; full document list; all internal fields (notes, reviewer, internal review status); per-doc approve/reject/waive; income editor; HHA generation; magic link copy | Yes |
| HACH reviewer / admin | HACH-private + Shared channels; document list with HACH-permissible fields; per-doc approve/reject; queue + voucher actions; cannot see Stanton-internal fields | Yes |

The wall, enforced at the API layer in `review-workspace-schema`, is reflected in the UI by which props the component receives in each context.

---

## Core Features

### 1. Shared review-surface component (`components/review/`)

A directory of reusable primitives, no `'hach'` or `'admin'` knowledge inside the components themselves. Context flows in as props.

| Component | Purpose |
|---|---|
| `DocumentRow.tsx` | A single document row: label, status badge, file name, latest action attribution (HACH-side or Stanton-side, whichever wrote it), action buttons (Approve / Reject / View). Renders an unread-message-count badge per channel the user has access to. Click expands an inline message thread sub-row. |
| `DocumentViewer.tsx` | Inline modal — PDF and image. Version navigator (v1 / v2 / v3). Esc closes. Existing implementation is fine; lifted from `components/hach/`. |
| `RejectDialog.tsx` | Reason dropdown (controlled vocabulary), free-text elaboration, submit. In Stanton context: shows an additional "internal notes" textarea that maps to `form_submission_documents.notes`. In HACH context: that field is absent. |
| `MessageThread.tsx` | Renders a list of messages with author + timestamp + edit indicator. Edit affordance only on author's own messages within the 5-minute window. Input box at the bottom. Channel-aware (Stanton-private / HACH-private / Shared). |
| `ApplicationWorkspacePanel.tsx` | A side panel containing tabs for each channel the user has access to. Tab badges show unread counts. Each tab renders application-level messages (where `document_id` is null) for that channel. |
| `ReviewKeyboardShortcuts.tsx` (hook) | The J/K/A/R/V/?/Esc handler. Lifted from `app/hach/applications/[id]/page.tsx`. |
| `StatusBadge.tsx`, `Kbd.tsx`, `Panel.tsx`, `Button.tsx`, `ShortcutsBar.tsx`, `ShortcutsHelpModal.tsx` | Visual primitives. Lifted from `app/hach/applications/[id]/page.tsx`. |

Each component takes a `context: 'stanton' | 'hach'` prop where relevant. The component decides what to render based on context; it does not import role-specific helpers.

### 2. Stanton-side composition (`app/admin/pbv/full-applications/[id]/page.tsx` — replaced)

Top-to-bottom:
- **Header** — HoH name, building/unit, household size, status badge (the existing `stanton_review_status`).
- **Stanton review controls** — review status dropdown, reviewer name field, top-level review notes (this is the existing application-level Stanton notes). Save button. Persists to existing `/api/admin/pbv/full-applications/[id]` PATCH.
- **Qualification / income editor** — kept as is from the current page.
- **Documents (the new bit)** — replaces the existing read-only status list. Uses `DocumentRow` for each document. Per-doc Approve / Reject / Waive / View buttons. Keyboard navigation (J/K/A/R/V). Resubmission badge when latest revision has prior rejection. Expanding a doc row reveals an inline panel with two tabs — `Stanton notes` (private) and `Shared with HACH` (shared) — each rendering `MessageThread` for that document.
- **Application-level workspace panel** — `ApplicationWorkspacePanel`, tabs for `Stanton private` and `Shared`. Shows application-level messages.
- **Actions row** — `Generate HHA Application`, `Download HACH Package`, `Copy magic link`. Kept as is.
- **Household members** — kept as is.

The "Open in Per-Document Review" link to `/admin/form-submissions/[id]` is removed.

### 3. HACH-side composition (`app/hach/applications/[id]/page.tsx` — augmented, not replaced)

Lift the existing page's internals into the shared primitives. Keep the existing visual aesthetic (deep teal, IBM Plex Sans, inline styles per the prototype). Add:
- **Application-level workspace panel** — tabs for `HACH private` and `Shared with Stanton`. Same component as Stanton, different channel access.
- **Per-doc thread expansion** — clicking a document row exposes the same message-thread sub-row as on the Stanton side, but with `HACH private` and `Shared with Stanton` tabs.

Everything else on the HACH page stays.

### 4. Save reliability

Every mutation in the new surface follows this pattern:
1. Optimistic UI update (snappy UX).
2. Network call to the appropriate API.
3. On success: confirm the server response includes the updated row, **and** trigger a background re-fetch of the affected slice to confirm the DB state.
4. On failure: revert the optimistic update, show a clear error toast.

The reload-from-server step (3) is the protection against the "writes silently fail" failure mode. The component does not trust its own optimistic state as truth.

Specifically prone:
- Posting a message — confirm the message exists in the next GET.
- Approving / rejecting a document — confirm `document_review_actions` has the new row and the effective status flipped.
- Editing a message within the 5-minute window — confirm `edited_at` is set on re-fetch.
- Marking a channel read — confirm `workspace_read_receipts` upserted and unread count is now zero on re-fetch.

### 5. Visual styling

Stanton-side admin pages use Tailwind with CSS variables (existing pattern in `app/admin/pbv/full-applications/[id]/page.tsx`). The shared components must work in both styling worlds.

Two acceptable approaches:
- **A — Style-agnostic primitives.** The components take a `theme` prop or use CSS custom properties that resolve differently per context. Tailwind on Stanton side, inline-style theme tokens on HACH side.
- **B — Per-context wrappers.** A thin `StantonReviewSurface.tsx` and `HachReviewSurface.tsx` wrap the shared primitives and inject styles. The primitives themselves are unstyled or minimally styled.

[Inference] Approach B is likely simpler and preserves the existing distinct look on each side. Default to B unless a strong reason to merge styling emerges during build.

### 6. Unread badge propagation

The application list pages (`/admin/pbv/full-applications` and `/hach`) should display an unread-message badge on each row when the workspace for that application has messages the user has not seen. This requires the existing list-page APIs to additionally return per-application unread counts. This is in scope; out-of-scope is making the badge update live without a refresh (poll-on-load is fine for v1).

---

## Data Model Changes

None. This PRD is UI-only (and trivial API additions to list pages). Schema is set up by `review-workspace-schema`.

The list endpoints `/api/admin/pbv/full-applications` and `/api/hach/applications` extend their response to include `unread_count` per application (sum of all channels the user has access to). Both endpoints query `workspace_read_receipts` and the appropriate message tables for the current session user.

---

## Integration Points

| System | Direction | Purpose |
|---|---|---|
| `review-workspace-schema` APIs | Read/Write | All message operations, workspace metadata, unread counts |
| `/api/admin/submissions/.../review` | Write | Existing per-document review endpoint (Stanton-side approve/reject/waive) |
| `/api/hach/documents/[id]/approve|reject` | Write | Existing HACH-side approve/reject |
| `/api/admin/pbv/full-applications/[id]` | Read/PATCH | Application metadata, income editor save |
| `/api/admin/submissions/[submissionId]/documents/[documentId]` | Read | Document signed URLs |
| `/api/hach/documents/[id]/signed-url` | Read | HACH document signed URLs |
| `lib/hach/payload-filter` | — | HACH endpoints already wrap with this; no UI change required |

---

## Files Touched (Inferred — Cascade Confirms)

NEW:
- `components/review/DocumentRow.tsx`
- `components/review/DocumentViewer.tsx`
- `components/review/RejectDialog.tsx`
- `components/review/MessageThread.tsx`
- `components/review/ApplicationWorkspacePanel.tsx`
- `components/review/StatusBadge.tsx`
- `components/review/Panel.tsx`
- `components/review/Button.tsx`
- `components/review/Kbd.tsx`
- `components/review/ShortcutsBar.tsx`
- `components/review/ShortcutsHelpModal.tsx`
- `components/review/useReviewKeyboardShortcuts.ts`
- `components/review/StantonReviewSurface.tsx` (composition wrapper)
- `components/review/HachReviewSurface.tsx` (composition wrapper)
- `lib/workspaces/client.ts` (typed fetch wrappers around the workspace APIs, with the optimistic+confirm pattern baked in)

MODIFIED:
- `app/admin/pbv/full-applications/[id]/page.tsx` — replaced
- `app/hach/applications/[id]/page.tsx` — refactored to use shared primitives
- `app/admin/pbv/full-applications/page.tsx` — unread badge on list rows
- `app/hach/page.tsx` — unread badge on queue items
- `app/api/admin/pbv/full-applications/route.ts` — return unread_count per app
- `app/api/hach/applications/route.ts` — return unread_count per app

DEPRECATED (not deleted in this pass):
- The link from the Stanton page to `/admin/form-submissions/[id]` for per-document review is removed. The per-document review endpoint itself stays (other surfaces may use it).
- `components/hach/DocumentViewer.tsx` and `components/hach/RejectDialog.tsx` are replaced by `components/review/` equivalents. Old files are deleted once the HACH page imports the new ones.
- `components/form/PerDocumentReviewPanel.tsx` — if no other caller, mark for deletion. Cascade reports.

---

## Out of Scope

- Real-time updates (WebSockets, server-sent events). Refresh-on-load is fine.
- @-mentions. Phase 2.
- File attachments on messages. Phase 2.
- Refi UI. Schema supports it but no refi page exists yet.
- Notification (SMS / email) on new shared-channel message. Phase 2.
- Bulk approve / reject across documents in one packet. Out of scope.
- Voucher issuance flow. Existing.
- Tow list, lobby, other admin surfaces — untouched.

---

## Risks and Edge Cases

| Risk | Mitigation |
|---|---|
| Stanton component accidentally reads a HACH-only field | Components don't fetch — they receive props from per-context wrappers. The wrappers call the right APIs. Anything that comes through has already passed the API-layer wall. |
| Optimistic UI shows a "saved" state for a write that never landed | Pattern in Goal 4 — every mutation re-fetches the affected slice. |
| Keyboard shortcuts conflict between the doc row and the message thread input | When focus is in a text input or contenteditable, the keyboard handler bails (existing pattern in the HACH page already does this). |
| Tailwind on Stanton vs. inline-style on HACH causes visual drift | Approach B (per-context wrappers). Document the styling decision in the component README. |
| Resubmission badge disagrees between Stanton-side and HACH-side | Both compute from `document_review_actions` (action history) — same source of truth. |
| Two reviewers post the same shared-channel message simultaneously | Append-only with timestamps. Race is benign. |
| User edits a message at the 4:59 mark and it hits the API at 5:01 | API returns 409. UI shows "Edit window expired — message saved as last successful edit." Acceptable. |
| Message body is very long | Plain text input. Reasonable cap at server level (e.g., 8 KB) — flag in the API PRD; for UI, no special handling beyond scroll. |
| Mobile users reviewing on phone | Out of scope for this PRD. Desktop primary. The HACH page is already desktop-first. |

---

## Open Questions

| Question | Owner | Default for v1 |
|---|---|---|
| 1. Should the doc row's inline thread sub-row be a fixed panel or a slide-over? | Alex | Inline expansion under the row. Less disruptive. |
| 2. Should keyboard shortcuts include `M` to focus the message input on the focused doc? | Alex | Yes — `M` focuses message thread of focused doc. |
| 3. When Stanton reviewer hits Reject, the existing endpoint writes to `form_submission_documents.notes`. With the wall, that field is now hidden from HACH responses. Do we still allow internal notes on rejections via the existing flow, or should that internal note become a Stanton-private message anchored to the doc instead? | Alex | Keep both for now. Internal notes via existing endpoint still works (it's stripped from HACH responses). Messages are richer and threaded. Over time, `notes` may be deprecated in favor of messages — decide later. |
| 4. Should the Stanton page reload-on-save use Next's `revalidatePath` or client-side refetch? | Alex | Client-side refetch — keeps the page state intact. |
| 5. Application-level message panel: side panel (right rail) or below the documents list? | Alex | Right rail on desktop. Stacks below on narrower viewports. |

---

## Acceptance Criteria

- [ ] `components/review/` exists with the primitives listed.
- [ ] `app/admin/pbv/full-applications/[id]/page.tsx` is rewritten to use the shared primitives. The link to `/admin/form-submissions/[id]` is gone.
- [ ] Document rows on the Stanton page show Approve / Reject / Waive / View buttons inline. No external page navigation required to review a document.
- [ ] Keyboard navigation (J/K/A/R/V/M/?) works on the Stanton page.
- [ ] Document rows expand to show inline message threads with Stanton-private and Shared tabs.
- [ ] Application-level workspace panel renders with the correct two tabs per side.
- [ ] HACH page refactored to use the same shared primitives, no visual regression from the prior aesthetic.
- [ ] HACH page shows HACH-private and Shared channels in workspace panel and per-doc threads.
- [ ] Unread badges on application list rows on both sides.
- [ ] Every save (review action, message post, message edit, mark-read) re-fetches the affected slice and confirms server state before considering the operation complete.
- [ ] No banned key from `lib/hach/payload-filter.ts` appears in any network response on the HACH side after the refactor (the leak-plug test still passes).
- [ ] All wall tests from `review-workspace-schema` still pass.
- [ ] Manual cross-role walkthrough confirms no Stanton-private content leaks into HACH UI and vice versa.
- [ ] Build report enumerates every component lifted and where it lives now.
