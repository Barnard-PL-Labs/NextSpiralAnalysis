"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Canvas from "@/components/Canvas";
import styles from "@/styles/Canvas.module.css";
import MiniSpiralHistory from "@/components/MiniSpiralHistory";
import Header from "@/components/Header";
import Tutorial from "@/components/Tutorial";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authProvider";
import { supabase } from "@/lib/supabaseClient";
import { FaHandPaper } from "react-icons/fa";

function detectDevicePpi() {
  if (typeof window === "undefined") return { ppi: 264, recognized: true };
  const dpr = window.devicePixelRatio || 1;
  const width = window.screen.width * dpr;
  const height = window.screen.height * dpr;
  const maxDim = Math.max(width, height);
  const minDim = Math.min(width, height);
  console.log("MAX DIM", maxDim, "MIN DIM", minDim, navigator.userAgent);
  if (navigator.userAgent.includes("Macintosh")) {
    if (maxDim === 2420 && minDim === 1668) return { ppi: 264, recognized: true }; // iPad Pro 11" M4
    if (maxDim === 2752 && minDim === 2064) return { ppi: 264, recognized: true }; // iPad Pro 13" M4
    if (maxDim === 2388 && minDim === 1668) return { ppi: 264, recognized: true }; // iPad Pro 11" M1-M3
    if (maxDim === 2360 && minDim === 1640) return { ppi: 264, recognized: true }; // iPad Air 11"
    if (maxDim === 2732 && minDim === 2048) return { ppi: 264, recognized: true }; // iPad Air 13"
    if (maxDim === 2560 && minDim === 1600) return { ppi: 224, recognized: true }; // MacBook
  }
  if (navigator.userAgent.includes("Android")) {
    if (maxDim === 2800 && minDim === 1752) return { ppi: 266, recognized: true };
    if (maxDim === 2560 && minDim === 1600) return { ppi: 274, recognized: true };
    if (maxDim === 2960 && minDim === 1848) return { ppi: 239, recognized: true };
  }
  console.log("[device] unrecognized device, falling back to 264 PPI");
  return { ppi: 264, recognized: false };
}

const SUPABASE_WRITE_TIMEOUT_MS = 20000;
const ANALYSIS_TIMEOUT_MS = 70000;
const ANALYSIS_MAX_ATTEMPTS = 3; // Initial request plus two retries

