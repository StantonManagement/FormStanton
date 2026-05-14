'use client';

import { useState } from 'react';
import StatusBadge from './StatusBadge';
import Button from './Button';
import AssigneeBadge from './AssigneeBadge';
import SelectableRow from './SelectableRow';
import { getEffectiveStatus, formatRelativeTime } from './utils';

interface DocumentAction {
  action: string;
  reviewer_name: string;
  created_at: string;
  rejection_reason?: string;
}

interface Document {
  id: string;
  label: string;
  doc_type?: string;
  file_name?: string | null;
  status: string;
  person_slot?: number;
  required?: boolean;
  storage_path?: string | null;
  latest_action?: DocumentAction;
  uploaded_by_role?: string | null;
  uploaded_by_display_name?: string | null;
  staff_upload_note?: string | null;
  original_doc_type?: string | null;
  // Assignment fields
  assigned_to_user_id?: string | null;
  assigned_at?: string | null;
  // Tier-2 fields
  owner_review_status?: string | null;
  owner_flag_reason?: string | null;
}

interface DocumentRowProps {
  doc: Document;
  context: 'stanton' | 'hach';
  isFocused: boolean;
  isFlashing?: boolean;
  isApproving?: boolean;
  unreadCountByChannel?: Record<string, number>;
  onApprove: (id: string) => void;
  onReject: (doc: Document) => void;
  onWaive?: (id: string) => void; // Stanton only
  onView: (doc: Document) => void;
  onUpload?: (doc: Document) => void; // Stanton only
  onRecategorize?: (doc: Document) => void; // Stanton only
  onClick: () => void;
  onExpand?: () => void; // For message thread
  isExpanded?: boolean;
  expandedSlot?: React.ReactNode; // Message thread content
  rowRef?: (el: HTMLDivElement | null) => void;
  priorVersionsSlot?: React.ReactNode; // Prior versions expander
  // Selection props
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
  showAssignee?: boolean;
  onAssignClick?: () => void;
  // Tier-2 props
  isApplicationLead?: boolean;
  onConfirmAsLead?: () => void;
  onFlag?: () => void;
}

