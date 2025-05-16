"use client";
import { useState, useEffect } from "react";
import Canvas from "@/components/Canvas";
import Button from "@/components/Button";
import styles from "@/styles/Canvas.module.css";
import Header from '@/components/Header';
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authProvider";

export default function MachinePage() {
  const [drawData, setDrawData] = useState([]);
  const { user } = useAuth();
  const router = useRouter();

  // Clear old data only when starting a new drawing
  const handleNewDrawing = () => {
    console.log("Clearing data for new drawing...");
    setDrawData([]);
    localStorage.removeItem("drawData");
    localStorage.removeItem("resultFromApi");
    sessionStorage.removeItem("drawData");
    sessionStorage.removeItem("resultFromApi");
  };

  // Save drawData and navigate immediately
  const sendDataToBackend = () => {
    if (drawData.length === 0) {
      alert("Please draw something before analyzing.");
      return;
    }
    console.log("Saving drawData and navigating to /result...");
    const drawDataStr = JSON.stringify(drawData);
    localStorage.setItem("drawData", drawDataStr);
    sessionStorage.setItem("drawData", drawDataStr);
    router.push("/result");
  };

  return (
    <>
      <Header showVideo={true} />
      <div className={styles.machineContainer}>
        <h1 className={styles.title}>Spiral Drawing Tool</h1>
        <Canvas setDrawData={setDrawData} onStartDrawing={handleNewDrawing} />
        <Button sendData={sendDataToBackend} />
      </div>
    </>
  );
}
