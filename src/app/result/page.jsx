"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../../components/Header";

export default function ResultEntryPlaceholder() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          router.push("/machine");
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [router]);

  return (
    <>
      <Header />
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          flexDirection: "column",
          textAlign: "center",
          padding: "2rem",
          color: "white",
        }}
      >
        <h2 style={{ fontSize: "2rem", marginBottom: "1rem" }}>
          What are you looking for here?!
        </h2>
        <p style={{ fontSize: "1rem", marginBottom: "1.5rem" }}>
          Your session-specific results live at <code>/results/[id]</code>.
        </p>
        <p style={{ fontSize: "1rem" }}>
          Going back in <strong>{countdown}</strong>...
        </p>
      </main>
    </>
  );
}

// "use client";
// import { useState, useEffect } from "react";
// import { useAuth } from "@/lib/authProvider";
// import { supabase } from "@/lib/supabaseClient";
// import Header from "../../components/Header";
// import styles from "../../styles/Result.module.css";
// import LineGraph from "../../components/LineGraph";
// import { SpeedTimeChart, calculateSpeed } from "../../components/ST";
// import SpiralPlot from "../../components/NewTimeTrace";
// import { CanIAvoidBugByThis, PTChart } from "../../components/PressureTime";
// import TremorPolarPlot from "../../components/Tremor";
// import { Line3DPlot, processData } from "../../components/Angle";
// import { FaDownload } from "react-icons/fa";
// import { useRouter, useSearchParams } from "next/navigation";
// import React, { useRef } from "react";
// import { CgChevronDoubleLeft } from "react-icons/cg";

// // Animated Ellipsis component
// function AnimatedEllipsis() {
//   const [dots, setDots] = useState(0);
//   useEffect(() => {
//     const interval = setInterval(() => setDots((d) => (d + 1) % 4), 500);
//     return () => clearInterval(interval);
//   }, []);
//   return <span>{".".repeat(dots)}</span>;
// }

// export default function ResultPage({ params }) {
//   const { sessionId } = params;
//   const searchParams = useSearchParams();
//   const session = searchParams.get("session");
//   const isAnonymous = searchParams.get("anon") === "true";
//   const router = useRouter();
//   const { user } = useAuth();

//   const [drawings, setDrawings] = useState([]);
//   const [results, setResults] = useState([]);
//   const [selectedDrawingIndex, setSelectedDrawingIndex] = useState(0);
//   const [loadingResult, setLoadingResult] = useState(true);
//   const [error, setError] = useState(null);

//   const [drawData, setDrawData] = useState([]);
//   const [result, setResult] = useState(null);
//   const [speedData, setSpeedData] = useState([]);
//   const [angleData, setAngleData] = useState([]);
//   const [pData, setPData] = useState([]);
//   const [analysisHistory, setAnalysisHistory] = useState(null);
//   const [allDrawingData, setAllDrawingData] = useState([]);

//   const loadInitialData = async () => {
//     try {
//       console.log("Loading initial data for session:", sessionId);

//       // Load drawings first
//       const { data: drawingsData, error: drawingsError } = await supabase
//         .from("drawings")
//         .select("*")
//         .eq("session_id", sessionId)
//         .order("created_at", { ascending: true });

//       if (drawingsError) {
//         console.error("Error loading drawings:", drawingsError);
//         throw drawingsError;
//       }

//       console.log(`Loaded ${drawingsData?.length || 0} drawings`);

//       // Load existing results by session id
//       const { data: resultsData, error: resultsError } = await supabase
//         .from("api_results")
//         .select("*")
//         .eq("session_id", sessionId)
//         .order("created_at", { ascending: true });

//       if (resultsError) {
//         console.error("Error loading results:", resultsError);
//       }
//       console.log(`Loaded ${resultsData?.length || 0} results`);

//       // Set state after both are loaded
//       setDrawings(drawingsData || []);
//       setResults(resultsData || []);

//       // Extract drawing data for charts
//       const drawingDataArray = (drawingsData || []).map((d) => d.drawing_data);
//       setAllDrawingData(drawingDataArray);

//       // Set up charts with the first drawing's data
//       if (drawingDataArray.length > 0) {
//         updateChartsForDrawingWithData(
//           0,
//           drawingDataArray,
//           resultsData || [],
//           drawingsData || []
//         );
//       }
//       updateAnalysisHistory(drawingsData || [], resultsData || []);
//     } catch (error) {
//       console.error("Error loading initial data:", error);
//       setError("Failed to load analysis results. Please try again.");
//     } finally {
//       setLoadingResult(false);
//     }
//   };

