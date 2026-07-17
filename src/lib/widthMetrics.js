/**
 * JavaScript port of width_metrics.py.
 *
 * Takes the same scaled drawData payload ([{n, x, y, p, t}, ...]) used by the
 * MATLAB backend and computes the 7 inter-loop width metrics.  Called from the
 * /api/analyze route so the values are available regardless of MATLAB backend
 * state.
 */

const TWO_PI = 2 * Math.PI;
const PHYS_SCALE = 2.54 / 200.0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function linInterp(xq, xp, fp) {
  if (xq <= xp[0]) return fp[0];
  if (xq >= xp[xp.length - 1]) return fp[fp.length - 1];
  let lo = 0, hi = xp.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xp[mid] <= xq) lo = mid; else hi = mid;
  }
  const t = (xq - xp[lo]) / (xp[hi] - xp[lo]);
  return fp[lo] + t * (fp[hi] - fp[lo]);
}

function interpArr(xq, xp, fp) {
  return xq.map(x => linInterp(x, xp, fp));
}

function unwrap(angles) {
  const out = [...angles];
  for (let i = 1; i < out.length; i++) {
    let diff = out[i] - out[i - 1];
    while (diff > Math.PI) diff -= TWO_PI;
    while (diff < -Math.PI) diff += TWO_PI;
    out[i] = out[i - 1] + diff;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Preprocessing (port of _quload, _data_analy, _find_origin, _cut_auto)
// ---------------------------------------------------------------------------

function quload(raw) {
  const ns = raw.map(r => r[0]);
  const xs = raw.map(r => r[1]);
  const ys = raw.map(r => r[2]);
  const ps = raw.map(r => r[3]);
  const ts = raw.map(r => r[4]);

  const sampleRate = ns[ns.length - 1] / ts[ts.length - 1] * 1000.0;
  const t_src = ns.map(n => (n - 1.0) / sampleRate * 1000.0);

  const duration_sec = (t_src[t_src.length - 1] - t_src[0]) / 1000.0;
  const num_points = Math.floor(duration_sec / (1.0 / sampleRate));

  const nn = Array.from({ length: num_points - 1 }, (_, i) => i + 1);
  const nt = nn.map(n => n * 1000.0 / sampleRate);

  return {
    x: interpArr(nt, t_src, xs).map(v => v * 8.0),
    y: interpArr(nt, t_src, ys).map(v => v * 8.0),
    p: interpArr(nt, t_src, ps).map(v => v / 256.0),
    t: nn,
  };
}

function dataAnaly(x, y, p, t) {
  const s = x.length;
  let penDown = null;
  for (let k = 0; k < s; k++) {
    if (p[k] > 1e-10) { penDown = k; break; }
  }
  if (penDown === null) throw new Error("No pen-down samples found");

  let d1 = 0, mFlag = 1;
  for (let k = penDown + 1; k < s; k++) {
    if ((p[k] === 0 && mFlag === 1) || k === s - 1) { mFlag = 0; d1 = k; }
    if (p[k] > 0) mFlag = 1;
  }

  const d = d1 - penDown + 1;
  return {
    x: x.slice(penDown, penDown + d),
    y: y.slice(penDown, penDown + d).map(v => 2400.0 - v),
    p: p.slice(penDown, penDown + d),
    t: t.slice(penDown, penDown + d).map(v => v - t[penDown]),
  };
}

function findOrigin(x, y) {
  const d = x.length;
  const x3 = x.map(v => (v - x[0]) * PHYS_SCALE);
  const y3 = y.map(v => (v - y[0]) * PHYS_SCALE);

  let c = x3.map((v, i) => Math.atan2(y3[i], v));

  for (let k = 1; k < d; k++) {
    if (c[k - 1] > 2 && c[k] < 0) while (Math.abs(c[k] - c[k - 1]) > Math.PI) c[k] += TWO_PI;
    if (c[k - 1] < -2 && c[k] > 0) while (Math.abs(c[k] - c[k - 1]) > Math.PI) c[k] -= TWO_PI;
  }
  for (let k = 1; k < d; k++) {
    if (Math.abs(c[k] - c[k - 1]) > 5) {
      if (Math.abs(c[k] - c[k - 1] + TWO_PI) < Math.abs(c[k] - c[k - 1]))
        for (let j = k; j < d; j++) c[j] += TWO_PI;
      if (Math.abs(c[k] - c[k - 1] - TWO_PI) < Math.abs(c[k] - c[k - 1]))
        for (let j = k; j < d; j++) c[j] -= TWO_PI;
    }
  }

  const meanC = c.reduce((a, b) => a + b, 0) / c.length;
  let cutoff, oneLoopIdx = -1;

  if (meanC < 0) {
    cutoff = Math.max(...c.slice(1));
    for (let k = 0; k < d; k++) {
      if (cutoff - c[k] > 1.5 * Math.PI) { oneLoopIdx = k; break; }
    }
  } else {
    cutoff = Math.min(...c.slice(1));
    for (let k = 0; k < d; k++) {
      if (cutoff - c[k] < -1.5 * Math.PI) { oneLoopIdx = k; break; }
    }
  }

  if (oneLoopIdx === -1) return { xo: x[0], yo: y[0] };

  const xSub = x.slice(0, oneLoopIdx + 1);
  const ySub = y.slice(0, oneLoopIdx + 1);
  return {
    xo: (Math.min(...xSub) + Math.max(...xSub)) / 2.0,
    yo: (Math.min(...ySub) + Math.max(...ySub)) / 2.0,
  };
}

function cutAuto(x, y, x1tmp, y1tmp) {
  const d = y1tmp.length;

  // Find where the first full revolution completes so tight inner loops are excluded.
  const rawAng = x1tmp.map((v, i) => Math.atan2(y1tmp[i], v));
  const ang = unwrap(rawAng);
  const startAng = ang[0];
  // Skip enough inner loops to avoid tight-center artifact, but always keep ≥2 for measurement.
  const totalLoops = Math.abs(ang[d - 1] - startAng) / TWO_PI;
  const loopsToSkip = Math.max(0, Math.min(2, Math.floor(totalLoops) - 2));
  let oneLoopEnd = Math.min(20, d - 2);
  if (loopsToSkip > 0) {
    for (let j = 1; j < d; j++) {
      if (Math.abs(ang[j] - startAng) >= loopsToSkip * TWO_PI) { oneLoopEnd = j; break; }
    }
  }

  let pickBegin = 0;
  for (let j = oneLoopEnd; j < d - 1; j++) {
    if ((y1tmp[j] > 0 && y1tmp[j + 1] <= 0) || (y1tmp[j] < 0 && y1tmp[j + 1] >= 0)) {
      pickBegin = j; break;
    }
  }
  let pickEnd = d - 1;
  for (let j = d - 10; j > 9; j--) {
    if ((y1tmp[j] >= 0 && y1tmp[j - 1] < 0) || (y1tmp[j] < 0 && y1tmp[j - 1] >= 0)) {
      pickEnd = j; break;
    }
  }
  if (pickEnd - pickBegin < 0.05 * d) { pickBegin = 0; pickEnd = d - 1; }
  return { x: x.slice(pickBegin, pickEnd + 1), y: y.slice(pickBegin, pickEnd + 1) };
}

// ---------------------------------------------------------------------------
// Width computation (port of _comp_widths)
// ---------------------------------------------------------------------------

function compWidths(angles, radius) {
  const startAng = angles[0];
  const endAng = angles[angles.length - 1];
  const numCycles = Math.floor(Math.abs(endAng - startAng) / TWO_PI);

  const empty = { ave: 0, stdDev: 0, ang0: [], medP: [], numCycles, startAng, spiralDir: 0 };
  if (numCycles < 2) return empty;

  const spiralDir = Math.sign(endAng - startAng);
  const anglesAdj = angles.map(a => (a - startAng) * spiralDir);

  const loopAngs = [], loopRads = [];
  let prevEnd = 0;

  for (let n = 1; n <= numCycles; n++) {
    const sub = anglesAdj.slice(prevEnd);
    const limit = 2 * n * Math.PI;
    let lastValid = -1;
    for (let i = 0; i < sub.length; i++) {
      if (sub[i] < limit) lastValid = i;
    }
    if (lastValid === -1) break;

    const endIdx = prevEnd + lastValid + 1;
    const rIdx = Array.from({ length: endIdx - prevEnd }, (_, i) => prevEnd + i);

    loopAngs.push(rIdx.map(j => anglesAdj[j] - 2 * (n - 1) * Math.PI));
    loopRads.push(rIdx.map(j => radius[j]));
    prevEnd = endIdx;
  }

  if (loopAngs.length < 2) return { ...empty, spiralDir };

  // Fixed 5-degree grid matching MATLAB's sampling interval
  const STEP_DEG = 5;
  const ang0 = Array.from({ length: Math.floor(360 / STEP_DEG) }, (_, i) => i * STEP_DEG * Math.PI / 180);

  // Interpolate every loop onto the fixed 5-degree grid
  const interpedRads = loopAngs.map((la, i) => {
    const seen = new Set();
    const ua = [], ur = [];
    for (let j = 0; j < la.length; j++) {
      const k = Math.round(la[j] * 1e9);
      if (!seen.has(k)) { seen.add(k); ua.push(la[j]); ur.push(loopRads[i][j]); }
    }
    return interpArr(ang0, ua, ur);
  });

  const allWidths = [];
  const widthRows = [];
  for (let i = 1; i < interpedRads.length; i++) {
    const w = ang0.map((_, j) => interpedRads[i][j] - interpedRads[i - 1][j]);
    widthRows.push(w);
    allWidths.push(...w);
  }

  // Median per column
  const medP = ang0.map((_, j) => {
    const col = widthRows.map(row => row[j]).sort((a, b) => a - b);
    const mid = col.length >> 1;
    return col.length % 2 === 0 ? (col[mid - 1] + col[mid]) / 2 : col[mid];
  });

  const ave = allWidths.reduce((a, b) => a + b, 0) / allWidths.length;
  const stdDev = Math.sqrt(
    allWidths.map(v => (v - ave) ** 2).reduce((a, b) => a + b, 0) / allWidths.length
  );

  return { ave, stdDev, ang0, medP, numCycles, startAng, spiralDir };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function computeWidthMetrics(drawData) {
  try {
    const raw = drawData.map(pt => [pt.n, pt.x, pt.y, pt.p, pt.t]);

    const ql = quload(raw);
    const seg = dataAnaly(ql.x, ql.y, ql.p, ql.t);
    const { xo, yo } = findOrigin(seg.x, seg.y);

    const x1tmp = seg.x.map(v => (v - xo) * PHYS_SCALE);
    const y1tmp = seg.y.map(v => (v - yo) * PHYS_SCALE);

    // Try with adaptive inner-loop trimming first; fall back to no trimming if
    // too few cycles remain (common for very irregular or short spirals).
    let cut = cutAuto(seg.x, seg.y, x1tmp, y1tmp);
    let x1 = cut.x.map(v => (v - xo) * PHYS_SCALE);
    let y1 = cut.y.map(v => (v - yo) * PHYS_SCALE);
    let r  = x1.map((v, i) => Math.hypot(v, y1[i]));
    let c  = unwrap(x1.map((v, i) => Math.atan2(y1[i], v)));
    let wd = compWidths(c, r);

    if (wd.numCycles < 2) {
      x1 = seg.x.map(v => (v - xo) * PHYS_SCALE);
      y1 = seg.y.map(v => (v - yo) * PHYS_SCALE);
      r  = x1.map((v, i) => Math.hypot(v, y1[i]));
      c  = unwrap(x1.map((v, i) => Math.atan2(y1[i], v)));
      wd = compWidths(c, r);
    }

    if (wd.numCycles < 2 || wd.ang0.length === 0) return null;

    const { ave, stdDev, ang0, medP, spiralDir, startAng } = wd;
    const ang = ang0.map(a => ((a * spiralDir + startAng) % TWO_PI + TWO_PI) % TWO_PI);

    const quadMasks = [
      ang.map(a => a >= 0 && a < Math.PI / 2),
      ang.map(a => a >= Math.PI / 2 && a < Math.PI),
      ang.map(a => a >= Math.PI && a < 1.5 * Math.PI),
      ang.map(a => a >= 1.5 * Math.PI && a < TWO_PI),
    ];
    const quadAvgs = quadMasks.map(mask => {
      const vals = medP.filter((_, i) => mask[i]);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    });

    return {
      "overall average of widths": ave,
      "std of widths.": stdDev,
      "COV of width": ave !== 0 ? Math.abs(stdDev / ave) : 0,
      "1st quad average median": quadAvgs[0],
      "2nd quad average median": quadAvgs[1],
      "3rd quad average median": quadAvgs[2],
      "4th quad average median": quadAvgs[3],
    };
  } catch (e) {
    console.error("widthMetrics.js error:", e.message);
    return null;
  }
}