export default function DocumentRow({
  doc,
  context,
  isFocused,
  isFlashing = false,
  isApproving = false,
  unreadCountByChannel = {},
  onApprove,
  onReject,
  onWaive,
  onView,
  onUpload,
  onRecategorize,
  onClick,
  onExpand,
  isExpanded = false,
  expandedSlot,
  rowRef,
  priorVersionsSlot,
  isSelected = false,
  onSelect,
  showAssignee = false,
  onAssignClick,
  isApplicationLead = false,
  onConfirmAsLead,
  onFlag,
}: DocumentRowProps) {
  const [hover, setHover] = useState(false);
  const eff = getEffectiveStatus(doc);
  
  const canApprove = eff !== 'approved' && eff !== 'waived' && eff !== 'missing';
  const canReject = eff !== 'approved' && eff !== 'waived' && eff !== 'missing';
  const canWaive = context === 'stanton' && eff !== 'approved' && eff !== 'waived' && eff !== 'missing';
  const canView = !!(doc.storage_path || doc.file_name);
  const canUpload = context === 'stanton' && eff !== 'approved' && eff !== 'waived';
  const canRecategorize = context === 'stanton' && !!(doc.storage_path || doc.file_name);
  const isStaffUploaded = doc.uploaded_by_role === 'staff';
  const isRecategorized = !!doc.original_doc_type;

  // Calculate total unread count for this document
  const totalUnread = Object.values(unreadCountByChannel).reduce((sum, count) => sum + count, 0);

  if (context === 'hach') {
    const COLORS = {
      accent: '#0f4c5c',
      accentLight: '#e6f0f3',
      bg: '#fafaf9',
      border: '#e7e5e4',
      text: '#1c1917',
      textMuted: '#78716c',
      pending: '#a16207',
      pendingLight: '#fef9c3',
      reject: '#b91c1c',
      rejectLight: '#fee2e2',
    };

    let bg = 'transparent';
    let borderLeft = '3px solid transparent';
    if (isFlashing) { bg = '#fff7ed'; borderLeft = `3px solid ${COLORS.pending}`; }
    else if (isFocused) { bg = COLORS.accentLight; borderLeft = `3px solid ${COLORS.accent}`; }
    else if (hover) { bg = '#fafaf9'; }

    return (
      <>
        <div
          ref={rowRef}
          onClick={onClick}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          data-doc-row="true"
          style={{
            padding: '12px 16px', borderTop: `1px solid ${COLORS.border}`, cursor: 'pointer',
            backgroundColor: bg, borderLeft,
            transition: 'all 0.1s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: COLORS.text }}>{doc.label}</span>
                <StatusBadge status={eff} size="sm" context="hach" />
                {totalUnread > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, 
                    backgroundColor: '#dc2626', color: '#fff',
                    padding: '2px 6px', borderRadius: 10,
                  }}>
                    {totalUnread}
                  </span>
                )}
                {isFlashing && (
                  <span style={{ fontSize: 11, color: COLORS.pending, fontWeight: 500 }}>
                    Reject coming soon
                  </span>
                )}
              </div>
              {doc.file_name && (
                <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "'IBM Plex Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                  {doc.file_name}
                </div>
              )}
              {!doc.file_name && eff === 'missing' && (
                <div style={{ fontSize: 11, color: COLORS.textMuted, fontStyle: 'italic' }}>Not yet uploaded</div>
              )}
              {doc.latest_action?.rejection_reason && (
                <div style={{ marginTop: 4, fontSize: 11, color: COLORS.reject, background: COLORS.rejectLight, padding: '3px 8px', display: 'inline-block' }}>
                  {doc.latest_action.rejection_reason}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {canView && (
                <Button size="sm" variant="ghost" context="hach" onClick={(e) => { e.stopPropagation(); onView(doc); }}>View</Button>
              )}
              {canApprove && (
                <Button size="sm" variant="approve" context="hach" disabled={isApproving} onClick={(e) => { e.stopPropagation(); onApprove(doc.id); }}>
                  {isApproving ? '...' : 'Approve'}
                </Button>
              )}
              {canReject && !isApproving && (
                <Button size="sm" variant="reject" context="hach" onClick={(e) => { e.stopPropagation(); onReject(doc); }}>
                  Reject
                </Button>
              )}
            </div>
          </div>
          {doc.latest_action && (
            <div style={{ fontSize: 11, color: '#a8a29e', marginTop: 6 }}>
              {doc.latest_action.action.charAt(0).toUpperCase() + doc.latest_action.action.slice(1)} by {doc.latest_action.reviewer_name}
              {doc.latest_action.created_at ? ` - ${formatRelativeTime(doc.latest_action.created_at)}` : ''}
            </div>
          )}
        </div>
        
        {isExpanded && expandedSlot && (
          <div style={{ borderTop: `1px solid ${COLORS.border}`, backgroundColor: COLORS.bg }}>
            {expandedSlot}
          </div>
        )}
      </>
    );
  }

  // Stanton context - use Tailwind
  let rowClasses = 'px-5 py-2.5 flex items-center gap-3 text-sm border-t border-gray-200 cursor-pointer transition-all duration-100';
  if (isFlashing) {
    rowClasses += ' bg-orange-50 border-l-3 border-l-orange-400';
  } else if (isFocused) {
    rowClasses += ' bg-blue-50 border-l-3 border-l-blue-500';
  } else if (hover) {
    rowClasses += ' bg-gray-50';
  }

  // Tier-2 state indicators
  const showTier2Pending = isApplicationLead && doc.owner_review_status === 'pending';
  const showTier2Confirmed = doc.owner_review_status === 'confirmed';
  const showTier2Flagged = doc.owner_review_status === 'flagged' || eff === 'flagged_for_rereview';

  return (
    <>
      <div
        ref={rowRef}
        className={rowClasses}
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        data-doc-row="true"
      >
        {/* Selection checkbox */}
        {onSelect && (
          <div onClick={(e) => e.stopPropagation()}>
            <SelectableRow isSelected={isSelected} onSelect={onSelect} />
          </div>
        )}

        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
          eff === 'approved' ? 'bg-green-500' : 
          eff === 'submitted' ? 'bg-yellow-500' : 
          eff === 'rejected' ? 'bg-red-500' : 
          eff === 'waived' ? 'bg-indigo-400' : 
          eff === 'flagged_for_rereview' ? 'bg-orange-500' : 'bg-gray-300'
        }`} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-900">{doc.label}</span>
            <StatusBadge status={eff} size="sm" context="stanton" />
            {totalUnread > 0 && (
              <span className="px-2 py-0.5 text-xs font-semibold bg-red-500 text-white rounded-full">
                {totalUnread}
              </span>
            )}
            {(doc.person_slot ?? 0) > 0 && <span className="text-xs text-gray-500">P{doc.person_slot}</span>}
            {!doc.required && <span className="text-xs text-gray-500">(opt)</span>}
          </div>
          {doc.file_name && (
            <div className="text-xs text-gray-600 font-mono truncate">{doc.file_name}</div>
          )}
          {!doc.file_name && eff === 'missing' && (
            <div className="text-xs text-gray-500 italic">Not yet uploaded</div>
          )}
          {doc.latest_action?.rejection_reason && (
            <div className="mt-1 text-xs text-red-700 bg-red-50 px-2 py-1 inline-block">
              {doc.latest_action.rejection_reason}
            </div>
          )}
          {isStaffUploaded && (
            <div className="mt-1 flex items-center gap-1">
              <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5">
                Uploaded by Stanton on behalf of tenant
              </span>
              {doc.uploaded_by_display_name && (
                <span className="text-xs text-gray-500">by {doc.uploaded_by_display_name}</span>
              )}
            </div>
          )}
          {isRecategorized && (
            <div className="mt-0.5">
              <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5">
                Re-categorized from {doc.original_doc_type}
              </span>
            </div>
          )}
          {doc.staff_upload_note && (
            <div className="mt-0.5 text-xs text-gray-500 italic">Note: {doc.staff_upload_note}</div>
          )}
          
          {/* Tier-2 flag reason display */}
          {showTier2Flagged && doc.owner_flag_reason && (
            <div className="mt-1 text-xs text-orange-700 bg-orange-50 px-2 py-1 inline-block">
              Flagged: {doc.owner_flag_reason}
            </div>
          )}
          
          {/* Tier-2 confirmed indicator */}
          {showTier2Confirmed && (
            <div className="mt-1 text-xs text-green-700 bg-green-50 px-2 py-1 inline-block">
              Confirmed by Lead
            </div>
          )}
        </div>

        {/* Assignee badge */}
        {showAssignee && (
          <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <AssigneeBadge
              userId={doc.assigned_to_user_id ?? null}
              assignedAt={doc.assigned_at ?? null}
              onClick={onAssignClick}
            />
          </div>
        )}

        <div className="flex gap-2 flex-shrink-0">
          {canUpload && onUpload && (
            <Button size="sm" variant="secondary" context="stanton" onClick={(e) => { e.stopPropagation(); onUpload(doc); }}>Upload</Button>
          )}
          {canRecategorize && onRecategorize && (
            <Button size="sm" variant="secondary" context="stanton" onClick={(e) => { e.stopPropagation(); onRecategorize(doc); }}>Move</Button>
          )}
          {canView && (
            <Button size="sm" variant="secondary" context="stanton" onClick={(e) => { e.stopPropagation(); onView(doc); }}>View</Button>
          )}
          {canApprove && (
            <Button size="sm" variant="approve" context="stanton" disabled={isApproving} onClick={(e) => { e.stopPropagation(); onApprove(doc.id); }}>
              {isApproving ? '...' : 'Approve'}
            </Button>
          )}
          {canWaive && (
            <Button size="sm" variant="primary" context="stanton" onClick={(e) => { e.stopPropagation(); onWaive?.(doc.id); }}>
              Waive
            </Button>
          )}
          {canReject && !isApproving && (
            <Button size="sm" variant="reject" context="stanton" onClick={(e) => { e.stopPropagation(); onReject(doc); }}>
              Reject
            </Button>
          )}
          
          {/* Tier-2 Confirm/Flag buttons for Application Lead */}
          {showTier2Pending && (
            <>
              <Button
                size="sm"
                variant="approve"
                context="stanton"
                onClick={(e) => { e.stopPropagation(); onConfirmAsLead?.(); }}
              >
                Confirm
              </Button>
              <Button
                size="sm"
                variant="reject"
                context="stanton"
                onClick={(e) => { e.stopPropagation(); onFlag?.(); }}
              >
                Flag
              </Button>
            </>
          )}
        </div>
      </div>

      {doc.latest_action && (
        <div className="px-5 py-1 text-xs text-gray-500 bg-gray-50">
          {doc.latest_action.action.charAt(0).toUpperCase() + doc.latest_action.action.slice(1)} by {doc.latest_action.reviewer_name}
          {doc.latest_action.created_at ? ` - ${formatRelativeTime(doc.latest_action.created_at)}` : ''}
        </div>
      )}

      {isExpanded && expandedSlot && (
        <div className="border-t border-gray-200 bg-gray-50">
          {expandedSlot}
        </div>
      )}

      {priorVersionsSlot && (
        <div className="border-t border-gray-100">
          {priorVersionsSlot}
        </div>
      )}
    </>
  );
}
