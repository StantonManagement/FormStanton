'use client';

import { useState, useEffect, useCallback } from 'react';
import DocumentRow from './DocumentRow';
import DocumentViewer from './DocumentViewer';
import RejectDialog from './RejectDialog';
import ApplicationWorkspacePanel from './ApplicationWorkspacePanel';
import { useReviewKeyboardShortcuts } from './useReviewKeyboardShortcuts';
import { stantonWorkspaceClient } from '@/lib/workspaces/client';

interface Member { 
  id: string; 
  slot: number; 
  name: string; 
  age: number | null; 
  relationship: string; 
  ssn_last_four: string | null; 
  annual_income: number; 
  documented_income: number | null; 
  income_sources: string[]; 
  disability: boolean; 
  student: boolean; 
  citizenship_status: string; 
  criminal_history: boolean | null; 
  signature_required: boolean; 
  signature_date: string | null; 
  signed_forms: string[]; 
}

interface Doc { 
  id: string; 
  doc_type: string; 
  label: string; 
  person_slot: number; 
  status: string; 
  required: boolean; 
  display_order: number; 
  requires_signature: boolean; 
  file_name?: string | null;
  storage_path?: string | null;
  latest_action?: {
    action: string;
    reviewer_name: string;
    created_at: string;
    rejection_reason?: string;
  };
}

interface AppDetail { 
  id: string; 
  created_at: string; 
  head_of_household_name: string; 
  building_address: string; 
  unit_number: string; 
  bedroom_count: number | null; 
  household_size: number; 
  intake_submitted_at: string | null; 
  stanton_review_status: string; 
  stanton_reviewer: string | null; 
  stanton_review_date: string | null; 
  stanton_review_notes: string | null; 
  hha_application_file: string | null; 
  tenant_access_token: string; 
  form_submission_id: string; 
  magic_link: string; 
  claiming_medical_deduction: boolean; 
  has_childcare_expense: boolean; 
  dv_status: boolean; 
  homeless_at_admission: boolean; 
  reasonable_accommodation_requested: boolean; 
  members: Member[]; 
  documents: Doc[]; 
}

interface StantonReviewSurfaceProps {
  application: AppDetail;
  documents: Doc[];
  workspaceId?: string;
  onDocumentAction: (action: string, docId: string, data?: any) => Promise<void>;
}

