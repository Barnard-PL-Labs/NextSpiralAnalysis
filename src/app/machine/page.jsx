"use client";
import { useState, useEffect, useRef } from "react";
import Canvas from "@/components/Canvas";
import Button from "@/components/Button";
import styles from "@/styles/Canvas.module.css";
import MiniSpiralHistory from "@/components/MiniSpiralHistory";
import Header from "@/components/Header";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authProvider";
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
  const { user } = useAuth();
  const router = useRouter();

  // DEBUGGING
  useEffect(() => {
    console.log("🏠 MachinePage component mounted/re-mounted");
    console.log("🏠 Initial savedResults:", savedResults);
    console.log("🏠 Initial savedDrawings:", savedDrawings);

    return () => {
      console.log("🏠 MachinePage component unmounting");
    };
  }, []);

  useEffect(() => {
    console.log(
      "🔄 savedResults state changed:",
      savedResults.length,
      savedResults
    );
  }, [savedResults]);

  // Saves drawings to a collection
  const saveAndAnalyzeCurrentDrawing = async () => {
    // DEBUGGING
    console.log("🚀 STARTING saveAndAnalyzeCurrentDrawing");
    console.log("  - Initial savedResults.length:", savedResults.length);
    console.log("  - Initial savedDrawings.length:", savedDrawings.length);
    console.log("  - savedResults contents:", savedResults);

    console.log("Saving/analyzing a drawing");
    if (currentDrawing.length == 0) {
      alert("Please draw something before analyzing.");
      return;
    }

    // Add minimum size validation
    if (currentDrawing.length < 150) {
      alert(
        "Your spiral is too small for accurate analysis. Please draw a larger spiral that:\n\n• Makes at least 3-4 complete revolutions\n• Fills most of the drawing area\n• Is drawn in a continuous motion"
      );
      return;
    }

    // Store current drawing before clearing
    const drawingToSave = [...currentDrawing];

    // Clear the canvas and current drawing state immediately for better UX
    if (canvasRef.current?.clearCanvas) {
      canvasRef.current.clearCanvas();
    }
    setCurrentDrawing([]);

    // Update saved drawings state immediately
    const newDrawings = [...savedDrawings, drawingToSave];

    // Loading state check
    const isLastDrawing = newDrawings.length === 5;

    if (isLastDrawing) {
      setIsProcessingFinal(true);
    }

    setSavedDrawings(newDrawings);
    localStorage.setItem("drawData", JSON.stringify(newDrawings));
    sessionStorage.setItem("drawData", JSON.stringify(newDrawings));

    setIsAnalyzing(true);

    try {
      // Analyze the saved drawing
      console.log(
        "About to send to API:",
        JSON.stringify(drawingToSave).substring(0, 200)
      );
      const result = await backgroundAnalysis(drawingToSave);

      if (result === null || result === "error") {
        throw new Error("Analysis failed to produce valid results");
      }

      console.log("Individual analysis result:", result);

      // Added in fuctional state update instead of direct
      setSavedResults((prevResults) => {
        const newResults = [...prevResults, result];
        setAnalysisProgress((newResults.length / 5) * 100);

        console.log(`Saved/analyzed drawing ${newDrawings.length}/5`);

        // calculating and storing avg DOS if we have 5 drawings
        if (newResults.length === 5) {
          console.log("🎯 REACHED 5 DRAWINGS!");
          const averageDOS = calculateAverageDOS(newResults);
          console.log("Calculated average DOS:", averageDOS);

          const finalResults = {
            individual_results: newResults,
            average_DOS: averageDOS,
            traxis_dir1: newResults[newResults.length - 1].traxis_dir1,
            traxis_dir2: newResults[newResults.length - 1].traxis_dir2,
            traxis_dir3: newResults[newResults.length - 1].traxis_dir3,
            traxis_pw1: newResults[newResults.length - 1].traxis_pw1,
            traxis_pw2: newResults[newResults.length - 1].traxis_pw2,
            traxis_pw3: newResults[newResults.length - 1].traxis_pw3,
          };
          localStorage.setItem("analysisHistory", JSON.stringify(finalResults));
          sessionStorage.setItem(
            "analysisHistory",
            JSON.stringify(finalResults)
          );
          console.log("✅ Average calculation completed and saved!");
          setIsAnalysisComplete(true);
        } else {
          localStorage.setItem(
            "analysisHistory",
            JSON.stringify({ individual_results: newResults })
          );
          sessionStorage.setItem(
            "analysisHistory",
            JSON.stringify({ individual_results: newResults })
          );
          console.log(`📊 Still need ${5 - newResults.length} more drawings`);
        }

        return newResults;
      });
    } catch (error) {
      console.error(`Drawing ${newDrawings.length} analysis failed:`, error);

      // Store error result with DOS as null/undefined
      const errorResult = {
        DOS: null,
        error: true,
        errorMessage: error.message,
        timestamp: new Date().toISOString(),
      };

      setSavedResults((prevResults) => {
        const newResults = [...prevResults, errorResult];
        setAnalysisProgress((newResults.length / 5) * 100);

        // Skips the failed analysis
        console.log(
          `Skipping failed analysis. Current successful analyses:`,
          savedResults.length
        );
        if (isLastDrawing) {
          console.log(
            "🎯 5th drawing attempted - calculating average with available data"
          );
          if (prevResults.length > 0) {
            const averageDOS = calculateAverageDOS(prevResults);
            console.log(
              `✅ Calculated average DOS from ${prevResults.length} successful drawings:`,
              averageDOS
            );

            const finalResults = {
              individual_results: newResults,
              average_DOS: averageDOS,
              successful_drawings: prevResults.length,
              total_attempts: 5,
              traxis_dir1: prevResults[prevResults.length - 1].traxis_dir1,
              traxis_dir2: prevResults[prevResults.length - 1].traxis_dir2,
              traxis_dir3: prevResults[prevResults.length - 1].traxis_dir3,
              traxis_pw1: prevResults[prevResults.length - 1].traxis_pw1,
              traxis_pw2: prevResults[prevResults.length - 1].traxis_pw2,
              traxis_pw3: prevResults[prevResults.length - 1].traxis_pw3,
            };

            localStorage.setItem(
              "analysisHistory",
              JSON.stringify(finalResults)
            );
            sessionStorage.setItem(
              "analysisHistory",
              JSON.stringify(finalResults)
            );
            console.log(
              "✅ Final average calculation completed with available data!"
            );
            setIsAnalysisComplete(true);
          } else {
            console.log("❌ No successful analyses to average");
            alert("All analyses failed. Please try again.");
            setIsAnalysisComplete(true);
          }
        } else {
          console.log("Analysis failed, but continuing w/ remaining drawings");
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

  // Calculate average DOS from individual results
  const calculateAverageDOS = (results) => {
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
  };

  // Background drawing analysis function
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
      // DEBUGGING
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

  // Clear only current drawing allowing for mistakes
  const clearCurrentDrawing = () => {
    console.log("Clearing data for new drawing...");
    setCurrentDrawing([]);
    if (canvasRef.current?.clearCanvas) {
      canvasRef.current.clearCanvas();
    }
    setIsProcessingFinal(false);
    setIsAnalysisComplete(false);
  };

  // Clears all drawings after results
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

      localStorage.removeItem("drawingHistory");
      sessionStorage.removeItem("drawingHistory");
      localStorage.removeItem("analysisHistory");
      sessionStorage.removeItem("analysisHistory");

      if (canvasRef.current?.clearCanvas) {
        canvasRef.current.clearCanvas();
      }
    }
    setIsProcessingFinal(false);
    setIsAnalysisComplete(false);
  };

  // Save drawings and navigate immediately
  const sendDataToBackend = async () => {
    setIsLoadingResults(true);
    console.log(`Analyzing ${savedDrawings.length} drawings...`);
    await router.push("/result");
    setIsLoadingResults(false);
  };
  console.log("🔍 RENDER DEBUG:");
  console.log("- isProcessingFinal:", isProcessingFinal);
  console.log("- isAnalysisComplete:", isAnalysisComplete);
  console.log("- savedDrawings.length:", savedDrawings.length);
  console.log("- savedResults.length:", savedResults.length);

  return (
    <>
      <Header showVideo={false} />
      <div style={{ position: "relative" }}>
        {isProcessingFinal ? (
          <div className={styles.loadingContainer}>
            {!isAnalysisComplete ? (
              <>
                <h2 className={styles.loadingText}>
                  Preparing Your Final Results
                </h2>
                <div className={styles.progressContainer}>
                  <div className={styles.loadingBar}>
                    <div
                      className={styles.loadingBarFill}
                      style={{ width: `${analysisProgress}%` }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2>Analysis Complete!</h2>
                <Button
                  sendData={sendDataToBackend}
                  clearDrawing={clearCurrentDrawing}
                  savedDrawingsCount={savedDrawings.length}
                  savedResultsCount={savedResults.length}
                  isProcessingFinal={isProcessingFinal}
                  onSaveAndAnalyze={saveAndAnalyzeCurrentDrawing}
                  isAnalyzing={isAnalyzing}
                  isLoadingResults={isLoadingResults}
                />
              </>
            )}
          </div>
        ) : (
          <>
            <div className={styles.machineContainer}>
              <h1 className={styles.title}>Draw Here</h1>

              <Canvas ref={canvasRef} setDrawData={setCurrentDrawing} />
              <MiniSpiralHistory savedDrawings={savedDrawings} />
              <button onClick={clearAllDrawings} className={styles.clearButton}>
                Clear All Drawings
              </button>
            </div>
            {!isProcessingFinal && (
              <Button
                sendData={sendDataToBackend}
                clearDrawing={clearCurrentDrawing}
                savedDrawingsCount={savedDrawings.length}
                savedResultsCount={savedResults.length}
                isProcessingFinal={isProcessingFinal}
                onSaveAndAnalyze={saveAndAnalyzeCurrentDrawing}
                isAnalyzing={isAnalyzing}
                isLoadingResults={isLoadingResults}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