const withTimeout = (promise, timeoutMs, label) => {
  let timeoutId;

  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out. Please check your connection and try again.`));
    }, timeoutMs);
  });

  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    clearTimeout(timeoutId);
  });
};

const cleanPointsForMatlabTimestamps = (points) => {
  const merged = [];

  for (const point of points) {
    const t = Math.max(0, Math.round(Number(point.t) || 0));
    const x = Number(point.x);
    const y = Number(point.y);
    const p = Math.round(Number(point.p) || 0);

    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const previous = merged[merged.length - 1];

    if (previous && t === previous.t) {
      const count = previous.__mergeCount + 1;
      previous.x = previous.x + (x - previous.x) / count;
      previous.y = previous.y + (y - previous.y) / count;
      previous.p = Math.round(previous.p + (p - previous.p) / count);
      previous.__mergeCount = count;
      continue;
    }

    if (previous && t < previous.t) continue;

    merged.push({ ...point, x, y, p, t, __mergeCount: 1 });
  }

  const firstT = merged[0]?.t ?? 0;
  return merged.map(({ __mergeCount, ...point }, index) => ({
    ...point,
    n: index + 1,
    t: point.t - firstT,
    x: +point.x.toFixed(4),
    y: +point.y.toFixed(4),
  }));
};

export default function MachinePage() {
  const canvasRef = useRef();
  const drawingIdMap = useRef({}); // localId -> drawingId, updated synchronously (avoids React state timing issues)
  const removedLocalIds = useRef(new Set()); // localIds removed by user before pipeline completes
  const [savedDrawings, setSavedDrawings] = useState([]); // stores {points, handSide, handUsed}
  const [currentDrawing, setCurrentDrawing] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [userFinished, setUserFinished] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [dominantHandSide, setDominantHandSide] = useState(null); // 'L' | 'R' — which physical hand is dominant
  const [selectedHandSide, setSelectedHandSide] = useState(null); // 'L' | 'R'
  const [showDemographics, setShowDemographics] = useState(false);
  const [showStudyDemographics, setShowStudyDemographics] = useState(false);
  const [demographics, setDemographics] = useState({ name: "", age: "", sex: "", studyId: "" });
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [{ ppi: devicePpi, recognized: deviceRecognized }] = useState(detectDevicePpi);
  const [warningAcknowledged, setWarningAcknowledged] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  
  useEffect(() => {
    setDominantHandSide(null);
    setIsSaving(false);
    setIsAnalyzing(false);
    localStorage.removeItem("dominantHandSide");
    localStorage.removeItem("anonymous_session_id");
    localStorage.removeItem("anonymous_session_timestamp");
    console.log("[device] devicePixelRatio:", window.devicePixelRatio);
  }, []);

  useEffect(() => {
    const meta = document.querySelector("meta[name='viewport']");
    const original = meta?.getAttribute("content");
    meta?.setAttribute("content", "width=device-width, initial-scale=1");
    requestAnimationFrame(() => {
      meta?.setAttribute("content", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no");
    });

    const originalTouchAction = document.body.style.touchAction;
    document.body.style.touchAction = "pan-x pan-y";

    const preventZoom = (e) => { if (e.touches.length > 1) e.preventDefault(); };
    const preventGesture = (e) => e.preventDefault();

    document.addEventListener("touchstart", preventZoom, { passive: false });
    document.addEventListener("touchmove", preventZoom, { passive: false });
    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });

    return () => {
      if (original) meta?.setAttribute("content", original);
      document.body.style.touchAction = originalTouchAction;
      document.removeEventListener("touchstart", preventZoom);
      document.removeEventListener("touchmove", preventZoom);
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
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
    const MAX_SESSION_AGE_MS = 30 * 60 * 1000; // 30 minutes
    const lastTimestamp = parseInt(localStorage.getItem(timestampKey), 10);
    const isExpired = isNaN(lastTimestamp) || now - lastTimestamp > MAX_SESSION_AGE_MS;
    if (isExpired) {
      const newSessionId = `anon_${now}_${Math.random().toString(36).substring(2, 11)}`;
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

  const refreshAuthBeforeWrite = async () => {
    if (!user?.id) return;

    const { data: sessionData, error: sessionError } = await withTimeout(
      supabase.auth.getSession(),
      SUPABASE_WRITE_TIMEOUT_MS,
      "Session check"
    );

    if (sessionError) throw sessionError;
    if (!sessionData?.session) {
      throw new Error("Your login session expired. Please sign in again before saving.");
    }

    const { error: refreshError } = await withTimeout(
      supabase.auth.refreshSession(),
      SUPABASE_WRITE_TIMEOUT_MS,
      "Session refresh"
    );

    if (refreshError) throw refreshError;

    const { data, error } = await withTimeout(
      supabase.auth.getUser(),
      SUPABASE_WRITE_TIMEOUT_MS,
      "Session validation"
    );

    if (error || !data?.user) {
      throw error || new Error("Your login session expired. Please sign in again before saving.");
    }
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
    const localId = Date.now().toString();
    const labeled = {
      localId,
      points: drawingPoints,
      handSide: selectedHandSide,          // 'L' | 'R'
      handUsed: selectedHand || null,      // 'dominant' | 'non-dominant' | null
    };
    setSavedDrawings((prev) => [...prev, labeled]);

    setIsAnalyzing(true);
    setIsSaving(true);
    const sessionId = getOrCreateSessionId();

    try {
      await refreshAuthBeforeWrite();

      console.log("[1/3] Saving drawing to Supabase...", { sessionId, points: drawingPoints.length });
      const drawingId = await saveSingleDrawingToDatabase(drawingPoints, sessionId);
      console.log("[1/3] Drawing saved:", drawingId);
      drawingIdMap.current[localId] = drawingId;
      // If user deleted this drawing while we were saving, clean it up and bail
      if (removedLocalIds.current.has(localId)) {
        await supabase.from("drawings").delete().eq("id", drawingId);
        return;
      }
      setSavedDrawings((prev) => prev.map(d => d.localId === localId ? { ...d, drawingId } : d));
      setIsSaving(false);

      console.log("[2/3] Sending to analysis API...");
      const result = await backgroundAnalysis(drawingPoints);
      if (result === null || result === "error") throw new Error("Analysis failed to produce valid results");
      console.log("[2/3] Analysis returned:", result);

      // Skip save if user removed this drawing during the analysis
      if (removedLocalIds.current.has(localId)) return;
      console.log("[3/3] Saving result to Supabase...");
      await saveSingleAnalysisResult(drawingId, result, sessionId);
      console.log("[3/3] Result saved. Pipeline complete.");
    } catch (error) {
      console.error("Drawing analysis failed:", error?.message || error?.details || JSON.stringify(error) || error);
      if (!drawingIdMap.current[localId]) {
        setSavedDrawings((prev) => prev.filter((d) => d.localId !== localId));
      }
      alert(error?.message || "Unable to save this drawing. Please try again.");
    } finally {
      setIsSaving(false);
      setIsAnalyzing(false);
    }
  };

  const backgroundAnalysis = async (drawingData) => {
    try {
      // Scale x/y from CSS pixels to digitizer units (200 units = 1 inch),
      // pre-divided by 8 to compensate for dataconvert.m's hardcoded *8 factor
      // (a legacy Wacom tablet calibration that inflates all coordinates 8×).
      // After dataconvert multiplies by 8, effective scale = 200/cssPpi as intended.
      // y-center is 150 (= 1200/8) so after ×8 it maps to 1200, the center of
      // MATLAB's hardcoded 2400-unit canvas height used in the y-flip (y2 = 2400 - y).
      console.log("[device] using PPI:", devicePpi);
      if (!window.devicePixelRatio) console.warn("[scale] devicePixelRatio not detected, falling back to 1");
      const cssPpi = devicePpi / (window.devicePixelRatio || 1);
      const scale = 200 / cssPpi / 8;
      const cleanedData = cleanPointsForMatlabTimestamps(drawingData);
      if (cleanedData.length < 3) throw new Error("Drawing does not have enough valid timed points for analysis");
      console.log("[cleanup] raw points:", drawingData.length, "submitted points:", cleanedData.length, "removed/merged:", drawingData.length - cleanedData.length);
      const firstY = cleanedData[0].y;
      const scaledData = cleanedData.map((pt) => ({
        ...pt,
        x: +(pt.x * scale).toFixed(4),
        y: +((pt.y - firstY) * scale + 150).toFixed(4),
      }));
      console.log("[scale] cssPpi:", cssPpi, "scale:", scale, "firstPoint:", scaledData[0], "lastPoint:", scaledData[scaledData.length - 1]);

      // === CLIENT-SIDE COORDINATE DIAGNOSTICS (post-scale — these are the values sent to the API) ===
      const xs = scaledData.map(p => p.x);
      const ys = scaledData.map(p => p.y);
      const ts = scaledData.map(p => p.t);
      const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
      const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
      const radii = scaledData.map(p => Math.sqrt((p.x - meanX) ** 2 + (p.y - meanY) ** 2));
      console.log("=== COORDINATE DIAGNOSTICS (client, post-scale) ===");
      console.log("Point count:", scaledData.length);
      console.log("X range:", Math.min(...xs).toFixed(2), "→", Math.max(...xs).toFixed(2), " span:", (Math.max(...xs) - Math.min(...xs)).toFixed(2), "25-DPI units (×8→200 DPI in MATLAB)");
      console.log("Y range:", Math.min(...ys).toFixed(2), "→", Math.max(...ys).toFixed(2), " span:", (Math.max(...ys) - Math.min(...ys)).toFixed(2), "25-DPI units");
      console.log("Centroid:", meanX.toFixed(2), ",", meanY.toFixed(2));
      console.log("Radial range:", Math.min(...radii).toFixed(2), "→", Math.max(...radii).toFixed(2), "25-DPI units");
      console.log("Drawing duration:", Math.max(...ts) - Math.min(...ts), "ms");
      console.log("Pressure range:", Math.min(...scaledData.map(p => p.p)), "→", Math.max(...scaledData.map(p => p.p)));
      console.log("devicePixelRatio:", window.devicePixelRatio, " scale factor:", scale.toFixed(4));
      console.log("====================================================");
      let lastError;
      for (let attempt = 1; attempt <= ANALYSIS_MAX_ATTEMPTS; attempt += 1) {
        const controller = new AbortController();
        try {
          console.log(`[analysis] attempt ${attempt}/${ANALYSIS_MAX_ATTEMPTS}`);
          const response = await withTimeout(
            fetch("/api/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ drawData: scaledData }),
              signal: controller.signal,
            }),
            ANALYSIS_TIMEOUT_MS,
            "Analysis request"
          ).catch((error) => {
            controller.abort();
            throw error;
          });

          const responseText = await response.text();
          let data;
          try {
            data = JSON.parse(responseText);
          } catch {
            const parseError = new Error("Invalid response received from analysis server");
            parseError.retryable = response.status >= 500;
            throw parseError;
          }

          if (!response.ok) {
            const responseError = new Error(data.error || `Analysis failed with status ${response.status}`);
            responseError.retryable = response.status >= 500;
            throw responseError;
          }
          if (!data.result || typeof data.result !== "object") {
            throw new Error("Invalid analysis result received");
          }
          return data.result;
        } catch (error) {
          lastError = error;
          const message = error?.message?.toLowerCase() || "";
          const retryable =
            error?.retryable === true ||
            error?.name === "TypeError" ||
            error?.name === "AbortError" ||
            message.includes("timeout") ||
            message.includes("timed out") ||
            message.includes("network");

          if (!retryable || attempt === ANALYSIS_MAX_ATTEMPTS) throw error;
          console.warn(`[analysis] attempt ${attempt} failed; retrying`, error);
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        } finally {
          controller.abort();
        }
      }
      throw lastError;
    } catch (error) {
      const message = error?.message?.toLowerCase() || "";
      if (message.includes("timeout") || message.includes("timed out")) {
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
          study_id: parsed.studyId || null,
        };
      } catch {}
    }

    const { data: savedDrawing, error } = await withTimeout(
      supabase
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
        .single(),
      SUPABASE_WRITE_TIMEOUT_MS,
      "Drawing save"
    );

    if (error) throw error;
    return savedDrawing.id;
  };

  const saveSingleAnalysisResult = async (drawingId, analysisResult, sessionId) => {
    const isAuthenticated = user?.id;
    const email = isAuthenticated ? user.email || "anonymous@example.com" : "anonymous@example.com";
    const username = isAuthenticated ? email.split("@")[0] : `anonymous_${sessionId.slice(-8)}`;
    const status = analysisResult.status === "timeout" ? "timeout" : "completed";

    const { error } = await withTimeout(
      supabase.from("api_results").insert({
        user_id: isAuthenticated ? user.id : null,
        email,
        username,
        drawing_id: drawingId,
        session_id: sessionId,
        is_anonymous: !isAuthenticated,
        status,
        result_data: { ...analysisResult, completed_at: new Date().toISOString() },
      }),
      SUPABASE_WRITE_TIMEOUT_MS,
      "Analysis result save"
    );
    if (error) throw error;
  };

  const handleFinishEarly = useCallback(async () => {
    if (savedDrawings.length === 0) {
      alert("Please draw at least one spiral before finishing.");
      return;
    }
    setUserFinished(true);
    localStorage.removeItem("pendingDemographics");
    const sessionId = getOrCreateSessionId();
    const isAuthenticated = user?.id;
    const params = new URLSearchParams({ session: sessionId, anon: (!isAuthenticated).toString() });
    router.push(`/result/${sessionId}?${params.toString()}`);
  }, [savedDrawings, user, router]);

  const clearCurrentDrawing = () => {
    setCurrentDrawing([]);
    if (canvasRef.current?.clearCanvas) canvasRef.current.clearCanvas();
  };

  const handleHandSelection = (side) => {
    setDominantHandSide(side);
    localStorage.setItem("dominantHandSide", side);
  };
  const handleHandSideSelection = (side) => {
    setSelectedHandSide(side);
    localStorage.setItem("selectedHandSide", side);
  };

  const handleContinue = () => {
    if (showDemographics && (demographics.name || demographics.age || demographics.sex || demographics.studyId)) {
      localStorage.setItem("pendingDemographics", JSON.stringify(demographics));
      localStorage.setItem("userDemographics", JSON.stringify(demographics));
    }
    setIsConfirmed(true);
  };

  const selectedHand = dominantHandSide && selectedHandSide
    ? (dominantHandSide === selectedHandSide ? "dominant" : "non-dominant")
    : null;

  const handSideLabel = selectedHandSide === "L" ? "Left" : selectedHandSide === "R" ? "Right" : "";
  const dominanceLabel = selectedHand === "dominant" ? "Dominant Hand" : selectedHand === "non-dominant" ? "Non-dominant Hand" : "";
  const activeHandSummary = handSideLabel && dominanceLabel ? `${handSideLabel} · ${dominanceLabel}` : "";
  const showActiveHandSummary = Boolean(activeHandSummary);

  const removeDrawing = async (index) => {
    const drawing = savedDrawings[index];
    if (!drawing) return;
    setSavedDrawings((prev) => prev.filter((_, i) => i !== index));
    if (drawing.localId) removedLocalIds.current.add(drawing.localId);
    const drawingId = drawing.drawingId ?? drawingIdMap.current[drawing.localId];
    if (!drawingId) return;
    const res = await fetch("/api/delete-drawing", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ drawingId }),
    });
    if (!res.ok) {
      const json = await res.json();
      console.error("[remove] Failed to delete drawing from database:", json);
    }
  };
//hi
  const clearAllDrawings = async () => {
    const ok = window.confirm(
      "Are you sure you want to clear all your drawings? This will also reset your hand selection."
    );
    if (!ok) return;

    const sessionId = currentSessionId;
    console.log("Clearing session:", sessionId);

    setCurrentDrawing([]);
    setSavedDrawings([]);
    setUserFinished(false);
    setCurrentSessionId(null);
    setDominantHandSide(null);
    setSelectedHandSide(null);
    setIsConfirmed(false);
    setShowDemographics(false);
    localStorage.removeItem("dominantHandSide");
    localStorage.removeItem("selectedHandSide");

    if (sessionId) {
      const { data: selectData } = await supabase.from('drawings').select("id, session_id").eq('session_id', sessionId);
      console.log("Rows visible before delete:", selectData);
      const { data: drawingData, error: drawingsError } = await supabase.from('drawings').delete().eq('session_id', sessionId).select("id, created_at");
      console.log("Deleted drawings count:", drawingData?.length ?? 0);
      drawingData?.forEach((d) => console.log("Deleted drawing id:", d.id));
      console.log("Drawing error: ", drawingsError);
      const { data: resultsData, error: resultsError } = await supabase.from('api_results').delete().eq('session_id', sessionId).select("*");
      console.log("API result data: ", resultsData);
      console.log("API result error: ", resultsError);
    }
  // delete from drawing table via session_id, then make sure to delete related api_results
    if (canvasRef.current?.clearCanvas) canvasRef.current.clearCanvas();
  };

  const showCanvas = isConfirmed;

  return (
    <>
      {!showTutorial && <Header showVideo={false} />}
      <div style={{ minHeight: "100vh", paddingTop: "75px", paddingBottom: "48px", background: "linear-gradient(135deg, #eff6ff 0%, #eef2ff 50%, #faf5ff 100%)" }}>
        <div className={styles.machineContainer}>
          {/* Initial selection prompt */}
{!isConfirmed && (
  <div className={styles.handSelectionContainer}>

    {/* Page header */}
    <div className={styles.cardHeader}>
      <h1 className={styles.cardTitle}>Spiral Analysis Test</h1>
      <p className={styles.cardSubtitle}>Please provide the following information to begin the drawing</p>
    </div>

	    {/* Demographics toggle */}
	    <div className={`${styles.demographicsRow} ${showDemographics ? styles.demographicsRowOpen : ""}`} onClick={() => setShowDemographics(prev => !prev)}>
	      <input type="checkbox" className={styles.demographicsCheckbox} checked={showDemographics} readOnly onChange={() => {}} />
	      <span className={styles.demographicsLabel}>Include optional demographics</span>
	    </div>

    {/* Inline demographics panel */}
    <div className={`${styles.demographicsPanel} ${showDemographics ? styles.demographicsPanelOpen : ""}`}>
      <div className={styles.demographicsPanelInner}>

        {/* Clinical study toggle — top of panel */}
        <div
          className={styles.demographicsToggleField}
          onClick={() => setShowStudyDemographics(prev => !prev)}
        >
          <input
            type="checkbox"
            className={styles.demographicsCheckbox}
            checked={showStudyDemographics}
            readOnly
            onChange={() => {}}
          />
          <label className={styles.demographicsFieldLabel} style={{ cursor: "pointer" }}>Clinical study</label>
        </div>

        {showStudyDemographics ? (
          <>
            <div className={styles.demographicsField}>
              <label className={styles.demographicsFieldLabel}>Study name:</label>
              <input
                type="text"
                value={demographics.studyId}
                onChange={(e) => setDemographics({ ...demographics, studyId: e.target.value })}
                className={styles.demographicsInput}
                placeholder=""
              />
            </div>
            <div className={styles.demographicsField}>
              <label className={styles.demographicsFieldLabel}>Subject ID:</label>
              <input
                type="text"
                value={demographics.name}
                onChange={(e) => setDemographics({ ...demographics, name: e.target.value })}
                className={styles.demographicsInput}
                placeholder=""
              />
            </div>
            <div className={styles.demographicsField}>
              <label className={styles.demographicsFieldLabel}>Gender:</label>
              <select
                value={demographics.sex}
                onChange={(e) => setDemographics({ ...demographics, sex: e.target.value })}
                className={styles.demographicsInput}
              >
                <option value="">Select</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </select>
            </div>
            <div className={styles.demographicsField}>
              <label className={styles.demographicsFieldLabel}>Age:</label>
              <input
                type="number"
                value={demographics.age}
                onChange={(e) => setDemographics({ ...demographics, age: e.target.value })}
                className={styles.demographicsInput}
                placeholder=""
                min="0"
                max="120"
              />
            </div>
          </>
        ) : (
          <>
            <div className={styles.demographicsField}>
              <label className={styles.demographicsFieldLabel}>Name:</label>
              <input
                type="text"
                value={demographics.name}
                onChange={(e) => setDemographics({ ...demographics, name: e.target.value })}
                className={styles.demographicsInput}
                placeholder=""
              />
            </div>
            <div className={styles.demographicsField}>
              <label className={styles.demographicsFieldLabel}>Age:</label>
              <input
                type="number"
                value={demographics.age}
                onChange={(e) => setDemographics({ ...demographics, age: e.target.value })}
                className={styles.demographicsInput}
                placeholder=""
                min="0"
                max="120"
              />
            </div>
            <div className={styles.demographicsField}>
              <label className={styles.demographicsFieldLabel}>Gender:</label>
              <select
                value={demographics.sex}
                onChange={(e) => setDemographics({ ...demographics, sex: e.target.value })}
                className={styles.demographicsInput}
              >
                <option value="">Select</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </select>
            </div>
          </>
	        )}
	      </div>
	    </div>

	    {/* Dominance */}
	    <div className={styles.selectionGroup}>
	      <label className={styles.sectionLabel}>
	        <span className={styles.sectionDot} />
	        What is your dominant hand?
	      </label>
	      <div className={styles.handOptionsGrid}>
	        <button
	          onClick={() => handleHandSelection("L")}
	          className={styles.handOptionCard + (dominantHandSide === "L" ? " " + styles.handOptionCardActive : "")}
	          aria-pressed={dominantHandSide === "L"}
	        >
	          Left Hand
	        </button>
	        <button
	          onClick={() => handleHandSelection("R")}
	          className={styles.handOptionCard + (dominantHandSide === "R" ? " " + styles.handOptionCardActive : "")}
	          aria-pressed={dominantHandSide === "R"}
	        >
	          Right Hand
	        </button>
	      </div>
	    </div>

	    {/* Hand side */}
	    <div className={styles.selectionGroup}>
	      <label className={styles.sectionLabel}>
	        <span className={styles.sectionDot} />
	        Which hand will be tested first?
	      </label>
	      <div className={styles.handOptionsGrid}>
	        <button
	          type="button"
	          className={`${styles.handOptionCard}${selectedHandSide === "L" ? " " + styles.handOptionCardActive : ""}`}
	          onClick={() => handleHandSideSelection("L")}
	          aria-pressed={selectedHandSide === "L"}
	        >
	          Left Hand
	        </button>
	        <button
	          type="button"
	          className={`${styles.handOptionCard}${selectedHandSide === "R" ? " " + styles.handOptionCardActive : ""}`}
	          onClick={() => handleHandSideSelection("R")}
	          aria-pressed={selectedHandSide === "R"}
	        >
	          Right Hand
	        </button>
	      </div>
	    </div>

	    {/* Continue button */}
    <button
      onClick={handleContinue}
      disabled={!dominantHandSide || !selectedHandSide}
      className={styles.continueButton}
    >
      Continue to Spiral Analysis →
    </button>

  </div>
)}


          {/* Title + Canvas + Controls */}
          {showCanvas && (
            <>
              <h1 className={styles.title} style={{ marginBottom: 6, fontSize: "1.85rem" }}>Draw Your Spiral</h1>
              <p style={{ color: "#545e6f", fontSize: "1.15rem", fontWeight: 600, marginBottom: 28, marginTop: 0 }}>
                Select your preferences and draw a spiral from the center outward
              </p>

              {/* White card containing controls + canvas + action buttons */}
<div className={styles.drawingCard} style={!deviceRecognized && !warningAcknowledged ? {
                border: "1.5px solid #fcd34d",
                boxShadow: "0 0 0 3px rgba(251,191,36,0.15), 0 8px 32px rgba(99,102,241,0.08)",
              } : {}}>
                {/* Controls inside card */}
                <div className={styles.controlsBar}>
                  <div className={styles.controlsGroup}>
                    <span className={styles.controlsGroupLabel}>Hand</span>
                    <div className={styles.segmentedPill}>
                      <button
                        type="button"
                        onClick={() => handleHandSideSelection("L")}
                        aria-pressed={selectedHandSide === "L"}
                        className={styles.handLRBadge + (selectedHandSide === "L" ? " " + styles.handLRBadgeSelected : "")}
                      >Left</button>
                      <button
                        type="button"
                        onClick={() => handleHandSideSelection("R")}
                        aria-pressed={selectedHandSide === "R"}
                        className={styles.handLRBadge + (selectedHandSide === "R" ? " " + styles.handLRBadgeSelected : "")}
                      >Right</button>
                    </div>
                  </div>
	                  <div className={styles.controlsGroup}>
	                    <span className={styles.controlsGroupLabel}>Dominance</span>
	                    <div className={styles.segmentedPill}>
                      <button
                        onClick={() => setDominantHandSide(selectedHandSide)}
                        aria-pressed={selectedHand === "dominant"}
                        className={styles.handButton + (selectedHand === "dominant" ? " " + styles.handButtonActive : "")}
                      >Dom</button>
                      <button
                        onClick={() => setDominantHandSide(selectedHandSide === "L" ? "R" : "L")}
                        aria-pressed={selectedHand === "non-dominant"}
                        className={styles.handButton + (selectedHand === "non-dominant" ? " " + styles.handButtonActive : "")}
                      >Non</button>
	                    </div>
	                  </div>
	                </div>
	                {showActiveHandSummary && (
	                  <div className={styles.activeHandSummary}>{activeHandSummary}</div>
	                )}

	                <div style={{ position: "relative" }}>
                  <Canvas ref={canvasRef} setDrawData={setCurrentDrawing} devicePpi={devicePpi} />
                  {!deviceRecognized && !warningAcknowledged && (
                    <div style={{
                      position: "absolute", inset: 0,
                      background: "rgba(255,255,255,0.72)",
                      backdropFilter: "blur(6px)",
                      borderRadius: 8,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <div style={{
                        background: "var(--color-surface)",
                        border: "1px solid #fde68a",
                        borderRadius: "var(--radius-md)",
                        padding: "24px 28px",
                        maxWidth: 320, width: "90%",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.10)",
                        textAlign: "center",
                      }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: 10,
                          background: "#fef3c7",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          margin: "0 auto 14px",
                        }}>
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M10 2.5L2 17h16L10 2.5z" fill="#fde68a" stroke="#d97706" strokeWidth="1.6" strokeLinejoin="round"/>
                            <path d="M10 8.5v3.5" stroke="#d97706" strokeWidth="1.6" strokeLinecap="round"/>
                            <circle cx="10" cy="14.5" r="0.85" fill="#d97706"/>
                          </svg>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text-primary)", marginBottom: 8 }}>
                          Device Not Recognized
                        </div>
                        <p style={{ margin: "0 0 18px", fontSize: 12.5, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
                          Screen density could not be verified. Results may be less accurate. Contact your study administrator if precision is required.
                        </p>
                        <button
                          onClick={() => setWarningAcknowledged(true)}
                          style={{
                            width: "100%", padding: "8px 0", fontSize: 13, fontWeight: 600,
                            background: "var(--color-accent)", color: "white",
                            border: "none", borderRadius: "var(--radius-sm)",
                            cursor: "pointer", fontFamily: "var(--font-sans)",
                          }}
                        >
                          Acknowledge &amp; Continue
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className={styles.cardDivider} style={{ marginBottom: 0 }} />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", paddingTop: 12 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={clearCurrentDrawing} className={styles.clearCurrentButton}>Clear</button>
                    <button onClick={clearAllDrawings} className={styles.clearButton}>Clear All</button>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {!userFinished && savedDrawings.length > 0 && (
                      <button className={styles.button} onClick={handleFinishEarly}>
                        Finish Analysis
                        <span className={styles.countBadge}>{savedDrawings.length}</span>
                      </button>
                    )}
                    {!userFinished && savedDrawings.length < 15 && (
                      <button className={styles.saveButton} onClick={saveAndAnalyzeCurrentDrawing} disabled={isSaving}>
                        Save
                      </button>
                    )}
                  </div>
                </div>

              </div>

              <MiniSpiralHistory savedDrawings={savedDrawings} onRemove={!userFinished ? removeDrawing : undefined} />
            </>
          )}
        </div>
      </div>

      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} forceShow={true} />}
    </>
    
  );
}
