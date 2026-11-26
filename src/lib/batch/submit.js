// Server-only. Validate a POST /api/batch body and write the batch to the database.
import { prepareDrawData } from "@/lib/spiralPreprocess";
import { sanitizeSpiralOptions } from "@/lib/syntheticSpiral";
import { hashDrawData } from "@/lib/batch/worker";
import {
  DEFAULT_WORKERS,
  MAX_DRAWINGS_PER_BATCH,
  MAX_INLINE_DRAWINGS,
  MAX_WORKERS,
} from "@/lib/batch/config";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isIsoDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

// Returns { ok: true, value } or { ok: false, error }. Exactly one source of
// drawings is allowed: drawingIds, query, drawings (points sent inline), or
// synthetic (spiral recipes, drawn by the workers -- see syntheticSpiral.js).
export function parseBatchRequest(body, availableBackends) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Body must be a JSON object" };
  }

  const sources = ["drawingIds", "query", "drawings", "synthetic"].filter((k) => body[k] != null);
  if (sources.length !== 1) {
    return { ok: false, error: "Give exactly one of drawingIds, query, drawings, or synthetic" };
  }

  const backendNames = body.backends ?? ["matlab"];
  if (!Array.isArray(backendNames) || backendNames.length === 0) {
    return { ok: false, error: "backends must be a non-empty array" };
  }
  const backends = [...new Set(backendNames)];
  const unknown = backends.filter((b) => !availableBackends[b]);
  if (unknown.length) {
    return {
      ok: false,
      error: `Unknown backend(s): ${unknown.join(", ")}. Available: ${Object.keys(availableBackends).join(", ")}`,
    };
  }

  const workers = body.workers ?? DEFAULT_WORKERS;
  if (!Number.isInteger(workers) || workers < 1 || workers > MAX_WORKERS) {
    return { ok: false, error: `workers must be an integer from 1 to ${MAX_WORKERS}` };
  }
  if (body.label != null && (typeof body.label !== "string" || body.label.length > 200)) {
    return { ok: false, error: "label must be a string of at most 200 characters" };
  }
  if (body.useCache != null && typeof body.useCache !== "boolean") {
    return { ok: false, error: "useCache must be true or false" };
  }
  if (body.excludeFallbackPressure != null && typeof body.excludeFallbackPressure !== "boolean") {
    return { ok: false, error: "excludeFallbackPressure must be true or false" };
  }

  const value = {
    label: body.label ?? null,
    backends,
    workers,
    useCache: body.useCache ?? true,
    options: { excludeFallbackPressure: body.excludeFallbackPressure ?? false },
  };

  if (body.drawingIds != null) {
    if (!Array.isArray(body.drawingIds) || body.drawingIds.length === 0) {
      return { ok: false, error: "drawingIds must be a non-empty array" };
    }
    const ids = [...new Set(body.drawingIds.map((id) => String(id).toLowerCase()))];
    const bad = ids.filter((id) => !UUID_RE.test(id));
    if (bad.length) return { ok: false, error: `Not a drawing id: ${bad.slice(0, 5).join(", ")}` };
    if (ids.length > MAX_DRAWINGS_PER_BATCH) {
      return { ok: false, error: `At most ${MAX_DRAWINGS_PER_BATCH} drawings per batch` };
    }
    value.drawingIds = ids;
  }

  if (body.query != null) {
    const q = body.query;
    if (typeof q !== "object" || Array.isArray(q)) return { ok: false, error: "query must be an object" };
    for (const key of ["createdAfter", "createdBefore"]) {
      if (q[key] != null && !isIsoDate(q[key])) return { ok: false, error: `query.${key} must be an ISO date` };
    }
    if (q.deviceRecognized != null && typeof q.deviceRecognized !== "boolean") {
      return { ok: false, error: "query.deviceRecognized must be true or false" };
    }
    const limit = q.limit ?? MAX_DRAWINGS_PER_BATCH;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_DRAWINGS_PER_BATCH) {
      return { ok: false, error: `query.limit must be an integer from 1 to ${MAX_DRAWINGS_PER_BATCH}` };
    }
    value.query = {
      createdAfter: q.createdAfter ?? null,
      createdBefore: q.createdBefore ?? null,
      deviceRecognized: q.deviceRecognized ?? null,
      limit,
    };
  }

  if (body.drawings != null) {
    const parsed = parseInlineDrawings(body.drawings);
    if (!parsed.ok) return parsed;
    value.drawings = parsed.value;
  }

  if (body.synthetic != null) {
    if (!Array.isArray(body.synthetic) || body.synthetic.length === 0) {
      return { ok: false, error: "synthetic must be a non-empty array" };
    }
    if (body.synthetic.length > MAX_DRAWINGS_PER_BATCH) {
      return { ok: false, error: `At most ${MAX_DRAWINGS_PER_BATCH} spirals per batch` };
    }
    const specs = [];
    for (const [i, s] of body.synthetic.entries()) {
      const options = sanitizeSpiralOptions(s?.options);
      if (!options) return { ok: false, error: `synthetic[${i}].options must be an object of spiral settings` };
      if (s.ref != null && (typeof s.ref !== "string" || s.ref.length > 200)) {
        return { ok: false, error: `synthetic[${i}].ref must be a string of at most 200 characters` };
      }
      if (s.label != null && (typeof s.label !== "string" || s.label.length > 200)) {
        return { ok: false, error: `synthetic[${i}].label must be a string of at most 200 characters` };
      }
      specs.push({ ref: s.ref ?? String(i), label: s.label ?? null, options });
    }
    value.synthetic = specs;
  }

  return { ok: true, value };
}

