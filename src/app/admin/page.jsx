"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/authProvider";
import { supabase } from "@/lib/supabaseClient";
import { useSuperuser } from "@/lib/useSuperuser";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const C = {
  bg: "#E8ECF5",
  paper: "#FFFFFF",
  ink: "#1A1E35",
  inkSoft: "#3A4060",
  muted: "#8B93A8",
  line: "#CBD3E8",
  lineSoft: "#E2E8F4",
  accent: "#4B5BE0",
};

const mono = { fontFamily: "'IBM Plex Mono', monospace" };
const manrope = { fontFamily: "'Manrope', sans-serif" };

const card = {
  background: C.paper,
  border: `1px solid ${C.line}`,
  borderRadius: 14,
  boxShadow: "0 2px 12px rgba(99,102,241,0.06), 0 1px 3px rgba(0,0,0,0.03)",
  padding: "18px 20px",
};

function StatTile({ label, value, sub }) {
  return (
    <div style={{ ...card, flex: 1, minWidth: 150 }}>
      <div style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", color: C.muted, textTransform: "uppercase", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ ...manrope, fontWeight: 700, fontSize: 30, letterSpacing: "-0.02em", color: C.ink }}>
        {value ?? "—"}
      </div>
      {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  const { isSuperuser, loading: checkingAccess } = useSuperuser(user);

  useEffect(() => {
    if (!isSuperuser) return;
    const load = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error("No session");
        const res = await fetch("/api/admin-stats", { headers: { Authorization: `Bearer ${token}` } });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        setStats(body);
      } catch (err) {
        setError(err.message);
      }
    };
    load();
  }, [isSuperuser]);

  if (checkingAccess) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <p style={{ color: C.muted, fontSize: 14 }}>Checking access…</p>
      </div>
    );
  }

  if (!user || !isSuperuser) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <p style={{ color: C.muted, fontSize: 14 }}>
          {user ? "You are not authorized to view this page." : "Please log in to view this page."}
        </p>
      </div>
    );
  }

  const successRate =
    stats && stats.totalAnalyses > 0 ? `${((stats.completedAnalyses / stats.totalAnalyses) * 100).toFixed(1)}% completed` : null;

  const distance = stats?.totalDistanceCm
    ? stats.totalDistanceCm >= 100000
      ? `${(stats.totalDistanceCm / 100000).toFixed(2)} km`
      : `${Math.round(stats.totalDistanceCm / 100)} m`
    : null;
  const avgPerSpiral =
    stats?.totalDistanceCm && stats?.totalDrawings
      ? `${(stats.totalDistanceCm / stats.totalDrawings).toFixed(0)} cm per spiral`
      : null;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", padding: "36px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ ...mono, fontSize: 11, letterSpacing: "0.14em", color: C.accent, textTransform: "uppercase", marginBottom: 6 }}>
          Admin
        </div>
        <h1 style={{ ...manrope, fontWeight: 800, fontSize: 32, letterSpacing: "-0.02em", color: C.ink, margin: "0 0 24px" }}>
          Platform Overview
        </h1>

        {error && (
          <div style={{ ...card, borderColor: "#fecaca", color: "#991b1b", marginBottom: 20, fontSize: 14 }}>
            Failed to load stats: {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
          <StatTile label="Registered Users" value={stats?.totalUsers} sub={stats ? `+${stats.newUsers30d} in last 30 days` : null} />
          <StatTile label="Spirals Drawn" value={stats?.totalDrawings} sub={stats ? `${stats.anonymousDrawings} anonymous` : null} />
          <StatTile label="Sessions" value={stats?.totalSessions} />
          <StatTile label="Analyses Run" value={stats?.totalAnalyses} sub={successRate} />
          <StatTile label="Timeouts" value={stats?.timeoutAnalyses} sub="analysis engine timeouts" />
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
          <StatTile label="Average DOS" value={stats?.avgDOS} sub={stats?.medianDOS != null ? `median ${stats.medianDOS}` : null} />
          <StatTile label="Ink Spent" value={distance} sub={avgPerSpiral} />
        </div>

        <div style={{ ...card, marginTop: 6 }}>
          <div style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", color: C.muted, textTransform: "uppercase", marginBottom: 14 }}>
            Spirals Drawn — Last 30 Days
          </div>
          <div style={{ width: "100%", height: 260 }}>
            {stats ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.drawingsPerDay} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.lineSoft} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: C.muted }}
                    tickFormatter={(d) => d.slice(5)}
                    interval={4}
                    axisLine={{ stroke: C.line }}
                    tickLine={false}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(75,91,224,0.08)" }}
                    contentStyle={{ borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 12 }}
                    formatter={(v) => [v, "Spirals"]}
                  />
                  <Bar dataKey="count" fill={C.accent} radius={[4, 4, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 13 }}>
                Loading…
              </div>
            )}
          </div>
        </div>

        <div style={{ ...card, marginTop: 14 }}>
          <div style={{ ...mono, fontSize: 10, letterSpacing: "0.12em", color: C.muted, textTransform: "uppercase", marginBottom: 14 }}>
            DOS Distribution — Completed Analyses
          </div>
          <div style={{ width: "100%", height: 260 }}>
            {stats ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.dosHistogram} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.lineSoft} vertical={false} />
                  <XAxis
                    dataKey="bin"
                    tick={{ fontSize: 11, fill: C.muted }}
                    interval={1}
                    axisLine={{ stroke: C.line }}
                    tickLine={false}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(75,91,224,0.08)" }}
                    contentStyle={{ borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 12 }}
                    formatter={(v) => [v, "Analyses"]}
                    labelFormatter={(_, payload) => `DOS ${payload?.[0]?.payload?.label ?? ""}`}
                  />
                  <Bar dataKey="count" fill={C.accent} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 13 }}>
                Loading…
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
