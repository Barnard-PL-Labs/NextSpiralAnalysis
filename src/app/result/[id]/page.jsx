"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/authProvider";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/Header";
import styles from "@/styles/Result.module.css";
import { SpeedTimeChart, calculateSpeed } from "@/components/ST";
import SpiralPlot from "@/components/NewTimeTrace";
import { CanIAvoidBugByThis, PTChart } from "@/components/PressureTime";
import TremorPolarPlot from "@/components/Tremor";
import { Line3DPlot, processData } from "@/components/Angle";
import { FaDownload, FaComment, FaHandPaper } from "react-icons/fa";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { PressureVsX } from "@/components/PressureVsX";
import LineGraph from "@/components/LineGraph";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

/* ── Design tokens ── */
const C = {
  bg: "#E8ECF5",
  bg2: "#DDE2F0",
  paper: "#FFFFFF",
  ink: "#1A1E35",
  inkSoft: "#3A4060",
  muted: "#8B93A8",
  line: "#CBD3E8",
  lineSoft: "#E2E8F4",
  accent: "#4B5BE0",
  accentDark: "#3848C8",
  accentSoft: "#ECEEFF",
  teal: "#5B7BB3",
  hero: "#1A1E35",
  navy: "#3D4A7A",
};

/* ── Utilities ── */
function AnimatedEllipsis() {
  const [dots, setDots] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d + 1) % 4), 500);
    return () => clearInterval(id);
  }, []);
  return <span>{".".repeat(dots)}</span>;
}

const isNoAxis = (v) => typeof v === "string" && /^no axis$/i.test(v.trim());
const isInf = (v) => typeof v === "string" && /^inf(?:inity)?$/i.test(v.trim());
const coerceValue = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : (Number.isNaN(v) ? null : Infinity);
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    if (isNoAxis(s)) return null;
    if (isInf(s)) return Infinity;
    const n = Number(s);
    return Number.isNaN(n) ? null : n;
  }
  return null;
};
const coerceResult = (obj) => {
  if (!obj || typeof obj !== "object") return null;
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = coerceValue(v);
  return out;
};
const avg = (arr) => {
  const vals = arr.filter((n) => n !== null && Number.isFinite(n));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
};
const formatNum = (n, d = 2) => {
  if (n === null || n === undefined) return "N/A";
  if (n === Infinity) return "∞";
  const a = Math.abs(n);
  if ((a >= 0.001 && a < 1e6) || n === 0) return n.toFixed(d);
  return n.toExponential(2);
};
const pickTremorHz = (r) => {
  if (!r) return null;
  if (r["Speed Freq"] !== null) return r["Speed Freq"];
  if (r["X Freq"] !== null && r["Y Freq"] !== null) return (r["X Freq"] + r["Y Freq"]) / 2;
  if (r["Ang Sp Freq"] !== null) return r["Ang Sp Freq"];
  return null;
};
const pickTightness = (r) => {
  if (!r) return null;
  if (r["Tightness"] !== null && r["Tightness"] !== undefined) return r["Tightness"];
  return null;
};
const pickSecondOSM = (r) => {
  if (!r) return null;
  if (r["2nd order sm"] !== null && r["2nd order sm"] !== undefined) return r["2nd order sm"] - 3;
  return null;
};

