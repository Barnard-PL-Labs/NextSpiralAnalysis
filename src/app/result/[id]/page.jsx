"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/authProvider";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/Header";
import styles from "@/styles/Result.module.css";
import LineGraph from "@/components/LineGraph";
import { SpeedTimeChart, calculateSpeed } from "@/components/ST";
import SpiralPlot from "@/components/NewTimeTrace";
import { CanIAvoidBugByThis, PTChart } from "@/components/PressureTime";
import TremorPolarPlot from "@/components/Tremor";
import { Line3DPlot, processData } from "@/components/Angle";
import { FaDownload, FaComment, FaHandPaper } from "react-icons/fa";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { PressureVsX } from '@/components/PressureVsX';


/* Plotly for Summary-only Tremor Axes overlay (styling-only use) */
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

/* ---------- small utils ---------- */

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
/* prefer Speed Freq; else mean(X/Y Freq); else Ang Sp Freq */
const pickTremorHz = (r) => {
  if (!r) return null;
  if (r["Speed Freq"] !== null) return r["Speed Freq"];
  if (r["X Freq"] !== null && r["Y Freq"] !== null) return (r["X Freq"] + r["Y Freq"]) / 2;
  if (r["Ang Sp Freq"] !== null) return r["Ang Sp Freq"];
  return null;
};

/* ---------- UI atoms (Summary only) ---------- */

const Segmented = ({ value, onChange }) => (
  <div
    role="tablist"
    aria-label="View"
    // container: no pill; let each button look like the #1 chip
    style={{
      display: "flex",
      gap: "10px",
      justifyContent: "center",
      background: "transparent",
      border: "none",
    }}
  >
    {[
      { key: "summary", label: "Summary" },
      { key: "charts", label: "Charts" },
    ].map(({ key, label }) => {
      const selected = value === key;
      const baseBg = "rgba(255,255,255,0.1)";
      const selBg = "rgba(255,255,255,0.3)";
      return (
        <button
          key={key}
          role="tab"
          aria-selected={selected}
          onClick={() => onChange(key)}
          onMouseEnter={(e) => {
            if (!selected) e.currentTarget.style.background = "rgba(255,255,255,0.2)";
          }}
          onMouseLeave={(e) => {
            if (!selected) e.currentTarget.style.background = baseBg;
          }}
          style={{
            padding: "5px 10px",
            background: selected ? selBg : baseBg,
            color: "white",
            borderRadius: "4px",
            fontSize: "14px",
            fontWeight: 700,
            cursor: "pointer",
            border: selected ? "2px solid white" : "2px solid transparent",
            transition: "all 0.2s ease",
            minWidth: 90,
          }}
        >
          {label}
        </button>
      );
    })}
  </div>
);


const Card = ({ children, style }) => (
  <div
    style={{
      background: "white",
      border: "1px solid #e6e6e6",
      borderRadius: 16,
      boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
      ...style,
    }}
  >
    {children}
  </div>
);

