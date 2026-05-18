import { describe, it, expect } from 'vitest';
import { createStabilityTracker } from '../components/DocumentScanner/stabilityTracker';
import type { Quad } from '../components/DocumentScanner/edgeDetectionLoop';

function makeQuad(x: number, y: number): Quad {
  // Create a 100x100 quad at position (x, y)
  return {
    topLeft: { x, y },
    topRight: { x: x + 100, y },
    bottomRight: { x: x + 100, y: y + 100 },
    bottomLeft: { x, y: y + 100 },
  };
}

describe('stabilityTracker', () => {
  it('should return seeking when null is pushed', () => {
    const tracker = createStabilityTracker();
    expect(tracker.push(null).kind).toBe('seeking');
  });

  it('should clear buffer when null is pushed after quads', () => {
    const tracker = createStabilityTracker({ bufferSize: 3 });

    // Add some stable quads
    tracker.push(makeQuad(0, 0));
    tracker.push(makeQuad(0, 0));

    // Push null -> seeking, buffer cleared
    expect(tracker.push(null).kind).toBe('seeking');

    // Need to refill buffer from scratch
    expect(tracker.push(makeQuad(0, 0)).kind).toBe('warming');
  });

  it('should return unstable when quad jumps more than tolerance', () => {
    const tracker = createStabilityTracker({ bufferSize: 4, toleranceLInf: 12 });

    // First quad -> warming (buffer not full)
    expect(tracker.push(makeQuad(0, 0)).kind).toBe('warming');

    // Second quad stable -> warming
    expect(tracker.push(makeQuad(0, 0)).kind).toBe('warming');

    // Third quad jumps by 15px (> 12 tolerance) -> unstable
    expect(tracker.push(makeQuad(15, 0)).kind).toBe('unstable');
  });

  it('should remain stable when movement is within tolerance', () => {
    const tracker = createStabilityTracker({ bufferSize: 4, toleranceLInf: 12 });

    // First two quads
    tracker.push(makeQuad(0, 0));
    tracker.push(makeQuad(0, 0));

    // Third quad moves 10px (< 12 tolerance) -> still warming
    expect(tracker.push(makeQuad(10, 0)).kind).toBe('warming');
  });

  it('should transition from warming to armed after buffer fills', () => {
    const tracker = createStabilityTracker({ bufferSize: 3, toleranceLInf: 12 });

    // Fill buffer with stable quads
    expect(tracker.push(makeQuad(0, 0)).kind).toBe('warming'); // 1/3
    expect(tracker.push(makeQuad(0, 0)).kind).toBe('warming'); // 2/3, ticksRemaining=1
    expect(tracker.push(makeQuad(0, 0)).kind).toBe('armed'); // 3/3, armed!

    // Continuing to push stable quads stays armed
    expect(tracker.push(makeQuad(0, 0)).kind).toBe('armed');
  });

  it('should return correct ticksRemaining in warming state', () => {
    const tracker = createStabilityTracker({ bufferSize: 5 });

    const state1 = tracker.push(makeQuad(0, 0));
    expect(state1.kind).toBe('warming');
    expect((state1 as { kind: 'warming'; ticksRemaining: number }).ticksRemaining).toBe(4);

    const state2 = tracker.push(makeQuad(0, 0));
    expect(state2.kind).toBe('warming');
    expect((state2 as { kind: 'warming'; ticksRemaining: number }).ticksRemaining).toBe(3);
  });

  it('should reset buffer on reset()', () => {
    const tracker = createStabilityTracker({ bufferSize: 3 });

    // Fill buffer to armed
    tracker.push(makeQuad(0, 0));
    tracker.push(makeQuad(0, 0));
    expect(tracker.push(makeQuad(0, 0)).kind).toBe('armed');

    // Reset
    tracker.reset();

    // Back to warming (buffer empty)
    expect(tracker.push(makeQuad(0, 0)).kind).toBe('warming');
  });

  it('should respect tolerance at exact boundary', () => {
    const tracker = createStabilityTracker({ bufferSize: 3, toleranceLInf: 12 });

    // First stable quad
    tracker.push(makeQuad(0, 0));

    // Second quad moves exactly 12px (at boundary, should stay stable)
    // Actually, the check is maxDist > tolerance, so 12 should be stable
    expect(tracker.push(makeQuad(12, 0)).kind).toBe('warming');

    // Reset and test with 13px (should be unstable)
    tracker.reset();
    tracker.push(makeQuad(0, 0));
    expect(tracker.push(makeQuad(13, 0)).kind).toBe('unstable');
  });

  it('should handle continuous wobble correctly', () => {
    const tracker = createStabilityTracker({ bufferSize: 4, toleranceLInf: 10 });

    // Wobble around 0,0 with small movements
    tracker.push(makeQuad(0, 0));
    tracker.push(makeQuad(5, 0));

    // Big jump to 20 -> unstable
    expect(tracker.push(makeQuad(20, 0)).kind).toBe('unstable');

    // Now stabilize - buffer was reset so only has the jumping quad
    // Need to fill buffer again
    expect(tracker.push(makeQuad(20, 0)).kind).toBe('warming');
    expect(tracker.push(makeQuad(20, 0)).kind).toBe('warming');
    expect(tracker.push(makeQuad(20, 0)).kind).toBe('armed');
  });
});