//   const updateChartsForDrawingWithData = (
//     index,
//     drawingDataArray,
//     resultsArray,
//     drawingsData
//   ) => {
//     const drawingData = drawingDataArray[index];
//     if (!drawingData) return;

//     console.log(`Updating charts for drawing ${index + 1}`);
//     setDrawData(drawingData);
//     setSpeedData(calculateSpeed(drawingData));
//     setAngleData(processData(drawingData));
//     setPData(CanIAvoidBugByThis(drawingData));

//     // Use the passed drawingsData instead of state
//     const currentDrawing = drawingsData[index];
//     if (!currentDrawing) {
//       setResult(null);
//       return;
//     }

//     const drawingResult = resultsArray.find(
//       (r) => r.drawing_id === currentDrawing.id
//     );
//     if (drawingResult && drawingResult.status === "completed") {
//       setResult(drawingResult.result_data);
//     } else {
//       setResult(null);
//     }
//   };
//   // update charts for a specific drawing
//   const updateChartsForDrawing = (index, drawingsArray, resultsArray) => {
//     const drawingData = drawingsArray[index];
//     if (!drawingData) return;

//     console.log(`Updating charts for drawing ${index + 1}`);
//     setDrawData(drawingData);
//     setSpeedData(calculateSpeed(drawingData));
//     setAngleData(processData(drawingData));
//     setPData(CanIAvoidBugByThis(drawingData));

//     const currentDrawing = drawings[index];
//     if (!currentDrawing) {
//       setResult(null);
//       return;
//     }

//     const drawingResult = resultsArray.find(
//       (r) => r.drawing_id === currentDrawing.id
//     );

//     if (drawingResult && drawingResult.status === "completed") {
//       setResult(drawingResult.result_data);
//     } else {
//       setResult(null);
//     }
//   };

//   // update analysis history
//   const updateAnalysisHistory = (drawingsArray, resultsArray) => {
//     const individualResults = drawingsArray.map((drawing) => {
//       if (!drawing || !drawing.id) {
//         console.warn("Drawing missing id:", drawing);
//         return null;
//       }
//       const result = resultsArray.find((r) => r.drawing_id === drawing.id);

//       if (!result) return null;
//       if (result.status === "failed")
//         return { error: true, errorMessage: result.result_data?.errorMessage };
//       if (result.status === "completed") return result.result_data;
//       return null;
//     });

//     const completedResults = individualResults.filter((r) => r && !r.error);
//     const dosScores = completedResults
//       .map((r) => parseFloat(r.DOS))
//       .filter((score) => !isNaN(score));

//     const averageDOS =
//       dosScores.length > 0
//         ? (dosScores.reduce((a, b) => a + b, 0) / dosScores.length).toFixed(2)
//         : null;

//     const history = {
//       individual_results: individualResults,
//       total_drawings: drawingsArray.length,
//       successful_drawings: completedResults.length,
//       average_DOS: averageDOS,
//     };
//     console.log("Updated analysis history:", history);
//     setAnalysisHistory(history);
//   };

//   // Real-time subscription to analysis updates
//   useEffect(() => {
//     if (!sessionId) return;
//     console.log("Setting up real-time subscription for session:", sessionId);

//     const subscription = supabase
//       .channel(`session-${sessionId}`)
//       .on(
//         "postgres_changes",
//         {
//           event: "*",
//           schema: "public",
//           table: "api_results",
//           filter: `session_id=eq.${sessionId}`,
//         },
//         (payload) => {
//           console.log(" Received update:", payload);
//           handleRealTimeUpdate(payload);
//         }
//       )
//       .subscribe();

//     return () => {
//       subscription.unsubscribe();
//     };
//   }, [sessionId]);

//   // Handle real time updates
//   const handleRealTimeUpdate = (payload) => {
//     const { eventType, new: newRecord } = payload;

//     if (eventType === "INSERT") {
//       setResults((prev) => [...prev, newRecord]);
//     } else if (eventType === "UPDATE") {
//       setResults((prev) =>
//         prev.map((result) => (result.id === newRecord.id ? newRecord : result))
//       );
//     }

//     setTimeout(() => {
//       setResults((currentResults) => {
//         const updatedResults =
//           eventType === "INSERT"
//             ? [...currentResults, newRecord]
//             : currentResults.map((result) =>
//                 result.id === newRecord.id ? newRecord : result
//               );

