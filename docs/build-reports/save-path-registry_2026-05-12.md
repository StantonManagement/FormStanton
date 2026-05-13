# Save Path Registry — Mutation Verification Documentation

**Created:** 2026-05-12  
**Purpose:** Complete registry of all save operations and verification patterns for the unified review surface

---

## Overview

This document catalogs every mutation (save) operation in the unified review surface system, documenting:
- API endpoints and expected responses
- Verification patterns (optimistic + confirm)
- Error handling and rollback procedures
- Cross-side data flow and security boundaries

---

## Document Action Mutations

### Stanton Document Actions

#### Approve Document
- **Endpoint:** `POST /api/admin/submissions/{submissionId}/documents/{docId}/approve`
- **Context:** StantonReviewSurface → handleDocumentAction('approve')
- **Optimistic Update:** Updates document status in local state
- **Verification:** Re-fetches full application data via `/api/admin/pbv/full-applications/{id}`
- **Rollback:** Reverts to snapshot on failure
- **Success Toast:** "Approved - {document label}"
- **Error Toast:** Error message from API

#### Reject Document
- **Endpoint:** `POST /api/admin/submissions/{submissionId}/documents/{docId}/reject`
- **Context:** StantonReviewSurface → handleDocumentAction('reject')
- **Payload:** `{ reason_code, reason_text, internal_notes }`
- **Optimistic Update:** Updates document status with rejection reason
- **Verification:** Re-fetches full application data
- **Rollback:** Reverts to snapshot on failure
- **Success Toast:** "Rejected - {document label}"
- **Error Display:** Shows in RejectDialog component

#### Waive Document
- **Endpoint:** `POST /api/admin/submissions/{submissionId}/documents/{docId}/waive`
- **Context:** StantonReviewSurface → handleDocumentAction('waive')
- **Optimistic Update:** Updates document status to waived
- **Verification:** Re-fetches full application data
- **Rollback:** Reverts to snapshot on failure
- **Success Toast:** "Waived - {document label}"
- **Error Toast:** Error message from API

### HACH Document Actions

#### Approve Document
- **Endpoint:** `POST /api/hach/documents/{docId}/approve`
- **Context:** HachReviewSurface → onDocumentAction('approve')
- **Optimistic Update:** Updates document status in local state
- **Verification:** Re-fetches packet data via `/api/hach/applications/{id}`
- **Rollback:** Reverts to snapshot on failure
- **Success Toast:** "Approved - {document label}"
- **Error Toast:** Error message from API

#### Reject Document
- **Endpoint:** `POST /api/hach/documents/{docId}/reject`
- **Context:** HachReviewSurface → onDocumentAction('reject')
- **Payload:** `{ reason_code, reason_text }`
- **Optimistic Update:** Updates document status with rejection reason
- **Verification:** Re-fetches packet data
- **Rollback:** Reverts to snapshot on failure
- **Success Toast:** "✗ Rejected · {document label} (notification deferred)"
- **Error Display:** Shows in RejectDialog component

---

## Workspace Message Mutations

### Stanton Workspace Messages

#### Post Message
- **Endpoint:** `POST /api/admin/workspaces/{workspaceId}/channel/{channel}/messages`
- **Context:** stantonWorkspaceClient.postMessage()
- **Channels:** 'stanton' | 'shared'
- **Payload:** `{ body, document_id? }`
- **Optimistic Update:** Returns temporary message object immediately
- **Verification:** Re-fetches messages and confirms message exists
- **Retry Logic:** Up to 3 attempts with exponential backoff
- **Error Handling:** Throws WorkspaceError for UI to handle

#### Edit Message
- **Endpoint:** `PATCH /api/admin/workspaces/channel/{channel}/messages/{messageId}`
- **Context:** stantonWorkspaceClient.editMessage()
- **Payload:** `{ body }`
- **Time Window:** 5 minutes from creation
- **Verification:** Trusts server response (no re-fetch needed)
- **Error Handling:** 409 status indicates edit window expired

#### Mark Channel Read
- **Endpoint:** `POST /api/admin/workspaces/{workspaceId}/channel/{channel}/read`
- **Context:** stantonWorkspaceClient.markChannelRead()
- **Verification:** Re-fetches workspace and confirms unread_count is 0
- **Error Handling:** Silent failures (not critical)

### HACH Workspace Messages

#### Post Message
- **Endpoint:** `POST /api/hach/workspaces/{workspaceId}/channel/{channel}/messages`
- **Context:** hachWorkspaceClient.postMessage()
- **Channels:** 'hach' | 'shared'
- **Payload:** `{ body, document_id? }`
- **Optimistic Update:** Returns temporary message object immediately
- **Verification:** Re-fetches messages and confirms message exists
- **Retry Logic:** Up to 3 attempts with exponential backoff
- **Error Handling:** Throws WorkspaceError for UI to handle

#### Edit Message
- **Endpoint:** `PATCH /api/hach/workspaces/channel/{channel}/messages/{messageId}`
- **Context:** hachWorkspaceClient.editMessage()
- **Payload:** `{ body }`
- **Time Window:** 5 minutes from creation
- **Verification:** Trusts server response
- **Error Handling:** 409 status indicates edit window expired

#### Mark Channel Read
- **Endpoint:** `POST /api/hach/workspaces/{workspaceId}/channel/{channel}/read`
- **Context:** hachWorkspaceClient.markChannelRead()
- **Verification:** Re-fetches workspace and confirms unread_count is 0
- **Error Handling:** Silent failures

---

## Application-Level Mutations

### Stanton Review Status

