import { sum } from "d3";
import dynamic from "next/dynamic";
import { useState } from "react";

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

// Process the tremor data
const processTremorData = (result) => {
  const axes = [];
  const powers = [];
  const polarities = [];
  const frequencies = [];

  // Extract tremor direction and power data
  if (result) {
    for (let i = 1; i <= 3; i++) {
      const direction = result[`traxis_dir${i}`];
      const power = result[`traxis_pw${i}`];
      const polarity = result[`traxis_pol${i}`];
      const frequency = result[`traxis_fr${i}`];

      console.log(`Axis ${i} data:`, { direction, power, polarity, frequency });

      // More permissive filtering - check if we have valid numeric data
      const hasValidDirection = direction !== "No Axis" && direction !== null && direction !== undefined && !isNaN(parseFloat(direction));
      const hasValidPower = power !== "No Axis" && power !== null && power !== undefined && !isNaN(parseFloat(power));
      
      // If we have at least one valid value, try to use it
      if (hasValidDirection || hasValidPower) {
        // Use default values if one is missing
        const dirValue = hasValidDirection ? parseFloat(direction) : 0;
        const powerValue = hasValidPower ? parseFloat(power) : 0.1; // Small default power
        const polValue = polarity !== "No Axis" && !isNaN(parseFloat(polarity)) ? parseFloat(polarity) : 0.5; // Default polarity
        const freqValue = frequency !== "No Axis" && !isNaN(parseFloat(frequency)) ? parseFloat(frequency) : 1.0; // Default frequency
        
        axes.push(dirValue);
        powers.push(powerValue);
        polarities.push(polValue);
        frequencies.push(freqValue);
        
        console.log(`Added axis ${i}:`, { dirValue, powerValue, polValue, freqValue });
      } else {
        console.log(`Skipping axis ${i} - no valid data`);
      }
    }
  }

  // Extract amplitude data
  const maxAmplitude = parseFloat(result["max amp. (cm)"]) || 0;
  const meanAmplitude = parseFloat(result["mean amp. (cm)"]) || 0;
  const stdAmplitude = parseFloat(result["std of amp."]) || 0;

  // Convert amplitude to mm for clinical readability
  const amplitudeData = {
    max: maxAmplitude * 10000,
    mean: meanAmplitude * 10000,
    std: stdAmplitude * 10000,
  };
  console.log("=== TREMOR DATA DEBUG ===");
  console.log("Raw result keys:", Object.keys(result || {}));
  console.log("traxis_dir values:", {
    dir1: result[`traxis_dir1`],
    dir2: result[`traxis_dir2`],
    dir3: result[`traxis_dir3`],
  });
  console.log("traxis_pw values:", {
    pw1: result[`traxis_pw1`],
    pw2: result[`traxis_pw2`],
    pw3: result[`traxis_pw3`],
  });
  console.log("Processed arrays:", {
    axes,
    powers,
    polarities,
    frequencies,
    amplitudeData,
  });
  console.log("hasAxes will be:", axes.length > 0);
  console.log("=== DETAILED AXES DEBUG ===");
  console.log("Axes array:", axes);
  console.log("Powers array:", powers);
  console.log("Polarities array:", polarities);
  console.log("Frequencies array:", frequencies);
  console.log("Array lengths - axes:", axes.length, "powers:", powers.length, "polarities:", polarities.length, "frequencies:", frequencies.length);

  console.log("Comprehensive Tremor Data:", {
    axes,
    powers,
    polarities,
    frequencies,
    amplitudeData,
  });
  return { axes, powers, polarities, frequencies, amplitudeData };
};

