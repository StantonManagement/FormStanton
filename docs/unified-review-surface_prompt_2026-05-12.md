# Windsurf Prompt — Unified Review Surface

**PRD:** `docs/unified-review-surface_prd_2026-05-12.md` (read end-to-end before writing any code)
**Build report (you create this):** `docs/build-reports/unified-review-surface_build-report_2026-05-12.md`
**Depends on:** `hach-payload-leak-plug` AND `review-workspace-schema` both merged. If either set of files is missing (`lib/hach/payload-filter.ts`, the workspace tables, the workspace API routes), STOP and report.

---

## Context

You are unifying the document-review experience for Stanton internal review and the HACH external reviewer portal. Today, Stanton's review surface is a summary page that requires bouncing to `/admin/form-submissions/[id]` to actually act on documents; the HACH portal is a single keyboard-driven cockpit with inline review. The disparity is itself the bug — Stanton (the team operating the program) has the worse tool.

You are:

1. Extracting shared review primitives into `components/review/`.
2. Replacing `app/admin/pbv/full-applications/[id]/page.tsx` with a unified review surface that includes inline document review and the war-room workspace panel.
3. Refactoring `app/hach/applications/[id]/page.tsx` to use the same primitives without visual regression.
4. Adding workspace panels (Stanton-private + Shared on the Stanton side; HACH-private + Shared on the HACH side).
5. Adding unread badges on the application list pages on both sides.
6. **Making every save bulletproof** — Alex's named failure mode is "looks great but writes silently fail." Every mutation reads back from the DB before the operation is considered complete.

This is the largest of the three PRDs in this arc. Take your time.

---

## Required reading before you start

1. **`docs/unified-review-surface_prd_2026-05-12.md`** — every section.
2. **`docs/review-workspace-schema_prd_2026-05-12.md`** — the data layer you'll be calling.
3. **`docs/hach-payload-leak-plug_prd_2026-05-12.md`** — wall context and `safeHachJson`.
4. **`app/admin/pbv/full-applications/[id]/page.tsx`** — what you're replacing. Inventory every piece of state it manages, every API it calls, every button it renders.
5. **`app/hach/applications/[id]/page.tsx`** — what you're lifting primitives from. Inventory the components defined inline at the top of the file.
6. **`components/hach/DocumentViewer.tsx`** — to be replaced.
7. **`components/hach/RejectDialog.tsx`** — to be replaced.
8. **`components/form/PerDocumentReviewPanel.tsx`** — check if any other surface still uses it.
9. **`app/api/admin/submissions/[submissionId]/documents/[documentId]/review/route.ts`** — Stanton-side per-document review endpoint. You will call this; do not modify it.
10. **`app/api/hach/documents/[id]/approve/route.ts`** and `.../reject/route.ts` — HACH-side. You will call these; do not modify them.
11. **`app/api/admin/pbv/full-applications/route.ts`** and **`app/api/hach/applications/route.ts`** — list endpoints. You WILL modify these to return `unread_count`.
12. **Workspace API files from `review-workspace-schema`** — endpoints for messages, read receipts, workspace metadata.
13. **`lib/auth.ts`** — session shape.
14. **`tailwind.config.ts` and existing admin pages' Tailwind usage** — style conventions on Stanton side.
15. **`hach-reviewer-prototype_2026-04-24.jsx`** (under `tasks/reference/`) — HACH visual aesthetic to preserve.

---

## Build this pass

### Step 1 — Inventory and plan (do this before coding)

Write `docs/build-reports/unified-review-surface_planning_2026-05-12.md` first:
- List every component currently defined in `app/hach/applications/[id]/page.tsx` (e.g., `Kbd`, `StatusBadge`, `Button`, `Panel`, `IncomePanel`, `DocumentRow`, `ShortcutsBar`, `ShortcutsHelpModal`).
- For each: decide whether to lift to `components/review/`, keep HACH-local, or replace.
- Map the prop surfaces required by each shared primitive (what it needs in Stanton context, what in HACH context).
- Identify every state variable in the existing Stanton `app/admin/pbv/full-applications/[id]/page.tsx` and how it maps to the new structure.