const KPI = ({ label, value, sub, tone = "neutral" }) => {
  const tones = {
    neutral: { bg: "#f9fafb", bd: "#e5e7eb" },
    good: { bg: "rgba(16,185,129,0.08)", bd: "rgba(16,185,129,0.35)" },
    warn: { bg: "rgba(245,158,11,0.08)", bd: "rgba(245,158,11,0.35)" },
    bad: { bg: "rgba(239,68,68,0.08)", bd: "rgba(239,68,68,0.35)" },
    info: { bg: "rgba(59,130,246,0.08)", bd: "rgba(59,130,246,0.35)" },
  }[tone] || {};
  return (
    <div
      style={{
        padding: 14,
        minWidth: 170,
        textAlign: "center",
        background: tones.bg,
        border: `1px solid ${tones.bd}`,
        borderRadius: 14,
      }}
    >
      <div style={{ fontSize: 12, color: "#111", opacity: 0.75, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#0b1220", letterSpacing: 0.3 }}>{value}</div>
      {sub ? <div style={{ fontSize: 12, color: "#111", opacity: 0.65, marginTop: 4 }}>{sub}</div> : null}
    </div>
  );
};

const LrBadge = ({ side }) => (
  <span
    style={{
      fontSize: 11,
      fontWeight: 800,
      padding: "3px 8px",
      borderRadius: 999,
      border: "1px solid #d1d5db",
      background: "white",
      color: "#111",
      letterSpacing: 0.3,
    }}
  >
    {side}
  </span>
);

/* ---------- Tremor Axes overlay (Summary-only, styling-only) ---------- */

function normalizePowers(powers) {
  const valid = powers.filter((p) => Number.isFinite(p));
  const pMax = valid.length ? Math.max(...valid) : 1;
  const pMin = valid.length ? Math.min(...valid) : 0;
  return powers.map((p) => {
    if (!Number.isFinite(p) || pMax === pMin) return 0.6;
    const z = (p - pMin) / (pMax - pMin);
    return 0.35 + z * 0.95; // 0.35–1.3
  });
}

function buildAxesTraces(anglesDeg, powers, color) {
  if (!anglesDeg?.length) return [];
  const scaled = normalizePowers(powers);
  const traces = [];

  anglesDeg.forEach((deg, i) => {
    if (deg == null || !Number.isFinite(deg)) return;

    // Slight de-overlap if multiple axes align (±5°)
    let offset = 0;
    for (let j = 0; j < i; j++) {
      const d = Math.abs((anglesDeg[j] ?? 1000) - deg);
      const opp = Math.abs(((anglesDeg[j] ?? 1000) + 180) - deg);
      if (d < 5 || opp < 5) offset += 6; // 6° per collision
    }
    const theta = deg + offset;
    const rLen = scaled[i];

    const numPoints = 14;
    const linePoints = Array.from({ length: numPoints }, (_, j) => rLen * (j / (numPoints - 1)));

    // + direction
    traces.push({
      type: "scatterpolar",
      mode: "lines",
      r: linePoints,
      theta: Array(numPoints).fill(theta),
      line: { color, width: 3 },
      hovertemplate: `Axis ${i + 1}<br>Dir: ${theta.toFixed(0)}°<br>Rel Pow: ${formatNum(powers[i] ?? 0.6, 2)}<extra></extra>`,
      showlegend: false,
    });
    // - direction
    traces.push({
      type: "scatterpolar",
      mode: "lines",
      r: linePoints,
      theta: Array(numPoints).fill(theta + 180),
      line: { color, width: 3 },
      hovertemplate: `Axis ${i + 1}<br>Dir: ${(theta + 180).toFixed(0)}°<br>Rel Pow: ${formatNum(powers[i] ?? 0.6, 2)}<extra></extra>`,
      showlegend: false,
    });
  });

  // center marker
  traces.push({
    type: "scatterpolar",
    mode: "markers",
    r: [0],
    theta: [0],
    marker: { color: "#111", size: 5 },
    hoverinfo: "skip",
    showlegend: false,
  });

  return traces;
}

const TremorAxesSplit = ({ drawings, typedResults }) => {
  // gather primary axes per hand (display-only)
  const L = { angles: [], powers: [] };
  const R = { angles: [], powers: [] };

  drawings.forEach((d, i) => {
    const r = typedResults[i];
    if (!r) return;
    const dir1 = r.traxis_dir1 ?? r["traxis_dir1"] ?? null;
    const pw1 = r.traxis_pw1 ?? r["traxis_pw1"] ?? null;
    if (d?.hand_side === "L") {
      L.angles.push(Number.isFinite(dir1) ? dir1 : null);
      L.powers.push(Number.isFinite(pw1) ? pw1 : 0.6);
    } else if (d?.hand_side === "R") {
      R.angles.push(Number.isFinite(dir1) ? dir1 : null);
      R.powers.push(Number.isFinite(pw1) ? pw1 : 0.6);
    }
  });

  const leftTraces = buildAxesTraces(L.angles, L.powers, "#0f766e"); // teal
  const rightTraces = buildAxesTraces(R.angles, R.powers, "#1d4ed8"); // blue

  const mkLayout = () => ({
    polar: {
      radialaxis: { visible: false, range: [0, 1.35] },
      angularaxis: { direction: "clockwise", tickmode: "linear", dtick: 30, rotation: 90, tickfont: { size: 10, color: "#222" } },
      bgcolor: "rgba(0,0,0,0)",
    },
    margin: { l: 8, r: 8, b: 8, t: 8 },
    showlegend: false,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
  });

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 16,
      }}
    >
      <Card style={{ padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: "#111" }}>
          <FaHandPaper aria-hidden style={{ width: 16, height: 16 }} />
          <h4 style={{ margin: 0 }}>Tremor Axes — Left</h4>
        </div>
{leftTraces.length ? (
  <div
    style={{
      width: "100%",
      height: 320,
      display: "grid",
      gridTemplateRows: "1fr auto",
      alignItems: "stretch",
    }}
  >
    <div style={{ minHeight: 0 }}>
      <Plot
        data={leftTraces}
        layout={mkLayout()}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
    <div style={{ textAlign: "center", fontSize: 11, color: "#333", paddingTop: 6 }}>
      Superimposed primary axes from left-hand spirals
    </div>
  </div>
) :(
        <div
    style={{
      width: "100%",
      height: 320,                
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#333",
      textAlign: "center",
    }}
  >
    No axes yet.
  </div>
        )}
      </Card>

      <Card style={{ padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: "#111" }}>
          <FaHandPaper aria-hidden style={{ width: 16, height: 16, transform: "scaleX(-1)" }} />
          <h4 style={{ margin: 0 }}>Tremor Axes — Right</h4>
        </div>
        {rightTraces.length ? (
          <div style={{ width: "100%", height: 300 }}>
            <Plot data={rightTraces} layout={mkLayout()} config={{ displayModeBar: false, responsive: true }} style={{ width: "100%", height: "100%" }} />
            <div style={{ textAlign: "center", fontSize: 11, color: "#333", marginTop: 6 }}>
              Superimposed primary axes from right-hand spirals
            </div>
          </div>
        ) : (
            <div
    style={{
      width: "100%",
      height: 320,                 // matches the plot+caption height
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#333",
      textAlign: "center",
    }}
  >
    No axes yet.
  </div>
        )}
      </Card>
    </div>
  );
};

