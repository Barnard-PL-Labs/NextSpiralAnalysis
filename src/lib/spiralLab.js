// Helpers for the spiral lab page (src/app/spiral-lab): the flat settings the
// controls edit, conversion to generateSpiral() options, shareable links, and
// the "put in vs measured" comparison.
import { DEFAULT_SPIRAL, SPIRAL_PRESETS } from "@/lib/syntheticSpiral";

export function optionsToSettings(o) {
  return {
    loops: o.loops,
    spacingStart: o.loopSpacingCm,
    spacingEnd: o.loopSpacingEndCm ?? o.loopSpacingCm,
    startRadius: o.startRadiusCm,
    direction: o.direction,
    startAngle: o.startAngleDeg,
    duration: o.durationS,
    speedProfile: o.speedProfile,
    endSpeedRatio: o.endSpeedRatio,
    sampleHz: o.sampleHz,
    timingJitter: o.timingJitterMs,
    cssPpi: o.cssPpi,
    tremorOn: Boolean(o.tremor),
    tremorFreq: o.tremor?.freqHz ?? 5,
    tremorAmp: o.tremor?.amplitudeCm ?? 0.1,
    tremorAxis: o.tremor?.axisDeg ?? 45,
    noise: o.noiseCm,
    pressureMode: o.pressure?.constant != null ? "constant" : "varying",
    pressureBase: o.pressure?.base ?? 450,
    pressureSwing: o.pressure?.swing ?? 120,
    pressureConstant: o.pressure?.constant ?? 500,
    seed: o.seed,
  };
}

export function settingsToOptions(s) {
  return {
    loops: s.loops,
    loopSpacingCm: s.spacingStart,
    loopSpacingEndCm: s.spacingEnd,
    startRadiusCm: s.startRadius,
    direction: s.direction,
    startAngleDeg: s.startAngle,
    durationS: s.duration,
    speedProfile: s.speedProfile,
    endSpeedRatio: s.endSpeedRatio,
    sampleHz: s.sampleHz,
    timingJitterMs: s.timingJitter,
    cssPpi: s.cssPpi,
    tremor: s.tremorOn ? { freqHz: s.tremorFreq, amplitudeCm: s.tremorAmp, axisDeg: s.tremorAxis } : null,
    noiseCm: s.noise,
    pressure:
      s.pressureMode === "constant"
        ? { constant: s.pressureConstant }
        : { base: s.pressureBase, swing: s.pressureSwing },
    seed: s.seed,
  };
}

export function presetSettings(name) {
  return optionsToSettings({ ...DEFAULT_SPIRAL, ...(SPIRAL_PRESETS[name] || {}) });
}

// Every preset, grouped by what it is for, with a name people can read. The
// ids are the SPIRAL_PRESETS keys (also used by scripts/synthetic-spirals.mjs).
// Names describe the drawing, not a diagnosis: these are idealised spirals.
export const PRESET_GROUPS = [
  {
    title: "Start here",
    presets: [
      { id: "baseline", label: "Steady hand" },
      { id: "slow-tremor", label: "Slow tremor (about 5 Hz)" },
      { id: "fast-tremor", label: "Fast tremor (about 9 Hz)" },
      { id: "shrinking-and-slowing", label: "Shrinking and slowing" },
    ],
  },
  {
    title: "Shape",
    presets: [
      { id: "tight", label: "Tighter loops (6 × 0.5 cm)" },
      { id: "wide", label: "Wider loops (3 × 1.2 cm)" },
      { id: "shrinking-spacing", label: "Spacing shrinks outwards" },
      { id: "clockwise", label: "Clockwise" },
      { id: "start-at-top", label: "Starts at the top" },
    ],
  },
  {
    title: "Speed",
    presets: [
      { id: "fast", label: "Fast (4 s)" },
      { id: "slow", label: "Slow (16 s)" },
      { id: "slowing-down", label: "Slows to half speed" },
      { id: "constant-turn-rate", label: "Steady turning, not steady speed" },
    ],
  },
  {
    title: "Tremor tests",
    presets: [
      { id: "tremor-5hz-1mm", label: "5 Hz, small (±1 mm)" },
      { id: "tremor-5hz-3mm", label: "5 Hz, large (±3 mm)" },
      { id: "tremor-9hz-1mm", label: "9 Hz, small (±1 mm)" },
      { id: "tremor-6hz-horizontal", label: "6 Hz, side to side" },
      { id: "tremor-6hz-vertical", label: "6 Hz, up and down" },
      { id: "hand-noise", label: "Hand jitter only" },
    ],
  },
  {
    title: "Recording details",
    presets: [
      { id: "no-pressure", label: "No pressure (finger or mouse)" },
      { id: "sampled-60hz", label: "Recorded at 60 Hz" },
      { id: "sampled-240hz", label: "Recorded at 240 Hz" },
      { id: "uneven-timing", label: "Uneven timing" },
      { id: "other-device-ppi", label: "Different screen" },
    ],
  },
];

