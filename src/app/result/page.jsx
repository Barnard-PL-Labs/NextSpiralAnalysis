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
import { FaDownload } from "react-icons/fa";
import { useRouter } from "next/navigation";
import React, { useRef } from "react";

// Animated Ellipsis component
function AnimatedEllipsis() {
  const [dots, setDots] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setDots((d) => (d + 1) % 4), 500);
    return () => clearInterval(interval);
  }, []);
  return <span>{".".repeat(dots)}</span>;
}

export default function ResultPage() {
  const router = useRouter();
  const [channel] = useState(() => new BroadcastChannel("spiral-analysis"));

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
  const [resultsStable, setResultsStable] = useState(false);
  const { user } = useAuth();

  const [liveAnalysisState, setLiveAnalysisState] = useState({
    sessionActive: false,
    totalDrawings: 0,
    results: [],
    timings: [],
    completed: 0,
    isSessionComplete: false,
  });

  // Check for completed results first, then active session
  const checkForCompletedResults = () => {
    console.log("🔍 [RESULTS] Checking for completed results first");

    const storedAnalysis = localStorage.getItem("analysisHistory");
    if (storedAnalysis) {
      try {
        const analysisData = JSON.parse(storedAnalysis);
        console.log("🔍 [RESULTS] Found completed analysis:", {
          totalDrawings: analysisData.total_drawings,
          successfulDrawings: analysisData.successful_drawings,
          individualResultsCount: analysisData.individual_results?.length,
        });

        // Set up UI immediately for completed results
        setAnalysisHistory(analysisData);

        // Find first valid result (no error)
        const firstValidIndex = analysisData.individual_results.findIndex(
          (result) => result && !result.error
        );
        const validIndex = firstValidIndex >= 0 ? firstValidIndex : 0;

        console.log("🔍 [RESULTS] Selected valid index:", validIndex);

        // Use the first valid result or latest if none are valid
        const selectedResult = analysisData.individual_results[validIndex];
        console.log("🔍 [RESULTS] Selected result:", selectedResult);

        setSelectedDrawingIndex(validIndex);

        const resultWithMetadata = {
          ...selectedResult,
          average_DOS: analysisData.average_DOS,
          analysis_type: "multi_drawing_average",
          selected_drawing: validIndex + 1,
          total_drawings:
            analysisData.total_drawings ||
            analysisData.individual_results.length,
          successful_drawings: analysisData.successful_drawings,
        };

        setResult(resultWithMetadata);

        // Get the drawing data for charts
        const storedDrawings = localStorage.getItem("drawData");

        if (storedDrawings) {
          const drawings = JSON.parse(storedDrawings);
          console.log(
            "🔍 [RESULTS] Setting all drawing data:",
            drawings.length
          );
          setAllDrawingData(drawings);

          // Use the first valid drawing's data
          const selectedDrawing = drawings[validIndex];

          setDrawData(selectedDrawing);
          setSpeedData(calculateSpeed(selectedDrawing));
          setAngleData(processData(selectedDrawing));
          setPData(CanIAvoidBugByThis(selectedDrawing));
        }

        console.log(
          "🔍 [RESULTS] Setting loadingResult to false and results stable"
        );
        setLoadingResult(false);
        setResultsStable(true);
        return true;
      } catch (err) {
        console.error("🔍 [RESULTS] Error parsing completed analysis:", err);
        localStorage.removeItem("analysisHistory");
      }
    }

    console.log("🔍 [RESULTS] No completed results found");
    return false;
  };

  // Check for active analysis session on page load
  const checkForActiveSession = () => {
    const activeSession = localStorage.getItem("activeAnalysisSession");
    if (activeSession) {
      try {
        const sessionData = JSON.parse(activeSession);

        // Set up UI immediately for active session
        setLiveAnalysisState({
          sessionActive: true,
          totalDrawings: sessionData.totalDrawings,
          results: new Array(sessionData.totalDrawings).fill(null),
          timings: [],
          completed: 0,
          isSessionComplete: false,
        });
        setResultsStable(false); // Reset stability flag for active session

        // Initialize analysis history with placeholder data
        setAnalysisHistory({
          individual_results: new Array(sessionData.totalDrawings).fill(null),
          total_drawings: sessionData.totalDrawings,
          successful_drawings: 0,
          average_DOS: null,
        });

        // Load drawing data immediately if available
        const storedDrawings = localStorage.getItem("drawData");
        if (storedDrawings) {
          try {
            const drawings = JSON.parse(storedDrawings);
            setAllDrawingData(drawings);

            // Set up charts with the first drawing's data
            if (drawings[0]) {
              setDrawData(drawings[0]);
              setSpeedData(calculateSpeed(drawings[0]));
              setAngleData(processData(drawings[0]));
              setPData(CanIAvoidBugByThis(drawings[0]));
              setSelectedDrawingIndex(0);
            }
          } catch (err) {
            console.error("🔍 [SESSION] Error loading drawing data:", err);
          }
        }

        setLoadingResult(false);
        return true;
      } catch (err) {
        console.error("🔍 [SESSION] Error parsing active session:", err);
        localStorage.removeItem("activeAnalysisSession");
      }
    }

    console.log("🔍 [SESSION] No active session found");
    return false;
  };

  // Listen for live analysis updates
  useEffect(() => {
    const handleBroadcast = (event) => {
      const { type, data } = event.data;

      switch (type) {
        case "ANALYSIS_SESSION_STARTED":
          console.log("🚀 [BROADCAST] Analysis session started");

          const newLiveState = {
            sessionActive: true,
            totalDrawings: data.totalDrawings,
            results: new Array(data.totalDrawings).fill(null),
            timings: [],
            completed: 0,
            isSessionComplete: false,
          };

          setLiveAnalysisState(newLiveState);
          setResultsStable(false);

          // Initialize analysis history immediately with placeholder data
          const newAnalysisHistory = {
            individual_results: new Array(data.totalDrawings).fill(null),
            total_drawings: data.totalDrawings,
            successful_drawings: 0,
            average_DOS: null,
          };

          setAnalysisHistory(newAnalysisHistory);

          // Load drawing data immediately if available
          const storedDrawings = localStorage.getItem("drawData");

          if (storedDrawings) {
            try {
              const drawings = JSON.parse(storedDrawings);

              setAllDrawingData(drawings);

              // Set up charts with the first drawing's data
              if (drawings[0]) {
                setDrawData(drawings[0]);
                setSpeedData(calculateSpeed(drawings[0]));
                setAngleData(processData(drawings[0]));
                setPData(CanIAvoidBugByThis(drawings[0]));
                setSelectedDrawingIndex(0);
              }
            } catch (err) {
              console.error("🚀 [BROADCAST] Error loading drawing data:", err);
            }
          }

          console.log("🚀 [BROADCAST] Setting loadingResult to false");
          setLoadingResult(false);
          break;

        case "DRAWING_ANALYSIS_COMPLETED":
          console.log("✅ [BROADCAST] Drawing analysis completed");

          setLiveAnalysisState((prev) => {
            const newResults = [...prev.results];
            newResults[data.drawingIndex] = data.result;

            const newState = {
              ...prev,
              results: newResults,
              timings: [...prev.timings, data.timing],
              completed: data.progress.completed,
            };

            return newState;
          });

          // Update analysis history in real-time
          setAnalysisHistory((prev) => {
            if (!prev) {
              const newHistory = {
                individual_results: [data.result],
                total_drawings: liveAnalysisState.totalDrawings,
              };

              return newHistory;
            }

            const newResults = [...prev.individual_results];
            newResults[data.drawingIndex] = data.result;

            const updatedHistory = {
              ...prev,
              individual_results: newResults,
            };

            return updatedHistory;
          });
          break;

        case "DRAWING_ANALYSIS_FAILED":
          console.log("❌ [BROADCAST] Drawing analysis failed");

          setLiveAnalysisState((prev) => {
            const newResults = [...prev.results];
            newResults[data.drawingIndex] = data.error;

            const newState = {
              ...prev,
              results: newResults,
              timings: [...prev.timings, data.timing],
              completed: data.progress.completed,
            };

            return newState;
          });

          // Update analysis history with error
          setAnalysisHistory((prev) => {
            if (!prev) return prev;

            const newResults = [...prev.individual_results];
            newResults[data.drawingIndex] = data.error;

            const updatedHistory = {
              ...prev,
              individual_results: newResults,
            };

            return updatedHistory;
          });
          break;

        case "ANALYSIS_SESSION_COMPLETED":
          console.log("🎉 [BROADCAST] Analysis session completed");

          setLiveAnalysisState((prev) => {
            const newState = {
              ...prev,
              isSessionComplete: true,
            };
            console.log(
              "🎉 [BROADCAST] Updated live state to completed:",
              newState
            );
            return newState;
          });

          // Clear active session (liveProgress will be cleaned up by MachinePage after 5 seconds)
          localStorage.removeItem("activeAnalysisSession");

          // Reload the final analysisHistory from localStorage
          console.log("🎉 [BROADCAST] Scheduling analysisHistory reload");
          setResultsStable(true); // Mark results as stable
          setTimeout(() => {
            console.log(
              "🎉 [BROADCAST] Reloading analysisHistory from localStorage"
            );
            const storedAnalysis = localStorage.getItem("analysisHistory");
            if (storedAnalysis) {
              try {
                const analysisData = JSON.parse(storedAnalysis);
                console.log("🎉 [BROADCAST] Reloaded analysisHistory:", {
                  average_DOS: analysisData.average_DOS,
                  total_drawings: analysisData.total_drawings,
                  successful_drawings: analysisData.successful_drawings,
                });
                setAnalysisHistory(analysisData);
              } catch (err) {
                console.error(
                  "🎉 [BROADCAST] Error reloading analysisHistory:",
                  err
                );
              }
            }
          }, 1000);
          break;
      }
    };

    console.log("📡 [BROADCAST] Setting up broadcast listener");
    channel.addEventListener("message", handleBroadcast);

    return () => {
      console.log("📡 [BROADCAST] Cleaning up broadcast listener");
      channel.removeEventListener("message", handleBroadcast);
    };
  }, [channel, liveAnalysisState.totalDrawings]);

  const loadAnalysisResults = async () => {
    console.log("📂 [LOAD] Starting loadAnalysisResults");
    console.log("📂 [LOAD] Current state:", {
      loadingResult,
      analysisHistory: !!analysisHistory,
      liveAnalysisState,
    });

    setLoadingResult(true);

    try {
      // Single drawing analysis fallback (keep your existing logic)
      console.log(
        "📂 [LOAD] No multi-drawing analysis found, checking for single drawing..."
      );
      const storedDrawData = localStorage.getItem("drawData");
      console.log("📂 [LOAD] Stored draw data:", !!storedDrawData);

      if (!storedDrawData) {
        console.log("📂 [LOAD] No draw data found, setting error");
        setError(
          "No analysis results found. Please complete the spiral analysis first."
        );
        setLoadingResult(false);
        return;
      }

      const parsedDrawData = JSON.parse(storedDrawData);
      const singleDrawing = Array.isArray(parsedDrawData[0])
        ? parsedDrawData[0]
        : parsedDrawData;

      console.log(
        "📂 [LOAD] Setting single drawing data:",
        singleDrawing.length
      );
      setDrawData(singleDrawing);
      setSpeedData(calculateSpeed(singleDrawing));
      setAngleData(processData(singleDrawing));
      setPData(CanIAvoidBugByThis(singleDrawing));

      const storedResult = localStorage.getItem("resultFromApi");
      console.log("📂 [LOAD] Stored API result:", !!storedResult);

      if (storedResult) {
        console.log("📂 [LOAD] Using stored single-drawing result");
        setResult(JSON.parse(storedResult));
        setLoadingResult(false);
        setResultsStable(true);
        return;
      }

      // Last resort: Make API call for single drawing
      console.log("📂 [LOAD] Making API call for single drawing analysis...");
      await performSingleDrawingAnalysis(singleDrawing);
    } catch (err) {
      console.error("📂 [LOAD] Error loading analysis results:", err);
      setError("Failed to load analysis results. Please try again.");
      setLoadingResult(false);
    }
  };

  useEffect(() => {
    console.log("🔄 [EFFECT] User/auth effect triggered:", {
      user: !!user,
      liveAnalysisState: liveAnalysisState.sessionActive,
    });

    if (user === undefined) {
      console.log("🔄 [EFFECT] Waiting for user to be initialized...");
      return;
    }

    // First check for completed results, then active session
    const hasCompletedResults = checkForCompletedResults();

    if (!hasCompletedResults) {
      // Only check for active session if no completed results were found
      const hasActiveSession = checkForActiveSession();

      // Only load results if no active session was found
      if (!hasActiveSession && !liveAnalysisState.sessionActive) {
        loadAnalysisResults();
      }
    }
  }, [user, liveAnalysisState.sessionActive]);

  // Cleanup channel on unmount
  useEffect(() => {
    return () => {
      console.log("🧹 [CLEANUP] Closing broadcast channel");
      channel.close();
      // Clean up live progress if component unmounts during active session
      // Only remove if session is not complete to avoid interfering with delayed cleanup
      if (
        liveAnalysisState.sessionActive &&
        !liveAnalysisState.isSessionComplete
      ) {
        localStorage.removeItem("liveProgress");
      }
    };
  }, [channel, liveAnalysisState.sessionActive]);

  // Polling mechanism for live progress updates
  useEffect(() => {
    if (
      !liveAnalysisState.sessionActive ||
      liveAnalysisState.isSessionComplete
    ) {
      return;
    }

    // Add a timeout to prevent infinite polling (5 minutes max)
    const timeout = setTimeout(() => {
      console.log(
        "⏰ [POLLING] Timeout reached (5 minutes), forcing completion"
      );
      setLiveAnalysisState((prev) => ({
        ...prev,
        isSessionComplete: true,
        completed: prev.totalDrawings,
      }));
      setTimeout(() => {
        console.log("🎉 [POLLING] Reloading analysisHistory from timeout");
        const storedAnalysis = localStorage.getItem("analysisHistory");
        if (storedAnalysis) {
          try {
            const analysisData = JSON.parse(storedAnalysis);
            console.log("🎉 [POLLING] Reloaded analysisHistory from timeout:", {
              average_DOS: analysisData.average_DOS,
              total_drawings: analysisData.total_drawings,
              successful_drawings: analysisData.successful_drawings,
            });
            setAnalysisHistory(analysisData);
            setResultsStable(true);
          } catch (err) {
            console.error(
              "🎉 [POLLING] Error reloading analysisHistory from timeout:",
              err
            );
          }
        }
      }, 1000);
    }, 5 * 60 * 1000); // 5 minutes

    const poll = setInterval(() => {
      const progress = localStorage.getItem("liveProgress");
      if (progress) {
        try {
          const data = JSON.parse(progress);
          console.log("📊 [POLLING] Found progress data:", {
            completed: data.completed,
            total: data.total,
            resultsCount: data.results?.length,
            isComplete: data.isComplete,
          });

          // Update live analysis state with new progress
          setLiveAnalysisState((prev) => {
            const newResults = [...prev.results];

            // Update results array with new data
            if (data.results && data.results.length > 0) {
              data.results.forEach((result, index) => {
                if (result && index < newResults.length) {
                  newResults[index] = result;
                }
              });
            }

            const newState = {
              ...prev,
              results: newResults,
              completed: data.completed,
              isSessionComplete: data.isComplete || false,
            };

            console.log("📊 [POLLING] Updated live analysis state:", {
              completed: newState.completed,
              total: newState.totalDrawings,
              resultsCount: newResults.filter((r) => r !== null).length,
              isSessionComplete: newState.isSessionComplete,
            });

            return newState;
          });

          // Update analysis history with new results
          setAnalysisHistory((prev) => {
            if (!prev) return prev;

            const newIndividualResults = [...prev.individual_results];

            if (data.results && data.results.length > 0) {
              data.results.forEach((result, index) => {
                if (result && index < newIndividualResults.length) {
                  newIndividualResults[index] = result;
                }
              });
            }

            const newHistory = {
              ...prev,
              individual_results: newIndividualResults,
            };

            console.log("📊 [POLLING] Updated analysis history:", {
              totalDrawings: newHistory.total_drawings,
              individualResultsCount: newIndividualResults.filter(
                (r) => r !== null
              ).length,
            });

            // If analysis is complete, reload the final analysisHistory from localStorage
            if (data.isComplete) {
              console.log(
                "🎉 [POLLING] Detected final completion via polling, reloading analysisHistory"
              );
              setResultsStable(true); // Mark results as stable
              setTimeout(() => {
                console.log(
                  "🎉 [POLLING] Reloading analysisHistory from localStorage"
                );
                const storedAnalysis = localStorage.getItem("analysisHistory");
                if (storedAnalysis) {
                  try {
                    const analysisData = JSON.parse(storedAnalysis);
                    console.log("🎉 [POLLING] Reloaded analysisHistory:", {
                      average_DOS: analysisData.average_DOS,
                      total_drawings: analysisData.total_drawings,
                      successful_drawings: analysisData.successful_drawings,
                    });
                    setAnalysisHistory(analysisData);
                  } catch (err) {
                    console.error(
                      "🎉 [POLLING] Error reloading analysisHistory:",
                      err
                    );
                  }
                }
              }, 1000);
            } else if (data.completed >= data.total) {
              // Safety check: if completed >= total but isComplete is false, force completion
              console.log(
                "⚠️ [POLLING] Safety check: completed >= total but isComplete is false, forcing completion"
              );
              setLiveAnalysisState((prev) => ({
                ...prev,
                isSessionComplete: true,
                completed: data.total,
              }));
              setResultsStable(true); // Mark results as stable
              setTimeout(() => {
                console.log(
                  "🎉 [POLLING] Reloading analysisHistory from safety check"
                );
                const storedAnalysis = localStorage.getItem("analysisHistory");
                if (storedAnalysis) {
                  try {
                    const analysisData = JSON.parse(storedAnalysis);
                    console.log(
                      "🎉 [POLLING] Reloaded analysisHistory from safety check:",
                      {
                        average_DOS: analysisData.average_DOS,
                        total_drawings: analysisData.total_drawings,
                        successful_drawings: analysisData.successful_drawings,
                      }
                    );
                    setAnalysisHistory(analysisData);
                  } catch (err) {
                    console.error(
                      "🎉 [POLLING] Error reloading analysisHistory from safety check:",
                      err
                    );
                  }
                }
              }, 1000);
            }

            return newHistory;
          });
        } catch (error) {
          console.error("📊 [POLLING] Error parsing progress data:", error);
        }
      } else {
        console.log("📊 [POLLING] No progress data found in localStorage");
      }
    }, 2000);

    return () => {
      console.log("📊 [POLLING] Cleaning up polling interval and timeout");
      clearInterval(poll);
      clearTimeout(timeout);
    };
  }, [liveAnalysisState.sessionActive]);

  // handles showcasing of each individual result
  const drawingClick = (index) => {
    console.log("🖱️ [CLICK] Drawing clicked:", index);
    console.log("🖱️ [CLICK] Current state:", {
      allDrawingData: !!allDrawingData,
      analysisHistory: !!analysisHistory,
      individualResults: analysisHistory?.individual_results?.length,
    });

    if (!allDrawingData) {
      console.log("🖱️ [CLICK] Missing drawing data, returning early");
      return;
    }

    setSelectedDrawingIndex(index);
    const selectedResult = analysisHistory?.individual_results?.[index];
    console.log("🖱️ [CLICK] Selected result:", selectedResult);

    // Always update charts if drawing data exists, even if result is pending
    if (allDrawingData[index]) {
      const selectedDrawing = allDrawingData[index];
      console.log(
        "🖱️ [CLICK] Setting charts with drawing:",
        selectedDrawing.length
      );

      setDrawData(selectedDrawing);
      setSpeedData(calculateSpeed(selectedDrawing));
      setAngleData(processData(selectedDrawing));
      setPData(CanIAvoidBugByThis(selectedDrawing));
    }

    // Only update result metadata if we have a valid result
    if (selectedResult && !selectedResult.error) {
      const resultWithMetadata = {
        ...selectedResult,
        average_DOS: analysisHistory?.average_DOS,
        analysis_type: "multi_drawing_average",
        selected_drawing: index + 1,
        total_drawings:
          analysisHistory?.total_drawings ||
          analysisHistory?.individual_results?.length,
        successful_drawings: analysisHistory?.successful_drawings,
      };

      console.log(
        "🖱️ [CLICK] Setting result with metadata:",
        resultWithMetadata
      );
      setResult(resultWithMetadata);
    } else {
      // Clear result for pending or failed drawings
      setResult(null);
    }
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
    // Show "Pending..." during live analysis
    if (
      liveAnalysisState.sessionActive &&
      !liveAnalysisState.isSessionComplete
    ) {
      return "Pending...";
    }

    // For multi-drawing analysis, use the average DOS from analysisHistory
    if (
      analysisHistory &&
      analysisHistory.average_DOS !== null &&
      analysisHistory.average_DOS !== undefined
    ) {
      return analysisHistory.average_DOS;
    }

    // Fallback to individual result DOS score
    if (result && typeof result === "object") {
      // Prioritize average DOS for multi-drawing analysis
      if (result.average_DOS !== null && result.average_DOS !== undefined) {
        return result.average_DOS;
      }

      // Fallback to individual DOS score
      if (result.DOS !== null && result.DOS !== undefined) {
        return result.DOS;
      }
    }

    return "N/A";
  };

  const getCurrentDOSScore = () => {
    // Show "Pending..." for incomplete analysis
    if (
      liveAnalysisState.sessionActive &&
      !liveAnalysisState.isSessionComplete
    ) {
      const currentResult =
        analysisHistory?.individual_results?.[selectedDrawingIndex];
      if (!currentResult || currentResult === null) {
        return "Pending...";
      }
    }

    if (!currentResult || typeof currentResult !== "object") return "N/A";

    if (currentResult.DOS !== null && currentResult.DOS !== undefined) {
      return currentResult.DOS;
    }

    return "N/A";
  };

  const currentResult =
    analysisHistory?.individual_results?.[selectedDrawingIndex];

  // Debug: Track state changes
  useEffect(() => {
    console.log("🔄 [STATE] liveAnalysisState changed:", liveAnalysisState);
  }, [liveAnalysisState]);

  useEffect(() => {
    console.log("🔄 [STATE] analysisHistory changed:", analysisHistory);
  }, [analysisHistory]);

  useEffect(() => {
    console.log("🔄 [STATE] loadingResult changed:", loadingResult);
  }, [loadingResult]);

  useEffect(() => {
    console.log(
      "🔄 [STATE] selectedDrawingIndex changed:",
      selectedDrawingIndex
    );
  }, [selectedDrawingIndex]);

  useEffect(() => {
    console.log("🔄 [STATE] allDrawingData changed:", {
      length: allDrawingData.length,
      hasData: allDrawingData.length > 0,
    });
  }, [allDrawingData]);

  useEffect(() => {
    console.log("🔄 [STATE] result changed:", result);
  }, [result]);

  const downloadResults = () => {
    console.log("💾 [DOWNLOAD] Download requested");
    console.log("💾 [DOWNLOAD] Current state:", {
      result: !!result,
      analysisHistory: !!analysisHistory,
    });

    if (!result && !analysisHistory) {
      console.log("💾 [DOWNLOAD] No results available");
      alert("No results available to download");
      return;
    }

    const downloadData = {
      timestamp: new Date().toISOString(),
      analysis_type: analysisHistory
        ? "multi_drawing_average"
        : "single_drawing",
      average_DOS: getDOSScore(),
      current_drawing_index: selectedDrawingIndex,
      current_drawing_DOS: getCurrentDOSScore(),
      all_drawings: analysisHistory?.individual_results || [result],
      drawing_data: allDrawingData,
      speed_data: speedData,
      angle_data: angleData,
      pressure_data: pData,
      ...result,
    };

    console.log("💾 [DOWNLOAD] Preparing download data:", downloadData);
    const dataStr = JSON.stringify(downloadData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `spiral_analysis_results_${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log("💾 [DOWNLOAD] Download completed");
  };

  const getProgressDisplay = () => {
    if (
      liveAnalysisState.sessionActive &&
      !liveAnalysisState.isSessionComplete
    ) {
      // Use the completed count from state, but clamp it to prevent "4/3" scenarios
      const completedCount = Math.min(
        liveAnalysisState.completed,
        liveAnalysisState.totalDrawings
      );
      // Show the next drawing being analyzed (completed + 1), but clamp to total
      const currentDrawing = Math.min(
        completedCount + 1,
        liveAnalysisState.totalDrawings
      );
      const progress = `Analyzing: ${currentDrawing}/${liveAnalysisState.totalDrawings}`;
      return (
        <>
          {progress}
          <AnimatedEllipsis />
        </>
      );
    }
    return null;
  };

  // If no analysis and no live session, redirect
  if (
    !liveAnalysisState.sessionActive &&
    !analysisHistory &&
    !result &&
    !loadingResult
  ) {
    console.log("🎨 [RENDER] Redirecting to /machine");
    router.push("/machine");
    return null;
  }

  return (
    <div className={styles.pageWrapper}>
      <Header showVideo={false} />
      <div className={styles.container}>
        <div className={styles.title}>
          <h2>Analysis Results</h2>
          {loadingResult ? (
            <p>
              Analyzing
              <AnimatedEllipsis />
            </p>
          ) : liveAnalysisState.sessionActive &&
            !liveAnalysisState.isSessionComplete ? (
            <p>{getProgressDisplay()}</p>
          ) : (
            // Show average DOS if session is complete or if we have analysis history
            (liveAnalysisState.isSessionComplete || analysisHistory) &&
            !loadingResult && <p>Average DOS Score: {getDOSScore()}</p>
          )}
          {error && <p style={{ color: "red" }}>{String(error)}</p>}
        </div>

        {(analysisHistory || liveAnalysisState.sessionActive) && (
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
              {(
                analysisHistory?.individual_results ||
                Array.from(
                  { length: liveAnalysisState.totalDrawings },
                  (_, i) => null
                )
              ).map((individualResult, index) => {
                let displayContent = `#${index + 1}`;
                let isClickable = individualResult && !individualResult.error;
                let backgroundColor = "rgba(255,255,255,0.1)";

                if (
                  liveAnalysisState.sessionActive &&
                  !liveAnalysisState.isSessionComplete
                ) {
                  if (individualResult === null) {
                    displayContent = `#${index + 1}`;
                    // Make clickable if drawing data exists, even if pending
                    isClickable =
                      allDrawingData[index] && allDrawingData[index].length > 0;
                    backgroundColor = "rgba(255, 165, 0, 0.3)"; // Orange for pending
                  } else if (individualResult && !individualResult.error) {
                    displayContent = `#${index + 1}`;
                    isClickable = true;
                    backgroundColor = "rgba(255,255,255,0.1)";
                  }
                }
                if (individualResult && individualResult.error) {
                  displayContent = `#${index + 1}: N/A`;
                  isClickable = false;
                  backgroundColor = "rgba(255,100,100,0.2)";
                }

                return (
                  <span
                    key={index}
                    onClick={
                      isClickable ? () => drawingClick(index) : undefined
                    }
                    style={{
                      padding: "5px 10px",
                      background:
                        selectedDrawingIndex === index
                          ? "rgba(255,255,255,0.3)"
                          : backgroundColor,
                      borderRadius: "4px",
                      fontSize: "14px",
                      cursor: isClickable ? "pointer" : "not-allowed",
                      border:
                        selectedDrawingIndex === index
                          ? "2px solid white"
                          : "2px solid transparent",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedDrawingIndex !== index && isClickable) {
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
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = "#357abd";
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = "#4a90e2";
                }}
              >
                <FaDownload size={16} />
                Download Results
              </button>
            </div>
          </div>
        )}

        <div className={styles.chartGrid}>
          <div className={styles.graphCard}>
            <h3>Spiral XY Plot</h3>
            <div className={styles.chartContainer}>
              <LineGraph data={drawData} />
            </div>
            <div
              style={{ marginTop: "10px", textAlign: "center", color: "black" }}
            >
              DOS Score: {getCurrentDOSScore()}
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
