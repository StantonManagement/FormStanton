'use client';

import { useState, useEffect, useCallback } from 'react';
import DocumentRow from './DocumentRow';
import DocumentViewer from './DocumentViewer';
import RejectDialog from './RejectDialog';
import ApplicationWorkspacePanel from './ApplicationWorkspacePanel';
import ShortcutsHelpModal from './ShortcutsHelpModal';
import ShortcutsBar from './ShortcutsBar';
import { useReviewKeyboardShortcuts } from './useReviewKeyboardShortcuts';
import { hachWorkspaceClient } from '@/lib/workspaces/client';
import { formatRelativeTime } from './utils';

interface Document {
  id: string;
  label: string;
  file_name?: string | null;
  status: string;
  category?: string;
  doc_type?: string;
  storage_path?: string | null;
  latest_action?: {
    action: string;
    reviewer_name: string;
    created_at: string;
    rejection_reason?: string;
  };
}

interface Member {
  id: string;
  slot: number;
  name: string;
  age: number | null;
  relationship: string;
  date_of_birth: string | null;
  annual_income: number;
  documented_income: number | null;
  income_sources: string[];
}

interface Packet {
  application: {
    id: string;
    created_at: string;
    head_of_household_name: string;
    building_address: string;
    unit_number: string;
    household_size: number;
    hach_review_status: string;
    preferred_language?: string | null;
    hach_packet_revision?: number | null;
    submitted_to_hach_at?: string | null;
  };
  members: Member[];
  documents: Document[];
  new_since_last_view?: number;
  last_viewed_at?: string | null;
}

interface NotificationResult {
  status: 'sent' | 'email_fallback' | 'blocked' | 'failed';
  notification_id?: string;
  twilio_sid?: string;
  emailSent?: boolean;
  reason?: string;
  error?: string;
}

interface DocumentActionResult {
  success: boolean;
  notification?: NotificationResult;
}

interface HachReviewSurfaceProps {
  packet: Packet;
  workspaceId?: string;
  onDocumentAction: (action: string, docId: string, data?: any) => Promise<DocumentActionResult>;
}

