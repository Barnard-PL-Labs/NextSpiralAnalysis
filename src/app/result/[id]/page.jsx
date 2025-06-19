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
import LineGraph from '../../../components/LineGraph';

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

      if (error || !data) {
        console.error('Error fetching result:', error);
        setError('Failed to load analysis results.');
        return;
      }

      const drawingData = data.drawings?.drawing_data || [];
      const resultData = data.result_data || {};

      const isMulti = Array.isArray(drawingData[0]);
      const drawings = isMulti ? drawingData : [drawingData];

      setAllDrawingData(drawings);
      setSelectedDrawingIndex(0);
      setDrawData(drawings[0]);
      setSpeedData(calculateSpeed(drawings[0]));
      setAngleData(processData(drawings[0]));
      setPData(CanIAvoidBugByThis(drawings[0]));

      setResult({
        ...resultData,
        average_DOS: resultData.average_DOS,
        analysis_type: isMulti ? 'multi_drawing_average' : 'single_drawing',
        selected_drawing: 1,
        total_drawings: drawings.length,
        successful_drawings: drawings.length,
      });

      setAnalysisHistory({
        average_DOS: resultData.average_DOS,
        individual_results: isMulti ? resultData.individual_results || drawings.map((_, i) => ({ DOS: null })) : [],
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
    if (!result) return 'N/A';
    return result.average_DOS ?? result.DOS ?? 'N/A';
  };

  const currentResult = analysisHistory?.individual_results?.[selectedDrawingIndex];

  return (
    <div className={styles.pageWrapper}>
      <Header showVideo={false} />
      <div className={styles.container}>
        <div className={styles.title}>
          <h2>Analysis Results</h2>
          <p>Average DOS Score: {getDOSScore()}</p>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>

        {analysisHistory && analysisHistory.individual_results && (
          <div className={styles.title}>
            <h3>Individual Drawings:</h3>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {analysisHistory.individual_results.map((_, index) => (
                <span
                  key={index}
                  onClick={() => drawingClick(index)}
                  style={{
                    padding: '5px 10px',
                    background: selectedDrawingIndex === index ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    border: selectedDrawingIndex === index ? '2px solid white' : '2px solid transparent',
                    transition: 'all 0.2s ease',
                  }}
                >
                  #{index + 1}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className={styles.chartGrid}>
          <div className={styles.graphCard}>
            <h3>Spiral XY Plot</h3>
            <div className={styles.chartContainer}>
              <LineGraph data={drawData} />
            </div>
            <div style={{ marginTop: '10px', textAlign: 'center', color: 'black' }}>
              DOS Score: {currentResult?.DOS ?? 'N/A'}
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