/* ── Tremor polar helpers ── */
function arrowheadTrace(R, thetaDeg, len, halfWidth, color) {
  const θ = (thetaDeg * Math.PI) / 180;
  const tipX = R * Math.sin(θ), tipY = R * Math.cos(θ);
  const baseX = (R - len) * Math.sin(θ), baseY = (R - len) * Math.cos(θ);
  const perpX = Math.cos(θ), perpY = -Math.sin(θ);
  const lX = baseX + halfWidth * perpX, lY = baseY + halfWidth * perpY;
  const rX = baseX - halfWidth * perpX, rY = baseY - halfWidth * perpY;
  const toPolar = (x, y) => ({ r: Math.sqrt(x * x + y * y), t: ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360 });
  const tip = toPolar(tipX, tipY), left = toPolar(lX, lY), rght = toPolar(rX, rY);
  return { type: "scatterpolar", mode: "lines", r: [tip.r, left.r, rght.r, tip.r], theta: [tip.t, left.t, rght.t, tip.t], fill: "toself", fillcolor: color, line: { color, width: 0 }, showlegend: false, hoverinfo: "skip" };
}
function normalizePowers(powers) {
  const valid = powers.filter((p) => Number.isFinite(p));
  const pMax = valid.length ? Math.max(...valid) : 1;
  const pMin = valid.length ? Math.min(...valid) : 0;
  return powers.map((p) => (!Number.isFinite(p) || pMax === pMin) ? 0.6 : 0.35 + ((p - pMin) / (pMax - pMin)) * 0.95);
}
function buildAxesTraces(anglesDeg, powers, color) {
  if (!anglesDeg?.length) return [];
  const scaled = normalizePowers(powers);
  const traces = [];
  anglesDeg.forEach((deg, i) => {
    if (deg == null || !Number.isFinite(deg)) return;
    let offset = 0;
    for (let j = 0; j < i; j++) {
      const d = Math.abs((anglesDeg[j] ?? 1000) - deg);
      const opp = Math.abs(((anglesDeg[j] ?? 1000) + 180) - deg);
      if (d < 5 || opp < 5) offset += 6;
    }
    const theta = deg + offset;
    const rLen = scaled[i];
    const numPoints = 14;
    const arrowLen = rLen * 0.12, arrowHalf = rLen * 0.07, lineEnd = rLen * 0.88;
    const linePoints = Array.from({ length: numPoints }, (_, j) => lineEnd * (j / (numPoints - 1)));
    const hover = `Axis ${i + 1}<br>Dir: ${theta.toFixed(0)}°<br>Rel Pow: ${formatNum(powers[i] ?? 0.6, 2)}<extra></extra>`;
    traces.push({ type: "scatterpolar", mode: "lines", r: linePoints, theta: Array(numPoints).fill(theta), line: { color, width: 3 }, hovertemplate: hover, showlegend: false });
    traces.push(arrowheadTrace(rLen, theta, arrowLen, arrowHalf, color));
    traces.push({ type: "scatterpolar", mode: "lines", r: linePoints, theta: Array(numPoints).fill(theta + 180), line: { color, width: 3 }, hovertemplate: hover, showlegend: false });
    traces.push(arrowheadTrace(rLen, theta + 180, arrowLen, arrowHalf, color));
  });
  traces.push({ type: "scatterpolar", mode: "markers", r: [0], theta: [0], marker: { color: "#111", size: 5 }, hoverinfo: "skip", showlegend: false });
  return traces;
}