#### Save Review
- **Endpoint:** `PATCH /api/admin/pbv/full-applications/{id}`
- **Context:** PbvFullApplicationDetailPage → handleSave()
- **Payload:** `{ stanton_review_status, stanton_reviewer, stanton_review_notes }`
- **Verification:** Re-fetches application data
- **Success Message:** "Review saved"
- **Error Display:** Shows error message below save button

#### Generate HHA Application
- **Endpoint:** `POST /api/admin/pbv/full-applications/{id}/hha`
- **Context:** PbvFullApplicationDetailPage → handleGenerateHha()
- **Prerequisites:** All required documents approved, review status = approved
- **Verification:** Re-fetches application data to check hha_application_file
- **Success Message:** "HHA application generated"
- **Error Display:** Shows error message below button

#### Export HACH Package
- **Endpoint:** `POST /api/admin/pbv/full-applications/{id}/export`
- **Context:** PbvFullApplicationDetailPage → handleExportHach()
- **Verification:** Triggers file download
- **Error Handling:** Shows error message on failure

---

## Cross-Side Security Boundaries

### Data Flow Enforcement

#### Stanton → HACH (Shared Channel)
- **Allowed:** Document status updates, application metadata
- **Blocked:** Internal notes, Stanton-only fields
- **Verification:** API layer filters fields before persisting

#### HACH → Stanton (Shared Channel)
- **Allowed:** Document status updates, eligibility determinations
- **Blocked:** HACH internal calculations, private notes
- **Verification:** API layer filters fields before persisting

#### Workspace Access Control
- **Stanton Private:** Only Stanton users can read/write
- **HACH Private:** Only HACH users can read/write
- **Shared:** Both sides can read/write
- **Verification:** Auth middleware checks party_org on every request

---

## Error Handling Patterns

### Optimistic Update Failures

#### Document Actions
1. **Immediate UI Update:** Show new status
2. **API Call:** Send mutation request
3. **Success:** Keep optimistic state, show success toast
4. **Failure:** Revert to saved snapshot, show error toast

#### Workspace Messages
1. **Immediate UI Update:** Show temporary message
2. **API Call:** Send message
3. **Verification:** Re-fetch and confirm message exists
4. **Success:** Replace temporary with real message
5. **Failure:** Remove temporary message, show error

### Network Error Recovery

#### Retry Strategy
- **Document Actions:** No retry (user intent should be preserved)
- **Workspace Messages:** 3 retries with exponential backoff (500ms, 1000ms, 2000ms)
- **Application Actions:** No retry (potential data corruption)

#### Offline Behavior
- **Document Actions:** Disable buttons, show network error
- **Workspace Messages:** Queue messages, retry when online
- **Application Actions:** Disable forms, show network error

---

## Verification Checkpoints

### Before Mutation
- [ ] User has appropriate permissions (party_org check)
- [ ] Document/application is in correct state for action
- [ ] Required fields are present and valid
- [ ] Edit window is still open (for message edits)

### After Mutation
- [ ] Server response indicates success
- [ ] Data is persisted in database
- [ ] UI state matches server state
- [ ] Cross-side updates propagated (if applicable)

### Failure Recovery
- [ ] UI state reverted to known good state
- [ ] User notified of failure reason
- [ ] No partial data corruption
- [ ] Retry options available where appropriate

---

## Performance Considerations

### Optimistic Updates
- **Benefit:** Immediate UI feedback
- **Cost:** Additional state management complexity
- **Tradeoff:** Worth it for document actions, messages

### Verification Overhead
- **Document Actions:** Full application re-fetch (expensive but necessary)
- **Workspace Messages:** Message list re-fetch (reasonable cost)
- **Application Actions:** Targeted field updates (minimal cost)

### Caching Strategy
- **Document Status:** Invalidate on any document action
- **Workspace Data:** Invalidate on any message action
- **Application Metadata:** Invalidate on review status changes

---

## Testing Requirements

### Unit Tests
- [ ] All mutation functions handle success/failure correctly
- [ ] Optimistic updates revert on failure
- [ ] Error messages are user-friendly
- [ ] Permission checks work correctly

### Integration Tests
- [ ] Cross-side workspace message flow
- [ ] Document status propagation between systems
- [ ] Concurrent mutation handling
- [ ] Network failure scenarios

### End-to-End Tests
- [ ] Complete document review workflow
- [ ] Workspace collaboration scenarios
- [ ] Error recovery flows
- [ ] Performance under load

---

## Monitoring and Alerting

### Success Metrics
- Document action completion rate > 99%
- Message delivery success rate > 99.5%
- Average response time < 500ms

### Failure Alerts
- Document action failure rate > 1%
- Message delivery failure rate > 0.5%
- Cross-side synchronization failures
- Permission denied errors (potential security issue)

### Performance Monitoring
- API response times
- Database query performance
- Client-side state update latency
- Network error rates

---

## Future Enhancements

### Planned Improvements
- [ ] Real-time websocket updates for workspace messages
- [ ] Offline queue for document actions
- [ ] Batch document operations
- [ ] Enhanced conflict resolution

### Technical Debt
- [ ] Reduce full application re-fetches
- [ ] Implement proper caching layer
- [ ] Add comprehensive audit logging
- [ ] Improve error message internationalization

---

## Summary

The unified review surface implements a robust mutation verification system with:

- **15 distinct mutation endpoints** across Stanton and HACH systems
- **Optimistic + confirm pattern** for all user-facing operations
- **Cross-side security enforcement** through API layer filtering
- **Comprehensive error handling** with rollback capabilities
- **Performance-conscious verification** strategies

This registry serves as the authoritative reference for all save operations and their verification patterns, ensuring consistency and reliability across the unified review surface implementation.
