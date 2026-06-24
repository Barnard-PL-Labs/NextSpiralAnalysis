"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authProvider";
import Sidebar from "../../components/SideBar";
import BottomNav from "../../components/BottomNav";
import Pagination from "../../components/Pagination";
import styles from "../../styles/Dashboard.module.css";
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
  const { user, username } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [activeIndex, setActiveIndex] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewAll, setViewAll] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [averageDOS, setAverageDOS] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
            hand_used: entry.drawings?.hand_used || null,
          });
        }
        
        const session = sessions.get(groupingKey);

        session.all_drawings.push(entry.drawings.drawing_data);
        session.all_results.push(entry.result_data);
        
        // Update hand_used if not already set
        if (!session.hand_used && entry.drawings?.hand_used) {
          session.hand_used = entry.drawings.hand_used;
        }

        if (new Date(entry.created_at) > new Date(session.created_at)) {
          session.created_at = entry.created_at;
        }
      });

      const groupedEntries = Array.from(sessions.values()).map(session => {
        const dosValues = session.all_results
          .map(res => parseFloat(res?.DOS)) 
          .filter(dos => !isNaN(dos));

        let sessionAverageDOS = null;
        if (dosValues.length > 0) {
          const sum = dosValues.reduce((a, b) => a + b, 0);
          sessionAverageDOS = (sum / dosValues.length).toFixed(4);
        }
        
        return {
          ...session,
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
          drawings ( id, drawing_data, hand_used )
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

  return (
    <div className={styles.pageContainer}>
      {isMobile ? <BottomNav onSettingsClick={() => setIsSettingsOpen(true)} /> : <Sidebar onSettingsClick={() => setIsSettingsOpen(true)} />}
      <SettingsPopup isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <div className={styles.content}>
        <div className={styles.welcomeContainer}>
          <h1 className={styles.welcome}>
            {username ? `Welcome back, ${username}!` : "Welcome back!"}
          </h1>
        </div>

        {isSuperuser && (
          <div style={{ margin: "1rem 0" }}>
            <label>
              <input type="checkbox" checked={viewAll} onChange={(e) => setViewAll(e.target.checked)}/>
              {" "}View all user entries
            </label>
          </div>
        )}

        {loading ? (
          <p>Loading...</p>
        ) : entries.length > 0 ? (
          <>
            <div className={styles.latestResultContainer}>
              <div className={styles.latestResultBox}>
                <p className={styles.latestResultLabel}>Latest Result</p>
                <p className={styles.latestResultTitle}>
                  {new Date(entries[0].created_at).toLocaleString()}
                </p>
                <div className={styles.metaRow}>
                  <div className={styles.drawingCountBadge}>
                    {entries[0].all_drawings.length}
                    {entries[0].all_drawings.length === 1 ? " Drawing" : " Drawings"}
                  </div>
                  {entries[0].hand_used && (
                    <div className={styles.handBadge}>
                      {entries[0].hand_used === 'dominant' ? 'Dominant' : 'Non-Dominant'} Hand
                    </div>
                  )}
                </div>
                <div className={styles.statRow}>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Avg DOS Score</span>
                    <span className={styles.dosValue}>{entries[0].average_DOS || "N/A"}</span>
                  </div>
                </div>
                <div className={styles.scatterPlot}>
                  <HorizontalSpiralHistory savedDrawings={entries[0].all_drawings}/>
                </div>
                <div className={styles.resultLink}>
                  <Link
                    href={`/result/${entries[0].session_id || entries[0].drawing_id}`}
                    className={styles.viewFullAnalysisLink}
                  >
                    View Full Analysis
                  </Link>
                </div>
              </div>
            </div>

            <div className={styles.pastResultsHeadingRow}>
              <h2 className={styles.pastResultsHeading}>Past Results</h2>
              {averageDOS && (
                <span className={styles.overallAvgBadge}>Overall avg DOS: {averageDOS}</span>
              )}
            </div>
            <ul className={styles.entriesList}>
              {paginatedEntries.map((entry, index) => {
                const entryNum = index + 1 + (currentPage - 1) * entriesPerPage;
                const date = new Date(entry.created_at);
                const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                const isOpen = activeIndex === index;
                return (
                  <li key={entry.key} className={styles.accordionItem}>
                    <div className={styles.accordionHeader} onClick={() => handleAccordionClick(index)}>
                      <div className={styles.accordionHeaderLeft}>
                        <span className={styles.accordionIndex}>{entryNum}</span>
                        <div className={styles.accordionMeta}>
                          <span className={styles.accordionDate}>{dateStr} · {timeStr}</span>
                          <div className={styles.accordionBadges}>
                            <span className={styles.accordionBadgeCount}>
                              {entry.all_drawings.length} {entry.all_drawings.length === 1 ? "Drawing" : "Drawings"}
                            </span>
                            {entry.hand_used && (
                              <span className={styles.accordionBadgeHand}>
                                {entry.hand_used === "dominant" ? "Dominant" : "Non-Dom"}
                              </span>
                            )}
                            {isSuperuser && entry.email && (
                              <span className={styles.accordionUser}>{entry.email}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className={styles.accordionHeaderRight}>
                        <MiniSpiralThumb drawing={entry.all_drawings[0]} />
                        <div className={styles.accordionDosBlock}>
                          <span className={styles.accordionDosLabel}>DOS</span>
                          <span className={styles.accordionDos}>{entry.average_DOS || "N/A"}</span>
                        </div>
                        <svg
                          className={`${styles.chevron}${isOpen ? " " + styles.chevronOpen : ""}`}
                          width="16" height="16" viewBox="0 0 16 16" fill="none"
                        >
                          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                    {isOpen && (
                      <div className={styles.accordionContent}>
                        <div className={styles.accordionScatterPlot}>
                          <HorizontalSpiralHistory savedDrawings={entry.all_drawings} compact={true} />
                        </div>
                        <div className={styles.resultLink}>
                          <Link
                            href={`/result/${entry.session_id || entry.drawing_id}`}
                            className={styles.viewFullAnalysisLink}
                          >
                            View Full Analysis →
                          </Link>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <Pagination
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              pageCount={pageCount}
            />
          </>
        ) : (
          <p className={styles.noEntry}>No entries found.</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
