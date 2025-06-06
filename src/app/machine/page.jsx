"use client";
import { useState, useEffect, useRef } from "react";
import Canvas from "@/components/Canvas";
import Button from "@/components/Button";
import styles from "@/styles/Canvas.module.css";
import Header from "@/components/Header";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authProvider";

export default function MachinePage() {
  const canvasRef = useRef();
  const [savedDrawings, setSavedDrawings] = useState([]);
  const [currentDrawing, setCurrentDrawing] = useState([]);
  const [savedResults, setSavedResults] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isProcessingFinal, setIsProcessingFinal] = useState(false);
  const [isAnalysisComplete, setIsAnalysisComplete] = useState(false);
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
    if (currentDrawing.length < 100) {
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
      const result = await backgroundAnalysis(drawingToSave);

      if (result === null || result === "error") {
        throw new Error("Analysis failed to produce valid results");
      }

      console.log("Individual analysis result:", result);

      // Added in fuctional state update instead of direct
      setSavedResults((prevResults) => {
        const newResults = [...prevResults, result];
        console.log(`Saved/analyzed drawing ${newDrawings.length}/5`);

        console.log("🔍 DEBUGGING STATE TIMING:");
        console.log("  - prevResults.length (old state):", prevResults.length);
        console.log("  - newResults.length (new data):", newResults.length);
        console.log("  - result.DOS:", result.DOS);

        // calculating and storing avg DOS if we have 5 drawings
        if (newResults.length === 5) {
          console.log("🎯 REACHED 5 DRAWINGS!");
          setIsProcessingFinal(false);
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
      console.warn("Error analyzing drawing:", error.message);

      // Skips the failed analysis
      console.log(
        "SKipping failed analysis. Current successful analyses: ${savedResults.length}"
      );
      if (isLastDrawing) {
        console.log(
          "🎯 5th drawing attempted - calculating average with available data"
        );
        setSavedResults((prevResults) => {
          if (prevResults.length > 0) {
            const averageDOS = calculateAverageDOS(prevResults);
            console.log(
              `✅ Calculated average DOS from ${prevResults.length} successful drawings:`,
              averageDOS
            );

            const finalResults = {
              individual_results: prevResults,
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
          } else {
            console.log("❌ No successful analyses to average");
            alert("All analyses failed. Please try again.");
          }
          setIsAnalysisComplete(true);
          return prevResults;
        });
      } else {
        console.log("Analysis failed, but continuing w/ remaining drawings");
      }
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
  };

  // Clears all drawings after results
  const clearAllDrawings = () => {
    const confirmed = window.confirm(
      "Are you sure you want to clear all your drawings?"
    );
    if (confirmed) {
      console.log("Clearing all data for new start...");
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
  const sendDataToBackend = () => {
    console.log(`Analyzing ${savedDrawings.length} drawings...`);
    router.push("/result");
  };

  return (
    <>
      <Header showVideo={true} />
      <div className={styles.machineContainer}>
        <h1 className={styles.title}>Draw Here</h1>

        {isProcessingFinal ? (
          <div className={styles.loadingContainer}>
            {!isAnalysisComplete? (
            <h2> Preparing Your Final Results... </h2>
          ) : (
            <>
              <h2> Analysis Complete!</h2>
              <button
                className={styles.button}
                onClick={sendDataToBackend}
              >
                View Your Results
              </button>
            </>
          )}
          </div>
        ) : (
          <>
            <Canvas ref={canvasRef} setDrawData={setCurrentDrawing} />
            <button onClick={clearAllDrawings} className={styles.clearButton}>
              Clear All Drawings
            </button>
          </>
        )}

        {!isProcessingFinal && (
          <Button
            sendData={sendDataToBackend}
            clearDrawing={clearCurrentDrawing}
            savedDrawingsCount={savedDrawings.length}
            savedResultsCount={savedResults.length}
            isProcessingFinal={isProcessingFinal}
            onSaveAndAnalyze={saveAndAnalyzeCurrentDrawing}
            isAnalyzing={isAnalyzing}
          />
        )}
      </div>
    </>
  );
}

