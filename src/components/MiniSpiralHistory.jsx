import React from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { FaHandPaper } from "react-icons/fa";
import styles from "@/styles/MiniSpiralHistory.module.css";

/**
 * Accepts savedDrawings as either:
 *  - Array of point arrays (legacy)
 *  - Array of objects: { points: [...], handSide: 'L'|'R', handUsed?: 'dominant'|'non-dominant' }
 */
const MiniSpiralHistory = ({ savedDrawings, currentDrawingIndex = 0, sidebar = true }) => {
  if (!savedDrawings || savedDrawings.length === 0) return null;

  const getPoints = (drawing) => (Array.isArray(drawing) ? drawing : drawing?.points || []);
  const getSide = (drawing) => (Array.isArray(drawing) ? drawing?.handSide : drawing?.handSide);

  const SidebarSpiralCard = ({ drawing, index }) => {
    const pts = getPoints(drawing);
    if (!pts || pts.length === 0) return null;

    const xValues = pts.map((d) => d.x);
    const yValues = pts.map((d) => d.y);
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);
    const xPadding = (xMax - xMin) * 0.1;
    const yPadding = (yMax - yMin) * 0.1;

    const side = getSide(drawing); // 'L' | 'R' | undefined

    return (
      <div className={styles.spiralCard}>
        {/* Title row with centered text and side-specific hand icon */}
        <div
          className={styles.spiralTitle}
          style={{ position: "relative", textAlign: "center", display: "block" }}
        >
          {/* Left-hand icon on the left of the title */}
          {side === "L" && (
            <FaHandPaper
              aria-label="Left hand"
              style={{
                position: "absolute",
                left: 8,
                top: "50%",
                transform: "translateY(-50%)",
                opacity: 0.9,
                width: 18,
                height: 18,
              }}
            />
          )}

          {/* Title text stays centered */}
          <span>Spiral {index + 1}</span>

          {/* Right-hand icon on the right of the title (mirrored) */}
          {side === "R" && (
            <FaHandPaper
              aria-label="Right hand"
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%) scaleX(-1)",
                opacity: 0.9,
                width: 18,
                height: 18,
              }}
            />
          )}
        </div>

        <div className={styles.spiralChart}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pts} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <XAxis type="number" dataKey="x" hide domain={[xMin - xPadding, xMax + xPadding]} />
              <YAxis type="number" dataKey="y" hide reversed domain={[yMin - yPadding, yMax + yPadding]} />
              {/* Neutral black stroke (no blue) */}
              <Line type="monotone" dataKey="y" stroke="#000000" strokeWidth={1.5} dot={false} animationDuration={0} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const DashboardSpiralCard = ({ drawing, index }) => {
    const pts = getPoints(drawing);
    if (!pts || pts.length === 0) return null;

    const xValues = pts.map((d) => d.x);
    const yValues = pts.map((d) => d.y);
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);
    const xPadding = (xMax - xMin) * 0.1;
    const yPadding = (yMax - yMin) * 0.1;

    return (
      <div className={styles.dashboardSpiralCard}>
        {/* Keep dashboard simple: centered title only */}
        <div className={styles.dashboardSpiralTitle}>Spiral {index + 1}</div>

        <div className={styles.dashboardSpiralChart}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pts} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <XAxis type="number" dataKey="x" hide domain={[xMin - xPadding, xMax + xPadding]} />
              <YAxis type="number" dataKey="y" hide reversed domain={[yMin - yPadding, yMax + yPadding]} />
              <Line type="monotone" dataKey="y" stroke="#000000" strokeWidth={1} dot={false} animationDuration={0} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  if (sidebar) {
    return (
      <div className={styles.spiralSidebar}>
        {savedDrawings.map((drawing, index) => (
          <SidebarSpiralCard key={index} drawing={drawing} index={index} />
        ))}
      </div>
    );
  }

  return (
    <div className={styles.spiralGrid}>
      {savedDrawings.map((drawing, index) => (
        <DashboardSpiralCard key={index} drawing={drawing} index={index} />
      ))}
    </div>
  );
};

export default MiniSpiralHistory;
