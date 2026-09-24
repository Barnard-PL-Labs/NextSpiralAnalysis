// Server-only. Do NOT import this from a Client Component.
//
// The superuser list lives in the app_superusers table, which is the single
// source of truth: the same table backs the is_superuser() SQL function that
// the RLS policies on drawings and api_results call. Keeping the app and the
// database on one list means the UI can no longer offer a view that RLS will
// refuse to return.
//
// The table has RLS enabled with no policies, so it is readable only by the
// service role (used here) and by is_superuser(), which is SECURITY DEFINER.
// Membership therefore never reaches the browser -- the property the old
// NEXT_PUBLIC_SUPERUSER_EMAILS variable could not provide, since anything with
// that prefix is inlined into the client bundle.
//
// To grant access: INSERT INTO app_superusers (email) VALUES ('...'); no
// redeploy needed. Addresses are stored lower case (enforced by a CHECK
// constraint) because auth.email() is lower case.
import { createClient } from "@supabase/supabase-js";

let client = null;

function adminClient() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  client = createClient(url, serviceKey, { auth: { persistSession: false } });
  return client;
}

// Fails closed: any misconfiguration or lookup error denies access rather than
// granting it.
export async function isSuperuserEmail(email) {
  if (!email) return false;

  const supabase = adminClient();
  if (!supabase) {
    console.error("[superusers] Missing Supabase credentials; denying access.");
    return false;
  }

  const { data, error } = await supabase
    .from("app_superusers")
    .select("email")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  if (error) {
    console.error("[superusers] Lookup failed; denying access:", error.message);
    return false;
  }

  return Boolean(data);
}