export const START_PRESETS = PRESET_GROUPS[0].presets;

export const PRESET_LABELS = Object.fromEntries(PRESET_GROUPS.flatMap((g) => g.presets.map((p) => [p.id, p.label])));

// Same spiral as the preset, ignoring the seed.
export function matchesPreset(settings, id) {
  const preset = presetSettings(id);
  return Object.keys(preset).every((k) => k === "seed" || preset[k] === settings[k]);
}

export const DEFAULT_SETTINGS = presetSettings("baseline");

// Settings travel in the URL fragment, so a link reproduces the exact spiral
// and never reaches the server.
export function encodeSettings(settings) {
  const changed = Object.fromEntries(
    Object.entries(settings).filter(([k, v]) => DEFAULT_SETTINGS[k] !== v)
  );
  return encodeURIComponent(JSON.stringify(changed));
}

export function decodeSettings(fragment) {
  try {
    const parsed = JSON.parse(decodeURIComponent(fragment));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const out = { ...DEFAULT_SETTINGS };
    for (const [k, v] of Object.entries(parsed)) {
      if (!(k in DEFAULT_SETTINGS)) continue;
      if (typeof v !== typeof DEFAULT_SETTINGS[k]) continue;
      if (typeof v === "number" && !Number.isFinite(v)) continue;
      out[k] = v;
    }
    return out;
  } catch {
    return null;
  }
}

export function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Angle between two axes, ignoring which way along the axis (0..90).
function axisDifference(a, b) {
  const d = Math.abs(((a - b) % 180) + 180) % 180;
  return Math.min(d, 180 - d);
}

// Rows of "what went in" next to "what the analysis measured", each with a
// verdict: "match", "off", "missing" (no number came back) or null (nothing to
// judge against).
export function compareToTruth(result, truth) {
  const tremor = truth.tremorFreqHz != null;
  const specs = [
    { key: "overall average of widths", label: "Loop spacing", unit: "cm", truth: truth.loopSpacingCm, tol: 0.1 },
    { key: "number of cycles", label: "Loops", unit: "", truth: truth.loops, abs: 0.5 },
    { key: "Sampling frequency", label: "Sample rate", unit: "Hz", truth: truth.sampleHz, tol: 0.05 },
    { key: "Speed mean", label: "Mean pen speed", unit: "cm/s", truth: truth.meanSpeedCmPerS, tol: 0.15 },
    { key: "Cal Tremor", label: "Tremor detected", unit: "", truth: tremor ? 1 : 0, exact: true },
    { key: "traxis_fr1", label: "Tremor frequency", unit: "Hz", truth: truth.tremorFreqHz, tol: 0.1 },
    { key: "traxis_dir1", label: "Tremor direction", unit: "°", truth: truth.tremorAxisDeg, axis: 15 },
    { key: "mean amp. (cm)", label: "Tremor size (mean amp.)", unit: "cm", truth: truth.tremorAmplitudeCm, noVerdict: true },
  ];

  return specs.map((spec) => {
    const raw = result?.[spec.key];
    const measured = toNumber(raw);
    let verdict = null;
    if (spec.truth != null && !spec.noVerdict) {
      if (measured == null) verdict = "missing";
      else if (spec.exact) verdict = measured === spec.truth ? "match" : "off";
      else if (spec.abs != null) verdict = Math.abs(measured - spec.truth) <= spec.abs ? "match" : "off";
      else if (spec.axis != null) verdict = axisDifference(measured, spec.truth) <= spec.axis ? "match" : "off";
      else verdict = Math.abs(measured - spec.truth) <= spec.tol * Math.abs(spec.truth) ? "match" : "off";
    }
    return { ...spec, raw: raw ?? null, measured, verdict };
  });
}