This plan goes in the build report; it's also for your own use during build.

### Step 2 — Extract shared primitives

Create `components/review/` with the primitives from the PRD's table. For each:
- Pure component, no API calls inside. Data flows in via props; actions flow out via callbacks.
- `context: 'stanton' | 'hach'` prop where the component renders differently per side.
- Visual: minimal styling in the shared primitive itself. Per-context style wrappers handle Tailwind vs. inline-style.

Specific notes:
- `DocumentRow` — props include `doc`, `context`, `isFocused`, `unreadCountByChannel`, `onApprove`, `onReject`, `onWaive` (Stanton only), `onView`, `onExpand`, `isExpanded`, plus an `expandedSlot` render-prop or children for the inline thread.
- `MessageThread` — props: `messages`, `currentUserId`, `canEditWindowMinutes`, `onPost`, `onEdit`, `onMarkRead`, `emptyHint` (e.g., "No notes yet — start the thread to coordinate with the team").
- `ApplicationWorkspacePanel` — props: `tabs: Array<{ key, label, channel, unread, messages, onPost, onEdit, onMarkRead }>`.
- `RejectDialog` — in Stanton context, an extra `internal_notes` field rendered as a separate textarea labeled "Internal notes (not visible to HACH)"; submits to existing per-document review endpoint with `{ action: 'reject', rejection_reason, notes }`. In HACH context, no internal notes field; submits to existing HACH reject endpoint.
- `useReviewKeyboardShortcuts` — hook returning `{ focusedIdx, setFocusedIdx }`. Bails when focus is in a text input or contenteditable. Supports `J`, `K`, `A`, `R`, `V`, `M` (focus message input on focused doc), `?` (help), `Esc`.

### Step 3 — Create per-context wrappers

`components/review/StantonReviewSurface.tsx` and `components/review/HachReviewSurface.tsx`. Each:
- Takes the application/packet data and the workspace data as props (or fetches them via the typed client in Step 4).
- Renders the appropriate channel tabs (Stanton: `Stanton private` + `Shared with HACH`; HACH: `HACH private` + `Shared with Stanton`).
- Composes the shared primitives with the correct callbacks (Stanton calls Stanton APIs; HACH calls HACH APIs).
- Wraps in the appropriate visual styling (Tailwind tokens on Stanton; inline IBM Plex / teal on HACH).

### Step 4 — Workspace API client

Create `lib/workspaces/client.ts`. Typed functions for every workspace operation, with the optimistic+confirm pattern baked in:

```ts
export async function postStantonMessage(
  workspaceId: string,
  body: { body: string; document_id?: string }
): Promise<WorkspaceMessage> {
  const res = await fetch(`/api/admin/workspaces/${workspaceId}/channel/stanton/messages`, ...);
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || 'Post failed');
  // Re-fetch the message list and confirm presence
  const verify = await fetch(`/api/admin/workspaces/${workspaceId}/channel/stanton/messages?document_id=${body.document_id ?? ''}`);
  const verifyData = await verify.json();
  const found = verifyData.data.messages.find((m: WorkspaceMessage) => m.id === data.data.id);
  if (!found) throw new Error('Message did not persist — check server logs');
  return found;
}
```

Same pattern for: `getStantonMessages`, `getHachMessages`, `getSharedMessages`, `editStantonMessage`, `editHachMessage`, `editSharedMessage`, `markChannelRead`, `getWorkspace`. Two clients — `stantonWorkspaceClient` and `hachWorkspaceClient` — each touching only its side's routes.

### Step 5 — Replace Stanton page

Rewrite `app/admin/pbv/full-applications/[id]/page.tsx`:

