// components/PressureVsX.js
import dynamic from 'next/dynamic';
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

/* ---------------- helpers ---------------- */
const isFin = (v) => Number.isFinite(v);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const quantile = (arr, q) => {
  if (!arr || arr.length === 0) return NaN;
  const s = arr.slice().sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return s[base + 1] !== undefined ? s[base] + rest * (s[base + 1] - s[base]) : s[base];
};
const spearmanRho = (x, y) => {
  const n = Math.min(x.length, y.length);
  if (n < 3) return NaN;
  const rx = ranks(x.slice(0, n));
  const ry = ranks(y.slice(0, n));
  return pearson(rx, ry);
};
const pearson = (x, y) => {
  const n = Math.min(x.length, y.length);
  if (n < 2) return NaN;
  const mx = mean(x), my = mean(y);
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
  }
  const den = Math.sqrt(dx2 * dy2);
  return den ? num / den : NaN;
};
function ranks(arr) {
  const n = arr.length;
  const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(n);
  for (let i = 0; i < n; ) {
    let j = i + 1;
    while (j < n && idx[j][0] === idx[i][0]) j++;
    const avg = (i + j - 1) / 2 + 1;
    for (let k = i; k < j; k++) r[idx[k][1]] = avg;
    i = j;
  }
  return r;
}

/* ---------------- processing ---------------- */
export function processData(data = []) {
  const cleaned = (Array.isArray(data) ? data : [])
    .filter((d) => d && isFin(d.x) && isFin(d.y) && isFin(d.p))
    .map((d, i) => ({
      x: +d.x, y: +d.y, p: +d.p,
      t: isFin(d.t) ? +d.t : i
    }));
  if (!cleaned.length) return [];

  cleaned.sort((a, b) => a.t - b.t);

  const xs = cleaned.map(d => d.x).slice().sort((a,b)=>a-b);
  const ys = cleaned.map(d => d.y).slice().sort((a,b)=>a-b);
  const cx = quantile(xs, 0.5), cy = quantile(ys, 0.5);

  for (const d of cleaned) {
    const dx = d.x - cx, dy = d.y - cy;
    d.r = Math.hypot(dx, dy);
    d.theta = Math.atan2(dy, dx);
  }
  return cleaned;
}

function binPressureByX(D, { bins = 60, minPerBin = 10 }) {
  if (!D.length) return { centers: [], q25: [], q50: [], q75: [], counts: [], minX: NaN, maxX: NaN };
  const minX = Math.min(...D.map(d => d.x));
  const maxX = Math.max(...D.map(d => d.x));
  if (!(maxX > minX)) return { centers: [], q25: [], q50: [], q75: [], counts: [], minX, maxX };

  const width = (maxX - minX) / bins;
  const buckets = Array.from({ length: bins }, (_, i) => ({
    x0: minX + i * width,
    x1: minX + (i + 1) * width,
    ps: []
  }));

  for (const d of D) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((d.x - minX) / width)));
    buckets[idx].ps.push(d.p);
  }

  const centers = [], q25 = [], q50 = [], q75 = [], counts = [];
  for (const b of buckets) {
    if (b.ps.length >= minPerBin) {
      centers.push((b.x0 + b.x1) / 2);
      q25.push(quantile(b.ps, 0.25));
      q50.push(quantile(b.ps, 0.50));
      q75.push(quantile(b.ps, 0.75));
      counts.push(b.ps.length);
    }
  }
  return { centers, q25, q50, q75, counts, minX, maxX };
}

export function computeConeStats(binOut) {
  const { centers, q25, q75, minX, maxX } = binOut;
  if (!centers?.length) return { coneIndex: NaN, centralIQR: NaN, edgeIQR: NaN, centerX: NaN, rangeX: 0 };
  const centerX = (minX + maxX) / 2;
  const rangeX = (maxX - minX) || 1;

  const IQR = centers.map((_, i) => q75[i] - q25[i]);
  const centralMask = centers.map(c => Math.abs(c - centerX) <= 0.15 * rangeX);
  const edgeMask    = centers.map(c => Math.abs(c - centerX) >= 0.40 * rangeX);

  const centralVals = IQR.filter((_, i) => centralMask[i]);
  const edgeVals    = IQR.filter((_, i) => edgeMask[i]);

  const centralIQR = centralVals.length ? mean(centralVals) : NaN;
  const edgeIQR = edgeVals.length ? mean(edgeVals) : NaN;

  const coneIndex = Number.isFinite(centralIQR) && Number.isFinite(edgeIQR) && edgeIQR > 0
    ? centralIQR / edgeIQR
    : NaN;

  return { coneIndex, centralIQR, edgeIQR, centerX, rangeX };
}

