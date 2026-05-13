# Review Workspace Schema — Build Plan

**Status:** Ready for review  
**Dependency check:** `lib/hach/payload-filter.ts` exists ✅ (hach-payload-leak-plug merged)  
**Target migration timestamp:** `20260512130000_review_workspace_schema.sql`  

---

## Summary

This build implements the **data layer** for a multi-party review workspace pattern that allows Stanton Management and HACH to review PBV application packets together through structured channels instead of email.

### The Three-Table Wall

The architectural wall is physical — three separate tables for messages:
- `stanton_workspace_messages` — Stanton-only deliberation
- `hach_workspace_messages` — HACH-only deliberation  
- `shared_workspace_messages` — institutional record between both parties

No `channel_type` column. No shared query helpers. The code that touches each side never imports the other side's queries.

---

## Files to Create

### 1. Migration
- **Path:** `supabase/migrations/20260512130000_review_workspace_schema.sql`
- **Size:** ~250 lines
- **Contents:**
  - 6 tables: `review_workspaces`, `workspace_parties`, `stanton_workspace_messages`, `hach_workspace_messages`, `shared_workspace_messages`, `workspace_read_receipts`
  - All CHECK constraints from PRD (especially `author_party_org` constraints)
  - Indexes per PRD
  - RLS enabled on all tables
  - `service_role` policy on all tables
  - COMMENT on each table explaining wall role
  - Rollback comment at top

### 2. Shared Types
- **Path:** `lib/workspaces/types.ts`
- **Size:** ~50 lines
- **Exports:**
  - `WorkspaceType`, `ChannelScope`, `PartyOrg` (type unions)
  - `ReviewWorkspace`, `WorkspaceParty`, `WorkspaceMessage`, `WorkspaceUnreadCounts` interfaces

### 3. Scope Resolver Helpers
- **Path:** `lib/workspaces/scope.ts`
- **Size:** ~150 lines
- **Exports:**
  - `resolveStantonWorkspace(workspaceId, sessionUser)` — verifies Stanton access, auto-creates workspace with parties if needed
  - `resolveHachWorkspace(workspaceId, sessionUser)` — verifies HACH access (hach_review_status not null)
  - `ensurePbvWorkspaceForApplication(applicationId, sessionUser)` — lazy create for application entry point

### 4. Edit Window Helper
- **Path:** `lib/workspaces/edit-window.ts`
- **Size:** ~15 lines
- **Exports:**
  - `EDIT_WINDOW_MINUTES = 5`
  - `isEditWindowOpen(createdAt)` — boolean check

### 5. Stanton API Routes (8 routes)

| Route | Purpose |
|-------|---------|
| `app/api/admin/workspaces/[workspaceId]/route.ts` | GET workspace metadata, parties, unread counts |
| `app/api/admin/workspaces/[workspaceId]/channel/stanton/messages/route.ts` | GET/POST Stanton-private messages |
| `app/api/admin/workspaces/[workspaceId]/channel/stanton/messages/[messageId]/route.ts` | PATCH edit message (5-min window) |
| `app/api/admin/workspaces/[workspaceId]/channel/shared/messages/route.ts` | GET/POST shared messages |
| `app/api/admin/workspaces/[workspaceId]/channel/shared/messages/[messageId]/route.ts` | PATCH edit shared message |
| `app/api/admin/workspaces/[workspaceId]/channel/[channel]/read/route.ts` | POST mark channel read |

All Stanton routes:
- Use `isAuthenticated()` + `getSessionUser()`
- Verify `user_type` is Stanton-side (not hach_admin/hach_reviewer)
- Call `resolveStantonWorkspace()` for 403 check
- Touch ONLY `stanton_workspace_messages`, `shared_workspace_messages`, `workspace_read_receipts`
- Set `author_party_org = 'stanton'` explicitly on shared POST
- Call `logAudit()` on POST/PATCH

### 6. HACH API Routes (8 routes)

