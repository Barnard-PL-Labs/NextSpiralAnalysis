// Draws spirals by algorithm, in exactly the format the drawing canvas saves
// (src/components/Canvas.jsx): CSS-pixel x/y on a 10 cm canvas, pressure 0-1000,
// whole-millisecond timestamps from the first touch.
//
// Every spiral comes with the answer it was built from (`truth`): loop spacing,
// number of loops, tremor frequency and size. Running these through the
// analysis shows whether each metric recovers what was put in, and running the
// same spiral several times with fresh noise shows how stable each metric is.

const TWO_PI = 2 * Math.PI;
const CM_PER_INCH = 2.54;

// Small seeded generator (mulberry32): the same seed gives the same spiral.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(random) {
  const u = Math.max(random(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TWO_PI * random());
}

export const DEFAULT_SPIRAL = {
  loops: 4, // full turns
  loopSpacingCm: 0.8, // distance between neighbouring loops (the "width")
  loopSpacingEndCm: null, // spacing at the outermost loop; null = same as loopSpacingCm.
  // Different values make the spacing change steadily from the centre outwards
  // (smaller at the end mimics micrographia).
  startRadiusCm: 0.2,
  direction: "ccw", // as seen on screen: "ccw" or "cw"
  startAngleDeg: 0, // where the pen starts, 0 = to the right of centre, measured as seen
  durationS: 8,
  speedProfile: "constant-speed", // or "constant-turn-rate"
  endSpeedRatio: 1, // pen speed at the end relative to the start: 0.5 = slows to half
  sampleHz: 120, // pointerrawupdate on iPad/Chromium; Safari's coalesced events reach 240
  timingJitterMs: 0, // spread of the interval between samples
  cssPpi: 132, // iPad Pro: 264 PPI at devicePixelRatio 2
  canvasCm: 10, // matches TARGET_CM in Canvas.jsx
  tremor: null, // { freqHz, amplitudeCm (peak), axisDeg } -- a straight-line oscillation
  noiseCm: 0, // random hand jitter on every sample (standard deviation)
  pressure: { base: 450, swing: 120 }, // or { constant: 500 } for a device with no pressure
  seed: 1,
};

// Radius after turning `theta`, with the spacing per turn changing linearly
// from b0 to b1 (both in cm per radian) over thetaMax.
function radiusAt(theta, r0, b0, b1, thetaMax) {
  return r0 + b0 * theta + ((b1 - b0) * theta * theta) / (2 * thetaMax);
}

// Arc length along the spiral, tabulated so a pen speed can be turned back
// into an angle.
function arcLengthTable(r0, b0, b1, thetaMax, steps = 20000) {
  const thetas = new Float64Array(steps + 1);
  const lengths = new Float64Array(steps + 1);
  const dTheta = thetaMax / steps;
  for (let i = 1; i <= steps; i += 1) {
    const theta = i * dTheta;
    const mid = theta - dTheta / 2;
    const r = radiusAt(mid, r0, b0, b1, thetaMax);
    const dr = b0 + ((b1 - b0) * mid) / thetaMax;
    thetas[i] = theta;
    lengths[i] = lengths[i - 1] + Math.sqrt(r * r + dr * dr) * dTheta;
  }
  return { thetas, lengths };
}

// Share of the way through the spiral after a share `tau` of the time, when
// speed changes linearly from 1 to `k` times its starting value.
function progressAt(tau, k) {
  return (tau + ((k - 1) * tau * tau) / 2) / (1 + (k - 1) / 2);
}

function thetaAtLength(table, s) {
  const { thetas, lengths } = table;
  let lo = 0;
  let hi = lengths.length - 1;
  if (s <= 0) return 0;
  if (s >= lengths[hi]) return thetas[hi];
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (lengths[mid] <= s) lo = mid;
    else hi = mid;
  }
  const f = (s - lengths[lo]) / (lengths[hi] - lengths[lo]);
  return thetas[lo] + f * (thetas[hi] - thetas[lo]);
}

// Keep only the options generateSpiral understands, so a recipe that arrived
// over the network carries nothing else into storage.
export function sanitizeSpiralOptions(options) {
  if (!options || typeof options !== "object" || Array.isArray(options)) return null;
  return Object.fromEntries(Object.entries(options).filter(([k]) => k in DEFAULT_SPIRAL));
}