/* ── Tremor axes split (summary view) ── */
function TremorAxesSplit({ drawings, typedResults }) {
  const L = { angles: [], powers: [] };
  const R = { angles: [], powers: [] };
  drawings.forEach((d, i) => {
    const r = typedResults[i];
    if (!r) return;
    const dir1 = r.traxis_dir1 ?? r["traxis_dir1"] ?? null;
    const pw1 = r.traxis_pw1 ?? r["traxis_pw1"] ?? null;
    if (d?.hand_side === "L") { L.angles.push(Number.isFinite(dir1) ? dir1 : null); L.powers.push(Number.isFinite(pw1) ? pw1 : 0.6); }
    else if (d?.hand_side === "R") { R.angles.push(Number.isFinite(dir1) ? dir1 : null); R.powers.push(Number.isFinite(pw1) ? pw1 : 0.6); }
  });
  const leftTraces = buildAxesTraces(L.angles, L.powers, "#0f766e");
  const rightTraces = buildAxesTraces(R.angles, R.powers, "#1d4ed8");
  const mkLayout = () => ({
    polar: { radialaxis: { visible: false, range: [0, 1.35] }, angularaxis: { direction: "clockwise", tickmode: "linear", dtick: 30, rotation: 90, tickfont: { size: 10, color: "#222" } }, bgcolor: "rgba(0,0,0,0)" },
    margin: { l: 8, r: 8, b: 8, t: 8 },
    showlegend: false,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    dragmode: false,
  });

  const PolarCard = ({ title, icon, traces, caption, flip }) => (
    <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 18, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <FaHandPaper aria-hidden style={{ width: 16, height: 16, transform: flip ? "scaleX(-1)" : "none" }} />
        <h4 style={{ margin: 0, fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 15, color: C.ink }}>{title}</h4>
      </div>
      {traces.length ? (
        <div style={{ width: "100%", height: 320, display: "grid", gridTemplateRows: "1fr auto", alignItems: "stretch" }}>
          <div style={{ minHeight: 0 }}>
            <Plot data={traces} layout={mkLayout()} config={{ displayModeBar: false, responsive: true }} style={{ width: "100%", height: "100%" }} />
          </div>
          <div style={{ textAlign: "center", fontSize: 11, color: C.muted, paddingTop: 6 }}>{caption}</div>
        </div>
      ) : (
        <div style={{ width: "100%", height: 320, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>No axes yet.</div>
      )}
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
      <PolarCard title="Tremor Axes — Left" traces={leftTraces} caption="Superimposed primary axes from left-hand spirals" />
      <PolarCard title="Tremor Axes — Right" traces={rightTraces} caption="Superimposed primary axes from right-hand spirals" flip />
    </div>
  );
}

/* ── Summary panel ── */
function SummaryPanel({ drawings, typedResults, perStatusCounts }) {
  const total = drawings.length;

  const groups = useMemo(() => {
    const L = [], R = [], U = [];
    drawings.forEach((d, i) => {
      if (d?.hand_side === "L") L.push(i);
      else if (d?.hand_side === "R") R.push(i);
      else U.push(i);
    });
    return { L, R, U };
  }, [drawings]);

  const perHandStats = (idxs) => {
    const arr = idxs.map((i) => typedResults[i]).filter(Boolean);
    return {
      count: idxs.length,
      completed: arr.length,
      avgDOS: avg(arr.map((r) => r.DOS ?? null)),
      avgTremor: avg(arr.map((r) => pickTremorHz(r))),
      avgTightness: avg(arr.map((r) => pickTightness(r))),
      avgSecondOSm: avg(arr.map((r) => pickSecondOSM(r))),
    };
  };

  const Ls = perHandStats(groups.L);
  const Rs = perHandStats(groups.R);
  const overallAvg = avg(typedResults.filter(Boolean).map((r) => r.DOS ?? null));

  const mono = { fontFamily: "'IBM Plex Mono', monospace" };
  const manrope = { fontFamily: "'Manrope', sans-serif" };

  const StatDivider = () => <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.1)" }} />;

  const HeroStat = ({ label, value, valueColor }) => (
    <div style={{ flex: 1, padding: "0 20px" }}>
      <div style={{ ...mono, fontSize: 9.5, letterSpacing: "0.1em", color: "#A8B8CC", marginBottom: 5 }}>{label}</div>
      <div style={{ ...manrope, fontWeight: 700, fontSize: 18, color: valueColor || "#fff" }}>{value}</div>
    </div>
  );

  const HandMetric = ({ label, value }) => (
    <div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 5 }}>{label}</div>
      <div style={{ ...mono, fontSize: 20, fontWeight: 500, color: C.ink }}>{value}</div>
    </div>
  );

  const HandPanel = ({ side, stats, isActive }) => {
    const dotColor = isActive ? C.teal : C.line;
    const letterBg = isActive ? C.accent : C.bg2;
    const letterColor = isActive ? "#fff" : C.muted;
    const isProcessing = isActive && stats.completed < stats.count;

    return (
      <div style={{ padding: "24px 28px 28px", borderRight: side === "L" ? `1px solid ${C.line}` : "none" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: letterBg, display: "flex", alignItems: "center", justifyContent: "center", ...manrope, fontWeight: 700, fontSize: 11, color: letterColor }}>{side}</div>
            <span style={{ ...manrope, fontWeight: 700, fontSize: 14, color: C.ink }}>{side === "L" ? "Left Hand" : "Right Hand"}</span>
          </div>
          <span style={{ ...mono, fontSize: 10, color: isActive ? C.teal : C.muted, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 20, padding: "3px 10px" }}>
            {isActive ? `${stats.completed} completed` : "No data"}
          </span>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "7px 12px 7px 10px", background: isActive ? "rgba(91,123,179,0.08)" : C.bg, border: `1px solid ${isActive ? "rgba(91,123,179,0.18)" : C.line}`, borderRadius: 8, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 3 }}>
            {Array.from({ length: stats.count || 1 }).map((_, i) => {
              const isCompleted = i < stats.completed;
              const isProcessingDot = isProcessing && i === stats.completed;
              return (
                <div
                  key={i}
                  className={isProcessingDot ? styles.processingDot : undefined}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: isProcessingDot ? undefined : isCompleted ? dotColor : C.line,
                  }}
                />
              );
            })}
          </div>
          <span style={{ ...mono, fontSize: 12, fontWeight: 500, color: isActive ? C.teal : C.muted }}>{stats.completed}/{stats.count}</span>
          <span style={{ fontSize: 11, color: C.muted }}>processed</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 16px" }}>
          <HandMetric label="Avg DOS" value={formatNum(stats.avgDOS, 4)} />
          <HandMetric label="Avg Tremor (Hz)" value={formatNum(stats.avgTremor, 2)} />
          <HandMetric label="Avg Tightness (cycles)" value={formatNum(stats.avgTightness, 4)} />
          <HandMetric label="Avg 2nd Order Smoothness" value={formatNum(stats.avgSecondOSm, 4)} />
        </div>
      </div>
    );
  };

  return (
    <>
      <div style={{ borderRadius: 22, overflow: "hidden", marginBottom: 18, boxShadow: "0 1px 0 rgba(0,0,0,0.04), 0 16px 40px -16px rgba(11,27,43,0.35)" }}>
        {/* Dark hero */}
        <div style={{ background: C.hero, padding: "32px 40px 36px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, letterSpacing: "0.14em", color: "#7A94AA" }}>SESSION RESULT</span>
            <span style={{ width: 1, height: 10, background: "rgba(255,255,255,0.08)" }} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, color: "#7A94AA" }}>
              {drawings[0]?.created_at ? new Date(drawings[0].created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
            </span>
            <span style={{ marginLeft: "auto", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#9EF2D6", background: "rgba(27,146,127,0.16)", border: "1px solid rgba(158,242,214,0.34)", borderRadius: 20, padding: "4px 12px", boxShadow: "0 0 18px rgba(27,146,127,0.24), inset 0 0 10px rgba(158,242,214,0.08)", textShadow: "0 0 10px rgba(158,242,214,0.45)" }}>
              {perStatusCounts.completed} / {drawings.length} processed
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20 }}>
            <HeroStat label="TOTAL SPIRALS" value={drawings.length} />
            <StatDivider />
            <HeroStat label="COMPLETED" value={`${perStatusCounts.completed}/${drawings.length}`} valueColor="#91C8E0" />
            <StatDivider />
            <HeroStat label="TIMEOUTS" value={perStatusCounts.timeout} valueColor="#8A9EBA" />
            <StatDivider />
            <HeroStat label="FAILURES" value={perStatusCounts.failed} valueColor="#8A9EBA" />
            <StatDivider />
            <HeroStat label="AVG DOS OVERALL" value={formatNum(overallAvg, 2)} />
          </div>
        </div>

        {/* Hand data */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: C.paper }}>
          <HandPanel side="L" stats={Ls} isActive={groups.L.length > 0} />
          <HandPanel side="R" stats={Rs} isActive={groups.R.length > 0} />
        </div>
      </div>

      <TremorAxesSplit drawings={drawings} typedResults={typedResults} />
    </>
  );
}

