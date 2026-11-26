// POST /api/batch/[id]/work -- internal. One worker: answers 202 immediately,
// then claims and analyzes rows until its time budget runs out, and starts a
// successor if work remains. Only this server can call it (HMAC token).
import { NextResponse, after } from "next/server";
import { isValidWorkerToken } from "@/lib/batch/auth";
import { WORK_BUDGET_MS, getBackends } from "@/lib/batch/config";
import { isBatchId, jsonError } from "@/lib/batch/http";
import { kickWorkers } from "@/lib/batch/kick";
import { createBatchStore, getAdminClient } from "@/lib/batch/store";
import { completeIfFinished, runWorker } from "@/lib/batch/worker";

// Keep in sync with WORKER_MAX_DURATION_S in src/lib/batch/config.js. Next.js
// needs a literal here, so it cannot import the constant.
export const maxDuration = 300;

export async function POST(req, { params }) {
  const { id } = await params;
  if (!isBatchId(id)) return jsonError(404, "No such batch");

  const token = req.headers.get("x-batch-worker-token");
  if (!isValidWorkerToken(id, token, process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    return jsonError(403, "Not authorized");
  }

  const supabase = getAdminClient();
  if (!supabase) return jsonError(500, "Server is missing Supabase credentials");

  const deadline = Date.now() + WORK_BUDGET_MS;
  const origin = req.nextUrl.origin;

  after(async () => {
    const store = createBatchStore(supabase);
    try {
      const outcome = await runWorker({ store, batchId: id, backends: getBackends(), deadline });
      if (outcome.drained) {
        await completeIfFinished(store, id);
      } else {
        // Out of time with work left: hand over to a fresh invocation.
        await kickWorkers({ origin, batchId: id, count: 1 });
      }
    } catch (err) {
      // Rows this worker held come back when their lease expires; the next
      // status check restarts workers if none are left.
      console.error(`[batch] worker for ${id} stopped:`, err.message);
    }
  });

  return NextResponse.json({ accepted: true }, { status: 202 });
}
