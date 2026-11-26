// Turn batch rows into a downloadable table: one row per drawing x backend,
// one column per metric.

const BASE_COLUMNS = [
  "drawing_id",
  "ref",
  "label",
  "backend",
  "backend_version",
  "status",
  "cache_hit",
  "attempts",
  "duration_ms",
  "css_ppi",
  "css_ppi_assumed",
  "error",
];

function isScalar(value) {
  return value == null || ["string", "number", "boolean"].includes(typeof value);
}

// Results are flat objects of metrics today; anything nested (plot data, if a
// backend ever adds it) is left out of the table.
export function scalarMetrics(result) {
  if (!result || typeof result !== "object") return {};
  return Object.fromEntries(Object.entries(result).filter(([, v]) => isScalar(v)));
}

function csvCell(value) {
  if (value == null) return "";
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Yields the CSV one line at a time, so a large batch can be streamed rather
// than built as one string (Vercel caps buffered responses at 4.5 MB).
export function* csvLines(items) {
  const metricKeys = new Set();
  const rows = items.map((item) => {
    const metrics = scalarMetrics(item.result);
    Object.keys(metrics).forEach((k) => metricKeys.add(k));
    return { item, metrics };
  });
  // Metric names could collide with a base column; prefix those.
  const metricColumns = [...metricKeys].sort().map((k) => ({
    key: k,
    header: BASE_COLUMNS.includes(k) ? `metric:${k}` : k,
  }));

  const EOL = "\r\n";
  yield [...BASE_COLUMNS, ...metricColumns.map((c) => c.header)].map(csvCell).join(",") + EOL;
  for (const { item, metrics } of rows) {
    yield [...BASE_COLUMNS.map((c) => item[c]), ...metricColumns.map((c) => metrics[c.key])]
      .map(csvCell)
      .join(",") + EOL;
  }
}

export function itemsToCsv(items) {
  return [...csvLines(items)].join("");
}

export function csvStream(items, linesPerChunk = 500) {
  const lines = csvLines(items);
  const encoder = new TextEncoder();
  return new ReadableStream({
    pull(controller) {
      let chunk = "";
      for (let i = 0; i < linesPerChunk; i += 1) {
        const next = lines.next();
        if (next.done) {
          if (chunk) controller.enqueue(encoder.encode(chunk));
          controller.close();
          return;
        }
        chunk += next.value;
      }
      controller.enqueue(encoder.encode(chunk));
    },
  });
}