Top-to-bottom render order:
1. **Back link** to `/admin/pbv/full-applications`
2. **Header** — HoH, building/unit, household size, status badge
3. **Stat tiles** (Invited / Intake Submitted / Signatures / Docs Approved) — keep from current page
4. **Orphaned signature warning** banner — keep from current page
5. **Qualification — Income Review** — keep entirely from current page (the `income_edits` interaction)
6. **Documents — unified review surface** — new. Uses `DocumentRow` per doc. J/K/A/R/V/M keyboard. Inline thread expansion. Calls existing `/api/admin/submissions/.../documents/.../review` for approve/reject/waive. Save flow: optimistic → POST → server response → re-fetch document list → confirm new state.
7. **Stanton Review (application-level)** — keep the existing review status + reviewer name + review notes form. Save via existing `/api/admin/pbv/full-applications/[id]` PATCH. Re-fetch after save.
8. **Actions** — Generate HHA, Download HACH Package, Copy magic link (keep)
9. **Workspace panel (right rail on desktop)** — `ApplicationWorkspacePanel` with tabs:
   - `Stanton Private` — messages where `document_id IS NULL`, channel `stanton`
   - `Shared with HACH` — messages where `document_id IS NULL`, channel `shared`
   Each tab shows unread badge.
10. **Household Members** — keep from current page

The link to `/admin/form-submissions/[id]` is removed.

### Step 6 — Refactor HACH page

Rewrite `app/hach/applications/[id]/page.tsx` to:
- Import `HachReviewSurface` (the composition wrapper) and the shared primitives.
- Render the same packet content as before — header, progress bar, income panel, household composition, grouped document categories.
- Each document row uses the shared `DocumentRow` primitive (HACH context).
- Add the `ApplicationWorkspacePanel` with `HACH Private` and `Shared with Stanton` tabs.
- Doc rows expand to reveal the same two-tab message thread (HACH-private / Shared).
- Keyboard shortcuts now come from the shared hook.

**Visual:** the HACH page MUST look exactly like it does today (deep teal, IBM Plex Sans, stone-gray backgrounds, no Tailwind). Take screenshots before and after; diff them.

Delete `components/hach/DocumentViewer.tsx` and `components/hach/RejectDialog.tsx` once the HACH page imports the replacements from `components/review/`.

### Step 7 — Unread badges on list pages

Modify `app/api/admin/pbv/full-applications/route.ts`:
- For each application returned, compute the total unread count across `stanton_workspace_messages` and `shared_workspace_messages` for the current user.
- Add `unread_count` to the row payload.

Modify `app/api/hach/applications/route.ts`:
- Symmetric — `hach_workspace_messages` + `shared_workspace_messages` for the current HACH user.
- Wrap response with `safeHachJson`.

Modify the list page components (`app/admin/pbv/full-applications/page.tsx`, `app/hach/page.tsx`):
- Show a numeric badge on each row when `unread_count > 0`.

### Step 8 — Save reliability audit

For every mutation introduced in this build, document the verify-from-server step. A small registry file `docs/build-reports/save-paths-unified-review-surface.md` lists:
- Operation (e.g., "post Stanton-private application-level message")
- Endpoint
- Optimistic UI update
- Server verification mechanism
- Toast/error behavior on failure

This is the cure for "saved, but not really" bugs. Cascade fills this out as it builds.

### Step 9 — Tests

`__tests__/unified-review-surface.test.tsx` (component tests with React Testing Library) — minimal set:
1. Stanton `DocumentRow` shows Approve/Reject/Waive buttons; HACH `DocumentRow` shows Approve/Reject only.
2. `RejectDialog` in Stanton context shows internal-notes textarea; HACH context does not.
3. `MessageThread` shows edit affordance for own messages within 5 min; not for others; not for own messages after 5 min.
4. Keyboard shortcuts: `J` advances focus, `A` triggers approve callback on focused doc.
5. Optimistic update + revert on failure: simulate API failure and confirm UI reverts.

`__tests__/unified-review-surface-e2e.test.ts` (or extend existing e2e if any) — at minimum:
6. End-to-end: log in as Stanton, post a private message, refresh page, message is still there.
7. Log in as HACH, do NOT see the Stanton private message.
8. Log in as HACH, post a shared message. Log in as Stanton, see the shared message with HACH attribution.
9. Approve a document as Stanton. Refresh. Document still shows approved.

