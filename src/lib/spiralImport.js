// Read spiral drawings out of JSON files whose layout we don't control. One
// file can hold one drawing or many; every drawing comes out as
//   { name, points: [{ n, x, y, p, t }], cssPpi, notes: [], error }
// in the same shape the drawing page saves, ready for prepareDrawData().
//
// Recognised layouts (see SUPPORTED_FORMATS for the user-facing list):
//   * an array of points: [{x, y, p, t}, ...] (field names are flexible)
//   * an array of rows:   [[x, y, p, t], ...] or [[n, x, y, p, t], ...]
//   * columns:            {x: [...], y: [...], p: [...], t: [...]}
//   * an object holding one of the above under points / drawing_data /
//     drawData / data / samples / coordinates, with cssPpi / css_ppi beside it
//   * strokes:            {strokes: [[points], [points]]} (joined into one)
//   * many drawings:      an array of the above, a Supabase drawings export,
//                         a spiral lab batch download ({spirals: [...]}), or
//                         {drawings | items: [...]}
//   * JSON Lines:         one drawing per line

export const SUPPORTED_FORMATS = [
  "Array of points: [{\"x\":…, \"y\":…, \"p\":…, \"t\":…}] (also X/Y, pressure, time/timestamp)",
  "Array of rows: [[x, y, p, t], …] or [[n, x, y, p, t], …]",
  "Columns: {\"x\": […], \"y\": […], \"p\": […], \"t\": […]}",
  "An object with the points under points, drawing_data, drawData, data, samples or coordinates (cssPpi / css_ppi read if present)",
  "Strokes: {\"strokes\": [[points], [points]]}, joined into one drawing",
  "Many drawings in one file: an array of any of the above, a Supabase drawings export, a spiral lab batch download, or JSON Lines (one per line)",
];

const X_KEYS = ["x", "X", "posX", "pos_x"];
const Y_KEYS = ["y", "Y", "posY", "pos_y"];
const P_KEYS = ["p", "P", "pressure", "force"];
const T_KEYS = ["t", "T", "time", "timestamp", "timeStamp", "ms", "time_ms"];
const POINT_HOLDERS = ["points", "drawing_data", "drawingData", "drawData", "draw_data", "data", "samples", "coordinates"];
const MANY_HOLDERS = ["spirals", "drawings", "items", "results", "records"];
const NAME_KEYS = ["name", "ref", "label", "id", "type"];

// Sample rate assumed when a file has no timestamps (the drawing page records ~120 Hz).
export const ASSUMED_SAMPLE_HZ = 120;
// Fewer points than this and the drawing page itself refuses to save.
const FEW_POINTS = 150;

function pick(obj, keys) {
  for (const k of keys) if (obj[k] !== undefined) return obj[k];
  return undefined;
}

function isNum(v) {
  return v !== null && v !== "" && Number.isFinite(Number(v));
}

function looksLikePointObject(v) {
  return v && typeof v === "object" && !Array.isArray(v) && isNum(pick(v, X_KEYS)) && isNum(pick(v, Y_KEYS));
}

function looksLikeRow(v) {
  return Array.isArray(v) && v.length >= 2 && v.length <= 6 && v.every(isNum);
}

function looksLikePointArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  const sample = arr.slice(0, 5);
  return sample.every(looksLikePointObject) || sample.every(looksLikeRow);
}

function looksLikeColumns(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  const xs = pick(obj, X_KEYS);
  const ys = pick(obj, Y_KEYS);
  return Array.isArray(xs) && Array.isArray(ys) && xs.length === ys.length && xs.length > 0;
}

function cssPpiOf(obj) {
  if (!obj || typeof obj !== "object") return null;
  const direct = obj.cssPpi ?? obj.css_ppi ?? obj.cssPPI;
  if (isNum(direct) && Number(direct) > 0) return Number(direct);
  // A device PPI with its devicePixelRatio gives CSS pixels per inch.
  const ppi = obj.ppi ?? obj.devicePpi;
  const dpr = obj.devicePixelRatio ?? obj.dpr;
  if (isNum(ppi) && isNum(dpr) && Number(dpr) > 0) return Number(ppi) / Number(dpr);
  return null;
}

function nameOf(obj, fallback) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return fallback;
  const name = pick(obj, NAME_KEYS);
  if (typeof name === "string" && name.trim()) return obj.copy != null ? `${name} #${obj.copy}` : name.trim();
  if (typeof name === "number") return String(name);
  return fallback;
}

// Raw values -> [{x, y, p?, t?}] plus what had to be assumed.
function rawPoints(value) {
  if (looksLikeColumns(value)) {
    const xs = pick(value, X_KEYS);
    const ys = pick(value, Y_KEYS);
    const ps = pick(value, P_KEYS);
    const ts = pick(value, T_KEYS);
    return xs.map((x, i) => ({ x, y: ys[i], p: Array.isArray(ps) ? ps[i] : undefined, t: Array.isArray(ts) ? ts[i] : undefined }));
  }
  if (!Array.isArray(value)) return null;
  if (value.slice(0, 5).every(looksLikePointObject)) {
    return value.filter(looksLikePointObject).map((o) => ({ x: pick(o, X_KEYS), y: pick(o, Y_KEYS), p: pick(o, P_KEYS), t: pick(o, T_KEYS) }));
  }
  if (value.slice(0, 5).every(looksLikeRow)) {
    const width = value[0].length;
    return value.map((r) => {
      if (width >= 5) return { x: r[1], y: r[2], p: r[3], t: r[4] }; // n, x, y, p, t (MATLAB order)
      if (width === 4) return { x: r[0], y: r[1], p: r[2], t: r[3] };
      if (width === 3) return { x: r[0], y: r[1], t: r[2] };
      return { x: r[0], y: r[1] };
    });
  }
  return null;
}