export function pointsToCsv(points) {
  return ["n,x,y,p,t", ...points.map((p) => `${p.n},${p.x},${p.y},${p.p},${p.t}`)].join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// Simple view
// ---------------------------------------------------------------------------

// The simple view edits only these; everything else is a detailed setting.
export const SIMPLE_KEYS = ["loops", "spacingStart", "spacingEnd", "duration", "tremorOn", "tremorAmp", "tremorFreq"];

// Peak swing either side of the path, in cm.
export const TREMOR_LEVELS = [
  { id: "none", label: "None", amp: null },
  { id: "mild", label: "Mild", amp: 0.05 },
  { id: "moderate", label: "Moderate", amp: 0.15 },
  { id: "strong", label: "Strong", amp: 0.3 },
];

export function tremorLevel(settings) {
  if (!settings.tremorOn) return "none";
  const level = TREMOR_LEVELS.find((l) => l.amp != null && Math.abs(l.amp - settings.tremorAmp) < 1e-9);
  return level ? level.id : "custom";
}

export function applyTremorLevel(settings, id) {
  const level = TREMOR_LEVELS.find((l) => l.id === id);
  if (!level) return settings;
  if (level.amp == null) return { ...settings, tremorOn: false };
  return { ...settings, tremorOn: true, tremorAmp: level.amp };
}

const DETAILED_LABELS = {
  startRadius: "start radius",
  direction: "direction",
  startAngle: "start angle",
  speedProfile: "pen movement",
  endSpeedRatio: "speed change",
  sampleHz: "sample rate",
  timingJitter: "timing jitter",
  cssPpi: "device",
  tremorAxis: "tremor direction",
  noise: "hand jitter",
  pressureMode: "pressure",
  pressureBase: "pressure",
  pressureSwing: "pressure",
  pressureConstant: "pressure",
};

// Plain names of the detailed settings that differ from the defaults, so the
// simple view can say the spiral is more than what its controls show.
export function detailedChanges(settings) {
  const names = new Set();
  if (settings.spacingStart !== settings.spacingEnd) names.add("spacing that changes across loops");
  for (const [key, label] of Object.entries(DETAILED_LABELS)) {
    if (key === "pressureConstant" && settings.pressureMode !== "constant") continue;
    if ((key === "pressureBase" || key === "pressureSwing") && settings.pressureMode === "constant") continue;
    if (key === "tremorAxis" && !settings.tremorOn) continue;
    if (settings[key] !== DEFAULT_SETTINGS[key]) names.add(label);
  }
  return [...names];
}

// Keep what the simple view shows; put every detailed setting back to default.
export function resetDetailed(settings) {
  return {
    ...DEFAULT_SETTINGS,
    loops: settings.loops,
    spacingStart: settings.spacingStart,
    spacingEnd: settings.spacingStart,
    duration: settings.duration,
    tremorOn: settings.tremorOn,
    tremorAmp: settings.tremorAmp,
    tremorFreq: settings.tremorFreq,
    seed: settings.seed,
  };
}

function trim(n, digits = 2) {
  return String(Number(n.toFixed(digits)));
}

// One sentence saying what the spiral is, in plain words.
export function describeSpiral(s) {
  const spacing =
    s.spacingStart === s.spacingEnd
      ? `${trim(s.spacingStart)} cm apart`
      : `${trim(s.spacingStart)} cm apart at the centre, ${trim(s.spacingEnd)} cm at the edge`;
  const main = `${trim(s.loops)} loops, ${spacing}, drawn ${s.direction === "cw" ? "clockwise" : "anticlockwise"} in ${trim(s.duration, 1)} s`;
  const tremor = s.tremorOn
    ? `with a ${trim(s.tremorFreq, 1)} Hz tremor swinging ${trim(s.tremorAmp * 10, 1)} mm each way`
    : "with no tremor";
  const extras = [];
  if (s.endSpeedRatio !== 1) {
    extras.push(s.endSpeedRatio < 1 ? `slowing to ${trim(s.endSpeedRatio)}× speed` : `speeding up to ${trim(s.endSpeedRatio)}× speed`);
  }
  if (s.noise > 0) extras.push(`${trim(s.noise * 10, 2)} mm hand jitter`);
  if (s.pressureMode === "constant") extras.push("flat pressure (no stylus)");
  if (s.sampleHz !== DEFAULT_SETTINGS.sampleHz) extras.push(`recorded at ${trim(s.sampleHz, 0)} Hz`);
  return `${main}, ${tremor}${extras.length ? `; ${extras.join(", ")}` : ""}.`;
}

// The comparison rows the simple view shows.
export function simpleRows(rows, truth) {
  const keys = ["overall average of widths", "number of cycles", "Cal Tremor"];
  if (truth.tremorFreqHz != null) keys.push("traxis_fr1");
  return rows.filter((r) => keys.includes(r.key));
}

// ---------------------------------------------------------------------------
// Canvas limits
// ---------------------------------------------------------------------------

// The largest value each size setting can take, with every other setting as
// it is, before the spiral runs past the edge of the 10 cm test canvas. Uses
// the same reach formula as the generator (spiralReachCm), solved for one
// setting at a time. A limit below zero means it cannot fit at any value.
export function fitLimits(s, canvasCm = DEFAULT_SPIRAL.canvasCm) {
  const edge = canvasCm / 2;
  const tremor = s.tremorOn ? s.tremorAmp : 0;
  const jitter = 3 * s.noise;
  const meanSpacing = (s.spacingStart + s.spacingEnd) / 2;
  const room = edge - s.startRadius - tremor - jitter; // what the loops may use
  const reach = s.startRadius + s.loops * meanSpacing + tremor + jitter;
  return {
    edgeCm: edge,
    reachCm: reach,
    fits: reach <= edge + 1e-9,
    loops: room / meanSpacing,
    spacingBoth: room / s.loops,
    spacingStart: (2 * room) / s.loops - s.spacingEnd,
    spacingEnd: (2 * room) / s.loops - s.spacingStart,
    startRadius: edge - s.loops * meanSpacing - tremor - jitter,
    tremorAmp: edge - s.startRadius - s.loops * meanSpacing - jitter,
    noise: (edge - s.startRadius - s.loops * meanSpacing - tremor) / 3,
  };
}

// ---------------------------------------------------------------------------
// Link fragment: #view=detailed&s=<settings>
// ---------------------------------------------------------------------------

export function parseHash(hash) {
  const out = { view: null, settings: null };
  for (const part of (hash || "").replace(/^#/, "").split("&")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (key === "view" && ["simple", "detailed", "batch", "upload"].includes(value)) out.view = value;
    if (key === "s") out.settings = decodeSettings(value);
  }
  return out;
}

export function buildHash({ view, settings }) {
  const parts = [];
  if (["detailed", "batch", "upload"].includes(view)) parts.push(`view=${view}`);
  const encoded = encodeSettings(settings);
  if (encoded !== encodeURIComponent("{}")) parts.push(`s=${encoded}`);
  return parts.length ? `#${parts.join("&")}` : "";
}
