// GET /api/batch/[id] -- progress of one batch. Also self-heals: if work is
// waiting but no worker is on it, workers are restarted, so a stalled batch
// resumes simply by being checked on.
import { NextResponse, after } from "next/server";
import { authorize, batchLinks, isBatchId, jsonError } from "@/lib/batch/http";
import { kickWorkers } from "@/lib/batch/kick";
import { createBatchStore } from "@/lib/batch/store";
import { summarizeProgress } from "@/lib/batch/worker";

export async function GET(req, { params }) {
  const { id } = await params;
  if (!isBatchId(id)) return jsonError(404, "No such batch");

  const { supabase, response } = await authorize(req);
  if (response) return response;

  const store = createBatchStore(supabase);
  let batch;
  let summary;
  try {
    batch = await store.getBatch(id);
    if (!batch) return jsonError(404, "No such batch");
    summary = summarizeProgress(await store.progress(id));
  } catch (err) {
    console.error("[batch] status failed:", err.message);
    return jsonError(500, "Could not read batch progress");
  }

  let status = batch.status;
  let restartedWorkers = 0;
  if (status === "running" && summary.isFinished) {
    await store.markBatchCompleted(id).catch(() => {});
    status = "completed";
  } else if (status === "running" && summary.isStalled) {
    restartedWorkers = Math.min(batch.workers, summary.counts.queued + summary.expiredLeases);
    const origin = req.nextUrl.origin;
    after(() => kickWorkers({ origin, batchId: id, count: restartedWorkers }));
  }

  return NextResponse.json({
    batchId: batch.id,
    label: batch.label,
    status,
    backends: batch.backends,
    backendVersions: batch.backend_versions,
    useCache: batch.use_cache,
    options: batch.options,
    createdAt: batch.created_at,
    finishedAt: batch.finished_at,
    totalItems: summary.total,
    percent: summary.percent,
    counts: summary.counts,
    byBackend: summary.byBackend,
    cacheHits: summary.cacheHits,
    restartedWorkers,
    links: batchLinks(req.nextUrl.origin, batch.id),
  });
}