const TremorPolarPlot = ({ result }) => {
  const [currentSection, setCurrentSection] = useState(0);
  
  if (!result) {
    return <div>Loading tremor data...</div>; // or return null
  }
  const { axes, powers, polarities, frequencies, amplitudeData } =
    processTremorData(result);

  // Check if any axes are detected
  const hasAxes = axes.length > 0;

  // Calculate marker sizes based on amplitude (scaling for visibility)

  const baseMarkerSize = 8;
  const maxMarkerSize = 20;

  const maxPower = hasAxes ? Math.max(...powers) : 0;
  const minPower = hasAxes ? Math.min(...powers) : 0;
  const powerRange = maxPower - minPower;

  const markerSizes = hasAxes
    ? axes.map((_, index) => {
        if (powerRange === 0) return baseMarkerSize;

        const normalizedPower = (powers[index] - minPower) / powerRange;
        return (
          baseMarkerSize + normalizedPower * (maxMarkerSize - baseMarkerSize)
        );
      })
    : [];

  // Color scale for polarity (higher polarity = better tremor quality)
  const polarityColors = polarities.map(
    (pol) =>
      `rgba(${Math.round(255 * (1 - pol))}, ${Math.round(255 * pol)}, 100, 0.8)`
  );

  // Define colors for each axis (not too bright)
  const axisColors = ["#4a90e2", "#7ed321", "#f5a623", "#d0021b", "#9013fe", "#50e3c2"];
  
  const plotData = hasAxes
    ? [
        // Amplitude reference circle
        {
          type: "scatterpolar",
          mode: "lines",
          r: Array(360).fill(amplitudeData.max * 2),
          theta: Array.from({ length: 360 }, (_, i) => i),
          line: {
            color: "rgba(255, 165, 0, 0.3)",
            width: 1,
            dash: "dot",
          },
          showlegend: false,
          hoverinfo: "skip",
        },
        // Center point
        {
          type: "scatterpolar",
          mode: "markers",
          r: [0],
          theta: [0],
          marker: {
            color: "#dc2626",
            size: 6,
          },
          showlegend: false,
          hoverinfo: "skip",
        },
        // Add bidirectional arrows for each axis (two traces per axis)
        ...axes.flatMap((axis, index) => {
          console.log(`=== PROCESSING AXIS ${index + 1} ===`);
          console.log(`Original axis direction: ${axis}°`);
          console.log(`Original axis power: ${powers[index]}`);
          console.log(`Original axis polarity: ${polarities[index]}`);
          console.log(`Original axis frequency: ${frequencies[index]}`);
          
          // Check for overlapping directions with previous axes
          const overlappingAxes = axes.slice(0, index).filter(prevAxis => 
            Math.abs(prevAxis - axis) < 2 || Math.abs(prevAxis - (axis + 180)) < 2
          );
          
          if (overlappingAxes.length > 0) {
            console.log(`Axis ${index + 1} overlaps with previous axes:`, overlappingAxes);
          }
          
          // Slightly offset overlapping arrows for better visibility
          const offset = overlappingAxes.length * 5; // 5 degree offset per overlap
          const adjustedAxis = axis + offset;
          
          console.log(`Adjusted axis direction: ${adjustedAxis}°`);
          console.log(`Offset applied: ${offset}°`);
          console.log(`Final power value: ${powers[index]}`);
          console.log(`Axis color: ${axisColors[index % axisColors.length]}`);
          console.log(`=== END AXIS ${index + 1} ===`);
          
          // Create multiple points along the line for proper rendering
          const numPoints = 10;
          const linePoints = Array.from({length: numPoints}, (_, i) => (maxPower * 1.4 * i) / (numPoints - 1));
          
          return [
            // Positive direction arrow - multiple points
            {
              type: "scatterpolar",
              mode: "lines",
              r: linePoints,
              theta: Array(numPoints).fill(adjustedAxis),
              line: {
                color: axisColors[index % axisColors.length],
                width: 3,
              },
              showlegend: false,
              customdata: Array(numPoints).fill([powers[index], index + 1]),
              hovertemplate:
                "<b>Direction</b>: " + adjustedAxis.toFixed(0) + "°<br>" +
                "<b>Power</b>: " + powers[index].toFixed(3) + "<br>" +
                "<b>Axis</b> " + (index + 1) + "<br>" +
                "<extra></extra>",
              hoverlabel: {
                bgcolor: axisColors[index % axisColors.length],
                font: { color: "white" }
              },
            },
            // Negative direction arrow - multiple points
            {
              type: "scatterpolar",
              mode: "lines",
              r: linePoints,
              theta: Array(numPoints).fill(adjustedAxis + 180),
              line: {
                color: axisColors[index % axisColors.length],
                width: 3,
              },
              showlegend: false,
              customdata: Array(numPoints).fill([powers[index], index + 1]),
              hovertemplate:
                "<b>Direction</b>: " + adjustedAxis.toFixed(0) + "°<br>" +
                "<b>Power</b>: " + powers[index].toFixed(3) + "<br>" +
                "<b>Axis</b> " + (index + 1) + "<br>" +
                "<extra></extra>",
              hoverlabel: {
                bgcolor: axisColors[index % axisColors.length],
                font: { color: "white" }
              },
            }
          ];
        }),
      ]
    : [];

  console.log(`Total plot data traces: ${plotData.length}`);
  console.log(`Number of axes: ${axes.length}`);
  console.log(`Expected arrows: ${axes.length * 4} (2 lines + 2 arrowheads per axis)`);

  // Clinical metrics
  const maxPowerValue = hasAxes ? Math.max(...powers) : 0;
  const maxPowerIndex = hasAxes ? powers.indexOf(maxPowerValue) : -1;
  const dominantDirection = maxPowerIndex >= 0 ? axes[maxPowerIndex] : 0;
  const dominantPolarity = maxPowerIndex >= 0 ? polarities[maxPowerIndex] : 0;
  const dominantFrequency = maxPowerIndex >= 0 ? frequencies[maxPowerIndex] : 0;

  // Power distribution
  const powerMean = hasAxes
    ? powers.reduce((a, b) => a + b) / powers.length
    : 0;
  const powerCV = hasAxes
    ? Math.sqrt(
        powers.reduce((sum, p) => sum + Math.pow(p - powerMean, 2), 0) /
          powers.length
      ) / powerMean
    : 0;
  const isDirectional = powerCV > 0.3;

  // Calculate anisotropy
  const rawAnisotropy = result["R-L hemi-pr"];
  const anisotropy =
    rawAnisotropy === "-Inf" ||
    rawAnisotropy === "Inf" ||
    rawAnisotropy === "NaN"
      ? "N/A"
      : parseFloat(rawAnisotropy) || 0;

  const layout = {
    polar: {
      radialaxis: {
        visible: true,
        range: [0, maxPower * 1.2],
        showticklabels: false,
        tickfont: { color: "#1e3a8a", weight: "bold", size: 8 },
        gridcolor: "#444444",
        tickangle: 0,
      },
      angularaxis: {
        direction: "clockwise",
        tickmode: "linear",
        dtick: 30,
        rotation: 90,
        tickfont: { color: "#000000", size: 7, weight: "bold" },
        gridcolor: "#444444",
      },
      bgcolor: "rgba(0,0,0,0.1)",
    },
    margin: { l: 2, r: 20, b: 20, t: 30 },
    showlegend: false,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
  };

  // Clinical sections for carousel
  const clinicalSections = [
    {
      title: "Primary Axis",
      color: "#16a34a",
      bgColor: "rgba(0,100,0,0.2)",
      borderColor: "#16a34a",
      data: [
        { label: "Direction", value: `${dominantDirection}°`, color: "#cc6600" },
        { label: "Power", value: maxPower.toFixed(2), color: "#cc6600" },
        { label: "Quality", value: isNaN(dominantPolarity) ? "N/A" : `${(dominantPolarity * 100).toFixed(0)}%`, 
          color: dominantPolarity > 0.95 ? "#00aa00" : "#cc6600" },
      ]
    },
    {
      title: "Amplitude",
      color: "#ff8800",
      bgColor: "rgba(100,50,0,0.2)",
      borderColor: "#ff8800",
      data: [
        { label: "Max", value: amplitudeData.max.toFixed(1), color: "#cc6600" },
        { label: "Mean", value: amplitudeData.mean.toFixed(1), color: "#cc6600" },
        { label: "Variation", value: `${amplitudeData.mean > 0 ? ((amplitudeData.std / amplitudeData.mean) * 100).toFixed(0) : "0"}%`, 
          color: amplitudeData.std / amplitudeData.mean > 0.5 ? "#cc0000" : "#00aa00" },
      ]
    },
    {
      title: "Assessment",
      color: "#4488ff",
      bgColor: "rgba(0,0,100,0.2)",
      borderColor: "#4488ff",
      data: [
        { label: "Type", value: isDirectional ? "Directional" : "Symmetric", 
          color: isDirectional ? "#cc6600" : "#00aa00" },
        { label: "Frequency", value: isNaN(dominantFrequency) ? "N/A" : `${dominantFrequency.toFixed(1)}Hz`, color: "#cc3300" },
        { label: "Category", value: result["Cal Tremor"] || "N/A", color: "#0066cc" },
      ]
    }
  ];

  const nextSection = () => {
    setCurrentSection((prev) => (prev + 1) % clinicalSections.length);
  };

  const prevSection = () => {
    setCurrentSection((prev) => (prev - 1 + clinicalSections.length) % clinicalSections.length);
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        textAlign: "center",
        color: "#333",
        fontFamily: "monospace",
        display: "flex",
        flexDirection: "row",
        gap: "8px",
        minHeight: "140px",
        maxHeight: "400px",
      }}
    >
      {hasAxes ? (
        <>
          {/* Left Side - Bigger Polar Plot */}
          <div style={{ flex: "0.6", minHeight: "140px", height: "100%" }}>
          <Plot
            data={plotData}
            layout={layout}
            config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%", height: "100%", minHeight: "140px" }}
          />
          </div>

          {/* Right Side - Clinical Information Carousel */}
          <div
            style={{
              flex: "0.6",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              minWidth: "100px",
              maxWidth: "180px",
            }}
          >
            {/* Clinical Information Carousel */}
            <div
              style={{
                padding: "12px",
                backgroundColor: "rgba(0,0,0,0.05)",
                borderRadius: "8px",
                height: "fit-content",
              }}
            >
              {/* Carousel Navigation */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <button
                  onClick={prevSection}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#666",
                    fontSize: "16px",
                    cursor: "pointer",
                    padding: "4px 6px",
                    borderRadius: "4px",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => e.target.style.color = "#fff"}
                  onMouseLeave={(e) => e.target.style.color = "#666"}
            >
                  ‹
                </button>
                
              <h4
                style={{
                    margin: "0",
                    color: clinicalSections[currentSection].color,
                    fontSize: "11px",
                    fontWeight: "bold",
                    textAlign: "center",
                    flex: "1",
                }}
              >
                  {clinicalSections[currentSection].title}
              </h4>
                
                <button
                  onClick={nextSection}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#666",
                    fontSize: "16px",
                    cursor: "pointer",
                    padding: "4px 6px",
                    borderRadius: "4px",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => e.target.style.color = "#fff"}
                  onMouseLeave={(e) => e.target.style.color = "#666"}
                >
                  ›
                </button>
            </div>

              {/* Current Section Content */}
            <div
              style={{
                  backgroundColor: clinicalSections[currentSection].bgColor,
                  padding: "12px",
                  borderRadius: "6px",
                  border: `2px solid ${clinicalSections[currentSection].borderColor}`,
                  minHeight: "120px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                {clinicalSections[currentSection].data.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: index < clinicalSections[currentSection].data.length - 1 ? "8px" : "0",
              }}
            >
                    <span style={{ color: "#333", fontSize: "12px", fontWeight: "bold" }}>
                      {item.label}:
                    </span>
                    <span style={{ color: item.color, fontSize: "12px", fontWeight: "bold" }}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Section Indicators */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "6px",
                  marginTop: "10px",
                }}
              >
                {clinicalSections.map((_, index) => (
                  <div
                    key={index}
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: index === currentSection ? clinicalSections[currentSection].color : "#444",
                      transition: "all 0.2s",
                    }}
                  />
                ))}
            </div>
          </div>

          {/* Compact Legend */}
          <div
            style={{
                fontSize: "10px",
                marginTop: "10px",
              color: "#666666",
              textAlign: "center",
            }}
          >
            </div>
          </div>
        </>
      ) : (
        <div
          style={{
            color: "#333",
            fontSize: "16px",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            width: "100%",
          }}
        >
          No tremor axes detected
        </div>
      )}
    </div>
  );
};

export default TremorPolarPlot;
