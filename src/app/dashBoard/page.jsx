"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Sidebar from "../../components/SideBar";
import BottomNav from "../../components/BottomNav";
import XYChart from "../../components/Scatter";
import Pagination from "../../components/Pagination";
import styles from "../../styles/Dashboard.module.css";
import Link from "next/link";
import HorizontalSpiralHistory from "../../components/HorizontalSpiralHistory";
import SettingsPopup from "../../components/SettingsPopup";

const SUPERUSER_EMAILS = (
  process.env.NEXT_PUBLIC_SUPERUSER_EMAILS ||
  process.env.NEXT_PUBLIC_SUPERUSER_EMAIL ||
  ""
)
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter((email) => email !== "");

const Dashboard = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [activeIndex, setActiveIndex] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewAll, setViewAll] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [averageDOS, setAverageDOS] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const entriesPerPage = 7;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        setLoading(false);
        return;
      }

      const user = session.user;

      // Extract first name from email (assuming format: firstname.lastname)
      const getFirstName = (email) => {
        const emailPart = email.split("@")[0];
        return (
          emailPart.split(".")[0].charAt(0).toUpperCase() +
          emailPart.split(".")[0].slice(1)
        );
      };

      setUsername(getFirstName(user.email));
      setUserEmail(user.email);

      const { data: profile } = await supabase
        .from("profiles")
        .select("avatar_path")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.avatar_path) {
        const { data: signed } = await supabase.storage
          .from("avatars")
          .createSignedUrl(profile.avatar_path, 3600);
        if (signed?.signedUrl) setAvatarUrl(signed.signedUrl);
      }

      let query = supabase
        .from("api_results")
        .select(
          `
          id,
          drawing_id,
          created_at,
          result_data,
          user_id,
          email,
          drawings (
            id,
            drawing_data
          )
        `
        )
        .order("created_at", { ascending: false });

      const isSuperuser = SUPERUSER_EMAILS.includes(user.email.toLowerCase());

      if (!isSuperuser || !viewAll) {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;

      if (!error && data) {
        const parsed = data.map((entry) => {
          let drawingData = [];
          try {
            drawingData =
              typeof entry.drawings?.drawing_data === "string"
              ? JSON.parse(entry.drawings.drawing_data)
              : entry.drawings?.drawing_data || [];
          } catch (e) {}
          return {
            ...entry,
            drawings: { ...entry.drawings, drawing_data: drawingData },
          };
        });
        setEntries(parsed);

        const dosValues = parsed
          .map((e) => parseFloat(e.result_data?.average_DOS))
          .filter((n) => !isNaN(n));
        if (dosValues.length > 0) {
          const sum = dosValues.reduce((a, b) => a + b, 0);
          setAverageDOS((sum / dosValues.length).toFixed(2));
        }
      }

      setLoading(false);
    };

    fetchData();

    const handleResize = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [viewAll]);

  const handleAccordionClick = (index) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  const paginatedEntries = entries
    .slice(1)
    .slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);
  const pageCount = Math.max(
    1,
    Math.ceil((entries.length - 1) / entriesPerPage)
  );

  const isSuperuser = SUPERUSER_EMAILS.includes(userEmail.toLowerCase());

  return (
    <div className={styles.pageContainer}>
      {isMobile ? <BottomNav onSettingsClick={() => setIsSettingsOpen(true)} /> : <Sidebar onSettingsClick={() => setIsSettingsOpen(true)} />}
      <SettingsPopup isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <div className={styles.content}>
        <div className={styles.welcomeContainer}>
          <h1 className={styles.welcome} style={{ color: "white" }}>
            Welcome back{username ? `, ${username}` : ""}!
          </h1>
        </div>

        {isSuperuser && (
          <div style={{ margin: "1rem 0", color: "white" }}>
            <label>
              <input
                type="checkbox"
                checked={viewAll}
                onChange={(e) => setViewAll(e.target.checked)}
              />{" "}
              View all user entries
            </label>
          </div>
        )}

        {loading ? (
          <p>Loading...</p>
        ) : entries.length > 0 ? (
          <>
            <div className={styles.latestResultContainer}>
              <div className={styles.latestResultBox}>
                <h2 style={{ fontWeight: "bold" , fontSize: "1.5rem" }}>
                  Latest Result
                </h2>
                {entries[0]?.result_data?.average_DOS && (
                  <>
                    <div className={styles.drawingCountBadge}>
                      {Array.isArray(entries[0].drawings.drawing_data[0]) 
                        ? entries[0].drawings.drawing_data.length 
                        : 1}
                      {Array.isArray(entries[0].drawings.drawing_data[0]) 
                        ? (entries[0].drawings.drawing_data.length == 1 ? " Drawing" : " Drawings")
                        : " Drawing"}
                    </div>
                    <p className={styles.dosScoreText}>
                      <strong> <u> Average DOS Score</u>:  </strong>
                      {entries[0].result_data?.average_DOS || "N/A"}
                    </p>
                  </>
                )}
                <p>
                  <strong><u>Analyzed on</u>:</strong>{" "}
                  {new Date(entries[0].created_at).toLocaleString()}
                </p>
                <div className={styles.scatterPlot}>
                  {entries[0]?.drawings?.drawing_data &&
                  entries[0].drawings.drawing_data.length > 0 ? (
                    <HorizontalSpiralHistory
                      savedDrawings={
                        Array.isArray(entries[0].drawings.drawing_data[0])
                          ? entries[0].drawings.drawing_data
                          : [entries[0].drawings.drawing_data]
                      }
                    />
                  ) : (
                    <p>No drawing data available.</p>
                  )}
                </div>

                <div className={styles.resultLink}>
                  <Link
                    href={`/result/${entries[0].drawing_id}`}
                    className={styles.viewFullAnalysisLink}
                  >
                    View Full Analysis
                  </Link>
                </div>
              </div>
            </div>

            <h2 className={styles.pastResultsHeading} style={{ color: "white", fontWeight: "bold" }}>
              Past Results
              {averageDOS && ` - Your Overall Average: ${averageDOS}`}
            </h2>
            <ul className={styles.entriesList}>
              {paginatedEntries.map((entry, index) => (
                <li key={entry.id} className={styles.accordionItem}>
                  <div
                    className={styles.accordionHeader}
                    onClick={() => handleAccordionClick(index)}
                  >
                    <span>
                      {index + 1 + (currentPage - 1) * entriesPerPage}. Avg DOS:
                      {entry.result_data?.average_DOS ||
                        entry.result_data?.DOS ||
                        "N/A"}{" "}
                      –{new Date(entry.created_at).toLocaleString()}
                      {isSuperuser && (
                        <>
                          {" "}
                          — <strong>User:</strong> {entry.email || "N/A"}
                        </>
                      )}
                    </span>
                    <span className={styles.arrow}>
                      {activeIndex === index ? "▲" : "▼"}
                    </span>
                  </div>
                  {activeIndex === index && (
                    <div className={styles.accordionContent}>
                      {entry?.drawings?.drawing_data && (
                        <>
                          <div className={styles.drawingCountBadge}>
                            {Array.isArray(entry.drawings.drawing_data[0]) 
                              ? entry.drawings.drawing_data.length 
                              : 1}
                            {Array.isArray(entry.drawings.drawing_data[0]) 
                              ? (entry.drawings.drawing_data.length == 1 ? " Drawing" : " Drawings")
                              : " Drawing"}
                          </div>
                        </>
                      )}
                      <div className={styles.scatterPlot}>
                        {entry?.drawings?.drawing_data &&
                        entry.drawings.drawing_data.length > 0 ? (
                          <HorizontalSpiralHistory
                            savedDrawings={
                              Array.isArray(entry.drawings.drawing_data[0])
                                ? entry.drawings.drawing_data
                                : [entry.drawings.drawing_data]
                            }
                          />
                        ) : (
                          <p>No drawing data available.</p>
                        )}
                      </div>

                      <div className={styles.resultLink}>
                        <Link
                          href={`/result/${entry.drawing_id}`}
                          className={styles.viewFullAnalysisLink}
                        >
                          View Full Analysis
                        </Link>
                      </div>
                    </div>
                  )}
                </li>
              ))}
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
