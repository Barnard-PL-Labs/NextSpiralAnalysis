import React from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";

const MiniSpiralHistory = ({ savedDrawings, currentDrawingIndex = 0 }) => {
  if (!savedDrawings || savedDrawings.length === 0) {
    return null;
  }

  // Define positions for each spiral (top-left, top-right, bottom-left, bottom-right)
  const positions = [
    { top: '70px', left: '120px' },      // Spiral 1: top-left
    { top: '70px', right: '120px' },     // Spiral 2: top-right
    { bottom: '110px', left: '120px' },   // Spiral 3: bottom-left
    { bottom: '110px', right: '120px' }   // Spiral 4: bottom-right
  ];

  const SpiralCard = ({ drawing, index, position }) => (
    <div
      style={{
        position: 'absolute',
        ...position,
        width: '120px',
        height: '120px',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        border: '2px solid #ddd',
        borderRadius: '8px',
        padding: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        zIndex: 1000,
        pointerEvents: 'none'
      }}
    >
      <div style={{
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#666',
        marginBottom: '4px',
        textAlign: 'center'
      }}>
        Spiral {index + 1}
      </div>
      <div style={{ width: '100%', height: '90px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={drawing}
            margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
          >
            <XAxis type="number" dataKey="x" hide />
            <YAxis type="number" dataKey="y" hide reversed />
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

  return (
    <>
      {savedDrawings.slice(0, 4).map((drawing, index) => (
        <SpiralCard
          key={index}
          drawing={drawing}
          index={index}
          position={positions[index]}
        />
      ))}
    </>
  );
};

export default MiniSpiralHistory;