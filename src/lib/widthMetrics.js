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
  const y3 = y.map((v, i) => (v - y[0]) * PHYS_SCALE);

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
  let pickBegin = 0;
  for (let j = 20; j < d - 1; j++) {
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

  const angs = [], rads = [];
  let prevEnd = 0;

  for (let n = 1; n <= numCycles; n++) {
    const sub = anglesAdj.slice(prevEnd);
    const limit = 2 * n * Math.PI;
    let lastValid = -1;
    for (let i = 0; i < sub.length; i++) {
      if (sub[i] < limit) lastValid = i;
    }
    if (lastValid === -1) break;

    const lastPos = sub.length - lastValid;
    const endIdx = prevEnd + sub.length - (lastPos - 1);
    const rIdx = Array.from({ length: endIdx - prevEnd }, (_, i) => prevEnd + i);

    angs.push(rIdx.map(i => anglesAdj[i] - 2 * (n - 1) * Math.PI));
    rads.push(rIdx.map(i => radius[i]));
    prevEnd = endIdx;
  }

  if (angs.length < 2) return { ...empty, spiralDir };

  // Unique values from first loop (maintaining order — data is monotone)
  const seenFirst = new Set();
  const ang0 = [], rad0 = [];
  for (let i = 0; i < angs[0].length; i++) {
    const a = angs[0][i];
    if (!seenFirst.has(a)) { seenFirst.add(a); ang0.push(a); rad0.push(rads[0][i]); }
  }

  const allWidths = [];
  const widthRows = [];

  for (let i = 1; i < angs.length; i++) {
    const seenN = new Set();
    const angN = [], radN = [];
    for (let j = 0; j < angs[i].length; j++) {
      const a = angs[i][j];
      if (!seenN.has(a)) { seenN.add(a); angN.push(a); radN.push(rads[i][j]); }
    }
    const inter = interpArr(ang0, angN, radN);
    const w = ang0.map((_, j) => inter[j] - rad0[j]);
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
    const cut = cutAuto(seg.x, seg.y, x1tmp, y1tmp);

    const x1 = cut.x.map(v => (v - xo) * PHYS_SCALE);
    const y1 = cut.y.map(v => (v - yo) * PHYS_SCALE);
    const r = x1.map((v, i) => Math.hypot(v, y1[i]));
    const c = unwrap(x1.map((v, i) => Math.atan2(y1[i], v)));

    const wd = compWidths(c, r);

    if (wd.numCycles < 2 || wd.ang0.length === 0) {
      return {
        "overall average of widths": 0,
        "std of widths.": 0,
        "COV of width": 0,
        "1st quad average median": 0,
        "2nd quad average median": 0,
        "3rd quad average median": 0,
        "4th quad average median": 0,
      };
    }

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
