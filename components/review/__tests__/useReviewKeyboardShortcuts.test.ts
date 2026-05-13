import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReviewKeyboardShortcuts } from '../useReviewKeyboardShortcuts';

describe('useReviewKeyboardShortcuts', () => {
  const mockDocuments = [
    { id: 'doc-1', label: 'Document 1', status: 'pending' },
    { id: 'doc-2', label: 'Document 2', status: 'pending' },
    { id: 'doc-3', label: 'Document 3', status: 'approved' },
  ];

  const defaultProps = {
    documents: mockDocuments,
    onApprove: vi.fn(),
    onReject: vi.fn(),
    onView: vi.fn(),
    onMessageFocus: vi.fn(),
    onCloseModals: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear any existing event listeners
    document.removeEventListener('keydown', vi.fn());
  });

  describe('Navigation', () => {
    it('initializes with first document focused', () => {
      const { result } = renderHook(() => useReviewKeyboardShortcuts(defaultProps));

      expect(result.current.focusedIdx).toBe(0);
    });

    it('navigates to next document with J key', () => {
      const { result } = renderHook(() => useReviewKeyboardShortcuts(defaultProps));

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'j' });
        document.dispatchEvent(event);
      });

      expect(result.current.focusedIdx).toBe(1);
    });

    it('navigates to previous document with K key', () => {
      const { result } = renderHook(() => useReviewKeyboardShortcuts(defaultProps));

      // First move to next document
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'j' });
        document.dispatchEvent(event);
      });

      expect(result.current.focusedIdx).toBe(1);

      // Then move back
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'k' });
        document.dispatchEvent(event);
      });

      expect(result.current.focusedIdx).toBe(0);
    });

    it('does not navigate beyond document bounds', () => {
      const { result } = renderHook(() => useReviewKeyboardShortcuts(defaultProps));

      // Try to go before first document
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'k' });
        document.dispatchEvent(event);
      });

      expect(result.current.focusedIdx).toBe(0);

      // Go to last document
      act(() => {
        for (let i = 0; i < 5; i++) {
          const event = new KeyboardEvent('keydown', { key: 'j' });
          document.dispatchEvent(event);
        }
      });

      expect(result.current.focusedIdx).toBe(2); // Should not exceed array bounds
    });

    it('supports arrow key navigation', () => {
      const { result } = renderHook(() => useReviewKeyboardShortcuts(defaultProps));

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
        document.dispatchEvent(event);
      });

      expect(result.current.focusedIdx).toBe(1);

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
        document.dispatchEvent(event);
      });

      expect(result.current.focusedIdx).toBe(0);
    });
  });

  describe('Document Actions', () => {
    it('approves document with A key', () => {
      const { result } = renderHook(() => useReviewKeyboardShortcuts(defaultProps));

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'a' });
        document.dispatchEvent(event);
      });

      expect(defaultProps.onApprove).toHaveBeenCalledWith('doc-1');
    });

    it('rejects document with R key', () => {
      const { result } = renderHook(() => useReviewKeyboardShortcuts(defaultProps));

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'r' });
        document.dispatchEvent(event);
      });

      expect(defaultProps.onReject).toHaveBeenCalledWith(mockDocuments[0]);
    });

    it('views document with V key', () => {
      const { result } = renderHook(() => useReviewKeyboardShortcuts(defaultProps));

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'v' });
        document.dispatchEvent(event);
      });

      expect(defaultProps.onView).toHaveBeenCalledWith(mockDocuments[0]);
    });

    it('focuses message with M key', () => {
      const { result } = renderHook(() => useReviewKeyboardShortcuts(defaultProps));

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'm' });
        document.dispatchEvent(event);
      });

      expect(defaultProps.onMessageFocus).toHaveBeenCalledWith('doc-1');
    });

    it('waives document with W key (Stanton only)', () => {
      const onWaive = vi.fn();
      const props = { ...defaultProps, onWaive };

      const { result } = renderHook(() => useReviewKeyboardShortcuts(props));

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'w' });
        document.dispatchEvent(event);
      });

      expect(onWaive).toHaveBeenCalledWith('doc-1');
    });
  });

  describe('Modal Controls', () => {
    it('closes modals with Escape key', () => {
      const { result } = renderHook(() => useReviewKeyboardShortcuts(defaultProps));

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        document.dispatchEvent(event);
      });

      expect(defaultProps.onCloseModals).toHaveBeenCalled();
    });

    it('shows help with ? key', () => {
      const onShowHelp = vi.fn();
      const props = { ...defaultProps, onShowHelp };

      const { result } = renderHook(() => useReviewKeyboardShortcuts(props));

      act(() => {
        const event = new KeyboardEvent('keydown', { key: '?' });
        document.dispatchEvent(event);
      });

      expect(onShowHelp).toHaveBeenCalled();
    });
  });

  describe('Input Field Protection', () => {
    it('ignores shortcuts when typing in input', () => {
      const { result } = renderHook(() => useReviewKeyboardShortcuts(defaultProps));

      // Create an input element and focus it
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'j' });
        input.dispatchEvent(event);
      });

      // Should not have navigated
      expect(result.current.focusedIdx).toBe(0);

      // Cleanup
      document.body.removeChild(input);
    });

    it('ignores shortcuts when typing in textarea', () => {
      const { result } = renderHook(() => useReviewKeyboardShortcuts(defaultProps));

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'a' });
        textarea.dispatchEvent(event);
      });

      expect(defaultProps.onApprove).not.toHaveBeenCalled();

      document.body.removeChild(textarea);
    });

    it('ignores shortcuts when contentEditable element is focused', () => {
      const { result } = renderHook(() => useReviewKeyboardShortcuts(defaultProps));

      const div = document.createElement('div');
      div.contentEditable = 'true';
      document.body.appendChild(div);
      div.focus();

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'r' });
        div.dispatchEvent(event);
      });

      expect(defaultProps.onReject).not.toHaveBeenCalled();

      document.body.removeChild(div);
    });
  });

  describe('Document State Awareness', () => {
    it('does not approve already approved documents', () => {
      const approvedDocs = [
        { ...mockDocuments[0], status: 'approved' },
        { ...mockDocuments[1], status: 'pending' },
      ];

      const { result } = renderHook(() => useReviewKeyboardShortcuts({
        ...defaultProps,
        documents: approvedDocs,
      }));

      // Focus on approved document
      act(() => {
        result.current.setFocusedIdx(0);
      });

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'a' });
        document.dispatchEvent(event);
      });

      expect(defaultProps.onApprove).not.toHaveBeenCalled();

      // Move to pending document
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'j' });
        document.dispatchEvent(event);
      });

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'a' });
        document.dispatchEvent(event);
      });

      expect(defaultProps.onApprove).toHaveBeenCalledWith('doc-2');
    });

    it('does not reject waived documents', () => {
      const waivedDocs = [
        { ...mockDocuments[0], status: 'waived' },
        { ...mockDocuments[1], status: 'pending' },
      ];

      const { result } = renderHook(() => useReviewKeyboardShortcuts({
        ...defaultProps,
        documents: waivedDocs,
      }));

      // Focus on waived document
      act(() => {
        result.current.setFocusedIdx(0);
      });

      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'r' });
        document.dispatchEvent(event);
      });

      expect(defaultProps.onReject).not.toHaveBeenCalled();
    });
  });

  describe('Row Reference Management', () => {
    it('provides setRowRef function', () => {
      const { result } = renderHook(() => useReviewKeyboardShortcuts(defaultProps));

      expect(typeof result.current.setRowRef).toBe('function');

      const mockRef = { scrollIntoView: vi.fn() };
      
      act(() => {
        result.current.setRowRef(0)(mockRef);
      });

      // Should not throw and ref should be stored
    });

    it('scrolls focused document into view on navigation', () => {
      const mockRefs = [
        { scrollIntoView: vi.fn() },
        { scrollIntoView: vi.fn() },
        { scrollIntoView: vi.fn() },
      ];

      const { result } = renderHook(() => useReviewKeyboardShortcuts(defaultProps));

      // Set up refs
      act(() => {
        mockRefs.forEach((ref, idx) => {
          result.current.setRowRef(idx)(ref);
        });
      });

      // Navigate to next document
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'j' });
        document.dispatchEvent(event);
      });

      expect(mockRefs[1].scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'nearest',
      });
    });
  });

  describe('Case Sensitivity', () => {
    it('handles both uppercase and lowercase keys', () => {
      const { result } = renderHook(() => useReviewKeyboardShortcuts(defaultProps));

      // Test uppercase
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'J' });
        document.dispatchEvent(event);
      });

      expect(result.current.focusedIdx).toBe(1);

      // Test lowercase
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'k' });
        document.dispatchEvent(event);
      });

      expect(result.current.focusedIdx).toBe(0);
    });
  });

  describe('Cleanup', () => {
    it('removes event listeners on unmount', () => {
      const { unmount } = renderHook(() => useReviewKeyboardShortcuts(defaultProps));

      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });
});
