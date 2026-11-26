// POST /api/batch/[id]/items -- add another part of inline drawings to a batch.
// A request body is capped (4.5 MB on Vercel, 100 drawings here), so thousands
// of uploaded drawings go as: POST /api/batch with the first part, then this
// route for each further part. A finished batch is reopened.
import { NextResponse, after } from "next/server";
import { authorize, batchLinks, isBatchId, jsonError } from "@/lib/batch/http";
import { kickWorkers } from "@/lib/batch/kick";
import { createBatchStore } from "@/lib/batch/store";
import { appendToBatch, parseInlineDrawings } from "@/lib/batch/submit";
import { summarizeProgress } from "@/lib/batch/worker";

export const maxDuration = 60;

export async function POST(req, { params }) {
  const { id } = await params;
  if (!isBatchId(id)) return jsonError(404, "No such batch");

  const { supabase, response } = await authorize(req);
  if (response) return response;

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Body must be valid JSON");
  }
  const parsed = parseInlineDrawings(body?.drawings);
  if (!parsed.ok) return jsonError(400, parsed.error);

  const store = createBatchStore(supabase);
  let batch;
  let appended;
  try {
    batch = await store.getBatch(id);
    if (!batch) return jsonError(404, "No such batch");
    if (batch.status === "cancelled") return jsonError(409, "This batch was cancelled");
    appended = await appendToBatch(supabase, batch, parsed.value);
  } catch (err) {
    console.error("[batch] append failed:", err.message);
    return jsonError(500, "Could not add to the batch");
  }

  // Top the workers back up to the batch's number; ones already running keep going.
  const origin = req.nextUrl.origin;
  after(async () => {
    const summary = summarizeProgress(await store.progress(id));
    const count = Math.min(Math.max(batch.workers - summary.liveLeases, 0), summary.counts.queued);
    if (count > 0) await kickWorkers({ origin, batchId: id, count });
  });

  return NextResponse.json(
    { batchId: id, added: appended.added, totalItems: appended.total, links: batchLinks(origin, id) },
    { status: 202 }
  );
}
