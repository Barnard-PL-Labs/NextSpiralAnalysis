// import dynamic from 'next/dynamic';

// const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });
// const processData = (data) => {
//     const processedData = [];
  
//     for (let i = 1; i < data.length; i++) {
//       const prev = data[i - 1];
//       const curr = data[i];
  
//       const dx = curr.x - prev.x;
//       const dy = curr.y - prev.y;
//       const dt = curr.t - prev.t; 
  
     
//       let angle = Math.atan2(dy, dx) * (180 / Math.PI);
//       if (angle < 0) angle += 360; 
  
      
//       const distance = Math.sqrt(dx * dx + dy * dy);
//       const speed = dt > 0 ? distance / dt : 0; 
  
//       processedData.push({ angle:angle, speed:speed.toFixed(2), time: curr.t });
//     }
//     console.log(processedData);

//     return processedData;
//   };



// const Line3DPlot = ({ data }) => {
//   const plotData = [
//     {
//       x: data.map((d) => d.time),
//       y: data.map((d) => d.angle),
//       z: data.map((d) => d.speed),
//       type: 'scatter3d',
//       mode: 'lines',
//       line: {
//         width: 2,
//         color: '#1f77b4',
//       },
//     },
//   ];

//   const layout = {
//     margin: { l: 0, r: 0, b: 0, t: 0 },
//     scene: {
//       xaxis: { title:  'Time'},
//       yaxis: { title: 'Angle (degrees)' },
//       zaxis: { title:  'Speed (units/s)'},
//     },
//   };

//   return <Plot data={plotData} layout={layout} style={{ width: '100%', height: '100%' }} />;
// };

  
//   export {Line3DPlot, processData};

import dynamic from 'next/dynamic';
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

