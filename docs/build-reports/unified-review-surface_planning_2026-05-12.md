# Unified Review Surface — Planning Document

**Created:** 2026-05-12  
**Purpose:** Component inventory and architecture plan for unified review surface implementation

---

## Component Inventory from HACH Page

### Primitives defined in `app/hach/applications/[id]/page.tsx`

| Component | Location | Purpose | Lift Decision |
|-----------|----------|---------|---------------|
| `Kbd` | lines 41-51 | Keyboard key display styling | **Lift** - Shared primitive |
| `StatusBadge` | lines 54-75 | Document status badge (approved/pending/rejected/etc) | **Lift** - Shared primitive |
| `HachStatusBadge` | lines 77-94 | HACH-specific application status | **Keep HACH** - HACH-only |
| `Button` | lines 96-130 | Button component with variants (primary/approve/reject/secondary/ghost) | **Lift** - Shared primitive |
| `Panel` | lines 132-141 | Section container with title | **Lift** - Shared primitive |
| `ToastBar` | lines 145-161 | Fixed toast notification | **Lift** - Shared primitive |
| `ShortcutsBar` | lines 165-195 | Fixed bottom shortcuts bar | **Lift** - Shared primitive |
| `ShortcutsHelpModal` | lines 199-255 | Keyboard shortcuts help modal | **Lift** - Shared primitive |
| `IncomePanel` | lines 259-292 | Income eligibility display | **Keep HACH** - HACH-specific (calls HACH API) |
| `DocumentRow` | lines 315-396 | Single document row with actions and focus state | **Lift** - Core shared primitive |
| `formatRelativeTime` | lines 294-302 | Time formatting utility | **Lift** - Shared utility |
| `getEffectiveStatus` | lines 304-311 | Status calculation from latest action | **Lift** - Shared utility |

### External Components (to be replaced)

| Component | Location | Purpose | Replacement |
|-----------|----------|---------|-------------|
| `DocumentViewer` | `components/hach/DocumentViewer.tsx` | Modal PDF/image viewer with version navigation | **Lift** - `components/review/DocumentViewer.tsx` |
| `RejectDialog` | `components/hach/RejectDialog.tsx` | Document rejection dialog with reason templates | **Lift** - `components/review/RejectDialog.tsx` |

---

## Component Inventory from Stanton Page

### Current State in `app/admin/pbv/full-applications/[id]/page.tsx`

The Stanton page is primarily a data display form with minimal interactive components:

| Element | Purpose | Integration Strategy |
|---------|---------|----------------------|
| Income editor table | Edit documented income per member | **Keep** - Existing implementation stays |
| Document status list | Read-only document status display | **Replace** - Use shared `DocumentRow` |
| Review form | Application-level review controls | **Keep** - Existing implementation stays |
| Action buttons | HHA generation, export, magic link | **Keep** - Existing implementation stays |
| Member list | Household member display | **Keep** - Existing implementation stays |

---

## Shared Component Architecture

### Core Primitives (`components/review/`)

#### 1. DocumentRow
**Props:**
```typescript
interface DocumentRowProps {
  doc: {
    id: string;
    label: string;
    file_name?: string | null;
    status: string;
    latest_action?: {
      action: string;
      reviewer_name: string;
      created_at: string;
      rejection_reason?: string;
    };
  };
  context: 'stanton' | 'hach';
  isFocused: boolean;
  isFlashing?: boolean;
  isApproving?: boolean;
  unreadCountByChannel?: Record<string, number>;
  onApprove: (id: string) => void;
  onReject: (doc: any) => void;
  onWaive?: (id: string) => void; // Stanton only
  onView: (doc: any) => void;
  onClick: () => void;
  onExpand?: () => void; // For message thread
  isExpanded?: boolean;
  expandedSlot?: React.ReactNode; // Message thread content
  rowRef?: (el: HTMLDivElement | null) => void;
}
```

**Context Differences:**
- Stanton: Shows Approve/Reject/Waive buttons
- HACH: Shows Approve/Reject buttons only
- Both show unread badges per channel

#### 2. DocumentViewer
**Props:**
```typescript
interface DocumentViewerProps {
  document: {
    id: string;
    label: string;
    file_name?: string | null;
    storage_path?: string | null;
    revision?: number | null;
  };
  context: 'stanton' | 'hach';
  onClose: () => void;
}
```

