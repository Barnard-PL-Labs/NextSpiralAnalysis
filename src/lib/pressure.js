// Detects drawings whose pressure channel carries no usable signal.
//
// A device that cannot sense pressure still produces a `p` value for every
// point -- it is simply constant. Canvas.jsx substitutes 0.5 (stored as 500)
// when the pointer event reports nothing, but that is not the only constant
// seen in practice: as of 2026-10-20 the stored corpus held 461 drawings flat
// at 500, 115 flat at 0, and one flat at 1000.
//
// This used to test specifically for ~500, so the 116 drawings pinned at other
// constants were treated as having valid pressure. What matters is not which
// constant it is but that it never varies, so test for that instead.

const FLAT_TOLERANCE = 5;      // counts as "the same value" either side of the centre
const FLAT_SHARE = 0.9;        // share of points that must sit inside that band
const MIN_POINTS = 10;         // too few points to judge

export function isFallbackPressureDrawing(drawing) {
  if (!Array.isArray(drawing)) return false;

  const pressures = drawing
    .map((point) => Number(point?.p))
    .filter((pressure) => Number.isFinite(pressure));

  if (pressures.length < MIN_POINTS) return false;

  // Centre on the median rather than a fixed value, so any constant is caught.
  const sorted = [...pressures].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  const nearMedian = pressures.filter(
    (pressure) => Math.abs(pressure - median) <= FLAT_TOLERANCE
  ).length;

  return nearMedian / pressures.length >= FLAT_SHARE;
}

export default isFallbackPressureDrawing;
