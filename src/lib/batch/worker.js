// Server-only. What one worker invocation does: claim rows one at a time and
// analyze each until its time budget runs out. Many of these run at once, and
// the database hands each row to exactly one of them.
import { createHash } from "node:crypto";
import { isFallbackPressureDrawing } from "@/lib/pressure";
import { prepareDrawData } from "@/lib/spiralPreprocess";
import { runSpiralBackend } from "@/lib/spiralBackend";
import { generateSpiral } from "@/lib/syntheticSpiral";
import {
  BACKEND_TIMEOUT_MS,
  DEFAULT_CSS_PPI,
  LEASE_SECONDS,
  MAX_ATTEMPTS,
  MIN_START_MS,
} from "@/lib/batch/config";

export function hashDrawData(drawData) {
  return createHash("sha256").update(JSON.stringify(drawData)).digest("hex");
}

// Draw a synthetic spiral from its recipe and turn it into a backend payload.
export function prepareSyntheticSpiral(spec) {
  try {
    const spiral = generateSpiral(spec);
    return { drawData: prepareDrawData(spiral.points, spiral.cssPpi), cssPpi: spiral.cssPpi, cssPpiAssumed: false };
  } catch (err) {
    return { finalStatus: "failed", error: `Could not draw this spiral: ${err.message}` };
  }
}

// Load a stored drawing and turn it into a backend payload. Returns either
// { drawData, cssPpi, cssPpiAssumed } or { finalStatus, error } when the row
// can never be analyzed.
export function prepareStoredDrawing(drawing, { excludeFallbackPressure = false } = {}) {
  if (!drawing) return { finalStatus: "failed", error: "Drawing not found (it may have been deleted)" };
  if (excludeFallbackPressure && isFallbackPressureDrawing(drawing.drawing_data)) {
    return { finalStatus: "skipped", error: "Pressure is constant (no stylus pressure recorded)" };
  }
  const cssPpiAssumed = !(Number(drawing.css_ppi) > 0);
  const cssPpi = cssPpiAssumed ? DEFAULT_CSS_PPI : Number(drawing.css_ppi);
  try {
    return { drawData: prepareDrawData(drawing.drawing_data, cssPpi), cssPpi, cssPpiAssumed };
  } catch (err) {
    return { finalStatus: "failed", error: err.message };
  }
}

function finish(store, item, patch) {
  return store.updateItem(item.id, { lease_until: null, ...patch });
}

// Analyze one claimed row. Never throws for problems with the drawing or the
// backend; those end up on the row. Throws only if the database itself fails,
// in which case the lease expires and another worker retries the row.
export async function processItem(item, { store, batch, backends, deadline, now = Date.now, runBackend = runSpiralBackend }) {
  const started = now();
  const backend = backends[item.backend];
  if (!backend) {
    return finish(store, item, {
      status: "failed",
      error: `Backend "${item.backend}" is not configured on this server`,
    });
  }

  // 1. The payload: sent inline (already prepared), or drawn / loaded now.
  let hash = item.input_hash;
  let drawData;
  if (item.draw_data) {
    drawData = item.draw_data;
    hash ||= hashDrawData(drawData);
  } else {
    const prepared = item.spec
      ? prepareSyntheticSpiral(item.spec)
      : prepareStoredDrawing(await store.loadDrawing(item.drawing_id), batch.options || {});
    if (prepared.finalStatus) {
      return finish(store, item, { status: prepared.finalStatus, error: prepared.error });
    }
    drawData = prepared.drawData;
    hash = hashDrawData(drawData);
    await store.updateItem(item.id, {
      input_hash: hash,
      css_ppi: prepared.cssPpi,
      css_ppi_assumed: prepared.cssPpiAssumed,
    });
  }

  // 2. Same input, same backend version: reuse the earlier answer.
  if (batch.use_cache) {
    const cached = await store.getCached(hash, item.backend, item.backend_version);
    if (cached) {
      return finish(store, item, {
        status: "done",
        result: cached,
        cache_hit: true,
        error: null,
        duration_ms: now() - started,
      });
    }
  }

  // 3. Call the backend. runWorker only starts a row with at least
  // MIN_START_MS left, so this is normally the full BACKEND_TIMEOUT_MS; the
  // cap only matters if the steps above were unusually slow.
  const timeoutMs = Math.max(1_000, Math.min(BACKEND_TIMEOUT_MS, deadline - now() - 2_000));
  let result;
  try {
    result = await runBackend({
      url: backend.url,
      drawData,
      timeoutMs,
      fillWidthMetrics: backend.fillWidthMetrics,
    });
  } catch (err) {
    const message = err?.message || "Backend call failed";
    if (err?.retryable && item.attempts < MAX_ATTEMPTS) {
      return finish(store, item, { status: "queued", error: message });
    }
    return finish(store, item, { status: "failed", error: message, duration_ms: now() - started });
  }

  return finish(store, item, {
    status: "done",
    result,
    cache_hit: false,
    error: null,
    duration_ms: now() - started,
  });
}

// One invocation's work. `drained` means there was nothing left to claim, so
// no successor is needed.
export async function runWorker({ store, batchId, backends, deadline, now = Date.now, runBackend }) {
  const batch = await store.getBatch(batchId);
  if (!batch || batch.status !== "running") return { processed: 0, drained: true };

  let processed = 0;
  while (deadline - now() >= MIN_START_MS) {
    const [item] = await store.claim(batchId, {
      limit: 1,
      leaseSeconds: LEASE_SECONDS,
      maxAttempts: MAX_ATTEMPTS,
    });
    if (!item) return { processed, drained: true };
    await processItem(item, { store, batch, backends, deadline, now, runBackend });
    processed += 1;
  }
  return { processed, drained: false };
}

// Fold analysis_batch_progress() rows into totals.
export function summarizeProgress(rows) {
  const counts = { queued: 0, running: 0, done: 0, failed: 0, skipped: 0 };
  const byBackend = {};
  let cacheHits = 0;
  let liveLeases = 0;
  let expiredLeases = 0;
  for (const row of rows) {
    const n = Number(row.items) || 0;
    counts[row.status] = (counts[row.status] || 0) + n;
    byBackend[row.backend] ||= { queued: 0, running: 0, done: 0, failed: 0, skipped: 0 };
    byBackend[row.backend][row.status] = (byBackend[row.backend][row.status] || 0) + n;
    cacheHits += Number(row.cache_hits) || 0;
    liveLeases += Number(row.live_leases) || 0;
    expiredLeases += Number(row.expired_leases) || 0;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const finished = counts.done + counts.failed + counts.skipped;
  return {
    total,
    counts,
    byBackend,
    cacheHits,
    liveLeases,
    expiredLeases,
    percent: total ? Math.round((finished / total) * 1000) / 10 : 100,
    // Nothing left to claim and nobody holding a row.
    isFinished: counts.queued === 0 && counts.running === 0,
    // Work is waiting but no worker is on it (all died, or a hand-off was lost).
    isStalled: liveLeases === 0 && (counts.queued > 0 || expiredLeases > 0),
  };
}

// Mark the batch completed if every row has settled. Safe to call from many
// workers at once.
export async function completeIfFinished(store, batchId) {
  const summary = summarizeProgress(await store.progress(batchId));
  if (summary.isFinished) await store.markBatchCompleted(batchId);
  return summary;
}
