import { cleanPointsForMatlabTimestamps, prepareDrawData, scaleForMatlab } from "./spiralPreprocess";

describe("cleanPointsForMatlabTimestamps", () => {
  it("averages points that share a millisecond and renumbers from 1", () => {
    const out = cleanPointsForMatlabTimestamps([
      { x: 0, y: 0, p: 100, t: 1000 },
      { x: 2, y: 4, p: 200, t: 1000 },
      { x: 5, y: 5, p: 300, t: 1010 },
    ]);
    expect(out).toEqual([
      { x: 1, y: 2, p: 150, t: 0, n: 1 },
      { x: 5, y: 5, p: 300, t: 10, n: 2 },
    ]);
  });

  it("drops points that go back in time or have no coordinates", () => {
    const out = cleanPointsForMatlabTimestamps([
      { x: 0, y: 0, p: 1, t: 10 },
      { x: 1, y: 1, p: 1, t: 5 },
      { x: "nope", y: 1, p: 1, t: 20 },
      { x: 2, y: 2, p: 1, t: 30 },
    ]);
    expect(out.map((p) => p.t)).toEqual([0, 20]);
  });
});

describe("scaleForMatlab", () => {
  it("scales to digitizer units / 8 and centres the first point at y = 150", () => {
    // cssPpi 25 -> scale = 200 / 25 / 8 = 1
    const out = scaleForMatlab([{ x: 10, y: 40 }, { x: 20, y: 50 }], 25);
    expect(out).toEqual([{ x: 10, y: 150 }, { x: 20, y: 160 }]);
  });
});

describe("prepareDrawData", () => {
  it("matches what the drawing page used to compute inline", () => {
    const raw = Array.from({ length: 50 }, (_, i) => ({
      x: 100 + 30 * Math.cos(i / 5),
      y: 200 + 30 * Math.sin(i / 5),
      p: 400 + i,
      t: 5000 + i * 8,
    }));
    const cssPpi = 264 / 2;
    const scale = 200 / cssPpi / 8;
    const cleaned = cleanPointsForMatlabTimestamps(raw);
    const expected = cleaned.map((pt) => ({
      ...pt,
      x: +(pt.x * scale).toFixed(4),
      y: +((pt.y - cleaned[0].y) * scale + 150).toFixed(4),
    }));
    expect(prepareDrawData(raw, cssPpi)).toEqual(expected);
  });

  it("rejects drawings with too few usable points", () => {
    expect(() => prepareDrawData([{ x: 1, y: 1, p: 1, t: 1 }], 132)).toThrow(/enough valid timed points/);
  });

  it("rejects a missing or non-positive cssPpi", () => {
    expect(() => prepareDrawData([], 0)).toThrow(/cssPpi/);
  });
});
