'use client';

import { useEffect, useRef } from 'react';
import type { Quad } from './edgeDetectionLoop';

interface QuadOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  quad: Quad | null;
  color: 'red' | 'amber' | 'green';
}

const colorMap = {
  red: '#ef4444',
  amber: '#f59e0b',
  green: '#22c55e',
};

export default function QuadOverlay({ videoRef, quad, color }: QuadOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle resize to keep canvas in sync with video
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const video = videoRef.current;

    if (!canvas || !container || !video) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    // Initial sizing
    resizeCanvas();

    // Use ResizeObserver for responsive sizing
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(container);

    return () => observer.disconnect();
  }, [videoRef]);

  // Draw quad on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const container = containerRef.current;

    if (!canvas || !video || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!quad) return;

    // Map video coordinates to canvas display coordinates
    // Video uses object-fit: cover, so we need to account for cropping
    const videoRect = video.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Calculate scale factors
    const scaleX = containerRect.width / video.videoWidth;
    const scaleY = containerRect.height / video.videoHeight;
    const scale = Math.max(scaleX, scaleY); // cover mode

    // Calculate offset (letterboxing/centering)
    const offsetX = (containerRect.width - video.videoWidth * scale) / 2;
    const offsetY = (containerRect.height - video.videoHeight * scale) / 2;

    // Transform quad points from video to canvas coordinates
    const transformPoint = (x: number, y: number) => ({
      x: x * scale + offsetX,
      y: y * scale + offsetY,
    });

    const tl = transformPoint(quad.topLeft.x, quad.topLeft.y);
    const tr = transformPoint(quad.topRight.x, quad.topRight.y);
    const br = transformPoint(quad.bottomRight.x, quad.bottomRight.y);
    const bl = transformPoint(quad.bottomLeft.x, quad.bottomLeft.y);

    // Draw stroked polygon
    ctx.strokeStyle = colorMap[color];
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.closePath();
    ctx.stroke();

    // Optional: draw corner dots for visual polish
    ctx.fillStyle = colorMap[color];
    [tl, tr, br, bl].forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [quad, color, videoRef]);

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
