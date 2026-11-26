// Server-only. Every database read and write the batch API makes, behind one
// small interface so the worker logic can be tested against an in-memory fake.
import { createClient } from "@supabase/supabase-js";

let client = null;

export function getAdminClient() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  client = createClient(url, serviceKey, { auth: { persistSession: false } });
  return client;
}

function check({ data, error }, what) {
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

export function createBatchStore(supabase) {
  return {
    async getBatch(batchId) {
      return check(
        await supabase.from("analysis_batches").select("*").eq("id", batchId).maybeSingle(),
        "Loading batch"
      );
    },

    async claim(batchId, { limit, leaseSeconds, maxAttempts }) {
      return (
        check(
          await supabase.rpc("claim_analysis_batch_items", {
            p_batch_id: batchId,
            p_limit: limit,
            p_lease_seconds: leaseSeconds,
            p_max_attempts: maxAttempts,
          }),
          "Claiming batch items"
        ) || []
      );
    },

    async loadDrawing(drawingId) {
      return check(
        await supabase
          .from("drawings")
          .select("id, drawing_data, css_ppi")
          .eq("id", drawingId)
          .maybeSingle(),
        "Loading drawing"
      );
    },

    // An earlier answer for the same input from the same backend version: the
    // result of any finished row that actually called the backend.
    async getCached(hash, backend, version) {
      const rows = check(
        await supabase
          .from("analysis_batch_items")
          .select("result")
          .eq("input_hash", hash)
          .eq("backend", backend)
          .eq("backend_version", version)
          .eq("status", "done")
          .eq("cache_hit", false)
          .not("result", "is", null)
          .limit(1),
        "Reading earlier results"
      );
      return rows?.[0]?.result ?? null;
    },

    async updateItem(itemId, patch) {
      check(
        await supabase
          .from("analysis_batch_items")
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq("id", itemId),
        "Updating batch item"
      );
    },

    async progress(batchId) {
      return (
        check(await supabase.rpc("analysis_batch_progress", { p_batch_id: batchId }), "Reading progress") || []
      );
    },

    async markBatchCompleted(batchId) {
      check(
        await supabase
          .from("analysis_batches")
          .update({ status: "completed", finished_at: new Date().toISOString() })
          .eq("id", batchId)
          .eq("status", "running"),
        "Completing batch"
      );
    },
  };
}