/* ---------- SUMMARY PANEL (styling only: padding + metrics polish + tremor axes) ---------- */

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
    const avgDOS = avg(arr.map((r) => r.DOS ?? null));
    const avgTremor = avg(arr.map((r) => pickTremorHz(r)));
    return { count: idxs.length, completed: arr.length, avgDOS, avgTremor };
  };

  const Ls = perHandStats(groups.L);
  const Rs = perHandStats(groups.R);
  const overallAvg = avg(typedResults.filter(Boolean).map((r) => r.DOS ?? null));

  const completionTone = perStatusCounts.completed === total ? "good" : "info";
  const failTone = perStatusCounts.failed > 0 ? "bad" : "neutral";
  const timeoutTone = perStatusCounts.timeout > 0 ? "warn" : "neutral";

  return (
    <div
      style={{
        paddingLeft: "clamp(16px, 4vw, 40px)",
        paddingRight: "clamp(16px, 4vw, 40px)",
        display: "grid",
        gap: 16,
      }}
    >
      {/* KPIs — compact, high-contrast, responsive */}
      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", color: "#111" }}>
          <KPI label="Total Spirals" value={total} />
          <KPI label="Completed" value={`${perStatusCounts.completed}/${total}`} tone={completionTone} />
          <KPI label="Timeouts" value={perStatusCounts.timeout} tone={timeoutTone} />
          <KPI label="Failures" value={perStatusCounts.failed} tone={failTone} />
          <KPI label="Avg DOS (Overall)" value={formatNum(overallAvg, 2)} />

          {/* Left / Right compact rows */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 8, minWidth: 220 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <LrBadge side="L" />
                <div style={{ fontSize: 12, color: "#333" }}>Count</div>
                <div style={{ fontWeight: 800, color: "#111" }}>{Ls.count}</div>
                <div style={{ width: 8 }} />
                <div style={{ fontSize: 12, color: "#333" }}>Completed</div>
                <div style={{ fontWeight: 800, color: "#111" }}>{Ls.completed}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 26 }} />
                <div style={{ fontSize: 12, color: "#333" }}>Avg DOS</div>
                <div style={{ fontWeight: 800, color: "#111" }}>{formatNum(Ls.avgDOS, 2)}</div>
                <div style={{ width: 8 }} />
                <div style={{ fontSize: 12, color: "#333" }}>Avg Tremor (Hz)</div>
                <div style={{ fontWeight: 800, color: "#111" }}>{formatNum(Ls.avgTremor, 2)}</div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 8, minWidth: 220 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <LrBadge side="R" />
                <div style={{ fontSize: 12, color: "#333" }}>Count</div>
                <div style={{ fontWeight: 800, color: "#111" }}>{Rs.count}</div>
                <div style={{ width: 8 }} />
                <div style={{ fontSize: 12, color: "#333" }}>Completed</div>
                <div style={{ fontWeight: 800, color: "#111" }}>{Rs.completed}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 26 }} />
                <div style={{ fontSize: 12, color: "#333" }}>Avg DOS</div>
                <div style={{ fontWeight: 800, color: "#111" }}>{formatNum(Rs.avgDOS, 2)}</div>
                <div style={{ width: 8 }} />
                <div style={{ fontSize: 12, color: "#333" }}>Avg Tremor (Hz)</div>
                <div style={{ fontWeight: 800, color: "#111" }}>{formatNum(Rs.avgTremor, 2)}</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Tremor Axes (side-by-side, superimposed per hand). Nothing after this block in Summary. */}
      <TremorAxesSplit drawings={drawings} typedResults={typedResults} />
    </div>
  );
}

