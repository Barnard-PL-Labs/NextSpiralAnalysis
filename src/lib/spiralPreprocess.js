// Turns the raw points saved in drawings.drawing_data into the payload the
// spiral backend expects. Shared by the drawing page (in the browser) and the
// batch API (on the server) so both send the backend exactly the same numbers;
// a copy that drifts is how compare_pre_post.py ended up scaling differently
// from the app.

// MATLAB needs strictly increasing integer timestamps. Points that share a
// millisecond are averaged into one, points that go back in time are dropped,
// and time is rebased to start at 0.
export function cleanPointsForMatlabTimestamps(points) {
  const merged = [];

  for (const point of points) {
    const t = Math.max(0, Math.round(Number(point.t) || 0));
    const x = Number(point.x);
    const y = Number(point.y);
    const p = Math.round(Number(point.p) || 0);

    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const previous = merged[merged.length - 1];

    if (previous && t === previous.t) {
      const count = previous.__mergeCount + 1;
      previous.x = previous.x + (x - previous.x) / count;
      previous.y = previous.y + (y - previous.y) / count;
      previous.p = Math.round(previous.p + (p - previous.p) / count);
      previous.__mergeCount = count;
      continue;
    }

    if (previous && t < previous.t) continue;

    merged.push({ ...point, x, y, p, t, __mergeCount: 1 });
  }

  const firstT = merged[0]?.t ?? 0;
  return merged.map(({ __mergeCount, ...point }, index) => ({
    ...point,
    n: index + 1,
    t: point.t - firstT,
    x: +point.x.toFixed(4),
    y: +point.y.toFixed(4),
  }));
}

// Scale x/y from CSS pixels to digitizer units (200 units = 1 inch),
// pre-divided by 8 to compensate for dataconvert.m's hardcoded *8 factor
// (a legacy Wacom tablet calibration that inflates all coordinates 8x).
// After dataconvert multiplies by 8, effective scale = 200/cssPpi as intended.
// y-center is 150 (= 1200/8) so after x8 it maps to 1200, the center of
// MATLAB's hardcoded 2400-unit canvas height used in the y-flip (y2 = 2400 - y).
export function scaleForMatlab(points, cssPpi) {
  const scale = 200 / cssPpi / 8;
  const firstY = points[0].y;
  return points.map((pt) => ({
    ...pt,
    x: +(pt.x * scale).toFixed(4),
    y: +((pt.y - firstY) * scale + 150).toFixed(4),
  }));
}

export const MIN_ANALYSIS_POINTS = 3;

// cssPpi = device PPI / devicePixelRatio, i.e. CSS pixels per inch on the
// device the spiral was drawn on (stored as drawings.css_ppi).
export function prepareDrawData(points, cssPpi) {
  if (!Array.isArray(points)) throw new Error("Drawing has no point data");
  if (!(Number(cssPpi) > 0)) throw new Error("A positive cssPpi is required to scale the drawing");
  const cleaned = cleanPointsForMatlabTimestamps(points);
  if (cleaned.length < MIN_ANALYSIS_POINTS) {
    throw new Error("Drawing does not have enough valid timed points for analysis");
  }
  return scaleForMatlab(cleaned, Number(cssPpi));
}
