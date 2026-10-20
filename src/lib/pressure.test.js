import { isFallbackPressureDrawing } from "./pressure";

const flat = (value, n = 200) => Array.from({ length: n }, () => ({ p: value }));

// Mirrors the shape of a real stylus trace: pressure ramps up and down across
// the stroke, spanning a few hundred units of the 0-1000 scale.
const varying = (n = 200) =>
  Array.from({ length: n }, (_, i) => ({
    p: Math.round(300 + 300 * Math.sin((i / n) * Math.PI * 2)),
  }));

describe("isFallbackPressureDrawing", () => {
  it("flags the 500 default used when a device reports no pressure", () => {
    expect(isFallbackPressureDrawing(flat(500))).toBe(true);
  });

  // These are the cases the previous ~500-only check missed: 115 drawings in
  // the stored corpus sit flat at 0, and one at 1000.
  it("flags a drawing pinned at 0", () => {
    expect(isFallbackPressureDrawing(flat(0))).toBe(true);
  });

  it("flags a drawing pinned at 1000", () => {
    expect(isFallbackPressureDrawing(flat(1000))).toBe(true);
  });

  it("flags any other constant", () => {
    expect(isFallbackPressureDrawing(flat(742))).toBe(true);
  });

  it("tolerates the small jitter a flat channel can still show", () => {
    const jittery = Array.from({ length: 200 }, (_, i) => ({ p: 500 + (i % 3) - 1 }));
    expect(isFallbackPressureDrawing(jittery)).toBe(true);
  });

  it("does not flag a genuinely varying trace", () => {
    expect(isFallbackPressureDrawing(varying())).toBe(false);
  });

  it("does not flag a varying trace that happens to centre on 500", () => {
    const centred = Array.from({ length: 200 }, (_, i) => ({
      p: Math.round(500 + 200 * Math.sin((i / 200) * Math.PI * 2)),
    }));
    expect(isFallbackPressureDrawing(centred)).toBe(false);
  });

  it("declines to judge a drawing with too few points", () => {
    expect(isFallbackPressureDrawing(flat(500, 5))).toBe(false);
  });

  it("handles junk input", () => {
    expect(isFallbackPressureDrawing(null)).toBe(false);
    expect(isFallbackPressureDrawing([])).toBe(false);
    expect(isFallbackPressureDrawing([{ p: "x" }, { p: null }])).toBe(false);
  });
});
