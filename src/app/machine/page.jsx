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
  const [isProcessingFinal, setIsProcessingFinal] = useState(false);
  const [isAnalysisComplete, setIsAnalysisComplete] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [userFinished, setUserFinished] = useState(false);
  const [simulatedProgress, setSimulatedProgress] = useState(0);
  const [progressTimer, setProgressTimer] = useState(null);
  const [useSimulation, setUseSimulation] = useState(false);
  const simulationActiveRef = useRef(false);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log(
      "🔄 savedResults state changed:",
      savedResults.length,
      savedResults
    );
  }, [savedResults]);

  const displayProgress = useSimulation ? simulatedProgress : analysisProgress;

  // Debug logging
  useEffect(() => {
    console.log("🔄 Progress Debug:", {
      useSimulation,
      simulatedProgress,
      analysisProgress,
      displayProgress,
    });
  }, [useSimulation, simulatedProgress, analysisProgress, displayProgress]);

  // Start simulated progress when analysis begins
  const startSimulatedProgress = useCallback(() => {
    console.log("🎬 Starting simulated progress");
    setSimulatedProgress(0);
    setAnalysisProgress(0);
    setUseSimulation(true);
    simulationActiveRef.current = true;

    const timer = setInterval(() => {
      setSimulatedProgress((prev) => {
        const newValue =
          prev < 85 ? prev + 85 / 140 : prev < 90 ? prev + 0.1 : prev;
        console.log("🎬 Simulated Progress Update:", { prev, newValue });
        return newValue;
      });
    }, 50);
    setProgressTimer(timer);
  }, []);

  // Stop simulated progress and switch to real progress
  const completeProgress = useCallback(() => {
    console.log("✅ Completing progress to 100%");

    // Clear the simulation timer
    if (progressTimer) {
      clearInterval(progressTimer);
      setProgressTimer(null);
    }

    // Switch to actual progress and smoothly animate to 100%
    setUseSimulation(false);
    simulationActiveRef.current = false;
    setAnalysisProgress(100);
    
    // Add a delay so users can see the progress bar reach 100%
    setTimeout(() => {
      setIsAnalysisComplete(true);
    }, 1000);
  }, [progressTimer]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (progressTimer) {
        clearInterval(progressTimer);
      }
    };
  }, [progressTimer]);

  const saveAndAnalyzeCurrentDrawing = async () => {
    console.log("🚀 STARTING saveAndAnalyzeCurrentDrawing");
    console.log("  - Initial savedResults.length:", savedResults.length);
    console.log("  - Initial savedDrawings.length:", savedDrawings.length);

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

    // Triggers loading state when user finishes OR reaches a threshold
    const shouldEnterFinalMode = userFinished || newDrawings.length >= 15;

    if (shouldEnterFinalMode) {
      console.log(
        `🎯 Entering final processing mode (${newDrawings.length} drawings)`
      );
      setIsProcessingFinal(true);
      startSimulatedProgress();
    }

    setSavedDrawings(newDrawings);
    localStorage.setItem("drawData", JSON.stringify(newDrawings));
    sessionStorage.setItem("drawData", JSON.stringify(newDrawings));

    setIsAnalyzing(true);

    try {
      console.log(
        "About to send to API:",
        JSON.stringify(drawingToSave).substring(0, 200)
      );

      const result = await backgroundAnalysis(drawingToSave);

      if (result === null || result === "error") {
        throw new Error("Analysis failed to produce valid results");
      }

      console.log("Individual analysis result:", result);

      setSavedResults((prevResults) => {
        const newResults = [...prevResults, result];

        const correctTotal = newDrawings.length;
        const actualProgress = (newResults.length / correctTotal) * 100;

        // Only update actual progress if we're not in simulation mode
        if (!simulationActiveRef.current) {
          setAnalysisProgress(actualProgress);
        }

        const allCurrentDrawingsAnalyzed =
          newResults.length >= newDrawings.length;

        if (shouldEnterFinalMode && allCurrentDrawingsAnalyzed) {
          console.log("🎯 All current drawings analyzed!");
          completeProgress();

          setTimeout(() => {
            const averageDOS = calculateAverageDOS(newResults);
            console.log("Calculated average DOS:", averageDOS);

            const finalResults = {
              individual_results: newResults,
              average_DOS: averageDOS,
              successful_drawings: newResults.filter((r) => !r.error).length,
              total_drawings: newDrawings.length,

              ...getTraxisData(newResults),
            };
            localStorage.setItem(
              "analysisHistory",
              JSON.stringify(finalResults)
            );
            sessionStorage.setItem(
              "analysisHistory",
              JSON.stringify(finalResults)
            );
            console.log("✅ Average calculation completed and saved!");
            setIsAnalysisComplete(true);
          }, 800);
        } else {
          localStorage.setItem(
            "analysisHistory",
            JSON.stringify({ individual_results: newResults })
          );
          sessionStorage.setItem(
            "analysisHistory",
            JSON.stringify({ individual_results: newResults })
          );
        }

        return newResults;
      });
    } catch (error) {
      console.error(`Drawing ${newDrawings.length} analysis failed:`, error);

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

        const allCurrentDrawingsProcessed =
          newResults.length >= newDrawings.length;

        if (shouldEnterFinalMode && allCurrentDrawingsProcessed) {
          console.log(
            "🎯 Final drawing attempted - calculating average with available data"
          );

          completeProgress();

          const successfulResults = prevResults.filter((r) => !r.error);

          if (successfulResults.length > 0) {
            setTimeout(async () => {
              const averageDOS = calculateAverageDOS(successfulResults);
              console.log(
                "✅ Finalizing results immediately with average DOS:",
                averageDOS
              );

              const finalResults = {
                individual_results: newResults,
                average_DOS: averageDOS,
                successful_drawings: successfulResults.length,
                total_drawings: newDrawings.length,
                ...getTraxisData(successfulResults),
              };

              localStorage.setItem(
                "analysisHistory",
                JSON.stringify(finalResults)
              );
              sessionStorage.setItem(
                "analysisHistory",
                JSON.stringify(finalResults)
              );
              if (user && user.id) {
                try {
                  await saveToSupabase(savedDrawings, finalResults);
                } catch (err) {
                  console.error("Failed to save to Supabase:", err);
                }
              }
              console.log("✅ Results finalized and saved!");
              setIsAnalysisComplete(true);
            }, 800);
          } else {
            setTimeout(() => {
              console.log("❌ No successful analyses to average");
              alert("All analyses failed. Please try again.");
              setIsAnalysisComplete(true);
            }, 800);
          }
        } else {
          console.log(
            "Analysis failed, but continuing with remaining drawings"
          );
          localStorage.setItem(
            "analysisHistory",
            JSON.stringify({ individual_results: newResults })
          );
          sessionStorage.setItem(
            "analysisHistory",
            JSON.stringify({ individual_results: newResults })
          );
        }
        return newResults;
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

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

  const backgroundAnalysis = async (drawingData) => {
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drawData: drawingData }),
      });

      console.log("API Response Status:", response.status);
      console.log("API Response Status Text:", response.statusText);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      console.log("Full API result structure:", data.result);
      console.log("DOS value specifically:", data.result.DOS);
      console.log("DOS value type:", typeof data.result.DOS);

      if (!data.result || typeof data.result !== "object") {
        throw new Error("Invalid analysis result received");
      }

      return data.result;
    } catch (error) {
      console.warn("Analysis error:", error.message);
      throw error;
    }
  };

  const finalizeResultsNow = useCallback(async () => {
    if (savedResults.length > 0) {
      const successfulResults = savedResults.filter((r) => !r.error);

      if (successfulResults.length > 0) {
        completeProgress();

        setTimeout(async () => {
          const averageDOS = calculateAverageDOS(successfulResults);
          console.log(
            "✅ Finalizing results immediately with average DOS:",
            averageDOS
          );

          const finalResults = {
            individual_results: savedResults,
            average_DOS: averageDOS,
            successful_drawings: successfulResults.length,
            total_drawings: savedDrawings.length,
            ...getTraxisData(successfulResults),
          };

          localStorage.setItem("analysisHistory", JSON.stringify(finalResults));
          sessionStorage.setItem(
            "analysisHistory",
            JSON.stringify(finalResults)
          );
          if (user && user.id) {
            try {
              await saveToSupabase(savedDrawings, finalResults);
            } catch (err) {
              console.error("Failed to save to Supabase:", err);
            }
          }
          console.log("✅ Results finalized and saved!");
        }, 300);
      }
    } else {
      completeProgress();
    }
  }, [savedResults, savedDrawings.length, calculateAverageDOS, user, completeProgress]);

  useEffect(() => {
    if (userFinished && isProcessingFinal && !isAnalysisComplete) {
      if (
        savedResults.length >= savedDrawings.length &&
        savedResults.length > 0
      ) {
        console.log("🎯 All analyses complete, finalizing results");
        finalizeResultsNow();
      }
    }
  }, [
    userFinished,
    isProcessingFinal,
    isAnalysisComplete,
    savedResults.length,
    savedDrawings.length,
    finalizeResultsNow,
  ]);

  const handleFinishEarly = useCallback(async () => {
    console.log(`🏁 User finished early with ${savedDrawings.length} drawings`);
    setUserFinished(true);
    setIsProcessingFinal(true);
    startSimulatedProgress();
  }, [savedDrawings.length, startSimulatedProgress]);

  const clearCurrentDrawing = () => {
    console.log("Clearing data for new drawing...");
    setCurrentDrawing([]);
    if (canvasRef.current?.clearCanvas) {
      canvasRef.current.clearCanvas();
    }
    setIsProcessingFinal(false);
    setIsAnalysisComplete(false);
    setUseSimulation(false);
    simulationActiveRef.current = false;
  };

  const clearAllDrawings = () => {
    const confirmed = window.confirm(
      "Are you sure you want to clear all your drawings?"
    );
    if (confirmed) {
      console.log("Clearing all data for new start...");
      setAnalysisProgress(0);
      setSimulatedProgress(0);
      setUseSimulation(false);
      simulationActiveRef.current = false;
      if (progressTimer) {
        clearInterval(progressTimer);
        setProgressTimer(null);
      }
      setCurrentDrawing([]);
      setSavedDrawings([]);
      setSavedResults([]);
      setUserFinished(false); // ✅ ADD: Reset userFinished

      localStorage.removeItem("drawingHistory");
      sessionStorage.removeItem("drawingHistory");
      localStorage.removeItem("analysisHistory");
      sessionStorage.removeItem("analysisHistory");
      localStorage.removeItem("drawData"); // ✅ ADD: Clear drawData too

      if (canvasRef.current?.clearCanvas) {
        canvasRef.current.clearCanvas();
      }
    }
    setIsProcessingFinal(false);
    setIsAnalysisComplete(false);
  };

  const sendDataToBackend = async () => {
    setIsLoadingResults(true);
    console.log(`Analyzing ${savedDrawings.length} drawings...`);
    await router.push("/result");
    setIsLoadingResults(false);
  };

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

  return (
    <>
      {!showTutorial && <Header showVideo={false} />}
      <div style={{ position: "relative" }}>
        {isProcessingFinal ? (
          <div className={styles.loadingContainer}>
            {!isAnalysisComplete ? (
              <>
                <h2 className={styles.loadingText} style={{ fontSize: '1.4rem'}}>
                  Preparing Your Final Results
                </h2>
                <div className={styles.progressContainer}>
                  <div className={styles.loadingBar}>
                    <div
                      className={styles.loadingBarFill}
                      style={{
                        width: `${displayProgress}%`,
                        transition: "width 0.1s ease-out",
                      }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: '1.4rem'}}>Analysis Complete!</h2>
                <Button
                  sendData={sendDataToBackend}
                  clearDrawing={clearCurrentDrawing}
                  savedDrawingsCount={savedDrawings.length}
                  savedResultsCount={savedResults.length}
                  isProcessingFinal={isProcessingFinal}
                  isAnalysisComplete={isAnalysisComplete}
                  onSaveAndAnalyze={saveAndAnalyzeCurrentDrawing}
                  isAnalyzing={isAnalyzing}
                  isLoadingResults={isLoadingResults}
                  onFinishEarly={handleFinishEarly}
                  userFinished={userFinished}
                />
              </>
            )}
          </div>
        ) : (
          <>
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
                <button
                  onClick={clearAllDrawings}
                  className={styles.clearButton}
                >
                  Clear All
                </button>
              </div>
            </div>
            {!isProcessingFinal && (
              <Button
                sendData={sendDataToBackend}
                savedDrawingsCount={savedDrawings.length}
                savedResultsCount={savedResults.length}
                isProcessingFinal={isProcessingFinal}
                onSaveAndAnalyze={saveAndAnalyzeCurrentDrawing}
                isAnalyzing={isAnalyzing}
                isLoadingResults={isLoadingResults}
                onFinishEarly={handleFinishEarly}
                userFinished={userFinished}
              />
            )}
          </>
        )}
      </div>
      {showTutorial && (
        <Tutorial onClose={() => setShowTutorial(false)} forceShow={true} />
      )}
    </>
  );
}