/* ---------- MAIN PAGE (unchanged logic) ---------- */

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

  const [activeTab, setActiveTab] = useState("summary"); // Summary by default
  const [liveAnalysisState, setLiveAnalysisState] = useState({
    sessionActive: false,
    isSessionComplete: false,
    totalDrawings: 0,
    completed: 0,
  });

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRatings, setFeedbackRatings] = useState({
    usability: 0,
    analysisAccuracy: 0,
    performanceSpeed: 0,
    visualDesign: 0
  });
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
    if (!sessionId) {
      router.push("/machine");
      return;
    }

    const load = async () => {
      try {
        setLoadingResult(true);
        setLiveAnalysisState((s) => ({ ...s, sessionActive: true }));

        const { data: drawingsData, error: drawingsError } = await supabase
          .from("drawings")
          .select("*")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true });

        if (drawingsError) throw drawingsError;

        const finalDrawings = drawingsData || [];
        setDrawings(finalDrawings);
        setLiveAnalysisState((s) => ({ ...s, totalDrawings: finalDrawings.length }));

        if (finalDrawings.length > 0) {
          const ids = finalDrawings.map((d) => d.id);
          const { data: resultsData, error: resultsError } = await supabase
            .from("api_results")
            .select("*")
            .in("drawing_id", ids);
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "api_results", filter: `session_id=eq.${sessionId}` },
        handleRealTimeUpdate
      )
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

    setAnalysisHistory({
      individual_results: individual,
      total_drawings: drawings.length,
      successful_drawings: completed.length,
      average_DOS: avgDOS,
    });

    setLiveAnalysisState((s) => ({
      ...s,
      completed: completed.length,
      isSessionComplete: drawings.length > 0 && completed.length === drawings.length,
    }));

    updateCharts(selectedDrawingIndex, drawings, results);
  }, [drawings, results, selectedDrawingIndex, loadingResult]);

  const typedResultsByIndex = useMemo(
    () => drawings.map((d) => {
      const m = results.find((r) => r.drawing_id === d.id && r.status === "completed");
      return m ? coerceResult(m.result_data) : null;
    }),
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

  const drawingClick = (index) => setSelectedDrawingIndex(index);

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
    return ar.every((r) =>
      r && ((!r.error && !r.status && r.DOS !== undefined) || r.error || r.status === "timeout")
    );
  };

  const handleFeedbackSubmit = async () => {
    try {
      const feedbackData = {
        session_id: sessionId,
        created_at: new Date().toISOString(),
        usability_rating: feedbackRatings.usability || 0,
        analysis_accuracy_rating: feedbackRatings.analysisAccuracy || 0,
        performance_speed_rating: feedbackRatings.performanceSpeed || 0,
        visual_design_rating: feedbackRatings.visualDesign || 0,
        suggestion_text: feedbackSuggestion.trim() || null,
        user_id: user?.id || null,
      };
      const { error } = await supabase.from("feedback").insert([feedbackData]);
      if (error) {
        console.error("Error saving feedback:", error);
        alert("Failed to save feedback. Please try again.");
        return;
      }
      setShowFeedbackModal(false);
      setFeedbackRatings({ usability: 0, analysisAccuracy: 0, performanceSpeed: 0, visualDesign: 0 });
      setFeedbackSuggestion("");
    } catch (e) {
      console.error("Error submitting feedback:", e);
      alert("Failed to submit feedback. Please try again.");
    }
  };

  const downloadResults = () => {
    if (!analysisHistory) {
      alert("No results are available to download yet.");
      return;
    }
    const data = {
      session_id: sessionId,
      generated_at: new Date().toISOString(),
      analysis_summary: {
        total_drawings: analysisHistory.total_drawings,
        successful_drawings: analysisHistory.successful_drawings,
        average_DOS: analysisHistory.average_DOS,
      },
      hand_selection: drawings.length > 0 ? drawings[0].hand_used : null,
      hand_side: drawings.length > 0 ? drawings[0].hand_side : null,
      demographics: drawings.length > 0 ? {
        user_name: drawings[0].user_name,
        user_age: drawings[0].user_age,
        user_sex: drawings[0].user_sex
      } : null,
      individual_results: analysisHistory.individual_results,
      raw_drawing_data: drawings.map(d => ({
        drawing_id: d.id,
        created_at: d.created_at,
        hand_used: d.hand_used,
        hand_side: d.hand_side,
        user_name: d.user_name,
        user_age: d.user_age,
        user_sex: d.user_sex,
        data: d.drawing_data,
      })),
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

  const currentSide = drawings[selectedDrawingIndex]?.hand_side || null;

  return (
    <div className={styles.pageWrapper}>
      <Header showVideo={false} />
      <div className={styles.container}>
        <div className={styles.title}>
          <h2>Analysis Results</h2>
          {getProgressDisplay()}
          {getDOSScore() && <p>Average DOS Score: {getDOSScore()}</p>}
          {error && <p style={{ color: "red" }}>{String(error)}</p>}
        </div>

        {/* Toggle */}
<div style={{ display: "flex", justifyContent: "center", marginBottom: 24, paddingBottom: 8 }}>
  <Segmented value={activeTab} onChange={setActiveTab} />
</div>


        {/* ======= SUMMARY TAB (styling-only changes) ======= */}
        {activeTab === "summary" ? (
          <SummaryPanel
            drawings={drawings}
            typedResults={typedResultsByIndex}
            perStatusCounts={perStatusCounts}
          />
        ) : (
          /* ======= CHARTS TAB (UNCHANGED) ======= */
          <>
            {(analysisHistory || liveAnalysisState.sessionActive) && drawings.length > 0 && (
              <div className={styles.title}>
                <h3>Individual Drawings:</h3>
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    justifyContent: "center",
                    flexWrap: "wrap",
                  }}
                >
                  {(analysisHistory?.individual_results ||
                    (liveAnalysisState.sessionActive
                      ? Array.from({ length: liveAnalysisState.totalDrawings })
                      : []
                    )
                  ).map((resultStatus, index) => {
                    let displayContent = `#${index + 1}`;
                    let backgroundColor = "rgba(255, 165, 0, 0.3)";
                    if (resultStatus?.error) {
                      displayContent = `#${index + 1}: Failed`;
                      backgroundColor = "rgba(255,100,100,0.2)";
                    } else if (resultStatus?.status === 'timeout') {
                      displayContent = `#${index + 1}: Timeout`;
                      backgroundColor = "rgba(255,100,100,0.2)";
                    } else if (resultStatus && !resultStatus.status) {
                      backgroundColor = "rgba(255,255,255,0.1)";
                    }
                    return (
                      <span
                        key={index}
                        onClick={() => drawingClick(index)}
                        style={{
                          padding: "5px 10px",
                          background:
                            selectedDrawingIndex === index
                              ? "rgba(255,255,255,0.3)"
                              : backgroundColor,
                          borderRadius: "4px",
                          fontSize: "14px",
                          cursor: "pointer",
                          border:
                            selectedDrawingIndex === index
                              ? "2px solid white"
                              : "2px solid transparent",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          if (selectedDrawingIndex !== index) {
                            e.currentTarget.style.background = "rgba(255,255,255,0.2)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedDrawingIndex !== index) {
                            e.currentTarget.style.background = backgroundColor;
                          }
                        }}
                      >
                        {displayContent}
                      </span>
                    );
                  })}
                </div>
                {areAllAnalysesCompleted() && (
                  <div style={{ textAlign: "center", marginTop: "20px" }}>
                    <button
                      onClick={downloadResults}
                      style={{
                        backgroundColor: "#4a90e2",
                        color: "white",
                        border: "none",
                        padding: "10px 20px",
                        borderRadius: "6px",
                        fontSize: "14px",
                        fontWeight: "500",
                        cursor: "pointer",
                        transition: "background-color 0.2s ease",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        margin: "0 auto",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#357abd"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#4a90e2"; }}
                    >
                      <FaDownload size={16} />
                      Download Results
                    </button>
                    <div style={{ marginTop: "10px" }}>
                      <button
                        onClick={() => setShowFeedbackModal(true)}
                        style={{
                          backgroundColor: "#a8c8e8",
                          color: "navy",
                          border: "none",
                          padding: "8px 16px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          marginTop: "10px",
                          marginBottom: "-25px",
                          fontWeight: "500",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#8bb8d8";
                          e.currentTarget.style.transform = "translateY(-1px)";
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.backgroundColor = "#a8c8e8";
                          e.currentTarget.style.transform = "translateY(0)";
                        }}
                      >
                        <FaComment size={12} style={{ marginRight: "6px", verticalAlign: "middle", display: "inline-block" }} />
                        Feedback
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CHART GRID — UNCHANGED */}
            <div className={styles.chartGrid}>
              <div className={styles.graphCard} style={{ position: "relative" }}>
                <h3>Spiral XY Plot</h3>
                <div className={styles.chartContainer}>
                  <LineGraph data={drawData} />
                </div>
                <div style={{ marginTop: "10px", textAlign: "center", color: "black" }}>
                  {(() => {
                    const cur = analysisHistory?.individual_results?.[selectedDrawingIndex];
                    if (!cur) return <>Pending<AnimatedEllipsis /></>;
                    if (cur.error) return "DOS Score: Failed";
                    if (cur.status === 'timeout') return "DOS Score: Timeout";
                    if (cur.status === 'processing' || cur.status === 'pending') return <>Pending<AnimatedEllipsis /></>;
                    const dos = Number(cur.DOS);
                    return Number.isNaN(dos) ? "DOS Score: N/A" : `DOS Score: ${dos.toFixed(4)}`;
                  })()}
                </div>
              </div>

              <div className={styles.graphCard} style={{ position: "relative" }}>
                <h3>Speed vs. Time</h3>
                <div className={styles.chartContainer}>
                  <SpeedTimeChart speedData={speedData} />
                </div>
              </div>

              <div className={styles.graphCard} style={{ position: "relative" }}>
                <h3>3D Spiral View</h3>
                <div className={styles.chartContainer}>
                  <SpiralPlot data={drawData} />
                </div>
              </div>

              <div className={styles.graphCard} style={{ position: "relative" }}>
                <h3>Pressure vs Time</h3>
                <div className={styles.chartContainer}>
                  <PTChart data={drawData} />
                </div>
              </div>

              <div className={styles.graphCard} style={{ position: "relative" }}>
                <h3>Tremor Axes</h3>
                <div className={styles.chartContainer}>
                  {loadingResult ? <p>Loading tremor data...</p> : <TremorPolarPlot result={result} />}
                </div>
              </div>

              <div className={styles.graphCard} style={{ position: "relative" }}>
                <h3>Pressure vs X</h3>
                <div className={styles.chartContainer}>
                 <PressureVsX
  data={drawData}
  bins={60}
  minPerBin={12}
  samplePoints={500}
  splitByQuadrant={false}
/>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Feedback modal (unchanged) */}
      {showFeedbackModal && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            borderRadius: "12px",
            padding: "24px",
            maxWidth: "650px",
            width: "90%",
            maxHeight: "70vh",
            overflow: "hidden",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: "20px", position: "relative",
            }}>
              <h3 style={{ margin: 0, color: "navy", fontSize: "30px", fontWeight: "600", marginTop: "12px", marginBottom: "10px" }}>
                Rate Your Experience!
              </h3>
              <button
                onClick={() => setShowFeedbackModal(false)}
                style={{
                  background: "none", border: "none", fontSize: "25px", cursor: "pointer",
                  color: "#444", padding: "0", width: "30px", height: "30px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  zIndex: 10, position: "absolute", top: "-5px", right: "0px",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: "1.1" }}>
                {[
                  { key: "usability", label: "Usability" },
                  { key: "analysisAccuracy", label: "Percieved Analysis Accuracy" },
                  { key: "performanceSpeed", label: "Performance & Speed" },
                  { key: "visualDesign", label: "Visual Design" }
                ].map(({ key, label }) => (
                  <div key={key} style={{ marginBottom: "16px" }}>
                    <div style={{ marginBottom: "12px", fontWeight: "500", color: "navy", textDecoration: "underline", paddingBottom: "4px" }}>
                      {label}
                    </div>
                    <div style={{ display: "flex", gap: "4px" }}>
                      {[1,2,3,4,5].map((n) => {
                        const selected = feedbackRatings[key] >= n;
                        const hovered = hoveredStar.category === key && hoveredStar.starIndex >= n;
                        return (
                          <div
                            key={n}
                            style={{ position: "relative", display: "inline-block" }}
                            onMouseEnter={() => setHoveredStar({ category: key, starIndex: n })}
                            onMouseLeave={() => setHoveredStar({ category: null, starIndex: null })}
                          >
                            <button
                              onClick={() => setFeedbackRatings((prev) => ({ ...prev, [key]: n }))}
                              style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", fontSize: "18px", color: "#666" }}
                            >
                              ★
                            </button>
                            {(selected || hovered) && (
                              <div style={{
                                position: "absolute", top: "2px", left: "2px",
                                fontSize: "18px", color: "#FFD700", pointerEvents: "none",
                              }}>
                                ★
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ flex: "1.2" }}>
                <div style={{
                  marginBottom: "8px", textDecoration: "underline", fontWeight: "500",
                  fontSize: "24px", color: "navy", marginTop: "-75px", marginBottom: "40px", textAlign: "center"
                }}>
                  Suggestions
                </div>
                <textarea
                  value={feedbackSuggestion}
                  onChange={(e) => setFeedbackSuggestion(e.target.value)}
                  placeholder="Share your suggestions for improvement!"
                  style={{
                    width: "105%", maxWidth: "105%", minHeight: "300px", padding: "12px",
                    border: "3px solid navy", borderRadius: "6px", fontSize: "14px", fontFamily: "inherit",
                    resize: "vertical", marginTop: "-10px", marginLeft: "-10px",
                    backgroundColor: "white", color: "black",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-25px" }}>
              <button
                onClick={handleFeedbackSubmit}
                style={{
                  padding: "8px 16px", border: "none", borderRadius: "6px",
                  background: "navy", color: "white", cursor: "pointer", fontSize: "14px", fontWeight: "500",
                }}
              >
                Submit Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
