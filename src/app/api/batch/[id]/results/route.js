// GET /api/batch/[id]/results              -- JSON, paged (?offset=0&limit=500)
// GET /api/batch/[id]/results?format=csv   -- every row as one CSV
// Results hold only scalar metrics unless ?full=1 (JSON only).
import { NextResponse } from "next/server";
import { authorize, isBatchId, jsonError } from "@/lib/batch/http";
import { csvStream, scalarMetrics } from "@/lib/batch/results";

export const maxDuration = 60;

const COLUMNS =
  "id, drawing_id, ref, label, spec, updated_at, backend, backend_version, status, cache_hit, attempts, duration_ms, css_ppi, css_ppi_assumed, error, result";

function int(value, fallback, min, max) {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export async function GET(req, { params }) {
  const { id } = await params;
  if (!isBatchId(id)) return jsonError(404, "No such batch");

  const { supabase, response } = await authorize(req);
  if (response) return response;

  const { data: batch, error: batchError } = await supabase
    .from("analysis_batches")
    .select("id, label, status, backends, backend_versions, total_items")
    .eq("id", id)
    .maybeSingle();
  if (batchError) return jsonError(500, "Could not read the batch");
  if (!batch) return jsonError(404, "No such batch");

  const search = req.nextUrl.searchParams;

  if (search.get("format") === "csv") {
    const items = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("analysis_batch_items")
        .select(COLUMNS)
        .eq("batch_id", id)
        .order("id")
        .range(from, from + PAGE - 1);
      if (error) return jsonError(500, "Could not read batch results");
      items.push(...data);
      if (data.length < PAGE) break;
    }
    const name = `batch-${id.slice(0, 8)}${batch.status === "completed" ? "" : "-partial"}.csv`;
    return new NextResponse(csvStream(items), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  }

  const offset = int(search.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);
  const limit = int(search.get("limit"), 500, 1, 1000);
  const full = search.get("full") === "1";

  const { data, error } = await supabase
    .from("analysis_batch_items")
    .select(COLUMNS)
    .eq("batch_id", id)
    .order("id")
    .range(offset, offset + limit - 1);
  if (error) return jsonError(500, "Could not read batch results");

  const items = data.map(({ id: _rowId, result, ...rest }) => ({
    ...rest,
    result: full ? result : result && scalarMetrics(result),
  }));
  const nextOffset = offset + items.length;

  return NextResponse.json({
    batch,
    offset,
    limit,
    items,
    nextOffset: items.length === limit && nextOffset < batch.total_items ? nextOffset : null,
  });
}
