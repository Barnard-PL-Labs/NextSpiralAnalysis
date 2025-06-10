"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/authProvider";
import { supabase } from "@/lib/supabaseClient";
import Header from "../../components/Header";
import styles from "../../styles/Result.module.css";
import LineGraph from "../../components/LineGraph";
import { SpeedTimeChart, calculateSpeed } from "../../components/ST";
import SpiralPlot from "../../components/NewTimeTrace";
import { CanIAvoidBugByThis, PTChart } from "../../components/PressureTime";
import TremorPolarPlot from "../../components/Tremor";
import { Line3DPlot, processData } from "../../components/Angle";

export default function ResultPage() {
  const [drawData, setDrawData] = useState([]);
  const [result, setResult] = useState(null);
  const [speedData, setSpeedData] = useState([]);
  const [angleData, setAngleData] = useState([]);
  const [pData, setPData] = useState([]);
  const [loadingResult, setLoadingResult] = useState(true);
  const [error, setError] = useState(null);
  const [analysisHistory, setAnalysisHistory] = useState(null);
  const [selectedDrawingIndex, setSelectedDrawingIndex] = useState(null);
  const [allDrawingData, setAllDrawingData] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (user === undefined) {
      console.log("Waiting for user to be initialized...");
      return;
    }

    const loadAnalysisResults = async () => {
      setLoadingResult(true);

      try {
        // FIRST: Check for completed 5-drawing analysis
        const storedAnalysis = localStorage.getItem("analysisHistory");
        if (storedAnalysis) {
          console.log("Loading completed 5-drawing analysis...");
          const analysisData = JSON.parse(storedAnalysis);
          setAnalysisHistory(analysisData);

          // Use the average DOS and the latest individual result for display
          if (analysisData.average_DOS) {
            console.log("Found average DOS:", analysisData.average_DOS);

            // Get the most recent individual result for tremor analysis
            const latestResult =
              analysisData.individual_results?.[
                analysisData.individual_results.length - 1
              ];

            setResult({
              ...latestResult,
              average_DOS: analysisData.average_DOS,
              analysis_type: "5_drawing_average",
            });
          }

          // Get the most recent drawing data for charts
          const storedDrawings = localStorage.getItem("drawData");
          if (storedDrawings) {
            const drawings = JSON.parse(storedDrawings);

            // load all drawing data but use the most recent one by default
            setAllDrawingData(drawings);
            const latestDrawing = Array.isArray(drawings[0])
              ? drawings[drawings.length - 1]
              : drawings;
            setDrawData(latestDrawing);
            setSpeedData(calculateSpeed(latestDrawing));
            setAngleData(processData(latestDrawing));
            setPData(CanIAvoidBugByThis(latestDrawing));
          }

          setLoadingResult(false);
          return;
        }

        // Single drawing analysis
        console.log(
          "No 5-drawing analysis found, checking for single drawing..."
        );
        const storedDrawData = localStorage.getItem("drawData");
        if (!storedDrawData) {
          setError(
            "No analysis results found. Please complete the spiral analysis first."
          );
          setLoadingResult(false);
          return;
        }

        const parsedDrawData = JSON.parse(storedDrawData);
        // Handle both single drawing and array of drawings
        const singleDrawing = Array.isArray(parsedDrawData[0])
          ? parsedDrawData[0]
          : parsedDrawData;
        setDrawData(singleDrawing);
        setSpeedData(calculateSpeed(singleDrawing));
        setAngleData(processData(singleDrawing));
        setPData(CanIAvoidBugByThis(singleDrawing));

        const storedResult = localStorage.getItem("resultFromApi");
        if (storedResult) {
          console.log("Using stored single-drawing result");
          setResult(JSON.parse(storedResult));
          setLoadingResult(false);
          return;
        }

        // Last resort: Make API call for single drawing
        console.log("Making API call for single drawing analysis...");
        await performSingleDrawingAnalysis(singleDrawing);
      } catch (err) {
        console.error("Error loading analysis results:", err);
        setError("Failed to load analysis results. Please try again.");
        setLoadingResult(false);
      }
    };

    loadAnalysisResults();
  }, [user]);

  // handles showcasing of each individual result
  const drawingClick = (index) => {
    if (!allDrawingData || !analysisHistory?.individual_results) return;
    setSelectedDrawingIndex(index);
    const selectedResult = analysisHistory.individual_results[index];

    if (allDrawingData[index] && !selectedResult.error) {
      const selectedDrawing = allDrawingData[index];
      setDrawData(selectedDrawing);
      setSpeedData(calculateSpeed(selectedDrawing));
      setAngleData(processData(selectedDrawing));
      setPData(CanIAvoidBugByThis(selectedDrawing));
    }
    setResult({
      ...selectedResult,
      average_DOS: analysisHistory.average_DOS,
      analysis_type: "5_drawing_average",
      selected_drawing: index + 1,
    });
  };

  const performSingleDrawingAnalysis = async (drawingData) => {
    try {
      const email = user?.email || "anonymous";
      const username = email.split("@")[0];

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drawData: drawingData,
          user: { email, username },
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      setResult(data.result);
      localStorage.setItem("resultFromApi", JSON.stringify(data.result));

      if (user?.id) {
        await saveToDatabase(user.id, drawingData, data.result);
      }
    } catch (err) {
      console.error("Single drawing analysis failed:", err);
      setError("Failed to analyze drawing. Please try again.");
    } finally {
      setLoadingResult(false);
    }
  };

  const saveToDatabase = async (userId, drawData, apiResult) => {
    try {
      const { data: drawing, error: drawError } = await supabase
        .from("drawings")
        .insert([{ user_id: userId, drawing_data: drawData }])
        .select("id")
        .single();

      if (drawError) throw drawError;

      await supabase
        .from("api_results")
        .insert([
          { user_id: userId, drawing_id: drawing.id, result_data: apiResult },
        ]);

      console.log("Data saved successfully in Supabase!");
    } catch (error) {
      console.error("Error saving data to Supabase:", error);
    }
  };

  const getDOSScore = () => {
    if (!result) return "N/A";

    // Prioritize average DOS for 5-drawing analysis
    if (result.average_DOS) {
      return result.average_DOS;
    }

    // Fallback to individual DOS score
    if (result.DOS !== null && result.DOS !== undefined) {
      return result.DOS;
    }

    return "N/A";
  };

  const getAnalysisType = () => {
    if (analysisHistory && analysisHistory.individual_results) {
      return `5-Drawing Analysis (${analysisHistory.individual_results.length}/5 completed)`;
    }
    return "Single Drawing Analysis";
  };

  return (
    <div className={styles.pageWrapper}>
      <Header showVideo={false} />
      <div
        style={{ backgroundColor: "black", color: "white", paddingTop: "80px" }}
      >
        <div className={styles.title}>
          <h2>Analysis Result</h2>
          {loadingResult ? (
            <p>Analyzing...</p>
          ) : (
            <p>DOS Score: {getDOSScore() ?? "N/A"}</p>
          )}
          {error && <p style={{ color: "red" }}>{error}</p>}
        </div>

        {analysisHistory && analysisHistory.individual_results && (
          <div className={styles.title}>
            <h3>Individual Drawing Scores:</h3>
            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              {analysisHistory.individual_results.map(
                (individualResult, index) => (
                  <span
                    key={index}
                    onClick={() => drawingClick(index)}
                    style={{
                      padding: "5px 10px",
                      background:
                        selectedDrawingIndex === index
                          ? "rgba(255,255,255,0.3"
                          : individualResult.error
                          ? "rgba(255,100,100,0.2)"
                          : "rgba(255,255,255,0.1)",
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
                        e.target.style.background = individualResult.error
                          ? "rgba(255,100,100,0.3)"
                          : "rgba(255,255,255,0.2)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedDrawingIndex !== index) {
                        e.target.style.background = individualResult.error
                          ? "rgba(255,100,100,0.2)"
                          : "rgba(255,255,255,0.1)";
                      }
                    }}
                    title={
                      individualResult.error
                        ? "Error: ${individualResult.errorMessage}"
                        : ""
                    }
                  >
                    #{index + 1}: {individualResult.DOS ?? "N/A"}
                  </span>
                )
              )}
            </div>
            {selectedDrawingIndex !== null && (
              <p style={{ marginTop: "10px", fontSize: "14px", opacity: 0.8 }}>
                Viewing: Drawing #{selectedDrawingIndex + 1}
                {analysisHistory.individual_results[selectedDrawingIndex]
                  ?.error && (
                  <span style={{ color: "#ff6b6b", marginLeft: "10px" }}>
                    (Analysis Error)
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        <div className={styles.chartGrid}>
          <div className={styles.graphCard}>
            <h3>Spiral XY Plot</h3>
            <div className={styles.chartContainer}>
              <LineGraph data={drawData} />
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
    </div>
  );
}