//         updateAnalysisHistory(drawings, [...results, updatedResults]);

//         // update current charts if selected drawing
//         const drawingIndex = drawings.findIndex(
//           (d) => d.id === newRecord.drawing_id
//         );
//         if (drawingIndex === selectedDrawingIndex && drawingIndex !== -1) {
//           updateChartsForDrawing(
//             selectedDrawingIndex,
//             allDrawingData,
//             updatedResults
//           );
//         }
//         return updatedResults;
//       });
//     }, 100);
//   };

//   // Initialize data on mount
//   useEffect(() => {
//     if (sessionId) {
//       loadInitialData();
//     }
//   }, [sessionId]);

//   // Update analysis history when drawings or results change
//   useEffect(() => {
//     if (drawings.length > 0) {
//       updateAnalysisHistory(drawings, results);
//     }
//   }, [drawings, results]);

//   // handles showcasing of each individual result
//   const drawingClick = (index) => {
//     console.log("🖱️ Drawing clicked:", index);
//     setSelectedDrawingIndex(index);
//     updateChartsForDrawing(index, allDrawingData, results);
//   };

//   const getDOSScore = () => {
//     const allCompleted = drawings.every((drawing) => {
//       const result = results.find((r) => r.drawing_id === drawing.id);
//       return result && result.status === "completed";
//     });

//     if (!allCompleted) {
//       return "Pending...";
//     }

//     // Return average DOS if available
//     if (analysisHistory && analysisHistory.average_DOS !== null) {
//       return analysisHistory.average_DOS;
//     }

//     return "N/A";
//   };

//   // Gets current drawing DOS score
//   const getCurrentDOSScore = () => {
//     // Show "Pending..." for incomplete analysis
//     if (selectedDrawingIndex === null || !drawings[selectedDrawingIndex]) {
//       return "N/A";
//     }

//     const drawing = drawings[selectedDrawingIndex];
//     if (!drawing || !drawing.id) {
//       return "N/A";
//     }
//     const drawingResult = results.find((r) => r.drawing_id === drawing.id);

//     if (!drawingResult) return "Pending...";
//     if (drawingResult.status === "failed") return "Failed";
//     if (drawingResult.status === "processing") return "Analyzing...";
//     if (drawingResult.status === "completed") {
//       return drawingResult.result_data?.DOS || "N/A";
//     }

//     return "Pending...";
//   };

//   const downloadResults = () => {
//     console.log("💾 Download requested");

//     if (!result && !analysisHistory) {
//       alert("No results available to download");
//       return;
//     }

//     const downloadData = {
//       timestamp: new Date().toISOString(),
//       analysis_type: analysisHistory
//         ? "multi_drawing_average"
//         : "single_drawing",
//       average_DOS: getDOSScore(),
//       current_drawing_index: selectedDrawingIndex,
//       current_drawing_DOS: getCurrentDOSScore(),
//       all_drawings: analysisHistory?.individual_results || [result],
//       drawing_data: allDrawingData,
//       speed_data: speedData,
//       angle_data: angleData,
//       pressure_data: pData,
//       session_id: sessionId,
//       ...result,
//     };

//     const dataStr = JSON.stringify(downloadData, null, 2);
//     const dataBlob = new Blob([dataStr], { type: "application/json" });
//     const url = URL.createObjectURL(dataBlob);
//     const link = document.createElement("a");
//     link.href = url;
//     link.download = `spiral_analysis_results_${
//       new Date().toISOString().split("T")[0]
//     }.json`;
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//     URL.revokeObjectURL(url);
//   };
//   if (!sessionId) {
//     router.push("/machine");
//     return null;
//   }

//   return (
//     <div className={styles.pageWrapper}>
//       <Header showVideo={false} />
//       <div className={styles.container}>
//         <div className={styles.title}>
//           <h2>Analysis Results</h2>
//           {loadingResult ? (
//             <p>
//               Analyzing
//               <AnimatedEllipsis />
//             </p>
//           ) : (
//             <p>Average DOS Score: {getDOSScore()}</p>
//           )}
//           {error && <p style={{ color: "red" }}>{String(error)}</p>}
//         </div>

//         {drawings.length > 0 && (
//           <div className={styles.title}>
//             <h3>Individual Drawings:</h3>
//             <div
//               style={{
//                 display: "flex",
//                 gap: "10px",
//                 justifyContent: "center",
//                 flexWrap: "wrap",
//               }}
//             >
//               {drawings.map((drawing, index) => {
//                 const drawingResult = results.find(
//                   (r) => r.drawing_id === drawing.id
//                 );

