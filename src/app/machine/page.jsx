"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Canvas from "@/components/Canvas";
import Button from "@/components/Button";
import styles from "@/styles/Canvas.module.css";
import MiniSpiralHistory from "@/components/MiniSpiralHistory";
import Header from "@/components/Header";
import Tutorial from "@/components/Tutorial";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authProvider";
import { supabase } from "@/lib/supabaseClient";
import backgroundStyles from "@/styles/Background.module.css";
import { FaHandPaper } from "react-icons/fa";

export default function MachinePage() {
  const canvasRef = useRef();
  const [savedDrawings, setSavedDrawings] = useState([]); // stores {points, handSide, handUsed}
  const [currentDrawing, setCurrentDrawing] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [userFinished, setUserFinished] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [selectedHand, setSelectedHand] = useState(null); // 'dominant' | 'non-dominant'
  const [selectedHandSide, setSelectedHandSide] = useState(null); // 'L' | 'R'
  const [showDemographics, setShowDemographics] = useState(false);
  const [demographics, setDemographics] = useState({ name: "", age: "", sex: "" });
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Reset hand selection on mount
    setSelectedHand(null);
    localStorage.removeItem("selectedHand");

    const originalFrom = supabase.from;
    supabase.from = function (table) {
      const queryBuilder = originalFrom.call(this, table);
      if (table === "api_results") {
        const originalEq = queryBuilder.eq;
        queryBuilder.eq = function (column, value) {
          if (column === "drawing_id" && typeof value === "string" && value.includes("anon_")) {
            console.error("Problematic api_results query with anon_ drawing_id");
            console.trace();
            debugger;
          }
          return originalEq.call(this, column, value);
        };
      }
      return queryBuilder;
    };
    return () => {
      supabase.from = originalFrom;
    };
  }, []);

  // ——— Leave-page warnings (no autosave) ———
  const hasUnsavedWork = useMemo(() => {
    return (
      currentDrawing.length > 0 ||
      (savedDrawings.length > 0 && !userFinished) ||
      isAnalyzing
    );
  }, [currentDrawing.length, savedDrawings.length, userFinished, isAnalyzing]);

  useEffect(() => {
    const handler = (e) => {
      if (!hasUnsavedWork) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedWork]);

  useEffect(() => {
    const onClickCapture = (e) => {
      if (!hasUnsavedWork) return;
      const el = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!el) return;
      const hrefAttr = el.getAttribute("href");
      if (!hrefAttr) return;
      const url = new URL(el.href, window.location.origin);
      const isExternal = url.origin !== window.location.origin || el.target === "_blank";
      const isHash = hrefAttr.startsWith("#");
      if (isExternal || isHash) return;
      const samePath = url.pathname === window.location.pathname && url.search === window.location.search;
      if (samePath) return;
      e.preventDefault();
      e.stopPropagation();
      const ok = window.confirm("You have unsaved work. Leave this page?");
      if (ok) router.push(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [hasUnsavedWork, router]);

  useEffect(() => {
    const onPopState = () => {
      if (!hasUnsavedWork) return;
      const ok = window.confirm("You have unsaved work. Leave this page?");
      if (!ok) history.forward();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [hasUnsavedWork]);
  // ————————————————————————————————

  const getOrCreateAnonymousSession = () => {
    const sessionKey = "anonymous_session_id";
    const timestampKey = "anonymous_session_timestamp";
    const now = Date.now();
    const MAX_SESSION_AGE_MS = 1 * 60 * 1000; // 1 minute
    const lastTimestamp = parseInt(localStorage.getItem(timestampKey), 10);
    const isExpired = isNaN(lastTimestamp) || now - lastTimestamp > MAX_SESSION_AGE_MS;
    if (isExpired) {
      const newSessionId = `anon_${now}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem(sessionKey, newSessionId);
      localStorage.setItem(timestampKey, now.toString());
      return newSessionId;
    }
    const existingSession = localStorage.getItem(sessionKey);
    return existingSession;
  };

  const getOrCreateSessionId = () => {
    if (currentSessionId) return currentSessionId;
    const isAuthenticated = user?.id;
    const sessionId = isAuthenticated
      ? `session_${Date.now()}_${user.id}`
      : getOrCreateAnonymousSession();
    setCurrentSessionId(sessionId);
    return sessionId;
  };

  const saveAndAnalyzeCurrentDrawing = async () => {
    if (!selectedHandSide) {
      alert("Please select Left (L) or Right (R) hand first.");
      return;
    }
    if (currentDrawing.length < 1) {
      alert("Please draw something before saving.");
      return;
    }
    if (currentDrawing.length < 150) {
      alert(
        "Your spiral doesn't have enough points for accurate analysis. Please draw a spiral that:\n\n• Makes at least 3-4 complete revolutions\n• Fills most of the drawing area\n• Is drawn in a continuous motion"
      );
      return;
    }

    const drawingPoints = [...currentDrawing];

    if (canvasRef.current?.clearCanvas) canvasRef.current.clearCanvas();
    setCurrentDrawing([]);

    // Store with L/R + dominance label for UI
    const labeled = {
      points: drawingPoints,
      handSide: selectedHandSide,          // 'L' | 'R'
      handUsed: selectedHand || null,      // 'dominant' | 'non-dominant' | null
    };
    setSavedDrawings((prev) => [...prev, labeled]);

    setIsAnalyzing(true);
    const sessionId = getOrCreateSessionId();

    try {
      const drawingId = await saveSingleDrawingToDatabase(drawingPoints, sessionId);
      const result = await backgroundAnalysis(drawingPoints);
      if (result === null || result === "error") throw new Error("Analysis failed to produce valid results");
      await saveSingleAnalysisResult(drawingId, result, sessionId);
    } catch (error) {
      console.error("Drawing analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const backgroundAnalysis = async (drawingData, drawingIndex = null) => {
    const TIMEOUT_MS = 70000;
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Analysis timeout: API did not respond within 70 seconds")), TIMEOUT_MS)
      );
      const fetchPromise = fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drawData: drawingData }),
      });
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      const responseText = await response.text();
      const data = JSON.parse(responseText);
      if (!response.ok) throw new Error(data.error || `Analysis failed with status ${response.status}`);
      if (!data.result || typeof data.result !== "object") throw new Error("Invalid analysis result received");
      return data.result;
    } catch (error) {
      if (error.message.includes("timeout")) {
        return { status: "timeout", message: "N/A - Analysis timed out", error: error.message };
      }
      throw error;
    }
  };

  const saveSingleDrawingToDatabase = async (drawingData, sessionId) => {
    const isAuthenticated = user?.id;
    const email = isAuthenticated ? user.email || "anonymous@example.com" : "anonymous@example.com";
    const username = isAuthenticated ? email.split("@")[0] : `anonymous_${sessionId.slice(-8)}`;

    // Include pending demographics if any
    const pendingDemographics = localStorage.getItem("pendingDemographics");
    let demographicsData = {};
    if (pendingDemographics) {
      try {
        const parsed = JSON.parse(pendingDemographics);
        demographicsData = {
          user_name: parsed.name || null,
          user_age: parsed.age ? parseInt(parsed.age) : null,
          user_sex: parsed.sex || null,
        };
      } catch {}
    }

    const { data: savedDrawing, error } = await supabase
      .from("drawings")
      .insert({
        user_id: isAuthenticated ? user.id : null,
        email,
        username,
        drawing_data: drawingData,
        session_id: sessionId,
        is_anonymous: !isAuthenticated,
        hand_used: selectedHand,       // 'dominant' | 'non-dominant' | null
        hand_side: selectedHandSide,   // 'L' | 'R'
        created_at: new Date().toISOString(),
        ...demographicsData,
      })
      .select("id")
      .single();

    if (error) throw error;
    if (pendingDemographics) localStorage.removeItem("pendingDemographics");
    return savedDrawing.id;
  };

  const saveSingleAnalysisResult = async (drawingId, analysisResult, sessionId) => {
    const isAuthenticated = user?.id;
    const email = isAuthenticated ? user.email || "anonymous@example.com" : "anonymous@example.com";
    const username = isAuthenticated ? email.split("@")[0] : `anonymous_${sessionId.slice(-8)}`;
    const status = analysisResult.status === "timeout" ? "timeout" : "completed";

    const { error } = await supabase.from("api_results").insert({
      user_id: isAuthenticated ? user.id : null,
      email,
      username,
      drawing_id: drawingId,
      session_id: sessionId,
      is_anonymous: !isAuthenticated,
      status,
      result_data: { ...analysisResult, completed_at: new Date().toISOString() },
    });
    if (error) throw error;
  };

  const handleFinishEarly = useCallback(async () => {
    if (savedDrawings.length === 0) {
      alert("Please draw at least one spiral before finishing.");
      return;
    }
    setUserFinished(true);
    const sessionId = getOrCreateSessionId();
    const isAuthenticated = user?.id;
    const params = new URLSearchParams({ session: sessionId, anon: (!isAuthenticated).toString() });
    router.push(`/result/${sessionId}?${params.toString()}`);
  }, [savedDrawings, user, router]);

  const clearCurrentDrawing = () => {
    setCurrentDrawing([]);
    if (canvasRef.current?.clearCanvas) canvasRef.current.clearCanvas();
  };

  const handleHandSelection = (hand) => {
    setSelectedHand(hand);
    localStorage.setItem("selectedHand", hand);
  };
  const handleHandSideSelection = (side) => {
    setSelectedHandSide(side);
    localStorage.setItem("selectedHandSide", side);
  };

  const handleDemographicsSave = async () => {
    try {
      const sessionId = getOrCreateSessionId();
      const { data: existingDrawings, error: checkError } = await supabase
        .from("drawings")
        .select("id, session_id")
        .eq("session_id", sessionId);
      if (checkError) {
        alert(`Failed to check existing drawings: ${checkError.message}`);
        return;
      }
      if (!existingDrawings || existingDrawings.length === 0) {
        localStorage.setItem("pendingDemographics", JSON.stringify(demographics));
        localStorage.setItem("userDemographics", JSON.stringify(demographics));
        setShowDemographics(false);
        return;
      }
      const { error } = await supabase
        .from("drawings")
        .update({
          user_name: demographics.name || null,
          user_age: demographics.age ? parseInt(demographics.age) : null,
          user_sex: demographics.sex || null,
        })
        .eq("session_id", sessionId);
      if (error) {
        alert(`Failed to save demographics: ${error.message}`);
        return;
      }
      localStorage.setItem("userDemographics", JSON.stringify(demographics));
      setShowDemographics(false);
    } catch {
      alert("Failed to save demographics. Please try again.");
    }
  };

  const handleDemographicsClose = () => setShowDemographics(false);

  const clearAllDrawings = () => {
    const confirmed = window.confirm(
      "Are you sure you want to clear all your drawings? This will also reset your hand selection."
    );
    if (!confirmed) return;
    setCurrentDrawing([]);
    setSavedDrawings([]);
    setUserFinished(false);
    setCurrentSessionId(null);
    setSelectedHand(null);
    setSelectedHandSide(null);
    localStorage.removeItem("selectedHand");
    localStorage.removeItem("selectedHandSide");
    if (canvasRef.current?.clearCanvas) canvasRef.current.clearCanvas();
  };

  const showCanvas = Boolean(selectedHand && selectedHandSide);

  return (
    <>
      {!showTutorial && <Header showVideo={false} />}
      <div style={{ position: "relative" }}>
        <div className={styles.machineContainer}>
          {/* Initial selection prompt (no horizontal controls here) */}
          {(!selectedHand || !selectedHandSide) && (
            <div className={styles.handSelectionContainer}>
              <h3 className={styles.handSelectionTitle}>
                Select Your Hand
                <FaHandPaper className={styles.handIcon} />
              </h3>

              <div className={styles.handButtonsWrapper}>
                <button
                  onClick={() => handleHandSelection("dominant")}
                  className={
                    styles.handButton + (selectedHand === "dominant" ? " " + styles.handButtonActive : "")
                  }
                  aria-pressed={selectedHand === "dominant"}
                >
                  Dominant Hand
                </button>
                <button
                  onClick={() => handleHandSelection("non-dominant")}
                  className={
                    styles.handButton + (selectedHand === "non-dominant" ? " " + styles.handButtonActive : "")
                  }
                  aria-pressed={selectedHand === "non-dominant"}
                >
                  Non-Dominant Hand
                </button>
              </div>

              <div className={styles.handLRBadgesWrapper}>
                <button
                  type="button"
                  className={
                    styles.handLRBadge + (selectedHandSide === "L" ? " " + styles.handLRBadgeSelected : "")
                  }
                  onClick={() => handleHandSideSelection("L")}
                  aria-pressed={selectedHandSide === "L"}
                >
                  L
                </button>
                <button
                  type="button"
                  className={
                    styles.handLRBadge + (selectedHandSide === "R" ? " " + styles.handLRBadgeSelected : "")
                  }
                  onClick={() => handleHandSideSelection("R")}
                  aria-pressed={selectedHandSide === "R"}
                >
                  R
                </button>
              </div>

              {!user?.id && (
                <div style={{ display: "flex", justifyContent: "center", marginTop: 25 }}>
                  <button
                    onClick={() => setShowDemographics(true)}
                    style={{
                      backgroundColor: "#6fadebfa",
                      color: "white",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "20px",
                      fontSize: "14px",
                      fontWeight: "500",
                      cursor: "pointer",
                      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
                    }}
                  >
                    Optional Demographics
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Title + Canvas + Controls */}
          {showCanvas && (
            <>
              <h1 className={styles.title}>Draw Here</h1>

              {/* Horizontal controls UNDER the title, only in machine view */}
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                <div
                  style={{
                    display: "flex",
                    gap: 24,
                    alignItems: "center",
                    flexWrap: "wrap",
                    justifyContent: "center",
                  }}
                >
                  {/* Hand Side */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 14, opacity: 0.8, minWidth: 70, textAlign: "right" }}>
                      Hand Side
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => handleHandSideSelection("L")}
                        aria-pressed={selectedHandSide === "L"}
                        className={
                          styles.handLRBadge + (selectedHandSide === "L" ? " " + styles.handLRBadgeSelected : "")
                        }
                      >
                        L
                      </button>
                      <button
                        type="button"
                        onClick={() => handleHandSideSelection("R")}
                        aria-pressed={selectedHandSide === "R"}
                        className={
                          styles.handLRBadge + (selectedHandSide === "R" ? " " + styles.handLRBadgeSelected : "")
                        }
                      >
                        R
                      </button>
                    </div>
                  </div>

                  {/* Dominance */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 14, opacity: 0.8, minWidth: 70, textAlign: "right" }}>
                      Dominance
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => handleHandSelection("dominant")}
                        aria-pressed={selectedHand === "dominant"}
                        className={
                          styles.handButton + (selectedHand === "dominant" ? " " + styles.handButtonActive : "")
                        }
                      >
                        Dominant
                      </button>
                      <button
                        onClick={() => handleHandSelection("non-dominant")}
                        aria-pressed={selectedHand === "non-dominant"}
                        className={
                          styles.handButton + (selectedHand === "non-dominant" ? " " + styles.handButtonActive : "")
                        }
                      >
                        Non-Dominant
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <Canvas ref={canvasRef} setDrawData={setCurrentDrawing} />
              <MiniSpiralHistory savedDrawings={savedDrawings} />

              <div className={styles.buttonContainer}>
                <button onClick={clearCurrentDrawing} className={styles.clearCurrentButton}>
                  Clear
                </button>
                <button onClick={clearAllDrawings} className={styles.clearButton}>
                  Clear All
                </button>
              </div>

              <Button
                clearDrawing={clearCurrentDrawing}
                savedDrawingsCount={savedDrawings.length}
                onSaveAndAnalyze={saveAndAnalyzeCurrentDrawing}
                isAnalyzing={isAnalyzing}
                onFinishEarly={handleFinishEarly}
                userFinished={userFinished}
              />
            </>
          )}
        </div>
      </div>

      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} forceShow={true} />}

      {/* Demographics Popup */}
      {showDemographics && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: 15,
              padding: 30,
              width: "90%",
              maxWidth: 400,
              position: "relative",
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            }}
          >
            <button
              onClick={handleDemographicsClose}
              style={{
                position: "absolute",
                top: 15,
                right: 20,
                background: "none",
                border: "none",
                fontSize: 24,
                cursor: "pointer",
                color: "#666",
                fontWeight: "bold",
              }}
            >
              ×
            </button>

            <h2 style={{ marginTop: 0, marginBottom: 25, color: "#333", textAlign: "center", fontSize: 24 }}>
              Optional Demographics
            </h2>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", marginBottom: 8, color: "#333", fontWeight: 500 }}>Name:</label>
              <input
                type="text"
                value={demographics.name}
                onChange={(e) => setDemographics({ ...demographics, name: e.target.value })}
                style={{
                  width: "100%",
                  padding: 12,
                  border: "2px solid #ddd",
                  borderRadius: 8,
                  fontSize: 16,
                  color: "black",
                }}
                placeholder="Enter your name"
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", marginBottom: 8, color: "#333", fontWeight: 500 }}>Age:</label>
              <input
                type="number"
                value={demographics.age}
                onChange={(e) => setDemographics({ ...demographics, age: e.target.value })}
                style={{
                  width: "100%",
                  padding: 12,
                  border: "2px solid #ddd",
                  borderRadius: 8,
                  fontSize: 16,
                  color: "black",
                }}
                placeholder="Enter your age"
                min="1"
                max="120"
              />
            </div>

            <div style={{ marginBottom: 30 }}>
              <label style={{ display: "block", marginBottom: 8, color: "#333", fontWeight: 500 }}>Sex:</label>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setDemographics({ ...demographics, sex: "M" })}
                  style={{
                    flex: 1,
                    padding: 12,
                    border: demographics.sex === "M" ? "2px solid #6c757d" : "2px solid #ddd",
                    borderRadius: 8,
                    fontSize: 16,
                    backgroundColor: demographics.sex === "M" ? "#6c757d" : "white",
                    color: demographics.sex === "M" ? "white" : "#333",
                    cursor: "pointer",
                    fontWeight: demographics.sex === "M" ? 600 : 400,
                  }}
                >
                  Male (M)
                </button>
                <button
                  onClick={() => setDemographics({ ...demographics, sex: "F" })}
                  style={{
                    flex: 1,
                    padding: 12,
                    border: demographics.sex === "F" ? "2px solid #6c757d" : "2px solid #ddd",
                    borderRadius: 8,
                    fontSize: 16,
                    backgroundColor: demographics.sex === "F" ? "#6c757d" : "white",
                    color: demographics.sex === "F" ? "white" : "#333",
                    cursor: "pointer",
                    fontWeight: demographics.sex === "F" ? 600 : 400,
                  }}
                >
                  Female (F)
                </button>
              </div>
            </div>

            <button
              onClick={handleDemographicsSave}
              style={{
                width: "100%",
                padding: 14,
                backgroundColor: "#6fadebfa",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Save Demographics
            </button>
          </div>
        </div>
      )}
    </>
  );
}
