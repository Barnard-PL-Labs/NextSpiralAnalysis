import { SPIRAL_PRESETS, generateSpiral, stabilitySet } from "./syntheticSpiral";

const pxPerCm = (cssPpi) => cssPpi / 2.54;

// Back from screen pixels to cm around the centre, y up.
function toCm(spiral) {
  const k = pxPerCm(spiral.cssPpi);
  const c = (spiral.options.canvasCm * k) / 2;
  return spiral.points.map((pt) => ({ x: (pt.x - c) / k, y: (c - pt.y) / k, t: pt.t }));
}

describe("generateSpiral", () => {
  it("produces points in the canvas format with rising timestamps", () => {
    const { points } = generateSpiral();
    expect(points.length).toBeGreaterThan(900); // 8 s at 120 Hz
    points.forEach((pt, i) => {
      expect(Object.keys(pt)).toEqual(["n", "x", "y", "p", "t"]);
      expect(pt.n).toBe(i + 1);
      if (i) expect(pt.t).toBeGreaterThan(points[i - 1].t);
    });
    expect(points[0].t).toBe(0);
  });

  it("stays on the 10 cm canvas", () => {
    for (const options of Object.values(SPIRAL_PRESETS)) {
      const s = generateSpiral(options);
      const size = s.options.canvasCm * pxPerCm(s.cssPpi);
      s.points.forEach((pt) => {
        expect(pt.x).toBeGreaterThanOrEqual(0);
        expect(pt.x).toBeLessThanOrEqual(size);
        expect(pt.y).toBeGreaterThanOrEqual(0);
        expect(pt.y).toBeLessThanOrEqual(size);
      });
    }
  });

  it("still draws a spiral too big for the canvas, and says it does not fit", () => {
    const big = generateSpiral({ loops: 10, loopSpacingCm: 1 });
    expect(big.truth.fitsCanvas).toBe(false);
    expect(big.truth.reachCm).toBeCloseTo(10.2, 9);
    const size = big.options.canvasCm * pxPerCm(big.cssPpi);
    expect(big.points.some((p) => p.x < 0 || p.x > size || p.y < 0 || p.y > size)).toBe(true);
    expect(generateSpiral().truth.fitsCanvas).toBe(true);
    expect(generateSpiral().truth.reachCm).toBeCloseTo(3.4, 9);
  });

  it("rejects negative sizes", () => {
    expect(() => generateSpiral({ startRadiusCm: -1 })).toThrow(/negative/);
  });

  it("puts neighbouring loops exactly loopSpacingCm apart", () => {
    const s = generateSpiral({ loops: 4, loopSpacingCm: 0.7, sampleHz: 1000 });
    const pts = toCm(s);
    // Radius each time the pen crosses the positive x axis going up.
    const crossings = [];
    for (let i = 1; i < pts.length; i += 1) {
      if (pts[i - 1].y < 0 && pts[i].y >= 0 && pts[i].x > 0) crossings.push(Math.hypot(pts[i].x, pts[i].y));
    }
    expect(crossings.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < crossings.length; i += 1) {
      expect(crossings[i] - crossings[i - 1]).toBeCloseTo(0.7, 2);
    }
  });

  it("changes the spacing steadily from the first loop to the last", () => {
    const s = generateSpiral({ loops: 4, loopSpacingCm: 1.0, loopSpacingEndCm: 0.5, sampleHz: 1000 });
    const pts = toCm(s);
    const crossings = [];
    for (let i = 1; i < pts.length; i += 1) {
      if (pts[i - 1].y < 0 && pts[i].y >= 0 && pts[i].x > 0) crossings.push(Math.hypot(pts[i].x, pts[i].y));
    }
    const gaps = crossings.slice(1).map((r, i) => r - crossings[i]);
    // Each gap is narrower than the one inside it.
    gaps.slice(1).forEach((g, i) => expect(g).toBeLessThan(gaps[i]));
    expect(gaps[0]).toBeGreaterThan(0.75);
    expect(gaps[gaps.length - 1]).toBeLessThan(0.75);
    expect(s.truth).toMatchObject({ loopSpacingCm: 0.75, loopSpacingStartCm: 1.0, loopSpacingEndCm: 0.5 });
  });

  it("changes pen speed from start to end by endSpeedRatio", () => {
    const pts = toCm(generateSpiral({ endSpeedRatio: 0.5, sampleHz: 100 }));
    const step = (i) => Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    const first = (step(1) + step(2) + step(3)) / 3;
    const n = pts.length - 2;
    const last = (step(n - 1) + step(n - 2) + step(n - 3)) / 3;
    expect(last / first).toBeCloseTo(0.5, 1);
  });

  it("turns the way it is told to, as seen on screen", () => {
    const turn = (direction) => {
      const pts = toCm(generateSpiral({ direction }));
      let cross = 0;
      for (let i = 1; i < pts.length; i += 1) cross += pts[i - 1].x * pts[i].y - pts[i - 1].y * pts[i].x;
      return Math.sign(cross);
    };
    expect(turn("ccw")).toBe(1);
    expect(turn("cw")).toBe(-1);
  });

  it("moves the pen at a steady speed by default", () => {
    const pts = toCm(generateSpiral({ sampleHz: 100 }));
    const steps = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
    const mean = steps.reduce((a, b) => a + b, 0) / steps.length;
    steps.forEach((d) => expect(Math.abs(d - mean) / mean).toBeLessThan(0.05));
  });

  it("adds tremor at the requested frequency, size and direction", () => {
    const base = { sampleHz: 500, seed: 7 };
    const tremor = { freqHz: 6, amplitudeCm: 0.2, axisDeg: 90 };
    const clean = toCm(generateSpiral(base));
    const shaky = toCm(generateSpiral({ ...base, tremor }));
    const dx = shaky.map((p, i) => p.x - clean[i].x);
    const dy = shaky.map((p, i) => p.y - clean[i].y);

    // All of it along the vertical axis.
    expect(Math.max(...dx.map(Math.abs))).toBeLessThan(0.001);
    expect(Math.max(...dy)).toBeCloseTo(0.2, 2);

    // Zero crossings of the offset: two per cycle.
    let crossings = 0;
    for (let i = 1; i < dy.length; i += 1) if (Math.sign(dy[i]) !== Math.sign(dy[i - 1])) crossings += 1;
    const seconds = shaky[shaky.length - 1].t / 1000;
    expect(crossings / 2 / seconds).toBeCloseTo(6, 0);
  });

  it("holds pressure constant when asked, as a device without a stylus would", () => {
    const { points } = generateSpiral(SPIRAL_PRESETS["no-pressure"]);
    expect(new Set(points.map((p) => p.p))).toEqual(new Set([500]));
  });

  it("gives the same spiral for the same seed and a different one for another seed", () => {
    expect(generateSpiral({ noiseCm: 0.02, seed: 3 }).points).toEqual(generateSpiral({ noiseCm: 0.02, seed: 3 }).points);
    expect(generateSpiral({ noiseCm: 0.02, seed: 3 }).points).not.toEqual(generateSpiral({ noiseCm: 0.02, seed: 4 }).points);
  });
});

describe("stabilitySet", () => {
  it("varies only the seed", () => {
    const set = stabilitySet({ noiseCm: 0.01 }, 3);
    expect(set.map((s) => s.options.seed)).toEqual([100, 101, 102]);
    expect(set.every((s) => s.options.noiseCm === 0.01)).toBe(true);
  });
});

describe("truth speeds", () => {
  it("match the spiral's own speed without tremor and exceed it with tremor", () => {
    const plain = generateSpiral().truth;
    expect(plain.meanSpeedCmPerS).toBeCloseTo(plain.pathSpeedCmPerS, 1);
    const shaky = generateSpiral({ tremor: { freqHz: 5, amplitudeCm: 0.3, axisDeg: 45 } }).truth;
    expect(shaky.pathSpeedCmPerS).toBeCloseTo(plain.pathSpeedCmPerS, 5);
    expect(shaky.meanSpeedCmPerS).toBeGreaterThan(plain.meanSpeedCmPerS * 1.3);
  });
});
