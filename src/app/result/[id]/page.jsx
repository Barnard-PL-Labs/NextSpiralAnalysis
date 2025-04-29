// pages/results/[id].jsx
//Most of these is identical to the normal result page, but this one is linked to the dashboard
'use client'
import { useEffect, useState } from 'react';
import XYChart from '@/components/Scatter';
import Spiral3D from '@/components/TimeTrace';
import { SpeedTimeChart, calculateSpeed } from '@/components/ST';
import Header from '@/components/Header';
import styles from '@/styles/Result.module.css';
import { CanIAvoidBugByThis, PTChart } from '@/components/PressureTime';
import { Line3DPlot, processData } from '@/components/Angle';
import SpiralPlot from '@/components/NewTimeTrace';
import { supabase } from '@/lib/supabaseClient';
import { useParams } from 'next/navigation';

export default function ResultPage() {
  const params = useParams();
  const id = params?.id;
  const [drawData, setDrawData] = useState([]);
  const [result, setResult] = useState({});
  const [speedData, setSpeedData] = useState([]);
  const [angleData, setAngleData] = useState([]);
  const [pData, setPData] = useState([]);
  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
  
      const { data, error } = await supabase
        .from('api_results')
        .select(`
          result_data,
          drawings (
            drawing_data
          )
        `)
        .eq('drawing_id', id)
        .single();
  
      if (error) {
        console.error('Error fetching result:', error);
        return;
      }
  
      if (data) {
        try {
          const drawingData = data.drawings.drawing_data;
          setDrawData(drawingData);
          setResult(data.result_data);
        } catch (error) {
          console.error('Data format error:', error);
        }
      }
    };
  
    fetchData();
  }, [id]);
  useEffect(() => {
    if (drawData.length > 1) {
      setSpeedData(calculateSpeed(drawData));
      setAngleData(processData(drawData));
      setPData(CanIAvoidBugByThis(drawData));
    }
  }, [drawData]);


  return (
    <div className={styles.pageWrapper}>
      <Header showVideo={false} />
      <div style={{ backgroundColor: 'black', color: 'black', paddingTop: '80px' }}>
        <div className={styles.title}>
          <h2 style={{ color: 'white' }}>Analysis Result</h2>
          <p style={{ color: 'white' }}>Your DOS result is: {result.DOS}</p>
        </div>
        <div className={styles.chartGrid}>
          <div className={styles.graphCard}>
            <h3>Spiral XY Plot</h3>
            <div className={styles.chartContainer}>
              <XYChart data={drawData} />
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
              <p>Coming soon</p>
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