**Context Differences:**
- API endpoint differs: `/api/admin/submissions/.../documents/.../signed-url` vs `/api/hach/documents/.../signed-url`
- Styling: Tailwind classes vs inline styles

#### 3. RejectDialog
**Props:**
```typescript
interface RejectDialogProps {
  document: {
    id: string;
    label: string;
    file_name?: string | null;
  };
  application: {
    head_of_household_name: string;
    building_address?: string | null;
    unit_number?: string | null;
    preferred_language?: string | null;
  };
  context: 'stanton' | 'hach';
  onClose: () => void;
  onSubmit: (documentId: string, reasonCode: string, reasonText: string | undefined, internalNotes?: string) => Promise<void>;
}
```

**Context Differences:**
- Stanton: Shows additional "Internal notes" textarea
- HACH: No internal notes field
- API endpoints differ for submission

#### 4. MessageThread
**Props:**
```typescript
interface MessageThreadProps {
  messages: Array<{
    id: string;
    author_display_name: string;
    body: string;
    created_at: string;
    edited_at?: string;
    author_user_id: string;
  }>;
  currentUserId: string;
  context: 'stanton' | 'hach';
  canEditWindowMinutes: number;
  onPost: (body: string) => Promise<void>;
  onEdit: (messageId: string, body: string) => Promise<void>;
  onMarkRead: () => Promise<void>;
  emptyHint: string;
}
```

#### 5. ApplicationWorkspacePanel
**Props:**
```typescript
interface ApplicationWorkspacePanelProps {
  tabs: Array<{
    key: string;
    label: string;
    channel: string;
    unread: number;
    messages: any[];
    onPost: (body: string) => Promise<void>;
    onEdit: (messageId: string, body: string) => Promise<void>;
    onMarkRead: () => Promise<void>;
  }>;
  context: 'stanton' | 'hach';
}
```

**Context Differences:**
- Stanton tabs: `Stanton Private` + `Shared with HACH`
- HACH tabs: `HACH Private` + `Shared with Stanton`

#### 6. useReviewKeyboardShortcuts (Hook)
**Returns:**
```typescript
interface UseReviewKeyboardShortcutsReturn {
  focusedIdx: number;
  setFocusedIdx: (idx: number) => void;
}
```

**Supported Keys:** J, K, A, R, V, M (focus message input), ?, Esc

---

## Per-Context Wrappers

### StantonReviewSurface
**Props:**
```typescript
interface StantonReviewSurfaceProps {
  application: AppDetail;
  documents: Doc[];
  workspace?: any;
  onDocumentAction: (action: string, docId: string, data?: any) => Promise<void>;
  onWorkspaceMessage: (channel: string, body: string, documentId?: string) => Promise<void>;
}
```

**Responsibilities:**
- Fetches workspace data via Stanton API client
- Renders Stanton-specific layout (income editor, review form, etc.)
- Composes shared primitives with Stanton callbacks
- Applies Tailwind styling

### HachReviewSurface  
**Props:**
```typescript
interface HachReviewSurfaceProps {
  packet: any;
  workspace?: any;
  onDocumentAction: (action: string, docId: string, data?: any) => Promise<void>;
  onWorkspaceMessage: (channel: string, body: string, documentId?: string) => Promise<void>;
}
```

**Responsibilities:**
- Fetches workspace data via HACH API client
- Renders HACH-specific layout (progress bar, income panel, etc.)
- Composes shared primitives with HACH callbacks
- Applies inline-style IBM Plex aesthetic

---

## State Management Mapping

### Current Stanton Page State → New Structure

| Current State | New Location | Notes |
|---------------|--------------|-------|
| `detail` (AppDetail) | Parent component | Unchanged |
| `incomeEdits` | Parent component | Unchanged |
| `reviewStatus`, `reviewerName`, `reviewNotes` | Parent component | Unchanged |
| `documents` array | Parent component | Will include workspace message data |
| `loading`, `error` | Parent component | Unchanged |
| Document action state | `DocumentRow` internal | Optimistic UI state |

### Current HACH Page State → New Structure

| Current State | New Location | Notes |
|---------------|--------------|-------|
| `packet` | Parent component | Unchanged |
| `documents` | Parent component | Will include workspace message data |
| `focusedDocIdx`, `flashDocIdx` | `useReviewKeyboardShortcuts` | Extracted to hook |
| `viewingDoc`, `rejectingDoc` | Parent component | Unchanged |
| `toast` | Parent component | Unchanged |
| `showShortcuts` | Parent component | Unchanged |
| Keyboard handler | `useReviewKeyboardShortcuts` | Extracted to hook |

