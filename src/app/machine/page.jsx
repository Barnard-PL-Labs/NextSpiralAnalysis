"use client";
import { useState, useEffect, useRef, useCallback } from "react";
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

export default function MachinePage() {
  const canvasRef = useRef();
  const [savedDrawings, setSavedDrawings] = useState([]);
  const [currentDrawing, setCurrentDrawing] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [userFinished, setUserFinished] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Override Supabase from method to catch api_results queries
    const originalFrom = supabase.from;
    
    supabase.from = function(table) {
      const queryBuilder = originalFrom.call(this, table);
      
      if (table === 'api_results') {
        console.log('🔍 Supabase query to api_results table initiated');
        
        // Override eq method to catch drawing_id filters
        const originalEq = queryBuilder.eq;
        queryBuilder.eq = function(column, value) {
          console.log(`📝 Query: ${table}.${column} = ${value}`);
          
          if (column === 'drawing_id' && typeof value === 'string' && value.includes('anon_')) {
            console.error('🚨🚨🚨 FOUND THE PROBLEMATIC QUERY! 🚨🚨🚨');
            console.error('Table:', table);
            console.error('Column:', column);
            console.error('Value:', value);
            console.error('This is the source of your 400 errors!');
            console.error('Call stack:');
            console.trace();
            
            // Force a breakpoint
            debugger;
            
            // You could also throw an error to stop execution:
            // throw new Error(`Invalid drawing_id: ${value}`);
          }
          
          return originalEq.call(this, column, value);
        };
      }
      
      return queryBuilder;
    };
    
    // Cleanup function to restore original
    return () => {
      supabase.from = originalFrom;
    };
  }, []);

  const getOrCreateAnonymousSession = () => {
    let sessionId = localStorage.getItem("anonymous_session_id");

    if (!sessionId) {
      sessionId = `anon_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      localStorage.setItem("anonymous_session_id", sessionId);
      console.log("Created new anonymous session:", sessionId);
    }
    return sessionId;
  };

  const saveAndAnalyzeCurrentDrawing = async () => {
    const overallStartTime = performance.now();
    console.log("🚀 STARTING saveAndAnalyzeCurrentDrawing");

    if (currentDrawing.length == 0) {
      alert("Please draw something before saving.");
      return;
    }

    if (currentDrawing.length < 150) {
      alert(
        "Your spiral is too small for accurate analysis. Please draw a larger spiral that:\n\n• Makes at least 3-4 complete revolutions\n• Fills most of the drawing area\n• Is drawn in a continuous motion"
      );
      return;
    }

    const drawingToSave = [...currentDrawing];

    // Clear canvas immediately
    if (canvasRef.current?.clearCanvas) {
      canvasRef.current.clearCanvas();
    }
    setCurrentDrawing([]);

    const newDrawings = [...savedDrawings, drawingToSave];
    setSavedDrawings(newDrawings);

    setIsAnalyzing(true);

    try {
      // save drawing to Database
      const drawingId = await saveSingleDrawingToDatabase(drawingToSave);

      // analyze the drawing
      console.log(
        "About to send to API:",
        JSON.stringify(drawingToSave).substring(0, 200)
      );

      const result = await backgroundAnalysis(drawingToSave);
      if (result === null || result === "error") {
        throw new Error("Analysis failed to produce valid results");
      }
      // save analysis result to database immediately
      await saveSingleAnalysisResult(drawingId, result);

      console.log("Drawing saved and analyzed, stored in database");
    } catch (error) {
      console.error("❌ Drawing analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const backgroundAnalysis = async (drawingData, drawingIndex = null) => {
    const startTime = performance.now();
    console.log(
      `🕐 Starting analysis ${
        drawingIndex !== null ? `#${drawingIndex + 1}` : ""
      } at ${new Date().toLocaleTimeString()}`
    );
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drawData: drawingData }),
      });

      console.log("API Response Status:", response.status);
      console.log("API Response Status Text:", response.statusText);

      // Safe JSON parsing with error handling
      let data;
      try {
        const responseText = await response.text();
        console.log(
          "API Response Text:",
          responseText.substring(0, 200) + "..."
        );
        data = JSON.parse(responseText);
      } catch (jsonError) {
        console.error("JSON parsing error:", jsonError);
        throw new Error(`Invalid JSON response from API: ${jsonError.message}`);
      }

      if (!response.ok) {
        throw new Error(
          data.error || `Analysis failed with status ${response.status}`
        );
      }

      console.log("Full API result structure:", data.result);

      if (!data.result || typeof data.result !== "object") {
        throw new Error("Invalid analysis result received");
      }

      // timing stuff - only record successful analyses here
      const endTime = performance.now();
      const duration = endTime - startTime;
      console.log(
        `⏱️ Analysis ${
          drawingIndex !== null ? `#${drawingIndex + 1}` : ""
        } completed in ${duration.toFixed(2)}ms (${(duration / 1000).toFixed(
          2
        )}s)`
      );

      return data.result;
    } catch (error) {
      // timing stuff
      const endTime = performance.now();
      const duration = endTime - startTime;
      console.warn(
        ` ❌ Analysis ${
          drawingIndex !== null ? `#${drawingIndex + 1}` : ""
        } failed after ${duration.toFixed(2)}ms:`,
        error.message
      );
      throw error;
    }
  };

  const saveSingleDrawingToDatabase = async (drawingData) => {
    const isAuthenticated = user?.id;
    const sessionId = getOrCreateSessionId();
    console.log(
      `💾 Saving drawing for ${
        isAuthenticated ? "authenticated" : "anonymous"
      } user`
    );
    const email = isAuthenticated
      ? user.email || "anonymous@example.com"
      : "anonymous@example.com";
    const username = isAuthenticated
      ? email.split("@")[0]
      : `anonymous_${sessionId.slice(-8)}`;

    const { data: savedDrawing, error } = await supabase
      .from("drawings")
      .insert({
        user_id: isAuthenticated ? user.id : null,
        email,
        username,
        drawing_data: drawingData,
        session_id: sessionId,
        is_anonymous: !isAuthenticated,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("Database error:", error);
      throw error;
    }

    console.log(`✅ Saved drawing to database with ID: ${savedDrawing.id}`);
    return savedDrawing.id;
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

  // Save analysis result for a specific drawing
  const saveSingleAnalysisResult = async (drawingId, analysisResult) => {
    const isAuthenticated = user?.id;
    const sessionId = getOrCreateSessionId();
    const email = isAuthenticated
      ? user.email || "anonymous@example.com"
      : "anonymous@example.com";
    const username = isAuthenticated
      ? email.split("@")[0]
      : `anonymous_${sessionId.slice(-8)}`;

    const { error } = await supabase.from("api_results").insert({
      user_id: isAuthenticated ? user.id : null,
      email,
      username,
      drawing_id: drawingId,
      session_id: sessionId,
      is_anonymous: !isAuthenticated,
      status: "completed",
      result_data: {
        ...analysisResult,
        completed_at: new Date().toISOString(),
      },
    });

    if (error) {
      console.error("Failed to save analysis result:", error);
      throw error;
    }

    console.log(`✅ Saved analysis result for drawing ${drawingId}`);
  };

  const handleFinishEarly = useCallback(async () => {
    if (savedDrawings.length === 0) {
      alert("Please draw at least one spiral before finishing.");
      return;
    }
    setUserFinished(true);

    const sessionId = getOrCreateSessionId(); // Use consistent session
    const isAuthenticated = user?.id;

    const params = new URLSearchParams({
      session: sessionId,
      anon: (!isAuthenticated).toString(),
    });
    router.push(`/result/${sessionId}?${params.toString()}`);
  }, [savedDrawings, user, router]);

  const clearCurrentDrawing = () => {
    console.log("Clearing data for new drawing...");
    setCurrentDrawing([]);
    if (canvasRef.current?.clearCanvas) {
      canvasRef.current.clearCanvas();
    }
  };

  const clearAllDrawings = () => {
    const confirmed = window.confirm(
      "Are you sure you want to clear all your drawings?"
    );
    if (confirmed) {
      setCurrentDrawing([]);
      setSavedDrawings([]);
      setUserFinished(false);
      setCurrentSessionId(null); // Reset session
      if (canvasRef.current?.clearCanvas) {
        canvasRef.current.clearCanvas();
      }
    }
  };

  return (
    <>
      {!showTutorial && <Header showVideo={false} />}
      <div style={{ position: "relative" }}>
        <div className={styles.machineContainer}>
          <h1 className={styles.title}>Draw Here</h1>

          <button
            className={styles.helpButton}
            onClick={() => setShowTutorial(true)}
            aria-label="Help"
          >
            ?
          </button>

          <Canvas ref={canvasRef} setDrawData={setCurrentDrawing} />
          <MiniSpiralHistory savedDrawings={savedDrawings} />
          <div className={styles.buttonContainer}>
            <button
              onClick={clearCurrentDrawing}
              className={styles.clearCurrentButton}
            >
              Clear
            </button>
            <button onClick={clearAllDrawings} className={styles.clearButton}>
              Clear All
            </button>
          </div>
        </div>
        <Button
          clearDrawing={clearCurrentDrawing}
          savedDrawingsCount={savedDrawings.length}
          onSaveAndAnalyze={saveAndAnalyzeCurrentDrawing}
          isAnalyzing={isAnalyzing}
          onFinishEarly={handleFinishEarly}
          userFinished={userFinished}
        />
      </div>
      {showTutorial && (
        <Tutorial onClose={() => setShowTutorial(false)} forceShow={true} />
      )}
    </>
  );
}
