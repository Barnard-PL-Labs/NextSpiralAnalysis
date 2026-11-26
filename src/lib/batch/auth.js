// Server-only. Who may use the batch API, and how workers prove they were
// started by this server.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { isSuperuserEmail } from "@/lib/superusers";

// Hash both sides first so the comparison takes the same time whatever the
// lengths, and timingSafeEqual never throws on a length mismatch.
function safeEqual(a, b) {
  const ha = createHash("sha256").update(String(a)).digest();
  const hb = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

export function bearerToken(req) {
  return (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

// Short keys are ignored rather than accepted, so a placeholder value in the
// environment cannot become a working password.
export const MIN_API_KEY_LENGTH = 32;

// Two ways in:
//   * BATCH_API_KEY, for scripts and servers (set on Vercel, 32+ characters)
//   * a signed-in superuser's Supabase access token, for the browser
// Fails closed on any error.
export async function authorizeBatchRequest(
  req,
  supabase,
  { env = process.env, isSuperuser = isSuperuserEmail } = {}
) {
  const token = bearerToken(req);
  if (!token) {
    return { ok: false, status: 401, error: "Missing Authorization: Bearer <token> header" };
  }

  const apiKey = env.BATCH_API_KEY;
  if (apiKey && apiKey.length >= MIN_API_KEY_LENGTH && safeEqual(token, apiKey)) {
    return { ok: true, actor: "api-key" };
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    const email = data?.user?.email?.toLowerCase();
    if (error || !email) return { ok: false, status: 401, error: "Invalid or expired token" };
    if (!(await isSuperuser(email))) return { ok: false, status: 403, error: "Not authorized" };
    return { ok: true, actor: email };
  } catch {
    return { ok: false, status: 401, error: "Invalid or expired token" };
  }
}

// Workers are separate invocations of /api/batch/[id]/work started by this
// server. They carry an HMAC of the batch id keyed with a server-only secret,
// so nobody outside can start workers, and a token for one batch is useless
// for another.
export function workerToken(batchId, secret) {
  return createHmac("sha256", secret).update(`analysis-batch-worker:${batchId}`).digest("hex");
}

export function isValidWorkerToken(batchId, token, secret) {
  if (!token || !secret) return false;
  return safeEqual(token, workerToken(batchId, secret));
}
