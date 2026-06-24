"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authProvider";
import Sidebar from "../../components/SideBar";
import BottomNav from "../../components/BottomNav";
import Pagination from "../../components/Pagination";
import Link from "next/link";
import HorizontalSpiralHistory from "../../components/HorizontalSpiralHistory";
import SettingsPopup from "../../components/SettingsPopup";

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

  const handleAccordionClick = (index) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  const paginatedEntries = entries.slice(1).slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);
  const pageCount = Math.max(1, Math.ceil((entries.length - 1) / entriesPerPage));
  const isSuperuser = SUPERUSER_EMAILS.includes(user?.email?.toLowerCase() ?? "");

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

  const ds = {
    pageContainer: {
      display: "flex",
      minHeight: "100vh",
      background: "#FFFFFF",
      paddingBottom: "48px",
    },
    content: {
      flex: 1,
      maxWidth: "100%",
      padding: "32px 40px",
      marginLeft: "180px",
      overflowY: "auto",
    },
    inner: {
      width: "100%",
      maxWidth: "860px",
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
      padding: "28px 32px",
      boxShadow: "0 4px 24px rgba(99, 102, 241, 0.08), 0 1px 4px rgba(0,0,0,0.04)",
      marginBottom: "12px",
    },
    latestResultLabel: {
      fontSize: "0.7rem",
      fontWeight: "700",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "#4C5BD4",
      marginBottom: "10px",
    },
    latestResultTitle: {
      fontSize: "0.95rem",
      fontWeight: "600",
      color: "#6A7A8A",
      margin: "0 0 16px",
      letterSpacing: "-0.01em",
    },
    metaRow: {
      display: "flex",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "10px",
      marginBottom: "18px",
    },
    drawingCountBadge: {
      display: "inline-flex",
      alignItems: "center",
      background: "#2B2B2B",
      color: "white",
      padding: "4px 12px",
      borderRadius: "20px",
      fontSize: "12px",
      fontWeight: "600",
      border: "1px solid white",
    },
    handBadge: {
      display: "inline-flex",
      alignItems: "center",
      background: "transparent",
      color: "#4A4A4A",
      border: "1px solid #4A4A4A",
      padding: "4px 12px",
      borderRadius: "20px",
      fontSize: "12px",
      fontWeight: "600",
      textTransform: "capitalize",
    },
    statLabel: {
      fontSize: "0.8rem",
      fontWeight: "600",
      color: "#6A7A8A",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      marginBottom: "6px",
      display: "block",
    },
    dosValue: {
      fontSize: "52px",
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
      color: "#6A7A8A",
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
          <p style={{ fontSize: "0.7rem", fontWeight: "700", letterSpacing: "0.1em", textTransform: "uppercase", color: "#6A7A8A", margin: "0 0 8px" }}>Account</p>
          <h1 style={{ fontSize: "2rem", fontWeight: "700", letterSpacing: "-0.02em", color: "#0B1B2B", margin: "0 0 24px" }}>Your Assessment History</h1>
          <hr style={{ border: "none", borderTop: "1px solid #E4E9EE", margin: 0 }} />
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
            <div style={ds.latestResultBox}>
              <p style={ds.latestResultLabel}>Latest Result</p>
              <p style={ds.latestResultTitle}>
                {new Date(entries[0].created_at).toLocaleString()}
              </p>

              <div style={ds.metaRow}>
                <div style={ds.drawingCountBadge}>
                  {entries[0].all_drawings.length}
                  {entries[0].all_drawings.length === 1 ? " Drawing" : " Drawings"}
                </div>
                {entries[0].hand_side && (
                  <div style={ds.handBadge}>
                    {getHandLabel(entries[0].hand_side)}
                  </div>
                )}
              </div>

              {/* DOS Score */}
              <div style={{ marginBottom: "28px", marginTop: "20px" }}>
                <span style={ds.statLabel}>AVG DOS SCORE</span>
                <div style={{ ...ds.dosValue, color: "#13917F" }}>
                  {entries[0].average_DOS || "N/A"}
                </div>
              </div>

              {/* Spirals Grid */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
                {entries[0].all_drawings.map((drawing, idx) => {
                  const result = entries[0].all_results[idx];
                  const dos = result?.DOS != null ? parseFloat(result.DOS).toFixed(2) : null;
                  const handSide = getShortHandLabel(entries[0].all_hand_sides?.[idx]);
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
                    <div key={idx} style={{ background: "#F7F9FB", border: "1px solid #E4E9EE", borderRadius: "12px", padding: "16px 36px", textAlign: "center", width: "220px", flexShrink: 0 }}>
                      <svg
                        viewBox={`${xMin - pad} ${yMin - pad} ${xMax - xMin + pad * 2} ${yMax - yMin + pad * 2}`}
                        style={{ width: "136px", height: "136px", display: "block", margin: "0 auto" }}
                        preserveAspectRatio="xMidYMid meet"
                      >
                        <polyline points={points} fill="none" stroke="#4C5BD4" strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px", color: "#9AA6B2", marginTop: "12px" }}>
                        Spiral {idx + 1}{handSide ? ` (${handSide})` : ""}
                      </div>
                      {dos && (
                        <div style={{ fontSize: "0.95rem", fontWeight: "700", color: "#0B1B2B", marginTop: "4px" }}>
                          {dos}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <Link
                href={`/result/${entries[0].session_id || entries[0].drawing_id}`}
                style={ds.viewAnalysisLink}
                onMouseEnter={(e) => e.currentTarget.style.background = "#EAF1FD"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                View Full Analysis
              </Link>
            </div>

            {/* ── PAST RESULTS ── */}
            <div style={{ marginTop: "40px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <div style={ds.pastResultsHeading}>Past Results</div>
                <h2 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#0B1B2B", margin: "8px 0 0", letterSpacing: "-0.01em" }}>
                  Your overall average: <span style={{ color: "#13917F" }}>{averageDOS || "N/A"}</span>
                </h2>
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
                      padding: "18px 20px",
                      cursor: "pointer",
                      transition: "background 0.2s ease, border-color 0.2s ease",
                      fontFamily: "inherit",
                    }}
                    onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = "#F7F9FB"; }}
                    onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.background = "white"; }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", color: "#9AA6B2", marginBottom: "4px" }}>DATE & TIME</div>
                      <div style={{ fontSize: "0.95rem", fontWeight: "600", color: "#0B1B2B" }}>
                        {new Date(entry.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", color: "#9AA6B2", marginBottom: "4px" }}>HAND</div>
                      <div style={{ fontSize: "0.95rem", color: "#0B1B2B" }}>
                        {getHandLabel(entry.hand_side)}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", color: "#9AA6B2", marginBottom: "4px" }}>AVERAGE DOS</div>
                      <div style={{ fontSize: "0.95rem", fontWeight: "600", color: "#13917F" }}>
                        {entry.average_DOS || "N/A"}
                      </div>
                    </div>
                    <div style={{ flex: 0.5 }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase", color: "#9AA6B2", marginBottom: "4px" }}>COUNT</div>
                      <div style={{ fontSize: "0.95rem", fontWeight: "600", color: "#0B1B2B" }}>
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
                    <div style={{ padding: "20px", opacity: isOpen ? 1 : 0, transition: "opacity 0.3s ease 0.05s" }}>
                      <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
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
                            <div key={dIdx} style={{ background: "#FFFFFF", border: "1px solid #E4E9EE", borderRadius: "12px", padding: "16px 36px", textAlign: "center", width: "220px", flexShrink: 0 }}>
                              <svg
                                viewBox={`${xMin - pad} ${yMin - pad} ${xMax - xMin + pad * 2} ${yMax - yMin + pad * 2}`}
                                style={{ width: "136px", height: "136px", display: "block", margin: "0 auto" }}
                                preserveAspectRatio="xMidYMid meet"
                              >
                                <polyline points={points} fill="none" stroke="#4C5BD4" strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#9AA6B2", marginTop: "10px" }}>
                                Spiral {dIdx + 1}{handSide ? ` (${handSide})` : ""}
                              </div>
                              {dos && (
                                <div style={{ fontSize: "0.95rem", fontWeight: "700", color: "#0B1B2B", marginTop: "3px" }}>
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
                          fontSize: "0.875rem",
                          fontWeight: "600",
                          padding: "8px 16px",
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
