'use client';

export interface Quad {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  bottomRight: { x: number; y: number };
}

interface DetectionLoopOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  jscanify: unknown; // jscanify instance (lazy-loaded)
  targetFps: number; // default 8
  onQuad: (quad: Quad | null) => void;
  onPerfWarn?: (detectionMs: number) => void; // adaptive throttle hook
  onLowLight?: (isLowLight: boolean) => void; // low light warning callback
}

interface DetectionState {
  targetFps: number;
  lastDetectionTime: number;
  frameCount: number;
  perfHistory: number[];
  rafId: number | null;
  isRunning: boolean;
  lowLightStartTime: number | null;
}

export function startDetectionLoop(opts: DetectionLoopOptions): () => void {
  const { videoRef, jscanify, onQuad, onPerfWarn } = opts;

  // Default target is 8 fps, with adaptive bounds
  const state: DetectionState = {
    targetFps: opts.targetFps || 8,
    lastDetectionTime: 0,
    frameCount: 0,
    perfHistory: [],
    rafId: null,
    isRunning: true,
    lowLightStartTime: null,
  };

  // Offscreen canvas for detection (downsampled for perf)
  const offscreenCanvas = document.createElement('canvas');
  const offscreenCtx = offscreenCanvas.getContext('2d');

  // Validate quad: reject background-spanning, tiny, or skewed quads.
  // All inputs in offscreen-canvas space (pre-scale).
  function isValidQuad(q: Quad, frameWidth: number, frameHeight: number): boolean {
    const frameArea = frameWidth * frameHeight;
    // Shoelace formula for quad area
    const area = Math.abs(
      (q.topLeft.x * q.topRight.y - q.topRight.x * q.topLeft.y) +
      (q.topRight.x * q.bottomRight.y - q.bottomRight.x * q.topRight.y) +
      (q.bottomRight.x * q.bottomLeft.y - q.bottomLeft.x * q.bottomRight.y) +
      (q.bottomLeft.x * q.topLeft.y - q.topLeft.x * q.bottomLeft.y)
    ) / 2;
    const areaRatio = area / frameArea;

    // Reject quads spanning >85% of frame (likely viewport/background edge)
    if (areaRatio > 0.85) return false;
    // Reject quads <12% of frame (likely interior detail like signature box)
    if (areaRatio < 0.12) return false;

    // Reject if all 4 corners are near frame edges (background contour)
    const edgeMargin = Math.min(frameWidth, frameHeight) * 0.04;
    const corners = [q.topLeft, q.topRight, q.bottomRight, q.bottomLeft];
    const cornersOnEdge = corners.filter(c =>
      c.x < edgeMargin || c.x > frameWidth - edgeMargin ||
      c.y < edgeMargin || c.y > frameHeight - edgeMargin
    ).length;
    if (cornersOnEdge >= 3) return false;

    // Reject crazy aspect ratio (paper ~0.5-2.0)
    const widthTop = Math.hypot(q.topRight.x - q.topLeft.x, q.topRight.y - q.topLeft.y);
    const widthBottom = Math.hypot(q.bottomRight.x - q.bottomLeft.x, q.bottomRight.y - q.bottomLeft.y);
    const heightLeft = Math.hypot(q.bottomLeft.x - q.topLeft.x, q.bottomLeft.y - q.topLeft.y);
    const heightRight = Math.hypot(q.bottomRight.x - q.topRight.x, q.bottomRight.y - q.topRight.y);
    const avgW = (widthTop + widthBottom) / 2;
    const avgH = (heightLeft + heightRight) / 2;
    if (avgW < 1 || avgH < 1) return false;
    const aspect = avgW / avgH;
    if (aspect < 0.4 || aspect > 2.5) return false;

    // Reject if opposing sides differ by more than 50% (extreme perspective / not a real quad)
    if (Math.abs(widthTop - widthBottom) / Math.max(widthTop, widthBottom) > 0.5) return false;
    if (Math.abs(heightLeft - heightRight) / Math.max(heightLeft, heightRight) > 0.5) return false;

    return true;
  }

  // Helper to convert jscanify contour to Quad
  function contourToQuad(contour: unknown): Quad | null {
    if (!contour || !(jscanify as any).getCornerPoints) return null;

    try {
      const corners = (jscanify as any).getCornerPoints(contour);
      if (!corners) return null;

      const { topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner } = corners;

      // Validate all corners exist
      if (!topLeftCorner || !topRightCorner || !bottomLeftCorner || !bottomRightCorner) {
        return null;
      }

      return {
        topLeft: { x: topLeftCorner.x, y: topLeftCorner.y },
        topRight: { x: topRightCorner.x, y: topRightCorner.y },
        bottomLeft: { x: bottomLeftCorner.x, y: bottomLeftCorner.y },
        bottomRight: { x: bottomRightCorner.x, y: bottomRightCorner.y },
      };
    } catch {
      return null;
    }
  }

  // Helper to compute mean brightness from canvas (Y channel approximation)
  function computeBrightness(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): number {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let sum = 0;
    let count = 0;

    // Sample every 4th pixel for performance
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Y = 0.299R + 0.587G + 0.114B
      sum += 0.299 * r + 0.587 * g + 0.114 * b;
      count++;
    }

    return count > 0 ? sum / count : 0;
  }

  // Adaptive throttle: adjust target fps based on performance
  function adaptFps() {
    if (state.perfHistory.length < 30) return;

    const avg = state.perfHistory.reduce((a, b) => a + b, 0) / state.perfHistory.length;

    if (avg > 150 && state.targetFps > 4) {
      // Too slow, drop fps (floor at 4)
      state.targetFps--;
      state.perfHistory = []; // Reset history after change
      if (onPerfWarn) onPerfWarn(avg);
    } else if (avg < 80 && state.targetFps < 10) {
      // Fast enough, increase fps (ceiling at 10)
      state.targetFps++;
      state.perfHistory = [];
    }

    // Keep history bounded
    if (state.perfHistory.length > 60) {
      state.perfHistory = state.perfHistory.slice(-30);
    }
  }

  function detect() {
    if (!state.isRunning) return;

    const video = videoRef.current;
    if (!video || !video.videoWidth || video.paused || video.ended) {
      state.rafId = requestAnimationFrame(detect);
      return;
    }

    const now = performance.now();
    const elapsed = now - state.lastDetectionTime;
    const targetInterval = 1000 / state.targetFps;

    // Throttle: only run detection at target fps
    if (elapsed >= targetInterval) {
      const startTime = performance.now();

      try {
        // Downsample to max 1280px wide for performance
        const scale = Math.min(1, 1280 / video.videoWidth);
        const width = Math.floor(video.videoWidth * scale);
        const height = Math.floor(video.videoHeight * scale);

        if (offscreenCanvas.width !== width || offscreenCanvas.height !== height) {
          offscreenCanvas.width = width;
          offscreenCanvas.height = height;
        }

        // Draw video frame to offscreen canvas
        offscreenCtx?.drawImage(video, 0, 0, width, height);

        // Low-light detection (threshold: mean Y < 60 for 3 seconds)
        if (opts.onLowLight && offscreenCtx) {
          const brightness = computeBrightness(offscreenCanvas, offscreenCtx);
          const isLowLight = brightness < 60;
          const now = performance.now();

          if (isLowLight) {
            if (state.lowLightStartTime === null) {
              state.lowLightStartTime = now;
            } else if (now - state.lowLightStartTime > 3000) {
              // Low light for 3+ seconds
              opts.onLowLight(true);
            }
          } else {
            // Reset if light improves
            state.lowLightStartTime = null;
            opts.onLowLight(false);
          }
        }

        // Run jscanify detection
        let quad: Quad | null = null;
        if (jscanify && (jscanify as any).findPaperContour) {
          const cv = (window as unknown as { cv: unknown }).cv;
          if (cv) {
            const img = (cv as { imread: (canvas: HTMLCanvasElement) => unknown }).imread(offscreenCanvas);
            const contour = (jscanify as any).findPaperContour(img);
            const rawQuad = contourToQuad(contour);
            // Validate quad in offscreen-canvas space before scaling
            const validQuad = rawQuad && isValidQuad(rawQuad, offscreenCanvas.width, offscreenCanvas.height)
              ? rawQuad
              : null;
            // Scale quad back to video-pixel space (inverse of downsample)
            if (validQuad && scale < 1) {
              const inv = 1 / scale;
              quad = {
                topLeft: { x: validQuad.topLeft.x * inv, y: validQuad.topLeft.y * inv },
                topRight: { x: validQuad.topRight.x * inv, y: validQuad.topRight.y * inv },
                bottomRight: { x: validQuad.bottomRight.x * inv, y: validQuad.bottomRight.y * inv },
                bottomLeft: { x: validQuad.bottomLeft.x * inv, y: validQuad.bottomLeft.y * inv },
              };
            } else {
              quad = validQuad;
            }
            if (img && typeof (img as { delete: () => void }).delete === 'function') {
              (img as { delete: () => void }).delete();
            }
          }
        }

        onQuad(quad);

        // Track performance
        const detectionMs = performance.now() - startTime;
        state.perfHistory.push(detectionMs);
        state.frameCount++;
        state.lastDetectionTime = now;

        // Log in dev mode
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.log(`[jscanify] detection: ${detectionMs.toFixed(1)}ms, target fps: ${state.targetFps}`);
        }

        // Adaptive throttle check every 30 frames
        if (state.frameCount % 30 === 0) {
          adaptFps();
        }
      } catch (err) {
        // Log first failure for debugging, then continue silently
        if (state.frameCount < 2) {
          // eslint-disable-next-line no-console
          console.warn('[edgeDetectionLoop] detection error (frame 0-1):', err);
        }
        onQuad(null);
      }
    }

    state.rafId = requestAnimationFrame(detect);
  }

  // Start the loop
  state.rafId = requestAnimationFrame(detect);

  // Return stop function
  return function stop() {
    state.isRunning = false;
    if (state.rafId !== null) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
  };
}
