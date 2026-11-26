"use client";
// A small picture of a spiral, for lists. The square is the 10 cm canvas.
import { useMemo } from "react";
import { generateSpiral } from "@/lib/syntheticSpiral";
import { settingsToOptions } from "@/lib/spiralLab";

export default function SpiralThumb({ settings, size = 44 }) {
  const key = JSON.stringify(settings);
  const { path, box } = useMemo(() => {
    try {
      const s = generateSpiral(settingsToOptions(settings));
      const box = (s.options.canvasCm * s.cssPpi) / 2.54;
      const step = Math.max(1, Math.floor(s.points.length / 400));
      const d = s.points
        .filter((_, i) => i % step === 0)
        .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join("");
      return { path: d, box };
    } catch {
      return { path: "", box: 1 };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${box} ${box}`} role="img" aria-hidden="true" style={{ flex: "none", overflow: "hidden" }}>
      <rect x="0" y="0" width={box} height={box} rx={box * 0.06} fill="#fff" stroke="#cbd3e8" strokeWidth={box * 0.012} />
      <path d={path} fill="none" stroke="#4b5be0" strokeWidth={box * 0.012} strokeLinejoin="round" />
    </svg>
  );
}