### Step 10 — Documentation

Update `components/review/README.md` (new) — short note on:
- What the primitives are.
- How `context: 'stanton' | 'hach'` flows.
- Styling approach (per-context wrappers).
- Wall summary — components are wall-agnostic; the wall is at the API layer.

---

## Tech constraints

- Next.js App Router
- React 18+ functional components, hooks only (no class components)
- TypeScript strict, no `any` in new code
- Tailwind for Stanton-side wrappers; inline styles for HACH-side wrappers (preserve existing aesthetic)
- Vitest + React Testing Library
- No new state management library
- No new UI library — work within existing primitives, lucide-react if needed for icons (already in deps)
- No new fetch library — use `fetch`

---

## Hard NOs

- **Do NOT modify the workspace API routes** built in `review-workspace-schema`. Call them.
- **Do NOT modify the HACH approve/reject endpoints.** Call them.
- **Do NOT modify the Stanton per-document review endpoint.** Call it.
- **Do NOT modify any tenant-facing route.**
- **Do NOT introduce real-time updates** (WebSockets, SSE). Refresh-on-load is fine.
- **Do NOT add @-mentions or notifications.** Phase 2.
- **Do NOT delete `components/form/PerDocumentReviewPanel.tsx`** unless you've verified zero other callers via grep. Report findings in build report; do not silently delete.
- **Do NOT collapse the Stanton and HACH composition wrappers into one component with branching.** Keep them physically separate for clarity.
- **Do NOT add TODOs or placeholder code** — production-grade everywhere.
- **Do NOT invent props that aren't actually wired through.**
- **Do NOT auto-fix unrelated bugs** — report under "Pre-existing issues observed."
- **Do NOT mark complete with any save-path unverified.**

---

## Verification phase (mandatory)

### A. Build/test gates

1. **`npm run build` succeeds.** Zero errors.
2. **TypeScript strict compile clean.** No new `any` in components or wrappers.
3. **`npm test` passes.** Every test in this PRD's test files is green. Wall tests from `review-workspace-schema` still pass. `hach-payload-allowlist.test.ts` from leak-plug still passes.

### B. Visual regression

4. **HACH page visual diff.** Take screenshots of `/hach/applications/[id]` BEFORE the refactor and AFTER. Diff them. Acceptable changes: workspace panel added, doc rows have unread badges. Unacceptable: typography drift, color drift, layout drift on the existing panels.

### C. End-to-end save reliability — DO EVERY ONE OF THESE

For each, document in the build report: operation, endpoint, action taken, network response, DB verification query, result.

5. **Stanton: post application-level private message.** Type a message in the Stanton-private tab, submit. Confirm:
   - Network response is 200 with the new message ID.
   - Refresh the page. The message is still there.
   - Query `stanton_workspace_messages` in dev DB — the row is there with the right body.

6. **Stanton: post doc-anchored shared message.** Expand a document row, switch to Shared tab, post message. Confirm same three checks (response, refresh, DB).

7. **Stanton: edit own message within window.** Edit a just-posted message. Refresh. `edited_at` is set in the UI and in the DB.

8. **Stanton: try to edit after window.** Manually set a message's `created_at` to >5 min ago, try to edit via UI. 409 returned, UI shows clear "edit window expired" state.

9. **Stanton: approve a document.** Click Approve on a pending doc. Confirm:
   - Optimistic UI flips immediately.
   - Network response 200.
   - Refresh the page. Doc still approved.
   - Query `form_submission_documents.status` AND `document_review_actions` (if Stanton writes there) — match.

10. **Stanton: reject a document with internal note.** Open reject dialog, pick reason, fill rejection_reason (tenant-facing) AND internal_notes. Submit. Confirm:
    - Doc shows rejected.
    - DB: `rejection_reason` and `notes` both populated on `form_submission_documents`.
    - HACH endpoint (`/api/hach/applications/[id]`) — fetch as HACH session. Confirm the `notes` field is NOT in the response (leak-plug protection).