// Points sent in the request body, for POST /api/batch and for adding more
// parts to a batch (POST /api/batch/[id]/items). Each request carries at most
// MAX_INLINE_DRAWINGS; larger sets are sent as several parts.
export function parseInlineDrawings(list) {
  if (!Array.isArray(list) || list.length === 0) return { ok: false, error: "drawings must be a non-empty array" };
  if (list.length > MAX_INLINE_DRAWINGS) {
    return {
      ok: false,
      error: `At most ${MAX_INLINE_DRAWINGS} inline drawings per request; send larger sets in parts (POST /api/batch/{id}/items)`,
    };
  }
  for (const [i, d] of list.entries()) {
    if (!d || !Array.isArray(d.points)) return { ok: false, error: `drawings[${i}].points must be an array` };
    if (!(Number(d.cssPpi) > 0)) return { ok: false, error: `drawings[${i}].cssPpi must be a positive number` };
    if (d.ref != null && (typeof d.ref !== "string" || d.ref.length > 200)) {
      return { ok: false, error: `drawings[${i}].ref must be a string of at most 200 characters` };
    }
    if (d.label != null && (typeof d.label !== "string" || d.label.length > 200)) {
      return { ok: false, error: `drawings[${i}].label must be a string of at most 200 characters` };
    }
  }
  return {
    ok: true,
    value: list.map((d, i) => ({ ref: d.ref ?? String(i), label: d.label ?? null, points: d.points, cssPpi: Number(d.cssPpi) })),
  };
}

