"use client";
import React, { useState, useMemo, useRef, useLayoutEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

// ─── Device PPI registry ───────────────────────────────────────────────────
// CSS PPI = physical PPI / devicePixelRatio.
// To add a new device: measure its physical PPI, divide by its devicePixelRatio,
// and add an entry here. Pass the key as the `devicePpi` prop to SpeedTimeChart.
//
// Why CSS PPI and not physical PPI?
// Pointer events give coordinates in CSS pixels, so the conversion
// must use CSS PPI (not physical PPI) to get real-world cm/s values.
const DEVICE_CSS_PPI = {
  ipadProAir:  132,  // iPad Pro 11" & iPad Air — 264 physical PPI / 2× scale
  ipadPro129:  132,  // iPad Pro 12.9" — also 264 physical PPI / 2× scale
  // To add more devices, append entries here following the same pattern
};

// Converts px/ms → cm/s for a given device CSS PPI.
// Formula: (px/ms) × (2.54 cm/inch ÷ ppi px/inch) × (1000 ms/s)
const pxMsToCmS = (ppi) => (2.54 / ppi) * 1000;

// ─── Smoothing ────────────────────────────────────────────────────────────
// Centred rolling average over (2×halfWindow + 1) points.
// Larger halfWindow → smoother curve, more tremor detail suppressed.
const smooth = (data, halfWindow) =>
  data.map((pt, i) => {
    const lo = Math.max(0, i - halfWindow);
    const hi = Math.min(data.length - 1, i + halfWindow);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += data[j].speed;
    return { time: pt.time, speed: +((sum / (hi - lo + 1)).toFixed(2)) };
  });

// ─── View modes ───────────────────────────────────────────────────────────
// Profile: heavy smooth (25 pts ≈ 215 ms at 115 Hz) — reveals the gross
//   speed arc (slow start → steady → slow end) for motor control assessment.
//   Tremor oscillations are averaged out intentionally.
//
// Tremor: light smooth (7 pts ≈ 60 ms at 115 Hz) — preserves rhythmic speed
//   oscillations caused by tremor while still suppressing raw sample noise.
const MODES = {
  profile: { label: "Profile", halfWindow: 12 },
  tremor:  { label: "Tremor",  halfWindow: 3  },
};

// ─── Avg speed label ──────────────────────────────────────────────────────
// Renders a pill with a white background over the chart so it stays readable
// regardless of what the data line is doing underneath it.
// getComputedTextLength() measures the actual rendered SVG text width so the
// border fits the content exactly regardless of font or value length.
const AvgLabel = ({ viewBox, value }) => {
  const textRef = useRef(null);
  const [textWidth, setTextWidth] = useState(0);

  // useLayoutEffect runs before paint — no visible flash on first render
  useLayoutEffect(() => {
    if (textRef.current) setTextWidth(textRef.current.getComputedTextLength());
  });

  if (!viewBox) return null;
  const { x, width, y } = viewBox;
  const text = `avg ${value} cm/s`;
  const PAD = 6;
  const labelX = x + width - textWidth - PAD - 12;
  const labelY = y - 6;

  return (
    <g>
      {textWidth > 0 && (
        <rect
          x={labelX - PAD} y={labelY - 14}
          width={textWidth + PAD * 2} height={20}
          rx={4} fill="white" fillOpacity={1}
          stroke="#f59e0b" strokeWidth={1}
        />
      )}
      <text ref={textRef} x={labelX} y={labelY} fontSize={12} fill="#b45309" fontWeight={700}>
        {text}
      </text>
    </g>
  );
};

// ─── calculateSpeed ───────────────────────────────────────────────────────
// Converts raw drawing points → instantaneous speed in cm/s.
// No smoothing applied here — smoothing is handled inside SpeedTimeChart
// so the toggle can switch modes without recomputing the base data.
const calculateSpeed = (data, ppi = DEVICE_CSS_PPI.ipadProAir) => {
  if (!data || data.length < 2) return [];
  const multiplier = pxMsToCmS(ppi);
  const raw = [];
  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];
    const deltaT = curr.t - prev.t;
    if (deltaT <= 0) continue;
    const dist = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2);
    raw.push({ time: curr.t, speed: +((dist / deltaT) * multiplier).toFixed(3) });
  }
  return raw;
};

// ─── SpeedTimeChart ───────────────────────────────────────────────────────
// Accepts `devicePpi` prop so callers can pass the correct CSS PPI for the
// current device. Defaults to iPad Pro 11" / iPad Air (132 CSS PPI).
// Example: <SpeedTimeChart speedData={...} devicePpi={DEVICE_CSS_PPI.ipadPro129} />
const SpeedTimeChart = ({ speedData, devicePpi = DEVICE_CSS_PPI.ipadProAir }) => {
  const [mode, setMode] = useState("profile");

  const smoothed = useMemo(
    () => smooth(speedData ?? [], MODES[mode].halfWindow),
    [speedData, mode]
  );

  // Cap Y axis at 95th percentile so outlier spikes don't compress the
  // main signal into a flat line near zero.
  const yMax = useMemo(() => {
    if (!smoothed.length) return "auto";
    const sorted = smoothed.map(d => d.speed).sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1];
    return +(p95 * 1.1).toFixed(1);
  }, [smoothed]);

  const meanSpeed = useMemo(() => {
    if (!smoothed.length) return null;
    return +(smoothed.reduce((acc, d) => acc + d.speed, 0) / smoothed.length).toFixed(2);
  }, [smoothed]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Mode toggle — absolutely positioned so it doesn't affect card height */}
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
          <LineChart data={smoothed}>
            <CartesianGrid strokeDasharray="3 3" stroke="gray" />
            <XAxis
              dataKey="time"
              stroke="black"
              label={{ value: "Time (ms)", position: "insideBottom", dy: 10, fill: "black" }}
            />
            <YAxis
              dataKey="speed"
              stroke="black"
              domain={[0, yMax]}
              label={{ value: "Speed (cm/s)", angle: -90, position: "insideLeft", fill: "black" }}
            />
            <Tooltip
              labelFormatter={(label) => `Time: ${label} ms`}
              formatter={(value) => [`${parseFloat(value).toFixed(2)} cm/s`, "Speed"]}
            />
            {/* Dashed mean line rendered under the data */}
            {meanSpeed !== null && (
              <ReferenceLine y={meanSpeed} stroke="#f59e0b" strokeDasharray="5 4" strokeWidth={1.5} />
            )}
            <Line type="monotone" dataKey="speed" stroke="#8884d8" strokeWidth={2} dot={false} />
            {/* Label rendered on top of the data line (SVG paints in DOM order) */}
            {meanSpeed !== null && (
              <ReferenceLine y={meanSpeed} stroke="none" label={<AvgLabel value={meanSpeed} />} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export { SpeedTimeChart, calculateSpeed, DEVICE_CSS_PPI };