// How far from the centre the pen can get: the outer loop, plus the tremor
// swing, plus three standard deviations of hand jitter. A spiral fits the test
// canvas when this is at most canvasCm / 2.
export function spiralReachCm({ startRadiusCm, loops, loopSpacingCm, loopSpacingEndCm, tremorAmplitudeCm = 0, noiseCm = 0 }) {
  const meanSpacing = (loopSpacingCm + (loopSpacingEndCm ?? loopSpacingCm)) / 2;
  return startRadiusCm + loops * meanSpacing + (tremorAmplitudeCm || 0) + 3 * (noiseCm || 0);
}

export function generateSpiral(options = {}) {
  const o = { ...DEFAULT_SPIRAL, ...options };
  const spacingEnd = o.loopSpacingEndCm ?? o.loopSpacingCm;
  if (!(o.loops > 0) || !(o.loopSpacingCm > 0) || !(spacingEnd > 0) || !(o.durationS > 0) || !(o.sampleHz > 0)) {
    throw new Error("Loops, loop spacing, duration and sample rate must be above zero.");
  }
  if (!(o.endSpeedRatio > 0)) throw new Error("Speed at end must be above zero.");
  if (o.startRadiusCm < 0 || o.noiseCm < 0 || (o.tremor && !(o.tremor.amplitudeCm >= 0))) {
    throw new Error("Start radius, tremor size and hand jitter cannot be negative.");
  }
  const meanSpacing = (o.loopSpacingCm + spacingEnd) / 2;
  // Spirals bigger than the canvas are still drawn (points fall outside it);
  // truth.fitsCanvas says whether a real drawing could have looked like this.
  const reachCm = spiralReachCm({
    startRadiusCm: o.startRadiusCm,
    loops: o.loops,
    loopSpacingCm: o.loopSpacingCm,
    loopSpacingEndCm: spacingEnd,
    tremorAmplitudeCm: o.tremor?.amplitudeCm,
    noiseCm: o.noiseCm,
  });

  const random = rng(o.seed);
  const pxPerCm = o.cssPpi / CM_PER_INCH;
  const centre = (o.canvasCm * pxPerCm) / 2;
  const sign = o.direction === "cw" ? -1 : 1;
  const start = (o.startAngleDeg * Math.PI) / 180;
  const b0 = o.loopSpacingCm / TWO_PI;
  const b1 = spacingEnd / TWO_PI;
  const thetaMax = o.loops * TWO_PI;
  const table = arcLengthTable(o.startRadiusCm, b0, b1, thetaMax);
  const totalLength = table.lengths[table.lengths.length - 1];
  const durationMs = o.durationS * 1000;

  const tremorAxis = o.tremor ? ((o.tremor.axisDeg ?? 45) * Math.PI) / 180 : 0;
  const tremorPhase = random() * TWO_PI;
  const pressurePhase = random() * TWO_PI;

  const points = [];
  let tMs = 0;
  // Distance the pen really travels, tremor included (hand jitter is left
  // out: it is noise on the recording, not movement).
  let penPathCm = 0;
  let previous = null;
  while (tMs <= durationMs) {
    const progress = progressAt(tMs / durationMs, o.endSpeedRatio);
    const theta =
      o.speedProfile === "constant-turn-rate" ? progress * thetaMax : thetaAtLength(table, progress * totalLength);
    const r = radiusAt(theta, o.startRadiusCm, b0, b1, thetaMax);
    const visualAngle = start + sign * theta;

    // Position in cm with y pointing up, as the viewer sees it.
    let xCm = r * Math.cos(visualAngle);
    let yCm = r * Math.sin(visualAngle);
    if (o.tremor) {
      const d = o.tremor.amplitudeCm * Math.sin(TWO_PI * o.tremor.freqHz * (tMs / 1000) + tremorPhase);
      xCm += d * Math.cos(tremorAxis);
      yCm += d * Math.sin(tremorAxis);
    }
    if (previous) penPathCm += Math.hypot(xCm - previous.x, yCm - previous.y);
    previous = { x: xCm, y: yCm };
    if (o.noiseCm > 0) {
      xCm += gaussian(random) * o.noiseCm;
      yCm += gaussian(random) * o.noiseCm;
    }

    const p =
      o.pressure?.constant != null
        ? o.pressure.constant
        : Math.round(
            Math.min(1000, Math.max(1, o.pressure.base + o.pressure.swing * Math.sin(TWO_PI * 0.7 * (tMs / 1000) + pressurePhase)))
          );

    points.push({
      n: points.length + 1,
      // Screen y grows downward.
      x: +(centre + xCm * pxPerCm).toFixed(4),
      y: +(centre - yCm * pxPerCm).toFixed(4),
      p,
      t: Math.round(tMs),
    });

    const step = 1000 / o.sampleHz + (o.timingJitterMs ? gaussian(random) * o.timingJitterMs : 0);
    tMs += Math.max(1, step);
  }

  return {
    points,
    cssPpi: o.cssPpi,
    truth: {
      loops: o.loops,
      loopSpacingCm: meanSpacing,
      loopSpacingStartCm: o.loopSpacingCm,
      loopSpacingEndCm: spacingEnd,
      direction: o.direction,
      durationS: o.durationS,
      endSpeedRatio: o.endSpeedRatio,
      sampleHz: o.sampleHz,
      tremorFreqHz: o.tremor?.freqHz ?? null,
      tremorAmplitudeCm: o.tremor?.amplitudeCm ?? null,
      tremorAxisDeg: o.tremor ? (o.tremor.axisDeg ?? 45) : null,
      noiseCm: o.noiseCm,
      pressureConstant: o.pressure?.constant ?? null,
      // Speed along the spiral itself, and of the pen including tremor.
      pathSpeedCmPerS: totalLength / o.durationS,
      meanSpeedCmPerS: penPathCm / (points[points.length - 1].t / 1000),
      reachCm,
      fitsCanvas: reachCm <= o.canvasCm / 2 + 1e-9,
    },
    options: o,
  };
}

