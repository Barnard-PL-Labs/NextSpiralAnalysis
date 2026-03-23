import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    // Create Supabase client with service role for database access
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Missing Supabase credentials" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date in UTC
    const today = new Date().toISOString().split("T")[0];

    // Count spirals created today
    const { data: spirals, error: countError } = await supabase
      .from("drawings")
      .select("id", { count: "exact", head: true })
      .gte("created_at", `${today}T00:00:00Z`)
      .lt("created_at", `${today}T23:59:59.999Z`);

    if (countError) {
      console.error("Error counting spirals:", countError);
      return NextResponse.json(
        { error: "Failed to count spirals", details: countError },
        { status: 500 }
      );
    }

    const spiralCount = spirals?.length || 0;

    // Log the count to spiral_daily_logs
    const { data: logData, error: logError } = await supabase
      .from("spiral_daily_logs")
      .upsert(
        {
          log_date: today,
          spiral_count: spiralCount,
        },
        { onConflict: "log_date" }
      )
      .select();

    if (logError) {
      console.error("Error logging daily spirals:", logError);
      return NextResponse.json(
        { error: "Failed to log spirals", details: logError },
        { status: 500 }
      );
    }

    console.log(`[${new Date().toISOString()}] Logged ${spiralCount} spirals for ${today}`);

    return NextResponse.json({
      message: "Daily spiral count logged successfully",
      date: today,
      count: spiralCount,
      logId: logData?.[0]?.id,
    });
  } catch (error) {
    console.error("Server error in log-daily-spirals:", error);
    return NextResponse.json(
      { error: "Server error", details: error.message },
      { status: 500 }
    );
  }
}
