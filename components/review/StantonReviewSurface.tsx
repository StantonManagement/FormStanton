'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import DocumentRow from './DocumentRow';
import DocumentViewer from './DocumentViewer';
import RejectDialog from './RejectDialog';
import UploadDialog from './UploadDialog';
import RecategorizeDialog from './RecategorizeDialog';
import PriorVersionsExpander from './PriorVersionsExpander';
import ApplicationWorkspacePanel from './ApplicationWorkspacePanel';
import AssignDialog from './AssignDialog';
import BulkActionBar from './BulkActionBar';
import { SelectableHeader } from './SelectableRow';
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
  category?: string;
  revision?: number;
  file_name?: string | null;
  storage_path?: string | null;
  uploaded_by_role?: string | null;
  uploaded_by_display_name?: string | null;
  staff_upload_note?: string | null;
  original_doc_type?: string | null;
  latest_action?: {
    action: string;
    reviewer_name: string;
    created_at: string;
    rejection_reason?: string;
  };
  // Assignment fields
  assigned_to_user_id?: string | null;
  assigned_at?: string | null;
  // Tier-2 fields
  owner_review_status?: string | null;
  owner_flag_reason?: string | null;
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
  anchorType: string;
  anchorId: string;
  onDocumentAction: (action: string, docId: string, data?: any) => Promise<void>;
  showIntakeButton?: boolean;
}

