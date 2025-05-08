'use client';
import { useState, useEffect } from "react";
import XYChart from "../../components/Scatter";
import Spiral3D from '../../components/TimeTrace';
import { SpeedTimeChart, calculateSpeed } from "../../components/ST";
import Header from '../../components/Header';
import styles from '../../styles/Result.module.css';
import {CanIAvoidBugByThis,PTChart} from '../../components/PressureTime'
import {Line3DPlot, processData} from '../../components/Angle';
import SpiralPlot from "../../components/NewTimeTrace";
import LineGraph from "../../components/LineGraph";
import TremorPolarPlot from "../../components/Tremor";
//The comment out part below is my attempt to add loading animation
// import { useLottie } from "lottie-react";
// import animationData from '../../../public/Icons/loading.json'

export default function ResultPage() {
    const [drawData, setDrawData] = useState([]);
    const [result, setResult] = useState({});
    const [speedData, setSpeedData] = useState([]); 
    const [angleData, setAngleData] = useState([]);
    const [pData, setPData] = useState([]);
    // const options = {
    //     animationData,
    //     loop: true
    //   };
    // const {View} = useLottie(options)

    //To get the data i stored from the machine page
    useEffect(() => {
        if (typeof window !== "undefined") { 
            const storedDrawData = localStorage.getItem("drawData");
            const storedResult = localStorage.getItem("resultFromApi");
            
            console.log("Stored Draw Data:", storedDrawData);
            console.log("Stored Result:", storedResult);

            if (storedDrawData && storedResult) {
                try {
                    const parsedDrawData = JSON.parse(storedDrawData);
                    const parsedResult = JSON.parse(storedResult);
                    console.log("Parsed Draw Data:", parsedDrawData);
                    console.log("Parsed Result:", parsedResult);
                    
                    setDrawData(parsedDrawData);
                    setResult(parsedResult);
                } catch (error) {
                    console.error("Error parsing stored data:", error);
                }
            } else {
                console.log("No stored data found");
            }
        }
    }, []);

    useEffect(() => {
        console.log("Current result state:", result);
        console.log("Current drawData state:", drawData);
        
        if (drawData.length > 1) {
            setSpeedData(calculateSpeed(drawData));
            setAngleData(processData(drawData));
            setPData(CanIAvoidBugByThis(drawData));
        }
    }, [drawData, result]);

    return (
      
        <div className={styles.pageWrapper}>
        <Header showVideo={false}/>
        <div style={{backgroundColor:'black',color:'black',paddingTop:'80px'}}>
          <div className={styles.title}>
            <h2 style={{color:'white'}}>Analysis Result</h2>
            <p style={{color:'white'}}>Your DOS result is: {result?.DOS || 'Loading...'}</p>
            </div>
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
