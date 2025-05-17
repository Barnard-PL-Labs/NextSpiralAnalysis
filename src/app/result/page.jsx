"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/authProvider";
import { supabase } from "@/lib/supabaseClient";
import Header from '../../components/Header';
import styles from '../../styles/Result.module.css';
import LineGraph from "../../components/LineGraph";
import { SpeedTimeChart, calculateSpeed } from "../../components/ST";
import SpiralPlot from "../../components/NewTimeTrace";
import { CanIAvoidBugByThis, PTChart } from '../../components/PressureTime';
import TremorPolarPlot from "../../components/Tremor";
import { Line3DPlot, processData } from '../../components/Angle';

export default function ResultPage() {
  const [drawData, setDrawData] = useState([]);
  const [result, setResult] = useState(null);
  const [speedData, setSpeedData] = useState([]);
  const [angleData, setAngleData] = useState([]);
  const [pData, setPData] = useState([]);
  const [loadingResult, setLoadingResult] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user === undefined) {
      console.log("Waiting for user to be initialized...");
      return;
    }

    const storedDrawData = localStorage.getItem("drawData");
    if (!storedDrawData) {
      setError("No drawing data found. Please draw something first.");
      setLoadingResult(false);
      return;
    }

    const parsedDrawData = JSON.parse(storedDrawData);
    setDrawData(parsedDrawData);

    setSpeedData(calculateSpeed(parsedDrawData));
    setAngleData(processData(parsedDrawData));
    setPData(CanIAvoidBugByThis(parsedDrawData));

    const email = user?.email || "anonymous";
    const username = email.split("@")[0];

    const fetchAndSaveResult = async () => {
      setLoadingResult(true);
      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ drawData: parsedDrawData, user: { email, username } }),
        });

        if (!response.ok) throw new Error(`API error: ${response.statusText}`);

        const data = await response.json();
        setResult(data.result);
        localStorage.setItem("resultFromApi", JSON.stringify(data.result));

        if (user?.id) {
          await saveToDatabase(user.id, parsedDrawData, data.result);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to get analysis result. Please try again.");
      } finally {
        setLoadingResult(false);
      }
    };

    fetchAndSaveResult();
  }, [user]);

  const saveToDatabase = async (userId, drawData, apiResult) => {
    try {
      const { data: drawing, error: drawError } = await supabase
        .from("drawings")
        .insert([{ user_id: userId, drawing_data: drawData }])
        .select("id")
        .single();

      if (drawError) throw drawError;

      await supabase.from("api_results").insert([
        { user_id: userId, drawing_id: drawing.id, result_data: apiResult },
      ]);

      console.log("Data saved successfully in Supabase!");
    } catch (error) {
      console.error("Error saving data to Supabase:", error);
    }
  };

  return (
    <div className={styles.pageWrapper}>
      <Header showVideo={false} />
      <div style={{ backgroundColor: 'black', color: 'white', paddingTop: '80px' }}>
        <div className={styles.title}>
          <h2>Analysis Result</h2>
          <p>Your DOS result is: {loadingResult ? "Analyzing..." : (result?.DOS ?? "N/A")}</p>
          {error && <p style={{ color: "red" }}>{error}</p>}
        </div>

        <div className={styles.chartGrid}>
          <div className={styles.graphCard}>
            <h3>Spiral XY Plot</h3>
            <div className={styles.chartContainer}><LineGraph data={drawData} /></div>
          </div>
          <div className={styles.graphCard}>
            <h3>Speed vs. Time</h3>
            <div className={styles.chartContainer}><SpeedTimeChart speedData={speedData} /></div>
          </div>
          <div className={styles.graphCard}>
            <h3>3D Spiral View</h3>
            <div className={styles.chartContainer}><SpiralPlot data={drawData} /></div>
          </div>
          <div className={styles.graphCard}>
            <h3>Pressure vs Time</h3>
            <div className={styles.chartContainer}><PTChart data={drawData} /></div>
          </div>
          <div className={styles.graphCard}>
            <h3>Tremor Polar Plot</h3>
            <div className={styles.chartContainer}>
              {loadingResult ? <p>Loading tremor data...</p> : <TremorPolarPlot result={result} />}
            </div>
          </div>
          <div className={styles.graphCard}>
            <h3>Speed vs Angle</h3>
            <div className={styles.chartContainer}><Line3DPlot data={angleData} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
