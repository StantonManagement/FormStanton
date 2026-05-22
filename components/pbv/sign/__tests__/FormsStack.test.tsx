/**
 * PRP-008 — FormsStack stepper announcements + memoized sort tests.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/pbv/hooks/useSigningCeremony', () => ({
  useSigningCeremony: () => ({
    hasSignature: false,
    submitting: false,
    error: '',
    clearError: () => {},
    captureAndSign: async () => true,
    signWithExisting: async () => true,
  }),
}));

vi.mock('react-signature-canvas', () => ({
  default: function StubPad() {
    return <canvas data-testid="stub-sigpad" />;
  },
}));

import FormsStack from '@/components/pbv/sign/FormsStack';

const baseForms = [
  { id: 'f-2', display_name: 'Beta Form', status: 'generated', signatures_complete: false } as any,
  { id: 'f-1', display_name: 'Alpha Form', status: 'generated', signatures_complete: false } as any,
  { id: 'f-3', display_name: 'Gamma Form', status: 'signed', signatures_complete: true } as any,
];

const baseProps = {
  token: 't',
  language: 'en' as const,
  hohName: 'Jane',
  hohMemberId: 'm-1',
  summarySigningComplete: true,
  onFormsUpdated: () => {},
};

describe('FormsStack — stepper a11y (A3, A8)', () => {
  it('progress region is mounted with role=status + aria-live=polite even when empty', () => {
    render(<FormsStack {...baseProps} forms={baseForms} />);
    const region = screen.getByTestId('stepper-progress');
    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent).toBe('');
  });

  it('error region is mounted with role=status + aria-live=polite even when empty', () => {
    render(<FormsStack {...baseProps} forms={baseForms} />);
    const region = screen.getByTestId('stepper-error');
    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
  });

  it('clicking "Sign all my forms" writes the progress text into the live region', () => {
    render(<FormsStack {...baseProps} forms={baseForms} />);
    const signAll = screen.getByRole('button', { name: /Sign all my forms/i });
    fireEvent.click(signAll);
    const region = screen.getByTestId('stepper-progress');
    expect(region.textContent).toMatch(/Signing 1 of 2/i);
  });
});

describe('FormsStack — memoized sort (E4)', () => {
  it('row order: unsigned alphabetical first, signed last', () => {
    render(<FormsStack {...baseProps} forms={baseForms} />);
    const rowNames = Array.from(document.querySelectorAll('p.text-sm.font-medium')).map(
      p => p.textContent
    );
    // Alpha + Beta (unsigned) before Gamma (signed).
    expect(rowNames[0]).toBe('Alpha Form');
    expect(rowNames[1]).toBe('Beta Form');
    expect(rowNames[2]).toBe('Gamma Form');
  });

  it('re-rendering with the same `forms` reference keeps the sorted row order stable', () => {
    const { rerender } = render(<FormsStack {...baseProps} forms={baseForms} />);
    const firstOrder = Array.from(document.querySelectorAll('p.text-sm.font-medium')).map(
      p => p.textContent
    );
    rerender(<FormsStack {...baseProps} forms={baseForms} />);
    const secondOrder = Array.from(document.querySelectorAll('p.text-sm.font-medium')).map(
      p => p.textContent
    );
    expect(secondOrder).toEqual(firstOrder);
  });
});
