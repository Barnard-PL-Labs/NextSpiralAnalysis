import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isSuperuserEmail } from "@/lib/superusers";

// Tells the caller whether *they* are a superuser. Never returns the list
// itself, so the membership of that list stays on the server.
export async function GET(req) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Missing Supabase credentials" }, { status: 500 });
  }

  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ isSuperuser: false }, { status: 401 });

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase.auth.getUser(token);
  const email = data?.user?.email;
  if (error || !email) return NextResponse.json({ isSuperuser: false }, { status: 401 });

  return NextResponse.json({ isSuperuser: isSuperuserEmail(email) });
}