//                 let displayContent = `#${index + 1}`;
//                 let isClickable = true;
//                 let backgroundColor = "rgba(255,255,255,0.1)";

//                 if (!drawingResult) {
//                   backgroundColor = "rgba(255, 165, 0, 0.3)"; // Orange for pending
//                 } else if (drawingResult.status === "processing") {
//                   backgroundColor = "rgba(255, 165, 0, 0.3)"; // Orange for processing
//                 } else if (drawingResult.status === "failed") {
//                   displayContent = `#${index + 1}: Failed`;
//                   backgroundColor = "rgba(255,100,100,0.2)"; // Red for failed
//                 }

//                 return (
//                   <span
//                     key={index}
//                     onClick={
//                       isClickable ? () => drawingClick(index) : undefined
//                     }
//                     style={{
//                       padding: "5px 10px",
//                       background:
//                         selectedDrawingIndex === index
//                           ? "rgba(255,255,255,0.3)"
//                           : backgroundColor,
//                       borderRadius: "4px",
//                       fontSize: "14px",
//                       cursor: isClickable ? "pointer" : "not-allowed",
//                       border:
//                         selectedDrawingIndex === index
//                           ? "2px solid white"
//                           : "2px solid transparent",
//                       transition: "all 0.2s ease",
//                     }}
//                     onMouseEnter={(e) => {
//                       if (selectedDrawingIndex !== index && isClickable) {
//                         e.target.style.background = "rgba(255,255,255,0.2)";
//                       }
//                     }}
//                     onMouseLeave={(e) => {
//                       if (selectedDrawingIndex !== index) {
//                         e.target.style.background = backgroundColor;
//                       }
//                     }}
//                   >
//                     {displayContent}
//                   </span>
//                 );
//               })}
//             </div>
//             <div style={{ textAlign: "center", marginTop: "20px" }}>
//               <button
//                 onClick={downloadResults}
//                 style={{
//                   backgroundColor: "#4a90e2",
//                   color: "white",
//                   border: "none",
//                   padding: "10px 20px",
//                   borderRadius: "6px",
//                   fontSize: "14px",
//                   fontWeight: "500",
//                   cursor: "pointer",
//                   transition: "background-color 0.2s ease",
//                   boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
//                   display: "flex",
//                   alignItems: "center",
//                   gap: "8px",
//                   margin: "0 auto",
//                 }}
//                 onMouseEnter={(e) => {
//                   e.target.style.backgroundColor = "#357abd";
//                 }}
//                 onMouseLeave={(e) => {
//                   e.target.style.backgroundColor = "#4a90e2";
//                 }}
//               >
//                 <FaDownload size={16} />
//                 Download Results
//               </button>
//             </div>
//           </div>
//         )}

//         <div className={styles.chartGrid}>
//           <div className={styles.graphCard}>
//             <h3>Spiral XY Plot</h3>
//             <div className={styles.chartContainer}>
//               <LineGraph data={drawData} />
//             </div>
//             <div
//               style={{ marginTop: "10px", textAlign: "center", color: "black" }}
//             >
//               DOS Score: {getCurrentDOSScore()}
//             </div>
//           </div>
//           <div className={styles.graphCard}>
//             <h3>Speed vs. Time</h3>
//             <div className={styles.chartContainer}>
//               <SpeedTimeChart speedData={speedData} />
//             </div>
//           </div>
//           <div className={styles.graphCard}>
//             <h3>3D Spiral View</h3>
//             <div className={styles.chartContainer}>
//               <SpiralPlot data={drawData} />
//             </div>
//           </div>
//           <div className={styles.graphCard}>
//             <h3>Pressure vs Time</h3>
//             <div className={styles.chartContainer}>
//               <PTChart data={drawData} />
//             </div>
//           </div>
//           <div className={styles.graphCard}>
//             <h3>Tremor Polar Plot</h3>
//             <div className={styles.chartContainer}>
//               {loadingResult ? (
//                 <p>Loading tremor data...</p>
//               ) : (
//                 <TremorPolarPlot result={result} />
//               )}
//             </div>
//           </div>
//           <div className={styles.graphCard}>
//             <h3>Speed vs Angle</h3>
//             <div className={styles.chartContainer}>
//               <Line3DPlot data={angleData} />
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
