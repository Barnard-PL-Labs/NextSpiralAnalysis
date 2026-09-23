import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isSuperuserEmail } from "@/lib/superusers";

// Supabase caps each select at 1000 rows; page through to get every row.
async function fetchAllRows(supabase, table, columns, applyFilters = (q) => q) {
  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await applyFilters(
      supabase.from(table).select(columns)
    ).range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

export async function GET(req) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Missing Supabase credentials" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Only superusers may read aggregate stats.
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const email = userData?.user?.email?.toLowerCase();
    if (userError || !email || !isSuperuserEmail(email)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: totalUsers },
      { count: newUsers30d },
      { count: totalDrawings },
      { count: anonymousDrawings },
      { count: totalAnalyses },
      { count: completedAnalyses },
      { count: timeoutAnalyses },
      recentDrawings,
      allDrawingMeta,
      dosRows,
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", since30d),
      supabase.from("drawings").select("*", { count: "exact", head: true }),
      supabase.from("drawings").select("*", { count: "exact", head: true }).eq("is_anonymous", true),
      supabase.from("api_results").select("*", { count: "exact", head: true }),
      supabase.from("api_results").select("*", { count: "exact", head: true }).eq("status", "completed"),
      supabase.from("api_results").select("*", { count: "exact", head: true }).eq("status", "timeout"),
      fetchAllRows(supabase, "drawings", "created_at", (q) => q.gte("created_at", since30d)),
      fetchAllRows(supabase, "drawings", "session_id, path_length_cm"),
      fetchAllRows(supabase, "api_results", "dos:result_data->>DOS", (q) => q.eq("status", "completed")),
    ]);

    // Drawings per day over the last 30 days (UTC), zero-filled.
    const perDay = new Map();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      perDay.set(d.toISOString().slice(0, 10), 0);
    }
    for (const row of recentDrawings || []) {
      const day = row.created_at?.slice(0, 10);
      if (perDay.has(day)) perDay.set(day, perDay.get(day) + 1);
    }

    const totalSessions = new Set((allDrawingMeta || []).map((s) => s.session_id).filter(Boolean)).size;

    // Total pen distance from the precomputed per-drawing path lengths.
    const totalDistanceCm = (allDrawingMeta || []).reduce((acc, d) => acc + (d.path_length_cm || 0), 0);

    // DOS summary + distribution (0.25-wide bins over the observed 0–4 range).
    const dosValues = (dosRows || [])
      .map((r) => parseFloat(r.dos))
      .filter((v) => Number.isFinite(v));
    const avgDOS = dosValues.length ? dosValues.reduce((a, b) => a + b, 0) / dosValues.length : null;
    const sortedDos = [...dosValues].sort((a, b) => a - b);
    const medianDOS = sortedDos.length ? sortedDos[Math.floor(sortedDos.length / 2)] : null;
    const BIN = 0.25;
    const binCount = 16; // covers 0–4; anything above lands in the last bin
    const dosHistogram = Array.from({ length: binCount }, (_, i) => ({
      bin: +(i * BIN).toFixed(2),
      label: `${(i * BIN).toFixed(2)}–${((i + 1) * BIN).toFixed(2)}`,
      count: 0,
    }));
    for (const v of dosValues) {
      const i = Math.min(Math.floor(v / BIN), binCount - 1);
      dosHistogram[i].count++;
    }

    return NextResponse.json({
      totalUsers: totalUsers ?? 0,
      newUsers30d: newUsers30d ?? 0,
      totalDrawings: totalDrawings ?? 0,
      anonymousDrawings: anonymousDrawings ?? 0,
      totalAnalyses: totalAnalyses ?? 0,
      completedAnalyses: completedAnalyses ?? 0,
      timeoutAnalyses: timeoutAnalyses ?? 0,
      totalSessions,
      drawingsPerDay: [...perDay.entries()].map(([date, count]) => ({ date, count })),
      totalDistanceCm: +totalDistanceCm.toFixed(1),
      avgDOS: avgDOS !== null ? +avgDOS.toFixed(3) : null,
      medianDOS: medianDOS !== null ? +medianDOS.toFixed(3) : null,
      dosHistogram,
    });
  } catch (err) {
    console.error("[admin-stats] Server error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