export default function StantonReviewSurface({ 
  application, 
  documents, 
  workspaceId,
  onDocumentAction 
}: StantonReviewSurfaceProps) {
  const [viewingDoc, setViewingDoc] = useState<Doc | null>(null);
  const [rejectingDoc, setRejectingDoc] = useState<Doc | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [workspaceData, setWorkspaceData] = useState<any>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  // Load workspace data if workspaceId provided
  useEffect(() => {
    if (!workspaceId) return;
    
    setWorkspaceLoading(true);
    stantonWorkspaceClient.getWorkspace(workspaceId)
      .then(setWorkspaceData)
      .catch(() => {
        // Workspace might not exist yet, that's okay
        setWorkspaceData(null);
      })
      .finally(() => setWorkspaceLoading(false));
  }, [workspaceId]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Document actions
  const handleApprove = useCallback(async (docId: string) => {
    try {
      await onDocumentAction('approve', docId);
      showToast(`Approved - ${documents.find(d => d.id === docId)?.label}`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Approval failed', 'error');
    }
  }, [onDocumentAction, documents, showToast]);

  const handleReject = useCallback((doc: { id: string; [key: string]: any }) => {
    setRejectingDoc(doc as unknown as Doc);
  }, []);

  const handleWaive = useCallback(async (docId: string) => {
    try {
      await onDocumentAction('waive', docId);
      showToast(`Waived - ${documents.find(d => d.id === docId)?.label}`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Waive failed', 'error');
    }
  }, [onDocumentAction, documents, showToast]);

  const handleRejectSubmit = useCallback(async (docId: string, reasonCode: string, reasonText: string | undefined, internalNotes?: string) => {
    try {
      await onDocumentAction('reject', docId, { reasonCode, reasonText, internalNotes });
      setRejectingDoc(null);
      showToast(`Rejected - ${documents.find(d => d.id === docId)?.label}`, 'success');
    } catch (error: any) {
      throw error; // Let RejectDialog handle the error display
    }
  }, [onDocumentAction, documents]);

  const handleView = useCallback((doc: { id: string; [key: string]: any }) => {
    setViewingDoc(doc as unknown as Doc);
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
  const handleWorkspaceMessage = useCallback(async (channel: 'stanton' | 'shared', body: string, documentId?: string) => {
    if (!workspaceId) return;
    
    try {
      await stantonWorkspaceClient.postMessage(workspaceId, channel, body, documentId);
      // Refresh workspace data
      const updated = await stantonWorkspaceClient.getWorkspace(workspaceId);
      setWorkspaceData(updated);
    } catch (error: any) {
      showToast(error.message || 'Failed to post message', 'error');
    }
  }, [workspaceId, showToast]);

  const handleWorkspaceEdit = useCallback(async (messageId: string, channel: 'stanton' | 'shared', body: string) => {
    try {
      await stantonWorkspaceClient.editMessage(workspaceId ?? '', messageId, channel, body);
      // Refresh workspace data
      if (workspaceId) {
        const updated = await stantonWorkspaceClient.getWorkspace(workspaceId);
        setWorkspaceData(updated);
      }
    } catch (error: any) {
      showToast(error.message || 'Failed to edit message', 'error');
    }
  }, [workspaceId, showToast]);

  const handleMarkRead = useCallback(async (channel: 'stanton' | 'shared') => {
    if (!workspaceId) return;
    
    try {
      await stantonWorkspaceClient.markChannelRead(workspaceId, channel);
      // Refresh workspace data
      const updated = await stantonWorkspaceClient.getWorkspace(workspaceId);
      setWorkspaceData(updated);
    } catch (error: any) {
      // Don't show toast for read failures, it's not critical
      console.error('Failed to mark channel read:', error);
    }
  }, [workspaceId]);

  // Group documents by category for display
  const groupedDocs = documents.reduce<Record<string, Doc[]>>((acc, doc) => {
    const category = doc.doc_type || 'Documents';
    if (!acc[category]) acc[category] = [];
    acc[category].push(doc);
    return acc;
  }, {});

  // Prepare workspace tabs if workspace data exists
  const workspaceTabs = workspaceData ? [
    {
      key: 'stanton',
      label: 'Stanton Private',
      channel: 'stanton' as const,
      unread: workspaceData.unread_counts.stanton || 0,
      messages: [], // Will be loaded by MessageThread
      onPost: (body: string) => handleWorkspaceMessage('stanton', body),
      onEdit: (messageId: string, body: string) => handleWorkspaceEdit(messageId, 'stanton', body),
      onMarkRead: () => handleMarkRead('stanton'),
    },
    {
      key: 'shared',
      label: 'Shared with HACH',
      channel: 'shared' as const,
      unread: workspaceData.unread_counts.shared || 0,
      messages: [], // Will be loaded by MessageThread
      onPost: (body: string) => handleWorkspaceMessage('shared', body),
      onEdit: (messageId: string, body: string) => handleWorkspaceEdit(messageId, 'shared', body),
      onMarkRead: () => handleMarkRead('shared'),
    },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Document sections */}
      {Object.entries(groupedDocs).map(([category, categoryDocs]) => (
        <div key={category} className="bg-white border border-gray-200">
          <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{category}</h3>
              <div className="text-xs text-gray-500">
                {categoryDocs.filter(d => d.status === 'approved' || d.status === 'waived').length}/
                {categoryDocs.filter(d => d.status !== 'waived').length} approved
              </div>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {categoryDocs.map((doc) => {
              const docIdx = documents.findIndex(d => d.id === doc.id);
              const unreadCounts = workspaceData?.unread_counts || {};
              
              return (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  context="stanton"
                  isFocused={focusedIdx === docIdx}
                  isApproving={false}
                  unreadCountByChannel={unreadCounts}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onWaive={handleWaive}
                  onView={handleView}
                  onClick={() => setFocusedIdx(docIdx)}
                  onExpand={() => setExpandedDocId(doc.id === expandedDocId ? null : doc.id)}
                  isExpanded={expandedDocId === doc.id}
                  expandedSlot={
                    expandedDocId === doc.id && workspaceId ? (
                      <div className="h-64 border-t border-gray-200">
                        <ApplicationWorkspacePanel
                          tabs={workspaceTabs.map(tab => ({
                            ...tab,
                            messages: [], // Will be loaded by MessageThread component
                            onPost: (body: string) => tab.onPost(body),
                            onEdit: (messageId: string, body: string) => tab.onEdit(messageId, body),
                            onMarkRead: tab.onMarkRead,
                          }))}
                          context="stanton"
                          currentUserId="current-user" // TODO: Get from auth context
                        />
                      </div>
                    ) : null
                  }
                  rowRef={setRowRef(docIdx)}
                />
              );
            })}
          </div>
        </div>
      ))}

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-20 right-6 px-4 py-2 rounded shadow-lg text-sm font-medium z-50 ${
          toast.type === 'success' 
            ? 'bg-green-600 text-white' 
            : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Modals */}
      {viewingDoc && (
        <DocumentViewer
          document={viewingDoc}
          context="stanton"
          onClose={() => setViewingDoc(null)}
        />
      )}

      {rejectingDoc && (
        <RejectDialog
          document={rejectingDoc}
          application={{
            head_of_household_name: application.head_of_household_name,
            building_address: application.building_address,
            unit_number: application.unit_number,
            preferred_language: 'en', // TODO: Get from application data
          }}
          context="stanton"
          onClose={() => setRejectingDoc(null)}
          onSubmit={handleRejectSubmit}
        />
      )}
    </div>
  );
}