// A spread of spirals for checking the analysis: each changes one thing from
// the baseline, so a metric that moves can be traced to its cause.
export const SPIRAL_PRESETS = {
  baseline: {},
  // Starting points for people: one moderate tremor at two speeds, and a
  // spiral that tightens and slows towards the edge.
  "slow-tremor": { tremor: { freqHz: 5, amplitudeCm: 0.15, axisDeg: 45 } },
  "fast-tremor": { tremor: { freqHz: 9, amplitudeCm: 0.15, axisDeg: 45 } },
  "shrinking-and-slowing": { loopSpacingCm: 1.0, loopSpacingEndCm: 0.5, endSpeedRatio: 0.5 },
  // Each of these changes one thing from the baseline, for checking the analysis.
  tight: { loops: 6, loopSpacingCm: 0.5 },
  wide: { loops: 3, loopSpacingCm: 1.2 },
  fast: { durationS: 4 },
  slow: { durationS: 16 },
  clockwise: { direction: "cw" },
  "start-at-top": { startAngleDeg: 90 },
  "constant-turn-rate": { speedProfile: "constant-turn-rate" },
  "tremor-5hz-1mm": { tremor: { freqHz: 5, amplitudeCm: 0.1, axisDeg: 45 } },
  "tremor-5hz-3mm": { tremor: { freqHz: 5, amplitudeCm: 0.3, axisDeg: 45 } },
  "tremor-9hz-1mm": { tremor: { freqHz: 9, amplitudeCm: 0.1, axisDeg: 45 } },
  "tremor-6hz-horizontal": { tremor: { freqHz: 6, amplitudeCm: 0.15, axisDeg: 0 } },
  "tremor-6hz-vertical": { tremor: { freqHz: 6, amplitudeCm: 0.15, axisDeg: 90 } },
  "hand-noise": { noiseCm: 0.02 },
  "no-pressure": { pressure: { constant: 500 } },
  "sampled-60hz": { sampleHz: 60 },
  "sampled-240hz": { sampleHz: 240 },
  "uneven-timing": { timingJitterMs: 2 },
  "other-device-ppi": { cssPpi: 137 },
  "shrinking-spacing": { loopSpacingCm: 1.0, loopSpacingEndCm: 0.5 },
  "slowing-down": { endSpeedRatio: 0.5 },
};

// The same spiral with fresh noise each time: a stable metric should barely move.
export function stabilitySet(base = { noiseCm: 0.01 }, repeats = 5) {
  return Array.from({ length: repeats }, (_, i) => ({
    name: `repeat-${i + 1}`,
    options: { ...base, seed: 100 + i },
  }));
}
