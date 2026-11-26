"use client";
// The spiral on a 10 cm canvas with a 1 cm grid. Line width follows pen
// pressure; the red dot is where the pen starts. A spiral bigger than the
// canvas zooms the view out and shades everything outside the canvas red.
// `untilMs` draws only what the pen had drawn by that moment (with the pen
// shown); null draws the finished spiral. Playback lives in SpiralPlayer.
import { useEffect, useRef, useState } from "react";
import styles from "@/styles/SpiralLab.module.css";

const INK = "#4b5be0";
const GRID = "#e2e8f4";
const AXIS = "#cbd3e8";
const START = "#d64545";
const OUTSIDE = "#fbe9e9";
const EDGE = "#a32d2d";

const widthFor = (p) => Math.round((0.8 + (p / 1000) * 2.4) * 4) / 4;

// Index of the last point recorded at or before `ms`.
function lastIndexAt(points, ms) {
  let lo = 0;
  let hi = points.length - 1;
  if (points[hi].t <= ms) return hi;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t <= ms) lo = mid;
    else hi = mid;
  }
  return lo;
}

export default function SpiralCanvas({ spiral, untilMs = null, fit = "canvas" }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [size, setSize] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => setSize(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== size * dpr) {
      canvas.width = size * dpr;
      canvas.height = size * dpr;
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    if (!spiral) return;

    const pts = spiral.points;
    let toX;
    let toY;
    if (fit === "data") {
      // Uploaded drawings: their position on a canvas is unknown, so frame the
      // points themselves, with a 1 cm grid (from cssPpi) for scale.
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const p of pts) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
      const devicePxPerCm = spiral.cssPpi / 2.54;
      const half = Math.max(maxX - minX, maxY - minY, devicePxPerCm) * 0.55;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const k = size / (2 * half);
      toX = (p) => size / 2 + (p.x - cx) * k;
      toY = (p) => size / 2 + (p.y - cy) * k;
      const step = devicePxPerCm * k;
      if (step > 6) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = GRID;
        for (let g = (size / 2) % step; g < size; g += step) {
          ctx.beginPath();
          ctx.moveTo(g, 0);
          ctx.lineTo(g, size);
          ctx.moveTo(0, g);
          ctx.lineTo(size, g);
          ctx.stroke();
        }
      }
      ctx.strokeStyle = AXIS;
      ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
    } else {
      const canvasCm = spiral.options.canvasCm;
      const devicePxPerCm = spiral.cssPpi / 2.54;
      const centreCm = canvasCm / 2;

      // Zoom out when the spiral runs past the canvas, so all of it stays in view.
      let farthest = 0;
      for (const p of pts) {
        const d = Math.hypot(p.x / devicePxPerCm - centreCm, p.y / devicePxPerCm - centreCm);
        if (d > farthest) farthest = d;
      }
      // Same rule as the slider limits (truth.reachCm), so the picture and the
      // warnings always agree.
      const overflow = !spiral.truth.fitsCanvas || farthest > centreCm + 1e-6;
      const halfViewCm = overflow ? Math.max(farthest, spiral.truth.reachCm) + 0.3 : centreCm;
      const pxPerCm = size / (2 * halfViewCm);
      toX = (p) => size / 2 + (p.x / devicePxPerCm - centreCm) * pxPerCm;
      toY = (p) => size / 2 + (p.y / devicePxPerCm - centreCm) * pxPerCm;
      const box = size / 2 - centreCm * pxPerCm; // canvas edge, in view pixels
      const boxSize = canvasCm * pxPerCm;

      if (overflow) {
        ctx.fillStyle = OUTSIDE;
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = "#fff";
        ctx.fillRect(box, box, boxSize, boxSize);
      }

      ctx.lineWidth = 1;
      ctx.strokeStyle = GRID;
      for (let i = 1; i < canvasCm; i += 1) {
        ctx.beginPath();
        ctx.moveTo(box + i * pxPerCm, box);
        ctx.lineTo(box + i * pxPerCm, box + boxSize);
        ctx.moveTo(box, box + i * pxPerCm);
        ctx.lineTo(box + boxSize, box + i * pxPerCm);
        ctx.stroke();
      }
      ctx.strokeStyle = AXIS;
      ctx.beginPath();
      ctx.moveTo(size / 2, box);
      ctx.lineTo(size / 2, box + boxSize);
      ctx.moveTo(box, size / 2);
      ctx.lineTo(box + boxSize, size / 2);
      ctx.stroke();
      ctx.lineWidth = overflow ? 2 : 1;
      ctx.strokeStyle = overflow ? EDGE : AXIS;
      ctx.strokeRect(box + 0.5, box + 0.5, boxSize - 1, boxSize - 1);
      if (overflow && box > 18) {
        ctx.fillStyle = EDGE;
        ctx.font = "600 12px 'Manrope', system-ui, sans-serif";
        ctx.fillText("Outside the 10 cm test canvas", 8, 14);
      }
    }

    const end = untilMs == null ? pts.length - 1 : lastIndexAt(pts, untilMs);

    ctx.strokeStyle = INK;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // Group runs of equal width into one stroke.
    let i = 1;
    while (i <= end) {
      const width = widthFor(pts[i].p);
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(toX(pts[i - 1]), toY(pts[i - 1]));
      while (i <= end && widthFor(pts[i].p) === width) {
        ctx.lineTo(toX(pts[i]), toY(pts[i]));
        i += 1;
      }
      ctx.stroke();
    }

    ctx.fillStyle = START;
    ctx.beginPath();
    ctx.arc(toX(pts[0]), toY(pts[0]), 4, 0, Math.PI * 2);
    ctx.fill();

    if (untilMs != null) {
      const pen = pts[end];
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.fillStyle = "rgba(75, 91, 224, 0.15)";
      ctx.beginPath();
      ctx.arc(toX(pen), toY(pen), 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }, [spiral, size, untilMs, fit]);

  return (
    <div ref={wrapRef} className={styles.canvasWrap}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        style={{ width: size, height: size }}
        aria-label="Generated spiral, 10 cm square with 1 cm grid"
      />
    </div>
  );
}
