// POST /api/batch  -- queue a batch of drawings for analysis (returns at once)
// GET  /api/batch  -- the most recent batches
// Workers: src/app/api/batch/[id]/work. Logic: src/lib/batch/.
import { NextResponse, after } from "next/server";
import { getBackends } from "@/lib/batch/config";
import { authorize, batchLinks, jsonError } from "@/lib/batch/http";
import { kickWorkers } from "@/lib/batch/kick";
import { createBatch, parseBatchRequest } from "@/lib/batch/submit";

export const maxDuration = 60;

export async function POST(req) {
  const { supabase, actor, response } = await authorize(req);
  if (response) return response;

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Body must be valid JSON");
  }

  const backends = getBackends();
  const parsed = parseBatchRequest(body, backends);
  if (!parsed.ok) return jsonError(400, parsed.error);

  let created;
  try {
    created = await createBatch(supabase, parsed.value, { actor, backends });
  } catch (err) {
    console.error("[batch] create failed:", err.message);
    return jsonError(500, "Could not create the batch");
  }
  if (!created.batch) {
    return NextResponse.json(
      { error: created.error, unknownDrawingIds: created.unknownDrawingIds },
      { status: 400 }
    );
  }

  const { batch } = created;
  const origin = req.nextUrl.origin;
  after(() => kickWorkers({ origin, batchId: batch.id, count: Math.min(batch.workers, batch.total_items) }));

  return NextResponse.json(
    {
      batchId: batch.id,
      label: batch.label,
      backends: batch.backends,
      backendVersions: batch.backend_versions,
      totalItems: batch.total_items,
      workers: batch.workers,
      unknownDrawingIds: created.unknownDrawingIds,
      links: batchLinks(origin, batch.id),
    },
    { status: 202 }
  );
}

// ?limit=5&offset=0&kind=synthetic,inline -- newest first, one page at a time.
export async function GET(req) {
  const { supabase, response } = await authorize(req);
  if (response) return response;

  const search = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number.parseInt(search.get("limit") ?? "25", 10) || 25, 1), 100);
  const offset = Math.max(Number.parseInt(search.get("offset") ?? "0", 10) || 0, 0);
  const kinds = (search.get("kind") || "")
    .split(",")
    .map((k) => k.trim())
    .filter((k) => /^[a-z]+$/.test(k));

  let query = supabase
    .from("analysis_batches")
    .select("id, label, backends, backend_versions, options, total_items, status, created_by, created_at, finished_at")
    .order("created_at", { ascending: false });
  if (kinds.length) query = query.in("options->>kind", kinds);
  // One extra row says whether there is another page.
  const { data, error } = await query.range(offset, offset + limit);
  if (error) return jsonError(500, "Could not list batches");

  return NextResponse.json({
    batches: data.slice(0, limit),
    hasMore: data.length > limit,
    nextOffset: data.length > limit ? offset + limit : null,
    backends: Object.keys(getBackends()),
  });
}
