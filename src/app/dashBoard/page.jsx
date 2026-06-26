"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authProvider";
import Sidebar from "../../components/SideBar";
import BottomNav from "../../components/BottomNav";
import Pagination from "../../components/Pagination";
import Link from "next/link";
import HorizontalSpiralHistory from "../../components/HorizontalSpiralHistory";
import SettingsPopup from "../../components/SettingsPopup";

// Archimedean reference spiral — same parameters as the template shown during drawing
function generateSpiral({ turns = 4, b = 19, steps = 500 } = {}) {
  const maxT = turns * 2 * Math.PI;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const t = (maxT * i) / steps;
    const r = (b * t) / (2 * Math.PI);
    const x = (r * Math.cos(t)).toFixed(2);
    const y = (r * Math.sin(t)).toFixed(2);
    d += (i === 0 ? 'M' : 'L') + x + ' ' + y + ' ';
  }
  return d.trim();
}
const TEMPLATE_PATH = generateSpiral();
const TEMPLATE_MAX_R = 76; // b=19 × turns=4 = 76

const MiniSpiralThumb = ({ drawing }) => {
  if (!drawing || drawing.length < 2) return null;
  const xs = drawing.map((p) => p.x);
  const ys = drawing.map((p) => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  const vw = 80, vh = 80, pad = 6;
  const scale = Math.min((vw - pad * 2) / xRange, (vh - pad * 2) / yRange);
  const offsetX = pad + ((vw - pad * 2) - xRange * scale) / 2;
  const offsetY = pad + ((vh - pad * 2) - yRange * scale) / 2;
  const points = drawing
    .map((p) => `${offsetX + (p.x - xMin) * scale},${offsetY + (p.y - yMin) * scale}`)
    .join(" ");
  return (
    <svg
      width="32" height="32"
      viewBox={`0 0 ${vw} ${vh}`}
      style={{ flexShrink: 0, borderRadius: 6, background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.15)" }}
    >
      <polyline points={points} fill="none" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const SUPERUSER_EMAILS = (
  process.env.NEXT_PUBLIC_SUPERUSER_EMAILS ||
  process.env.NEXT_PUBLIC_SUPERUSER_EMAIL ||
  ""
)
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter((email) => email !== "");

const Dashboard = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [activeIndex, setActiveIndex] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewAll, setViewAll] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [averageDOS, setAverageDOS] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const dosChartRef = useRef(null);
  const entriesPerPage = 7;

  useEffect(() => {
    const groupResultsBySession = (results) => {
      if (!results) return [];

      const sessions = new Map();

      results.forEach((entry) => {
        if (!entry.drawings?.drawing_data) {
          return;
        }

        const groupingKey = entry.session_id || `legacy-${entry.id}`;

        if (!sessions.has(groupingKey)) {
          sessions.set(groupingKey, {
            key: groupingKey,
            session_id: entry.session_id,
            drawing_id: entry.drawing_id,
            user_id: entry.user_id,
            email: entry.email,
            created_at: entry.created_at,
            all_drawings: [],
            all_results: [],
            all_hand_sides: [],
            hand_side: entry.drawings?.hand_side || null,
          });
        }

        const session = sessions.get(groupingKey);

        session.all_drawings.push(entry.drawings.drawing_data);
        session.all_results.push(entry.result_data);
        session.all_hand_sides.push(entry.drawings?.hand_side || null);

        if (!session.hand_side && entry.drawings?.hand_side) {
          session.hand_side = entry.drawings.hand_side;
        }

        if (new Date(entry.created_at) > new Date(session.created_at)) {
          session.created_at = entry.created_at;
        }
      });

      const groupedEntries = Array.from(sessions.values()).map(session => {
        const dosValues = session.all_results
          .map(res => parseFloat(res?.DOS))
          .filter(dos => !isNaN(dos));
        const uniqueHandSides = [...new Set(session.all_hand_sides.filter(Boolean))];

        let sessionAverageDOS = null;
        if (dosValues.length > 0) {
          const sum = dosValues.reduce((a, b) => a + b, 0);
          sessionAverageDOS = (sum / dosValues.length).toFixed(4);
        }

        return {
          ...session,
          hand_side: uniqueHandSides.length === 1 ? uniqueHandSides[0] : uniqueHandSides.length > 1 ? "both" : null,
          average_DOS: sessionAverageDOS
        };
      });

      groupedEntries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      return groupedEntries;
    };

    const fetchData = async () => {
      setLoading(true);
      if (!user) {
        setLoading(false);
        return;
      }

      const isSuperuser = SUPERUSER_EMAILS.includes(user.email.toLowerCase());

      let query = supabase
        .from("api_results")
        .select(`
          id, drawing_id, session_id, created_at, result_data, user_id, email,
          drawings ( id, drawing_data, hand_side )
        `)
        .order("created_at", { ascending: false });

      if (!isSuperuser || !viewAll) {
        query = query.eq("user_id", user.id);
      }

      const [{ data: profile }, { data, error }] = await Promise.all([
        supabase.from("profiles").select("avatar_path").eq("id", user.id).maybeSingle(),
        query,
      ]);

      if (profile?.avatar_path) {
        const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(profile.avatar_path, 3600);
        if (signed?.signedUrl) setAvatarUrl(signed.signedUrl);
      }

      if (!error && data) {
        const groupedData = groupResultsBySession(data);
        setEntries(groupedData);

        const allSessionAverages = groupedData
          .map((e) => parseFloat(e.average_DOS))
          .filter((n) => !isNaN(n));

        if (allSessionAverages.length > 0) {
          const sum = allSessionAverages.reduce((a, b) => a + b, 0);
          setAverageDOS((sum / allSessionAverages.length).toFixed(2));
        }
      }
      setLoading(false);
    };

    fetchData();

    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [viewAll, user]);

  useEffect(() => {
    if (dosChartRef.current) {
      dosChartRef.current.scrollLeft = dosChartRef.current.scrollWidth;
    }
  }, [entries]);

  const handleAccordionClick = (index) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  const paginatedEntries = entries.slice(1).slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);
  const pageCount = Math.max(1, Math.ceil((entries.length - 1) / entriesPerPage));
  const isSuperuser = SUPERUSER_EMAILS.includes(user?.email?.toLowerCase() ?? "");
  const accountEmailPrefix = user?.email?.split("@")[0] || "";

  const getHandLabel = (handSide) => {
    if (!handSide) return "N/A";
    if (handSide === "L") return "Left hand";
    if (handSide === "R") return "Right hand";
    return 'Both hands';
  };

  const getShortHandLabel = (handSide) => {
    if (handSide === "L") return "Left";
    if (handSide === "R") return "Right";
    return null;
  };

  const formatDashboardDate = (dateValue) =>
    new Date(dateValue).toLocaleString([], {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const ds = {
    pageContainer: {
      display: "flex",
      minHeight: "100vh",
      background: "#F0F2F5",
      paddingBottom: "48px",
    },
    content: {
      flex: 1,
      maxWidth: "100%",
      padding: "32px 36px",
      marginLeft: "180px",
      overflowY: "auto",
    },
    inner: {
      width: "100%",
      maxWidth: "980px",
      margin: "0 auto",
    },
    welcomeSection: {
      marginBottom: "40px",
    },
    welcome: {
      fontSize: "1.75rem",
      fontWeight: "700",
      letterSpacing: "-0.02em",
      color: "#0B1B2B",
      margin: 0,
    },
    latestResultBox: {
      background: "#FFFFFF",
      border: "1px solid #E4E9EE",
      borderRadius: "16px",
      padding: "20px 24px",
      boxShadow: "0 4px 24px rgba(99, 102, 241, 0.08), 0 1px 4px rgba(0,0,0,0.04)",
      marginBottom: "12px",
    },
    latestResultLabel: {
      fontSize: "0.7rem",
      fontWeight: "700",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "#4C5BD4",
      marginBottom: "6px",
    },
    latestResultTitle: {
      fontSize: "0.95rem",
      fontWeight: "600",
      color: "#6A7A8A",
      margin: "0 0 12px",
      letterSpacing: "-0.01em",
    },
    metaRow: {
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "10px",
      marginBottom: "12px",
    },
    drawingCountBadge: {
      display: "inline-flex",
      alignItems: "center",
      background: "#2B2B2B",
      color: "white",
      padding: "3px 10px",
      borderRadius: "20px",
      fontSize: "11px",
      fontWeight: "600",
      border: "1px solid white",
    },
    handBadge: {
      display: "inline-flex",
      alignItems: "center",
      background: "transparent",
      color: "#4A4A4A",
      border: "1px solid #4A4A4A",
      padding: "3px 10px",
      borderRadius: "20px",
      fontSize: "11px",
      fontWeight: "600",
      textTransform: "capitalize",
    },
    statLabel: {
      fontSize: "0.8rem",
      fontWeight: "600",
      color: "#6A7A8A",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      marginBottom: "4px",
      display: "block",
    },
    dosValue: {
      fontSize: "44px",
      fontWeight: "700",
      letterSpacing: "-0.02em",
      lineHeight: "1",
    },
    spiralCard: {
      background: "#F7F9FB",
      border: "1px solid #E4E9EE",
      borderRadius: "14px",
      padding: "16px",
      textAlign: "center",
    },
    viewAnalysisLink: {
      display: "inline-block",
      width: "100%",
      color: "#4C5BD4",
      background: "transparent",
      border: "1.5px solid #4C5BD4",
      fontSize: "14.5px",
      fontWeight: "600",
      padding: "12px 20px",
      borderRadius: "11px",
      cursor: "pointer",
      transition: "all 0.2s ease",
      textDecoration: "none",
      textAlign: "center",
    },
    pastResultsHeading: {
      fontSize: "1rem",
      fontWeight: "700",
      color: "#5A6A9A",
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      marginBottom: "0",
    },
  };

  return (
    <div style={ds.pageContainer}>
      {isMobile ? <BottomNav onSettingsClick={() => setIsSettingsOpen(true)} /> : <Sidebar onSettingsClick={() => setIsSettingsOpen(true)} />}
      <SettingsPopup isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <div style={ds.content}>
        <div style={ds.inner}>
        {/* Header */}
        <div style={{ marginBottom: "32px" }}>
          <p style={{ fontSize: "0.7rem", fontWeight: "700", letterSpacing: "0.1em", textTransform: "uppercase", color: "#5A6A9A", margin: "0 0 8px" }}>
            Account{accountEmailPrefix ? ` · ${accountEmailPrefix}` : ""}
          </p>
          <h1 style={{ fontSize: "2rem", fontWeight: "700", letterSpacing: "-0.02em", color: "#0B1020", margin: "0 0 24px" }}>Your Assessment History</h1>
          <hr style={{ border: "none", borderTop: "1px solid #D4D8F0", margin: 0 }} />
        </div>

        {isSuperuser && (
          <div style={{ margin: "1rem 0" }}>
            <label>
              <input type="checkbox" checked={viewAll} onChange={(e) => setViewAll(e.target.checked)} />
              {" "}View all user entries
            </label>
          </div>
        )}

        {loading ? (
          <p>Loading...</p>
        ) : entries.length > 0 ? (
          <>
            {/* ── LATEST RESULT ── */}
            {(() => {
              // Precompute per-hand spiral labels: R Spiral 1, L Spiral 1, R Spiral 2 …
              const handCounts = {};
              const spiralLabels = (entries[0].all_hand_sides || []).map((hs) => {
                const key = hs || '?';
                handCounts[key] = (handCounts[key] || 0) + 1;
                return hs ? `${hs} Spiral ${handCounts[key]}` : `Spiral ${handCounts[key]}`;
              });
              return (
                <div style={{ borderRadius: '18px', overflow: 'hidden', border: '1px solid #1A2A3A', boxShadow: '0 8px 32px rgba(0,0,0,0.20)', marginBottom: '16px' }}>

                  {/* ── Dark header ── */}
                  <div style={{ background: '#0C1825', padding: '22px 28px 26px', position: 'relative', overflow: 'hidden' }}>

                    {/* Watermark spiral — faint, top-right */}
                    <div style={{ position: 'absolute', right: -30, top: -30, pointerEvents: 'none' }}>
                      <svg width="260" height="260" viewBox="-80 -80 160 160" style={{ opacity: 0.07 }}>
                        <path d={TEMPLATE_PATH} fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                    </div>

                    {/* Top meta row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
                      <div style={{ fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.12em', color: '#8BBDD4', textTransform: 'uppercase' }}>
                        Latest Result
                        <span style={{ margin: '0 8px', opacity: 0.4 }}>|</span>
                        {formatDashboardDate(entries[0].created_at)}
                        <span style={{ margin: '0 8px', opacity: 0.4 }}>|</span>
                        {entries[0].all_drawings.length} drawing{entries[0].all_drawings.length !== 1 ? 's' : ''}
                      </div>
                      {entries[0].hand_side && (
                        <div style={{ background: 'rgba(255,255,255,0.07)', color: '#C8E0EE', padding: '4px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', border: '1px solid rgba(255,255,255,0.28)', flexShrink: 0 }}>
                          {getHandLabel(entries[0].hand_side)}
                        </div>
                      )}
                    </div>

                    {/* AVG DOS SCORE */}
                    <div style={{ fontSize: '10px', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.12em', color: '#8BBDD4', textTransform: 'uppercase', marginBottom: '6px' }}>
                      AVG DOS SCORE
                    </div>
                    <div style={{ fontSize: '68px', fontFamily: "'Manrope', sans-serif", fontWeight: '700', color: '#FFFFFF', lineHeight: '1' }}>
                      {entries[0].average_DOS ?? 'N/A'}
                    </div>
                  </div>

                  {/* ── Spiral row + View Analysis ── */}
                  <div style={{ background: '#FFFFFF', display: 'flex', alignItems: 'stretch' }}>
                    {/* Scrollable spiral section — 3 always visible, more scroll right */}
                    <div style={{ flex: 1, display: 'flex', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      {entries[0].all_drawings.map((drawing, idx) => {
                        const result = entries[0].all_results[idx];
                        const dos = result?.DOS != null ? parseFloat(result.DOS).toFixed(2) : null;
                        const xVals = drawing.map(p => p.x);
                        const yVals = drawing.map(p => p.y);
                        const xMin = Math.min(...xVals), xMax = Math.max(...xVals);
                        const yMin = Math.min(...yVals), yMax = Math.max(...yVals);
                        const pad = Math.max(xMax - xMin, yMax - yMin) * 0.12;
                        const strokeW = (xMax - xMin) * 0.013;
                        const points = drawing.map(p => `${p.x},${p.y}`).join(' ');
                        return (
                          <div key={idx} style={{ flex: '0 0 33.33%', minWidth: '140px', padding: '22px 16px 20px', textAlign: 'center', borderRight: '1px solid #F0F3F7', boxSizing: 'border-box' }}>
                            <svg
                              viewBox={`${xMin - pad} ${yMin - pad} ${xMax - xMin + pad * 2} ${yMax - yMin + pad * 2}`}
                              style={{ width: '110px', height: '110px', display: 'block', margin: '0 auto' }}
                              preserveAspectRatio="xMidYMid meet"
                            >
                              <polyline points={points} fill="none" stroke="#3D4FC4" strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10.5px', color: '#9AA6B2', marginTop: '10px', letterSpacing: '0.04em' }}>
                              {spiralLabels[idx] || `Spiral ${idx + 1}`}
                            </div>
                            {dos && (
                              <div style={{ fontSize: '15px', fontWeight: '700', color: '#0B1B2B', marginTop: '3px' }}>
                                {dos}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* View Analysis — pinned right, never scrolls away */}
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '22px 20px', borderLeft: '1px solid #F0F3F7' }}>
                      <Link
                        href={`/result/${entries[0].session_id || entries[0].drawing_id}`}
                        style={{ display: 'block', color: '#6B7FD4', background: 'rgba(76,91,212,0.04)', border: '1px solid rgba(76,91,212,0.2)', fontSize: '13px', fontWeight: '500', padding: '10px 20px', borderRadius: '10px', textDecoration: 'none', textAlign: 'center', whiteSpace: 'nowrap', transition: 'all 0.15s ease', letterSpacing: '0.01em' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(76,91,212,0.09)'; e.currentTarget.style.borderColor = 'rgba(76,91,212,0.35)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(76,91,212,0.04)'; e.currentTarget.style.borderColor = 'rgba(76,91,212,0.2)'; }}
                      >
                        View Analysis →
                      </Link>
                    </div>
                  </div>

                </div>
              );
            })()}

            {/* ── PAST RESULTS ── */}
            <div style={{ marginTop: "40px", marginBottom: "16px" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#6A7A8A", marginBottom: "6px" }}>
                Past Results
              </div>
              <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: "700", fontSize: "17px", letterSpacing: "-0.01em", color: "#0B1B2B" }}>
                Overall avg: <span style={{ color: "#4C5BD4" }}>{averageDOS || "N/A"}</span>
              </div>
            </div>

            {/* Results List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
              {paginatedEntries.map((entry, index) => {
                const isOpen = activeIndex === index;
                return (
                <div key={entry.key} style={{ borderRadius: "12px", overflow: "hidden", border: `1px solid ${isOpen ? "#4C5BD4" : "#E4E9EE"}`, transition: "border-color 0.2s ease", boxShadow: isOpen ? "0 4px 16px rgba(76, 91, 212,0.1)" : "none" }}>
                  <button
                    onClick={() => handleAccordionClick(index)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      width: "100%",
                      textAlign: "left",
                      background: isOpen ? "#EAF1FD" : "white",
                      border: "none",
                      borderBottom: isOpen ? "1px solid #D0E2F9" : "1px solid transparent",
                      padding: "12px 16px",
                      cursor: "pointer",
                      transition: "background 0.2s ease, border-color 0.2s ease",
                      fontFamily: "inherit",
                    }}
                    onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = "#F7F9FB"; }}
                    onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.background = "white"; }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.68rem", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", color: "#9AA6B2", marginBottom: "3px" }}>DATE & TIME</div>
                      <div style={{ fontSize: "0.88rem", fontWeight: "600", color: "#0B1B2B" }}>
                        {formatDashboardDate(entry.created_at)}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.68rem", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", color: "#9AA6B2", marginBottom: "3px" }}>HAND</div>
                      <div style={{ fontSize: "0.88rem", color: "#0B1B2B" }}>
                        {getHandLabel(entry.hand_side)}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.68rem", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", color: "#9AA6B2", marginBottom: "3px" }}>AVERAGE DOS</div>
                      <div style={{ fontSize: "0.88rem", fontWeight: "600", color: "#13917F" }}>
                        {entry.average_DOS || "N/A"}
                      </div>
                    </div>
                    <div style={{ flex: 0.5 }}>
                      <div style={{ fontSize: "0.68rem", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", color: "#9AA6B2", marginBottom: "3px" }}>COUNT</div>
                      <div style={{ fontSize: "0.88rem", fontWeight: "600", color: "#0B1B2B" }}>
                        {entry.all_drawings.length}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "16px", flex: 0.3 }}>
                      <span style={{ fontSize: "12px", color: "#6B7280", display: "inline-block", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.3s ease" }}>
                        ▼
                      </span>
                    </div>
                  </button>

                  <div style={{ maxHeight: isOpen ? "900px" : "0", overflow: "hidden", transition: "max-height 0.4s ease", background: "#F9FAFB" }}>
                    <div style={{ padding: "14px 16px", opacity: isOpen ? 1 : 0, transition: "opacity 0.3s ease 0.05s" }}>
                      <div style={{ display: "flex", gap: "10px", marginBottom: "12px", overflowX: "auto", overflowY: "hidden", paddingBottom: "6px" }}>
                        {entry.all_drawings.map((drawing, dIdx) => {
                          const result = entry.all_results[dIdx];
                          const dos = result?.DOS != null ? parseFloat(result.DOS).toFixed(2) : null;
                          const handSide = getShortHandLabel(entry.all_hand_sides?.[dIdx]);
                          const xVals = drawing.map(d => d.x);
                          const yVals = drawing.map(d => d.y);
                          const xMin = Math.min(...xVals);
                          const xMax = Math.max(...xVals);
                          const yMin = Math.min(...yVals);
                          const yMax = Math.max(...yVals);
                          const pad = Math.max(xMax - xMin, yMax - yMin) * 0.12;
                          const points = drawing.map(d => `${d.x},${d.y}`).join(" ");
                          const strokeW = (xMax - xMin) * 0.014;
                          return (
                            <div key={dIdx} style={{ background: "#FFFFFF", border: "1px solid #E4E9EE", borderRadius: "10px", padding: "10px 24px", textAlign: "center", width: "176px", flexShrink: 0 }}>
                              <svg
                                viewBox={`${xMin - pad} ${yMin - pad} ${xMax - xMin + pad * 2} ${yMax - yMin + pad * 2}`}
                                style={{ width: "104px", height: "104px", display: "block", margin: "0 auto" }}
                                preserveAspectRatio="xMidYMid meet"
                              >
                                <polyline points={points} fill="none" stroke="#4C5BD4" strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "10px", color: "#9AA6B2", marginTop: "8px" }}>
                                Spiral {dIdx + 1}{handSide ? ` (${handSide})` : ""}
                              </div>
                              {dos && (
                                <div style={{ fontSize: "12px", fontWeight: "700", color: "#0B1B2B", marginTop: "2px" }}>
                                  {dos}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <Link
                        href={`/result/${entry.session_id || entry.drawing_id}`}
                        style={{
                          display: "inline-block",
                          color: "#4C5BD4",
                          fontSize: "0.82rem",
                          fontWeight: "600",
                          padding: "6px 12px",
                          border: "1.5px solid #4C5BD4",
                          borderRadius: "8px",
                          background: "white",
                          textDecoration: "none",
                          transition: "all 0.2s ease",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#EAF1FD"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "white"}
                      >
                        View Full Analysis
                      </Link>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>

            <Pagination
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              pageCount={pageCount}
            />

            {/* ── DOS BY VISIT CHART ── */}
            {(() => {
              const chartData = [...entries].reverse();
              if (chartData.length < 2) return null;
              const colW = 72, yAxisW = 40, pR = 16, pT = 30, pB = 36, H = 230, maxD = 4;
              const n = chartData.length;
              const bodyW = colW * n + pR;
              const pH = H - pT - pB;
              // x coords are relative to the scrollable body SVG (no left offset)
              const xOf = (i) => colW * i + colW / 2;
              const yOf = (v) => pT + pH * (1 - Math.min(parseFloat(v) || 0, maxD) / maxD);
              const gridY = [0, 1, 2, 3, 4];
              const pts = chartData.map((e, i) => [xOf(i), yOf(e.average_DOS)]);
              const linePts = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`);
              const areaPath = `M${linePts.join(' L')} L${pts[pts.length-1][0].toFixed(1)},${pT+pH} L0,${pT+pH} Z`;
              const linePath = `M${linePts.join(' L')}`;
              return (
                <div style={{ background: '#FFFFFF', border: '1px solid #E4E9EE', borderRadius: '18px', padding: '24px', marginTop: '24px' }}>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', letterSpacing: '0.14em', color: '#6A7A8A', marginBottom: '6px', textTransform: 'uppercase' }}>
                      TREND OVER TIME
                    </div>
                    <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: '700', fontSize: '17px', letterSpacing: '-0.01em', color: '#0B1B2B' }}>
                      Degree of Severity by visit
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
                    {/* Sticky Y-axis — never scrolls, soft right-edge fade to blend into chart */}
                    <div style={{ flexShrink: 0, position: 'relative', zIndex: 2 }}>
                      <svg width={yAxisW} height={H} style={{ display: 'block', background: '#FFFFFF' }}>
                        {gridY.map(v => (
                          <text key={v} x={yAxisW - 6} y={yOf(v) + 3.5} textAnchor="end" fontSize={9.5} fontFamily="'IBM Plex Mono', monospace" fill="#9AA6B2">{v}</text>
                        ))}
                      </svg>
                      {/* Feathered right edge — blurs the axis/chart boundary */}
                      <div style={{ position: 'absolute', top: 0, right: -16, width: 16, height: H, background: 'linear-gradient(to right, #FFFFFF, rgba(255,255,255,0))', pointerEvents: 'none' }} />
                    </div>

                    {/* Scrollable chart body */}
                    <div ref={dosChartRef} style={{ overflowX: 'auto', flex: 1, WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth' }}>
                      <svg width={bodyW} height={H} style={{ display: 'block', overflow: 'visible' }}>
                        {gridY.map(v => (
                          <line key={v} x1={0} y1={yOf(v)} x2={bodyW} y2={yOf(v)} stroke="#EFF2F5" strokeWidth={1} />
                        ))}
                        <path d={areaPath} fill="rgba(30,64,175,0.06)" />
                        <path d={linePath} fill="none" stroke="#1E40AF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        {pts.map(([x, y], i) => {
                          const val = parseFloat(chartData[i].average_DOS);
                          const dateLabel = new Date(chartData[i].created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                          return (
                            <g key={i}>
                              <circle cx={x} cy={y} r={7} fill="#13917F" fillOpacity={0.12} />
                              <circle cx={x} cy={y} r={4} fill="#13917F" stroke="#FFFFFF" strokeWidth={2} />
                              <text x={x} y={y - 12} textAnchor="middle" fontSize={9} fontFamily="'IBM Plex Mono', monospace" fill="#13917F" fontWeight="600">
                                {isNaN(val) ? '' : val.toFixed(2)}
                              </text>
                              <text x={x} y={H - 8} textAnchor="middle" fontSize={9} fontFamily="'IBM Plex Mono', monospace" fill="#9AA6B2">
                                {dateLabel}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                    {/* Right-edge fade — hints at more scrollable content */}
                    <div style={{ position: 'absolute', top: 0, right: 0, width: 40, height: H, background: 'linear-gradient(to right, rgba(255,255,255,0), #FFFFFF)', pointerEvents: 'none', zIndex: 1 }} />
                  </div>
                </div>
              );
            })()}
          </>
        ) : (
          <p style={{ color: "#6A7A8A", fontSize: "1.1rem", fontWeight: "500", marginTop: "40px", textAlign: "center" }}>
            No entries found.
          </p>
        )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
