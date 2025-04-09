'use client';
import Plot from 'react-plotly.js';
import {ScatterChart,Scatter,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer} from 'recharts';
const processData = (data) => {
    const processedData = [];
  
    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1];
      const curr = data[i];
  
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const dt = curr.t - prev.t; 
  
     
      let angle = Math.atan2(dy, dx) * (180 / Math.PI);
      if (angle < 0) angle += 360; 
  
      
      const distance = Math.sqrt(dx * dx + dy * dy);
      const speed = dt > 0 ? distance / dt : 0; 
  
      processedData.push({ angle:angle, speed:speed.toFixed(2), time: curr.t });
    }
    console.log(processedData);

    return processedData;
  };

//   const SpeedAngleScatterPlot = ({ data }) => (
//     <div style={{ width: '100%', height: '100%' }}>
//       <ResponsiveContainer width="100%" height="100%">
//         <ScatterChart
//           margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
//         >
//           <CartesianGrid />
//           <XAxis
//             type="number"
//             dataKey="angle"
//             name="Angle"
//             unit="°"
//             domain={[0, 360]}
//           />
//           <YAxis
//             type="number"
//             dataKey="speed"
//             name="Speed"
//             unit="units/s"
//           />
//           <Tooltip cursor={{ strokeDasharray: '3 3' }} />
//           <Scatter name="Speed vs. Angle" data={data} fill="#8884d8" />
//         </ScatterChart>
//       </ResponsiveContainer>
//     </div>
//   );



const Line3DPlot = ({ data }) => {
  const plotData = [
    {
      x: data.map((d) => d.time),
      y: data.map((d) => d.angle),
      z: data.map((d) => d.speed),
      type: 'scatter3d',
      mode: 'lines',
      line: {
        width: 2,
        color: '#1f77b4',
      },
    },
  ];

  const layout = {
    margin: { l: 0, r: 0, b: 0, t: 0 },
    scene: {
      xaxis: { title:  'Time'},
      yaxis: { title: 'Angle (degrees)' },
      zaxis: { title:  'Speed (units/s)'},
    },
  };

  return <Plot data={plotData} layout={layout} style={{ width: '100%', height: '100%' }} />;
};

  
  export {Line3DPlot, processData};


  