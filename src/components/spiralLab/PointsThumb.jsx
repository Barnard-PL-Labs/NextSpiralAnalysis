"use client";
// A small picture of any drawing, framed to its own points (uploaded drawings
// have no known canvas). Screen y grows downward, as on the drawing page.
import { memo, useMemo } from "react";

function PointsThumb({ points, size = 88, color = "#4b5be0" }) {
  const view = useMemo(() => {
    if (!points?.length) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const span = Math.max(maxX - minX, maxY - minY, 1);
    const pad = span * 0.06;
    const step = Math.max(1, Math.floor(points.length / 300));
    const d = points
      .filter((_, i) => i % step === 0)
      .map((p, i) => `${i ? "L" : "M"}${(p.x - minX + pad).toFixed(1)} ${(p.y - minY + pad).toFixed(1)}`)
      .join("");
    const box = span + 2 * pad;
    const offX = (box - (maxX - minX + 2 * pad)) / 2;
    const offY = (box - (maxY - minY + 2 * pad)) / 2;
    return { d, box, offX, offY };
  }, [points]);

  if (!view) {
    return <svg width={size} height={size} aria-hidden="true" style={{ flex: "none", background: "#fff", borderRadius: 6 }} />;
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-view.offX} ${-view.offY} ${view.box} ${view.box}`}
      aria-hidden="true"
      style={{ flex: "none", background: "#fff", borderRadius: 6 }}
    >
      <path d={view.d} fill="none" stroke={color} strokeWidth={view.box * 0.012} strokeLinejoin="round" />
    </svg>
  );
}

export default memo(PointsThumb);
