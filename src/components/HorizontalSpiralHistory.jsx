import React from "react";
import styles from "@/styles/MiniSpiralHistory.module.css";

const SpiralSVG = ({ drawing }) => {
  if (!drawing || drawing.length < 2) return null;
  const xs = drawing.map((p) => p.x);
  const ys = drawing.map((p) => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  const vw = 120, vh = 120, pad = 8;
  const scale = Math.min((vw - pad * 2) / xRange, (vh - pad * 2) / yRange);
  const offsetX = pad + ((vw - pad * 2) - xRange * scale) / 2;
  const offsetY = pad + ((vh - pad * 2) - yRange * scale) / 2;
  const points = drawing
    .map((p) => `${offsetX + (p.x - xMin) * scale},${offsetY + (p.y - yMin) * scale}`)
    .join(" ");
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="xMidYMid meet">
      <polyline
        points={points}
        fill="none"
        stroke="#4f46e5"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  );
};

const HorizontalSpiralHistory = ({ savedDrawings, compact = false }) => {
  if (!savedDrawings || savedDrawings.length === 0) return null;
  return (
    <div className={compact ? styles.dashboardHorizontalSidebarCompact : styles.dashboardHorizontalSidebar}>
      {savedDrawings.map((drawing, index) => (
        <div
          key={index}
          className={compact ? styles.dashboardHorizontalCardCompact : styles.dashboardHorizontalCard}
        >
          <div className={styles.dashboardHorizontalTitle}>Spiral {index + 1}</div>
          <div className={compact ? styles.dashboardHorizontalChartCompact : styles.dashboardHorizontalChart}>
            <SpiralSVG drawing={drawing} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default HorizontalSpiralHistory;
