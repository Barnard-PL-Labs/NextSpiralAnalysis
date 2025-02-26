'use client';
import { useState, useEffect } from "react";
import XYChart from "../../components/Scatter";

export default function ResultPage(){
    const [drawData, setDrawData] = useState([]);
    const [result, setResult] = useState([]);

    useEffect(() => {
        if (typeof window !== "undefined") { 
            const storedDrawData = localStorage.getItem("drawData");
            const storedResult = localStorage.getItem('resultFromApi')
            if (storedDrawData && storedResult ) {
                setDrawData(JSON.parse(storedDrawData));
                setResult(JSON.parse(storedResult));
            }
        }
    }, []);
    return (
        <div>
            <h1>Analysis Result</h1>
            <p>Total Points Recorded: {drawData.length}</p>
            <p>Your DOS result is: {result.DOS}</p>


            <XYChart data={drawData} />

        </div>
    );

}