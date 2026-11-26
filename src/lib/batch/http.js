// Server-only. Shared request handling for the /api/batch routes.
import { NextResponse } from "next/server";
import { authorizeBatchRequest } from "@/lib/batch/auth";
import { getAdminClient } from "@/lib/batch/store";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isBatchId(id) {
  return typeof id === "string" && UUID_RE.test(id);
}

export function jsonError(status, error) {
  return NextResponse.json({ error }, { status });
}

// Returns { supabase, actor } for an allowed caller, or { response } to send back.
export async function authorize(req) {
  const supabase = getAdminClient();
  if (!supabase) return { response: jsonError(500, "Server is missing Supabase credentials") };
  const auth = await authorizeBatchRequest(req, supabase);
  if (!auth.ok) return { response: jsonError(auth.status, auth.error) };
  return { supabase, actor: auth.actor };
}

export function batchLinks(origin, batchId) {
  const base = `${origin}/api/batch/${batchId}`;
  return { status: base, results: `${base}/results`, csv: `${base}/results?format=csv` };
}
