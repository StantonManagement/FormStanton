import type { Quad } from './edgeDetectionLoop';

export type StabilityState =
  | { kind: 'seeking' }
  | { kind: 'unstable' }
  | { kind: 'warming'; ticksRemaining: number }
  | { kind: 'armed' };

export interface StabilityTracker {
  push(quad: Quad | null): StabilityState;
  reset(): void;
}

interface StabilityTrackerOptions {
  bufferSize?: number; // default 12
  toleranceLInf?: number; // default 12 (px)
}

interface Point {
  x: number;
  y: number;
}

function maxLInfDistance(quad1: Quad, quad2: Quad): number {
  const corners1: Point[] = [quad1.topLeft, quad1.topRight, quad1.bottomRight, quad1.bottomLeft];
  const corners2: Point[] = [quad2.topLeft, quad2.topRight, quad2.bottomRight, quad2.bottomLeft];

  let maxDist = 0;
  for (let i = 0; i < 4; i++) {
    const dx = Math.abs(corners1[i].x - corners2[i].x);
    const dy = Math.abs(corners1[i].y - corners2[i].y);
    const dist = Math.max(dx, dy); // L∞ (Chebyshev) distance
    maxDist = Math.max(maxDist, dist);
  }
  return maxDist;
}

function maxDistanceToBuffer(quad: Quad, buffer: Quad[]): number {
  let maxDist = 0;
  for (const bufferedQuad of buffer) {
    const dist = maxLInfDistance(quad, bufferedQuad);
    maxDist = Math.max(maxDist, dist);
  }
  return maxDist;
}

class StabilityTrackerImpl implements StabilityTracker {
  private buffer: Quad[] = [];
  private bufferSize: number;
  private toleranceLInf: number;

  constructor(opts?: StabilityTrackerOptions) {
    this.bufferSize = opts?.bufferSize ?? 12;
    this.toleranceLInf = opts?.toleranceLInf ?? 12;
  }

  push(quad: Quad | null): StabilityState {
    // No quad detected -> seeking, clear buffer
    if (quad === null) {
      this.buffer = [];
      return { kind: 'seeking' };
    }

    // Check stability against entire buffer
    if (this.buffer.length > 0) {
      const maxDist = maxDistanceToBuffer(quad, this.buffer);

      // If movement exceeds tolerance -> unstable, reset buffer
      if (maxDist > this.toleranceLInf) {
        this.buffer = [quad];
        return { kind: 'unstable' };
      }
    }

    // Quad is stable relative to buffer, add it
    this.buffer.push(quad);

    // Keep buffer at target size
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }

    // Determine state based on buffer fill
    if (this.buffer.length < this.bufferSize) {
      return {
        kind: 'warming',
        ticksRemaining: this.bufferSize - this.buffer.length,
      };
    }

    // Buffer full and stable -> armed (auto-capture trigger)
    return { kind: 'armed' };
  }

  reset(): void {
    this.buffer = [];
  }
}

export function createStabilityTracker(opts?: StabilityTrackerOptions): StabilityTracker {
  return new StabilityTrackerImpl(opts);
}
