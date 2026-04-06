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
  const [isConfirmed, setIsConfirmed] = useState(false);
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

  const handleContinue = () => {
    if (showDemographics && (demographics.name || demographics.age || demographics.sex)) {
      localStorage.setItem("pendingDemographics", JSON.stringify(demographics));
      localStorage.setItem("userDemographics", JSON.stringify(demographics));
    }
    setIsConfirmed(true);
  };

  const clearAllDrawings = () => {
    const ok = window.confirm(
      "Are you sure you want to clear all your drawings? This will also reset your hand selection."
    );
    if (!ok) return;
    setCurrentDrawing([]);
    setSavedDrawings([]);
    setUserFinished(false);
    setCurrentSessionId(null);
    setSelectedHand(null);
    setSelectedHandSide(null);
    setIsConfirmed(false);
    setShowDemographics(false);
    localStorage.removeItem("selectedHand");
    localStorage.removeItem("selectedHandSide");
    if (canvasRef.current?.clearCanvas) canvasRef.current.clearCanvas();
  };

  const showCanvas = isConfirmed;

  return (
    <>
      {!showTutorial && <Header showVideo={false} />}
      <div style={{ minHeight: "100vh", paddingTop: "75px", paddingBottom: "48px", background: "#edf2fb" }}>
        <div className={styles.machineContainer}>
          {/* Initial selection prompt */}
{!isConfirmed && (
  <div className={styles.handSelectionContainer}>

    {/* Page header */}
    <div className={styles.cardHeader}>
      <div className={styles.cardIconWrapper}>
        <FaHandPaper className={styles.cardIcon} />
      </div>
      <h1 className={styles.cardTitle}>Spiral Drawing Assessment</h1>
      <p className={styles.cardSubtitle}>Patient Information &amp; Setup</p>
    </div>

    {/* Pre-Test sub-header */}
    <div className={styles.preTestHeader}>
      <h2 className={styles.preTestTitle}>Pre-Test Information</h2>
      <p className={styles.preTestDescription}>Please provide the following information to begin the assessment</p>
    </div>

    {/* Dominance */}
    <div className={styles.selectionGroup}>
      <label className={styles.sectionLabel}>
        <span className={styles.sectionDot} />
        Is this your dominant hand?
      </label>
      <div className={styles.handOptionsGrid}>
        <button
          onClick={() => handleHandSelection("dominant")}
          className={styles.handOptionCard + (selectedHand === "dominant" ? " " + styles.handOptionCardActive : "")}
          aria-pressed={selectedHand === "dominant"}
        >
          Dominant
        </button>
        <button
          onClick={() => handleHandSelection("non-dominant")}
          className={styles.handOptionCard + (selectedHand === "non-dominant" ? " " + styles.handOptionCardActive : "")}
          aria-pressed={selectedHand === "non-dominant"}
        >
          Non-Dominant
        </button>
      </div>
    </div>

    <div className={styles.selectionDivider} />

    {/* Hand side */}
    <div className={styles.selectionGroup}>
      <label className={styles.sectionLabel}>
        <span className={styles.sectionDot} />
        Which hand will be tested?
      </label>
      <div className={styles.handOptionsGrid}>
        <button
          type="button"
          className={styles.handOptionCard + (selectedHandSide === "L" ? " " + styles.handOptionCardActive : "")}
          onClick={() => handleHandSideSelection("L")}
          aria-pressed={selectedHandSide === "L"}
        >
          Left Hand
        </button>
        <button
          type="button"
          className={styles.handOptionCard + (selectedHandSide === "R" ? " " + styles.handOptionCardActive : "")}
          onClick={() => handleHandSideSelection("R")}
          aria-pressed={selectedHandSide === "R"}
        >
          Right Hand
        </button>
      </div>
    </div>

    <div className={styles.selectionDivider} />

    {/* Demographics toggle */}
    <div className={styles.demographicsRow} onClick={() => setShowDemographics(prev => !prev)}>
      <input type="checkbox" className={styles.demographicsCheckbox} checked={showDemographics} readOnly onChange={() => {}} />
      <span className={styles.demographicsLabel}>Include optional demographics</span>
    </div>

    {/* Inline demographics panel */}
    {showDemographics && (
      <div className={styles.demographicsPanel}>
        <div className={styles.demographicsField}>
          <label className={styles.demographicsFieldLabel}>Name</label>
          <input
            type="text"
            value={demographics.name}
            onChange={(e) => setDemographics({ ...demographics, name: e.target.value })}
            className={styles.demographicsInput}
            placeholder="Enter name"
          />
        </div>
        <div className={styles.demographicsField}>
          <label className={styles.demographicsFieldLabel}>Age</label>
          <input
            type="number"
            value={demographics.age}
            onChange={(e) => setDemographics({ ...demographics, age: e.target.value })}
            className={styles.demographicsInput}
            placeholder="Enter age"
            min="0"
            max="120"
          />
        </div>
        <div className={styles.demographicsField}>
          <label className={styles.demographicsFieldLabel}>Gender</label>
          <div className={styles.sexButtonsRow}>
            <button
              type="button"
              onClick={() => setDemographics({ ...demographics, sex: "M" })}
              className={styles.sexButton + (demographics.sex === "M" ? " " + styles.sexButtonActive : "")}
            >Male</button>
            <button
              type="button"
              onClick={() => setDemographics({ ...demographics, sex: "F" })}
              className={styles.sexButton + (demographics.sex === "F" ? " " + styles.sexButtonActive : "")}
            >Female</button>
          </div>
        </div>
      </div>
    )}

    {/* Continue button */}
    <button
      onClick={handleContinue}
      disabled={!selectedHand || !selectedHandSide}
      className={styles.continueButton}
    >
      Continue to Spiral Analysis →
    </button>

  </div>
)}


          {/* Title + Canvas + Controls */}
          {showCanvas && (
            <>
              <h1 className={styles.title} style={{ marginBottom: 6 }}>Draw Your Spiral</h1>
              <p style={{ color: "var(--color-text-secondary)", fontSize: 15, marginBottom: 28, marginTop: 0 }}>
                Select your preferences and draw a spiral from the center outward
              </p>

              {/* White card containing controls + canvas */}
              <div className={styles.drawingCard}>
                {/* Controls inside card */}
                <div className={styles.controlsBar} style={{ border: "none", boxShadow: "none", background: "transparent", marginBottom: 0 }}>
                  <div className={styles.controlsGroup}>
                    <span className={styles.controlsGroupLabel}>Side</span>
                    <button
                      type="button"
                      onClick={() => handleHandSideSelection("L")}
                      aria-pressed={selectedHandSide === "L"}
                      className={styles.handLRBadge + (selectedHandSide === "L" ? " " + styles.handLRBadgeSelected : "")}
                    >L</button>
                    <button
                      type="button"
                      onClick={() => handleHandSideSelection("R")}
                      aria-pressed={selectedHandSide === "R"}
                      className={styles.handLRBadge + (selectedHandSide === "R" ? " " + styles.handLRBadgeSelected : "")}
                    >R</button>
                  </div>
                  <div className={styles.controlsGroup}>
                    <span className={styles.controlsGroupLabel}>Dominance</span>
                    <button
                      onClick={() => handleHandSelection("dominant")}
                      aria-pressed={selectedHand === "dominant"}
                      className={styles.handButton + (selectedHand === "dominant" ? " " + styles.handButtonActive : "")}
                    >Dominant</button>
                    <button
                      onClick={() => handleHandSelection("non-dominant")}
                      aria-pressed={selectedHand === "non-dominant"}
                      className={styles.handButton + (selectedHand === "non-dominant" ? " " + styles.handButtonActive : "")}
                    >Non-Dominant</button>
                  </div>
                </div>

                <div className={styles.cardDivider} />

                <Canvas ref={canvasRef} setDrawData={setCurrentDrawing} />
              </div>

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
    </>
  );
}