| Route | Purpose |
|-------|---------|
| `app/api/hach/workspaces/[workspaceId]/route.ts` | GET workspace metadata, parties, unread counts |
| `app/api/hach/workspaces/[workspaceId]/channel/hach/messages/route.ts` | GET/POST HACH-private messages |
| `app/api/hach/workspaces/[workspaceId]/channel/hach/messages/[messageId]/route.ts` | PATCH edit message (5-min window) |
| `app/api/hach/workspaces/[workspaceId]/channel/shared/messages/route.ts` | GET/POST shared messages |
| `app/api/hach/workspaces/[workspaceId]/channel/shared/messages/[messageId]/route.ts` | PATCH edit shared message |
| `app/api/hach/workspaces/[workspaceId]/channel/[channel]/read/route.ts` | POST mark channel read |

All HACH routes:
- Use `requireHachUser()` (returns 403 for non-HACH)
- Call `resolveHachWorkspace()` for 403 check
- Touch ONLY `hach_workspace_messages`, `shared_workspace_messages`, `workspace_read_receipts`
- Set `author_party_org = 'hach'` explicitly on shared POST
- Wrap ALL responses with `safeHachJson()`
- Call `logAudit()` on POST/PATCH

### 7. Test Suite
- **Path:** `lib/workspaces/__tests__/workspace-wall.test.ts`
- **Size:** ~400 lines
- **Test count:** 10 wall tests as enumerated in PRD

Test infrastructure:
- Mock Supabase client (pattern from `notifications.test.ts`)
- Seed utilities for admin_users, pbv_full_applications, form_submission_documents
- Session mocking for Stanton/HACH users

Test list:
1. Stanton cannot retrieve HACH-private messages
2. HACH cannot retrieve Stanton-private messages
3. DB constraint rejects `INSERT ... author_party_org='hach'` into `stanton_workspace_messages`
4. DB constraint rejects symmetric case into `hach_workspace_messages`
5. Both sessions retrieve same shared messages
6. Shared messages tag authorship correctly (stanton/hach)
7. Edit window enforced (1 min = success, 6 min = 409)
8. Author check on edit (user A posts, user B edits = 403)
9. Cross-workspace isolation (workspace A messages not in workspace B)
10. HACH responses pass `safeHachJson` allowlist

### 8. Build Report
- **Path:** `docs/build-reports/review-workspace-schema_build-report_2026-05-12.md`
- Will be created after implementation with all verification evidence

---

## Implementation Order

1. Migration (create tables)
2. Types (shared interfaces)
3. Edit window helper (simple, no dependencies)
4. Scope resolver helpers (needs types)
5. Stanton routes (needs scope helpers)
6. HACH routes (needs scope helpers, payload-filter)
7. Tests (needs all above)
8. Build report (verification evidence)

---

## Verification Checklist (Pre-declaration)

Before declaring complete, I will verify:

- [ ] Migration applies cleanly with no errors
- [ ] `npm run build` succeeds (zero errors)
- [ ] TypeScript strict mode passes (no new `any`)
- [ ] All 10 wall tests pass in Vitest
- [ ] Manual curl walkthrough of all endpoints (items 5a-5i from PRD)
- [ ] End-to-end save verification (query DB to confirm writes)
- [ ] Wall walkthrough (cross-side access attempts return 403)
- [ ] HACH allowlist passes (no banned keys in responses)

---

## Open Questions

None — PRD is comprehensive. Will implement exactly as specified.

---

## Estimated Effort

- Migration: 30 min
- Types + helpers: 45 min
- Stanton routes: 90 min
- HACH routes: 60 min
- Tests: 90 min
- Verification: 45 min
- **Total: ~6 hours**

---

## Request for Confirmation

**Alex — please review this plan. Once you confirm with "go", "proceed", "yes", or similar, I will begin implementation.**

Key points to confirm:
1. Migration timestamp `20260512130000` is acceptable (after `20260512120000_dra_source_column`)
2. Any concerns about the route structure under `/api/admin/workspaces/` and `/api/hach/workspaces/`
3. Any modifications to the 10 test cases
4. Any other considerations before I begin
