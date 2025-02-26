'use client';
import { useState } from "react";
import XYChart from "../../components/Scatter";

export default function ResultPage(){
    const drawData = JSON.parse(localStorage.getItem('drawData'));
    const result = JSON.parse(localStorage.getItem('resultFromApi'));
    console.log(result);
    const xValues = drawData.map(point => point.x);
    console.log(xValues); 
    const yValues = drawData.map(point => point.y);
    console.log(yValues);

    return (
        <div>
            <h1>Analysis Result</h1>
            <p>Total Points Recorded: {drawData.length}</p>
            <p>Your DOS result is: {result.DOS}</p>


            <XYChart data={drawData} />

        </div>
    );

}