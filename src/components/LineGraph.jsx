"use client";
import { useState } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Label } from "recharts";

const LEFT_COLOR  = "#3b82f6";  // blue
const RIGHT_COLOR = "#ec80ff";  // light pink

// CSS PPI of the drawing device (iPad Pro/Air: 264 physical PPI / 2× scale).
// Must match the registry in ST.jsx so all charts report the same real-world units.
const DEFAULT_CSS_PPI = 132;

// Fixed window (in cm) for the Actual Size view, so spirals from different
// drawings render at a comparable real-world scale. Expands if a spiral is larger.
const ABS_SPAN_CM = 14;

// View modes: Actual Size (default) uses a fixed cm window centered on the
// spiral; Fit zooms to the spiral's extent.
const MODES = {
  actual: { label: "Actual Size" },
  fit:    { label: "Fit" },
};

export default function LineGraph({ data, devicePpi = DEFAULT_CSS_PPI }) {
    const [mode, setMode] = useState("actual");

    if (!data || data.length < 2) return (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>
            No data
        </div>
    );

    // Convert to cm and re-origin at the spiral's center, so 0 on each axis is
    // the middle of the spiral ("cm from center") rather than the arbitrary
    // canvas corner the drawing happened to be placed against.
    const pxToCm = 2.54 / devicePpi;
    const rawCm = data.map((p) => ({ x: p.x * pxToCm, y: p.y * pxToCm }));
    const rawXs = rawCm.map((p) => p.x);
    const rawYs = rawCm.map((p) => p.y);
    const originX = (Math.min(...rawXs) + Math.max(...rawXs)) / 2;
    const originY = (Math.min(...rawYs) + Math.max(...rawYs)) / 2;
    const points = data.map((p, i) => ({ ...p, x: rawCm[i].x - originX, y: rawCm[i].y - originY }));

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const centerX = 0;
    const centerY = 0;

    // Actual Size: same fixed span on both axes, centered on the spiral,
    // grown if the spiral exceeds the default window. Bounds snap outward to
    // even centimeters so the axis ticks land on clean whole numbers.
    const span = Math.max(
        ABS_SPAN_CM,
        Math.max(...xs) - Math.min(...xs),
        Math.max(...ys) - Math.min(...ys)
    );
    const evenWindow = (center) => {
        const lo = 2 * Math.floor((center - span / 2) / 2);
        const hi = 2 * Math.ceil((center + span / 2) / 2);
        const ticks = [];
        for (let t = lo; t <= hi; t += 2) ticks.push(t);
        return { domain: [lo, hi], ticks };
    };
    const axes = mode === "actual"
        ? { x: evenWindow(centerX), y: evenWindow(centerY) }
        : { x: { domain: ["auto", "auto"] }, y: { domain: ["auto", "auto"] } };

    // Split into alternating left/right segments; overlap by 1 point so lines meet
    const segments = [];
    let cur = { side: points[0].x < centerX ? "left" : "right", points: [points[0]] };
    for (let i = 1; i < points.length; i++) {
        const side = points[i].x < centerX ? "left" : "right";
        if (side === cur.side) {
            cur.points.push(points[i]);
        } else {
            segments.push(cur);
            cur = { side, points: [points[i - 1], points[i]] };
        }
    }
    segments.push(cur);

    return (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
            {/* Scale toggle — absolutely positioned so it doesn't affect card height */}
            <div style={{ position: "absolute", top: 4, right: 4, zIndex: 10, display: "flex", gap: 6 }}>
                {Object.entries(MODES).map(([key, { label }]) => {
                    const active = mode === key;
                    return (
                        <button
                            key={key}
                            onClick={() => setMode(key)}
                            style={{
                                padding: "3px 10px",
                                fontSize: 11,
                                fontWeight: 700,
                                borderRadius: 999,
                                border: active ? "2px solid #4f46e5" : "2px solid rgba(79,70,229,0.3)",
                                background: active ? "#4f46e5" : "rgba(79,70,229,0.07)",
                                color: active ? "white" : "#4f46e5",
                                cursor: "pointer",
                            }}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            <div style={{ width: "100%", height: "100%", paddingTop: 32 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="gray" />

                        <XAxis type="number" dataKey="x" name="X" domain={axes.x.domain} ticks={axes.x.ticks} tickFormatter={(v) => (Number.isInteger(v) ? String(v) : v.toFixed(1))}>
                            <Label value="X (cm from center)" offset={-20} position="insideBottom" fill="black" />
                        </XAxis>

                        <YAxis type="number" dataKey="y" name="Y" reversed={true} domain={axes.y.domain} ticks={axes.y.ticks} tickFormatter={(v) => (Number.isInteger(v) ? String(v) : v.toFixed(1))}>
                            <Label value="Y (cm from center)" angle={-90} position="insideLeft" style={{ textAnchor: "middle" }} fill="black" />
                        </YAxis>

                        <Tooltip
                            cursor={{ strokeDasharray: "3 3" }}
                            formatter={(value, name) => [`${value.toFixed(2)} cm`, name]}
                        />

                        {segments.map((seg, i) => (
                            <Scatter
                                key={i}
                                data={seg.points}
                                line={{ stroke: seg.side === "left" ? LEFT_COLOR : RIGHT_COLOR, strokeWidth: 2 }}
                                lineType="joint"
                                shape={() => null}
                            />
                        ))}
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
