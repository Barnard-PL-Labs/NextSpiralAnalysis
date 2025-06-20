import React from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import styles from '@/styles/MiniSpiralHistory.module.css';

const MiniSpiralHistory = ({ savedDrawings, currentDrawingIndex = 0, sidebar = true }) => {
  if (!savedDrawings || savedDrawings.length === 0) {
    return null;
  }

  const SidebarSpiralCard = ({ drawing, index }) => {
    // Calculate the center point of the drawing
    const xValues = drawing.map(d => d.x);
    const yValues = drawing.map(d => d.y);
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);
    
    // Add padding to the domain
    const xPadding = (xMax - xMin) * 0.1;
    const yPadding = (yMax - yMin) * 0.1;

    return (
      <div className={styles.spiralCard}>
        <div className={styles.spiralTitle}>
        Spiral {index + 1}
      </div>
        <div className={styles.spiralChart}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={drawing}
              margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
              <XAxis 
                type="number" 
                dataKey="x" 
                hide 
                domain={[xMin - xPadding, xMax + xPadding]}
              />
              <YAxis 
                type="number" 
                dataKey="y" 
                hide 
                reversed
                domain={[yMin - yPadding, yMax + yPadding]}
              />
            <Line 
              type="monotone" 
              dataKey="y" 
              stroke="#8884d8" 
              strokeWidth={1.5}
              dot={false}
              animationDuration={0}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
  };

  const DashboardSpiralCard = ({ drawing, index }) => {
    // Calculate the center point of the drawing
    const xValues = drawing.map(d => d.x);
    const yValues = drawing.map(d => d.y);
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);
    
    // Add padding to the domain
    const xPadding = (xMax - xMin) * 0.1;
    const yPadding = (yMax - yMin) * 0.1;

    return (
      <div className={styles.dashboardSpiralCard}>
        <div className={styles.dashboardSpiralTitle}>
          Spiral {index + 1}
        </div>
        <div className={styles.dashboardSpiralChart}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={drawing}
              margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
            >
              <XAxis 
                type="number" 
                dataKey="x" 
                hide 
                domain={[xMin - xPadding, xMax + xPadding]}
              />
              <YAxis 
                type="number" 
                dataKey="y" 
                hide 
                reversed
                domain={[yMin - yPadding, yMax + yPadding]}
              />
              <Line 
                type="monotone" 
                dataKey="y" 
                stroke="#8884d8" 
                strokeWidth={1}
                dot={false}
                animationDuration={0}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  if (sidebar) {
    return (
      <div className={styles.spiralSidebar}>
        {savedDrawings.map((drawing, index) => (
          <SidebarSpiralCard
            key={index}
            drawing={drawing}
            index={index}
          />
        ))}
      </div>
    );
  } else {
  return (
      <div className={styles.spiralGrid}>
        {savedDrawings.map((drawing, index) => (
          <DashboardSpiralCard
          key={index}
          drawing={drawing}
          index={index}
        />
      ))}
      </div>
  );
  }
};

export default MiniSpiralHistory;