export default function StantonReviewSurface({ 
  application, 
  documents, 
  workspaceId,
  anchorType,
  anchorId,
  onDocumentAction,
  showIntakeButton = false,
}: StantonReviewSurfaceProps) {
  const [viewingDoc, setViewingDoc] = useState<Doc | null>(null);
  const [rejectingDoc, setRejectingDoc] = useState<Doc | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<Doc | null>(null);
  const [recategorizingDoc, setRecategorizingDoc] = useState<Doc | null>(null);
  const [assigningDoc, setAssigningDoc] = useState<Doc | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Selection state for bulk actions
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserName, setCurrentUserName] = useState<string>('');
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

  const handleRejectSubmit = useCallback(async (docId: string, reasonKey: string | null, reasonText: string | undefined, internalNotes?: string) => {
    try {
      await onDocumentAction('reject', docId, { reasonKey, reasonText, internalNotes });
      setRejectingDoc(null);
      showToast(`Rejected - ${documents.find(d => d.id === docId)?.label}`, 'success');
    } catch (error: any) {
      throw error; // Let RejectDialog handle the error display
    }
  }, [onDocumentAction, documents]);

  const handleView = useCallback((doc: { id: string; [key: string]: any }) => {
    setViewingDoc(doc as unknown as Doc);
  }, []);

  const handleUpload = useCallback((doc: { id: string; [key: string]: any }) => {
    setUploadingDoc(doc as unknown as Doc);
  }, []);

  const handleRecategorize = useCallback((doc: { id: string; [key: string]: any }) => {
    setRecategorizingDoc(doc as unknown as Doc);
  }, []);

  const handleAssignClick = useCallback((doc: { id: string; [key: string]: any }) => {
    setAssigningDoc(doc as unknown as Doc);
  }, []);

  // Fetch current user info
  useEffect(() => {
    fetch('/api/admin/me')
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          setCurrentUserId(j.data.userId);
          setCurrentUserName(j.data.displayName);
        }
      })
      .catch(() => {});
  }, []);

  // Selection handlers
  const handleSelectDoc = useCallback((docId: string, selected: boolean) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(docId);
      } else {
        next.delete(docId);
      }
      return next;
    });
  }, []);

  const handleSelectAllInCategory = useCallback((docIds: string[], selected: boolean) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      docIds.forEach(id => {
        if (selected) {
          next.add(id);
        } else {
          next.delete(id);
        }
      });
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedDocIds(new Set());
  }, []);

  // Assign handlers
  const handleAssignSubmit = useCallback(async (userId: string | null, note?: string) => {
    if (!assigningDoc) return;
    
    try {
      const res = await fetch(
        `/api/admin/applications/${anchorType}/${anchorId}/documents/${assigningDoc.id}/assign`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, note }),
        }
      );
      
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || 'Assignment failed');
      }
      
      setAssigningDoc(null);
      showToast(`Assigned — ${assigningDoc.label}`, 'success');
      onDocumentAction('refresh', assigningDoc.id);
    } catch (error: any) {
      showToast(error.message || 'Assignment failed', 'error');
    }
  }, [assigningDoc, anchorType, anchorId, onDocumentAction, showToast]);

  const handleBulkAssign = useCallback(async (userId: string | null) => {
    const docIds = Array.from(selectedDocIds);
    if (docIds.length === 0) return;
    
    try {
      const res = await fetch(`/api/admin/applications/${anchorType}/${anchorId}/documents/bulk-assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_ids: docIds, user_id: userId }),
      });
      
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || 'Bulk assignment failed');
      }
      
      const { succeeded, failed } = json.data;
      setSelectedDocIds(new Set());
      showToast(`Assigned ${succeeded} document${succeeded !== 1 ? 's' : ''}${failed > 0 ? `, ${failed} failed` : ''}`, 'success');
      onDocumentAction('refresh', docIds[0]);
    } catch (error: any) {
      showToast(error.message || 'Bulk assignment failed', 'error');
    }
  }, [selectedDocIds, anchorType, anchorId, onDocumentAction, showToast]);

  // Claim handler for C key shortcut
  const handleClaim = useCallback(async (docId: string) => {
    if (!currentUserId) return;
    
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;
    
    // Skip if already assigned to current user
    if (doc.assigned_to_user_id === currentUserId) {
      showToast('Already assigned to you', 'success');
      return;
    }
    
    try {
      const res = await fetch(
        `/api/admin/applications/${anchorType}/${anchorId}/documents/${docId}/assign`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: currentUserId }),
        }
      );
      
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || 'Claim failed');
      }
      
      showToast(`Claimed — ${doc.label}`, 'success');
      onDocumentAction('refresh', docId);
    } catch (error: any) {
      showToast(error.message || 'Claim failed', 'error');
    }
  }, [currentUserId, documents, anchorType, anchorId, onDocumentAction, showToast]);

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
    onClaim: handleClaim,
    currentUserId,
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

  // Separate custom docs from standard docs
  const standardDocs = documents.filter((d) => d.doc_type !== 'custom');
  const customDocs = documents.filter((d) => d.doc_type === 'custom');

  // Fixed category order per PRD-14 Phase 4
  const CATEGORY_ORDER = ['income', 'assets', 'medical_childcare', 'immigration', 'signed_forms'];
  const CATEGORY_LABELS: Record<string, string> = {
    income: 'Income Verification',
    assets: 'Banking & Assets',
    medical_childcare: 'Medical & Childcare',
    immigration: 'Citizenship & Immigration',
    signed_forms: 'Signed Forms',
  };

  // Group standard documents by category, sort within each category
  const groupedDocs = standardDocs.reduce<Record<string, Doc[]>>((acc, doc) => {
    const category = doc.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(doc);
    return acc;
  }, {});

  // Sort documents within each category by (display_order, person_slot)
  Object.keys(groupedDocs).forEach((key) => {
    groupedDocs[key].sort((a, b) => {
      const orderDiff = (a.display_order ?? 0) - (b.display_order ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return (a.person_slot ?? 0) - (b.person_slot ?? 0);
    });
  });

  // Get sorted category entries based on fixed order (skip empty categories)
  const sortedCategories = CATEGORY_ORDER.filter((cat) => groupedDocs[cat]?.length > 0)
    .map((cat) => [cat, groupedDocs[cat]] as const);

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
      {/* Toolbar */}
      {showIntakeButton && (
        <div className="flex justify-end">
          <Link
            href={`/admin/pbv/full-applications/${anchorId}/intake`}
            className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Intake Packet
          </Link>
        </div>
      )}

      {/* Document sections */}
      {sortedCategories.map(([category, categoryDocs]) => (
        <div key={category} className="bg-white border border-gray-200">
          <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <SelectableHeader
                  checked={categoryDocs.every(d => selectedDocIds.has(d.id))}
                  indeterminate={
                    categoryDocs.some(d => selectedDocIds.has(d.id)) &&
                    !categoryDocs.every(d => selectedDocIds.has(d.id))
                  }
                  onChange={(checked) => handleSelectAllInCategory(categoryDocs.map(d => d.id), checked)}
                  label={CATEGORY_LABELS[category] || category}
                />
              </div>
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
                  onUpload={handleUpload}
                  onRecategorize={handleRecategorize}
                  onClick={() => setFocusedIdx(docIdx)}
                  onExpand={() => setExpandedDocId(doc.id === expandedDocId ? null : doc.id)}
                  isExpanded={expandedDocId === doc.id}
                  isSelected={selectedDocIds.has(doc.id)}
                  onSelect={(selected) => handleSelectDoc(doc.id, selected)}
                  showAssignee={true}
                  onAssignClick={() => handleAssignClick(doc)}
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
                  priorVersionsSlot={
                    (doc.revision ?? 0) > 1 ? (
                      <PriorVersionsExpander
                        revisionsUrl={`/api/admin/applications/${anchorType}/${anchorId}/documents/${doc.id}/revisions`}
                        currentRevision={doc.revision ?? 1}
                      />
                    ) : null
                  }
                  rowRef={setRowRef(docIdx)}
                />
              );
            })}
          </div>
        </div>
      ))}

      {/* Additional Documents — custom docs from packet intake */}
      {customDocs.length > 0 && (
        <div className="bg-white border border-gray-200">
          <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-[var(--ink)]">Additional Documents</span>
              <span className="text-xs text-[var(--muted)]">Not counted toward required documents</span>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {customDocs.map((doc) => {
              const docIdx = documents.findIndex((d) => d.id === doc.id);
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
                  onUpload={handleUpload}
                  onRecategorize={handleRecategorize}
                  onClick={() => setFocusedIdx(docIdx)}
                  onExpand={() => setExpandedDocId(doc.id === expandedDocId ? null : doc.id)}
                  isExpanded={expandedDocId === doc.id}
                  isSelected={selectedDocIds.has(doc.id)}
                  onSelect={(selected) => handleSelectDoc(doc.id, selected)}
                  showAssignee={true}
                  onAssignClick={() => handleAssignClick(doc)}
                  expandedSlot={null}
                  priorVersionsSlot={
                    (doc.revision ?? 0) > 1 ? (
                      <PriorVersionsExpander
                        revisionsUrl={`/api/admin/applications/${anchorType}/${anchorId}/documents/${doc.id}/revisions`}
                        currentRevision={doc.revision ?? 1}
                      />
                    ) : null
                  }
                  rowRef={setRowRef(docIdx)}
                />
              );
            })}
          </div>
        </div>
      )}

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
          anchorType={anchorType}
          anchorId={anchorId}
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

      {uploadingDoc && (
        <UploadDialog
          uploadUrl={`/api/admin/applications/${anchorType}/${anchorId}/documents/upload`}
          doc={uploadingDoc}
          onClose={() => setUploadingDoc(null)}
          onSuccess={() => {
            setUploadingDoc(null);
            showToast(`Uploaded — ${uploadingDoc.label}`, 'success');
            onDocumentAction('refresh', uploadingDoc.id);
          }}
        />
      )}

      {recategorizingDoc && (
        <RecategorizeDialog
          categorizeUrl={`/api/admin/applications/${anchorType}/${anchorId}/documents/${recategorizingDoc.id}/categorize`}
          doc={recategorizingDoc}
          availableSlots={documents}
          onClose={() => setRecategorizingDoc(null)}
          onSuccess={() => {
            setRecategorizingDoc(null);
            showToast(`Moved — ${recategorizingDoc.label}`, 'success');
            onDocumentAction('refresh', recategorizingDoc.id);
          }}
        />
      )}

      {/* Assign Dialog */}
      {assigningDoc && (
        <AssignDialog
          isOpen={true}
          onClose={() => setAssigningDoc(null)}
          onAssign={handleAssignSubmit}
          currentAssigneeId={assigningDoc.assigned_to_user_id ?? null}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          documentLabel={assigningDoc.label}
        />
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedDocIds.size}
        totalCount={documents.length}
        onAssign={handleBulkAssign}
        onClear={handleClearSelection}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
      />
    </div>
  );
}
