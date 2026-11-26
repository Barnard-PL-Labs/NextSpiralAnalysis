// Server-only. Start worker invocations for a batch. Each worker route answers
// 202 at once and does its work after responding, so this returns in well
// under a second however long the work takes.
import { workerToken } from "@/lib/batch/auth";

export async function kickWorkers({ origin, batchId, count, env = process.env, fetchImpl = fetch }) {
  const secret = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || count < 1) return 0;

  const base = (env.BATCH_SELF_URL || origin).replace(/\/+$/, "");
  const headers = { "x-batch-worker-token": workerToken(batchId, secret) };
  // Preview deployments sit behind Vercel's login wall; this header (Vercel's
  // "Protection Bypass for Automation") lets the server call itself there.
  if (env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    headers["x-vercel-protection-bypass"] = env.VERCEL_AUTOMATION_BYPASS_SECRET;
  }

  const results = await Promise.allSettled(
    Array.from({ length: count }, () =>
      fetchImpl(`${base}/api/batch/${batchId}/work`, {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(10_000),
      })
    )
  );
  const started = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
  if (started < count) {
    console.error(`[batch] started ${started}/${count} workers for batch ${batchId}`);
  }
  return started;
}
