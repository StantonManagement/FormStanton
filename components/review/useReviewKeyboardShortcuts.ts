'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface UseReviewKeyboardShortcutsProps {
  documents: any[];
  onApprove?: (docId: string) => void;
  onReject?: (doc: any) => void;
  onView?: (doc: any) => void;
  onMessageFocus?: (docId: string) => void;
  onCloseModals?: () => void;
  onClaim?: (docId: string) => void; // C key - assign focused doc to current user
  currentUserId?: string;
}

export function useReviewKeyboardShortcuts({
  documents,
  onApprove,
  onReject,
  onView,
  onMessageFocus,
  onCloseModals,
  onClaim,
  currentUserId,
}: UseReviewKeyboardShortcutsProps) {
  const [focusedIdx, setFocusedIdx] = useState<number>(-1);
  const docRowRefs = useRef<(HTMLDivElement | null)[]>([]);

  const setRowRef = useCallback((index: number) => (el: HTMLDivElement | null) => {
    docRowRefs.current[index] = el;
  }, []);

  // Helper to get effective status
  const getEffectiveStatus = useCallback((doc: any): string => {
    const la = doc.latest_action;
    if (!la) return doc.status ?? 'pending';
    if (la.action === 'approved') return 'approved';
    if (la.action === 'rejected') return 'rejected';
    if (la.action === 'waived') return 'waived';
    return doc.status ?? 'pending';
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when typing in form fields
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      ) return;

      // Handle escape for modals
      if (e.key === 'Escape') {
        if (onCloseModals) {
          onCloseModals();
          return;
        }
        return;
      }

      // Handle help
      if (e.key === '?') {
        e.preventDefault();
        // Help modal is handled at parent level
        return;
      }

      // Navigation
      if (e.key === 'j' || e.key === 'J' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIdx((prev) => {
          const next = Math.min(prev + 1, documents.length - 1);
          docRowRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          return next;
        });
        return;
      }

      if (e.key === 'k' || e.key === 'K' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIdx((prev) => {
          const next = Math.max(prev - 1, 0);
          docRowRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          return next;
        });
        return;
      }

      // Action keys require focused document
      if (focusedIdx < 0 || focusedIdx >= documents.length) return;
      const focusedDoc = documents[focusedIdx];
      if (!focusedDoc) return;

      const eff = getEffectiveStatus(focusedDoc);
      const canApprove = eff !== 'approved' && eff !== 'waived' && eff !== 'missing';
      const canReject = eff !== 'approved' && eff !== 'waived' && eff !== 'missing';
      const canView = !!(focusedDoc.storage_path || focusedDoc.file_name);

      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        if (canApprove && onApprove) {
          onApprove(focusedDoc.id);
        }
        return;
      }

      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        if (canView && onView) {
          onView(focusedDoc);
        }
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (canReject && onReject) {
          onReject(focusedDoc);
        }
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        if (onMessageFocus) {
          onMessageFocus(focusedDoc.id);
        }
        return;
      }

      // Claim shortcut - C key assigns focused doc to current user
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        if (onClaim && currentUserId) {
          onClaim(focusedDoc.id);
        }
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [documents, focusedIdx, onApprove, onReject, onView, onMessageFocus, onCloseModals, onClaim, currentUserId, getEffectiveStatus]);

  return {
    focusedIdx,
    setFocusedIdx,
    setRowRef,
    getEffectiveStatus,
  };
}
