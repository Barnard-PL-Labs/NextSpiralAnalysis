// pages/results/[id].jsx
//Most of these is identical to the normal result page, but this one is linked to the dashboard
"use client";

import { useEffect, useState } from "react";
import XYChart from "@/components/Scatter";
import Spiral3D from "@/components/TimeTrace";
import { SpeedTimeChart, calculateSpeed } from "@/components/ST";
import Header from "@/components/Header";
import styles from "@/styles/Result.module.css";
import { CanIAvoidBugByThis, PTChart } from "@/components/PressureTime";
import { Line3DPlot, processData } from "@/components/Angle";
import SpiralPlot from "@/components/NewTimeTrace";
import { supabase } from "@/lib/supabaseClient";
import { useParams } from "next/navigation";
import LineGraph from "../../../components/LineGraph";
import TremorPolarPlot from "../../../components/Tremor";
import { FaDownload } from "react-icons/fa";

export default function ResultPage() {
  const params = useParams();
  const id = params?.id;

  const [drawData, setDrawData] = useState([]);
  const [result, setResult] = useState(null);
  const [speedData, setSpeedData] = useState([]);
  const [angleData, setAngleData] = useState([]);
  const [pData, setPData] = useState([]);
  const [error, setError] = useState(null);
  const [analysisHistory, setAnalysisHistory] = useState(null);
  const [selectedDrawingIndex, setSelectedDrawingIndex] = useState(null);
  const [allDrawingData, setAllDrawingData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      // ✅ NEW: Separate queries instead of join
      // First get the api_result
      const { data: resultData, error: resultError } = await supabase
        .from("api_results")
        .select("*")
        .eq("drawing_id", id)
        .single();

      if (resultError || !resultData) {
        console.error("Error fetching result:", resultError);
        setError("Failed to load analysis results.");
        return;
      }

      // Then get the associated drawing
      const { data: drawingData, error: drawingError } = await supabase
        .from("drawings")
        .select("drawing_data")
        .eq("id", resultData.drawing_id)
        .single();

      if (drawingError || !drawingData) {
        console.error("Error fetching drawing:", drawingError);
        setError("Failed to load drawing data.");
        return;
      }

      // ✅ Process the data (rest stays the same)
      const drawingArray = drawingData.drawing_data || [];
      const resultDataObj = resultData.result_data || {};

      const isMulti = Array.isArray(drawingArray[0]);
      const drawings = isMulti ? drawingArray : [drawingArray];

      setAllDrawingData(drawings);
      setSelectedDrawingIndex(0);
      setDrawData(drawings[0]);
      setSpeedData(calculateSpeed(drawings[0]));
      setAngleData(processData(drawings[0]));
      setPData(CanIAvoidBugByThis(drawings[0]));

      setResult({
        ...resultDataObj,
        average_DOS: resultDataObj.average_DOS,
        analysis_type: isMulti ? "multi_drawing_average" : "single_drawing",
        selected_drawing: 1,
        total_drawings: drawings.length,
        successful_drawings: drawings.length,
      });

      setAnalysisHistory({
        average_DOS: resultDataObj.average_DOS,
        individual_results: isMulti
          ? resultDataObj.individual_results ||
            drawings.map((_, i) => ({ DOS: null }))
          : [],
        total_drawings: drawings.length,
        successful_drawings: drawings.length,
      });
    };

    fetchData();
  }, [id]);

  const drawingClick = (index) => {
    if (!allDrawingData) return;
    setSelectedDrawingIndex(index);
    const drawing = allDrawingData[index];
    setDrawData(drawing);
    setSpeedData(calculateSpeed(drawing));
    setAngleData(processData(drawing));
    setPData(CanIAvoidBugByThis(drawing));
  };

  const getDOSScore = () => {
    if (!result) return "N/A";
    return result.average_DOS ?? result.DOS ?? "N/A";
  };

  const currentResult =
    analysisHistory?.individual_results?.[selectedDrawingIndex];

  const downloadResults = () => {
    if (!result && !analysisHistory) {
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
      current_drawing_DOS: currentResult?.DOS || "N/A",
      all_drawings: analysisHistory?.individual_results || [result],
      drawing_data: allDrawingData,
      speed_data: speedData,
      angle_data: angleData,
      pressure_data: pData,
      ...result,
    };

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
  };

  return (
    <div className={styles.pageWrapper}>
      <Header showVideo={false} />
      <div className={styles.container}>
        <div className={styles.title}>
          <h2>Analysis Results</h2>
          <p>Average DOS Score: {getDOSScore()}</p>
          {error && <p style={{ color: "red" }}>{error}</p>}
        </div>

        {analysisHistory && analysisHistory.individual_results && (
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
              {analysisHistory.individual_results.map((_, index) => (
                <span
                  key={index}
                  onClick={() => drawingClick(index)}
                  style={{
                    padding: "5px 10px",
                    background:
                      selectedDrawingIndex === index
                        ? "rgba(255,255,255,0.3)"
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
                >
                  #{index + 1}
                </span>
              ))}
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
              DOS Score: {currentResult?.DOS ?? "N/A"}
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
              <TremorPolarPlot result={result} />
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
