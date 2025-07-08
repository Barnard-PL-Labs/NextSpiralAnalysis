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
  const [savedResults, setSavedResults] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [userFinished, setUserFinished] = useState(false);
  const [timingData, setTimingData] = useState([]);
  const [totalProcessingTime, setTotalProcessingTime] = useState(0);
  const [channel] = useState(() => new BroadcastChannel("spiral-analysis"));
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log(
      "🔄 savedResults state changed:",
      savedResults.length,
      savedResults
    );
  }, [savedResults]);

  const saveAndAnalyzeCurrentDrawing = async () => {
    const overallStartTime = performance.now();
    console.log("🚀 STARTING saveAndAnalyzeCurrentDrawing");
    console.log(
      `🕐 Overall process started at ${new Date().toLocaleTimeString()}`
    );

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

    // timing stuff
    const storageStartTime = performance.now();
    localStorage.setItem("drawData", JSON.stringify(newDrawings));
    sessionStorage.setItem("drawData", JSON.stringify(newDrawings));
    const storageEndTime = performance.now();
    console.log(
      `💾 Storage operations took ${(storageEndTime - storageStartTime).toFixed(
        2
      )}ms`
    );

    setIsAnalyzing(true);

    try {
      const analysisStartTime = performance.now();
      console.log(
        "About to send to API:",
        JSON.stringify(drawingToSave).substring(0, 200)
      );

      const result = await backgroundAnalysis(drawingToSave);
      const analysisEndTime = performance.now();
      const analysisDuration = analysisEndTime - analysisStartTime;
      console.log(
        `✅ Single analysis completed in ${(analysisDuration / 1000).toFixed(
          2
        )}s`
      );

      if (result === null || result === "error") {
        throw new Error("Analysis failed to produce valid results");
      }

      console.log("Individual analysis result:", result);

      setSavedResults((prevResults) => {
        const newResults = [...prevResults, result];
        const correctTotal = newDrawings.length;
        const actualProgress = (newResults.length / correctTotal) * 100;

        console.log(
          `📈 Progress: ${
            newResults.length
          }/${correctTotal} complete (${actualProgress.toFixed(1)}%)`
        );

          localStorage.setItem(
            "analysisHistory",
            JSON.stringify({
            individual_results: newResults,
              timing_data: timingData,
            })
          );
          sessionStorage.setItem(
            "analysisHistory",
            JSON.stringify({
              individual_results: newResults,
              timing_data: timingData,
            })
          );
        return newResults;
      });
    } catch (error) {
      const overallEndTime = performance.now();
      const totalTime = overallEndTime - overallStartTime;
      console.error(
        `❌ Drawing ${newDrawings.length} analysis failed after ${(
          totalTime / 1000
        ).toFixed(2)}s:`,
        error
      );

      const errorResult = {
        DOS: null,
        error: true,
        errorMessage: error.message,
        timestamp: new Date().toISOString(),
      };

      setSavedResults((prevResults) => {
        const newResults = [...prevResults, errorResult];
        console.log(
          `Skipping failed analysis. Current successful analyses:`,
          prevResults.filter((r) => !r.error).length
        );
        return newResults;
      });
    } finally {
      setIsAnalyzing(false);
    }
  };
  // timing stuff
  const printTimingSummary = () => {
    console.log("\n📊 TIMING SUMMARY:");
    console.log("==================");

    if (timingData.length === 0) {
      console.log("No timing data available");
      return;
    }

    const successfulTimings = timingData.filter((t) => t.success);
    const failedTimings = timingData.filter((t) => !t.success);

    if (successfulTimings.length > 0) {
      const durations = successfulTimings.map((t) => t.duration);
      const avgTime = durations.reduce((a, b) => a + b, 0) / durations.length;
      const minTime = Math.min(...durations);
      const maxTime = Math.max(...durations);

      console.log(`✅ Successful analyses: ${successfulTimings.length}`);
      console.log(`⏱️ Average time: ${(avgTime / 1000).toFixed(2)}s`);
      console.log(`⚡ Fastest: ${(minTime / 1000).toFixed(2)}s`);
      console.log(`🐌 Slowest: ${(maxTime / 1000).toFixed(2)}s`);
      console.log(
        `📈 Total successful time: ${(
          durations.reduce((a, b) => a + b, 0) / 1000
        ).toFixed(2)}s`
      );
    }

    if (failedTimings.length > 0) {
      console.log(`❌ Failed analyses: ${failedTimings.length}`);
      const failedDurations = failedTimings.map((t) => t.duration);
      const avgFailedTime =
        failedDurations.reduce((a, b) => a + b, 0) / failedDurations.length;
      console.log(
        `⏱️ Average failed time: ${(avgFailedTime / 1000).toFixed(2)}s`
      );
    }

    console.log(
      `🎯 Total processing time: ${(totalProcessingTime / 1000).toFixed(2)}s`
    );

    // Individual breakdown
    console.log("\n🔍 Individual Analysis Times:");
    timingData.forEach((timing, index) => {
      const status = timing.success ? "✅" : "❌";
      const drawingNum =
        timing.drawingIndex !== null
          ? `#${timing.drawingIndex + 1}`
          : `#${index + 1}`;
      console.log(
        `${status} Drawing ${drawingNum}: ${(timing.duration / 1000).toFixed(
          2
        )}s`
      );
    });

    console.log("==================\n");
  };

  useEffect(() => {
    if (timingData.length > 0) {
      const lastTiming = timingData[timingData.length - 1];
      console.log(
        `⏱️ Latest timing: ${(lastTiming.duration / 1000).toFixed(2)}s (${
          lastTiming.success ? "success" : "failed"
        })`
      );
      console.log(`📊 Total timing entries collected: ${timingData.length}`);
    }
  }, [timingData]);

  // Expose timing summary function globally for debugging
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.printTimingSummary = printTimingSummary;
      window.getTimingData = () => timingData;
      console.log(
        "🔧 Debug functions available: window.printTimingSummary() and window.getTimingData()"
      );
    }
  }, [timingData]);

  const getTraxisData = (results) => {
    const lastSuccessful = results.filter((r) => !r.error).pop();
    if (!lastSuccessful) return {};

    return {
      traxis_dir1: lastSuccessful.traxis_dir1,
      traxis_dir2: lastSuccessful.traxis_dir2,
      traxis_dir3: lastSuccessful.traxis_dir3,
      traxis_pw1: lastSuccessful.traxis_pw1,
      traxis_pw2: lastSuccessful.traxis_pw2,
      traxis_pw3: lastSuccessful.traxis_pw3,
    };
  };

  const calculateAverageDOS = useCallback((results) => {
    console.log("Raw results for DOS calculation:", results);
    const dosScores = results
      .map((r) => {
        console.log("Processing result:", r);
        const score = parseFloat(r.DOS);
        console.log("Parsed DOS score:", score);
        return score;
      })
      .filter((score) => !isNaN(score));
    console.log("Filtered DOS scores:", dosScores);
    if (dosScores.length === 0) return 0;
    return (dosScores.reduce((a, b) => a + b, 0) / dosScores.length).toFixed(2);
  }, []);

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
        console.log("API Response Text:", responseText.substring(0, 200) + "...");
        data = JSON.parse(responseText);
      } catch (jsonError) {
        console.error("JSON parsing error:", jsonError);
        throw new Error(`Invalid JSON response from API: ${jsonError.message}`);
      }

      if (!response.ok) {
        throw new Error(data.error || `Analysis failed with status ${response.status}`);
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
      setTimingData((prev) => [
        ...prev,
        {
          drawingIndex: drawingIndex,
          duration: duration,
          timestamp: new Date().toISOString(),
          success: true,
          status: response.status,
        },
      ]);

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
      setTimingData((prev) => [
        ...prev,
        {
          drawingIndex: drawingIndex,
          duration: duration,
          timestamp: new Date().toISOString(),
          success: false,
          error: error.message,
        },
      ]);
      throw error;
    }
  };

  const handleFinishEarly = useCallback(async () => {
    console.log(`🏁 User finished early with ${savedDrawings.length} drawings`);

    if (savedDrawings.length === 0) {
      alert("Please draw at least one spiral before finishing.");
      return;
    }
    setUserFinished(true);

    // Clear any existing analysis history to prevent showing old partial results
      localStorage.removeItem("analysisHistory");
      sessionStorage.removeItem("analysisHistory");

    // Store active session info for immediate UI setup
    const sessionData = {
      totalDrawings: savedDrawings.length,
      startTime: Date.now(),
      sessionId: Date.now().toString(),
    };
    localStorage.setItem("activeAnalysisSession", JSON.stringify(sessionData));

    // Broadcast analysis start session immediately before navigation
    console.log("📡 [BROADCAST] Sending ANALYSIS_SESSION_STARTED before navigation");
    channel.postMessage({
      type: "ANALYSIS_SESSION_STARTED",
      data: {
        sessionId: sessionData.sessionId,
        drawings: savedDrawings,
        totalDrawings: savedDrawings.length,
        startTime: sessionData.startTime,
      },
    });

    // Navigate to results page
    router.push("/result");
    
    // Start background processing
    processAllDrawingsInBackground(savedDrawings);
  }, [savedDrawings, channel, router]);

  const saveToSupabase = async (drawData, apiResult) => {
    if (!user || !user.id) return;
    const email = user.email || "anonymous@example.com";
    const username = email.split("@")[0];
    try {
      const { data: drawing, error: drawError } = await supabase
        .from("drawings")
        .insert([{ user_id: user.id, email, username, drawing_data: drawData }])
        .select("id")
        .single();

      if (drawError) throw drawError;

      await supabase.from("api_results").insert([
        {
          user_id: user.id,
          email,
          username,
          drawing_id: drawing.id,
          result_data: apiResult,
        },
      ]);

      console.log(" Multi-drawing data saved to Supabase.");
    } catch (err) {
      console.error(" Error saving to Supabase:", err);
    }
  };

  // Batch processing background analysis
  const processAllDrawingsInBackground = useCallback(
    async (drawings) => {
      console.log(`🔄 Processing ${drawings.length} drawings in background...`);

      // Backup broadcast in case the initial one was missed
      console.log("📡 [BROADCAST] Sending backup ANALYSIS_SESSION_STARTED");
      channel.postMessage({
        type: "ANALYSIS_SESSION_STARTED",
        data: {
          sessionId: Date.now().toString(),
          drawings: drawings,
          totalDrawings: drawings.length,
          startTime: Date.now(),
        },
      });

      const allResults = [];
      const allTimings = [];

        for (let i = 0; i < drawings.length; i++) {
        const startTime = performance.now();
        
        try {
          console.log(
            `🕐 Background analysis ${i + 1}/${drawings.length} started`
          );

          // Broadcast that this specific drawing started analyzing
          channel.postMessage({
            type: "DRAWING_ANALYSIS_STARTED",
            data: {
              drawingIndex: i,
              currentlyAnalyzing: i + 1,
              totalDrawings: drawings.length,
            },
          });

          const response = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              drawData: drawings[i],
              user: user ? { 
                email: user.email || "anonymous", 
                username: (user.email || "anonymous").split("@")[0] 
              } : { email: "anonymous", username: "anonymous" }
            }),
          });

          // Safe JSON parsing with error handling
          let data;
          try {
            const responseText = await response.text();
            console.log(`API Response Text for drawing ${i + 1}:`, responseText.substring(0, 200) + "...");
            data = JSON.parse(responseText);
          } catch (jsonError) {
            console.error(`JSON parsing error for drawing ${i + 1}:`, jsonError);
            throw new Error(`Invalid JSON response from API: ${jsonError.message}`);
          }

          const duration = performance.now() - startTime;

          if (!response.ok) {
            throw new Error(data.error || `Analysis failed with status ${response.status}`);
          }

          console.log(
            `✅ Drawing ${i + 1} completed in ${(duration / 1000).toFixed(2)}s`
          );

          // Store result for Supabase save
          allResults.push(data.result);
          allTimings.push({
            duration,
            success: true,
            timestamp: new Date().toISOString(),
            status: response.status,
          });

          // Broadcast successful completion
          channel.postMessage({
            type: "DRAWING_ANALYSIS_COMPLETED",
            data: {
              drawingIndex: i,
              result: data.result,
              timing: {
                duration,
                success: true,
                timestamp: new Date().toISOString(),
                status: response.status,
              },
              progress: {
                completed: i + 1,
                total: drawings.length,
                percentage: ((i + 1) / drawings.length) * 100,
              },
            },
          });

          // Update liveProgress for polling mechanism
          localStorage.setItem("liveProgress", JSON.stringify({
            completed: i + 1, 
            total: drawings.length,
            results: allResults,
            isComplete: false
          }));
        } catch (error) {
          const duration = performance.now() - startTime;

          console.error(
            `❌ Drawing ${i + 1} failed after ${(duration / 1000).toFixed(
              2
            )}s:`,
            error
          );

          // Store error result for Supabase save
          const errorResult = {
            DOS: null,
            error: true,
            errorMessage: error.message,
            timestamp: new Date().toISOString(),
          };

          allResults.push(errorResult);
          allTimings.push({
            duration,
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
          });

          // Broadcast failure
          channel.postMessage({
            type: "DRAWING_ANALYSIS_FAILED",
            data: {
              drawingIndex: i,
              error: errorResult,
              timing: {
                duration,
                success: false,
                error: error.message,
                timestamp: new Date().toISOString(),
              },
              progress: {
                completed: i + 1,
                total: drawings.length,
                percentage: ((i + 1) / drawings.length) * 100,
              },
            },
          });

          // Update liveProgress for polling mechanism (include failed results)
          localStorage.setItem("liveProgress", JSON.stringify({
            completed: i + 1, 
            total: drawings.length,
            results: allResults,
            isComplete: false
          }));
        }
      }

      // save (when all drawings are complete)
      console.log(
        "🏁 All background analysis completed - saving to Supabase..."
      );

      // Calculate final results
      const successfulResults = allResults.filter((r) => !r.error);
      const averageDOS = calculateAverageDOS(successfulResults);

      const finalResults = {
        individual_results: allResults,
        average_DOS: averageDOS,
        successful_drawings: successfulResults.length,
        total_drawings: drawings.length,
        timing_data: allTimings,
        total_processing_time: allTimings.reduce(
          (sum, t) => sum + t.duration,
          0
        ),
        ...getTraxisData(successfulResults),
      };



      // Save to localStorage/sessionStorage
      localStorage.setItem("analysisHistory", JSON.stringify(finalResults));
      sessionStorage.setItem("analysisHistory", JSON.stringify(finalResults));

      // ✅ SAVE TO SUPABASE (moved from saveAndAnalyzeCurrentDrawing)
      if (user && user.id) {
        try {
          await saveToSupabase(drawings, finalResults);
          console.log("✅ Successfully saved to Supabase");
        } catch (err) {
          console.error("❌ Failed to save to Supabase:", err);
        }
      }

      // Set final completion flag in liveProgress
      localStorage.setItem("liveProgress", JSON.stringify({
        completed: drawings.length,
        total: drawings.length,
        results: allResults,
        isComplete: true
      }));

      // Broadcast completion
      channel.postMessage({
        type: "ANALYSIS_SESSION_COMPLETED",
        data: {
          completedAt: Date.now(),
          totalDrawings: drawings.length,
          finalResults: finalResults,
        },
      });

      // Delay cleanup by 5 seconds so polling can catch the final completion
      setTimeout(() => {
        console.log("🧹 [CLEANUP] Delayed cleanup of liveProgress after 5 seconds");
        localStorage.removeItem("liveProgress");
      }, 5000);

      console.log("🏁 All background analysis and saving completed");
    },
    [channel, user, calculateAverageDOS, getTraxisData, saveToSupabase]
  );

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
      console.log("Clearing all data for new start...");
      setAnalysisProgress(0);
      setCurrentDrawing([]);
      setSavedDrawings([]);
      setSavedResults([]);
      setUserFinished(false);
      setTimingData([]);
      setTotalProcessingTime(0);

      localStorage.removeItem("drawingHistory");
      sessionStorage.removeItem("drawingHistory");
      localStorage.removeItem("analysisHistory");
      sessionStorage.removeItem("analysisHistory");
      localStorage.removeItem("activeAnalysisSession");
      localStorage.removeItem("liveProgress");
      localStorage.removeItem("drawData");

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
          sendData={() => {}}
          clearDrawing={clearCurrentDrawing}
                savedDrawingsCount={savedDrawings.length}
                savedResultsCount={savedResults.length}
          isProcessingFinal={false}
          isAnalysisComplete={false}
                onSaveAndAnalyze={saveAndAnalyzeCurrentDrawing}
                isAnalyzing={isAnalyzing}
                isLoadingResults={isLoadingResults}
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
