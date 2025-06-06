import dynamic from "next/dynamic";

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

// Process the tremor data
const processTremorData = (result) => {
  const axes = [];
  const powers = [];

  // Extract tremor direction and power data
  if (result) {
    for (let i = 1; i <= 3; i++) {
      const direction = result[`traxis_dir${i}`];
      const power = result[`traxis_pw${i}`];

      // Only add if the axis is detected
      if (direction !== "No Axis" && power !== "No Axis") {
        axes.push(parseFloat(direction));
        powers.push(parseFloat(power));
      }
    }
  }

  console.log("Processed Tremor Data:", { axes, powers });
  return { axes, powers };
};

const TremorPolarPlot = ({ result }) => {
  if (!result) {
    return <div>Loading tremor data...</div>; // or return null
  }
  const { axes, powers } = processTremorData(result);

  // Check if any axes are detected
  const hasAxes = axes.length > 0;

  const plotData = hasAxes
    ? [
        {
          type: "scatterpolar",
          mode: "lines+markers",
          r: powers,
          theta: axes,
          fill: "toself",
          marker: { color: "#00ff00", size: 6 },
          line: { color: "#00ff00", width: 2 },
        },
        {
          type: "scatterpolar",
          mode: "markers",
          r: [0],
          theta: [0],
          marker: { color: "red", size: 5 },
        },
      ]
    : [];

  const maxPower = Math.max(...powers, 0);
  const maxDirection = axes[powers.indexOf(maxPower)] || 0;
  const frequency = result["X Freq"] || 0;
  const anisotropy =
    result["R-L hemi-pr"] === "Inf"
      ? 1
      : parseFloat(result["R-L hemi-pr"]) || 0;

  const layout = {
    polar: {
      radialaxis: { visible: true, range: [0, maxPower * 1.2] },
      angularaxis: { direction: "clockwise", tickmode: "array", rotation: 0 },
    },
    margin: { l: 0, r: 0, b: 0, t: 0 },
    showlegend: false,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
  };

  return (
    <div
      style={{
        width: "300px",
        height: "300px",
        textAlign: "center",
        color: "white",
      }}
    >
      {hasAxes ? (
        <Plot
          data={plotData}
          layout={layout}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: "100%", height: "100%" }}
        />
      ) : (
        <div style={{ color: "lime", fontSize: "18px", fontWeight: "bold" }}>
          No axes detected
        </div>
      )}
      {hasAxes && (
        <div
          style={{
            color: "cyan",
            fontSize: "12px",
            textAlign: "left",
            marginTop: "10px",
          }}
        >
          <p style={{ margin: 0 }}>Rel. Power. Max = {maxPower.toFixed(6)}</p>
          <p style={{ color: "red", margin: 0 }}>Frequency: {frequency}</p>
          <p style={{ color: "red", margin: 0 }}>Direction: {maxDirection}</p>
          <p style={{ color: "red", margin: 0 }}>
            Anisotropy: {anisotropy.toFixed(3)}
          </p>
        </div>
      )}
    </div>
  );
};

export default TremorPolarPlot;

