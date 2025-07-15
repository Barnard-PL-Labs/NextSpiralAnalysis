"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/authProvider";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/Header";
import styles from "@/styles/Result.module.css";
import LineGraph from "@/components/LineGraph";
import { SpeedTimeChart, calculateSpeed } from "@/components/ST";
import SpiralPlot from "@/components/NewTimeTrace";
import { CanIAvoidBugByThis, PTChart } from "@/components/PressureTime";
import TremorPolarPlot from "@/components/Tremor";
import { Line3DPlot, processData } from "@/components/Angle";
import { FaDownload, FaComment } from "react-icons/fa";
import { useRouter, useSearchParams, useParams } from "next/navigation";

function AnimatedEllipsis() {
  const [dots, setDots] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setDots((d) => (d + 1) % 4), 500);
    return () => clearInterval(interval);
  }, []);
  return <span>{".".repeat(dots)}</span>;
}

export default function UnifiedResultPage() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params?.id || searchParams.get("session");

  const [drawings, setDrawings] = useState([]);
  const [results, setResults] = useState([]);
  const [selectedDrawingIndex, setSelectedDrawingIndex] = useState(0);
  const [loadingResult, setLoadingResult] = useState(true);
  const [error, setError] = useState(null);
  const [drawData, setDrawData] = useState([]);
  const [result, setResult] = useState(null);
  const [speedData, setSpeedData] = useState([]);
  const [angleData, setAngleData] = useState([]);
  const [pData, setPData] = useState([]);
  const [analysisHistory, setAnalysisHistory] = useState(null);

  const [liveAnalysisState, setLiveAnalysisState] = useState({
    sessionActive: false,
    isSessionComplete: false,
    totalDrawings: 0,
    completed: 0,
  });

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRatings, setFeedbackRatings] = useState({
    usability: 0,
    analysisAccuracy: 0,
    performanceSpeed: 0,
    visualDesign: 0
  });
  const [feedbackSuggestion, setFeedbackSuggestion] = useState("");
  const [hoveredStar, setHoveredStar] = useState({ category: null, starIndex: null });

  const updateCharts = (index, drawingsArray, resultsArray) => {
    const drawingData = drawingsArray[index]?.drawing_data;
    if (!drawingData) return;

    setDrawData(drawingData);
    setSpeedData(calculateSpeed(drawingData));
    setAngleData(processData(drawingData));
    setPData(CanIAvoidBugByThis(drawingData));

    const currentDrawing = drawingsArray[index];
    if (currentDrawing) {
      const drawingResult = resultsArray.find((r) => r.drawing_id === currentDrawing.id);
      setResult(drawingResult?.status === "completed" ? drawingResult.result_data : null);
    }
  };

  const handleRealTimeUpdate = (payload) => {
    const newRecord = payload.new;
    setResults((prevResults) => {
      const existingIndex = prevResults.findIndex((r) => r.id === newRecord.id);
      return existingIndex !== -1
        ? prevResults.map((r, i) => (i === existingIndex ? newRecord : r))
        : [...prevResults, newRecord];
    });
  };

  useEffect(() => {
    if (!sessionId) {
      router.push("/machine");
      return;
    }

    const loadInitialData = async () => {
      try {
        setLoadingResult(true);
        setLiveAnalysisState(s => ({ ...s, sessionActive: true }));

        const { data: drawingsData, error: drawingsError } = await supabase
          .from("drawings")
          .select("*")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true });

        if (drawingsError) throw drawingsError;

        const finalDrawings = drawingsData || [];
        setDrawings(finalDrawings);
        setLiveAnalysisState(s => ({ ...s, totalDrawings: finalDrawings.length }));

        if (finalDrawings.length > 0) {
          const drawingIds = finalDrawings.map(d => d.id);
          const { data: resultsData, error: resultsError } = await supabase
            .from("api_results")
            .select("*")
            .in("drawing_id", drawingIds);

          if (resultsError) throw resultsError;
          setResults(resultsData || []);
        }
      } catch (err) {
        console.error("Error loading result page:", err);
        setError("Failed to load analysis results.");
      } finally {
        setLoadingResult(false);
      }
    };

    loadInitialData();

    const subscription = supabase
      .channel(`results-for-session-${sessionId}`)
      .on(
        "postgres_changes",
        { event: '*', schema: 'public', table: 'api_results', filter: `session_id=eq.${sessionId}` },
        handleRealTimeUpdate
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [sessionId, router]);

  useEffect(() => {
    if (drawings.length === 0 && !loadingResult) return;

    const individualResults = drawings.map((drawing) => {
      const result = results.find((r) => r.drawing_id === drawing.id);
      if (!result) return { status: 'pending' };
      if (result.status === "failed") return { error: true, message: result.result_data?.error };
      if (result.status === "timeout") return { status: 'timeout', message: result.result_data?.message };
      if (result.status === "completed") return result.result_data;
      return { status: 'processing' };
    });

    const completed = individualResults.filter(r => r && !r.status && !r.error);
    const dosScores = completed.map(r => parseFloat(r.DOS)).filter(score => !isNaN(score));
    const averageDOS = dosScores.length > 0 ? (dosScores.reduce((a, b) => a + b, 0) / dosScores.length).toFixed(2) : null;

    const newAnalysisHistory = {
      individual_results: individualResults,
      total_drawings: drawings.length,
      successful_drawings: completed.length,
      average_DOS: averageDOS,
    };
    setAnalysisHistory(newAnalysisHistory);

    setLiveAnalysisState(s => ({
      ...s,
      completed: completed.length,
      isSessionComplete: drawings.length > 0 && completed.length === drawings.length,
    }));

    updateCharts(selectedDrawingIndex, drawings, results);

  }, [drawings, results, selectedDrawingIndex, loadingResult]);

  const drawingClick = (index) => {
    setSelectedDrawingIndex(index);
  };

  const getDOSScore = () => {
    if (loadingResult) return null;
    if (!analysisHistory || !liveAnalysisState.isSessionComplete) return null;
    return analysisHistory.average_DOS || "N/A";
  };

  const getProgressDisplay = () => {
    if (
      liveAnalysisState.sessionActive &&
      !liveAnalysisState.isSessionComplete
    ) {
      const completedCount = Math.min(
        liveAnalysisState.completed,
        liveAnalysisState.totalDrawings
      );
      const currentDrawing = Math.min(
        completedCount + 1,
        liveAnalysisState.totalDrawings
      );

      if(liveAnalysisState.totalDrawings === 0 && !loadingResult) return null;
      if(liveAnalysisState.totalDrawings === 0 && loadingResult) return <p>Loading session<AnimatedEllipsis /></p>

      const progress = `Analyzing: ${currentDrawing}/${liveAnalysisState.totalDrawings}`;
      return (
        <p>
          {progress}
          <AnimatedEllipsis />
        </p>
      );
    }
    return null;
  };

  const getCurrentDOSScore = () => {
    const currentResult = analysisHistory?.individual_results[selectedDrawingIndex];

    if (!currentResult) return <>Pending<AnimatedEllipsis /></>;
    if (currentResult.error) return "DOS Score: Failed";
    if (currentResult.status === 'timeout') return "DOS Score: Timeout";
    if (currentResult.status === 'processing' || currentResult.status === 'pending') return <>Pending<AnimatedEllipsis /></>;

    const dos = parseFloat(currentResult.DOS);
    return isNaN(dos) ? "DOS Score: N/A" : `DOS Score: ${dos.toFixed(4)}`;
  };

  const areAllAnalysesCompleted = () => {
    if (!analysisHistory || !analysisHistory.individual_results) return false;
    
    // Check if there's at least one valid completed analysis
    const hasValidResult = analysisHistory.individual_results.some(result => {
      return result && !result.error && !result.status && result.DOS !== undefined;
    });
    
    if (!hasValidResult) return false;
    
    // Check if all analyses are done (completed, failed, or timed out - not pending or processing)
    return analysisHistory.individual_results.every(result => {
      // Analysis is done if it's completed (no error/status), failed (has error), or timed out (has status 'timeout')
      return result && (
        (!result.error && !result.status && result.DOS !== undefined) || // completed
        result.error || // failed
        result.status === 'timeout' // timed out
      );
    });
  };

  const handleFeedbackSubmit = async () => {
    try {
      // All fields are optional - user can submit feedback with or without ratings/suggestions
      const hasRatings = Object.values(feedbackRatings).some(rating => rating > 0);
      const hasSuggestion = feedbackSuggestion.trim().length > 0;
      
      // Allow submission even if no ratings or suggestions provided
      // This makes feedback completely optional

      // Prepare feedback data
      const feedbackData = {
        session_id: sessionId,
        created_at: new Date().toISOString(),
        usability_rating: feedbackRatings.usability || 0,
        analysis_accuracy_rating: feedbackRatings.analysisAccuracy || 0,
        performance_speed_rating: feedbackRatings.performanceSpeed || 0,
        visual_design_rating: feedbackRatings.visualDesign || 0,
        suggestion_text: feedbackSuggestion.trim() || null,
        user_id: user?.id || null,
      };

      // Insert feedback into database
      const { error } = await supabase
        .from("feedback")
        .insert([feedbackData]);

      if (error) {
        console.error("Error saving feedback:", error);
        alert("Failed to save feedback. Please try again.");
        return;
      }

      console.log("Feedback saved successfully:", feedbackData);
      
      // Reset form and close modal
      setShowFeedbackModal(false);
      setFeedbackRatings({
        usability: 0,
        analysisAccuracy: 0,
        performanceSpeed: 0,
        visualDesign: 0
      });
      setFeedbackSuggestion("");
      
    } catch (error) {
      console.error("Error submitting feedback:", error);
      alert("Failed to submit feedback. Please try again.");
    }
  };

  const handleStarClick = (category, starIndex) => {
    setFeedbackRatings(prev => ({
      ...prev,
      [category]: starIndex
    }));
  };

  const downloadResults = () => {
    if (!analysisHistory) {
      alert("No results are available to download yet.");
      return;
    }

    const downloadData = {
      session_id: sessionId,
      generated_at: new Date().toISOString(),
      analysis_summary: {
        total_drawings: analysisHistory.total_drawings,
        successful_drawings: analysisHistory.successful_drawings,
        average_DOS: analysisHistory.average_DOS,
      },
      hand_selection: drawings.length > 0 ? drawings[0].hand_used : null,
      hand_side: drawings.length > 0 ? drawings[0].hand_side : null,
      demographics: drawings.length > 0 ? {
        user_name: drawings[0].user_name,
        user_age: drawings[0].user_age,
        user_sex: drawings[0].user_sex
      } : null,
      individual_results: analysisHistory.individual_results,
      raw_drawing_data: drawings.map(d => ({
        drawing_id: d.id,
        created_at: d.created_at,
        hand_used: d.hand_used,
        hand_side: d.hand_side,
        user_name: d.user_name,
        user_age: d.user_age,
        user_sex: d.user_sex,
        data: d.drawing_data,
      })),
    };

    const dataStr = JSON.stringify(downloadData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `spiral_analysis_${sessionId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const drawingSelectorItems = analysisHistory?.individual_results || 
    (liveAnalysisState.sessionActive ? Array.from({ length: liveAnalysisState.totalDrawings }) : []);

  return (
    <div className={styles.pageWrapper}>
      <Header showVideo={false} />
      <div className={styles.container}>
        <div className={styles.title}>
          <h2>Analysis Results</h2>
          {getProgressDisplay()} 
          {getDOSScore() && <p>Average DOS Score: {getDOSScore()}</p>}
          {error && <p style={{ color: "red" }}>{String(error)}</p>}
        </div>

        {(analysisHistory || liveAnalysisState.sessionActive) && drawings.length > 0 && (
          <div className={styles.title}>
            <h3>Individual Drawings:</h3>
            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              {drawingSelectorItems.map((resultStatus, index) => {
                let displayContent = `#${index + 1}`;
                let backgroundColor = "rgba(255, 165, 0, 0.3)";

                if (resultStatus?.error) {
                  displayContent = `#${index + 1}: Failed`;
                  backgroundColor = "rgba(255,100,100,0.2)";
                } else if (resultStatus?.status === 'timeout') {
                  displayContent = `#${index + 1}: Timeout`;
                  backgroundColor = "rgba(255,100,100,0.2)";
                } else if (resultStatus && !resultStatus.status) {
                  backgroundColor = "rgba(255,255,255,0.1)";
                }

                return (
                  <span
                    key={index}
                    onClick={() => drawingClick(index)}
                    style={{
                      padding: "5px 10px",
                      background:
                        selectedDrawingIndex === index
                          ? "rgba(255,255,255,0.3)"
                          : backgroundColor,
                      borderRadius: "4px",
                      fontSize: "14px",
                      cursor: "pointer",
                      border:
                        selectedDrawingIndex === index
                          ? "2px solid white"
                          : "2px solid transparent",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedDrawingIndex !== index) {
                        e.target.style.background = "rgba(255,255,255,0.2)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedDrawingIndex !== index) {
                        e.target.style.background = backgroundColor;
                      }
                    }}
                  >
                    {displayContent}
                  </span>
                );
              })}
            </div>
            {areAllAnalysesCompleted() && (
              <div style={{ textAlign: "center", marginTop: "20px" }}>
                <button
                  onClick={downloadResults}
                  style={{
                    backgroundColor: "#4a90e2",
                    color: "white",
                    border: "none",
                    padding: "10px 20px",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "background-color 0.2s ease",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    margin: "0 auto",
                  }}
                  onMouseEnter={(e) => { e.target.style.backgroundColor = "#357abd"; }}
                  onMouseLeave={(e) => { e.target.style.backgroundColor = "#4a90e2"; }}
                >
                  <FaDownload size={16} />
                  Download Results
                </button>
                <div style={{ marginTop: "10px" }}>
                  <button
                    onClick={() => setShowFeedbackModal(true)}
                    style={{
                      backgroundColor: "#a8c8e8",
                      color: "navy",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      marginTop: "10px",
                      marginBottom: "-25px",
                      fontWeight: "500",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = "#8bb8d8";
                      e.target.style.transform = "translateY(-1px)";
                    }}
                    onMouseOut={(e) => {
                      e.target.style.backgroundColor = "#a8c8e8";
                      e.target.style.transform = "translateY(0)";
                    }}
                  >
                    <FaComment size={12} style={{ marginRight: "6px", verticalAlign: "middle", display: "inline-block" }} />
                    Feedback
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className={styles.chartGrid}>
          <div className={styles.graphCard}>
            <h3>Spiral XY Plot</h3>
            <div className={styles.chartContainer}>
              <LineGraph data={drawData} />
            </div>
            <div style={{ marginTop: "10px", textAlign: "center", color: "black" }}>
              {getCurrentDOSScore()}
            </div>
          </div>
          <div className={styles.graphCard}>
            <h3>Speed vs. Time</h3>
            <div className={styles.chartContainer}>
              <SpeedTimeChart speedData={speedData} />
            </div>
          </div>
          <div className={styles.graphCard}>
            <h3>3D Spiral View</h3>
            <div className={styles.chartContainer}>
              <SpiralPlot data={drawData} />
            </div>
          </div>
          <div className={styles.graphCard}>
            <h3>Pressure vs Time</h3>
            <div className={styles.chartContainer}>
              <PTChart data={drawData} />
            </div>
          </div>
          <div className={styles.graphCard}>
            <h3>Tremor Polar Plot</h3>
            <div className={styles.chartContainer}>
              {loadingResult ? (
                <p>Loading tremor data...</p>
              ) : (
                <TremorPolarPlot result={result} />
              )}
            </div>
          </div>
          <div className={styles.graphCard}>
            <h3>Speed vs Angle</h3>
            <div className={styles.chartContainer}>
              <Line3DPlot data={angleData} />
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            borderRadius: "12px",
            padding: "24px",
            maxWidth: "650px",
            width: "90%",
            maxHeight: "70vh",
            overflow: "hidden",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
              position: "relative",
            }}>
              <h3 style={{ margin: 0, color: "navy", fontSize: "30px", fontWeight: "600",marginTop: "12px", marginBottom: "10px" }}>Rate Your Experience!</h3>
              <button
                onClick={() => {
                  console.log("X button clicked");
                  setShowFeedbackModal(false);
                }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "25px",
                  cursor: "pointer",
                  color: "#444",
                  padding: "0",
                  width: "30px",
                  height: "30px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 10,
                  position: "absolute",
                  top: "-5px",
                  right: "0px",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              {/* Left side - Star ratings */}
              <div style={{ flex: "1.1" }}>
                {[
                  { key: "usability", label: "Usability" },
                  { key: "analysisAccuracy", label: "Percieved Analysis Accuracy" },
                  { key: "performanceSpeed", label: "Performance & Speed" },
                  { key: "visualDesign", label: "Visual Design" }
                ].map(({ key, label }) => (
                  <div key={key} style={{ marginBottom: "16px" }}>
                    <div style={{ marginBottom: "12px", fontWeight: "500", color: "navy", textDecoration: "underline", paddingBottom: "4px" }}>
                      {label}
                    </div>
                    <div style={{ display: "flex", gap: "4px" }}>
                      {[1, 2, 3, 4, 5].map((starIndex) => {
                        const currentRating = feedbackRatings[key];
                        const isSelected = currentRating >= starIndex;
                        const isHovered = hoveredStar.category === key && hoveredStar.starIndex >= starIndex;
                        
                        return (
                          <div 
                            key={starIndex} 
                            style={{ position: "relative", display: "inline-block" }}
                            onMouseEnter={() => setHoveredStar({ category: key, starIndex })}
                            onMouseLeave={() => setHoveredStar({ category: null, starIndex: null })}
                          >
                            <button
                              onClick={() => handleStarClick(key, starIndex)}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: "2px",
                                fontSize: "18px",
                                color: "#666",
                                transition: "color 0.2s ease",
                                position: "relative",
                                zIndex: 1,
                              }}
                            >
                              ★
                            </button>
                            {(isSelected || isHovered) && (
                              <div style={{
                                position: "absolute",
                                top: "2px",
                                left: "2px",
                                fontSize: "18px",
                                color: "#FFD700",
                                zIndex: 2,
                                pointerEvents: "none",
                              }}>
                                ★
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Right side - Suggestions */}
              <div style={{ flex: "1.2" }}>
                                 <div style={{ marginBottom: "8px", textDecoration: "underline", fontWeight: "500", fontSize: "24px", color: "navy", marginTop: "-75px", marginBottom: "40px", textAlign: "center" }}>
                    Suggestions
                  </div>
                <textarea
                  value={feedbackSuggestion}
                  onChange={(e) => setFeedbackSuggestion(e.target.value)}
                  placeholder="Share your suggestions for improvement!"
                                      style={{
                      width: "105%",
                      maxWidth: "105%",
                      minHeight: "300px",
                      padding: "12px",
                      border: "3px solid navy",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontFamily: "inherit",
                      resize: "vertical",
                      marginTop: "-10px",
                      marginLeft: "-10px",
                      backgroundColor: "white",
                      color: "black",
                    }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-25px" }}>
              <button
                onClick={handleFeedbackSubmit}
                style={{
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "6px",
                  background: "navy",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                Submit Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
