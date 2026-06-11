import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function DELETE(req) {
  try {
    const { drawingId } = await req.json();
    if (!drawingId) {
      return NextResponse.json({ error: "Missing drawingId" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Missing Supabase credentials" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: e1 } = await supabase.from("api_results").delete().eq("drawing_id", drawingId);
    if (e1) console.error("[delete-drawing] api_results error:", e1.message);

    const { error: e2 } = await supabase.from("drawings").delete().eq("id", drawingId);
    if (e2) console.error("[delete-drawing] drawings error:", e2.message);

    if (e1 || e2) {
      return NextResponse.json({ error: "Partial or full delete failure", e1: e1?.message, e2: e2?.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[delete-drawing] Server error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