// Preprocess inline drawings into item fields. A drawing that cannot be
// prepared becomes a failed row that says why.
function inlineUnits(drawings) {
  return drawings.map((d) => {
    try {
      const drawData = prepareDrawData(d.points, d.cssPpi);
      return { ref: d.ref, label: d.label, draw_data: drawData, input_hash: hashDrawData(drawData), css_ppi: d.cssPpi };
    } catch (err) {
      return { ref: d.ref, label: d.label, css_ppi: d.cssPpi, status: "failed", error: err.message };
    }
  });
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function check({ data, error }, what) {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function existingDrawingIds(supabase, ids) {
  const found = new Set();
  for (const part of chunk(ids, 200)) {
    const rows = check(await supabase.from("drawings").select("id").in("id", part), "Checking drawing ids");
    rows.forEach((r) => found.add(r.id));
  }
  return found;
}

async function queryDrawingIds(supabase, q) {
  const ids = [];
  const PAGE = 1000;
  for (let from = 0; ids.length < q.limit; from += PAGE) {
    let request = supabase.from("drawings").select("id").order("created_at", { ascending: true });
    if (q.createdAfter) request = request.gte("created_at", q.createdAfter);
    if (q.createdBefore) request = request.lt("created_at", q.createdBefore);
    if (q.deviceRecognized != null) request = request.eq("device_recognized", q.deviceRecognized);
    const take = Math.min(PAGE, q.limit - ids.length);
    const rows = check(await request.range(from, from + take - 1), "Finding drawings");
    ids.push(...rows.map((r) => r.id));
    if (rows.length < take) break;
  }
  return ids;
}

// Writes the batch and its rows. Stored drawings are only referenced here; the
// workers load and preprocess them, which keeps this request fast however
// large the batch is.
export async function createBatch(supabase, request, { actor, backends: available }) {
  // One "unit" per drawing; each becomes one row per backend.
  let units = [];
  let unknownDrawingIds = [];

  if (request.drawingIds) {
    const found = await existingDrawingIds(supabase, request.drawingIds);
    unknownDrawingIds = request.drawingIds.filter((id) => !found.has(id));
    units = request.drawingIds.filter((id) => found.has(id)).map((id) => ({ drawing_id: id }));
  } else if (request.query) {
    units = (await queryDrawingIds(supabase, request.query)).map((id) => ({ drawing_id: id }));
  } else if (request.synthetic) {
    // Only the recipe is stored; workers draw each spiral when they reach it.
    units = request.synthetic.map((s) => ({ ref: s.ref, label: s.label, spec: s.options }));
  } else {
    // Inline points are prepared now and kept on the row itself.
    units = inlineUnits(request.drawings);
  }

  if (units.length === 0) {
    return { batch: null, unknownDrawingIds, error: "No drawings matched" };
  }

  const backendVersions = Object.fromEntries(request.backends.map((b) => [b, available[b].version]));
  const batch = check(
    await supabase
      .from("analysis_batches")
      .insert({
        label: request.label,
        backends: request.backends,
        backend_versions: backendVersions,
        use_cache: request.useCache,
        workers: request.workers,
        // kind lets tools list only the batches they made (the spiral lab shows "synthetic").
        options: { ...request.options, kind: request.synthetic ? "synthetic" : request.query ? "query" : request.drawingIds ? "drawings" : "inline" },
        total_items: units.length * request.backends.length,
        created_by: actor,
      })
      .select("*")
      .single(),
    "Creating batch"
  );

  const rows = units.flatMap((unit) =>
    request.backends.map((backend) => ({
      batch_id: batch.id,
      backend,
      backend_version: backendVersions[backend],
      ...unit,
    }))
  );

  try {
    for (const part of chunk(rows, 500)) {
      check(await supabase.from("analysis_batch_items").insert(part), "Queueing batch items");
    }
  } catch (err) {
    // Leave no half-written batch behind (items cascade).
    await supabase.from("analysis_batches").delete().eq("id", batch.id);
    throw err;
  }

  return { batch, unknownDrawingIds };
}

// Add another part of inline drawings to an existing batch, and reopen it if
// it had already finished. Returns { added }.
export async function appendToBatch(supabase, batch, drawings) {
  const units = inlineUnits(drawings);
  const versions = batch.backend_versions || {};
  const rows = units.flatMap((unit) =>
    batch.backends.map((backend) => ({ batch_id: batch.id, backend, backend_version: versions[backend] ?? "1", ...unit }))
  );
  for (const part of chunk(rows, 500)) {
    check(await supabase.from("analysis_batch_items").insert(part), "Adding batch items");
  }
  const { count, error } = await supabase
    .from("analysis_batch_items")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batch.id);
  if (error) throw new Error(`Counting batch items: ${error.message}`);
  check(
    await supabase
      .from("analysis_batches")
      .update({ total_items: count, status: "running", finished_at: null })
      .eq("id", batch.id),
    "Reopening batch"
  );
  return { added: rows.length, total: count };
}