/* ---------------- main component ---------------- */
export function PressureVsX({
  data = [],
  bins = 60,
  minPerBin = 10,
  samplePoints = 400,
  splitByQuadrant = false,
}) {
  const D = processData(data);
  if (!D.length) return null;

  // Diagnostics (used for the side metrics)
  const pArr = D.map(d => d.p);
  const rArr = D.map(d => d.r);
  const tArr = D.map(d => d.t);

  const corr_p_r = pearson(
    rArr.filter((_, i) => Number.isFinite(pArr[i])),
    pArr.filter((_, i) => Number.isFinite(pArr[i]))
  );
  const rho_r_t = spearmanRho(
    tArr.filter((_, i) => Number.isFinite(rArr[i])),
    rArr.filter((_, i) => Number.isFinite(rArr[i]))
  );

  const binned = binPressureByX(D, { bins, minPerBin });
  const cone = computeConeStats(binned);

  const traces = [];

  // Samples (downsample for speed)
  const S = Math.min(samplePoints, D.length);
  const step = Math.max(1, Math.floor(D.length / S));
  const ids = [];
  for (let i = 0; i < D.length; i += step) ids.push(i);

  traces.push({
    x: ids.map(i => D[i].x),
    y: ids.map(i => D[i].p),
    type: 'scattergl',
    mode: 'markers',
    name: 'Samples',
    marker: { size: 4, opacity: 0.25 },
    hovertemplate: 'x: %{x:.2f}<br>p: %{y:.2f}<extra></extra>',
  });

  // Optional: quadrant medians (still useful, legend hidden)
  if (splitByQuadrant) {
    const cx = quantile(D.map(d => d.x).slice().sort((a,b)=>a-b), 0.5);
    const cy = quantile(D.map(d => d.y).slice().sort((a,b)=>a-b), 0.5);
    const quadrants = [
      { name: 'Q1 median', pred: (d) => d.x >= cx && d.y >= cy },
      { name: 'Q2 median', pred: (d) => d.x <  cx && d.y >= cy },
      { name: 'Q3 median', pred: (d) => d.x <  cx && d.y <  cy },
      { name: 'Q4 median', pred: (d) => d.x >= cx && d.y <  cy },
    ];
    for (const q of quadrants) {
      const subset = D.filter(q.pred);
      const bq = binPressureByX(subset, {
        bins: Math.max(20, Math.floor(bins/2)),
        minPerBin: Math.max(6, Math.floor(minPerBin/2))
      });
      traces.push({
        x: bq.centers,
        y: bq.q50,
        type: 'scatter',
        mode: 'lines',
        name: q.name,
        line: { width: 1 },
        hovertemplate: 'x: %{x:.2f}<br>median: %{y:.2f}<extra></extra>',
        connectgaps: false,
      });
    }
  }

  // Center line
  const centerX = (binned.minX + binned.maxX) / 2;
  const pMin = Math.min(...pArr);
  const pMax = Math.max(...pArr);

  // Side metrics (narrower column + smaller font)
  const sideStats = [
    `Cone Index: ${Number.isFinite(cone.coneIndex) ? cone.coneIndex.toFixed(2) : 'n/a'}`,
    `Central IQR: ${Number.isFinite(cone.centralIQR) ? cone.centralIQR.toFixed(2) : 'n/a'}`,
    `Edge IQR: ${Number.isFinite(cone.edgeIQR) ? cone.edgeIQR.toFixed(2) : 'n/a'}`,
    `corr(p,r): ${Number.isFinite(corr_p_r) ? corr_p_r.toFixed(2) : 'n/a'}`,
    `Spearman ρ(r,t): ${Number.isFinite(rho_r_t) ? rho_r_t.toFixed(2) : 'n/a'}`,
  ];
  const sideAnnots = sideStats.map((text, i) => ({
    xref: 'paper', yref: 'paper',
    x: 1.01, y: 1 - i * 0.07,            // tighter spacing
    xanchor: 'left', yanchor: 'top',
    showarrow: false,
    text,
    font: { size: 11 },                   // smaller font
    align: 'left',
  }));

  const layout = {
    margin: { l: 60, r: 110, b: 48, t: 16 }, // ~half the previous right margin
    xaxis: { title: 'X', zeroline: false },
    yaxis: { title: 'Pressure', zeroline: false },
    showlegend: false,                      // remove legends
    hovermode: 'closest',
    shapes: Number.isFinite(centerX) ? [{
      type: 'line',
      x0: centerX, x1: centerX,
      y0: pMin, y1: pMax,
      line: { width: 1, dash: 'dot' },
    }] : [],
    annotations: sideAnnots,
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
}