// Fill in what is missing and convert units, recording every assumption.
export function normalizePoints(raw) {
  const notes = [];
  let pts = raw
    .map((pt) => ({ x: Number(pt.x), y: Number(pt.y), p: isNum(pt.p) ? Number(pt.p) : null, t: isNum(pt.t) ? Number(pt.t) : null }))
    .filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y));

  if (pts.some((pt) => pt.t == null)) {
    pts = pts.map((pt, i) => ({ ...pt, t: (i * 1000) / ASSUMED_SAMPLE_HZ }));
    notes.push(`No timestamps: assumed ${ASSUMED_SAMPLE_HZ} points per second.`);
  } else {
    const t0 = pts[0]?.t ?? 0;
    const span = (pts[pts.length - 1]?.t ?? 0) - t0;
    // A whole spiral takes seconds; a span under 200 over many points means seconds, not ms.
    if (pts.length > 50 && span > 0 && span < 200) {
      pts = pts.map((pt) => ({ ...pt, t: pt.t * 1000 }));
      notes.push("Timestamps look like seconds: converted to milliseconds.");
    }
  }

  if (pts.some((pt) => pt.p == null)) {
    pts = pts.map((pt) => ({ ...pt, p: pt.p ?? 500 }));
    notes.push("No pressure: set to 500 (as for a finger or mouse).");
  } else {
    const maxP = Math.max(...pts.map((pt) => pt.p));
    if (maxP > 0 && maxP <= 1) {
      pts = pts.map((pt) => ({ ...pt, p: pt.p * 1000 }));
      notes.push("Pressure looks like 0–1: scaled to 0–1000.");
    }
  }

  const t0 = pts[0]?.t ?? 0;
  const points = pts.map((pt, i) => ({ n: i + 1, x: pt.x, y: pt.y, p: Math.round(pt.p), t: Math.round(pt.t - t0) }));
  return { points, notes };
}

function makeDrawing(name, raw, cssPpi) {
  const { points, notes } = normalizePoints(raw);
  const drawing = { name, points, cssPpi, notes, error: null };
  if (points.length < 3) drawing.error = "Fewer than 3 usable points.";
  else if (points.length < FEW_POINTS) notes.push(`Only ${points.length} points; the drawing page asks for at least ${FEW_POINTS}.`);
  return drawing;
}

// Walk a parsed JSON value and collect every drawing in it.
function collect(value, name, inheritedPpi, out, depth = 0) {
  if (depth > 6 || value == null) return;

  const ppi = cssPpiOf(value) ?? inheritedPpi;
  const direct = rawPoints(value);
  if (direct) {
    out.push(makeDrawing(name, direct, ppi));
    return;
  }

  if (Array.isArray(value)) {
    // A list of drawings.
    value.forEach((item, i) => collect(item, nameOf(item, `${name} #${i + 1}`), ppi, out, depth + 1));
    return;
  }
  if (typeof value !== "object") return;

  if (Array.isArray(value.strokes) && value.strokes.every((s) => rawPoints(s))) {
    out.push(makeDrawing(name, value.strokes.flatMap((s) => rawPoints(s)), ppi));
    return;
  }
  for (const key of POINT_HOLDERS) {
    if (value[key] !== undefined && (looksLikePointArray(value[key]) || looksLikeColumns(value[key]))) {
      out.push(makeDrawing(name, rawPoints(value[key]), ppi));
      return;
    }
  }
  for (const key of MANY_HOLDERS) {
    if (Array.isArray(value[key])) {
      value[key].forEach((item, i) => collect(item, nameOf(item, `${name} #${i + 1}`), ppi, out, depth + 1));
      return;
    }
  }
  // Last resort: a point array or another holder one level down.
  for (const [k, v] of Object.entries(value)) {
    if (v && typeof v === "object") {
      const before = out.length;
      collect(v, `${name} · ${k}`, ppi, out, depth + 1);
      if (out.length > before) return;
    }
  }
}

// One file's text -> { drawings, error }. `name` is the file name without extension.
export function parseSpiralFile(text, name) {
  let values;
  try {
    values = [JSON.parse(text)];
  } catch {
    // JSON Lines: one JSON value per line.
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    try {
      values = lines.map((l) => JSON.parse(l));
    } catch {
      return { drawings: [], error: "Not valid JSON." };
    }
  }
  const drawings = [];
  values.forEach((v, i) => collect(v, values.length > 1 ? `${name} #${i + 1}` : nameOf(v, name), null, drawings));
  if (!drawings.length) return { drawings: [], error: "No spiral points found in this file." };
  return { drawings, error: null };
}

// What the batch API's `drawings` input needs for one drawing.
export function toBatchDrawing(drawing, { ref, label, defaultPpi }) {
  return { ref, label, cssPpi: drawing.cssPpi ?? defaultPpi, points: drawing.points };
}

// Split into request-sized parts: at most `maxCount` drawings and roughly
// `maxBytes` of JSON each (the host refuses request bodies over 4.5 MB).
export function splitIntoParts(items, { maxCount = 100, maxBytes = 3_000_000 } = {}) {
  const parts = [];
  let current = [];
  let bytes = 0;
  for (const item of items) {
    const size = JSON.stringify(item).length;
    if (current.length && (current.length >= maxCount || bytes + size > maxBytes)) {
      parts.push(current);
      current = [];
      bytes = 0;
    }
    current.push(item);
    bytes += size;
  }
  if (current.length) parts.push(current);
  return parts;
}