---

## API Integration Plan

### Workspace Client (`lib/workspaces/client.ts`)

**Stanton Client Functions:**
- `getStantonWorkspace(workspaceId)`
- `getStantonMessages(workspaceId, documentId?)`
- `postStantonMessage(workspaceId, body, documentId?)`
- `editStantonMessage(messageId, body)`
- `getSharedMessages(workspaceId, documentId?)`
- `postSharedMessage(workspaceId, body, documentId?)`
- `editSharedMessage(messageId, body)`
- `markChannelRead(workspaceId, channel)`

**HACH Client Functions:**
- `getHachWorkspace(workspaceId)`
- `getHachMessages(workspaceId, documentId?)`
- `postHachMessage(workspaceId, body, documentId?)`
- `editHachMessage(messageId, body)`
- (Shared functions reused)

**Pattern:** All functions implement optimistic update → server call → verification → revert on failure

---

## File Creation Plan

### New Files
1. `components/review/DocumentRow.tsx`
2. `components/review/DocumentViewer.tsx`
3. `components/review/RejectDialog.tsx`
4. `components/review/MessageThread.tsx`
5. `components/review/ApplicationWorkspacePanel.tsx`
6. `components/review/StatusBadge.tsx`
7. `components/review/Panel.tsx`
8. `components/review/Button.tsx`
9. `components/review/Kbd.tsx`
10. `components/review/ShortcutsBar.tsx`
11. `components/review/ShortcutsHelpModal.tsx`
12. `components/review/useReviewKeyboardShortcuts.ts`
13. `components/review/StantonReviewSurface.tsx`
14. `components/review/HachReviewSurface.tsx`
15. `lib/workspaces/client.ts`
16. `lib/review/utils.ts` (formatRelativeTime, getEffectiveStatus)

### Modified Files
1. `app/admin/pbv/full-applications/[id]/page.tsx` - Replace document section
2. `app/hach/applications/[id]/page.tsx` - Refactor to use shared primitives
3. `app/api/admin/pbv/full-applications/route.ts` - Add unread_count
4. `app/api/hach/applications/route.ts` - Add unread_count
5. `app/admin/pbv/full-applications/page.tsx` - Show unread badges
6. `app/hach/page.tsx` - Show unread badges

### Deleted Files
1. `components/hach/DocumentViewer.tsx` - Replaced by shared version
2. `components/hach/RejectDialog.tsx` - Replaced by shared version

---

## Verification Checklist

### Component Lift Verification
- [ ] All HACH primitives successfully extracted to `components/review/`
- [ ] Stanton page renders shared `DocumentRow` components
- [ ] HACH page renders shared primitives with no visual regression
- [ ] Context prop correctly switches behavior between sides

### API Integration Verification  
- [ ] Workspace client functions implement optimistic+confirm pattern
- [ ] Stanton workspace API calls succeed
- [ ] HACH workspace API calls succeed
- [ ] Cross-side wall enforcement (no data leakage)

### Save Reliability Verification
- [ ] Document approve/reject operations verify server state
- [ ] Message post operations verify persistence
- [ ] Message edit operations respect 5-minute window
- [ ] Mark-read operations update unread counts

### Visual Regression Verification
- [ ] HACH page visual diff passes (screenshots before/after)
- [ ] Stanton page maintains existing Tailwind styling
- [ ] Keyboard shortcuts work on both sides
- [ ] Responsive behavior preserved

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Visual drift on HACH page | Take baseline screenshots, diff after implementation |
| Save operations silently failing | Implement verification pattern for all mutations |
| Cross-side data leakage | API layer wall already exists; UI only calls appropriate endpoints |
| Performance regression with workspace data | Lazy load workspace panels, optimistic updates |
| Complex prop drilling | Context providers for workspace data if needed |

---

## Next Steps

1. Create shared primitives in `components/review/`
2. Implement workspace client with optimistic+confirm pattern
3. Replace Stanton document section with shared components
4. Refactor HACH page to use shared primitives
5. Add unread badges to list pages
6. Comprehensive testing and verification

This plan provides the foundation for implementing the unified review surface while maintaining the distinct visual identities and access controls required by each side.