/* ---------------- helpers ---------------- */
const isFin = (v) => Number.isFinite(v);
const quantile = (arr, q) => {
  if (!arr || arr.length === 0) return NaN;
  const s = arr.slice().sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return s[base + 1] !== undefined ? s[base] + rest * (s[base + 1] - s[base]) : s[base];
};
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const stdev = (a) => {
  if (!a || a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(mean(a.map((v) => (v - m) ** 2)));
};

/* ---------------- processData (keeps the same name/export) ---------------- */
/** Input: raw points like { n, p, t, x, y }.
 *  Output: cleaned array with { x, y, p, t, r } (r = radius from estimated center).
 */
const processData = (data) => {
  if (!Array.isArray(data)) return [];
  const cleaned = data
    .filter((d) => d && isFin(d.x) && isFin(d.y) && isFin(d.p))
    .map((d, i) => ({
      x: d.x,
      y: d.y,
      p: d.p,
      t: isFin(d.t) ? d.t : i, // fallback to index if t missing
    }));

  if (!cleaned.length) return [];

  // Sort by time for stability
  cleaned.sort((a, b) => a.t - b.t);

  // Estimate center via medians (robust)
  const xs = cleaned.map((d) => d.x).slice().sort((a, b) => a - b);
  const ys = cleaned.map((d) => d.y).slice().sort((a, b) => a - b);
  const cx = quantile(xs, 0.5);
  const cy = quantile(ys, 0.5);

  // Add radius
  for (const d of cleaned) d.r = Math.hypot(d.x - cx, d.y - cy);

  return cleaned;
};

/* ---------------- Line3DPlot (same name/export, simple view) ---------------- */
/**
 * Props:
 *  - data: output of processData()
 *  - binCount: desired number of equal-count bins (default 45)
 *  - minPerBin: minimum samples per bin (default 20)
 *  - samplePoints: number of random sample dots to draw (default 300)
 */
const Line3DPlot = ({
  data = [],
  binCount = 45,
  minPerBin = 20,
  samplePoints = 300,
}) => {
  const D = Array.isArray(data)
    ? data.filter((d) => isFin(d?.r) && isFin(d?.p))
    : [];
  if (!D.length) return null;

  const rArr = D.map((d) => d.r);
  const pArr = D.map((d) => d.p);

  // ===== Equal-count binning across radius =====
  const idx = rArr.map((_, i) => i).sort((i, j) => rArr[i] - rArr[j]);
  const N = idx.length;
  const per = Math.max(minPerBin, Math.floor(N / binCount) || 1);

  const centers = [];
  const q25 = [];
  const q50 = [];
  const q75 = [];
  for (let start = 0; start < N; start += per) {
    const end = Math.min(N, start + per);
    const sliceIdx = idx.slice(start, end);
    const rs = sliceIdx.map((i) => rArr[i]);
    const ps = sliceIdx.map((i) => pArr[i]);
    if (ps.length < Math.max(3, Math.floor(minPerBin / 3))) continue;
    centers.push(mean(rs));
    q25.push(quantile(ps, 0.25));
    q50.push(quantile(ps, 0.50));
    q75.push(quantile(ps, 0.75));
  }

  // Downsample samples for a light background texture
  const S = Math.min(samplePoints, D.length);
  const chosen = [];
  for (let i = 0; i < S; i++) chosen.push(Math.floor(Math.random() * D.length));

  // Flat-pressure note
  const almostFlat = stdev(pArr) < 0.5; // tune threshold to your device scale

  const traces = [
    // Faint sample dots
    {
      x: chosen.map((i) => rArr[i]),
      y: chosen.map((i) => pArr[i]),
      type: 'scattergl',
      mode: 'markers',
      name: 'Samples',
      marker: { size: 5, opacity: 0.25 },
      hovertemplate: 'Radius: %{x:.2f}<br>Pressure: %{y:.2f}<extra></extra>',
    },
    // Lower edge of IQR
    {
      x: centers,
      y: q25,
      type: 'scatter',
      mode: 'lines',
      name: 'Lower (q=0.25)',
      line: { width: 1 },
      hovertemplate: 'Radius: %{x:.2f}<br>q25: %{y:.2f}<extra></extra>',
      connectgaps: false,
    },
    // Upper edge of IQR (shaded to lower)
    {
      x: centers,
      y: q75,
      type: 'scatter',
      mode: 'lines',
      name: 'Upper (q=0.75)',
      line: { width: 1 },
      fill: 'tonexty',
      fillcolor: 'rgba(100,160,255,0.22)', // simple, readable band
      hovertemplate: 'Radius: %{x:.2f}<br>q75: %{y:.2f}<extra></extra>',
      connectgaps: false,
    },
    // Median line
    {
      x: centers,
      y: q50,
      type: 'scatter',
      mode: 'lines',
      name: 'Median',
      line: { width: 3 },
      hovertemplate: 'Radius: %{x:.2f}<br>Median: %{y:.2f}<extra></extra>',
      connectgaps: false,
    },
  ];

  const layout = {
    margin: { l: 56, r: 18, b: 48, t: 40 },
    xaxis: { title: 'Radius (px)', zeroline: false },
    yaxis: { title: 'Pressure', zeroline: false },
    showlegend: true,
    legend: { bgcolor: 'rgba(255,255,255,0.8)' },
    hovermode: 'closest',
    title: { text: 'Pressure vs Radius — Simple View', x: 0.02, xanchor: 'left' },
    annotations: almostFlat
      ? [
          {
            xref: 'paper',
            yref: 'paper',
            x: 0.5,
            y: 1.12,
            xanchor: 'center',
            yanchor: 'bottom',
            text:
              'Pressure looks constant — the band collapses (device may not report variable pressure).',
            showarrow: false,
            font: { size: 12, color: 'rgba(80,80,80,1)' },
          },
        ]
      : [],
  };

  const config = { responsive: true, displayModeBar: false, scrollZoom: false };

  return (
    <Plot
      data={traces}
      layout={layout}
      config={config}
      useResizeHandler
      style={{ width: '100%', height: '100%' }}
    />
  );
};

export { Line3DPlot, processData };
