// @vitest-environment jsdom
/**
 * PRP-011 / C4 — OnlineStatusProvider + useOnlineStatus tests.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, act, screen, fireEvent } from '@testing-library/react';
import { OnlineStatusProvider, useOnlineStatus } from '@/lib/pbv/context/OnlineStatusProvider';

function Probe() {
  const online = useOnlineStatus();
  return <span data-testid="status">{online ? 'online' : 'offline'}</span>;
}

describe('OnlineStatusProvider', () => {
  it('exposes the current navigator.onLine value by default', () => {
    render(
      <OnlineStatusProvider>
        <Probe />
      </OnlineStatusProvider>
    );
    expect(screen.getByTestId('status').textContent).toBe('online');
  });

  it('flips to offline when window dispatches an offline event', () => {
    render(
      <OnlineStatusProvider initialOnline={true}>
        <Probe />
      </OnlineStatusProvider>
    );
    act(() => {
      // Some test environments need both: a navigator.onLine mutation +
      // the window event. Provider listens to the event.
      Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
      fireEvent(window, new Event('offline'));
    });
    expect(screen.getByTestId('status').textContent).toBe('offline');
  });

  it('flips back to online on the online event', () => {
    render(
      <OnlineStatusProvider initialOnline={false}>
        <Probe />
      </OnlineStatusProvider>
    );
    expect(screen.getByTestId('status').textContent).toBe('offline');
    act(() => {
      Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
      fireEvent(window, new Event('online'));
    });
    expect(screen.getByTestId('status').textContent).toBe('online');
  });

  it('returns true (graceful default) when no provider is mounted', () => {
    render(<Probe />);
    expect(screen.getByTestId('status').textContent).toBe('online');
  });
});