/* ── Main page ── */
export default function UnifiedResultPage() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params?.id || searchParams.get("session");

  const [drawings, setDrawings] = useState([]);
  const [results, setResults] = useState([]);
  const [selectedDrawingIndex, setSelectedDrawingIndex] = useState(0);
  const [loadingResult, setLoadingResult] = useState(true);
  const [error, setError] = useState(null);
  const [drawData, setDrawData] = useState([]);
  const [result, setResult] = useState(null);
  const [speedData, setSpeedData] = useState([]);
  const [angleData, setAngleData] = useState([]);
  const [pData, setPData] = useState([]);
  const [analysisHistory, setAnalysisHistory] = useState(null);
  const [activeTab, setActiveTab] = useState("charts");
  const [liveAnalysisState, setLiveAnalysisState] = useState({ sessionActive: false, isSessionComplete: false, totalDrawings: 0, completed: 0 });
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRatings, setFeedbackRatings] = useState({ usability: 0, analysisAccuracy: 0, performanceSpeed: 0, visualDesign: 0 });
  const [feedbackSuggestion, setFeedbackSuggestion] = useState("");
  const [hoveredStar, setHoveredStar] = useState({ category: null, starIndex: null });

  const updateCharts = (index, drawingsArray, resultsArray) => {
    const drawingData = drawingsArray[index]?.drawing_data;
    if (!drawingData) return;
    setDrawData(drawingData);
    setSpeedData(calculateSpeed(drawingData));
    setAngleData(processData(drawingData));
    setPData(CanIAvoidBugByThis(drawingData));
    const currentDrawing = drawingsArray[index];
    if (currentDrawing) {
      const drawingResult = resultsArray.find((r) => r.drawing_id === currentDrawing.id);
      setResult(drawingResult?.status === "completed" ? drawingResult.result_data : null);
    }
  };

  const handleRealTimeUpdate = (payload) => {
    const newRecord = payload.new;
    setResults((prev) => {
      const i = prev.findIndex((r) => r.id === newRecord.id);
      return i !== -1 ? prev.map((r, k) => (k === i ? newRecord : r)) : [...prev, newRecord];
    });
  };

  useEffect(() => {
    if (!sessionId) { router.push("/"); return; }
    const load = async () => {
      try {
        setLoadingResult(true);
        setLiveAnalysisState((s) => ({ ...s, sessionActive: true }));
        const { data: drawingsData, error: drawingsError } = await supabase.from("drawings").select("*").eq("session_id", sessionId).order("created_at", { ascending: true });
        if (drawingsError) throw drawingsError;
        const finalDrawings = drawingsData || [];
        setDrawings(finalDrawings);
        setLiveAnalysisState((s) => ({ ...s, totalDrawings: finalDrawings.length }));
        if (finalDrawings.length > 0) {
          const ids = finalDrawings.map((d) => d.id);
          const { data: resultsData, error: resultsError } = await supabase.from("api_results").select("*").in("drawing_id", ids);
          if (resultsError) throw resultsError;
          setResults(resultsData || []);
        }
      } catch (err) {
        console.error("Error loading result page:", err);
        setError("Failed to load analysis results.");
      } finally {
        setLoadingResult(false);
      }
    };
    load();
    const sub = supabase
      .channel(`results-for-session-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "api_results", filter: `session_id=eq.${sessionId}` }, handleRealTimeUpdate)
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, [sessionId, router]);

  useEffect(() => {
    if (drawings.length === 0 && !loadingResult) return;
    const individual = drawings.map((d) => {
      const r = results.find((x) => x.drawing_id === d.id);
      if (!r) return { status: "pending" };
      if (r.status === "failed") return { error: true, message: r.result_data?.error };
      if (r.status === "timeout") return { status: "timeout", message: r.result_data?.message };
      if (r.status === "completed") return r.result_data;
      return { status: "processing" };
    });
    const completed = individual.filter((r) => r && !r.status && !r.error);
    const dos = completed.map((r) => Number(r.DOS)).filter((n) => !Number.isNaN(n));
    const avgDOS = dos.length ? (dos.reduce((a, b) => a + b, 0) / dos.length).toFixed(2) : null;
    setAnalysisHistory({ individual_results: individual, total_drawings: drawings.length, successful_drawings: completed.length, average_DOS: avgDOS });
    setLiveAnalysisState((s) => ({ ...s, completed: completed.length, isSessionComplete: drawings.length > 0 && completed.length === drawings.length }));
    updateCharts(selectedDrawingIndex, drawings, results);
  }, [drawings, results, selectedDrawingIndex, loadingResult]);

  const typedResultsByIndex = useMemo(
    () => drawings.map((d) => { const m = results.find((r) => r.drawing_id === d.id && r.status === "completed"); return m ? coerceResult(m.result_data) : null; }),
    [drawings, results]
  );

  const perStatusCounts = useMemo(() => {
    let completed = 0, timeout = 0, failed = 0, pending = 0, processing = 0;
    drawings.forEach((d) => {
      const r = results.find((x) => x.drawing_id === d.id);
      if (!r) { pending++; return; }
      if (r.status === "completed") completed++;
      else if (r.status === "timeout") timeout++;
      else if (r.status === "failed") failed++;
      else processing++;
    });
    return { completed, timeout, failed, pending, processing };
  }, [drawings, results]);

  const getDOSScore = () => {
    if (loadingResult) return null;
    if (!analysisHistory || !liveAnalysisState.isSessionComplete) return null;
    return analysisHistory.average_DOS || "N/A";
  };

  const getProgressDisplay = () => {
    if (liveAnalysisState.sessionActive && !liveAnalysisState.isSessionComplete) {
      const completedCount = Math.min(liveAnalysisState.completed, liveAnalysisState.totalDrawings);
      const current = Math.min(completedCount + 1, liveAnalysisState.totalDrawings);
      if (liveAnalysisState.totalDrawings === 0 && !loadingResult) return null;
      if (liveAnalysisState.totalDrawings === 0 && loadingResult) return <p>Loading session<AnimatedEllipsis /></p>;
      return <p>Analyzing: {current}/{liveAnalysisState.totalDrawings}<AnimatedEllipsis /></p>;
    }
    return null;
  };

  const areAllAnalysesCompleted = () => {
    const ar = analysisHistory?.individual_results;
    if (!ar) return false;
    const hasValid = ar.some((r) => r && !r.error && !r.status && r.DOS !== undefined);
    if (!hasValid) return false;
    return ar.every((r) => r && ((!r.error && !r.status && r.DOS !== undefined) || r.error || r.status === "timeout"));
  };

  const handleFeedbackSubmit = async () => {
    try {
      const { error } = await supabase.from("feedback").insert([{
        session_id: sessionId,
        created_at: new Date().toISOString(),
        usability_rating: feedbackRatings.usability || 0,
        analysis_accuracy_rating: feedbackRatings.analysisAccuracy || 0,
        performance_speed_rating: feedbackRatings.performanceSpeed || 0,
        visual_design_rating: feedbackRatings.visualDesign || 0,
        suggestion_text: feedbackSuggestion.trim() || null,
        user_id: user?.id || null,
      }]);
      if (error) { console.error("Error saving feedback:", error); alert("Failed to save feedback. Please try again."); return; }
      setShowFeedbackModal(false);
      setFeedbackRatings({ usability: 0, analysisAccuracy: 0, performanceSpeed: 0, visualDesign: 0 });
      setFeedbackSuggestion("");
    } catch (e) {
      console.error("Error submitting feedback:", e);
      alert("Failed to submit feedback. Please try again.");
    }
  };

  const downloadResults = () => {
    if (!analysisHistory) { alert("No results are available to download yet."); return; }
    const data = {
      session_id: sessionId,
      generated_at: new Date().toISOString(),
      analysis_summary: { total_drawings: analysisHistory.total_drawings, successful_drawings: analysisHistory.successful_drawings, average_DOS: analysisHistory.average_DOS },
      hand_selection: drawings.length > 0 ? drawings[0].hand_used : null,
      hand_side: drawings.length > 0 ? drawings[0].hand_side : null,
      demographics: drawings.length > 0 ? { user_name: drawings[0].user_name, user_age: drawings[0].user_age, user_sex: drawings[0].user_sex } : null,
      individual_results: analysisHistory.individual_results,
      raw_drawing_data: drawings.map((d) => ({ drawing_id: d.id, created_at: d.created_at, hand_used: d.hand_used, hand_side: d.hand_side, user_name: d.user_name, user_age: d.user_age, user_sex: d.user_sex, data: d.drawing_data })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spiral_analysis_${sessionId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const manrope = { fontFamily: "'Manrope', sans-serif" };
  const mono = { fontFamily: "'IBM Plex Mono', monospace" };

  const TabBtn = ({ id, label }) => {
    const active = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        style={{
          ...manrope,
          position: "relative",
          zIndex: 1,
          width: 92,
          fontSize: 13,
          fontWeight: 600,
          padding: "4px 0",
          borderRadius: 7,
          border: "none",
          cursor: "pointer",
          background: "transparent",
          color: active ? "#fff" : C.muted,
          transition: "color 0.22s ease",
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div className={styles.pageWrapper}>
      <Header showVideo={false} />
      <div className={styles.container}>

          {/* Page title */}
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ ...manrope, fontWeight: 800, fontSize: 26, letterSpacing: "-0.02em", color: C.ink, margin: "0 0 5px" }}>Analysis Results</h1>
            {getDOSScore() && (
              <p style={{ fontSize: 13.5, color: C.muted, margin: "0 0 18px" }}>
                Average DOS Score: <strong style={{ color: C.accent, fontWeight: 600 }}>{getDOSScore()}</strong>
              </p>
            )}
            {getProgressDisplay() && <div style={{ fontSize: 13.5, color: C.muted, margin: "0 0 18px" }}>{getProgressDisplay()}</div>}
            {error && <p style={{ fontSize: 13.5, color: "#dc2626", margin: "0 0 18px" }}>{error}</p>}
            <div style={{ position: "relative", display: "inline-grid", gridTemplateColumns: "92px 92px", background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10, padding: 2, overflow: "hidden" }}>
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: 2,
                  bottom: 2,
                  left: 2,
                  width: 92,
                  borderRadius: 7,
                  background: C.ink,
                  boxShadow: "0 1px 3px rgba(26,30,53,0.2)",
                  transform: activeTab === "summary" ? "translateX(0)" : "translateX(92px)",
                  transition: "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />
              <TabBtn id="summary" label="Summary" />
              <TabBtn id="charts" label="Charts" />
            </div>
          </div>

          {/* Summary view */}
          {activeTab === "summary" && (
            <SummaryPanel drawings={drawings} typedResults={typedResultsByIndex} perStatusCounts={perStatusCounts} />
          )}

          {/* Charts view */}
          {activeTab === "charts" && (
            <>
              {(analysisHistory || liveAnalysisState.sessionActive) && drawings.length > 0 && (() => {
                const curRaw = analysisHistory?.individual_results?.[selectedDrawingIndex];
                const curTyped = typedResultsByIndex[selectedDrawingIndex];
                const pickCOV = (r) => {
                  if (!r) return null;
                  for (const k of ["COV of width", "COV Width", "COV of Width", "Coeff Var Width", "cov_width"]) {
                    if (r[k] !== null && r[k] !== undefined) return r[k];
                  }
                  return null;
                };
                const isReady = curRaw && !curRaw.status && !curRaw.error;
                const PendingValue = ({ label, status }) => (
                  <span className={`${styles.pendingMetric} ${status === "processing" ? styles.pendingMetricAnalyzing : ""}`}>
                    <span className={styles.processingDot} />
                    {label}
                  </span>
                );
                const pendingStatus = curRaw?.status === "processing" ? "processing" : "waiting";
                const pendingLabel = pendingStatus === "processing" ? "Analyzing result" : "Waiting for analysis";
                const getDVal = (pick, d = 4) => isReady ? formatNum(pick(curTyped), d) : (curRaw?.error ? "Failed" : curRaw?.status === "timeout" ? "Timeout" : <PendingValue label={pendingLabel} status={pendingStatus} />);
                const valColor = !curRaw ? "#92400e" : curRaw.error || curRaw.status === "timeout" ? "#991b1b" : curRaw.status ? "#92400e" : C.ink;

                return (
                  <>
                    <div style={{ background: C.paper, border: `1px solid ${C.line}`, borderRadius: 20, overflow: "hidden", boxShadow: "0 1px 0 rgba(0,0,0,0.03), 0 8px 24px -12px rgba(11,27,43,0.1)", marginBottom: 12 }}>
                      <div style={{ padding: "14px 24px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 16 }}>
                        <span style={{ ...mono, fontSize: 9.5, letterSpacing: "0.14em", color: C.accent, flexShrink: 0 }}>INDIVIDUAL DRAWINGS</span>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {drawings.map((d, i) => {
                            const active = selectedDrawingIndex === i;
                            const rs = analysisHistory?.individual_results?.[i];
                            const hasError = rs?.error || rs?.status === "timeout";
                            return (
                              <button
                                key={i}
                                onClick={() => { setSelectedDrawingIndex(i); updateCharts(i, drawings, results); }}
                                style={{ ...manrope, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 5, border: "none", cursor: "pointer", background: active ? C.ink : "transparent", color: active ? "#fff" : hasError ? "#991b1b" : C.muted }}
                              >
                                #{i + 1} · {d.hand_side || "?"}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "stretch", padding: "20px 28px" }}>
                        {[
                          { label: "DOS Score", value: getDVal((r) => r?.DOS) },
                          { label: "Tightness (cycles)", value: getDVal((r) => pickTightness(r)) },
                          { label: "2nd Order Smoothness", value: getDVal((r) => pickSecondOSM(r)) },
                          { label: "COV of Width", value: getDVal((r) => pickCOV(r)) },
                        ].map(({ label, value }, i) => (
                          <div key={i} style={{ flex: 1, display: "flex", alignItems: "stretch" }}>
                            {i > 0 && <div style={{ width: 1, background: C.line, margin: "0 20px" }} />}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, color: C.muted, marginBottom: 5 }}>{label}</div>
                              <div style={{ ...manrope, fontWeight: 700, fontSize: 22, letterSpacing: "-0.02em", color: valColor }}>{value}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
                      {[
                        { label: "ORIGINAL SPIRAL", content: <LineGraph data={drawData} /> },
                        { label: "SPEED VS. TIME", content: <SpeedTimeChart speedData={speedData} /> },
                        { label: "3D SPIRAL VIEW", content: <SpiralPlot data={drawData} /> },
                        { label: "PRESSURE VS TIME", content: <PTChart data={drawData} /> },
                        { label: "TREMOR AXES", content: loadingResult ? <p style={{ color: C.muted, fontSize: 13 }}>Loading tremor data...</p> : <TremorPolarPlot result={result} /> },
                        { label: "PRESSURE VS X", content: <PressureVsX data={drawData} bins={60} minPerBin={12} samplePoints={500} splitByQuadrant={false} /> },
                      ].map(({ label, content }) => (
                        <div key={label} style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(199,210,254,0.5)", borderRadius: 14, boxShadow: "0 2px 12px rgba(99,102,241,0.06), 0 1px 3px rgba(0,0,0,0.03)", padding: "16px 16px 14px", display: "flex", flexDirection: "column", minHeight: 360 }}>
                          <div style={{ ...mono, fontSize: 9.5, letterSpacing: "0.12em", color: C.muted, marginBottom: 12, textTransform: "uppercase" }}>{label}</div>
                          <div style={{ flex: 1, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,0.98))", border: "1px solid rgba(226,232,240,0.8)", borderRadius: 10, padding: 8 }}>
                            {content}
                          </div>
                        </div>
                      ))}
                    </div>

                    {areAllAnalysesCompleted() && (
                      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, paddingTop: 10 }}>
                        <button
                          onClick={downloadResults}
                          style={{ fontFamily: "'Public Sans', sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", background: C.ink, border: `1px solid ${C.ink}`, padding: "10px 18px", borderRadius: 9, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minWidth: 154, boxShadow: "0 4px 12px -8px rgba(26,30,53,0.45)", transition: "background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, transform 0.14s ease" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = C.navy; e.currentTarget.style.borderColor = C.navy; e.currentTarget.style.boxShadow = "0 8px 18px -12px rgba(26,30,53,0.55)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = C.ink; e.currentTarget.style.borderColor = C.ink; e.currentTarget.style.boxShadow = "0 4px 12px -8px rgba(26,30,53,0.45)"; e.currentTarget.style.transform = "translateY(0)"; }}
                          onMouseDown={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
                        >
                          <FaDownload size={13} /> Download Results
                        </button>
                        <button
                          onClick={() => setShowFeedbackModal(true)}
                          style={{ fontFamily: "'Public Sans', sans-serif", fontSize: 13, fontWeight: 700, color: C.inkSoft, background: C.paper, border: `1px solid ${C.line}`, padding: "10px 18px", borderRadius: 9, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minWidth: 124, boxShadow: "0 1px 0 rgba(0,0,0,0.03)", transition: "background 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.14s ease" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = C.accentSoft; e.currentTarget.style.borderColor = C.line; e.currentTarget.style.color = C.accentDark; e.currentTarget.style.boxShadow = "0 6px 16px -14px rgba(26,30,53,0.45)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = C.paper; e.currentTarget.style.borderColor = C.line; e.currentTarget.style.color = C.inkSoft; e.currentTarget.style.boxShadow = "0 1px 0 rgba(0,0,0,0.03)"; e.currentTarget.style.transform = "translateY(0)"; }}
                          onMouseDown={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
                        >
                          <FaComment size={13} /> Feedback
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          )}

      </div>

      {/* Feedback modal */}
      {showFeedbackModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 12, padding: 24, maxWidth: 650, width: "90%", maxHeight: "70vh", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, position: "relative" }}>
              <h3 style={{ margin: 0, color: "navy", fontSize: 30, fontWeight: 600, marginTop: 12, marginBottom: 10 }}>Rate Your Experience!</h3>
              <button onClick={() => setShowFeedbackModal(false)} style={{ background: "none", border: "none", fontSize: 25, cursor: "pointer", color: "#444", padding: 0, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, position: "absolute", top: -5, right: 0 }}>×</button>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: "1.1" }}>
                {[{ key: "usability", label: "Usability" }, { key: "analysisAccuracy", label: "Percieved Analysis Accuracy" }, { key: "performanceSpeed", label: "Performance & Speed" }, { key: "visualDesign", label: "Visual Design" }].map(({ key, label }) => (
                  <div key={key} style={{ marginBottom: 16 }}>
                    <div style={{ marginBottom: 12, fontWeight: 500, color: "navy", textDecoration: "underline", paddingBottom: 4 }}>{label}</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {[1,2,3,4,5].map((n) => {
                        const selected = feedbackRatings[key] >= n;
                        const hovered = hoveredStar.category === key && hoveredStar.starIndex >= n;
                        return (
                          <div key={n} style={{ position: "relative", display: "inline-block" }} onMouseEnter={() => setHoveredStar({ category: key, starIndex: n })} onMouseLeave={() => setHoveredStar({ category: null, starIndex: null })}>
                            <button onClick={() => setFeedbackRatings((prev) => ({ ...prev, [key]: n }))} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, fontSize: 18, color: "#666" }}>★</button>
                            {(selected || hovered) && <div style={{ position: "absolute", top: 2, left: 2, fontSize: 18, color: "#FFD700", pointerEvents: "none" }}>★</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ flex: "1.2" }}>
                <div style={{ marginBottom: 8, textDecoration: "underline", fontWeight: 500, fontSize: 24, color: "navy", marginTop: -75, marginBottom: 40, textAlign: "center" }}>Suggestions</div>
                <textarea value={feedbackSuggestion} onChange={(e) => setFeedbackSuggestion(e.target.value)} placeholder="Share your suggestions for improvement!" style={{ width: "105%", maxWidth: "105%", minHeight: 300, padding: 12, border: "3px solid navy", borderRadius: 6, fontSize: 14, fontFamily: "inherit", resize: "vertical", marginTop: -10, marginLeft: -10, backgroundColor: "white", color: "black" }} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -25 }}>
              <button onClick={handleFeedbackSubmit} style={{ padding: "8px 16px", border: "none", borderRadius: 6, background: "navy", color: "white", cursor: "pointer", fontSize: 14, fontWeight: 500 }}>Submit Feedback</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