export default function HachReviewSurface({ 
  packet, 
  workspaceId,
  onDocumentAction 
}: HachReviewSurfaceProps) {
  const [documents, setDocuments] = useState<Document[]>(packet.documents);
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const [rejectingDoc, setRejectingDoc] = useState<Document | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [workspaceData, setWorkspaceData] = useState<any>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  // Load workspace data if workspaceId provided
  useEffect(() => {
    if (!workspaceId) return;
    
    setWorkspaceLoading(true);
    hachWorkspaceClient.getWorkspace(workspaceId)
      .then(setWorkspaceData)
      .catch(() => {
        // Workspace might not exist yet, that's okay
        setWorkspaceData(null);
      })
      .finally(() => setWorkspaceLoading(false));
  }, [workspaceId]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2800);
  }, []);

  // Document actions with optimistic updates
  const handleApprove = useCallback(async (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;
    
    // Optimistic update
    const snapshot = documents;
    setDocuments(prev => prev.map(d =>
      d.id === docId 
        ? { ...d, latest_action: { action: 'approved', reviewer_name: 'You', created_at: new Date().toISOString(), rejection_reason: undefined } }
        : d
    ));

    try {
      await onDocumentAction('approve', docId);
      showToast(`Approved - ${doc.label}`, 'success');
    } catch (error: any) {
      setDocuments(snapshot); // Revert on error
      showToast(error.message || 'Approval failed', 'error');
    }
  }, [documents, onDocumentAction, showToast]);

  const handleReject = useCallback((doc: Document) => {
    setRejectingDoc(doc);
  }, []);

  const handleRejectSubmit = useCallback(async (docId: string, reasonCode: string, reasonText: string | undefined, internalNotes?: string) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    // Optimistic update
    const snapshot = documents;
    setDocuments(prev => prev.map(d =>
      d.id === docId
        ? { ...d, latest_action: { action: 'rejected', reviewer_name: 'You', created_at: new Date().toISOString(), rejection_reason: reasonText ?? reasonCode } }
        : d
    ));

    try {
      const result = await onDocumentAction('reject', docId, { reasonCode, reasonText });
      setRejectingDoc(null);

      // Determine toast message based on notification result
      const notification = result?.notification;
      let toastMessage = `✗ Rejected · ${doc.label}`;
      let toastType: 'success' | 'error' = 'error';

      if (notification) {
        if (notification.status === 'sent') {
          toastMessage = `✗ Rejected · Tenant notified via SMS`;
        } else if (notification.status === 'email_fallback') {
          if (notification.emailSent) {
            toastMessage = `✗ Rejected · SMS failed, email sent`;
          } else {
            toastMessage = `✗ Rejected · SMS failed, email fallback failed`;
          }
        } else if (notification.status === 'blocked') {
          if (notification.reason === 'missing_phone') {
            toastMessage = `✗ Rejected · No phone on file (email sent)`;
          } else if (notification.reason === 'missing_language') {
            toastMessage = `✗ Rejected · Language not confirmed`;
          } else if (notification.reason === 'invalid_phone') {
            toastMessage = `✗ Rejected · Invalid phone number`;
          } else if (notification.reason === 'opted_out') {
            toastMessage = `✗ Rejected · Tenant opted out of SMS`;
          } else {
            toastMessage = `✗ Rejected · ${doc.label} (notification blocked)`;
          }
        } else if (notification.status === 'failed') {
          toastMessage = `✗ Rejected · SMS and email both failed`;
        }
      }

      showToast(toastMessage, toastType);
    } catch (error: any) {
      setDocuments(snapshot); // Revert on error
      throw error; // Let RejectDialog handle the error display
    }
  }, [documents, onDocumentAction, showToast]);

  const handleView = useCallback((doc: Document) => {
    setViewingDoc(doc);
  }, []);

  // Keyboard shortcuts
  const { focusedIdx, setFocusedIdx, setRowRef } = useReviewKeyboardShortcuts({
    documents,
    onApprove: handleApprove,
    onReject: handleReject,
    onView: handleView,
    onMessageFocus: (docId) => setExpandedDocId(docId === expandedDocId ? null : docId),
    onCloseModals: () => {
      if (showShortcuts) setShowShortcuts(false);
      if (rejectingDoc) setRejectingDoc(null);
      if (viewingDoc) setViewingDoc(null);
    },
  });

  // Workspace message handlers
  const handleWorkspaceMessage = useCallback(async (channel: 'hach' | 'shared', body: string, documentId?: string) => {
    if (!workspaceId) return;
    
    try {
      await hachWorkspaceClient.postMessage(workspaceId, channel, body, documentId);
      // Refresh workspace data
      const updated = await hachWorkspaceClient.getWorkspace(workspaceId);
      setWorkspaceData(updated);
    } catch (error: any) {
      showToast(error.message || 'Failed to post message', 'error');
    }
  }, [workspaceId, showToast]);

  const handleWorkspaceEdit = useCallback(async (messageId: string, channel: 'hach' | 'shared', body: string) => {
    try {
      await hachWorkspaceClient.editMessage(workspaceId ?? '', messageId, channel, body);
      // Refresh workspace data
      if (workspaceId) {
        const updated = await hachWorkspaceClient.getWorkspace(workspaceId);
        setWorkspaceData(updated);
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to edit message', 'error');
    }
  }, [workspaceId, showToast]);

  const handleMarkRead = useCallback(async (channel: 'hach' | 'shared') => {
    if (!workspaceId) return;
    
    try {
      await hachWorkspaceClient.markChannelRead(workspaceId, channel);
      // Refresh workspace data
      const updated = await hachWorkspaceClient.getWorkspace(workspaceId);
      setWorkspaceData(updated);
    } catch (error: any) {
      // Don't show toast for read failures, it's not critical
      console.error('Failed to mark channel read:', error);
    }
  }, [workspaceId]);

  // Group documents by category
  const grouped = documents.reduce<Record<string, Document[]>>((acc, doc) => {
    const cat = doc.category ?? doc.doc_type ?? 'Documents';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(doc);
    return acc;
  }, {});

  // Calculate progress
  const progress = documents.reduce(
    (acc, doc) => {
      const status = doc.latest_action?.action || doc.status;
      acc.total++;
      if (status === 'approved') acc.approved++;
      else if (status === 'rejected') acc.rejected++;
      else if (status === 'waived') acc.waived++;
      else if (status === 'missing') acc.missing++;
      else acc.pending++;
      return acc;
    },
    { approved: 0, pending: 0, rejected: 0, waived: 0, missing: 0, total: 0 }
  );

  const pct = progress.total > 0 ? Math.round((progress.approved / progress.total) * 100) : 0;

  // Prepare workspace tabs if workspace data exists
  const workspaceTabs = workspaceData ? [
    {
      key: 'hach',
      label: 'HACH Private',
      channel: 'hach' as const,
      unread: workspaceData.unread_counts.hach || 0,
      messages: [], // Will be loaded by MessageThread
      onPost: (body: string) => handleWorkspaceMessage('hach', body),
      onEdit: (messageId: string, body: string) => handleWorkspaceEdit(messageId, 'hach', body),
      onMarkRead: () => handleMarkRead('hach'),
    },
    {
      key: 'shared',
      label: 'Shared with Stanton',
      channel: 'shared' as const,
      unread: workspaceData.unread_counts.shared || 0,
      messages: [], // Will be loaded by MessageThread
      onPost: (body: string) => handleWorkspaceMessage('shared', body),
      onEdit: (messageId: string, body: string) => handleWorkspaceEdit(messageId, 'shared', body),
      onMarkRead: () => handleMarkRead('shared'),
    },
  ] : [];

  const { application: app, members } = packet;
  const submittedDate = new Date(app.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const COLORS = {
    accent: '#0f4c5c',
    accentLight: '#e6f0f3',
    bg: '#fafaf9',
    panel: '#ffffff',
    border: '#e7e5e4',
    borderStrong: '#d6d3d1',
    text: '#1c1917',
    textMuted: '#78716c',
    approve: '#15803d',
    approveLight: '#dcfce7',
    reject: '#b91c1c',
    rejectLight: '#fee2e2',
    pending: '#a16207',
    pendingLight: '#fef9c3',
    missing: '#9ca3af',
    missingLight: '#f3f4f6',
    waived: '#6366f1',
    waivedLight: '#e0e7ff',
    success: '#16a34a',
    successBg: '#f0fdf4',
    error: '#dc2626',
    errorBg: '#fef2f2',
    infoBg: '#eff6ff',
    info: '#1d4ed8',
  };
  const FONT = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif";

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '28px 24px 80px', fontFamily: FONT }}>
      {/* Header */}
      <div style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: COLORS.text, margin: 0 }}>{app.head_of_household_name}</h1>
          <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 4 }}>
            {app.building_address}, Unit {app.unit_number} - {app.household_size}-person household - Submitted {submittedDate}
          </div>
        </div>
        <div style={{ flexShrink: 0, paddingTop: 4, display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 6 }}>
          <span style={{
            padding: '4px 12px',
            background: COLORS.infoBg, color: COLORS.info,
            fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' as const,
          }}>
            {app.hach_review_status === 'pending_hach' ? 'Needs Review' :
             app.hach_review_status === 'under_hach_review' ? 'In Review' :
             app.hach_review_status === 'approved_by_hach' ? 'Approved' :
             app.hach_review_status === 'rejected_by_hach' ? 'Rejected' : 'Not Routed'}
          </span>
          {(app.hach_packet_revision ?? 0) > 0 && (
            <span style={{
              padding: '2px 8px',
              background: '#f1f5f9', color: '#475569',
              fontSize: 11, fontWeight: 600, border: '1px solid #cbd5e1',
            }}>
              Revision {app.hach_packet_revision}
              {app.submitted_to_hach_at
                ? ' · ' + new Date(app.submitted_to_hach_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : ''}
            </span>
          )}
        </div>
      </div>

      {/* New uploads banner */}
      {packet.new_since_last_view && packet.new_since_last_view > 0 && packet.last_viewed_at && (
        <div style={{
          background: COLORS.infoBg,
          border: '1px solid #bfdbfe',
          padding: '8px 16px',
          marginBottom: 16,
          fontSize: 12,
          color: COLORS.info,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{ fontWeight: 700 }}>{packet.new_since_last_view} new upload{packet.new_since_last_view !== 1 ? 's' : ''}</span>
          <span>since your last visit · {formatRelativeTime(packet.last_viewed_at)}</span>
        </div>
      )}

      {/* Progress bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>
          <span style={{ fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>Document Completion</span>
          <span>{progress.approved} / {progress.total} approved</span>
        </div>
        <div style={{ height: 6, background: COLORS.border, position: 'relative' as const }}>
          <div style={{ position: 'absolute' as const, left: 0, top: 0, bottom: 0, width: `${pct}%`, background: pct === 100 ? COLORS.success : COLORS.accent, transition: 'width 300ms ease-out' }} />
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 11, color: COLORS.textMuted }}>
          <span><strong style={{ color: COLORS.approve }}>{progress.approved}</strong> approved</span>
          <span><strong style={{ color: COLORS.pending }}>{progress.pending}</strong> awaiting</span>
          <span><strong style={{ color: COLORS.reject }}>{progress.rejected}</strong> rejected</span>
          <span><strong style={{ color: COLORS.missing }}>{progress.missing}</strong> missing</span>
          <span><strong style={{ color: COLORS.waived }}>{progress.waived}</strong> waived</span>
        </div>
      </div>

      {/* Document sections */}
      {Object.entries(grouped).map(([category, catDocs]) => (
        <div key={category} style={{ background: COLORS.panel, border: `1px solid ${COLORS.border}`, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', backgroundColor: '#fafaf9', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: COLORS.textMuted }}>{category}</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "'IBM Plex Mono', monospace" }}>
              {catDocs.filter((d) => (d.latest_action?.action || d.status) === 'approved').length}/{catDocs.filter((d) => (d.latest_action?.action || d.status) !== 'waived').length} approved
            </div>
          </div>
          {catDocs.map((doc) => {
            const gIdx = documents.findIndex((d) => d.id === doc.id);
            const unreadCounts = workspaceData?.unread_counts || {};
            
            return (
              <DocumentRow
                key={doc.id}
                doc={doc}
                context="hach"
                isFocused={focusedIdx === gIdx}
                isApproving={false}
                unreadCountByChannel={unreadCounts}
                onApprove={handleApprove}
                onReject={handleReject}
                onView={handleView}
                onClick={() => setFocusedIdx(gIdx)}
                onExpand={() => setExpandedDocId(doc.id === expandedDocId ? null : doc.id)}
                isExpanded={expandedDocId === doc.id}
                expandedSlot={
                  expandedDocId === doc.id && workspaceId ? (
                    <div style={{ height: 256, borderTop: `1px solid ${COLORS.border}` }}>
                      <ApplicationWorkspacePanel
                        tabs={workspaceTabs.map(tab => ({
                          ...tab,
                          messages: [], // Will be loaded by MessageThread component
                          onPost: (body: string) => tab.onPost(body),
                          onEdit: (messageId: string, body: string) => tab.onEdit(messageId, body),
                          onMarkRead: tab.onMarkRead,
                        }))}
                        context="hach"
                        currentUserId="current-user" // TODO: Get from auth context
                      />
                    </div>
                  ) : null
                }
                rowRef={setRowRef(gIdx)}
              />
            );
          })}
        </div>
      ))}

      {/* Shortcuts bar */}
      <ShortcutsBar toast={toast} onShowHelp={() => setShowShortcuts(true)} context="hach" />

      {/* Modals */}
      {viewingDoc && (
        <DocumentViewer
          document={viewingDoc}
          context="hach"
          onClose={() => setViewingDoc(null)}
        />
      )}

      {showShortcuts && (
        <ShortcutsHelpModal onClose={() => setShowShortcuts(false)} context="hach" />
      )}

      {rejectingDoc && (
        <RejectDialog
          document={rejectingDoc}
          application={{
            head_of_household_name: app.head_of_household_name,
            building_address: app.building_address,
            unit_number: app.unit_number,
            preferred_language: app.preferred_language,
          }}
          context="hach"
          onClose={() => setRejectingDoc(null)}
          onSubmit={handleRejectSubmit}
        />
      )}
    </div>
  );
}