11. **Stanton: mark Shared channel read.** With unread messages in the Shared tab, click into the tab. Confirm:
    - Unread count badge goes to 0.
    - `workspace_read_receipts` for this user/workspace/channel has updated `last_read_at`.

12. **HACH: same suite in HACH context.** Post message, edit, approve, reject, mark read. Confirm each save persists by reload + DB query.

13. **HACH: cross-side wall check.** As HACH user, in browser devtools Network panel: confirm no network response contains `stanton_workspace_messages` content or `stanton_review_notes`. Confirm the HACH side of the workspace panel cannot see Stanton-private messages even after several refreshes.

### D. List page unread badge

14. **List badge — Stanton.** Have a HACH user post a shared message. Log in as Stanton. Open `/admin/pbv/full-applications`. The row for that application shows an unread badge. Click in — unread visible on the shared tab. Mark read. Return to list — badge gone.

15. **List badge — HACH.** Symmetric — Stanton posts a shared message, HACH sees badge.

### E. Visual final check

16. **Walk every page.** Open every page touched by this PRD, in both Stanton and HACH browser sessions. Take a screenshot of each. Save under `docs/build-reports/screenshots/unified-review-surface-2026-05-12/`.

### F. Regression watchlist (do not skip)

Each of these is a previous-Cascade failure mode. Verify explicitly:

17. **Approve/Reject still works after the refactor.** Don't trust the test suite alone — click the buttons in dev and verify behavior.
18. **The income editor on the Stanton page still saves.** Edit a documented income, save, refresh, value persists.
19. **Generate HHA button still produces a docx.** Run it end-to-end.
20. **Magic link copy button still copies.** Manual.
21. **Keyboard shortcuts don't fire when typing in a message input.** Type `J` in the message textbox — should add `J` to text, not advance focus.
22. **No console errors on either page.** Open devtools console, navigate around, confirm clean.
23. **Document viewer modal renders PDFs and images.** Open each kind from both pages.
24. **Empty states render.** Application with no messages yet → MessageThread shows the empty-hint copy. Application with no documents (edge case but possible during setup) → graceful empty state.

If any of 1–24 fails, **do not declare done**. Leave the task in progress, document the failure, stop, and wait for Alex.

---

## Build report requirements

Create `docs/build-reports/unified-review-surface_build-report_2026-05-12.md` with:

### 1. Planning doc reference
Link to the planning doc from Step 1.

### 2. Component lift inventory
Table — every primitive lifted, source file, new location, prop surface.

### 3. PRD requirements checklist
Every acceptance criterion with `[x]` or `[ ]` and a one-line note.

### 4. Files created
List.

### 5. Files modified
List + summary.

### 6. Files deleted
List (e.g., `components/hach/DocumentViewer.tsx`).

### 7. Save-path registry
The full save-paths registry table from Step 8.

### 8. Test output
Vitest output paste.

### 9. End-to-end save reliability log
Items 5–13 from verification phase, full details.

### 10. List badge verification
Items 14–15.

### 11. Visual screenshots
Reference to the screenshots directory + brief diff notes (e.g., "HACH page: pixel-identical to baseline except workspace panel added on right rail").

### 12. Regression watchlist results
Items 17–24 with pass/fail + evidence.

### 13. Deviations from PRD
With reasoning. Empty if none.

### 14. Pre-existing issues observed
Out-of-scope items noted.

### 15. Verification phase pass/fail summary
Items 1–24 in a table.

---

## When you finish

Reply in chat with:
- Build report line count + section count
- Confirmation every section is populated
- Pass/fail on all 24 verification items
- Specifically: did every save-path round-trip cleanly (items 5–12)?
- Specifically: did visual regression check pass on the HACH page (item 4)?
- Anything that blocked you

If any verification item fails, do not declare complete. Leave the task in progress, summarize the failure clearly, and wait.
